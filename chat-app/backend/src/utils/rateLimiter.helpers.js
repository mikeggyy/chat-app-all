/**
 * Rate Limiter 輔助工具
 * 提供通用的 key generator 函數
 */

/**
 * 基礎 Key Generator
 * 優先使用已認證的 Firebase UID，其次使用路由參數中的 userId，最後使用 IP 地址
 *
 * 優先級：
 * 1. Firebase 認證的 UID（最可靠）
 * 2. 路由參數中的 userId（次選）
 * 3. IP 地址（最後選擇，支援代理）
 *
 * @param {Object} req - Express request 對象
 * @returns {string} 唯一識別 key
 *
 * @example
 * const limiter = createRateLimiter({
 *   windowMs: 60000,
 *   maxRequests: 10,
 *   keyGenerator: baseKeyGenerator,
 * });
 */
export const baseKeyGenerator = (req) => {
  // 1. 優先使用 Firebase 認證的 UID
  if (req.firebaseUser?.uid) {
    return `uid:${req.firebaseUser.uid}`;
  }

  // 2. 使用路由參數中的 userId
  if (typeof req.params?.userId === "string" && req.params.userId.length) {
    return `uid:${req.params.userId}`;
  }

  // 3. 使用 IP 地址（支援代理）
  const forwarded =
    typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
      : null;

  const ip =
    (typeof req.ip === "string" && req.ip.length && req.ip) ||
    (typeof forwarded === "string" && forwarded.length && forwarded) ||
    "unknown";

  return `ip:${ip}`;
};

/**
 * 僅使用 UID 的 Key Generator
 * 僅使用 Firebase 認證的 UID，不回退到 IP
 * 適用於需要嚴格身份驗證的端點
 *
 * @param {Object} req - Express request 對象
 * @returns {string|null} UID key 或 null
 *
 * @example
 * const limiter = createRateLimiter({
 *   windowMs: 60000,
 *   maxRequests: 10,
 *   keyGenerator: uidOnlyKeyGenerator,
 * });
 */
export const uidOnlyKeyGenerator = (req) => {
  if (req.firebaseUser?.uid) {
    return `uid:${req.firebaseUser.uid}`;
  }
  return null; // 未認證的請求不進行速率限制（應該已被 requireFirebaseAuth 攔截）
};

/**
 * 僅使用 IP 的 Key Generator
 * 僅使用 IP 地址，適用於公開端點
 *
 * @param {Object} req - Express request 對象
 * @returns {string} IP key
 *
 * @example
 * const limiter = createRateLimiter({
 *   windowMs: 60000,
 *   maxRequests: 100,
 *   keyGenerator: ipOnlyKeyGenerator,
 * });
 */
export const ipOnlyKeyGenerator = (req) => {
  const forwarded =
    typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
      : null;

  const ip =
    (typeof req.ip === "string" && req.ip.length && req.ip) ||
    (typeof forwarded === "string" && forwarded.length && forwarded) ||
    "unknown";

  return `ip:${ip}`;
};

/**
 * 組合 Key Generator
 * 使用 UID 和 IP 的組合，提供更細粒度的限制
 *
 * @param {Object} req - Express request 對象
 * @returns {string} 組合 key
 *
 * @example
 * const limiter = createRateLimiter({
 *   windowMs: 60000,
 *   maxRequests: 5,
 *   keyGenerator: combinedKeyGenerator,
 * });
 */
export const combinedKeyGenerator = (req) => {
  const uid = req.firebaseUser?.uid || 'anonymous';
  const forwarded =
    typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
      : null;

  const ip =
    (typeof req.ip === "string" && req.ip.length && req.ip) ||
    (typeof forwarded === "string" && forwarded.length && forwarded) ||
    "unknown";

  return `${uid}:${ip}`;
};

export default {
  baseKeyGenerator,
  uidOnlyKeyGenerator,
  ipOnlyKeyGenerator,
  combinedKeyGenerator,
};
