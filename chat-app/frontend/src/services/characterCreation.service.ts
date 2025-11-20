import { apiJson } from '../utils/api.js';
import { logger } from '../utils/logger.js';

export const CHARACTER_CREATION_FLOW_STORAGE_KEY =
  'character-create-flow-id';

const BASE_PATH = '/api/character-creation';

interface FlowResponse {
  flow?: CharacterCreationFlow;
  [key: string]: any;
}

export interface CharacterCreationFlow {
  id?: string;
  userId?: string;
  status?: string;
  metadata?: Record<string, any>;
  persona?: {
    name?: string;
    tagline?: string;
    prompt?: string;
    hiddenProfile?: string;
  };
  appearance?: {
    description?: string;
    image?: string;
    styles?: string[];
  };
  generation?: {
    result?: {
      images?: Array<{ url: string }>;
    };
  };
  voice?: string;
  [key: string]: any;
}

interface ChargePayload {
  [key: string]: any;
  idempotencyKey?: string;
}

interface ChargeResponse {
  flow: CharacterCreationFlow | null;
  charge: any;
}

interface GenerationOptions {
  [key: string]: any;
  idempotencyKey?: string;
}

interface GenerationResponse {
  flow: CharacterCreationFlow | null;
  reused: boolean;
}

interface ImageGenerationOptions {
  [key: string]: any;
  idempotencyKey?: string;
  quality?: string;
  count?: number;
}

interface ImageGenerationResponse {
  flow: CharacterCreationFlow | null;
  reused: boolean;
  images: Array<{ url: string }>;
}

interface MatchData {
  flowId: string;
  display_name: string; // 🔥 修復：後端期望 display_name 而非 name
  gender: string;
  background: string;
  first_message: string;
  secret_background: string;
  portraitUrl: string;
  voice: string | null;
  appearanceDescription: string;
  styles: string[];
  totalChatUsers: number;
  totalFavorites: number;
  plot_hooks: string[];
  creatorUid: string;
  creatorDisplayName: string;
}

interface AppearanceDescriptionResponse {
  description: string;
  usageCount: number;
  remainingUsage: number;
  limit: number;
}

interface CurrentUser {
  id?: string;
  displayName?: string;
  name?: string;
}

const unwrapFlowResponse = (payload: FlowResponse | null | undefined): CharacterCreationFlow | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  // 1. 檢查 payload.data.flow（後端 sendSuccess 返回格式）
  if ((payload as any).data && typeof (payload as any).data === 'object') {
    if ((payload as any).data.flow) {
      return (payload as any).data.flow;
    }
    // 2. 檢查 payload.data（直接返回 data）
    if ((payload as any).data.id) {
      return (payload as any).data;
    }
  }

  // 3. 檢查 payload.flow（舊格式）
  if ((payload as any).flow) {
    return (payload as any).flow;
  }

  // 4. 直接返回 payload（如果有 id）
  if ((payload as any).id) {
    return payload as CharacterCreationFlow;
  }

  return null;
};

const buildHeadersWithIdempotency = (options: GenerationOptions = {}): Record<string, string> => {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (
    options.idempotencyKey &&
    typeof options.idempotencyKey === 'string'
  ) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }
  return headers;
};

export const createCharacterCreationFlow = async (
  payload: Record<string, any> = {}
): Promise<CharacterCreationFlow | null> => {
  // 調試日誌：檢查發送的 payload
  console.log('[createCharacterCreationFlow] Payload before API call:', {
    payloadKeys: Object.keys(payload),
    hasAppearance: !!payload.appearance,
    appearanceType: typeof payload.appearance,
    appearanceKeys: payload.appearance ? Object.keys(payload.appearance) : [],
    hasDescription: !!payload.appearance?.description,
    descriptionLength: payload.appearance?.description?.length || 0,
    descriptionPreview: payload.appearance?.description?.substring(0, 50) || '',
    hasStyles: !!payload.appearance?.styles,
    stylesCount: payload.appearance?.styles?.length || 0,
  });
  console.log('[createCharacterCreationFlow] Raw payload JSON:', JSON.stringify(payload).substring(0, 500));

  const response = await apiJson(`${BASE_PATH}/flows`, {
    method: 'POST',
    body: payload,
  }) as FlowResponse;

  // 調試日誌：檢查 API 響應
  console.log('[createCharacterCreationFlow] API response:', {
    hasResponse: !!response,
    responseKeys: response ? Object.keys(response) : [],
  });

  return unwrapFlowResponse(response);
};

export const fetchCharacterCreationFlow = async (
  flowId: string
): Promise<CharacterCreationFlow | null> => {
  if (!flowId) {
    throw new Error('flowId is required to fetch creation flow');
  }
  const response = await apiJson(`${BASE_PATH}/flows/${flowId}`) as FlowResponse;
  return unwrapFlowResponse(response);
};

export const updateCharacterCreationFlow = async (
  flowId: string,
  payload: Record<string, any> = {}
): Promise<CharacterCreationFlow | null> => {
  if (!flowId) {
    throw new Error('flowId is required to update creation flow');
  }
  const response = await apiJson(`${BASE_PATH}/flows/${flowId}`, {
    method: 'PATCH',
    body: payload,
  }) as FlowResponse;
  return unwrapFlowResponse(response);
};

export const updateCharacterCreationStep = async (
  flowId: string,
  stepId: string,
  payload: Record<string, any> = {}
): Promise<CharacterCreationFlow | null> => {
  if (!flowId) {
    throw new Error('flowId is required to update creation step');
  }
  if (!stepId) {
    throw new Error('stepId is required to update creation step');
  }

  // 調試日誌：檢查發送的 payload
  console.log('[updateCharacterCreationStep] Payload before API call:', {
    flowId,
    stepId,
    hasPayload: !!payload,
    hasDescription: !!payload.description,
    descriptionLength: payload.description?.length || 0,
    descriptionPreview: payload.description?.substring(0, 50) || '',
    hasStyles: !!payload.styles,
    stylesCount: payload.styles?.length || 0,
    fullPayload: JSON.stringify(payload).substring(0, 200) + '...'
  });

  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/steps/${stepId}`,
    {
      method: 'POST',
      body: payload,
    }
  ) as FlowResponse;

  // 調試日誌：檢查 API 響應
  console.log('[updateCharacterCreationStep] API response:', {
    hasResponse: !!response,
    responseKeys: response ? Object.keys(response) : [],
  });

  return unwrapFlowResponse(response);
};

export const recordCharacterCreationCharge = async (
  flowId: string,
  payload: ChargePayload = {}
): Promise<ChargeResponse> => {
  if (!flowId) {
    throw new Error('flowId is required to record a charge');
  }
  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/charges`,
    {
      method: 'POST',
      body: payload,
      headers: buildHeadersWithIdempotency(payload),
    }
  ) as any;
  return {
    flow: response?.flow ?? null,
    charge: response?.charge ?? null,
  };
};

export const generateCharacterCreationVoice = async (
  flowId: string,
  options: GenerationOptions = {}
): Promise<GenerationResponse> => {
  if (!flowId) {
    throw new Error('flowId is required to trigger generation');
  }

  const { idempotencyKey, ...body } = options ?? {};

  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/generate`,
    {
      method: 'POST',
      body: {
        ...body,
        idempotencyKey,
      },
      headers: buildHeadersWithIdempotency({ idempotencyKey }),
    }
  ) as any;

  return {
    flow: response?.flow ?? null,
    reused: Boolean(response?.reused),
  };
};

export const readStoredCharacterCreationFlowId = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return (
      window.localStorage?.getItem(
        CHARACTER_CREATION_FLOW_STORAGE_KEY
      ) ?? ''
    );
  } catch {
    return '';
  }
};

export const storeCharacterCreationFlowId = (flowId: string): void => {
  if (typeof window === 'undefined' || !flowId) {
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

export const clearStoredCharacterCreationFlowId = (): void => {
  if (typeof window === 'undefined') {
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

export const generateCharacterPersonaWithAI = async (
  flowId: string
): Promise<any> => {
  if (!flowId) {
    throw new Error('flowId is required to use AI magician');
  }

  try {
    const response = await apiJson(
      `${BASE_PATH}/flows/${flowId}/ai-magician`,
      {
        method: 'POST',
        skipGlobalLoading: true,
      }
    ) as any;

    const data = response?.data || response;
    return data?.persona ?? null;
  } catch (error) {
    console.error('[characterCreation.service] AI 魔法師調用失敗:', error);
    throw error;
  }
};

export const generateAppearanceDescription = async (
  flowId: string,
  options: Record<string, any> = {}
): Promise<AppearanceDescriptionResponse> => {
  if (!flowId) {
    throw new Error('flowId is required to use AI magician');
  }

  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/ai-description`,
    {
      method: 'POST',
      body: {
        gender: options.gender,
        styles: options.styles || [],
        referenceInfo: options.referenceInfo || null,
      },
      skipGlobalLoading: true, // 使用按鈕本地的「生成中...」提示
    }
  ) as any;

  // 🔥 修復：後端使用 sendSuccess 返回，數據在 response.data 中
  const data = response?.data || response;

  return {
    description: data?.description ?? '',
    usageCount: data?.usageCount ?? 0,
    remainingUsage: data?.remainingUsage ?? 0,
    limit: data?.limit ?? 3,
  };
};

export const generateCharacterImages = async (
  flowId: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResponse> => {
  if (!flowId) {
    throw new Error('flowId is required to generate character images');
  }

  const { idempotencyKey, quality = 'high', count = 4, ...body } = options ?? {};

  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/generate-images`,
    {
      method: 'POST',
      body: {
        ...body,
        quality,
        count,
        idempotencyKey,
      },
      headers: buildHeadersWithIdempotency({ idempotencyKey }),
      skipGlobalLoading: true, // 角色生成過程使用本地 loading 提示
    }
  ) as any;

  // 🔥 修復：後端使用 sendSuccess 返回，數據在 response.data 中
  const data = response?.data || response;

  return {
    flow: data?.flow ?? null,
    reused: Boolean(data?.reused),
    images: data?.images ?? [],
  };
};

/**
 * 清理未選中的角色圖片，節省儲存空間
 * @param flowId - 角色創建流程 ID
 * @param selectedImageUrl - 用戶選擇的圖片 URL
 * @param allImages - 所有生成的圖片數組
 */
export const cleanupUnselectedImages = async (
  flowId: string,
  selectedImageUrl: string,
  allImages: Array<{ url?: string } | string>
): Promise<any> => {
  if (!flowId || !selectedImageUrl || !allImages || allImages.length <= 1) {
    return;
  }

  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/cleanup-images`,
    {
      method: 'POST',
      body: {
        selectedImageUrl,
        allImages: allImages.map(img => (typeof img === 'string' ? img : img.url || img)),
      },
    }
  );

  return response;
};

/**
 * 取消角色創建並清理所有生成的圖片
 * @param flowId - 角色創建流程 ID
 * @returns 返回取消結果
 */
export const cancelCharacterCreation = async (
  flowId: string
): Promise<any> => {
  if (!flowId) {
    throw new Error('flowId is required to cancel character creation');
  }

  const response = await apiJson(
    `${BASE_PATH}/flows/${flowId}/cancel`,
    {
      method: 'POST',
    }
  );

  return response;
};

export const finalizeCharacterCreation = async (
  flowId: string,
  currentUser: CurrentUser,
  selectedImageUrl: string | null = null
): Promise<any> => {
  if (!flowId) {
    throw new Error('flowId is required to finalize character creation');
  }

  // 先獲取完整的 flow 資料
  const flow = await fetchCharacterCreationFlow(flowId);

  if (!flow) {
    throw new Error('找不到角色創建流程');
  }

  // 從 flow 或當前用戶獲取創建者資訊
  const creatorUid = flow.userId || currentUser?.id || '';
  const creatorDisplayName = currentUser?.displayName || currentUser?.name || '';

  // 選擇生成的圖片
  const generatedImages = flow.generation?.result?.images || [];

  // 優先使用傳入的 selectedImageUrl（用戶在生成結果頁選擇的圖片）
  let portraitUrl = selectedImageUrl || '';

  // 如果沒有傳入，嘗試從 flow.appearance.image 獲取（這應該是用戶選擇的生成圖片）
  if (!portraitUrl && flow.appearance?.image) {
    // 檢查是否是生成的圖片 URL（包含 r2.dev 或 storage.googleapis.com）
    const image = flow.appearance.image;
    if (image.includes('r2.dev') || image.includes('storage.googleapis.com') || image.includes('firebasestorage.googleapis.com')) {
      portraitUrl = image;
    }
  }

  // 如果還是沒有，使用生成圖片的第一張
  if (!portraitUrl && generatedImages.length > 0) {
    portraitUrl = generatedImages[0]?.url || '';
  }

  // 最後的備選：flow.appearance.image（可能是預設或參考圖）
  if (!portraitUrl) {
    portraitUrl = flow.appearance?.image || '';
  }

  logger.log('[finalizeCharacterCreation] 圖片 URL 選擇:', {
    selectedImageUrl,
    flowAppearanceImage: flow.appearance?.image,
    generatedImagesCount: generatedImages.length,
    finalPortraitUrl: portraitUrl
  });

  // 將 flow 資料轉換為 match 格式
  const matchData: MatchData = {
    flowId, // 傳入 flowId，讓後端檢查是否已扣除創建卡
    display_name: flow.persona?.name || '', // 🔥 修復：後端期望 display_name 字段
    gender: flow.metadata?.gender || '',
    background: flow.persona?.tagline || '',
    first_message: flow.persona?.prompt || '',
    secret_background: flow.persona?.hiddenProfile || '',
    portraitUrl,
    voice: flow.voice || null,
    appearanceDescription: flow.appearance?.description || '',
    styles: flow.appearance?.styles || [],
    totalChatUsers: 0,
    totalFavorites: 0,
    plot_hooks: [],
    creatorUid,
    creatorDisplayName,
  };

  // 調用後端 API 創建角色
  const response = await apiJson('/match/create', {
    method: 'POST',
    body: matchData,
  }) as any;

  // 後端使用 sendSuccess 返回數據，格式為 { success: true, data: match }
  // 需要解包 data 字段
  const match = response?.data || response;

  // 創建成功後，刪除未選中的圖片以節省儲存空間
  if (generatedImages.length > 1) {
    try {
      await cleanupUnselectedImages(flowId, portraitUrl, generatedImages);
    } catch (error) {
      logger.warn('清理未選中圖片失敗:', error);
      // 不阻斷創建流程，只記錄警告
    }
  }

  return match;
};
