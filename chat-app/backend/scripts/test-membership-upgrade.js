/**
 * 會員升級測試腳本
 * 測試所有會員升級場景，包括鎖定機制、並發控制等
 */

// 載入環境變數
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

import { getFirestoreDb } from '../src/firebase/index.js';
import { upgradeMembership } from '../src/membership/membership.service.js';
import { FieldValue } from 'firebase-admin/firestore';

const db = getFirestoreDb();

// 測試用戶 ID
const TEST_USER_ID = 'test-membership-user-' + Date.now();

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${'='.repeat(60)}`);
  log(`📋 測試: ${name}`, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// 創建測試用戶
async function createTestUser(tier = 'free', photoCount = 0) {
  const userRef = db.collection('users').doc(TEST_USER_ID);
  await userRef.set({
    uid: TEST_USER_ID,
    email: `test-${TEST_USER_ID}@example.com`,
    displayName: '測試用戶',
    membershipTier: tier,
    membershipStatus: tier === 'free' ? 'none' : 'active',
    wallet: {
      balance: 0,
      currency: 'TWD',
    },
    assets: {
      characterUnlockCards: 0,
      photoUnlockCards: 0,
      videoUnlockCards: 0,
      createCards: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 創建 usage_limits
  if (photoCount > 0) {
    const limitsRef = db.collection('usage_limits').doc(TEST_USER_ID);
    await limitsRef.set({
      photos: {
        count: photoCount,
      },
    });
  }

  log(`創建測試用戶: ${TEST_USER_ID} (${tier}, 拍照次數: ${photoCount})`, 'blue');
}

// 清理測試用戶
async function cleanupTestUser() {
  await db.collection('users').doc(TEST_USER_ID).delete();
  await db.collection('usage_limits').doc(TEST_USER_ID).delete();

  // 清理 membership_history
  const historySnapshot = await db
    .collection('membership_history')
    .where('userId', '==', TEST_USER_ID)
    .get();

  const batch = db.batch();
  historySnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  log(`已清理測試用戶: ${TEST_USER_ID}`, 'blue');
}

// 獲取用戶資料
async function getUserData() {
  const userDoc = await db.collection('users').doc(TEST_USER_ID).get();
  const limitsDoc = await db.collection('usage_limits').doc(TEST_USER_ID).get();

  return {
    user: userDoc.data(),
    limits: limitsDoc.exists ? limitsDoc.data() : null,
  };
}

// 測試 1: 正常升級流程（免費 → VIP）
async function testNormalUpgrade() {
  logTest('測試 1: 正常升級流程（免費 → VIP，新用戶無使用記錄）');

  try {
    await createTestUser('free', 0);

    log('執行升級...', 'blue');
    const result = await upgradeMembership(TEST_USER_ID, 'vip', { durationDays: 30 });

    const data = await getUserData();

    // 驗證結果
    if (result.tier === 'vip') {
      logSuccess('升級成功');
    } else {
      logError(`升級失敗: tier = ${result.tier}`);
      return false;
    }

    // 驗證用戶資料
    if (data.user.membershipTier === 'vip') {
      logSuccess('用戶會員等級已更新為 VIP');
    } else {
      logError(`用戶會員等級錯誤: ${data.user.membershipTier}`);
      return false;
    }

    // 驗證獎勵發放
    if (data.user.assets.characterUnlockCards === 10) {
      logSuccess(`角色解鎖卡發放正確: ${data.user.assets.characterUnlockCards}`);
    } else {
      logError(`角色解鎖卡數量錯誤: ${data.user.assets.characterUnlockCards}`);
      return false;
    }

    // ✅ 新用戶無使用記錄，給予完整的 3 次拍照卡 + VIP 20 張 = 23 張
    if (data.user.assets.photoUnlockCards === 23) {
      logSuccess(`拍照解鎖卡發放正確: ${data.user.assets.photoUnlockCards} (20 VIP獎勵 + 3 完整額度)`);
    } else {
      logError(`拍照解鎖卡數量錯誤: 期望 23，實際 ${data.user.assets.photoUnlockCards}`);
      return false;
    }

    // 驗證鎖定標記已清除
    if (!data.limits?.photos?.upgrading) {
      logSuccess('升級鎖定標記已清除');
    } else {
      logError('升級鎖定標記未清除');
      return false;
    }

    return true;
  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser();
  }
}

// 測試 2: 保留剩餘拍照次數（免費 → VIP）
async function testUpgradeWithRemainingPhotos() {
  logTest('測試 2: 升級時保留剩餘拍照次數（免費 → VIP，已用 1 次）');

  try {
    await createTestUser('free', 1);

    log('執行升級...', 'blue');
    await upgradeMembership(TEST_USER_ID, 'vip', { durationDays: 30 });

    const data = await getUserData();

    // 驗證拍照卡數量（20 張 VIP 獎勵 + 2 張剩餘）
    const expectedPhotoCards = 20 + 2;
    if (data.user.assets.photoUnlockCards === expectedPhotoCards) {
      logSuccess(`拍照解鎖卡數量正確: ${data.user.assets.photoUnlockCards} (20 VIP獎勵 + 2 剩餘)`);
    } else {
      logError(`拍照解鎖卡數量錯誤: 期望 ${expectedPhotoCards}，實際 ${data.user.assets.photoUnlockCards}`);
      return false;
    }

    return true;
  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser();
  }
}

// 測試 3: 防止並發升級（5 分鐘內）
async function testConcurrentUpgradePrevention() {
  logTest('測試 3: 防止並發升級（5 分鐘內重複升級）');

  try {
    await createTestUser('free', 0);

    // 手動設置升級鎖定（模擬進行中的升級）
    const limitsRef = db.collection('usage_limits').doc(TEST_USER_ID);
    await limitsRef.set({
      photos: {
        upgrading: true,
        upgradingAt: new Date().toISOString(),
      },
    });

    // 等待 1 秒（確保時間戳寫入）
    await new Promise(resolve => setTimeout(resolve, 1000));

    log('嘗試重複升級（應該被拒絕）...', 'blue');

    try {
      await upgradeMembership(TEST_USER_ID, 'vip', { durationDays: 30 });
      logError('應該拋出錯誤，但升級成功了');
      return false;
    } catch (error) {
      if (error.message.includes('升級處理中')) {
        logSuccess('正確拒絕了並發升級');
        return true;
      } else {
        logError(`錯誤訊息不正確: ${error.message}`);
        return false;
      }
    }
  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser();
  }
}

// 測試 4: 過期鎖定自動解鎖（5 分鐘後）
async function testExpiredLockAutoUnlock() {
  logTest('測試 4: 過期鎖定自動解鎖（模擬 6 分鐘前的鎖定）');

  try {
    await createTestUser('free', 0);

    // 手動設置過期的升級鎖定（6 分鐘前）
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const limitsRef = db.collection('usage_limits').doc(TEST_USER_ID);
    await limitsRef.set({
      photos: {
        upgrading: true,
        upgradingAt: sixMinutesAgo,
      },
    });

    log('嘗試升級（應該自動解鎖並成功）...', 'blue');

    const result = await upgradeMembership(TEST_USER_ID, 'vip', { durationDays: 30 });

    if (result.tier === 'vip') {
      logSuccess('過期鎖定已自動解鎖，升級成功');

      const data = await getUserData();
      if (!data.limits?.photos?.upgrading) {
        logSuccess('鎖定標記已清除');
        return true;
      } else {
        logError('鎖定標記未清除');
        return false;
      }
    } else {
      logError('升級失敗');
      return false;
    }
  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser();
  }
}

// 測試 5: 舊數據兼容（無時間戳的鎖定）
async function testOldDataCompatibility() {
  logTest('測試 5: 舊數據兼容（無時間戳的鎖定標記）');

  try {
    await createTestUser('free', 0);

    // 手動設置無時間戳的升級鎖定（模擬舊數據）
    const limitsRef = db.collection('usage_limits').doc(TEST_USER_ID);
    await limitsRef.set({
      photos: {
        upgrading: true,
        // 故意不設置 upgradingAt
      },
    });

    log('嘗試升級（應該強制解鎖並成功）...', 'blue');

    const result = await upgradeMembership(TEST_USER_ID, 'vip', { durationDays: 30 });

    if (result.tier === 'vip') {
      logSuccess('舊數據已自動處理，升級成功');
      return true;
    } else {
      logError('升級失敗');
      return false;
    }
  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser();
  }
}

// 執行所有測試
async function runAllTests() {
  log('\n🧪 開始執行會員升級測試套件', 'cyan');
  log(`測試時間: ${new Date().toLocaleString('zh-TW')}`, 'blue');

  const tests = [
    { name: '測試 1', fn: testNormalUpgrade },
    { name: '測試 2', fn: testUpgradeWithRemainingPhotos },
    { name: '測試 3', fn: testConcurrentUpgradePrevention },
    { name: '測試 4', fn: testExpiredLockAutoUnlock },
    { name: '測試 5', fn: testOldDataCompatibility },
  ];

  const results = [];

  for (const test of tests) {
    const passed = await test.fn();
    results.push({ name: test.name, passed });
  }

  // 輸出測試摘要
  console.log('\n' + '='.repeat(60));
  log('📊 測試摘要', 'cyan');
  console.log('='.repeat(60));

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  results.forEach(r => {
    if (r.passed) {
      logSuccess(`${r.name}: 通過`);
    } else {
      logError(`${r.name}: 失敗`);
    }
  });

  console.log('\n' + '='.repeat(60));
  if (passedCount === totalCount) {
    logSuccess(`✨ 所有測試通過！(${passedCount}/${totalCount})`);
  } else {
    logError(`⚠️  部分測試失敗 (${passedCount}/${totalCount})`);
  }
  console.log('='.repeat(60) + '\n');

  process.exit(passedCount === totalCount ? 0 : 1);
}

// 執行測試
runAllTests().catch(error => {
  logError(`測試執行失敗: ${error.message}`);
  console.error(error);
  process.exit(1);
});
