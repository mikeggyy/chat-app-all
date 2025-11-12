/**
 * 功能限制配置
 * 統一管理所有功能的額度、限制、重置週期等常量
 */

// 引用共享配置
import { POTIONS_BASE_CONFIG } from "../../../shared/config/potions.js";

/**
 * 測試帳號專屬限制配置
 * 這個帳號用於開發測試，可以隨時修改這些值來測試不同情況
 *
 * 使用說明：
 * - 修改任何值後，nodemon 會自動重新載入
 * - 設定小的數值（例如 3, 5）可以快速測試達到限制時的行為
 * - 設定大的數值（例如 100, 999）可以進行長時間測試
 * - 設為 -1 表示無限制（但建議用具體數字來測試限制邏輯）
 */
export const TEST_ACCOUNT_LIMITS = {
  // 拍照次數（終生）
  // 建議測試值：3 (快速測試), 10 (中等), 100 (長期測試)
  PHOTOS: 100,

  // 影片生成次數（每月）
  // 建議測試值：2 (快速測試), 5 (中等), 10 (長期測試)
  VIDEOS: 100,

  // 對話次數（每個角色）
  // 建議測試值：5 (快速測試), 20 (中等), -1 (無限)
  CONVERSATIONS_PER_CHARACTER: -1,

  // 語音次數（每個角色）
  // 建議測試值：3 (快速測試), 15 (中等), -1 (無限)
  VOICE_PER_CHARACTER: -1,

  // 角色創建次數（每月重置，每月 1 號凌晨 12 點重置）
  // 建議測試值：1 (快速測試), 3 (標準), -1 (無限)
  // 所有會員等級（Free/VIP/VVIP）都是每月 3 次基礎創建
  CHARACTER_CREATIONS: 100,

  // 廣告觀看次數（每日）
  // 建議測試值：3 (快速測試), 10 (標準), 999 (幾乎無限)
  ADS_DAILY: 999,

  // 會員等級（"free" | "vip" | "vvip"）
  // 可以改成 "free" 來測試免費用戶的限制行為
  MEMBERSHIP_TIER: "free",

  // 是否跳過 API 速率限制
  // 設為 false 來測試速率限制功能
  SKIP_RATE_LIMIT: true,
};

/**
 * 對話限制配置
 */
export const CONVERSATION_LIMITS = {
  // 免費用戶每個角色的對話次數
  FREE_PER_CHARACTER: 10,

  // VIP 用戶每個角色的對話次數
  VIP_PER_CHARACTER: 20,

  // VVIP 用戶每個角色的對話次數
  VVIP_PER_CHARACTER: 50,

  // 免費用戶每天可觀看廣告解鎖的次數
  FREE_DAILY_AD_LIMIT: 10,

  // VIP 用戶每天可觀看廣告解鎖的次數
  VIP_DAILY_AD_LIMIT: 10,

  // VVIP 用戶每天可觀看廣告解鎖的次數
  VVIP_DAILY_AD_LIMIT: 10,

  // 免費用戶每次廣告解鎖的對話次數
  FREE_UNLOCKED_PER_AD: 5,

  // VIP 用戶每次廣告解鎖的對話次數
  VIP_UNLOCKED_PER_AD: 10,

  // VVIP 用戶每次廣告解鎖的對話次數
  VVIP_UNLOCKED_PER_AD: 20,
};

/**
 * 語音限制配置
 */
export const VOICE_LIMITS = {
  // 免費用戶每個角色的語音次數
  FREE_PER_CHARACTER: 10,

  // 免費用戶每天可觀看廣告解鎖的次數
  FREE_DAILY_AD_LIMIT: 10,

  // 每次廣告解鎖的語音次數
  UNLOCKED_PER_AD: 5,

  // 付費會員無限語音（用 -1 表示）
  PAID_UNLIMITED: -1,
};

/**
 * 拍照限制配置
 *
 * ⚠️ 注意：VIP/VVIP 的拍照次數來自開通時一次性發放的卡片
 * - 免費用戶：3 次終生限制
 * - VIP：開通時送 10 張拍照卡（永久有效，用完為止）
 * - VVIP：開通時送 50 張拍照卡（永久有效，用完為止）
 */
export const PHOTO_LIMITS = {
  // 免費用戶終生限制（永不重置）
  FREE_LIFETIME: 3,

  // VIP 用戶基礎限制（實際次數來自開通時發放的卡片）
  VIP_MONTHLY: 0,

  // VVIP 用戶基礎限制（實際次數來自開通時發放的卡片）
  VVIP_MONTHLY: 0,

  // 測試帳號限制（舊值，保留相容性，實際使用 TEST_ACCOUNT_LIMITS.PHOTOS）
  TEST_ACCOUNT: 100,

  // 重置週期
  RESET_PERIOD: {
    FREE: "none", // 免費用戶永不重置（終生限制）
    VIP: "none", // VIP 使用卡片，不重置
    VVIP: "none", // VVIP 使用卡片，不重置
    TEST: "none", // 測試帳號永不重置
  },
};

/**
 * 影片生成限制配置
 *
 * ⚠️ 注意：VIP/VVIP 的影片生成次數來自開通時一次性發放的卡片
 * - 免費用戶：無影片生成權限
 * - VIP：開通時送 1 張影片生成卡（永久有效，用完為止）
 * - VVIP：開通時送 5 張影片生成卡（永久有效，用完為止）
 */
export const VIDEO_LIMITS = {
  // 免費用戶無影片生成權限
  FREE_LIFETIME: 0,

  // VIP 用戶基礎限制（實際次數來自開通時發放的卡片）
  VIP_MONTHLY: 0,

  // VVIP 用戶基礎限制（實際次數來自開通時發放的卡片）
  VVIP_MONTHLY: 0,

  // 測試帳號限制
  TEST_ACCOUNT: 10,

  // 重置週期
  RESET_PERIOD: {
    FREE: "none", // 免費用戶無權限
    VIP: "none", // VIP 使用卡片，不重置
    VVIP: "none", // VVIP 使用卡片，不重置
    TEST: "monthly", // 測試帳號每月重置
  },
};

/**
 * 角色創建限制配置
 *
 * ⚠️ 注意：這裡的配置僅用於文檔化和參考
 * 實際使用的限制值來自 membership.config.js 的 MEMBERSHIP_TIERS[tier].features.maxCreatedCharacters
 * 請確保兩處的數值保持同步！
 *
 * 📝 說明：所有會員等級的基礎額度都是每月 3 個
 * VVIP 額外贈送 30 張創建角色卡（開通時一次發放，永久有效）
 */
export const CHARACTER_CREATION_LIMITS = {
  // 免費用戶每月限制
  FREE_MONTHLY: 3,

  // VIP 用戶每月限制
  VIP_MONTHLY: 3,

  // VVIP 用戶每月限制（基礎額度，另外開通時送 30 張創建角色卡）
  VVIP_MONTHLY: 3,

  // 重置週期（所有等級都是每月重置）
  RESET_PERIOD: "monthly",
};

/**
 * 配對限制配置
 */
export const MATCH_LIMITS = {
  // 免費用戶每日配對次數
  FREE_DAILY: 5,

  // VIP 用戶每日配對次數
  VIP_DAILY: 30,

  // VVIP 用戶無限配對（用 -1 表示）
  VVIP_UNLIMITED: -1,

  // 免費用戶每天可觀看廣告解鎖的次數
  FREE_DAILY_AD_LIMIT: 10,

  // VIP 用戶每天可觀看廣告解鎖的次數
  VIP_DAILY_AD_LIMIT: 10,

  // 免費用戶每次廣告解鎖的配對次數
  FREE_UNLOCKED_PER_AD: 1,

  // VIP 用戶每次廣告解鎖的配對次數
  VIP_UNLOCKED_PER_AD: 5,
};

/**
 * 廣告限制配置
 */
export const AD_LIMITS = {
  // 每日廣告觀看次數上限
  DAILY_LIMIT: 10,

  // 廣告冷卻時間（秒）
  COOLDOWN_SECONDS: 300, // 5 分鐘
};

/**
 * API 速率限制配置
 */
export const RATE_LIMITS = {
  // AI 回覆生成
  AI_REPLY: {
    windowMs: 60_000, // 1 分鐘
    maxRequests: 20,
  },

  // AI 建議生成
  AI_SUGGESTIONS: {
    windowMs: 60_000, // 1 分鐘
    maxRequests: 15,
  },

  // TTS 語音生成
  TTS: {
    windowMs: 60_000, // 1 分鐘
    maxRequests: 30,
  },

  // 圖片生成
  IMAGE_GENERATION: {
    windowMs: 60_000, // 1 分鐘
    maxRequests: 5,
  },

  // 影片生成
  VIDEO_GENERATION: {
    windowMs: 60_000, // 1 分鐘
    maxRequests: 3, // 影片生成較耗資源，限制更嚴格
  },
};

/**
 * 歷史記錄限制
 */
export const HISTORY_LIMITS = {
  // AI 生成時使用的歷史訊息數量
  MAX_HISTORY_WINDOW: 12,

  // 建議生成時使用的歷史訊息數量
  SUGGESTION_WINDOW: 6,

  // 最大緩存訊息數量（從 200 降到 100，減少 Firestore 文檔大小）
  MAX_CACHED_MESSAGES: 100,

  // 單條訊息最大大小（bytes）- 防止超大訊息（例如 base64 圖片）
  MAX_MESSAGE_SIZE: 10 * 1024, // 10KB

  // 所有訊息總大小限制（bytes）- 防止超過 Firestore 1MB 限制
  // 設為 500KB 留有安全餘裕
  MAX_TOTAL_SIZE: 500 * 1024, // 500KB
};

/**
 * 道具配置
 * ⚠️ 已移至共享配置 shared/config/potions.js
 * 這裡直接引用共享配置，確保前後端一致
 */
export const POTION_CONFIG = POTIONS_BASE_CONFIG;

/**
 * 冪等性 TTL 配置
 * 用於防止重複請求的超時設定（毫秒）
 */
export const IDEMPOTENCY_TTL = {
  // AI 回覆生成
  AI_REPLY: 15 * 60 * 1000, // 15 分鐘

  // AI 建議生成（通常很快，不需要太長）
  AI_SUGGESTIONS: 5 * 60 * 1000, // 5 分鐘

  // TTS 語音生成
  TTS: 10 * 60 * 1000, // 10 分鐘

  // 圖片生成（拍照）
  IMAGE_GENERATION: 15 * 60 * 1000, // 15 分鐘

  // 影片生成（需要較長時間）
  VIDEO_GENERATION: 30 * 60 * 1000, // 30 分鐘

  // ✅ P2-2 新增：其他冪等性操作的 TTL
  // 禮物發送
  GIFT: 15 * 60 * 1000, // 15 分鐘

  // 解鎖券使用（角色、照片、影片）
  UNLOCK_TICKET: 5 * 60 * 1000, // 5 分鐘

  // 會員升級
  MEMBERSHIP_UPGRADE: 15 * 60 * 1000, // 15 分鐘

  // 資產購買（防止快速重複點擊）
  ASSET_PURCHASE: 2 * 1000, // 2 秒

  // 金幣相關
  COIN_FEATURE_PURCHASE: 15 * 60 * 1000, // 15 分鐘（無限對話、AI 照片/影片等功能購買）
  COIN_PACKAGE: 15 * 60 * 1000, // 15 分鐘（金幣套餐購買）
  COIN_RECHARGE: 15 * 60 * 1000, // 15 分鐘（金幣儲值）

  // 廣告獎勵
  AD_REWARD: 10 * 60 * 1000, // 10 分鐘

  // 藥水購買
  POTION_PURCHASE: 15 * 60 * 1000, // 15 分鐘
};
