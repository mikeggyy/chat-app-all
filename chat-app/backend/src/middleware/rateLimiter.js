import logger from "../utils/logger.js";

const createRateLimiter = ({
  windowMs = 60000,
  maxRequests = 60,
  keyGenerator = (req) => req.ip,
  onLimit,
  cleanupIntervalMs = null, // 自動清理間隔，默認為 windowMs * 2
} = {}) => {
  const buckets = new Map();
  let cleanupTimer = null;

  // 清理過期的 buckets，防止內存洩漏
  const cleanup = () => {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
        deletedCount++;
      }
    }

    // ✅ P2 優化：使用 logger 替代 console.log
    if (deletedCount > 0) {
      logger.debug(`[RateLimiter] 清理了 ${deletedCount} 個過期的 bucket，剩餘 ${buckets.size} 個`);
    }
  };

  // 啟動定期清理
  const startCleanup = () => {
    const interval = cleanupIntervalMs || windowMs * 2;
    cleanupTimer = setInterval(cleanup, interval);

    // 避免定時器阻止 Node.js 進程退出
    if (cleanupTimer.unref) {
      cleanupTimer.unref();
    }
  };

  // 停止定期清理
  const stopCleanup = () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  };

  const limiter = (req, res, next) => {
    const key = keyGenerator?.(req);
    if (typeof key !== "string" || !key.length) {
      res.status(403).json({
        message: "無法識別請求來源，已拒絕執行操作。",
      });
      return;
    }

    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > maxRequests) {
      if (typeof onLimit === "function") {
        onLimit(req, res, bucket);
      } else {
        res.status(429).json({
          message: "請求過於頻繁，請稍後再試。",
        });
      }
      return;
    }

    next();
  };

  // 啟動定期清理
  startCleanup();

  // 暴露清理方法供測試或手動清理使用
  limiter.cleanup = cleanup;
  limiter.stopCleanup = stopCleanup;
  limiter.getBucketsSize = () => buckets.size; // 用於監控

  return limiter;
};

export { createRateLimiter };
