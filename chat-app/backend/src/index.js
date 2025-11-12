import "dotenv/config";
// ⚠️ 必須在所有 Firebase 模組之前導入 setup-emulator
import "./setup-emulator.js";
import { validateEnvOrExit } from "./utils/validateEnv.js";

// 🔍 驗證環境變數（應用啟動前）
validateEnvOrExit();

import express from "express";
import cors from "cors";
import logger, { httpLogger } from "./utils/logger.js";
import { userRouter } from "./user/index.js";
import { conversationRouter } from "./conversation/index.js";
import { aiRouter } from "./ai/index.js";
import { matchRouter } from "./match/index.js";
import { TEST_ACCOUNTS, issueTestSession } from "../../shared/config/testAccounts.js";
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
import aiSettingsRouter from "./ai/aiSettings.routes.js";
import { cleanupInactiveUsers, getAllUsers } from "./user/user.service.js";
import { conversationLimitService } from "./conversation/conversationLimit.service.js";
import { voiceLimitService } from "./ai/voiceLimit.service.js";
import { photoLimitService } from "./ai/photoLimit.service.js";
import { getConversationCacheStats } from "./conversation/index.js";
import { initializeCharactersCache, getCacheStats as getCharacterCacheStats } from "./services/character/characterCache.service.js";
import { startCacheStatsMonitoring, getCacheStats as getUserCacheStats } from "./user/userProfileCache.service.js";
import { errorHandlerMiddleware } from "../../../shared/utils/errorFormatter.js";

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
    const developmentOrigins = ["http://localhost:5173", "http://localhost:3000"];
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
// HTTP 請求日誌
app.use(httpLogger);

// 增加 JSON payload 限制以支持 base64 圖片數據
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
app.use("/api/photos", photoAlbumRouter);
app.use("/api/character-styles", characterStylesRouter);
app.use(assetPurchaseRouter);
app.use(assetPackagesRouter);
app.use(shopRouter);

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
app.use(errorHandlerMiddleware);

app.listen(port, async () => {
  logger.info(`API 伺服器已啟動於 http://localhost:${port}`);
  logger.info(`環境: ${process.env.NODE_ENV || "development"}`);
  logger.info(`日誌級別: ${logger.level}`);

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

      // 2. 獲取活躍用戶 ID 列表
      const { users: allUsers } = await getAllUsers({ limit: 1000 }); // 獲取前 1000 個用戶用於清理
      const activeUserIds = new Set(allUsers.map((user) => user.id));

      // 3. 清理各個限制服務的記錄
      const conversationCleanup = conversationLimitService.cleanupInactiveUsers(activeUserIds);
      logger.info(`[記憶體清理] 對話限制清理完成`, conversationCleanup);

      const voiceCleanup = voiceLimitService.cleanupInactiveUsers(activeUserIds);
      logger.info(`[記憶體清理] 語音限制清理完成`, voiceCleanup);

      const photoCleanup = photoLimitService.cleanupInactiveUsers(activeUserIds);
      logger.info(`[記憶體清理] 拍照限制清理完成`, photoCleanup);

      // 4. 記錄冪等性快取統計（自動清理已在 idempotency.js 中啟動）
      const { getIdempotencyStats } = await import("./utils/idempotency.js");
      const idempotencyStats = getIdempotencyStats();
      logger.info(`[記憶體清理] 冪等性快取統計`, {
        total: idempotencyStats.total,
        valid: idempotencyStats.valid,
        expired: idempotencyStats.expired,
        processing: idempotencyStats.processing,
        note: "冪等性快取每 5 分鐘自動清理一次過期條目"
      });

      // 5. 清理舊的交易記錄（保留 90 天）
      // TODO: 實現 cleanupOldTransactions 函數
      // const transactionCleanup = cleanupOldTransactions(90);
      // logger.info(`[記憶體清理] 交易記錄清理完成`, transactionCleanup);

      // 6. 記錄對話緩存統計（LRU 會自動管理，無需手動清理）
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

