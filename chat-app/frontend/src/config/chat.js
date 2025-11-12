/**
 * 聊天功能配置
 * 統一管理聊天相關的常量和限制
 */

/**
 * 建議回覆配置
 */
export const SUGGESTION_CONFIG = {
  // 最大建議數量
  MAX_ITEMS: 3,

  // 建議生成時使用的歷史訊息窗口
  SIGNATURE_WINDOW: 6,

  // 後備建議（當 AI 生成失敗時使用）
  FALLBACK_SUGGESTIONS: [
    '可以多分享你的感受嗎？',
    '最近有發生什麼讓你印象深刻的事嗎？',
    '我很好奇你的想法，再聊聊吧！',
  ],
};

/**
 * 虛擬滾動配置
 */
export const VIRTUAL_SCROLL_CONFIG = {
  // 初始渲染的訊息數量
  INITIAL_COUNT: 50,

  // 每次滾動增加的訊息數量
  INCREMENT_COUNT: 30,

  // 觸發加載更多的滾動距離閾值（px）
  SCROLL_THRESHOLD: 300,
};

/**
 * 滑動手勢配置
 */
export const SWIPE_CONFIG = {
  // 滑動動作區域寬度（px）
  ACTION_WIDTH: 140,

  // 觸發滑動動作的距離閾值（px）
  TRIGGER_THRESHOLD: 48,

  // 右滑最大偏移量（px）
  MAX_RIGHT_OFFSET: 22,
};

/**
 * 訊息配置
 */
export const MESSAGE_CONFIG = {
  // 訊息輸入框最大字數
  MAX_INPUT_LENGTH: 500,

  // 最小輸入字數（用於驗證）
  MIN_INPUT_LENGTH: 1,

  // 訊息歷史保留數量（前端顯示）
  MAX_VISIBLE_MESSAGES: 100,
};

/**
 * 分頁配置
 */
export const PAGINATION_CONFIG = {
  // 對話列表每頁數量
  CONVERSATIONS_PER_PAGE: 20,

  // 無限滾動觸發距離（px）
  INFINITE_SCROLL_THRESHOLD: 100,

  // 無限滾動加載延遲（ms）
  LOAD_DELAY: 300,
};
