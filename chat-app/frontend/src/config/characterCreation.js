/**
 * 角色創建相關配置
 * 統一管理角色創建流程中的限制和常量
 */

/**
 * 角色創建輸入限制
 */
export const CHARACTER_CREATION_LIMITS = {
  // 名稱長度限制
  MAX_NAME_LENGTH: 8,
  MIN_NAME_LENGTH: 1,

  // 標語長度限制
  MAX_TAGLINE_LENGTH: 200,
  MIN_TAGLINE_LENGTH: 10,

  // 提示詞長度限制
  MAX_PROMPT_LENGTH: 50,
  MIN_PROMPT_LENGTH: 10,

  // 隱藏資料長度限制
  MAX_HIDDEN_PROFILE_LENGTH: 200,
  MIN_HIDDEN_PROFILE_LENGTH: 10,

  // 標籤數量限制
  MAX_TAGS: 5,
  MIN_TAGS: 1,

  // 外觀描述長度限制
  MAX_APPEARANCE_LENGTH: 500,
  MIN_APPEARANCE_LENGTH: 10,

  // 外觀簡短描述長度限制（用於預覽）
  MAX_APPEARANCE_PREVIEW_LENGTH: 60,
};

/**
 * 角色創建流程配置
 */
export const CHARACTER_CREATION_FLOW = {
  // 流程步驟
  STEPS: {
    GENDER: 'gender',
    APPEARANCE: 'appearance',
    GENERATING: 'generating',
    VOICE: 'voice',
    COMPLETED: 'completed',
  },

  // 每個步驟的標題
  STEP_TITLES: {
    gender: '選擇性別',
    appearance: '設定外觀',
    generating: '生成角色',
    voice: '選擇語音',
    completed: '創建完成',
  },
};

/**
 * 角色生成配置
 */
export const CHARACTER_GENERATION = {
  // 生成進度階段
  PROGRESS_STAGES: {
    VALIDATING: { step: 1, label: '驗證資料' },
    GENERATING_PROFILE: { step: 2, label: '生成角色資料' },
    GENERATING_IMAGE: { step: 3, label: '生成角色圖片' },
    SAVING: { step: 4, label: '保存角色資料' },
    COMPLETED: { step: 5, label: '創建完成' },
  },

  // 生成超時時間（毫秒）
  TIMEOUT_MS: 120_000, // 2 分鐘
};

/**
 * 語音選項配置
 */
export const VOICE_OPTIONS = {
  // 可用的語音選項（OpenAI TTS）
  AVAILABLE_VOICES: [
    { id: 'alloy', name: '中性音（Alloy）', type: 'neutral' },
    { id: 'echo', name: '男性音（Echo）', type: 'male' },
    { id: 'fable', name: '男性音（Fable）', type: 'male' },
    { id: 'onyx', name: '男性音（Onyx）', type: 'male' },
    { id: 'nova', name: '女性音（Nova）', type: 'female' },
    { id: 'shimmer', name: '女性音（Shimmer）', type: 'female' },
  ],

  // 預設語音
  DEFAULT_VOICE: 'alloy',
};

/**
 * 錯誤訊息配置
 */
export const ERROR_MESSAGES = {
  NAME_TOO_SHORT: `名稱至少需要 ${CHARACTER_CREATION_LIMITS.MIN_NAME_LENGTH} 個字`,
  NAME_TOO_LONG: `名稱最多 ${CHARACTER_CREATION_LIMITS.MAX_NAME_LENGTH} 個字`,
  TAGLINE_TOO_SHORT: `標語至少需要 ${CHARACTER_CREATION_LIMITS.MIN_TAGLINE_LENGTH} 個字`,
  TAGLINE_TOO_LONG: `標語最多 ${CHARACTER_CREATION_LIMITS.MAX_TAGLINE_LENGTH} 個字`,
  PROMPT_TOO_SHORT: `提示詞至少需要 ${CHARACTER_CREATION_LIMITS.MIN_PROMPT_LENGTH} 個字`,
  PROMPT_TOO_LONG: `提示詞最多 ${CHARACTER_CREATION_LIMITS.MAX_PROMPT_LENGTH} 個字`,
  APPEARANCE_TOO_SHORT: `外觀描述至少需要 ${CHARACTER_CREATION_LIMITS.MIN_APPEARANCE_LENGTH} 個字`,
  APPEARANCE_TOO_LONG: `外觀描述最多 ${CHARACTER_CREATION_LIMITS.MAX_APPEARANCE_LENGTH} 個字`,
  GENERATION_TIMEOUT: '角色生成超時，請稍後再試',
  GENERATION_FAILED: '角色生成失敗，請檢查輸入並重試',
};
