/**
 * 角色解鎖購買測試腳本
 * 測試使用解鎖票和金幣購買角色的所有場景
 */

// 載入環境變數
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

import { getFirestoreDb } from '../src/firebase/index.js';
import { purchaseUnlimitedChat } from '../src/payment/coins.service.js';

const db = getFirestoreDb();

// 測試用戶 ID 和角色 ID
const TEST_USER_ID = 'test-unlock-user-' + Date.now();
const TEST_CHARACTER_ID = 'test-character-001';

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
async function createTestUser(options = {}) {
  const {
    characterUnlockCards = 0,
    coins = 0,
    hasOldFormat = false, // 是否使用舊格式（unlockTickets.*）
  } = options;

  const userData = {
    uid: TEST_USER_ID,
    email: `test-${TEST_USER_ID}@example.com`,
    displayName: '測試用戶',
    membershipTier: 'free',
    membershipStatus: 'none',
    wallet: {
      balance: coins,
      currency: 'TWD',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 根據格式設置卡片數據
  if (hasOldFormat) {
    // 舊格式：只在 unlockTickets 中
    userData.unlockTickets = {
      characterUnlockCards,
    };
  } else {
    // 新格式：在 assets 中
    userData.assets = {
      characterUnlockCards,
      photoUnlockCards: 0,
      videoUnlockCards: 0,
      createCards: 0,
    };
  }

  const userRef = db.collection('users').doc(TEST_USER_ID);
  await userRef.set(userData);

  log(`創建測試用戶: ${TEST_USER_ID}`, 'blue');
  log(`  - 解鎖卡: ${characterUnlockCards}`, 'blue');
  log(`  - 金幣: ${coins}`, 'blue');
  log(`  - 格式: ${hasOldFormat ? '舊格式 (unlockTickets)' : '新格式 (assets)'}`, 'blue');
}

// 清理測試用戶
async function cleanupTestUser() {
  await db.collection('users').doc(TEST_USER_ID).delete();
  await db.collection('usage_limits').doc(TEST_USER_ID).delete();

  // 清理 transactions
  const txSnapshot = await db
    .collection('transactions')
    .where('userId', '==', TEST_USER_ID)
    .get();

  const batch = db.batch();
  txSnapshot.docs.forEach(doc => batch.delete(doc.ref));
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

// 獲取交易記錄
async function getTransactions() {
  const snapshot = await db
    .collection('transactions')
    .where('userId', '==', TEST_USER_ID)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 測試 1: 使用解鎖票購買角色（新格式）
async function testPurchaseWithTicket() {
  logTest('測試 1: 使用解鎖票購買角色（新格式 assets.*）');

  try {
    await createTestUser({ characterUnlockCards: 5, coins: 0 });

    log('執行購買...', 'blue');
    const result = await purchaseUnlimitedChat(TEST_USER_ID, TEST_CHARACTER_ID);

    // 驗證結果
    if (result.success && result.paymentMethod === 'unlock_ticket') {
      logSuccess('使用解鎖票購買成功');
    } else {
      logError(`購買結果錯誤: ${JSON.stringify(result)}`);
      return false;
    }

    if (result.cost === 0) {
      logSuccess('費用正確為 0（使用解鎖票）');
    } else {
      logError(`費用錯誤: ${result.cost}`);
      return false;
    }

    // 驗證用戶卡片餘額
    const data = await getUserData();
    if (data.user.assets.characterUnlockCards === 4) {
      logSuccess('解鎖卡正確扣除（5 → 4）');
    } else {
      logError(`解鎖卡餘額錯誤: ${data.user.assets.characterUnlockCards}`);
      return false;
    }

    // 驗證向後兼容（unlockTickets 也應該更新）
    if (data.user.unlockTickets?.characterUnlockCards === 4) {
      logSuccess('舊格式也正確更新（向後兼容）');
    } else {
      logWarning('舊格式未更新（可能是預期行為）');
    }

    // 驗證永久解鎖
    if (data.limits?.conversation?.[TEST_CHARACTER_ID]?.permanentUnlock) {
      logSuccess('角色已永久解鎖');
    } else {
      logError('角色未設置永久解鎖');
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

// 測試 2: 使用金幣購買角色
async function testPurchaseWithCoins() {
  logTest('測試 2: 使用金幣購買角色');

  try {
    await createTestUser({ characterUnlockCards: 0, coins: 500 });

    log('執行購買...', 'blue');
    const result = await purchaseUnlimitedChat(TEST_USER_ID, TEST_CHARACTER_ID);

    // 驗證結果
    if (result.success && result.paymentMethod === 'coins') {
      logSuccess('使用金幣購買成功');
    } else {
      logError(`購買結果錯誤: ${JSON.stringify(result)}`);
      return false;
    }

    if (result.cost === 300) {
      logSuccess('費用正確為 300 金幣');
    } else {
      logError(`費用錯誤: ${result.cost}`);
      return false;
    }

    // 驗證用戶金幣餘額
    const data = await getUserData();
    if (data.user.wallet.balance === 200) {
      logSuccess('金幣正確扣除（500 → 200）');
    } else {
      logError(`金幣餘額錯誤: ${data.user.wallet.balance}`);
      return false;
    }

    // 驗證交易記錄
    const transactions = await getTransactions();
    if (transactions.length === 1) {
      const tx = transactions[0];

      if (tx.type === 'spend') {
        logSuccess('交易類型正確: spend');
      } else {
        logError(`交易類型錯誤: ${tx.type}`);
        return false;
      }

      if (tx.amount === 300) {
        logSuccess('交易金額正確: 300（絕對值）');
      } else {
        logError(`交易金額錯誤: ${tx.amount}`);
        return false;
      }

      if (tx.metadata?.itemType === 'character_unlock_ticket') {
        logSuccess('交易元數據正確');
      } else {
        logError(`交易元數據錯誤: ${JSON.stringify(tx.metadata)}`);
        return false;
      }

      if (tx.balanceBefore === 500 && tx.balanceAfter === 200) {
        logSuccess('交易前後餘額記錄正確');
      } else {
        logError(`餘額記錄錯誤: before=${tx.balanceBefore}, after=${tx.balanceAfter}`);
        return false;
      }
    } else {
      logError(`交易記錄數量錯誤: ${transactions.length}`);
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

// 測試 3: 舊格式數據兼容（unlockTickets.*）
async function testOldFormatCompatibility() {
  logTest('測試 3: 舊格式數據兼容（unlockTickets.*）');

  try {
    await createTestUser({ characterUnlockCards: 3, coins: 0, hasOldFormat: true });

    log('執行購買...', 'blue');
    const result = await purchaseUnlimitedChat(TEST_USER_ID, TEST_CHARACTER_ID);

    if (result.success) {
      logSuccess('舊格式數據購買成功');
    } else {
      logError('購買失敗');
      return false;
    }

    // 驗證數據遷移
    const data = await getUserData();

    // 新格式應該被創建
    if (data.user.assets?.characterUnlockCards === 2) {
      logSuccess('新格式（assets）已創建並更新: 2');
    } else {
      logError(`新格式數據錯誤: ${data.user.assets?.characterUnlockCards}`);
      return false;
    }

    // 舊格式應該同步更新
    if (data.user.unlockTickets?.characterUnlockCards === 2) {
      logSuccess('舊格式（unlockTickets）同步更新: 2');
    } else {
      logError(`舊格式數據錯誤: ${data.user.unlockTickets?.characterUnlockCards}`);
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

// 測試 4: 解鎖票不足（應使用金幣）
async function testInsufficientTickets() {
  logTest('測試 4: 解鎖票不足（應拋出錯誤）');

  try {
    await createTestUser({ characterUnlockCards: 0, coins: 500 });

    log('嘗試購買（解鎖票不足，應使用金幣）...', 'blue');
    const result = await purchaseUnlimitedChat(TEST_USER_ID, TEST_CHARACTER_ID);

    if (result.paymentMethod === 'coins') {
      logSuccess('正確使用金幣支付（解鎖票不足時的 fallback）');
      return true;
    } else {
      logError(`支付方式錯誤: ${result.paymentMethod}`);
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

// 測試 5: 金幣不足
async function testInsufficientCoins() {
  logTest('測試 5: 金幣不足（應拋出錯誤）');

  try {
    await createTestUser({ characterUnlockCards: 0, coins: 100 });

    log('嘗試購買（金幣不足）...', 'blue');

    try {
      await purchaseUnlimitedChat(TEST_USER_ID, TEST_CHARACTER_ID);
      logError('應該拋出錯誤，但購買成功了');
      return false;
    } catch (error) {
      if (error.message.includes('金幣不足')) {
        logSuccess(`正確拋出金幣不足錯誤: ${error.message}`);

        // 驗證 Transaction 回滾
        const data = await getUserData();
        if (data.user.wallet.balance === 100) {
          logSuccess('Transaction 正確回滾，金幣未扣除');
        } else {
          logError(`金幣被扣除了: ${data.user.wallet.balance}`);
          return false;
        }

        // 驗證未創建解鎖記錄
        if (!data.limits?.conversation?.[TEST_CHARACTER_ID]?.permanentUnlock) {
          logSuccess('未創建解鎖記錄（Transaction 回滾）');
        } else {
          logError('創建了解鎖記錄（Transaction 未回滾）');
          return false;
        }

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

// 測試 6: 重複購買已解鎖角色
async function testDuplicatePurchase() {
  logTest('測試 6: 重複購買已解鎖角色（應拋出錯誤）');

  try {
    await createTestUser({ characterUnlockCards: 5, coins: 500 });

    // 第一次購買
    log('第一次購買...', 'blue');
    await purchaseUnlimitedChat(TEST_USER_ID, TEST_CHARACTER_ID);
    logSuccess('第一次購買成功');

    // 第二次購買（應該失敗）
    log('第二次購買（應該失敗）...', 'blue');

    try {
      await purchaseUnlimitedChat(TEST_USER_ID, TEST_CHARACTER_ID);
      logError('應該拋出錯誤，但購買成功了');
      return false;
    } catch (error) {
      if (error.message.includes('已永久解鎖')) {
        logSuccess(`正確拋出重複購買錯誤: ${error.message}`);

        // 驗證餘額未扣除
        const data = await getUserData();
        if (data.user.assets.characterUnlockCards === 4) {
          logSuccess('卡片未重複扣除（仍為 4）');
          return true;
        } else {
          logError(`卡片被重複扣除: ${data.user.assets.characterUnlockCards}`);
          return false;
        }
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

// 執行所有測試
async function runAllTests() {
  log('\n🧪 開始執行角色解鎖購買測試套件', 'cyan');
  log(`測試時間: ${new Date().toLocaleString('zh-TW')}`, 'blue');

  const tests = [
    { name: '測試 1', fn: testPurchaseWithTicket },
    { name: '測試 2', fn: testPurchaseWithCoins },
    { name: '測試 3', fn: testOldFormatCompatibility },
    { name: '測試 4', fn: testInsufficientTickets },
    { name: '測試 5', fn: testInsufficientCoins },
    { name: '測試 6', fn: testDuplicatePurchase },
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
