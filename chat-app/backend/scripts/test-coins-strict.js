/**
 * 🔥 金幣系統嚴格測試
 *
 * 這是一個真正嚴格的測試套件,專門測試:
 * 1. 並發購買場景 - 多個請求同時執行
 * 2. Transaction 原子性 - 失敗時完全回滾
 * 3. 數據一致性 - 餘額 vs 交易記錄
 * 4. 邊界條件 - 餘額剛好、不足等
 * 5. 冪等性 - 重複請求處理
 *
 * ⚠️ 這個測試會真正發現問題!
 */

// 載入環境變數 (必須在其他 import 之前)
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { getFirestoreDb, FieldValue } from '../src/firebase/index.js';
import { purchaseUnlimitedChat } from '../src/payment/coins.service.js';

const db = getFirestoreDb();

// 測試用戶 ID
const TEST_USER_PREFIX = 'test-coins-strict-';

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${'='.repeat(70)}`);
  log(`📋 測試: ${name}`, 'cyan');
  console.log('='.repeat(70));
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

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// 創建測試用戶
async function createTestUser(userId, initialCoins = 0) {
  const userRef = db.collection('users').doc(userId);
  await userRef.set({
    uid: userId,
    email: `${userId}@example.com`,
    displayName: '測試用戶',
    membershipTier: 'free',
    membershipStatus: 'none',
    wallet: {
      balance: initialCoins,
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

  logInfo(`創建測試用戶: ${userId}, 初始金幣: ${initialCoins}`);
}

// 清理測試用戶
async function cleanupTestUser(userId) {
  await db.collection('users').doc(userId).delete();
  await db.collection('usage_limits').doc(userId).delete();

  // 清理 transactions
  const txSnapshot = await db
    .collection('transactions')
    .where('userId', '==', userId)
    .get();

  const batch = db.batch();
  txSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

// 獲取用戶數據
async function getUserData(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  const limitsDoc = await db.collection('usage_limits').doc(userId).get();

  return {
    user: userDoc.data(),
    limits: limitsDoc.exists ? limitsDoc.data() : null,
  };
}

// 獲取交易記錄
async function getTransactions(userId) {
  const snapshot = await db
    .collection('transactions')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// 計算交易總額
function calculateTransactionSum(transactions) {
  return transactions.reduce((sum, tx) => {
    if (tx.type === 'spend') {
      return sum - tx.amount;
    } else if (tx.type === 'earn') {
      return sum + tx.amount;
    }
    return sum;
  }, 0);
}

// ============================================================================
// 測試 1: 並發購買測試 (多個用戶同時購買)
// ============================================================================
async function testConcurrentPurchaseMultipleUsers() {
  logTest('測試 1: 並發購買測試 (5 個用戶同時購買)');

  const userIds = [];
  const TEST_COUNT = 5;

  try {
    // 創建 5 個測試用戶,每個 500 金幣
    logInfo(`創建 ${TEST_COUNT} 個測試用戶,每個 500 金幣`);
    for (let i = 0; i < TEST_COUNT; i++) {
      const userId = `${TEST_USER_PREFIX}concurrent-${i}-${Date.now()}`;
      userIds.push(userId);
      await createTestUser(userId, 500);
    }

    // 同時發起購買 (300 金幣購買角色解鎖)
    logInfo('同時發起 5 個購買請求...');
    const characterId = 'test-character-001';

    const startTime = Date.now();
    const promises = userIds.map(userId =>
      purchaseUnlimitedChat(userId, characterId)
        .then(result => ({ userId, success: true, result }))
        .catch(error => ({ userId, success: false, error: error.message }))
    );

    const results = await Promise.all(promises);
    const elapsed = Date.now() - startTime;

    logInfo(`所有購買完成,耗時: ${elapsed}ms`);

    // 驗證結果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logInfo(`成功: ${successCount}, 失敗: ${failCount}`);

    if (successCount === TEST_COUNT) {
      logSuccess('所有用戶購買成功');
    } else {
      logError(`有 ${failCount} 個用戶購買失敗`);
      return false;
    }

    // 驗證每個用戶的數據一致性
    logInfo('驗證數據一致性...');
    let allValid = true;

    for (const userId of userIds) {
      const data = await getUserData(userId);
      const transactions = await getTransactions(userId);

      // 驗證餘額 (500 - 300 = 200)
      if (data.user.wallet.balance !== 200) {
        logError(`${userId}: 餘額錯誤,期望 200,實際 ${data.user.wallet.balance}`);
        allValid = false;
      }

      // 驗證交易記錄
      if (transactions.length !== 1) {
        logError(`${userId}: 交易記錄數量錯誤,期望 1,實際 ${transactions.length}`);
        allValid = false;
      } else {
        const tx = transactions[0];
        if (tx.amount !== 300 || tx.type !== 'spend') {
          logError(`${userId}: 交易記錄內容錯誤: ${JSON.stringify(tx)}`);
          allValid = false;
        }
      }

      // 驗證角色解鎖
      if (!data.limits?.conversation?.[characterId]?.permanentUnlock) {
        logError(`${userId}: 角色未解鎖`);
        allValid = false;
      }
    }

    if (allValid) {
      logSuccess('所有用戶數據一致性驗證通過');
      return true;
    } else {
      logError('數據一致性驗證失敗');
      return false;
    }

  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    // 清理所有測試用戶
    for (const userId of userIds) {
      await cleanupTestUser(userId);
    }
  }
}

// ============================================================================
// 測試 2: 並發購買測試 (同一用戶購買多個角色)
// ============================================================================
async function testConcurrentPurchaseSameUser() {
  logTest('測試 2: 同一用戶並發購買多個角色');

  const userId = `${TEST_USER_PREFIX}same-user-${Date.now()}`;

  try {
    // 創建用戶,1000 金幣
    await createTestUser(userId, 1000);

    // 同時購買 3 個不同角色 (每個 300 金幣)
    logInfo('同時購買 3 個不同角色...');
    const characterIds = ['char-001', 'char-002', 'char-003'];

    const startTime = Date.now();
    const promises = characterIds.map(characterId =>
      purchaseUnlimitedChat(userId, characterId)
        .then(result => ({ characterId, success: true, result }))
        .catch(error => ({ characterId, success: false, error: error.message }))
    );

    const results = await Promise.all(promises);
    const elapsed = Date.now() - startTime;

    logInfo(`所有購買完成,耗時: ${elapsed}ms`);

    // 驗證結果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logInfo(`成功: ${successCount}, 失敗: ${failCount}`);

    if (successCount === 3) {
      logSuccess('3 個角色都購買成功');
    } else if (successCount === 0) {
      logError('所有購買都失敗');
      return false;
    } else {
      logWarning(`部分成功: ${successCount}/3`);
    }

    // 驗證餘額
    const data = await getUserData(userId);
    const expectedBalance = 1000 - (successCount * 300);

    if (data.user.wallet.balance === expectedBalance) {
      logSuccess(`餘額正確: ${data.user.wallet.balance} (扣除 ${successCount * 300})`);
    } else {
      logError(`餘額錯誤: 期望 ${expectedBalance},實際 ${data.user.wallet.balance}`);
      return false;
    }

    // 驗證交易記錄數量
    const transactions = await getTransactions(userId);
    if (transactions.length === successCount) {
      logSuccess(`交易記錄數量正確: ${transactions.length}`);
    } else {
      logError(`交易記錄數量錯誤: 期望 ${successCount},實際 ${transactions.length}`);
      return false;
    }

    // 驗證解鎖狀態
    let unlockedCount = 0;
    for (const characterId of characterIds) {
      if (data.limits?.conversation?.[characterId]?.permanentUnlock) {
        unlockedCount++;
      }
    }

    if (unlockedCount === successCount) {
      logSuccess(`解鎖狀態正確: ${unlockedCount} 個角色已解鎖`);
      return true;
    } else {
      logError(`解鎖狀態錯誤: 期望 ${successCount},實際 ${unlockedCount}`);
      return false;
    }

  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser(userId);
  }
}

// ============================================================================
// 測試 3: 並發購買同一角色 (應該只成功一次)
// ============================================================================
async function testConcurrentPurchaseSameCharacter() {
  logTest('測試 3: 並發購買同一角色 (應該只成功一次)');

  const userId = `${TEST_USER_PREFIX}same-char-${Date.now()}`;

  try {
    // 創建用戶,1000 金幣
    await createTestUser(userId, 1000);

    // 同時發起 5 個購買同一角色的請求
    logInfo('同時發起 5 個購買同一角色的請求...');
    const characterId = 'test-character-same';

    const startTime = Date.now();
    const promises = Array(5).fill(null).map((_, index) =>
      purchaseUnlimitedChat(userId, characterId)
        .then(result => ({ index, success: true, result }))
        .catch(error => ({ index, success: false, error: error.message }))
    );

    const results = await Promise.all(promises);
    const elapsed = Date.now() - startTime;

    logInfo(`所有請求完成,耗時: ${elapsed}ms`);

    // 驗證結果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logInfo(`成功: ${successCount}, 失敗: ${failCount}`);

    // 應該只有 1 個成功,其他 4 個失敗 (已解鎖)
    if (successCount === 1 && failCount === 4) {
      logSuccess('✅ 正確:只有 1 個請求成功,其他 4 個被拒絕');
    } else if (successCount > 1) {
      logError(`❌ 嚴重錯誤:有 ${successCount} 個請求成功!應該只有 1 個`);
      return false;
    } else if (successCount === 0) {
      logError('❌ 所有請求都失敗');
      return false;
    }

    // 驗證餘額 (應該只扣除 300 一次)
    const data = await getUserData(userId);
    if (data.user.wallet.balance === 700) {
      logSuccess('✅ 餘額正確:只扣除 300 (購買一次)');
    } else {
      logError(`❌ 餘額錯誤:期望 700,實際 ${data.user.wallet.balance}`);
      return false;
    }

    // 驗證交易記錄 (應該只有 1 筆)
    const transactions = await getTransactions(userId);
    if (transactions.length === 1) {
      logSuccess('✅ 交易記錄正確:只有 1 筆');
      return true;
    } else {
      logError(`❌ 交易記錄錯誤:期望 1 筆,實際 ${transactions.length} 筆`);

      // 顯示所有交易記錄
      logWarning('交易記錄詳情:');
      transactions.forEach((tx, i) => {
        console.log(`  ${i + 1}. ${tx.type} ${tx.amount} 金幣 - ${tx.createdAt}`);
      });

      return false;
    }

  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser(userId);
  }
}

// ============================================================================
// 測試 4: 邊界條件 - 餘額剛好等於價格
// ============================================================================
async function testExactBalance() {
  logTest('測試 4: 邊界條件 - 餘額剛好等於價格 (300 金幣購買 300)');

  const userId = `${TEST_USER_PREFIX}exact-${Date.now()}`;

  try {
    // 創建用戶,剛好 300 金幣
    await createTestUser(userId, 300);

    logInfo('執行購買 (300 金幣購買角色,價格 300)...');
    const result = await purchaseUnlimitedChat(userId, 'test-character-exact');

    if (result.success) {
      logSuccess('購買成功');
    } else {
      logError('購買失敗');
      return false;
    }

    // 驗證餘額為 0
    const data = await getUserData(userId);
    if (data.user.wallet.balance === 0) {
      logSuccess('✅ 餘額正確:0 (剛好用完)');
      return true;
    } else {
      logError(`❌ 餘額錯誤:期望 0,實際 ${data.user.wallet.balance}`);
      return false;
    }

  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser(userId);
  }
}

// ============================================================================
// 測試 5: 邊界條件 - 餘額不足 1 分錢
// ============================================================================
async function testInsufficientByOne() {
  logTest('測試 5: 邊界條件 - 餘額不足 1 分錢 (299 金幣購買 300)');

  const userId = `${TEST_USER_PREFIX}insufficient-${Date.now()}`;

  try {
    // 創建用戶,只有 299 金幣 (差 1 分錢)
    await createTestUser(userId, 299);

    logInfo('嘗試購買 (299 金幣購買角色,價格 300)...');

    try {
      await purchaseUnlimitedChat(userId, 'test-character-insufficient');
      logError('❌ 應該拋出錯誤,但購買成功了');
      return false;
    } catch (error) {
      if (error.message.includes('金幣不足')) {
        logSuccess(`✅ 正確拋出錯誤: ${error.message}`);

        // 驗證餘額未變化
        const data = await getUserData(userId);
        if (data.user.wallet.balance === 299) {
          logSuccess('✅ 餘額未變化:299 (Transaction 回滾)');
          return true;
        } else {
          logError(`❌ 餘額變化了:${data.user.wallet.balance}`);
          return false;
        }
      } else {
        logError(`❌ 錯誤訊息不正確: ${error.message}`);
        return false;
      }
    }

  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser(userId);
  }
}

// ============================================================================
// 測試 6: 並發導致餘額不足
// ============================================================================
async function testConcurrentCausesInsufficient() {
  logTest('測試 6: 並發導致餘額不足 (500 金幣並發購買 2 個角色,每個 300)');

  const userId = `${TEST_USER_PREFIX}concurrent-insuf-${Date.now()}`;

  try {
    // 創建用戶,500 金幣
    await createTestUser(userId, 500);

    logInfo('同時購買 2 個角色,每個 300 金幣 (總共 600,但只有 500)...');
    const characterIds = ['char-insuf-001', 'char-insuf-002'];

    const startTime = Date.now();
    const promises = characterIds.map(characterId =>
      purchaseUnlimitedChat(userId, characterId)
        .then(result => ({ characterId, success: true, result }))
        .catch(error => ({ characterId, success: false, error: error.message }))
    );

    const results = await Promise.all(promises);
    const elapsed = Date.now() - startTime;

    logInfo(`所有請求完成,耗時: ${elapsed}ms`);

    // 驗證結果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logInfo(`成功: ${successCount}, 失敗: ${failCount}`);

    // 應該只有 1 個成功,1 個失敗 (餘額不足)
    if (successCount === 1 && failCount === 1) {
      logSuccess('✅ 正確:只有 1 個成功,另 1 個因餘額不足失敗');
    } else {
      logWarning(`結果: ${successCount} 成功, ${failCount} 失敗`);
    }

    // 驗證餘額 (500 - 300 = 200)
    const data = await getUserData(userId);
    const expectedBalance = 200;

    if (data.user.wallet.balance === expectedBalance) {
      logSuccess(`✅ 餘額正確: ${data.user.wallet.balance}`);
    } else {
      logError(`❌ 餘額錯誤:期望 ${expectedBalance},實際 ${data.user.wallet.balance}`);
      return false;
    }

    // 驗證交易記錄
    const transactions = await getTransactions(userId);
    if (transactions.length === successCount) {
      logSuccess(`✅ 交易記錄正確: ${transactions.length} 筆`);
      return true;
    } else {
      logError(`❌ 交易記錄錯誤:期望 ${successCount} 筆,實際 ${transactions.length} 筆`);
      return false;
    }

  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser(userId);
  }
}

// ============================================================================
// 測試 7: 數據一致性 - 餘額 vs 交易總和
// ============================================================================
async function testDataConsistency() {
  logTest('測試 7: 數據一致性 - 餘額變化 vs 交易記錄總和');

  const userId = `${TEST_USER_PREFIX}consistency-${Date.now()}`;

  try {
    const initialBalance = 2000;
    await createTestUser(userId, initialBalance);

    // 執行多次購買
    logInfo('執行 5 次購買...');
    const characterIds = ['char-c1', 'char-c2', 'char-c3', 'char-c4', 'char-c5'];

    for (const characterId of characterIds) {
      await purchaseUnlimitedChat(userId, characterId);
    }

    logSuccess('5 次購買完成');

    // 獲取最終數據
    const data = await getUserData(userId);
    const transactions = await getTransactions(userId);

    // 計算交易總額
    const transactionSum = calculateTransactionSum(transactions);

    logInfo(`初始餘額: ${initialBalance}`);
    logInfo(`交易記錄總和: ${transactionSum}`);
    logInfo(`當前餘額: ${data.user.wallet.balance}`);

    // 驗證: 當前餘額 = 初始餘額 + 交易總和
    const expectedBalance = initialBalance + transactionSum;

    if (data.user.wallet.balance === expectedBalance) {
      logSuccess(`✅ 數據一致: ${data.user.wallet.balance} === ${initialBalance} + ${transactionSum}`);
      return true;
    } else {
      logError(`❌ 數據不一致:`);
      logError(`   當前餘額: ${data.user.wallet.balance}`);
      logError(`   期望餘額: ${expectedBalance}`);
      logError(`   差異: ${data.user.wallet.balance - expectedBalance}`);
      return false;
    }

  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser(userId);
  }
}

// ============================================================================
// 測試 8: Transaction balanceBefore/balanceAfter 準確性
// ============================================================================
async function testTransactionBalanceAccuracy() {
  logTest('測試 8: Transaction balanceBefore/balanceAfter 準確性');

  const userId = `${TEST_USER_PREFIX}tx-balance-${Date.now()}`;

  try {
    await createTestUser(userId, 1000);

    // 執行 3 次購買
    logInfo('執行 3 次購買,驗證每筆交易的 before/after 餘額...');
    const characterIds = ['char-tx1', 'char-tx2', 'char-tx3'];

    for (const characterId of characterIds) {
      await purchaseUnlimitedChat(userId, characterId);
    }

    // 獲取交易記錄 (按時間倒序)
    const transactions = await getTransactions(userId);

    logInfo(`共 ${transactions.length} 筆交易記錄`);

    // 驗證每筆交易的 before/after
    let allValid = true;

    for (let i = transactions.length - 1; i >= 0; i--) {
      const tx = transactions[i];
      const expectedAfter = tx.balanceBefore - tx.amount;

      logInfo(`交易 ${transactions.length - i}:`);
      logInfo(`  Before: ${tx.balanceBefore}, After: ${tx.balanceAfter}, Amount: ${tx.amount}`);

      if (tx.balanceAfter === expectedAfter) {
        logSuccess(`  ✅ balanceAfter 正確: ${tx.balanceAfter} === ${tx.balanceBefore} - ${tx.amount}`);
      } else {
        logError(`  ❌ balanceAfter 錯誤:期望 ${expectedAfter},實際 ${tx.balanceAfter}`);
        allValid = false;
      }

      // 驗證鏈式關係 (下一筆的 before 應該等於這筆的 after)
      if (i > 0) {
        const nextTx = transactions[i - 1];
        if (nextTx.balanceBefore === tx.balanceAfter) {
          logSuccess(`  ✅ 與下一筆交易鏈式關係正確`);
        } else {
          logError(`  ❌ 鏈式關係錯誤:下一筆 before=${nextTx.balanceBefore},這筆 after=${tx.balanceAfter}`);
          allValid = false;
        }
      }
    }

    return allValid;

  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
    return false;
  } finally {
    await cleanupTestUser(userId);
  }
}

// ============================================================================
// 執行所有測試
// ============================================================================
async function runAllTests() {
  log('\n' + '='.repeat(70), 'bold');
  log('🔥 金幣系統嚴格測試套件', 'cyan');
  log('='.repeat(70), 'bold');
  log(`測試時間: ${new Date().toLocaleString('zh-TW')}`, 'blue');
  log(`環境: ${process.env.USE_FIREBASE_EMULATOR ? 'Firebase Emulator' : '生產環境 Firestore'}`, 'blue');
  console.log();

  const tests = [
    { name: '測試 1: 並發購買 (多用戶)', fn: testConcurrentPurchaseMultipleUsers },
    { name: '測試 2: 並發購買 (同用戶多角色)', fn: testConcurrentPurchaseSameUser },
    { name: '測試 3: 並發購買同一角色', fn: testConcurrentPurchaseSameCharacter },
    { name: '測試 4: 邊界 - 餘額剛好', fn: testExactBalance },
    { name: '測試 5: 邊界 - 餘額不足 1 分', fn: testInsufficientByOne },
    { name: '測試 6: 並發導致餘額不足', fn: testConcurrentCausesInsufficient },
    { name: '測試 7: 數據一致性檢查', fn: testDataConsistency },
    { name: '測試 8: Transaction 餘額準確性', fn: testTransactionBalanceAccuracy },
  ];

  const results = [];
  const startTime = Date.now();

  for (const test of tests) {
    const testStartTime = Date.now();
    const passed = await test.fn();
    const testElapsed = Date.now() - testStartTime;

    results.push({
      name: test.name,
      passed,
      elapsed: testElapsed
    });

    if (passed) {
      logSuccess(`${test.name} - 通過 (${testElapsed}ms)`);
    } else {
      logError(`${test.name} - 失敗 (${testElapsed}ms)`);
    }
  }

  const totalElapsed = Date.now() - startTime;

  // 輸出測試摘要
  console.log('\n' + '='.repeat(70));
  log('📊 測試摘要', 'cyan');
  console.log('='.repeat(70));

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  results.forEach(r => {
    if (r.passed) {
      logSuccess(`✅ ${r.name} (${r.elapsed}ms)`);
    } else {
      logError(`❌ ${r.name} (${r.elapsed}ms)`);
    }
  });

  console.log('\n' + '='.repeat(70));
  log(`總耗時: ${totalElapsed}ms`, 'blue');

  if (passedCount === totalCount) {
    log(`${colors.bold}${colors.green}🎉 所有測試通過！(${passedCount}/${totalCount})${colors.reset}`, 'green');
    console.log('='.repeat(70) + '\n');
    process.exit(0);
  } else {
    log(`${colors.bold}${colors.red}⚠️  部分測試失敗 (${passedCount}/${totalCount})${colors.reset}`, 'red');
    console.log('='.repeat(70) + '\n');
    process.exit(1);
  }
}

// 執行測試
runAllTests().catch(error => {
  logError(`測試套件執行失敗: ${error.message}`);
  console.error(error);
  process.exit(1);
});
