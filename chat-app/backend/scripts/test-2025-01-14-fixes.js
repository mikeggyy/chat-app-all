/**
 * 2025-01-14 商業邏輯修復測試腳本
 *
 * 測試項目：
 * 1. 退款系統的資產驗證（防止先用後退）
 * 2. 會員升級鎖定時間（30秒）
 * 3. 廣告解鎖重置邏輯（24小時滾動窗口）
 * 4. 藥水使用併發保護
 * 5. 已解鎖角色快速查詢
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

import { refundPurchase } from '../src/payment/coins.service.js';
import { upgradeMembership } from '../src/membership/membership.service.js';
import { unlockByAd, checkCanUse } from '../src/services/limitService/limitTracking.js';
import { useMemoryBoost, useBrainBoost } from '../src/payment/potion.service.js';
import { getUserUnlockedCharacters, checkCharacterUnlocked } from '../src/membership/unlockTickets.service.js';
import { getFirestoreDb } from '../src/firebase/index.js';
import { FieldValue } from 'firebase-admin/firestore';

const db = getFirestoreDb();

// 測試配置
const TEST_USER_ID = 'test-business-logic-user-2025-01-14';
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

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  test: (msg) => console.log(`${colors.cyan}▶${colors.reset} ${msg}`),
};

/**
 * 測試結果統計
 */
let testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
};

/**
 * 斷言函數
 */
function assert(condition, message) {
  testStats.total++;
  if (condition) {
    testStats.passed++;
    log.success(message);
    return true;
  } else {
    testStats.failed++;
    log.error(message);
    testStats.errors.push(message);
    return false;
  }
}

/**
 * 設置測試環境
 */
async function setupTestEnvironment() {
  log.info('設置測試環境...');

  const userRef = db.collection('users').doc(TEST_USER_ID);
  const limitRef = db.collection('usage_limits').doc(TEST_USER_ID);

  await userRef.set({
    userId: TEST_USER_ID,
    displayName: '測試用戶',
    email: 'test@example.com',
    membershipTier: 'free',
    walletBalance: 10000,
    wallet: { balance: 10000, currency: 'TWD' },
    coins: 10000,
    assets: {
      characterUnlockCards: 5,
      photoUnlockCards: 10,
      videoUnlockCards: 3,
    },
    unlockedCharacters: {},
    createdAt: new Date().toISOString(),
  });

  await limitRef.set({
    userId: TEST_USER_ID,
    potionInventory: {
      memoryBoost: 5,
      brainBoost: 5,
    },
    activePotionEffects: {},
    conversation: {},
    photos: {
      count: 0,
      upgrading: false,
    },
  });

  log.success('測試環境設置完成');
}

/**
 * 清理測試環境
 */
async function cleanupTestEnvironment() {
  log.info('清理測試環境...');

  await db.collection('users').doc(TEST_USER_ID).delete();
  await db.collection('usage_limits').doc(TEST_USER_ID).delete();

  // 清理測試交易記錄
  const transactionsSnapshot = await db
    .collection('transactions')
    .where('userId', '==', TEST_USER_ID)
    .get();

  const batch = db.batch();
  transactionsSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  log.success('測試環境清理完成');
}

/**
 * 測試 1: 退款系統的資產驗證
 */
async function test1_RefundAssetValidation() {
  log.test('=== 測試 1: 退款系統的資產驗證 ===');

  try {
    const userRef = db.collection('users').doc(TEST_USER_ID);

    // 1.1 測試：資產未使用，應全額退款
    const txRef1 = db.collection('transactions').doc();
    await txRef1.set({
      id: txRef1.id,
      userId: TEST_USER_ID,
      type: 'purchase',
      amount: 500,
      description: '測試購買 5 張拍照卡',
      metadata: {
        assetType: 'photoUnlockCards',
        quantity: 5,
        itemType: 'photo_unlock_card',
      },
      balanceBefore: 10000,
      balanceAfter: 9500,
      status: 'completed',
      createdAt: new Date().toISOString(),
    });

    log.info('測試 1.1: 資產未使用情況');
    const result1 = await refundPurchase(TEST_USER_ID, txRef1.id, '測試退款 - 未使用');
    assert(
      result1.success && result1.refundAmount === 500 && !result1.isPartialRefund,
      '✓ 未使用資產應全額退款 (500 金幣)'
    );

    // 1.2 測試：部分使用，應部分退款
    const txRef2 = db.collection('transactions').doc();
    await txRef2.set({
      id: txRef2.id,
      userId: TEST_USER_ID,
      type: 'purchase',
      amount: 1000,
      description: '測試購買 10 張視頻卡',
      metadata: {
        assetType: 'videoUnlockCards',
        quantity: 10,
        itemType: 'video_unlock_card',
      },
      balanceBefore: 10000,
      balanceAfter: 9000,
      status: 'completed',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48小時前
    });

    // 模擬使用了 7 張視頻卡（剩餘 3 張）
    await userRef.update({ 'assets.videoUnlockCards': 3 });

    log.info('測試 1.2: 部分資產已使用（10 → 3）');
    const result2 = await refundPurchase(TEST_USER_ID, txRef2.id, '測試退款 - 部分使用');
    assert(
      result2.success && result2.isPartialRefund && result2.refundAmount === 300,
      `✓ 部分退款金額為 300（已使用價值: ${result2.usedAssetValue}）`
    );

    // 1.3 測試：完全使用，應拒絕退款
    const txRef3 = db.collection('transactions').doc();
    await txRef3.set({
      id: txRef3.id,
      userId: TEST_USER_ID,
      type: 'purchase',
      amount: 500,
      description: '測試購買 5 張角色解鎖卡',
      metadata: {
        assetType: 'characterUnlockCards',
        quantity: 5,
        itemType: 'character_unlock_card',
      },
      balanceBefore: 10000,
      balanceAfter: 9500,
      status: 'completed',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    });

    await userRef.update({ 'assets.characterUnlockCards': 0 });

    log.info('測試 1.3: 資產已完全使用（5 → 0）');
    let refundRejected = false;
    try {
      await refundPurchase(TEST_USER_ID, txRef3.id, '測試退款 - 完全使用');
    } catch (error) {
      refundRejected = error.message.includes('已完全使用');
    }
    assert(refundRejected, '✓ 完全使用資產應拒絕退款');

    // 1.4 測試：24小時冷靜期內全額退款
    const txRef4 = db.collection('transactions').doc();
    await txRef4.set({
      id: txRef4.id,
      userId: TEST_USER_ID,
      type: 'purchase',
      amount: 300,
      description: '測試購買 3 張語音卡',
      metadata: {
        assetType: 'voiceUnlockCards',
        quantity: 3,
        itemType: 'voice_unlock_card',
      },
      balanceBefore: 10000,
      balanceAfter: 9700,
      status: 'completed',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12小時前
    });

    await userRef.update({ 'assets.voiceUnlockCards': 0 });

    log.info('測試 1.4: 冷靜期內完全使用');
    const result4 = await refundPurchase(TEST_USER_ID, txRef4.id, '測試退款 - 冷靜期');
    assert(
      result4.success && result4.refundAmount === 300 && !result4.isPartialRefund,
      '✓ 24小時冷靜期內應全額退款（即使已使用）'
    );

  } catch (error) {
    log.error(`測試 1 失敗: ${error.message}`);
    testStats.errors.push(`測試 1: ${error.message}`);
  }
}

/**
 * 測試 2: 會員升級鎖定時間
 */
async function test2_MembershipUpgradeLockTimeout() {
  log.test('=== 測試 2: 會員升級鎖定時間（30秒） ===');

  try {
    const limitRef = db.collection('usage_limits').doc(TEST_USER_ID);

    // 2.1 測試：10秒內拒絕重複升級
    await limitRef.set(
      {
        photos: {
          upgrading: true,
          upgradingAt: new Date(Date.now() - 10 * 1000).toISOString(),
        },
      },
      { merge: true }
    );

    log.info('測試 2.1: 設置升級鎖定（10秒前）');
    let upgradeLocked = false;
    try {
      await upgradeMembership(TEST_USER_ID, 'vip', { durationMonths: 1 });
    } catch (error) {
      upgradeLocked = error.message.includes('升級處理中');
    }
    assert(upgradeLocked, '✓ 10秒內應拒絕重複升級（鎖定生效）');

    // 2.2 測試：超過30秒自動解鎖
    await limitRef.set(
      {
        photos: {
          upgrading: true,
          upgradingAt: new Date(Date.now() - 40 * 1000).toISOString(),
        },
      },
      { merge: true }
    );

    log.info('測試 2.2: 設置升級鎖定（40秒前，超過30秒）');
    let upgradeSuccess = false;
    try {
      const result = await upgradeMembership(TEST_USER_ID, 'vip', { durationMonths: 1 });
      upgradeSuccess = result.tier === 'vip';
    } catch (error) {
      log.warn(`升級失敗: ${error.message}`);
    }
    assert(upgradeSuccess, '✓ 超過30秒應自動解鎖並允許升級');

  } catch (error) {
    log.error(`測試 2 失敗: ${error.message}`);
    testStats.errors.push(`測試 2: ${error.message}`);
  }
}

/**
 * 測試 3: 廣告解鎖重置邏輯（24小時滾動窗口）
 */
async function test3_AdUnlockRollingWindow() {
  log.test('=== 測試 3: 廣告解鎖重置邏輯（24小時滾動窗口） ===');

  try {
    const limitData = {
      count: 0,
      unlockHistory: [],
      adsWatchedToday: 0,
    };

    // 3.1 測試：添加廣告解鎖
    log.info('測試 3.1: 添加廣告解鎖');
    const result1 = unlockByAd(limitData, 5);
    assert(
      result1.success && result1.unlockedAmount === 5,
      '✓ 成功添加廣告解鎖 5 次'
    );

    const expiresAt1 = new Date(result1.expiresAt);
    const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const timeDiff = Math.abs(expiresAt1 - expectedExpiry);

    assert(
      timeDiff < 1000,
      `✓ 過期時間應為24小時後（誤差: ${timeDiff}ms）`
    );

    // 3.2 測試：unlockHistory 包含過期時間
    assert(
      limitData.unlockHistory.length === 1 && limitData.unlockHistory[0].expiresAt,
      '✓ unlockHistory 包含獨立的過期時間'
    );

    // 3.3 測試：過濾過期記錄
    limitData.unlockHistory.push({
      amount: 3,
      unlockedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 還剩1小時
      unlockType: 'ad',
    });

    limitData.unlockHistory.push({
      amount: 2,
      unlockedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 已過期
      unlockType: 'ad',
    });

    log.info('測試 3.2: 添加混合解鎖記錄（有效 + 過期）');
    const checkResult = checkCanUse(limitData, 10);

    // 應該只計算未過期的：5 + 3 = 8（不包含已過期的2）
    assert(
      checkResult.allowed === true,
      '✓ 應允許使用（只計算未過期的解鎖次數）'
    );

  } catch (error) {
    log.error(`測試 3 失敗: ${error.message}`);
    testStats.errors.push(`測試 3: ${error.message}`);
  }
}

/**
 * 測試 4: 藥水使用併發保護
 */
async function test4_PotionConcurrencyProtection() {
  log.test('=== 測試 4: 藥水使用併發保護 ===');

  try {
    // 4.1 測試：正常使用藥水
    log.info('測試 4.1: 正常使用記憶增強藥水');
    const result1 = await useMemoryBoost(TEST_USER_ID, TEST_CHARACTER_ID);
    assert(
      result1.success && result1.characterId === TEST_CHARACTER_ID,
      '✓ 成功使用記憶增強藥水'
    );

    // 4.2 測試：阻止重複激活
    log.info('測試 4.2: 嘗試重複激活同一角色');
    let duplicateBlocked = false;
    try {
      await useMemoryBoost(TEST_USER_ID, TEST_CHARACTER_ID);
    } catch (error) {
      duplicateBlocked = error.message.includes('已有記憶增強藥水效果');
    }
    assert(duplicateBlocked, '✓ 成功阻止同一角色重複激活藥水效果');

    // 4.3 測試：庫存驗證
    const limitRef = db.collection('usage_limits').doc(TEST_USER_ID);
    await limitRef.update({ 'potionInventory.brainBoost': 1 });

    log.info('測試 4.3: 庫存為1時的併發保護');
    const result2 = await useBrainBoost(TEST_USER_ID, `${TEST_CHARACTER_ID}_2`);
    assert(result2.success, '✓ 庫存為1時第一次使用成功');

    let insufficientStock = false;
    try {
      await useBrainBoost(TEST_USER_ID, `${TEST_CHARACTER_ID}_3`);
    } catch (error) {
      insufficientStock = error.message.includes('庫存不足');
    }
    assert(insufficientStock, '✓ 庫存為0時成功拒絕使用');

    // 驗證庫存
    const limitDoc = await limitRef.get();
    const inventory = limitDoc.data()?.potionInventory?.brainBoost || 0;
    assert(inventory === 0, `✓ 庫存正確為 0`);

  } catch (error) {
    log.error(`測試 4 失敗: ${error.message}`);
    testStats.errors.push(`測試 4: ${error.message}`);
  }
}

/**
 * 測試 5: 已解鎖角色快速查詢
 */
async function test5_UnlockedCharactersQuery() {
  log.test('=== 測試 5: 已解鎖角色快速查詢 ===');

  try {
    const userRef = db.collection('users').doc(TEST_USER_ID);

    // 5.1 設置測試數據
    await userRef.update({
      unlockedCharacters: {
        'char001': {
          unlockedAt: FieldValue.serverTimestamp(),
          unlockedBy: 'ticket',
          permanent: true,
          expiresAt: null,
        },
        'char002': {
          unlockedAt: FieldValue.serverTimestamp(),
          unlockedBy: 'coins',
          permanent: false,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          unlockDays: 7,
        },
        'char003': {
          unlockedAt: FieldValue.serverTimestamp(),
          unlockedBy: 'ticket',
          permanent: false,
          expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 已過期
          unlockDays: 7,
        },
      },
    });

    log.info('測試 5.1: 查詢已解鎖角色列表');
    const unlockedList = await getUserUnlockedCharacters(TEST_USER_ID);
    assert(unlockedList.length === 2, `✓ 返回 2 個有效角色（過濾了過期角色）`);

    // 5.2 測試：永久解鎖
    log.info('測試 5.2: 檢查永久解鎖角色');
    const check1 = await checkCharacterUnlocked(TEST_USER_ID, 'char001');
    assert(
      check1.unlocked && check1.permanent,
      '✓ char001 顯示為永久解鎖'
    );

    // 5.3 測試：臨時解鎖
    log.info('測試 5.3: 檢查臨時解鎖角色');
    const check2 = await checkCharacterUnlocked(TEST_USER_ID, 'char002');
    assert(
      check2.unlocked && !check2.permanent && check2.remainingDays > 0,
      `✓ char002 顯示為臨時解鎖（剩餘: ${check2.remainingDays}天）`
    );

    // 5.4 測試：已過期
    log.info('測試 5.4: 檢查已過期角色');
    const check3 = await checkCharacterUnlocked(TEST_USER_ID, 'char003');
    assert(
      !check3.unlocked && check3.reason === 'expired',
      '✓ char003 正確顯示為已過期'
    );

    // 5.5 測試：未解鎖
    log.info('測試 5.5: 檢查未解鎖角色');
    const check4 = await checkCharacterUnlocked(TEST_USER_ID, 'char999');
    assert(
      !check4.unlocked && check4.reason === 'not_unlocked',
      '✓ char999 正確顯示為未解鎖'
    );

    // 5.6 測試：VVIP自動解鎖
    log.info('測試 5.6: VVIP 用戶自動解鎖所有角色');
    await userRef.update({ membershipTier: 'vvip' });
    const check5 = await checkCharacterUnlocked(TEST_USER_ID, 'any-character');
    assert(
      check5.unlocked && check5.unlockedBy === 'vvip',
      '✓ VVIP 用戶自動解鎖所有角色'
    );

  } catch (error) {
    log.error(`測試 5 失敗: ${error.message}`);
    testStats.errors.push(`測試 5: ${error.message}`);
  }
}

/**
 * 打印測試報告
 */
function printTestReport() {
  console.log('\n' + '='.repeat(60));
  console.log('測試報告');
  console.log('='.repeat(60));
  console.log(`總測試數: ${testStats.total}`);
  console.log(`${colors.green}通過: ${testStats.passed}${colors.reset}`);
  console.log(`${colors.red}失敗: ${testStats.failed}${colors.reset}`);

  if (testStats.failed > 0) {
    console.log('\n失敗的測試：');
    testStats.errors.forEach((error, index) => {
      console.log(`${colors.red}${index + 1}. ${error}${colors.reset}`);
    });
  }

  const passRate = testStats.total > 0 ? ((testStats.passed / testStats.total) * 100).toFixed(2) : 0;
  console.log(`\n通過率: ${passRate}%`);
  console.log('='.repeat(60) + '\n');
}

/**
 * 主測試函數
 */
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('2025-01-14 商業邏輯修復測試');
  console.log('='.repeat(60) + '\n');

  try {
    await setupTestEnvironment();

    await test1_RefundAssetValidation();
    await test2_MembershipUpgradeLockTimeout();
    await test3_AdUnlockRollingWindow();
    await test4_PotionConcurrencyProtection();
    await test5_UnlockedCharactersQuery();

    printTestReport();

    await cleanupTestEnvironment();

    // 返回測試結果
    process.exit(testStats.failed > 0 ? 1 : 0);
  } catch (error) {
    log.error(`測試執行失敗: ${error.message}`);
    console.error(error);
    await cleanupTestEnvironment();
    process.exit(1);
  }
}

// 執行測試
runAllTests();
