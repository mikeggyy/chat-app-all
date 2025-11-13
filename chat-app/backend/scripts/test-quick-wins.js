/**
 * Quick Wins 測試腳本
 * 測試所有 Quick Wins 修復的功能
 *
 * 使用方法：
 * node scripts/test-quick-wins.js
 */

import { getUserById } from '../src/user/user.service.js';
import { upgradeMembership, clearMembershipConfigCache } from '../src/membership/membership.service.js';
import { getTicketBalance, TICKET_TYPES } from '../src/membership/unlockTickets.service.js';
import { getFirestoreDb } from '../src/firebase/index.js';
import { isTestAccount } from '../../../shared/config/testAccounts.js';
import logger from '../src/utils/logger.js';

// 測試用戶 ID（從環境變量讀取，或自動查找測試帳號）
const TEST_USER_ID = process.env.TEST_USER_ID || null;

/**
 * 自動查找測試帳號
 */
async function findTestAccount() {
  if (TEST_USER_ID) {
    console.log(`✅ 使用指定的測試用戶 ID: ${TEST_USER_ID}`);
    return TEST_USER_ID;
  }

  console.log('🔍 未指定測試用戶 ID，嘗試自動查找測試帳號...');

  const db = getFirestoreDb();
  const usersSnapshot = await db.collection('users').limit(100).get();

  for (const doc of usersSnapshot.docs) {
    const userId = doc.id;
    if (isTestAccount(userId)) {
      console.log(`✅ 找到測試帳號: ${userId}`);
      return userId;
    }
  }

  console.log('⚠️ 未找到測試帳號，使用第一個用戶（如果存在）');
  if (usersSnapshot.docs.length > 0) {
    const firstUserId = usersSnapshot.docs[0].id;
    console.log(`✅ 使用用戶: ${firstUserId}`);
    return firstUserId;
  }

  throw new Error('❌ 找不到任何用戶，無法執行測試');
}

/**
 * 測試 1: 會員升級防重複檢查
 */
async function testDuplicateUpgradeProtection(userId) {
  console.log('\n========================================');
  console.log('測試 1: 會員升級防重複檢查');
  console.log('========================================\n');

  try {
    // 第一次升級（應該成功）
    console.log('嘗試第一次升級到 VIP...');
    const result1 = await upgradeMembership(userId, 'vip', { durationMonths: 1 });
    console.log('✅ 第一次升級成功:', result1.tier);

    // 立即第二次升級（應該失敗）
    console.log('\n嘗試立即第二次升級到 VIP（應該被拒絕）...');
    try {
      await upgradeMembership(userId, 'vip', { durationMonths: 1 });
      console.log('❌ 測試失敗：第二次升級應該被拒絕');
      return false;
    } catch (error) {
      if (error.message.includes('每天最多升級一次')) {
        console.log('✅ 測試通過：重複升級被正確拒絕');
        return true;
      } else {
        console.log('❌ 測試失敗：錯誤訊息不符合預期');
        console.log('   實際錯誤:', error.message);
        return false;
      }
    }
  } catch (error) {
    console.log('❌ 測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試 2: 統一卡片數據讀取
 */
async function testUnifiedCardReading(userId) {
  console.log('\n========================================');
  console.log('測試 2: 統一卡片數據讀取');
  console.log('========================================\n');

  try {
    // 獲取用戶資料
    const user = await getUserById(userId);
    if (!user) {
      console.log('❌ 測試失敗：找不到測試用戶');
      return false;
    }

    // 檢查卡片數據位置
    console.log('檢查卡片數據位置...');
    console.log('user.assets.characterUnlockCards:', user.assets?.characterUnlockCards || 0);
    console.log('user.assets.photoUnlockCards:', user.assets?.photoUnlockCards || 0);
    console.log('user.assets.videoUnlockCards:', user.assets?.videoUnlockCards || 0);

    // 使用 getTicketBalance 讀取（應該從 assets 讀取）
    console.log('\n使用 getTicketBalance 讀取...');
    const characterBalance = await getTicketBalance(userId, TICKET_TYPES.CHARACTER);
    const photoBalance = await getTicketBalance(userId, TICKET_TYPES.PHOTO);
    const videoBalance = await getTicketBalance(userId, TICKET_TYPES.VIDEO);

    console.log('characterUnlockCards:', characterBalance.balance);
    console.log('photoUnlockCards:', photoBalance.balance);
    console.log('videoUnlockCards:', videoBalance.balance);

    // 驗證一致性
    const isConsistent =
      characterBalance.balance === (user.assets?.characterUnlockCards || 0) &&
      photoBalance.balance === (user.assets?.photoUnlockCards || 0) &&
      videoBalance.balance === (user.assets?.videoUnlockCards || 0);

    if (isConsistent) {
      console.log('\n✅ 測試通過：卡片數據讀取一致');
      return true;
    } else {
      console.log('\n❌ 測試失敗：卡片數據讀取不一致');
      return false;
    }
  } catch (error) {
    console.log('❌ 測試失敗:', error.message);
    return false;
  }
}

/**
 * 測試 3: 會員配置緩存清除
 */
async function testCacheClear() {
  console.log('\n========================================');
  console.log('測試 3: 會員配置緩存清除');
  console.log('========================================\n');

  try {
    // 清除所有緩存
    console.log('清除所有會員配置緩存...');
    clearMembershipConfigCache();
    console.log('✅ 清除成功（無錯誤拋出）');

    // 清除特定 tier
    console.log('\n清除 VIP 等級緩存...');
    clearMembershipConfigCache('vip');
    console.log('✅ 清除成功（無錯誤拋出）');

    console.log('\n✅ 測試通過：緩存清除功能正常');
    return true;
  } catch (error) {
    console.log('❌ 測試失敗:', error.message);
    return false;
  }
}

/**
 * 主測試函數
 */
async function runAllTests() {
  console.log('\n🧪 開始執行 Quick Wins 測試');

  // 自動查找測試帳號
  let testUserId;
  try {
    testUserId = await findTestAccount();
  } catch (error) {
    console.error('❌ 無法找到測試用戶:', error.message);
    process.exit(1);
  }

  console.log('測試用戶 ID:', testUserId);

  const results = {
    duplicateUpgrade: false,
    unifiedCardReading: false,
    cacheClear: false,
  };

  // 執行測試（傳入 testUserId）
  results.duplicateUpgrade = await testDuplicateUpgradeProtection(testUserId);
  results.unifiedCardReading = await testUnifiedCardReading(testUserId);
  results.cacheClear = await testCacheClear();

  // 統計結果
  console.log('\n========================================');
  console.log('測試結果總結');
  console.log('========================================\n');

  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;

  console.log(`測試 1 - 會員升級防重複: ${results.duplicateUpgrade ? '✅ 通過' : '❌ 失敗'}`);
  console.log(`測試 2 - 統一卡片數據讀取: ${results.unifiedCardReading ? '✅ 通過' : '❌ 失敗'}`);
  console.log(`測試 3 - 緩存清除功能: ${results.cacheClear ? '✅ 通過' : '❌ 失敗'}`);

  console.log(`\n總計: ${passed}/${total} 測試通過`);

  if (passed === total) {
    console.log('\n🎉 所有測試通過！');
  } else {
    console.log('\n⚠️ 部分測試失敗，請檢查錯誤訊息');
  }

  process.exit(passed === total ? 0 : 1);
}

// 執行測試
runAllTests().catch(error => {
  console.error('測試執行失敗:', error);
  process.exit(1);
});
