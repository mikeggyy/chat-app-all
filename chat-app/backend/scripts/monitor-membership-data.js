/**
 * 會員數據監控腳本
 * 檢查 Firestore 中的付費會員數據是否存在不一致問題
 *
 * 檢查項目：
 * 1. 付費會員（vip/vvip）缺少 membershipExpiresAt
 * 2. 付費會員的 membershipExpiresAt 格式無效
 * 3. 付費會員已過期但 membershipStatus 未更新
 * 4. 付費會員的 membershipTier 與實際權益不符
 *
 * 使用方法：
 * node scripts/monitor-membership-data.js [--fix-dry-run]
 *
 * 選項：
 * --fix-dry-run: 模擬修復，不實際寫入資料庫
 */

import { getFirestoreDb } from '../src/firebase/index.js';
import logger from '../src/utils/logger.js';
import fs from 'fs';

// 是否為 Dry Run 模式（僅檢查，不修復）
const isDryRun = process.argv.includes('--fix-dry-run');

/**
 * 檢查付費會員數據一致性
 */
async function monitorMembershipData() {
  console.log('\n========================================');
  console.log('🔍 會員數據一致性檢查');
  console.log('========================================\n');

  if (isDryRun) {
    console.log('⚠️ 模擬模式：只檢查不修復\n');
  }

  const db = getFirestoreDb();
  const issues = {
    missingExpiresAt: [],      // 缺少到期時間
    invalidDateFormat: [],      // 無效的日期格式
    expiredNotUpdated: [],      // 已過期但狀態未更新
    inconsistentTier: [],       // 等級不一致
  };

  try {
    // 查詢所有付費會員（vip 和 vvip）
    console.log('📊 正在查詢付費會員數據...\n');

    const vipSnapshot = await db.collection('users')
      .where('membershipTier', '==', 'vip')
      .get();

    const vvipSnapshot = await db.collection('users')
      .where('membershipTier', '==', 'vvip')
      .get();

    const allPaidUsers = [
      ...vipSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      ...vvipSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    ];

    console.log(`✅ 找到 ${allPaidUsers.length} 個付費會員（VIP: ${vipSnapshot.size}, VVIP: ${vvipSnapshot.size}）\n`);

    const now = new Date();

    // 逐一檢查每個付費會員
    for (const user of allPaidUsers) {
      const userId = user.id;
      const tier = user.membershipTier;
      const status = user.membershipStatus;
      const expiresAt = user.membershipExpiresAt;

      // 檢查 1: 缺少到期時間
      if (!expiresAt) {
        issues.missingExpiresAt.push({
          userId,
          tier,
          status,
          issue: '付費會員缺少到期時間',
          severity: 'HIGH',
        });
        continue; // 後續檢查無意義，跳過
      }

      // 檢查 2: 無效的日期格式
      const expiresDate = new Date(expiresAt);
      if (isNaN(expiresDate.getTime())) {
        issues.invalidDateFormat.push({
          userId,
          tier,
          status,
          expiresAt,
          issue: '到期時間格式無效',
          severity: 'HIGH',
        });
        continue; // 無法解析日期，跳過後續檢查
      }

      // 檢查 3: 已過期但狀態未更新
      if (expiresDate <= now) {
        if (status !== 'expired' && status !== 'cancelled') {
          issues.expiredNotUpdated.push({
            userId,
            tier,
            status,
            expiresAt: expiresDate.toISOString(),
            issue: `會員已過期但狀態仍為 "${status}"`,
            severity: 'MEDIUM',
          });
        }
      }

      // 檢查 4: 等級與狀態不一致（付費會員但狀態為 cancelled）
      if (status === 'cancelled' && expiresDate > now) {
        issues.inconsistentTier.push({
          userId,
          tier,
          status,
          expiresAt: expiresDate.toISOString(),
          issue: '會員狀態為 cancelled 但仍在有效期內',
          severity: 'LOW',
        });
      }
    }

    // 輸出檢查結果
    console.log('========================================');
    console.log('📋 檢查結果總結');
    console.log('========================================\n');

    let totalIssues = 0;

    // 1. 缺少到期時間（HIGH）
    if (issues.missingExpiresAt.length > 0) {
      console.log(`❌ [HIGH] 缺少到期時間: ${issues.missingExpiresAt.length} 個會員`);
      issues.missingExpiresAt.forEach(issue => {
        console.log(`   - userId: ${issue.userId}, tier: ${issue.tier}, status: ${issue.status}`);
      });
      console.log('');
      totalIssues += issues.missingExpiresAt.length;
    } else {
      console.log('✅ [HIGH] 缺少到期時間: 0 個會員\n');
    }

    // 2. 無效的日期格式（HIGH）
    if (issues.invalidDateFormat.length > 0) {
      console.log(`❌ [HIGH] 無效的日期格式: ${issues.invalidDateFormat.length} 個會員`);
      issues.invalidDateFormat.forEach(issue => {
        console.log(`   - userId: ${issue.userId}, tier: ${issue.tier}, expiresAt: ${issue.expiresAt}`);
      });
      console.log('');
      totalIssues += issues.invalidDateFormat.length;
    } else {
      console.log('✅ [HIGH] 無效的日期格式: 0 個會員\n');
    }

    // 3. 已過期但狀態未更新（MEDIUM）
    if (issues.expiredNotUpdated.length > 0) {
      console.log(`⚠️ [MEDIUM] 已過期但狀態未更新: ${issues.expiredNotUpdated.length} 個會員`);
      issues.expiredNotUpdated.forEach(issue => {
        console.log(`   - userId: ${issue.userId}, tier: ${issue.tier}, status: ${issue.status}, expiresAt: ${issue.expiresAt}`);
      });
      console.log('');
      totalIssues += issues.expiredNotUpdated.length;
    } else {
      console.log('✅ [MEDIUM] 已過期但狀態未更新: 0 個會員\n');
    }

    // 4. 等級與狀態不一致（LOW）
    if (issues.inconsistentTier.length > 0) {
      console.log(`ℹ️ [LOW] 等級與狀態不一致: ${issues.inconsistentTier.length} 個會員`);
      issues.inconsistentTier.forEach(issue => {
        console.log(`   - userId: ${issue.userId}, tier: ${issue.tier}, status: ${issue.status}, expiresAt: ${issue.expiresAt}`);
      });
      console.log('');
      totalIssues += issues.inconsistentTier.length;
    } else {
      console.log('✅ [LOW] 等級與狀態不一致: 0 個會員\n');
    }

    // 總結
    console.log('========================================');
    if (totalIssues === 0) {
      console.log('🎉 所有會員數據一致，未發現問題！');
    } else {
      console.log(`⚠️ 總計發現 ${totalIssues} 個問題`);
      console.log('\n建議：');
      console.log('1. 執行數據清理腳本修復這些問題');
      console.log('   node scripts/cleanup-membership-data.js --fix');
      console.log('2. 或先模擬修復查看影響');
      console.log('   node scripts/cleanup-membership-data.js --fix-dry-run');
    }
    console.log('========================================\n');

    // 導出詳細報告（JSON 格式）
    const report = {
      timestamp: new Date().toISOString(),
      totalPaidUsers: allPaidUsers.length,
      totalIssues,
      issues,
    };

    // 寫入報告文件
    const reportPath = './membership-data-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 詳細報告已保存至: ${reportPath}\n`);

    process.exit(totalIssues === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ 檢查失敗:', error);
    logger.error('[會員數據監控] 檢查失敗', error);
    process.exit(1);
  }
}

// 執行監控
monitorMembershipData().catch(error => {
  console.error('監控執行失敗:', error);
  process.exit(1);
});
