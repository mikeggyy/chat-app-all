/**
 * 速率限制配置
 * 為不同類型的 API 端點定義速率限制策略
 */

import { createRateLimiter } from './rateLimiter.js';
import logger from '../utils/logger.js';

/**
 * 基於用戶 ID 的 key 生成器
 * 優先使用認證的用戶 ID，否則使用 IP 地址
 */
const userBasedKeyGenerator = (req) => {
  // 從認證中間件獲取用戶 ID
  const userId = req.user?.uid || req.userId;
  if (userId) {
    return `user:${userId}`;
  }
  // 未登入用戶使用 IP
  return `ip:${req.ip || req.connection?.remoteAddress || 'unknown'}`;
};

/**
 * 基於 IP 的 key 生成器
 * 用於公開端點
 */
const ipBasedKeyGenerator = (req) => {
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

/**
 * 記錄速率限制觸發事件
 */
const logRateLimitExceeded = (req, res, bucket) => {
  const userId = req.user?.uid || req.userId || 'anonymous';
  const endpoint = req.originalUrl || req.url;
  const ip = req.ip || req.connection?.remoteAddress;

  logger.warn('[速率限制] 請求被限制', {
    userId,
    endpoint,
    ip,
    count: bucket.count,
    resetAt: new Date(bucket.resetAt).toISOString(),
  });

  res.status(429).json({
    success: false,
    message: '請求過於頻繁，請稍後再試',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000), // 秒數
  });
};

// ==================== 速率限制器實例 ====================

/**
 * 嚴格限制：用於高消耗或敏感操作
 * 10 次/分鐘
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 分鐘
  maxRequests: 10,
  keyGenerator: userBasedKeyGenerator,
  onLimit: logRateLimitExceeded,
});

/**
 * 標準限制：用於一般 API 操作
 * 30 次/分鐘
 */
export const standardRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 分鐘
  maxRequests: 30,
  keyGenerator: userBasedKeyGenerator,
  onLimit: logRateLimitExceeded,
});

/**
 * 寬鬆限制：用於低消耗的讀取操作
 * 60 次/分鐘
 */
export const relaxedRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 分鐘
  maxRequests: 60,
  keyGenerator: userBasedKeyGenerator,
  onLimit: logRateLimitExceeded,
});

/**
 * 極度嚴格限制：用於非常高消耗的操作（AI 圖片生成、視頻生成等）
 * 5 次/分鐘
 */
export const veryStrictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 分鐘
  maxRequests: 5,
  keyGenerator: userBasedKeyGenerator,
  onLimit: logRateLimitExceeded,
});

/**
 * 購買操作限制：防止惡意購買
 * 10 次/分鐘（每次購買都會有額外的冪等性保護）
 */
export const purchaseRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 分鐘
  maxRequests: 10,
  keyGenerator: userBasedKeyGenerator,
  onLimit: (req, res, bucket) => {
    const userId = req.user?.uid || req.userId || 'anonymous';
    const endpoint = req.originalUrl || req.url;

    logger.error('[購買限制] 觸發頻繁購買保護', {
      userId,
      endpoint,
      count: bucket.count,
      ip: req.ip,
    });

    res.status(429).json({
      success: false,
      message: '購買操作過於頻繁，請稍後再試。如有疑問請聯繫客服。',
      error: 'PURCHASE_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000),
    });
  },
});

/**
 * 認證相關限制：防止暴力破解
 * 5 次/5 分鐘（基於 IP）
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 分鐘
  maxRequests: 5,
  keyGenerator: ipBasedKeyGenerator,
  onLimit: (req, res, bucket) => {
    const ip = req.ip || req.connection?.remoteAddress;
    logger.error('[認證限制] 觸發暴力破解保護', {
      ip,
      endpoint: req.originalUrl,
      count: bucket.count,
    });

    res.status(429).json({
      success: false,
      message: '認證嘗試過多，請稍後再試',
      error: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000),
    });
  },
});

/**
 * 對話相關限制：平衡用戶體驗和資源消耗
 * 20 次/分鐘（AI 回覆生成）
 */
export const conversationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 分鐘
  maxRequests: 20,
  keyGenerator: userBasedKeyGenerator,
  onLimit: logRateLimitExceeded,
});

/**
 * 送禮限制：防止刷禮物
 * 15 次/分鐘
 */
export const giftRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 分鐘
  maxRequests: 15,
  keyGenerator: userBasedKeyGenerator,
  onLimit: (req, res, bucket) => {
    const userId = req.user?.uid || req.userId;
    logger.warn('[送禮限制] 觸發送禮頻率保護', {
      userId,
      count: bucket.count,
    });

    res.status(429).json({
      success: false,
      message: '送禮操作過於頻繁，請稍後再試',
      error: 'GIFT_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000),
    });
  },
});

/**
 * AI 建議生成限制：用於生成對話建議
 * 15 次/分鐘
 */
export const aiSuggestionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 分鐘
  maxRequests: 15,
  keyGenerator: userBasedKeyGenerator,
  onLimit: (req, res, bucket) => {
    const userId = req.user?.uid || req.userId;
    logger.warn('[AI 建議限制] AI 建議生成請求被限制', {
      userId,
      count: bucket.count,
    });

    res.status(429).json({
      success: false,
      message: 'AI 建議生成請求過於頻繁，請稍後再試',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000),
    });
  },
});

/**
 * TTS 語音生成限制：用於文字轉語音
 * 30 次/分鐘（與 standardRateLimiter 相同，但有專屬錯誤訊息）
 */
export const ttsRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 分鐘
  maxRequests: 30,
  keyGenerator: userBasedKeyGenerator,
  onLimit: (req, res, bucket) => {
    const userId = req.user?.uid || req.userId;
    logger.warn('[TTS 限制] 語音生成請求被限制', {
      userId,
      count: bucket.count,
    });

    res.status(429).json({
      success: false,
      message: '語音生成請求過於頻繁，請稍後再試',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000),
    });
  },
});

/**
 * AI 圖片生成限制：用於 AI 圖片生成（極高消耗）
 * 5 次/分鐘（與 veryStrictRateLimiter 相同，但有專屬錯誤訊息）
 */
export const aiImageGenerationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 分鐘
  maxRequests: 5,
  keyGenerator: userBasedKeyGenerator,
  onLimit: (req, res, bucket) => {
    const userId = req.user?.uid || req.userId;
    logger.warn('[AI 圖片限制] 圖片生成請求被限制', {
      userId,
      count: bucket.count,
    });

    res.status(429).json({
      success: false,
      message: '圖片生成請求過於頻繁，請稍後再試',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000),
    });
  },
});

/**
 * AI 影片生成限制：用於 AI 影片生成（極高消耗）
 * 3 次/分鐘
 */
export const aiVideoGenerationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 分鐘
  maxRequests: 3,
  keyGenerator: userBasedKeyGenerator,
  onLimit: (req, res, bucket) => {
    const userId = req.user?.uid || req.userId;
    logger.warn('[AI 影片限制] 影片生成請求被限制', {
      userId,
      count: bucket.count,
    });

    res.status(429).json({
      success: false,
      message: '影片生成請求過於頻繁，請稍後再試',
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((bucket.resetAt - Date.now()) / 1000),
    });
  },
});

// ==================== 路由級別的速率限制配置 ====================

/**
 * 為不同路由推薦的速率限制器
 * 使用指南：在路由中引入對應的限制器
 *
 * 使用示例：
 * ```javascript
 * import { conversationRateLimiter } from '../middleware/rateLimiterConfig.js';
 *
 * router.post('/api/ai/conversation/:characterId',
 *   conversationRateLimiter,
 *   asyncHandler(async (req, res) => {
 *     // 處理邏輯
 *   })
 * );
 * ```
 */
export const RATE_LIMIT_RECOMMENDATIONS = {
  // AI 相關
  aiConversation: conversationRateLimiter, // POST /api/ai/conversation/:characterId
  aiSuggestions: standardRateLimiter, // POST /api/ai/suggestions/:characterId
  photoGeneration: veryStrictRateLimiter, // POST /api/ai/photo/:characterId
  videoGeneration: veryStrictRateLimiter, // POST /api/ai/video/:characterId
  ttsGeneration: strictRateLimiter, // POST /api/ai/voice/:characterId

  // 購買相關
  coinPurchase: purchaseRateLimiter, // POST /api/coins/purchase/package
  assetPurchase: purchaseRateLimiter, // POST /api/assets/purchase
  membershipUpgrade: purchaseRateLimiter, // POST /api/membership/upgrade

  // 禮物相關
  giftSend: giftRateLimiter, // POST /api/gifts/send
  giftResponse: standardRateLimiter, // POST /api/gifts/generate-response

  // 認證相關
  login: authRateLimiter, // POST /api/auth/login
  register: authRateLimiter, // POST /api/auth/register

  // 一般操作
  readOperations: relaxedRateLimiter, // GET 請求（角色列表、用戶資料等）
  writeOperations: standardRateLimiter, // POST/PUT 請求（更新資料等）

  // 危險操作
  dangerousOperations: strictRateLimiter, // DELETE 請求、敏感操作
};

/**
 * 獲取所有速率限制器的監控統計
 * 用於監控和調試
 */
export const getRateLimiterStats = () => {
  return {
    strict: strictRateLimiter.getBucketsSize(),
    standard: standardRateLimiter.getBucketsSize(),
    relaxed: relaxedRateLimiter.getBucketsSize(),
    veryStrict: veryStrictRateLimiter.getBucketsSize(),
    purchase: purchaseRateLimiter.getBucketsSize(),
    auth: authRateLimiter.getBucketsSize(),
    conversation: conversationRateLimiter.getBucketsSize(),
    gift: giftRateLimiter.getBucketsSize(),
    aiSuggestion: aiSuggestionRateLimiter.getBucketsSize(),
    tts: ttsRateLimiter.getBucketsSize(),
    aiImageGeneration: aiImageGenerationRateLimiter.getBucketsSize(),
    aiVideoGeneration: aiVideoGenerationRateLimiter.getBucketsSize(),
  };
};

export default {
  strictRateLimiter,
  standardRateLimiter,
  relaxedRateLimiter,
  veryStrictRateLimiter,
  purchaseRateLimiter,
  authRateLimiter,
  conversationRateLimiter,
  giftRateLimiter,
  aiSuggestionRateLimiter,
  ttsRateLimiter,
  aiImageGenerationRateLimiter,
  aiVideoGenerationRateLimiter,
  RATE_LIMIT_RECOMMENDATIONS,
  getRateLimiterStats,
};
