import { randomUUID } from "node:crypto";
import logger from "../utils/logger.js";
import {
  createGenerationLog,
  markGenerationStarted,
  markGenerationSuccess,
  markGenerationFailed,
} from "./generationLog.service.js";
import {
  createFlow,
  getFlow,
  setFlow as setFlowInFirestore,
} from "./characterCreationFlow.firestore.service.js";

const VALID_STATUSES = new Set([
  "draft",
  "pending",
  "persona",
  "appearance",
  "voice",
  "generating",
  "completed",
  "failed",
  "cancelled",
]);

const isoNow = () => new Date().toISOString();

const trimString = (value) =>
  typeof value === "string" ? value.trim() : "";

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

const sanitizePersona = (value = {}) => {
  const source = typeof value === "object" && value !== null ? value : {};
  return {
    name: trimString(source.name),
    tagline: trimString(source.tagline),
    hiddenProfile: trimString(source.hiddenProfile),
    prompt: trimString(source.prompt),
  };
};

const sanitizeAppearance = (value = null) => {
  // 添加調試日誌
  if (process.env.NODE_ENV !== "test") {
    logger.info(`[sanitizeAppearance] Input value: ${JSON.stringify({
      hasValue: !!value,
      type: typeof value,
      hasDescription: !!value?.description,
      descriptionLength: value?.description?.length || 0,
      descriptionPreview: value?.description?.substring(0, 50) || '',
      hasStyles: Array.isArray(value?.styles),
      stylesCount: value?.styles?.length || 0,
    })}`);
  }

  if (!value || typeof value !== "object") {
    logger.info(`[sanitizeAppearance] Returning null - invalid input`);
    return null;
  }

  const id = trimString(value.id);
  const label = trimString(value.label);
  const image = trimString(value.image);
  const alt = trimString(value.alt);
  const description = trimString(value.description);
  const styles = Array.isArray(value.styles) ? value.styles : [];
  const referenceInfo = value.referenceInfo || null;

  // 添加調試日誌
  if (process.env.NODE_ENV !== "test") {
    logger.info(`[sanitizeAppearance] After trimString: ${JSON.stringify({
      id: id,
      label: label,
      image: image,
      alt: alt,
      description: description?.substring(0, 50) || '',
      descriptionLength: description?.length || 0,
      stylesCount: styles.length,
    })}`);
  }

  // 🔥 修復：只要有 description 或 styles 就應該保留 appearance
  // 之前的邏輯要求至少有一個字段（id/label/image/alt/description），但會導致
  // 當只有 description 和 styles 時被誤判為空而返回 null
  const hasContent = description || styles.length > 0 || id || label || image || alt;

  if (process.env.NODE_ENV !== "test") {
    logger.info(`[sanitizeAppearance] hasContent check: ${JSON.stringify({
      description: !!description,
      'styles.length': styles.length,
      id: !!id,
      label: !!label,
      image: !!image,
      alt: !!alt,
      hasContent: hasContent,
    })}`);
  }

  if (!hasContent) {
    logger.info(`[sanitizeAppearance] Returning null - no content`);
    return null;
  }

  const result = {
    id,
    label,
    image,
    alt,
    description,
    styles,
    referenceInfo,
  };

  if (process.env.NODE_ENV !== "test") {
    logger.info(`[sanitizeAppearance] Returning result with description length: ${result.description?.length || 0}`);
  }

  return result;
};

const sanitizeVoice = (value = null) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = trimString(value.id);
  const label = trimString(value.label);
  const description = trimString(value.description);
  const gender = trimString(value.gender);
  const ageGroup = trimString(value.ageGroup);

  if (!id && !label && !description) {
    return null;
  }

  return {
    id,
    label,
    description,
    gender,
    ageGroup,
  };
};

const normalizeStatus = (value) => {
  const status = trimString(value).toLowerCase();
  if (!status) {
    return null;
  }
  if (VALID_STATUSES.has(status)) {
    return status;
  }
  return null;
};

const ensureFlow = async (flowId) => {
  const flow = await getFlow(flowId);
  if (!flow) {
    const error = new Error("找不到對應的角色創建流程");
    error.status = 404;
    throw error;
  }
  return flow;
};

const ensureSummaryTimestamp = (flow, timestamp = isoNow()) => {
  flow.summaryUpdatedAt = timestamp;
};

const recordChargeEntry = (flow, payload = {}, fallbackKey = null) => {
  const key =
    trimString(payload.idempotencyKey) ||
    (fallbackKey ? trimString(fallbackKey) : "");
  const now = isoNow();

  let existing = null;
  if (key) {
    existing = flow.charges.find(
      (entry) => entry.idempotencyKey === key
    );
  }

  if (existing) {
    existing.updatedAt = now;
    if (payload.status) {
      const status = trimString(payload.status);
      if (status) {
        existing.status = status;
      }
    }
    if (
      payload.metadata &&
      typeof payload.metadata === "object" &&
      payload.metadata !== null
    ) {
      existing.metadata = { ...existing.metadata, ...payload.metadata };
    }
    return existing;
  }

  const entry = {
    id: payload.id ?? `charge-${randomUUID()}`,
    type: trimString(payload.type) || "llm-generation",
    amount: Number.isFinite(payload.amount)
      ? Number(payload.amount)
      : 0,
    currency: trimString(payload.currency) || "credits",
    status: trimString(payload.status) || "reserved",
    metadata:
      payload.metadata && typeof payload.metadata === "object"
        ? { ...payload.metadata }
        : {},
    idempotencyKey: key || null,
    createdAt: now,
    updatedAt: now,
  };

  flow.charges.push(entry);
  return entry;
};

const createFlowRecord = (payload = {}) => {
  const now = isoNow();
  const persona = sanitizePersona(payload.persona);
  const appearance = sanitizeAppearance(payload.appearance);
  const voice = sanitizeVoice(payload.voice);

  return {
    id: payload.id ?? `flow-${randomUUID()}`,
    userId: trimString(payload.userId),
    status: normalizeStatus(payload.status) ?? "draft",
    persona,
    appearance,
    voice,
    summaryUpdatedAt: payload.summaryUpdatedAt ?? now,
    charges: [],
    generation: {
      status: "idle",
      idempotencyKey: null,
      requestId: null,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    },
    metadata:
      payload.metadata && typeof payload.metadata === "object"
        ? { ...payload.metadata }
        : {},
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? now,
  };
};

export const createCreationFlow = async (payload = {}) => {
  const record = createFlowRecord(payload);
  const createdFlow = await createFlow(record.id, record);
  return cloneValue(createdFlow);
};

export const getCreationFlow = async (flowId) => {
  const flow = await getFlow(flowId);
  return flow ? cloneValue(flow) : null;
};

export const mergeCreationFlow = async (flowId, payload = {}) => {
  const flow = await ensureFlow(flowId);
  const now = isoNow();
  let summaryTouched = false;

  if ("persona" in payload) {
    flow.persona = sanitizePersona(payload.persona);
    summaryTouched = true;
  }

  if ("appearance" in payload) {
    flow.appearance = sanitizeAppearance(payload.appearance);
    summaryTouched = true;
  }

  if ("voice" in payload) {
    flow.voice = sanitizeVoice(payload.voice);
    summaryTouched = true;
  }

  if (summaryTouched) {
    ensureSummaryTimestamp(flow, now);
  }

  if ("metadata" in payload) {
    const metadata =
      payload.metadata && typeof payload.metadata === "object"
        ? { ...payload.metadata }
        : {};
    flow.metadata = { ...flow.metadata, ...metadata };
  }

  if ("status" in payload) {
    const nextStatus = normalizeStatus(payload.status);
    if (nextStatus) {
      flow.status = nextStatus;
    }
  }

  flow.updatedAt = now;

  // 保存到 Firestore
  await setFlowInFirestore(flowId, flow);

  return cloneValue(flow);
};

export const recordCreationCharge = async (flowId, payload = {}) => {
  const flow = await ensureFlow(flowId);
  const entry = recordChargeEntry(flow, payload);
  flow.updatedAt = isoNow();

  // 保存到 Firestore
  await setFlowInFirestore(flowId, flow);

  return {
    flow: cloneValue(flow),
    charge: cloneValue(entry),
  };
};

export const generateCreationResult = async (
  flowId,
  {
    idempotencyKey: requestedKey,
    generator,
    charge,
    statusOnStart = "generating",
    statusOnSuccess = "completed",
    statusOnFailure = "failed",
    generationInput = null,
  } = {}
) => {
  if (typeof generator !== "function") {
    const error = new Error("缺少生成流程所需的處理函式");
    error.status = 500;
    throw error;
  }

  const flow = await ensureFlow(flowId);
  const key = trimString(requestedKey) || flowId;

  if (
    flow.generation.status === "completed" &&
    flow.generation.result &&
    (!flow.generation.idempotencyKey ||
      !key ||
      flow.generation.idempotencyKey === key)
  ) {
    return {
      flow: cloneValue(flow),
      reused: true,
      result: cloneValue(flow.generation.result),
    };
  }

  // 創建生成記錄
  let generationLog = null;
  if (generationInput) {
    try {
      generationLog = createGenerationLog({
        userId: flow.userId || "unknown",
        flowId: flow.id,
        gender: generationInput.gender || "",
        description: generationInput.description || "",
        styles: generationInput.styles || [],
        referenceInfo: generationInput.referenceInfo || null,
      });

      if (process.env.NODE_ENV !== "test") {
        logger.info(`[Generation Log] Created: ${generationLog.id} for user ${flow.userId}`);
      }
    } catch (logError) {
      // 記錄失敗不應阻止生成流程
      if (process.env.NODE_ENV !== "test") {
        logger.warn("[Generation Log] Failed to create log:", logError);
      }
    }
  }

  const now = isoNow();
  flow.generation.status = "generating";
  flow.generation.idempotencyKey = key;
  flow.generation.requestId = `req-${randomUUID()}`;
  flow.generation.startedAt = now;
  flow.generation.completedAt = null;
  flow.generation.error = null;

  flow.status = statusOnStart;
  flow.updatedAt = now;

  let chargeEntry = null;
  if (charge) {
    chargeEntry = recordChargeEntry(flow, { ...charge }, key);
  }

  // 保存生成開始狀態到 Firestore
  await setFlowInFirestore(flowId, flow);

  // 標記生成開始
  if (generationLog) {
    try {
      markGenerationStarted(generationLog.id);
      if (process.env.NODE_ENV !== "test") {
        logger.info(`[Generation Log] Started: ${generationLog.id}`);
      }
    } catch (logError) {
      if (process.env.NODE_ENV !== "test") {
        logger.warn("[Generation Log] Failed to mark as started:", logError);
      }
    }
  }

  try {
    const result = await generator({
      flow: cloneValue(flow),
      idempotencyKey: key,
    });

    const completedAt = isoNow();
    flow.generation.status = "completed";
    flow.generation.completedAt = completedAt;
    flow.generation.result = result;
    flow.generation.error = null;
    flow.status = statusOnSuccess;
    flow.updatedAt = completedAt;

    if (chargeEntry) {
      chargeEntry.status = "captured";
      chargeEntry.updatedAt = completedAt;
    }

    // 保存成功狀態到 Firestore
    await setFlowInFirestore(flowId, flow);

    // 標記生成成功
    if (generationLog) {
      try {
        markGenerationSuccess(generationLog.id, result);
        if (process.env.NODE_ENV !== "test") {
          logger.info(`[Generation Log] Success: ${generationLog.id}`);
        }
      } catch (logError) {
        if (process.env.NODE_ENV !== "test") {
          logger.warn("[Generation Log] Failed to mark as success:", logError);
        }
      }
    }

    return {
      flow: cloneValue(flow),
      reused: false,
      result: cloneValue(result),
    };
  } catch (error) {
    const completedAt = isoNow();
    flow.generation.status = "failed";
    flow.generation.completedAt = completedAt;
    flow.generation.error = {
      message:
        error instanceof Error && error.message
          ? error.message
          : "生成流程發生未知錯誤",
    };
    flow.status = statusOnFailure;
    flow.updatedAt = completedAt;

    // 🔥 生成失敗時重置 AI 魔法師次數
    if (flow.metadata) {
      flow.metadata.aiMagicianUsageCount = 0;
    } else {
      flow.metadata = { aiMagicianUsageCount: 0 };
    }

    if (chargeEntry) {
      chargeEntry.status = "void";
      chargeEntry.updatedAt = completedAt;
    }

    // 保存失敗狀態到 Firestore（包含重置的 AI 魔法師次數）
    await setFlowInFirestore(flowId, flow);

    // 標記生成失敗
    if (generationLog) {
      try {
        markGenerationFailed(generationLog.id, error);
        if (process.env.NODE_ENV !== "test") {
          logger.info(`[Generation Log] Failed: ${generationLog.id} - ${error.message}`);
        }
      } catch (logError) {
        if (process.env.NODE_ENV !== "test") {
          logger.warn("[Generation Log] Failed to mark as failed:", logError);
        }
      }
    }

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Character Creation] AI 魔法師次數已重置（生成失敗）`);
    }

    throw error;
  }
};

/**
 * 重置創建流程存儲（已遷移到 Firestore，此函數保留以維持向後兼容性）
 * @deprecated 數據已存儲在 Firestore，不再需要手動重置
 */
export const resetCreationStore = () => {
  // 數據已遷移到 Firestore，此函數不再需要執行任何操作
  if (process.env.NODE_ENV !== "test") {
    logger.info("[Character Creation] resetCreationStore called - this is now a no-op as data is stored in Firestore");
  }
};
