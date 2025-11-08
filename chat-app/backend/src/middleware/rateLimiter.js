const createRateLimiter = ({
  windowMs = 60000,
  maxRequests = 60,
  keyGenerator = (req) => req.ip,
  onLimit,
} = {}) => {
  const buckets = new Map();

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

  return limiter;
};

export { createRateLimiter };
