/**
 * Chat 相關常量配置
 * 從 ChatView.vue 提取，便於維護和重用
 */

/**
 * 消息 ID 前綴
 */
export const MESSAGE_ID_PREFIXES = {
  SELFIE_REQUEST: "msg-selfie-request-",
  VIDEO_REQUEST: "msg-video-request-",
  VIDEO_AI: "msg-video-ai-",
  FIRST: "msg-first-",
} as const;

/**
 * 消息 ID 前綴類型
 */
export type MessageIdPrefix = typeof MESSAGE_ID_PREFIXES[keyof typeof MESSAGE_ID_PREFIXES];

/**
 * 視頻請求消息模板（隨機選擇）
 */
export const VIDEO_REQUEST_MESSAGES: ReadonlyArray<string> = [
  "能給我看一段你的影片嗎？",
  "想看看你的影片！",
  "可以拍一段影片給我看嗎？",
  "期待看到你的影片！",
] as const;

/**
 * 視頻請求消息類型
 */
export type VideoRequestMessage = typeof VIDEO_REQUEST_MESSAGES[number];

/**
 * 視頻生成配置
 */
export const VIDEO_CONFIG = {
  DURATION: "4s",
  RESOLUTION: "720p",
  ASPECT_RATIO: "9:16",
} as const;

/**
 * 視頻配置類型
 */
export type VideoConfigType = typeof VIDEO_CONFIG;

/**
 * AI 視頻回覆文本
 */
export const AI_VIDEO_RESPONSE_TEXT = "這是我為你準備的影片！" as const;

/**
 * AI 服務配置
 */
export const AI_CONFIG = {
  MAX_HISTORY_WINDOW: 12, // 保留最近 12 條訊息作為上下文
  MAX_SUGGESTION_COUNT: 3, // 最多生成 3 個快速回覆建議
  SUGGESTION_HISTORY_WINDOW: 6, // 基於最近 6 條訊息生成建議
} as const;

/**
 * AI 配置類型
 */
export type AiConfigType = typeof AI_CONFIG;
