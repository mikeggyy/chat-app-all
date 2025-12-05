/**
 * 會員續約提醒服務
 *
 * P1 優化：實現會員到期提醒系統
 * - 檢查即將過期的會員（7天、3天、1天）
 * - 發送提醒通知
 * - 記錄提醒歷史避免重複發送
 *
 * @module membershipReminder.service
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import logger from "../utils/logger.js";

// 提醒配置
const REMINDER_CONFIG = {
  // 提醒天數閾值
  DAYS_THRESHOLDS: [7, 3, 1],

  // 每個閾值的提醒類型
  REMINDER_TYPES: {
    7: 'EXPIRING_SOON',      // 即將過期
    3: 'EXPIRING_WARNING',   // 過期警告
    1: 'EXPIRING_URGENT',    // 緊急提醒
  },

  // 每個提醒的優惠碼（可選）
  DISCOUNT_CODES: {
    7: null,                 // 7天時不給優惠
    3: 'RENEW10',           // 3天時給 10% 折扣碼
    1: 'RENEW15',           // 1天時給 15% 折扣碼
  },
};

/**
 * 獲取即將過期的會員列表
 *
 * @param {number} daysThreshold - 過期天數閾值
 * @returns {Promise<Array>} 即將過期的會員列表
 */
export const getExpiringMemberships = async (daysThreshold = 7) => {
  const db = getFirestoreDb();

  try {
    const now = new Date();
    const thresholdDate = new Date(now);
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    // 設置時間範圍：從現在到閾值日期
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfThreshold = new Date(thresholdDate);
    endOfThreshold.setHours(23, 59, 59, 999);

    // 查詢即將過期的付費會員
    const snapshot = await db
      .collection('users')
      .where('membershipTier', 'in', ['lite', 'vip', 'vvip'])
      .where('membershipStatus', '==', 'active')
      .get();

    const expiringMembers = [];

    for (const doc of snapshot.docs) {
      const user = doc.data();
      const userId = doc.id;

      if (!user.membershipExpiresAt) continue;

      const expiresAt = new Date(user.membershipExpiresAt);

      // 檢查是否在閾值範圍內
      if (expiresAt > now && expiresAt <= endOfThreshold) {
        const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

        expiringMembers.push({
          userId,
          email: user.email,
          displayName: user.displayName || user.name,
          membershipTier: user.membershipTier,
          membershipExpiresAt: user.membershipExpiresAt,
          daysRemaining,
          autoRenew: user.membershipAutoRenew || false,
        });
      }
    }

    logger.info(`[會員提醒] 找到 ${expiringMembers.length} 個即將在 ${daysThreshold} 天內過期的會員`);

    return expiringMembers;
  } catch (error) {
    logger.error('[會員提醒] 獲取即將過期會員失敗:', error);
    throw error;
  }
};

/**
 * 檢查用戶是否已收到特定類型的提醒
 *
 * @param {string} userId - 用戶 ID
 * @param {string} reminderType - 提醒類型
 * @param {string} expiryPeriod - 過期期間標識（用於區分不同訂閱週期）
 * @returns {Promise<boolean>} 是否已發送過提醒
 */
const hasReceivedReminder = async (userId, reminderType, expiryPeriod) => {
  const db = getFirestoreDb();

  try {
    const reminderId = `${userId}_${reminderType}_${expiryPeriod}`;
    const reminderDoc = await db.collection('membership_reminders').doc(reminderId).get();

    return reminderDoc.exists;
  } catch (error) {
    logger.warn(`[會員提醒] 檢查提醒歷史失敗: ${error.message}`);
    return false;
  }
};

/**
 * 記錄已發送的提醒
 *
 * @param {string} userId - 用戶 ID
 * @param {string} reminderType - 提醒類型
 * @param {string} expiryPeriod - 過期期間標識
 * @param {Object} metadata - 附加信息
 */
const recordReminderSent = async (userId, reminderType, expiryPeriod, metadata = {}) => {
  const db = getFirestoreDb();

  try {
    const reminderId = `${userId}_${reminderType}_${expiryPeriod}`;

    await db.collection('membership_reminders').doc(reminderId).set({
      userId,
      reminderType,
      expiryPeriod,
      sentAt: FieldValue.serverTimestamp(),
      ...metadata,
    });

    logger.debug(`[會員提醒] 記錄提醒: ${reminderId}`);
  } catch (error) {
    logger.error(`[會員提醒] 記錄提醒失敗: ${error.message}`);
  }
};

/**
 * 創建用戶通知
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} notification - 通知內容
 */
const createUserNotification = async (userId, notification) => {
  const db = getFirestoreDb();

  try {
    await db.collection('users').doc(userId).collection('notifications').add({
      ...notification,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.debug(`[會員提醒] 創建通知成功: userId=${userId}, type=${notification.type}`);
  } catch (error) {
    logger.error(`[會員提醒] 創建通知失敗: ${error.message}`);
  }
};

/**
 * 發送會員到期提醒
 *
 * @param {Object} member - 會員信息
 * @param {number} daysThreshold - 提醒天數閾值
 * @returns {Promise<Object>} 發送結果
 */
export const sendExpirationReminder = async (member, daysThreshold) => {
  const reminderType = REMINDER_CONFIG.REMINDER_TYPES[daysThreshold] || 'EXPIRING_SOON';
  const discountCode = REMINDER_CONFIG.DISCOUNT_CODES[daysThreshold];

  // 生成過期期間標識（用於防止重複發送）
  const expiryDate = new Date(member.membershipExpiresAt);
  const expiryPeriod = `${expiryDate.getFullYear()}-${expiryDate.getMonth() + 1}`;

  // 檢查是否已發送過
  const alreadySent = await hasReceivedReminder(member.userId, reminderType, expiryPeriod);
  if (alreadySent) {
    logger.debug(`[會員提醒] 跳過已發送的提醒: userId=${member.userId}, type=${reminderType}`);
    return { success: false, reason: 'ALREADY_SENT' };
  }

  // 如果用戶設置了自動續費，跳過提醒（但仍記錄）
  if (member.autoRenew) {
    logger.debug(`[會員提醒] 用戶已設置自動續費，跳過提醒: userId=${member.userId}`);
    return { success: false, reason: 'AUTO_RENEW_ENABLED' };
  }

  // 構建通知內容
  const tierName = {
    lite: 'Lite 入門會員',
    vip: 'VIP 標準會員',
    vvip: 'VVIP 尊貴會員',
  }[member.membershipTier] || member.membershipTier.toUpperCase();

  const notification = {
    type: 'MEMBERSHIP_EXPIRING',
    subType: reminderType,
    title: getMembershipReminderTitle(daysThreshold),
    message: getMembershipReminderMessage(member, daysThreshold, tierName),
    data: {
      membershipTier: member.membershipTier,
      expiresAt: member.membershipExpiresAt,
      daysRemaining: member.daysRemaining,
      discountCode,
    },
    actionUrl: '/membership',
    actionText: '立即續費',
    priority: daysThreshold <= 1 ? 'high' : daysThreshold <= 3 ? 'medium' : 'low',
  };

  // 創建通知
  await createUserNotification(member.userId, notification);

  // 記錄已發送
  await recordReminderSent(member.userId, reminderType, expiryPeriod, {
    membershipTier: member.membershipTier,
    daysRemaining: member.daysRemaining,
  });

  logger.info(`[會員提醒] 已發送提醒: userId=${member.userId}, tier=${member.membershipTier}, daysRemaining=${member.daysRemaining}`);

  return {
    success: true,
    userId: member.userId,
    reminderType,
    daysRemaining: member.daysRemaining,
  };
};

/**
 * 獲取提醒標題
 */
const getMembershipReminderTitle = (daysThreshold) => {
  switch (daysThreshold) {
    case 1:
      return '⚠️ 會員即將在明天到期！';
    case 3:
      return '📢 會員將在 3 天後到期';
    case 7:
      return '💡 會員即將到期提醒';
    default:
      return '會員到期提醒';
  }
};

/**
 * 獲取提醒訊息
 */
const getMembershipReminderMessage = (member, daysThreshold, tierName) => {
  const discountCode = REMINDER_CONFIG.DISCOUNT_CODES[daysThreshold];

  let baseMessage = `您的 ${tierName} 將於 ${member.daysRemaining} 天後到期。`;

  if (daysThreshold === 1) {
    baseMessage += '\n\n⏰ 為避免會員權益中斷，請盡快續費！';
  } else if (daysThreshold === 3) {
    baseMessage += '\n\n續費後可繼續享受無限對話、優先客服等專屬權益。';
  } else {
    baseMessage += '\n\n提前續費，讓您的聊天體驗不中斷。';
  }

  if (discountCode) {
    baseMessage += `\n\n🎁 專屬優惠：使用折扣碼「${discountCode}」可享續費折扣！`;
  }

  return baseMessage;
};

/**
 * 批量處理會員到期提醒
 *
 * 這個函數會檢查所有閾值（7天、3天、1天）並發送相應的提醒
 *
 * @returns {Promise<Object>} 處理結果統計
 */
export const processMembershipReminders = async () => {
  const startTime = Date.now();
  const results = {
    success: true,
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    byThreshold: {},
  };

  logger.info('[會員提醒] 開始批量處理會員到期提醒...');

  try {
    for (const daysThreshold of REMINDER_CONFIG.DAYS_THRESHOLDS) {
      const thresholdResult = {
        checked: 0,
        sent: 0,
        skipped: 0,
        errors: 0,
      };

      // 獲取該閾值的即將過期會員
      const expiringMembers = await getExpiringMemberships(daysThreshold);
      thresholdResult.checked = expiringMembers.length;

      // 篩選出剩餘天數正好匹配閾值的會員
      const targetMembers = expiringMembers.filter(m => {
        // 7天閾值：6-7天
        // 3天閾值：2-3天
        // 1天閾值：0-1天
        if (daysThreshold === 7) return m.daysRemaining >= 6 && m.daysRemaining <= 7;
        if (daysThreshold === 3) return m.daysRemaining >= 2 && m.daysRemaining <= 3;
        if (daysThreshold === 1) return m.daysRemaining >= 0 && m.daysRemaining <= 1;
        return m.daysRemaining === daysThreshold;
      });

      // 發送提醒
      for (const member of targetMembers) {
        try {
          const sendResult = await sendExpirationReminder(member, daysThreshold);

          if (sendResult.success) {
            thresholdResult.sent++;
            results.sent++;
          } else {
            thresholdResult.skipped++;
            results.skipped++;
          }

          results.processed++;
        } catch (error) {
          logger.error(`[會員提醒] 處理會員 ${member.userId} 失敗:`, error);
          thresholdResult.errors++;
          results.errors++;
        }
      }

      results.byThreshold[daysThreshold] = thresholdResult;

      logger.info(`[會員提醒] ${daysThreshold}天閾值處理完成 - 檢查: ${thresholdResult.checked}, 發送: ${thresholdResult.sent}, 跳過: ${thresholdResult.skipped}`);
    }

    results.duration = Date.now() - startTime;

    logger.info(`[會員提醒] ✅ 批量處理完成 - 總處理: ${results.processed}, 發送: ${results.sent}, 跳過: ${results.skipped}, 錯誤: ${results.errors}, 耗時: ${results.duration}ms`);

    return results;
  } catch (error) {
    logger.error('[會員提醒] ❌ 批量處理失敗:', error);

    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
};

/**
 * 獲取用戶的會員提醒歷史
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Array>} 提醒歷史
 */
export const getUserReminderHistory = async (userId) => {
  const db = getFirestoreDb();

  try {
    const snapshot = await db
      .collection('membership_reminders')
      .where('userId', '==', userId)
      .orderBy('sentAt', 'desc')
      .limit(20)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      sentAt: doc.data().sentAt?.toDate?.()?.toISOString() || null,
    }));
  } catch (error) {
    logger.error(`[會員提醒] 獲取提醒歷史失敗: ${error.message}`);
    return [];
  }
};

/**
 * 清理過期的提醒記錄（保留最近 90 天）
 *
 * @returns {Promise<Object>} 清理結果
 */
export const cleanupOldReminders = async () => {
  const db = getFirestoreDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  try {
    const snapshot = await db
      .collection('membership_reminders')
      .where('sentAt', '<', cutoffDate)
      .limit(500)
      .get();

    if (snapshot.empty) {
      return { deleted: 0 };
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info(`[會員提醒] 已清理 ${snapshot.size} 條過期提醒記錄`);

    return { deleted: snapshot.size };
  } catch (error) {
    logger.error(`[會員提醒] 清理過期記錄失敗: ${error.message}`);
    throw error;
  }
};

export default {
  getExpiringMemberships,
  sendExpirationReminder,
  processMembershipReminders,
  getUserReminderHistory,
  cleanupOldReminders,
  REMINDER_CONFIG,
};
