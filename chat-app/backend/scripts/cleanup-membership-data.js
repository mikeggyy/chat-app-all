/**
 * 會員數據清理腳本
 * 修復 Firestore 中的付費會員數據不一致問題
 *
 * 修復邏輯（2025-01-13 優化版）：
 * 1. 付費會員缺少 membershipExpiresAt：設置為 7 天後（⚠️ 保守策略 + 緊急審核標記）
 * 2. 付費會員的 membershipExpiresAt 格式無效：設置為 7 天後（⚠️ 保守策略 + 緊急審核標記）
 * 3. 付費會員已過期但 membershipStatus 未更新：立即降級為 'free'
 * 4. 付費會員狀態為 cancelled 但仍在有效期內：保持不變（正常情況）
 *
 * ⚠️ 關鍵改進：
 * - 默認過期時間從 30 天改為 7 天（更保守，降低損失風險）
 * - 添加緊急審核標記 (_needsUrgentReview)，要求 7 天內完成審核
 * - 已過期會員立即降級為 free（嚴格執行過期政策）
 * - 保存所有原始數據供人工審核參考
 *
 * 使用方法：
 * node scripts/cleanup-membership-data.js [--fix] [--fix-dry-run]
 *
 * 選項：
 * --fix: 實際修復數據（需要明確指定）
 * --fix-dry-run: 模擬修復，不實際寫入資料庫（僅顯示將執行的操作）
 *
 * 安全措施：
 * - 默認僅檢查，不修復（需明確指定 --fix 或 --fix-dry-run）
 * - 所有修復操作會記錄到 audit log
 * - 備份原始數據到 membership_data_backup 集合
 */

import { getFirestoreDb } from '../src/firebase/index.js';
import logger from '../src/utils/logger.js';
import fs from 'fs';

// 解析命令行參數
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const isDryRun = args.includes('--fix-dry-run');

if (!shouldFix && !isDryRun) {
  console.log('❌ 請指定操作模式：');
  console.log('   --fix: 實際修復數據');
  console.log('   --fix-dry-run: 模擬修復（不寫入資料庫）');
  console.log('\n範例：');
  console.log('   node scripts/cleanup-membership-data.js --fix-dry-run');
  console.log('   node scripts/cleanup-membership-data.js --fix');
  process.exit(1);
}

/**
 * 備份用戶數據
 */
async function backupUserData(db, userId, userData) {
  const backupRef = db.collection('membership_data_backup').doc(userId);
  await backupRef.set({
    ...userData,
    backedUpAt: new Date().toISOString(),
    backupReason: 'cleanup-membership-data-script',
  });
  logger.info(`[數據清理] 已備份用戶 ${userId} 的數據`);
}

/**
 * 記錄修復操作到 audit log
 */
async function logFixAction(db, userId, action, before, after) {
  const auditRef = db.collection('audit_logs').doc();
  await auditRef.set({
    timestamp: new Date().toISOString(),
    action: 'membership-data-cleanup',
    userId,
    details: {
      action,
      before,
      after,
    },
    performedBy: 'system-cleanup-script',
  });
  logger.info(`[數據清理] 已記錄操作: userId=${userId}, action=${action}`);
}

/**
 * 修復缺少到期時間的付費會員
 * ⚠️ 修復策略：保守處理，默認 7 天後過期並強制人工審核
 */
async function fixMissingExpiresAt(db, userId, userData, isDryRun) {
  const defaultExpiration = new Date();
  defaultExpiration.setDate(defaultExpiration.getDate() + 7); // ⚠️ 改為 7 天（更保守）

  const updates = {
    membershipExpiresAt: defaultExpiration.toISOString(),
    membershipStatus: 'active',
    // 添加標記，表示需要人工審核
    _needsManualReview: true,
    _needsUrgentReview: true, // 🔴 緊急審核標記
    _autoFixedAt: new Date().toISOString(),
    _autoFixReason: 'missing-expires-at',
    _originalTier: userData.membershipTier, // 保存原始等級供審核
  };

  if (isDryRun) {
    console.log(`   [DRY RUN] 將設置 membershipExpiresAt 為: ${updates.membershipExpiresAt} (7天後)`);
    console.log(`   [DRY RUN] 🔴 標記為緊急審核 (_needsUrgentReview: true)`);
    return;
  }

  // 備份原始數據
  await backupUserData(db, userId, userData);

  // 更新用戶數據
  await db.collection('users').doc(userId).update(updates);

  // 記錄到 audit log
  await logFixAction(db, userId, 'fix-missing-expires-at', {
    membershipExpiresAt: null,
  }, updates);

  console.log(`   ✅ 已設置 membershipExpiresAt 為: ${updates.membershipExpiresAt} (7天後)`);
  console.log(`   🔴 已標記為緊急審核 (_needsUrgentReview: true)`);
  console.log(`   ⚠️ 請在 7 天內完成人工審核並調整到期時間`);
}

/**
 * 修復無效的日期格式
 * ⚠️ 修復策略：保守處理，默認 7 天後過期並強制人工審核
 */
async function fixInvalidDateFormat(db, userId, userData, isDryRun) {
  const defaultExpiration = new Date();
  defaultExpiration.setDate(defaultExpiration.getDate() + 7); // ⚠️ 改為 7 天（更保守）

  const updates = {
    membershipExpiresAt: defaultExpiration.toISOString(),
    _needsManualReview: true,
    _needsUrgentReview: true, // 🔴 緊急審核標記
    _autoFixedAt: new Date().toISOString(),
    _autoFixReason: 'invalid-date-format',
    _originalExpiresAt: userData.membershipExpiresAt, // 保存原始值供審核
    _originalTier: userData.membershipTier, // 保存原始等級供審核
  };

  if (isDryRun) {
    console.log(`   [DRY RUN] 將更正 membershipExpiresAt 為: ${updates.membershipExpiresAt} (7天後)`);
    console.log(`   [DRY RUN] 原始值: ${userData.membershipExpiresAt}`);
    console.log(`   [DRY RUN] 🔴 標記為緊急審核 (_needsUrgentReview: true)`);
    return;
  }

  // 備份原始數據
  await backupUserData(db, userId, userData);

  // 更新用戶數據
  await db.collection('users').doc(userId).update(updates);

  // 記錄到 audit log
  await logFixAction(db, userId, 'fix-invalid-date-format', {
    membershipExpiresAt: userData.membershipExpiresAt,
  }, updates);

  console.log(`   ✅ 已更正 membershipExpiresAt 為: ${updates.membershipExpiresAt} (7天後)`);
  console.log(`   📝 原始值: ${userData.membershipExpiresAt}`);
  console.log(`   🔴 已標記為緊急審核 (_needsUrgentReview: true)`);
  console.log(`   ⚠️ 請在 7 天內完成人工審核並調整到期時間`);
}

/**
 * 修復已過期但狀態未更新的會員
 * ⚠️ 修復策略：立即降級為 free
 */
async function fixExpiredNotUpdated(db, userId, userData, isDryRun) {
  const now = new Date();
  const expiresAt = new Date(userData.membershipExpiresAt);
  const daysSinceExpired = Math.floor((now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24));

  const updates = {
    membershipTier: 'free',
    membershipStatus: 'expired',
    _autoFixedAt: new Date().toISOString(),
    _autoFixReason: 'expired-not-updated',
    _previousTier: userData.membershipTier,
    _daysSinceExpired: daysSinceExpired,
  };

  if (isDryRun) {
    console.log(`   [DRY RUN] 已過期 ${daysSinceExpired} 天：降級為 free 會員`);
    console.log(`   [DRY RUN] 原 tier: ${userData.membershipTier}, 原 status: ${userData.membershipStatus}`);
    return;
  }

  // 備份原始數據
  await backupUserData(db, userId, userData);

  // 更新用戶數據
  await db.collection('users').doc(userId).update(updates);

  // 記錄到 audit log
  await logFixAction(db, userId, 'fix-expired-not-updated', {
    membershipTier: userData.membershipTier,
    membershipStatus: userData.membershipStatus,
  }, updates);

  console.log(`   ✅ 已過期 ${daysSinceExpired} 天：降級為 free 會員`);
}

/**
 * 執行數據清理
 */
async function cleanupMembershipData() {
  console.log('\n========================================');
  console.log('🔧 會員數據清理');
  console.log('========================================\n');

  if (isDryRun) {
    console.log('⚠️ 模擬模式：只顯示操作，不實際修復\n');
  } else if (shouldFix) {
    console.log('✅ 修復模式：將實際修復數據\n');
    console.log('⏳ 等待 3 秒後開始...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  const db = getFirestoreDb();

  try {
    // 讀取監控報告
    const reportPath = './membership-data-report.json';

    if (!fs.existsSync(reportPath)) {
      console.log('❌ 找不到監控報告文件，請先運行監控腳本：');
      console.log('   node scripts/monitor-membership-data.js');
      process.exit(1);
    }

    const reportContent = fs.readFileSync(reportPath, 'utf8');
    const report = JSON.parse(reportContent);

    console.log(`📊 讀取監控報告: ${report.timestamp}`);
    console.log(`   總計 ${report.totalIssues} 個問題需要處理\n`);

    let fixedCount = 0;

    // 1. 修復缺少到期時間
    if (report.issues.missingExpiresAt.length > 0) {
      console.log(`\n🔧 處理缺少到期時間的會員 (${report.issues.missingExpiresAt.length} 個):\n`);
      for (const issue of report.issues.missingExpiresAt) {
        console.log(`處理用戶: ${issue.userId} (${issue.tier})`);
        const userDoc = await db.collection('users').doc(issue.userId).get();
        if (userDoc.exists) {
          await fixMissingExpiresAt(db, issue.userId, userDoc.data(), isDryRun);
          fixedCount++;
        } else {
          console.log(`   ⚠️ 用戶不存在，跳過`);
        }
      }
    }

    // 2. 修復無效的日期格式
    if (report.issues.invalidDateFormat.length > 0) {
      console.log(`\n🔧 處理無效日期格式的會員 (${report.issues.invalidDateFormat.length} 個):\n`);
      for (const issue of report.issues.invalidDateFormat) {
        console.log(`處理用戶: ${issue.userId} (${issue.tier})`);
        const userDoc = await db.collection('users').doc(issue.userId).get();
        if (userDoc.exists) {
          await fixInvalidDateFormat(db, issue.userId, userDoc.data(), isDryRun);
          fixedCount++;
        } else {
          console.log(`   ⚠️ 用戶不存在，跳過`);
        }
      }
    }

    // 3. 修復已過期但狀態未更新
    if (report.issues.expiredNotUpdated.length > 0) {
      console.log(`\n🔧 處理已過期但狀態未更新的會員 (${report.issues.expiredNotUpdated.length} 個):\n`);
      for (const issue of report.issues.expiredNotUpdated) {
        console.log(`處理用戶: ${issue.userId} (${issue.tier}, status: ${issue.status})`);
        const userDoc = await db.collection('users').doc(issue.userId).get();
        if (userDoc.exists) {
          await fixExpiredNotUpdated(db, issue.userId, userDoc.data(), isDryRun);
          fixedCount++;
        } else {
          console.log(`   ⚠️ 用戶不存在，跳過`);
        }
      }
    }

    // 4. 等級與狀態不一致（cancelled 但仍在有效期）- 不需要修復
    if (report.issues.inconsistentTier.length > 0) {
      console.log(`\nℹ️ 狀態為 cancelled 但仍在有效期的會員 (${report.issues.inconsistentTier.length} 個):`);
      console.log('   這是正常情況（用戶取消續訂但保留到期前的權益），不需要修復\n');
    }

    // 總結
    console.log('\n========================================');
    console.log('📋 清理結果總結');
    console.log('========================================\n');

    if (isDryRun) {
      console.log(`✅ 模擬完成，將修復 ${fixedCount} 個問題`);
      console.log('\n下一步：');
      console.log('   確認無誤後，執行實際修復：');
      console.log('   node scripts/cleanup-membership-data.js --fix');
    } else if (shouldFix) {
      console.log(`✅ 已修復 ${fixedCount} 個問題`);
      console.log('\n⚠️ 需要人工審核的用戶：');
      console.log('   查詢 users 集合中 _needsManualReview: true 的用戶');
      console.log('\n📁 備份數據位置：');
      console.log('   Firestore collection: membership_data_backup');
      console.log('\n📄 操作記錄位置：');
      console.log('   Firestore collection: audit_logs');
    }

    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ 清理失敗:', error);
    logger.error('[會員數據清理] 清理失敗', error);
    process.exit(1);
  }
}

// 執行清理
cleanupMembershipData().catch(error => {
  console.error('清理執行失敗:', error);
  process.exit(1);
});
