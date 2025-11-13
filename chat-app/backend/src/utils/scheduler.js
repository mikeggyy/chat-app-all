/**
 * 定時任務調度器
 * ✅ P2-5 優化：實現自動化定時任務
 *
 * 功能：
 * - 每日檢查過期會員並自動降級
 * - 每月發放會員獎勵（需要手動觸發或外部調度）
 * - 清理過期的冪等性記錄
 *
 * 使用方式：
 * 1. 開發環境：使用內建的 node-schedule（簡單但不適合多服務器）
 * 2. 生產環境：建議使用 Google Cloud Scheduler + HTTP 觸發
 */

import logger from './logger.js';

// ============================================
// 定時任務處理函數
// ============================================

/**
 * 執行過期會員檢查和降級
 */
export const runExpiredMembershipCheck = async () => {
  try {
    logger.info('[定時任務] 開始執行過期會員檢查...');

    // 動態導入避免循環依賴
    const { checkAndDowngradeExpiredMemberships } = await import('../membership/membership.service.js');

    const result = await checkAndDowngradeExpiredMemberships();

    if (result.success) {
      logger.info(
        `[定時任務] ✅ 過期會員檢查完成 - ` +
        `檢查: ${result.totalChecked}, ` +
        `過期: ${result.expired}, ` +
        `降級: ${result.downgraded}, ` +
        `錯誤: ${result.errors}, ` +
        `耗時: ${result.duration}ms`
      );
    } else {
      logger.error(`[定時任務] ❌ 過期會員檢查失敗: ${result.error}`);
    }

    return result;
  } catch (error) {
    logger.error('[定時任務] 過期會員檢查執行失敗:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 執行冪等性記錄清理
 */
export const runIdempotencyCleanup = async () => {
  try {
    logger.info('[定時任務] 開始執行冪等性記錄清理...');

    // 冪等性清理是自動的，這裡只是記錄
    const { getIdempotencyStats } = await import('./idempotency.js');
    const stats = await getIdempotencyStats();

    logger.info(
      `[定時任務] ✅ 冪等性統計 - ` +
      `本地緩存: ${stats.local.valid}/${stats.local.total}, ` +
      `Firestore: ~${stats.firestore.count}, ` +
      `處理中: ${stats.processing}`
    );

    return { success: true, stats };
  } catch (error) {
    logger.error('[定時任務] 冪等性記錄清理失敗:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// 開發環境調度器（僅用於本地測試）
// ============================================

let schedulerActive = false;
let scheduledJobs = [];

/**
 * 啟動開發環境調度器
 * ⚠️ 僅適用於單服務器環境！生產環境請使用 Cloud Scheduler
 */
export const startScheduler = async () => {
  // 檢查是否已啟動
  if (schedulerActive) {
    logger.warn('[定時任務] 調度器已在運行中');
    return;
  }

  // 檢查環境變量
  const enableScheduler = process.env.ENABLE_SCHEDULER === 'true';
  const isProduction = process.env.NODE_ENV === 'production';

  if (!enableScheduler) {
    logger.info('[定時任務] 調度器未啟用（ENABLE_SCHEDULER=false）');
    return;
  }

  if (isProduction) {
    logger.warn(
      '[定時任務] ⚠️ 檢測到生產環境，不建議使用內建調度器！' +
      '請使用 Google Cloud Scheduler 或其他外部調度服務'
    );
    // 在生產環境中不自動啟動
    return;
  }

  try {
    // 動態導入 node-schedule（避免必須依賴）
    const schedule = await import('node-schedule');

    logger.info('[定時任務] 正在啟動開發環境調度器...');

    // 每日凌晨 2:00 執行過期會員檢查
    const membershipCheckJob = schedule.default.scheduleJob('0 2 * * *', async () => {
      await runExpiredMembershipCheck();
    });
    scheduledJobs.push({ name: '過期會員檢查', job: membershipCheckJob });

    // 每小時執行冪等性統計
    const idempotencyStatsJob = schedule.default.scheduleJob('0 * * * *', async () => {
      await runIdempotencyCleanup();
    });
    scheduledJobs.push({ name: '冪等性統計', job: idempotencyStatsJob });

    schedulerActive = true;

    logger.info(
      `[定時任務] ✅ 開發環境調度器已啟動，共 ${scheduledJobs.length} 個定時任務：\n` +
      `  - 過期會員檢查: 每日 02:00\n` +
      `  - 冪等性統計: 每小時`
    );

    // 可選：立即執行一次（用於測試）
    if (process.env.RUN_SCHEDULER_ON_START === 'true') {
      logger.info('[定時任務] 立即執行一次所有定時任務（測試模式）...');
      await runExpiredMembershipCheck();
      await runIdempotencyCleanup();
    }
  } catch (error) {
    logger.error('[定時任務] 啟動調度器失敗:', error);
    if (error.code === 'MODULE_NOT_FOUND') {
      logger.error(
        '[定時任務] ⚠️ 缺少 node-schedule 依賴，請執行: npm install node-schedule'
      );
    }
  }
};

/**
 * 停止調度器
 */
export const stopScheduler = () => {
  if (!schedulerActive) {
    logger.info('[定時任務] 調度器未運行');
    return;
  }

  logger.info('[定時任務] 正在停止調度器...');

  // 取消所有定時任務
  scheduledJobs.forEach(({ name, job }) => {
    if (job) {
      job.cancel();
      logger.info(`[定時任務] 已停止: ${name}`);
    }
  });

  scheduledJobs = [];
  schedulerActive = false;

  logger.info('[定時任務] ✅ 調度器已停止');
};

/**
 * 獲取調度器狀態
 */
export const getSchedulerStatus = () => {
  return {
    active: schedulerActive,
    jobs: scheduledJobs.map(({ name }) => name),
    totalJobs: scheduledJobs.length,
  };
};

// ============================================
// HTTP 觸發端點（用於 Cloud Scheduler）
// ============================================

/**
 * 創建定時任務 HTTP 路由
 * 供 Google Cloud Scheduler 調用
 */
export const createSchedulerRoutes = (router) => {
  /**
   * POST /api/scheduler/expired-memberships
   * 觸發過期會員檢查
   */
  router.post('/api/scheduler/expired-memberships', async (req, res) => {
    try {
      // ✅ 安全性：驗證來源（Cloud Scheduler 或管理員）
      const schedulerToken = req.headers['x-scheduler-token'];
      const expectedToken = process.env.SCHEDULER_AUTH_TOKEN;

      if (!expectedToken || schedulerToken !== expectedToken) {
        logger.warn('[定時任務] ⚠️ 未授權的調度請求');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await runExpiredMembershipCheck();
      res.json(result);
    } catch (error) {
      logger.error('[定時任務] HTTP 觸發失敗:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/scheduler/idempotency-cleanup
   * 觸發冪等性清理
   */
  router.post('/api/scheduler/idempotency-cleanup', async (req, res) => {
    try {
      const schedulerToken = req.headers['x-scheduler-token'];
      const expectedToken = process.env.SCHEDULER_AUTH_TOKEN;

      if (!expectedToken || schedulerToken !== expectedToken) {
        logger.warn('[定時任務] ⚠️ 未授權的調度請求');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await runIdempotencyCleanup();
      res.json(result);
    } catch (error) {
      logger.error('[定時任務] HTTP 觸發失敗:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/scheduler/status
   * 獲取調度器狀態
   */
  router.get('/api/scheduler/status', (req, res) => {
    const status = getSchedulerStatus();
    res.json(status);
  });

  logger.info('[定時任務] ✅ 已註冊調度器 HTTP 端點');
};

export default {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  runExpiredMembershipCheck,
  runIdempotencyCleanup,
  createSchedulerRoutes,
};
