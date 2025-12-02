/**
 * 定時任務路由 (Cron Jobs)
 *
 * 用途：
 * - 提供給 Cloud Scheduler 調用的端點
 * - 執行定期維護任務
 *
 * 安全性：
 * - 僅允許來自 Cloud Scheduler 的請求
 * - 驗證 Cloud Scheduler 的服務帳號
 */

import express from "express";
import logger from "../utils/logger.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";
import {
  cleanupStaleUpgradeLocks,
  getLockedUsers
} from "../services/membershipLockCleanup.service.js";

const router = express.Router();

/**
 * 中間件：驗證 Cloud Scheduler 請求
 *
 * Cloud Scheduler 使用 OIDC 認證，會在請求頭中包含 JWT token
 * 在生產環境中應該驗證這個 token
 */
const validateCronRequest = (req, res, next) => {
  // 開發環境：允許所有請求（方便本地測試）
  if (process.env.NODE_ENV !== "production") {
    logger.info("[Cron] 開發環境：跳過 Cloud Scheduler 驗證");
    return next();
  }

  // 生產環境：驗證請求來源
  // 方法 1：檢查 Cloud Scheduler 的 User-Agent
  const userAgent = req.get("User-Agent") || "";
  if (!userAgent.includes("Google-Cloud-Scheduler")) {
    logger.warn("[Cron] 非 Cloud Scheduler 請求被拒絕", {
      userAgent,
      ip: req.ip,
    });
    return sendError(res, "FORBIDDEN", "只允許 Cloud Scheduler 調用此端點");
  }

  // 方法 2：驗證 OIDC token（推薦）
  // 這裡可以添加更嚴格的 JWT token 驗證
  // 參考：https://cloud.google.com/scheduler/docs/http-target-auth

  next();
};

/**
 * POST /api/cron/cleanup-locks
 * 清理過期的會員升級鎖定
 *
 * Cloud Scheduler 配置：
 * - 執行頻率：每 5 分鐘
 * - 清理閾值：超過 5 分鐘的鎖定
 */
router.post("/cleanup-locks", validateCronRequest, async (req, res) => {
  logger.info("[Cron] 開始執行鎖定清理任務");

  try {
    // 從請求參數中獲取配置（可選）
    const maxAgeMinutes = parseInt(req.body?.maxAgeMinutes || "5", 10);

    // 執行清理
    const result = await cleanupStaleUpgradeLocks(maxAgeMinutes);

    logger.info("[Cron] 鎖定清理任務完成", {
      scanned: result.scanned,
      cleaned: result.cleaned,
      errors: result.errors,
    });

    // 返回結果給 Cloud Scheduler（用於監控）
    sendSuccess(res, {
      task: "cleanup-locks",
      result: {
        scanned: result.scanned,
        cleaned: result.cleaned,
        errors: result.errors,
        cleanedUsers: result.cleanedUsers,
      },
    });
  } catch (error) {
    logger.error("[Cron] 鎖定清理任務失敗", error);
    sendError(res, "INTERNAL_SERVER_ERROR", error.message);
  }
});

/**
 * GET /api/cron/status
 * 檢查當前鎖定狀態（不執行清理）
 *
 * 用途：手動檢查或監控告警
 */
router.get("/status", validateCronRequest, async (req, res) => {
  try {
    const lockedUsers = await getLockedUsers();

    const staleCount = lockedUsers.filter((u) => u.isStale).length;

    sendSuccess(res, {
      totalLocked: lockedUsers.length,
      staleLocks: staleCount,
      users: lockedUsers,
    });
  } catch (error) {
    logger.error("[Cron] 查詢鎖定狀態失敗", error);
    sendError(res, "INTERNAL_SERVER_ERROR", error.message);
  }
});

/**
 * POST /api/cron/test
 * 測試端點（開發環境專用）
 *
 * 用途：驗證 Cloud Scheduler 配置是否正確
 */
router.post("/test", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return sendError(res, "FORBIDDEN", "測試端點僅在開發環境可用");
  }

  logger.info("[Cron] 測試端點被調用", {
    headers: req.headers,
    body: req.body,
  });

  sendSuccess(res, {
    message: "Cron 端點測試成功",
    receivedData: req.body,
  });
});

// ============================================
// ✅ P2-5 優化：新增定時任務端點
// ============================================

/**
 * POST /api/cron/expired-memberships
 * 檢查並降級過期會員
 *
 * Cloud Scheduler 配置：
 * - 執行頻率：每日凌晨 2:00
 * - 用途：自動檢查付費會員是否過期，並降級到免費會員
 */
router.post("/expired-memberships", validateCronRequest, async (req, res) => {
  logger.info("[Cron] 開始執行過期會員檢查任務");

  try {
    const { runExpiredMembershipCheck } = await import("../utils/scheduler.js");
    const result = await runExpiredMembershipCheck();

    if (result.success) {
      logger.info("[Cron] 過期會員檢查任務完成", {
        totalChecked: result.totalChecked,
        expired: result.expired,
        downgraded: result.downgraded,
        errors: result.errors,
        duration: result.duration,
      });

      sendSuccess(res, {
        task: "expired-memberships",
        result: {
          totalChecked: result.totalChecked,
          expired: result.expired,
          downgraded: result.downgraded,
          errors: result.errors,
          duration: result.duration,
        },
      });
    } else {
      throw new Error(result.error || "Unknown error");
    }
  } catch (error) {
    logger.error("[Cron] 過期會員檢查任務失敗", error);
    sendError(res, "INTERNAL_SERVER_ERROR", error.message);
  }
});

/**
 * POST /api/cron/idempotency-cleanup
 * 清理過期的冪等性記錄
 *
 * Cloud Scheduler 配置：
 * - 執行頻率：每小時
 * - 用途：清理 Firestore 中過期的冪等性記錄
 */
router.post("/idempotency-cleanup", validateCronRequest, async (req, res) => {
  logger.info("[Cron] 開始執行冪等性清理任務");

  try {
    const { runIdempotencyCleanup } = await import("../utils/scheduler.js");
    const result = await runIdempotencyCleanup();

    if (result.success) {
      logger.info("[Cron] 冪等性清理任務完成", result.stats);

      sendSuccess(res, {
        task: "idempotency-cleanup",
        result: result.stats,
      });
    } else {
      throw new Error(result.error || "Unknown error");
    }
  } catch (error) {
    logger.error("[Cron] 冪等性清理任務失敗", error);
    sendError(res, "INTERNAL_SERVER_ERROR", error.message);
  }
});

export default router;
