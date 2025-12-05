import "dotenv/config";
// ⚠️ 必須在所有 Firebase 模組之前導入 setup-emulator
import "./setup-emulator.js";
import { validateEnvOrExit } from "./utils/validateEnv.js";

// 🔍 驗證環境變數（應用啟動前）
validateEnvOrExit();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import logger, { httpLogger } from "./utils/logger.js";
import { setCsrfToken, getCsrfTokenHandler, csrfProtection } from "../../../shared/backend-utils/csrfProtection.js";
import { userRouter } from "./user/index.js";
import { conversationRouter } from "./conversation/index.js";
import { aiRouter } from "./ai/index.js";
import { matchRouter } from "./match/index.js";
import { TEST_ACCOUNTS, issueTestSession } from "../../../shared/config/testAccounts.js";
import { rankingRouter } from "./ranking/index.js";
import { characterCreationRouter } from "./characterCreation/index.js";
import unlockTicketsRouter from "./membership/unlockTickets.routes.js";
import membershipRouter from "./membership/membership.routes.js";
import coinsRouter from "./payment/coins.routes.js";
import transactionRouter from "./payment/transaction.routes.js";
import orderRouter from "./payment/order.routes.js";
import adRouter from "./ad/ad.routes.js";
import conversationLimitRouter from "./conversation/conversationLimit.routes.js";
import { voiceLimitRouter } from "./ai/voiceLimit.routes.js";
import { photoLimitRouter } from "./ai/photoLimit.routes.js";
import voicesRouter from "./ai/voices.routes.js";
import giftRouter from "./gift/gift.routes.js";
import potionRouter from "./payment/potion.routes.js";
import { photoAlbumRouter } from "./photoAlbum/photoAlbum.routes.js";
import { characterStylesRouter } from "./characterStyles/characterStyles.routes.js";
import assetPurchaseRouter from "./user/assetPurchase.routes.js";
import assetPackagesRouter from "./user/assetPackages.routes.js";
import shopRouter from "./shop/shop.routes.js";
import bundleRouter from "./payment/bundle.routes.js";
import aiSettingsRouter from "./ai/aiSettings.routes.js";
import loginRewardRouter from "./services/loginReward.routes.js";
import firstPurchaseRouter from "./services/firstPurchase.routes.js";
import specialOfferRouter from "./services/specialOffer.routes.js";
import flashSaleRouter from "./services/flashSale.routes.js";
import notificationRouter from "./services/notification.routes.js";
import referralRouter from "./services/referral.routes.js";
import upgradeRecommendationRouter from "./services/upgradeRecommendation.routes.js";
import yearlyBonusRouter from "./services/yearlyBonus.routes.js";
import membershipConfigRouter from "./config/membershipConfig.routes.js";
import cronRouter from "./routes/cron.routes.js";
import monitoringRouter from "./routes/monitoring.routes.js";
import revenueRouter from "./routes/revenue.routes.js";
import levelRouter from "./level/level.routes.js";
import { cleanupInactiveUsers, getAllUsers } from "./user/user.service.js";
import { conversationLimitService } from "./conversation/conversationLimit.service.js";
import { voiceLimitService } from "./ai/voiceLimit.service.js";
import { photoLimitService } from "./ai/photoLimit.service.js";
import { getConversationCacheStats } from "./conversation/index.js";
import { initializeCharactersCache, getCacheStats as getCharacterCacheStats } from "./services/character/characterCache.service.js";
import { startCacheStatsMonitoring, getCacheStats as getUserCacheStats } from "./user/userProfileCache.service.js";
import { errorHandlerMiddleware } from "../../../shared/utils/errorFormatter.js";
import { errorHandler } from "./utils/AppError.js";
import { logEnvironmentInfo } from "./utils/envModeHelper.js";

const app = express();
const port = process.env.PORT ?? 4000;

// CORS 配置
const configureCORS = () => {
  const corsOrigin = process.env.CORS_ORIGIN;

  // 生產環境必須設定 CORS_ORIGIN
  if (process.env.NODE_ENV === "production" && !corsOrigin) {
    logger.error("錯誤：生產環境必須設定 CORS_ORIGIN 環境變數");
    process.exit(1);
  }

  // 開發環境的預設值
  if (!corsOrigin) {
    const developmentOrigins = [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://192.168.1.107:5173",  // 區域網 IP
    ];
    logger.info(`[CORS] 開發環境使用預設 origins: ${developmentOrigins.join(", ")}`);
    return developmentOrigins;
  }

  const origins = corsOrigin.split(",").map((url) => url.trim()).filter(Boolean);
  logger.info(`[CORS] 已配置的 origins: ${origins.join(", ")}`);
  return origins;
};

app.use(
  cors({
    origin: configureCORS(),
    credentials: true,
  })
);

// 🔒 安全性優化（2025-01）：Security Headers（防止 XSS、Clickjacking 等攻擊）
app.use(helmet({
  // Content Security Policy - 防止 XSS 攻擊
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // 允許內聯腳本（根據需要調整）
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"], // 允許外部圖片
      connectSrc: ["'self'"], // 允許 API 請求
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // X-Frame-Options - 防止點擊劫持
  frameguard: { action: 'deny' },
  // X-Content-Type-Options - 防止 MIME 類型嗅探
  noSniff: true,
  // X-XSS-Protection - 啟用瀏覽器的 XSS 防護
  xssFilter: true,
  // Referrer-Policy - 控制 Referer 標頭
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // HSTS - 強制使用 HTTPS（生產環境）
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 年
    includeSubDomains: true,
    preload: true,
  } : false,
  // 隱藏 X-Powered-By 標頭
  hidePoweredBy: true,
  // 🔥 修復：禁用 Cross-Origin-Opener-Policy（允許 Firebase 彈窗登入）
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));

// ⚡ 性能優化（2025-01）：gzip 壓縮響應數據（減少 60-80% 傳輸量）
app.use(compression({
  // 只壓縮可壓縮的內容類型
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      // 允許客戶端禁用壓縮
      return false;
    }
    // 使用 compression 的默認過濾器
    return compression.filter(req, res);
  },
  // 壓縮級別 (0-9)，6 是平衡速度和壓縮率的最佳選擇
  level: 6,
  // 只壓縮大於 1KB 的響應
  threshold: 1024
}));

// HTTP 請求日誌
app.use(httpLogger);

// 🔒 P0 優化（2025-01）：請求大小限制（防止 DoS 攻擊）
// 調整為 10MB（足夠支持 base64 圖片，但更安全）
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// 🔍 DEBUG 中間件已移除（問題已解決：Zod schema 缺少 .passthrough()）

// 🔒 安全性優化（2025-01）：XSS 輸入清理（清理所有請求中的潛在 XSS 攻擊）
import { xssSanitizer } from "./middleware/xssSanitizer.js";
app.use(xssSanitizer);

// 🔒 P0 優化（2025-01）：CSRF 保護
app.use(cookieParser());
app.use(setCsrfToken());

// CSRF Token 獲取端點（GET 請求，無需 CSRF 保護）
app.get('/api/csrf-token', getCsrfTokenHandler);

// 對所有 POST/PUT/DELETE 請求應用 CSRF 保護
// 跳過公開端點（如登入、註冊等）
app.use((req, res, next) => {
  // ⚠️ 緊急開關：允許通過環境變數臨時禁用 CSRF（僅用於緊急情況）
  if (process.env.DISABLE_CSRF === 'true') {
    logger.warn('[CSRF] ⚠️ CSRF 保護已禁用（DISABLE_CSRF=true）');
    return next();
  }

  // 🔧 開發環境自動禁用 CSRF（避免跨域 Cookie 問題）
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/test-session',
  ];

  const isPublicPath = publicPaths.some(path => req.path.startsWith(path));
  const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);

  if (isWriteMethod && !isPublicPath) {
    return csrfProtection()(req, res, next);
  }

  next();
});

app.use("/api/users", userRouter);
app.use("/api/conversations", conversationRouter);
app.use("/api/ai", aiRouter);
app.use("/api/ai-settings", aiSettingsRouter); // 🔥 AI 設定管理 API
app.use("/match", matchRouter);
app.use("/api/match", matchRouter); // API 別名，方便前端使用
app.use("/api/characters", matchRouter); // API 別名，方便前端使用
app.use("/api/rankings", rankingRouter);
app.use("/api/character-creation", characterCreationRouter);

// VIP/VVIP 系統路由
app.use(unlockTicketsRouter);
app.use(membershipRouter);
app.use(coinsRouter);
app.use("/api/transactions", transactionRouter);
app.use("/api/orders", orderRouter);
app.use(adRouter);
app.use("/api/conversations/limit", conversationLimitRouter);
app.use("/api/voice-limit", voiceLimitRouter);
app.use("/api/photo-limit", photoLimitRouter);
app.use("/api/voices", voicesRouter);
app.use("/api/gifts", giftRouter);
app.use("/api/potions", potionRouter);
app.use("/api/levels", levelRouter);
app.use("/api/photos", photoAlbumRouter);
app.use("/api/character-styles", characterStylesRouter);
app.use(assetPurchaseRouter);
app.use(assetPackagesRouter);
app.use(shopRouter);
app.use(bundleRouter);  // 組合禮包 API
app.use(loginRewardRouter);  // 登入獎勵 API
app.use(firstPurchaseRouter);  // 首購優惠 API
app.use("/api/offers", specialOfferRouter);  // 特殊優惠 API（首購、回歸）
app.use("/api/flash-sales", flashSaleRouter);  // 限時閃購 API
app.use(notificationRouter);  // 通知 API
app.use("/api/referral", referralRouter);  // 邀請獎勵 API
app.use("/api/upgrade", upgradeRecommendationRouter);  // 智能升級推薦 API
app.use("/api/yearly-bonus", yearlyBonusRouter);  // 年訂閱獎勵 API
app.use(membershipConfigRouter);  // 會員配置 API（資料庫驅動）

// 定時任務路由（Cloud Scheduler）
app.use("/api/cron", cronRouter);

// ✅ 監控增強路由（2025-01-13 優化）
app.use("/api/monitoring", monitoringRouter);

// ✅ P1 優化：營收統計儀表板 API
app.use("/api/revenue", revenueRouter);

// 🐛 調試路由（僅開發環境）
if (process.env.NODE_ENV !== 'production') {
  import('./routes/debug.routes.js').then(({ default: debugRouter }) => {
    app.use("/api/debug", debugRouter);
    logger.info('[Debug] 調試路由已啟用: /api/debug');
  }).catch(err => {
    logger.warn('[Debug] 調試路由加載失敗:', err.message);
  });
}

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

// 緩存狀態監控端點
app.get("/health/cache", async (_, res) => {
  try {
    const characterCache = getCharacterCacheStats();
    const conversationCache = getConversationCacheStats();
    const userProfileCache = getUserCacheStats();

    // 獲取冪等性快取統計
    const { getIdempotencyStats } = await import("./utils/idempotency.js");
    const idempotencyCache = getIdempotencyStats();

    res.json({
      status: "ok",
      caches: {
        characters: characterCache,
        conversations: conversationCache,
        userProfiles: userProfileCache,
        idempotency: {
          ...idempotencyCache,
          autoCleanup: true,
          cleanupInterval: "5 minutes",
          ttl: "15 minutes",
          maxSize: 10000,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

app.get("/api/welcome", (_, res) => {
  res.json({ message: "Welcome to the chat app API scaffold." });
});

app.post("/auth/test", (_, res) => {
  const user = {
    id: TEST_ACCOUNTS.GUEST_USER_ID,
    displayName: "測試帳號",
    email: "test@example.com",
  };

  const session = issueTestSession();

  res.json({
    token: session.token,
    user,
    expiresIn: session.expiresIn,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
  });
});

// ⚠️ 全局錯誤處理中間件（必須在所有路由之後）
// ✅ 優化：使用統一的 AppError 錯誤處理器
app.use(errorHandler);

app.listen(port, '0.0.0.0', async () => {
  logger.info(`API 伺服器已啟動於 http://0.0.0.0:${port} (可透過 http://localhost:${port} 或區域網路 IP 訪問)`);
  logger.info(`環境: ${process.env.NODE_ENV || "development"}`);
  logger.info(`日誌級別: ${logger.level}`);

  // 輸出環境配置信息（Mock 模式檢測）
  logEnvironmentInfo();

  // 初始化 characters 緩存
  try {
    await initializeCharactersCache();
    const cacheStats = getCharacterCacheStats();
    logger.info(`✅ Characters 緩存初始化成功`, cacheStats);
  } catch (error) {
    logger.error(`❌ Characters 緩存初始化失敗:`, error);
    logger.warn(`⚠️ 應用將繼續運行，但會直接查詢 Firestore（性能較差）`);
  }

  // 啟動用戶檔案緩存統計監控（每 10 分鐘打印一次）
  startCacheStatsMonitoring(10 * 60 * 1000);
  logger.info(`✅ 用戶檔案緩存監控已啟動`);

  // 設置定時清理任務以防止記憶體洩漏
  setupMemoryCleanup();

  // ✅ P2-5 優化：啟動定時任務調度器（開發環境）
  try {
    const { startScheduler } = await import('./utils/scheduler.js');
    await startScheduler();
  } catch (error) {
    logger.error('❌ 定時任務調度器啟動失敗:', error);
  }
});

/**
 * 設置定時清理任務
 * 每天凌晨 3:00 清理長時間未活動的用戶資料和限制記錄
 */
function setupMemoryCleanup() {
  const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 小時
  const INACTIVE_DAYS_THRESHOLD = 30; // 30 天未活動

  const performCleanup = async () => {
    const now = new Date();
    logger.info(`[記憶體清理] 開始執行清理任務 - ${now.toISOString()}`);

    try {
      // 🔒 P2-2: 批量檢查並降級過期會員（優先執行，確保會員狀態準確）
      const { checkAndDowngradeExpiredMemberships } = await import("./membership/membership.service.js");
      const membershipCleanup = await checkAndDowngradeExpiredMemberships();
      logger.info(`[記憶體清理] 會員過期檢查完成`, membershipCleanup);

      // 🔒 P2-3: 清理舊的模型使用統計（保留 90 天）
      const { cleanupOldModelUsageStats } = await import("./services/modelUsageMonitoring.service.js");
      const modelUsageCleanup = await cleanupOldModelUsageStats();
      logger.info(`[記憶體清理] 模型使用統計清理完成`, modelUsageCleanup);

      // 1. 清理用戶資料（會自動清理對應的對話歷史）
      const userCleanupResult = await cleanupInactiveUsers(INACTIVE_DAYS_THRESHOLD);
      logger.info(`[記憶體清理] 用戶清理完成`, userCleanupResult);

      // 2. 限制服務使用 LRU 緩存自動清理不活躍數據（無需手動清理）
      // - conversationLimitService, voiceLimitService, photoLimitService
      // - 緩存大小: 5000 個用戶, TTL: 60 秒
      // - Firestore 數據保留（用戶可能回來）
      logger.info(`[記憶體清理] 限制服務使用 LRU 緩存自動清理`);

      // 3. 記錄冪等性快取統計（自動清理已在 idempotency.js 中啟動）
      const { getIdempotencyStats } = await import("./utils/idempotency.js");
      const idempotencyStats = getIdempotencyStats();
      logger.info(`[記憶體清理] 冪等性快取統計`, {
        total: idempotencyStats.total,
        valid: idempotencyStats.valid,
        expired: idempotencyStats.expired,
        processing: idempotencyStats.processing,
        note: "冪等性快取每 5 分鐘自動清理一次過期條目"
      });

      // 4. 清理舊的交易記錄（保留 90 天）
      // TODO: 實現 cleanupOldTransactions 函數
      // const transactionCleanup = cleanupOldTransactions(90);
      // logger.info(`[記憶體清理] 交易記錄清理完成`, transactionCleanup);

      // 5. 記錄對話緩存統計（LRU 會自動管理，無需手動清理）
      const conversationCacheStats = getConversationCacheStats();
      logger.info(`[記憶體清理] 對話緩存統計`, conversationCacheStats);

      logger.info(`[記憶體清理] 清理任務完成 - 下次執行時間: ${new Date(now.getTime() + CLEANUP_INTERVAL_MS).toISOString()}`);
    } catch (error) {
      logger.error(`[記憶體清理] 清理任務發生錯誤`, error);
    }
  };

  // 計算距離下次凌晨 3:00 的時間
  const scheduleNextCleanup = () => {
    const now = new Date();
    const next3AM = new Date(now);
    next3AM.setHours(3, 0, 0, 0);

    // 如果現在已經過了今天的 3:00，則設定為明天的 3:00
    if (now.getHours() >= 3) {
      next3AM.setDate(next3AM.getDate() + 1);
    }

    const timeUntilCleanup = next3AM.getTime() - now.getTime();

    setTimeout(() => {
      performCleanup();
      // 執行完畢後，設置下一次 24 小時後的清理
      setInterval(performCleanup, CLEANUP_INTERVAL_MS);
    }, timeUntilCleanup);

    logger.info(`[記憶體清理] 已設置定時清理任務，首次執行時間: ${next3AM.toISOString()}`);
  };

  scheduleNextCleanup();
}

