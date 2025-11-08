import { randomUUID } from "node:crypto";
import logger from "../utils/logger.js";
import {
  createGenerationLog,
  markGenerationStarted,
  markGenerationSuccess,
  markGenerationFailed,
} from "./generationLog.service.js";

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

const flowStore = new Map();

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
  if (!value || typeof value !== "object") {
    return null;
  }

  const id = trimString(value.id);
  const label = trimString(value.label);
  const image = trimString(value.image);
  const alt = trimString(value.alt);
  const description = trimString(value.description);
  const styles = Array.isArray(value.styles) ? value.styles : [];
  const referenceInfo = value.referenceInfo || null;

  if (!id && !label && !image && !alt && !description) {
    return null;
  }

  return {
    id,
    label,
    image,
    alt,
    description,
    styles,
    referenceInfo,
  };
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

const ensureFlow = (flowId) => {
  const flow = flowStore.get(flowId);
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

export const createCreationFlow = (payload = {}) => {
  const record = createFlowRecord(payload);
  flowStore.set(record.id, record);
  return cloneValue(record);
};

export const getCreationFlow = (flowId) => {
  const flow = flowStore.get(flowId);
  return flow ? cloneValue(flow) : null;
};

export const mergeCreationFlow = (flowId, payload = {}) => {
  const flow = ensureFlow(flowId);
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
  return cloneValue(flow);
};

export const recordCreationCharge = (flowId, payload = {}) => {
  const flow = ensureFlow(flowId);
  const entry = recordChargeEntry(flow, payload);
  flow.updatedAt = isoNow();
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

  const flow = ensureFlow(flowId);
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

    if (chargeEntry) {
      chargeEntry.status = "void";
      chargeEntry.updatedAt = completedAt;
    }

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

    throw error;
  }
};

export const resetCreationStore = () => {
  flowStore.clear();
};
