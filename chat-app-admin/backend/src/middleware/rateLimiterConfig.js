/**
 * 管理後台速率限制配置
 * 為管理 API 端點定義速率限制策略，防止誤操作和惡意行為
 */

import rateLimit from 'express-rate-limit';

/**
 * 管理後台專用錯誤訊息處理
 */
const createLimitHandler = (message = '操作過於頻繁，請稍後再試') => {
  return (req, res) => {
    console.warn('[速率限制] 管理操作被限制', {
      adminUid: req.user?.uid || 'unknown',
      endpoint: req.originalUrl,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      success: false,
      message,
      error: 'RATE_LIMIT_EXCEEDED',
    });
  };
};

/**
 * 基於管理員 UID 的 key 生成器
 */
const adminKeyGenerator = (req) => {
  const adminUid = req.user?.uid || req.adminUid;
  if (adminUid) {
    return `admin:${adminUid}`;
  }
  // 未認證請求使用 IP（應該在認證中間件被阻擋）
  return `ip:${req.ip}`;
};

// ==================== 速率限制器實例 ====================

/**
 * 嚴格限制：用於危險操作（刪除、批量修改等）
 * 20 次/15 分鐘
 */
export const strictAdminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 20, // 最多 20 次請求
  standardHeaders: 'draft-7', // RateLimit-* headers (express-rate-limit v7+)
  legacyHeaders: false,
  keyGenerator: adminKeyGenerator,
  handler: createLimitHandler('危險操作過於頻繁，請稍後再試。如需協助請聯繫系統管理員。'),
  skipFailedRequests: true, // 失敗的請求不計入限制
});

/**
 * 標準限制：用於一般管理操作（更新、查詢等）
 * 100 次/15 分鐘
 *
 * ⚠️ 安全設計說明：skipFailedRequests 設置為 false
 *
 * 為什麼失敗的請求也計入限制？
 * 1. 防止暴力嘗試攻擊：攻擊者可能故意發送錯誤請求來探測系統
 * 2. 防止參數探測：即使請求失敗，也消耗了系統資源（驗證、數據庫查詢等）
 * 3. 安全優先：標準操作是最常見的操作，需要更嚴格的保護
 *
 * 用戶體驗影響：
 * - 管理員輸入錯誤可能導致被限制
 * - 但 100 次/15 分鐘的限制足夠寬鬆，正常使用不會觸發
 * - 如果被限制，說明操作頻率異常，需要檢查
 *
 * 對比其他限制器：
 * - strict/bulk/export 使用 skipFailedRequests: true，避免誤操作導致鎖定
 * - standard 是最常見的操作，安全性優先於用戶體驗
 */
export const standardAdminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100,
  standardHeaders: 'draft-7', // RateLimit-* headers (express-rate-limit v7+)
  legacyHeaders: false,
  keyGenerator: adminKeyGenerator,
  handler: createLimitHandler('管理操作過於頻繁，請稍後再試'),
  skipFailedRequests: false, // 失敗的請求也計入限制（防止暴力探測）
});

/**
 * 寬鬆限制：用於讀取操作
 * 200 次/15 分鐘
 */
export const relaxedAdminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 200,
  standardHeaders: 'draft-7', // RateLimit-* headers (express-rate-limit v7+)
  legacyHeaders: false,
  keyGenerator: adminKeyGenerator,
  handler: createLimitHandler('查詢操作過於頻繁，請稍後再試'),
  skipFailedRequests: true,
});

/**
 * 批量操作限制：用於批量處理
 * 10 次/15 分鐘
 */
export const bulkOperationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 10,
  standardHeaders: 'draft-7', // RateLimit-* headers (express-rate-limit v7+)
  legacyHeaders: false,
  keyGenerator: adminKeyGenerator,
  handler: createLimitHandler('批量操作過於頻繁，請等待後再試。批量操作消耗較大資源，請謹慎使用。'),
  skipFailedRequests: true,
});

/**
 * 數據導出限制：用於大量數據導出
 * 5 次/小時
 */
export const exportDataRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小時
  max: 5,
  standardHeaders: 'draft-7', // RateLimit-* headers (express-rate-limit v7+)
  legacyHeaders: false,
  keyGenerator: adminKeyGenerator,
  handler: createLimitHandler('數據導出操作過於頻繁，請稍後再試。每小時最多導出 5 次。'),
  skipFailedRequests: true,
});

// ==================== 路由級別的速率限制推薦 ====================

/**
 * 為不同類型的管理操作推薦的速率限制器
 *
 * 使用示例：
 * ```javascript
 * import { strictAdminRateLimiter } from '../middleware/rateLimiterConfig.js';
 *
 * router.delete('/api/users/:userId',
 *   requireRole('super_admin'),
 *   strictAdminRateLimiter,
 *   async (req, res) => { ... }
 * );
 * ```
 */
export const ADMIN_RATE_LIMIT_RECOMMENDATIONS = {
  // 危險操作（刪除、重置、清理等）
  dangerousOperations: strictAdminRateLimiter,

  // 批量操作
  bulkOperations: bulkOperationRateLimiter,

  // 數據導出
  dataExport: exportDataRateLimiter,

  // 一般寫操作（更新、創建等）
  writeOperations: standardAdminRateLimiter,

  // 讀取操作（查詢、列表等）
  readOperations: relaxedAdminRateLimiter,
};

/**
 * 需要應用速率限制的路由清單
 * 用於檢查和審計
 */
export const PROTECTED_ROUTES = {
  // 用戶管理
  deleteUser: { path: 'DELETE /api/users/:userId', limiter: 'strict' },
  updateUserResources: { path: 'PUT /api/users/:userId/resources', limiter: 'standard' },
  cleanNullKeys: { path: 'POST /api/users/:userId/clean-null-keys', limiter: 'standard' },
  deleteUnlockEffect: { path: 'DELETE /api/users/:userId/unlock-effects/:characterId', limiter: 'strict' },
  bulkUpdateUsers: { path: 'POST /api/users/bulk-update', limiter: 'bulk' },

  // 角色管理
  createCharacter: { path: 'POST /api/characters', limiter: 'standard' },
  updateCharacter: { path: 'PUT /api/characters/:id', limiter: 'standard' },
  deleteCharacter: { path: 'DELETE /api/characters/:id', limiter: 'strict' },

  // 配置管理
  updateAISettings: { path: 'PUT /api/config/ai-settings', limiter: 'standard' },
  updateSystemConfig: { path: 'PUT /api/config/system', limiter: 'strict' },

  // 數據管理
  exportUsers: { path: 'GET /api/export/users', limiter: 'export' },
  exportConversations: { path: 'GET /api/export/conversations', limiter: 'export' },

  // 對話管理
  deleteConversation: { path: 'DELETE /api/conversations/:id', limiter: 'strict' },
  bulkDeleteConversations: { path: 'POST /api/conversations/bulk-delete', limiter: 'bulk' },
};

export default {
  strictAdminRateLimiter,
  standardAdminRateLimiter,
  relaxedAdminRateLimiter,
  bulkOperationRateLimiter,
  exportDataRateLimiter,
  ADMIN_RATE_LIMIT_RECOMMENDATIONS,
  PROTECTED_ROUTES,
};
