import { apiJson } from "../utils/api.js";

export const CHARACTER_CREATION_FLOW_STORAGE_KEY =
  "character-create-flow-id";

const BASE_PATH = "/api/character-creation";

const unwrapFlowResponse = (payload) => {
  if (payload && typeof payload === "object" && payload.flow) {
    return payload.flow;
  }
  return payload ?? null;
};

const buildHeadersWithIdempotency = (options = {}) => {
  const headers = { ...(options.headers ?? {}) };
  if (
    options.idempotencyKey &&
    typeof options.idempotencyKey === "string"
  ) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }
  return headers;
};

export const createCharacterCreationFlow = async (payload = {}) => {
  const response = await apiJson(`${BASE_PATH}/flows`, {
    method: "POST",
    body: payload,
  });
  return unwrapFlowResponse(response);
};

export const fetchCharacterCreationFlow = async (flowId) => {
  if (!flowId) {
    throw new Error("flowId is required to fetch creation flow");
  }
  const response = await apiJson(`${BASE_PATH}/flows/${flowId}`);
  return unwrapFlowResponse(response);
};

export const updateCharacterCreationFlow = async (
  flowId,
  payload = {}
) => {
  if (!flowId) {
    throw new Error("flowId is required to update creation flow");
  }
  const response = await apiJson(`${BASE_PATH}/flows/${flowId}`, {
    method: "PATCH",
    body: payload,
  });
  return unwrapFlowResponse(response);
};

export const updateCharacterCreationStep = async (
  flowId,
  stepId,
  payload = {}
) => {
  if (!flowId) {
    throw new Error("flowId is required to update creation step");
  }
  if (!stepId) {
    throw new Error("stepId is required to update creation step");
  }
  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/steps/${stepId}`,
    {
      method: "POST",
      body: payload,
    }
  );
  return unwrapFlowResponse(response);
};

export const recordCharacterCreationCharge = async (
  flowId,
  payload = {}
) => {
  if (!flowId) {
    throw new Error("flowId is required to record a charge");
  }
  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/charges`,
    {
      method: "POST",
      body: payload,
      headers: buildHeadersWithIdempotency(payload),
    }
  );
  return {
    flow: response?.flow ?? null,
    charge: response?.charge ?? null,
  };
};

export const generateCharacterCreationVoice = async (
  flowId,
  options = {}
) => {
  if (!flowId) {
    throw new Error("flowId is required to trigger generation");
  }

  const { idempotencyKey, ...body } = options ?? {};

  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/generate`,
    {
      method: "POST",
      body: {
        ...body,
        idempotencyKey,
      },
      headers: buildHeadersWithIdempotency({ idempotencyKey }),
    }
  );

  return {
    flow: response?.flow ?? null,
    reused: Boolean(response?.reused),
  };
};

export const readStoredCharacterCreationFlowId = () => {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    return (
      window.localStorage?.getItem(
        CHARACTER_CREATION_FLOW_STORAGE_KEY
      ) ?? ""
    );
  } catch {
    return "";
  }
};

export const storeCharacterCreationFlowId = (flowId) => {
  if (typeof window === "undefined" || !flowId) {
    return;
  }
  try {
    window.localStorage?.setItem(
      CHARACTER_CREATION_FLOW_STORAGE_KEY,
      flowId
    );
  } catch {
    // ignore storage errors silently
  }
};

export const clearStoredCharacterCreationFlowId = () => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage?.removeItem(
      CHARACTER_CREATION_FLOW_STORAGE_KEY
    );
  } catch {
    // ignore storage errors silently
  }
};

export const generateCharacterPersonaWithAI = async (flowId) => {
  if (!flowId) {
    throw new Error("flowId is required to use AI magician");
  }

  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/ai-magician`,
    {
      method: "POST",
      skipGlobalLoading: true, // 使用按鈕本地的「生成中...」提示
    }
  );

  return response?.persona ?? null;
};

export const generateAppearanceDescription = async (flowId, options = {}) => {
  if (!flowId) {
    throw new Error("flowId is required to use AI magician");
  }

  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/ai-description`,
    {
      method: "POST",
      body: {
        gender: options.gender,
        styles: options.styles || [],
        referenceInfo: options.referenceInfo || null,
      },
      skipGlobalLoading: true, // 使用按鈕本地的「生成中...」提示
    }
  );

  return {
    description: response?.description ?? "",
    usageCount: response?.usageCount ?? 0,
    remainingUsage: response?.remainingUsage ?? 0,
    limit: response?.limit ?? 3,
  };
};

export const generateCharacterImages = async (flowId, options = {}) => {
  if (!flowId) {
    throw new Error("flowId is required to generate character images");
  }

  const { idempotencyKey, quality = "high", count = 4, ...body } = options ?? {};

  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/generate-images`,
    {
      method: "POST",
      body: {
        ...body,
        quality,
        count,
        idempotencyKey,
      },
      headers: buildHeadersWithIdempotency({ idempotencyKey }),
      skipGlobalLoading: true, // 角色生成過程使用本地 loading 提示
    }
  );

  return {
    flow: response?.flow ?? null,
    reused: Boolean(response?.reused),
    images: response?.images ?? [],
  };
};

/**
 * 清理未選中的角色圖片，節省儲存空間
 * @param {string} flowId - 角色創建流程 ID
 * @param {string} selectedImageUrl - 用戶選擇的圖片 URL
 * @param {Array} allImages - 所有生成的圖片數組
 */
export const cleanupUnselectedImages = async (flowId, selectedImageUrl, allImages) => {
  if (!flowId || !selectedImageUrl || !allImages || allImages.length <= 1) {
    return;
  }

  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/cleanup-images`,
    {
      method: "POST",
      body: {
        selectedImageUrl,
        allImages: allImages.map(img => img.url || img),
      },
    }
  );

  return response;
};

export const finalizeCharacterCreation = async (flowId, currentUser, selectedImageUrl = null) => {
  if (!flowId) {
    throw new Error("flowId is required to finalize character creation");
  }

  // 先獲取完整的 flow 資料
  const flow = await fetchCharacterCreationFlow(flowId);

  if (!flow) {
    throw new Error("找不到角色創建流程");
  }

  // 從 flow 或當前用戶獲取創建者資訊
  const creatorUid = flow.userId || currentUser?.id || "";
  const creatorDisplayName = currentUser?.displayName || currentUser?.name || "";

  // 選擇生成的圖片
  const generatedImages = flow.generation?.result?.images || [];

  // 使用傳入的選擇圖片 URL，如果沒有則使用第一張圖片
  let portraitUrl = selectedImageUrl || "";
  if (!portraitUrl && generatedImages.length > 0) {
    portraitUrl = generatedImages[0]?.url || "";
  }
  if (!portraitUrl) {
    portraitUrl = flow.appearance?.image || "";
  }

  // 將 flow 資料轉換為 match 格式
  const matchData = {
    display_name: flow.persona?.name || "",
    gender: flow.metadata?.gender || "",
    background: flow.persona?.tagline || "",
    first_message: flow.persona?.prompt || "",
    secret_background: flow.persona?.hiddenProfile || "",
    portraitUrl,
    voice: flow.voice || null,
    appearanceDescription: flow.appearance?.description || "",
    styles: flow.appearance?.styles || [],
    totalChatUsers: 0,
    totalFavorites: 0,
    plot_hooks: [],
    creatorUid,
    creatorDisplayName,
  };

  // 調用後端 API 創建角色
  const match = await apiJson("/match/create", {
    method: "POST",
    body: matchData,
  });

  // 創建成功後，刪除未選中的圖片以節省儲存空間
  if (generatedImages.length > 1) {
    try {
      await cleanupUnselectedImages(flowId, portraitUrl, generatedImages);
    } catch (error) {
      console.warn("清理未選中圖片失敗:", error);
      // 不阻斷創建流程，只記錄警告
    }
  }

  return match;
};
