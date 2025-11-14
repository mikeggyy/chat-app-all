/**
 * 收藏功能改進測試腳本
 *
 * 測試內容：
 * 1. 收藏時增加 totalFavorites
 * 2. 取消收藏時減少 totalFavorites
 * 3. 防止負數計數
 * 4. 參數驗證
 * 5. 緩存清除
 */

import 'dotenv/config';
import { getFirestoreDb } from '../src/firebase/index.js';
import { TEST_ACCOUNTS } from '../../../shared/config/testAccounts.js';
import { addFavoriteForUser, removeFavoriteForUser, getUserById } from '../src/user/user.service.js';
import { getUserProfileWithCache, deleteCachedUserProfile } from '../src/user/userProfileCache.service.js';

const db = getFirestoreDb();
const TEST_USER_ID = TEST_ACCOUNTS.DEV_USER_ID;
const TEST_CHARACTER_ID = 'match-001'; // 艾米麗

// ANSI 顏色碼
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

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${title}`, 'blue');
  log(`${'='.repeat(60)}`, 'blue');
}

/**
 * 獲取角色的 totalFavorites
 */
async function getCharacterFavorites(characterId) {
  const doc = await db.collection('characters').doc(characterId).get();
  if (!doc.exists) {
    throw new Error(`角色 ${characterId} 不存在`);
  }
  return doc.data().totalFavorites || 0;
}

/**
 * 獲取用戶的收藏列表
 */
async function getUserFavorites(userId) {
  const user = await getUserById(userId);
  return user?.favorites || [];
}

/**
 * 測試 1：收藏時增加計數
 */
async function test1_AddFavoriteIncreasesCount() {
  section('測試 1: 收藏時增加 totalFavorites');

  try {
    // 1. 獲取初始計數
    const initialCount = await getCharacterFavorites(TEST_CHARACTER_ID);
    info(`初始 totalFavorites: ${initialCount}`);

    // 2. 先確保用戶沒有收藏這個角色
    let userFavorites = await getUserFavorites(TEST_USER_ID);
    if (userFavorites.includes(TEST_CHARACTER_ID)) {
      info('用戶已收藏此角色，先取消收藏');
      await removeFavoriteForUser(TEST_USER_ID, TEST_CHARACTER_ID);
      // 等待 Firestore 更新
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. 收藏角色
    info('執行收藏操作...');
    const result = await addFavoriteForUser(TEST_USER_ID, TEST_CHARACTER_ID);

    if (!result.isNewFavorite) {
      warning('isNewFavorite 為 false，可能角色已被收藏');
    }

    // 4. 等待 transaction 完成
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 5. 驗證計數增加
    const newCount = await getCharacterFavorites(TEST_CHARACTER_ID);
    info(`新的 totalFavorites: ${newCount}`);

    if (newCount === initialCount + 1) {
      success(`計數正確增加：${initialCount} → ${newCount}`);
      return true;
    } else {
      error(`計數錯誤：預期 ${initialCount + 1}，實際 ${newCount}`);
      return false;
    }
  } catch (err) {
    error(`測試失敗: ${err.message}`);
    console.error(err);
    return false;
  }
}

/**
 * 測試 2：取消收藏時減少計數
 */
async function test2_RemoveFavoriteDecreasesCount() {
  section('測試 2: 取消收藏時減少 totalFavorites');

  try {
    // 1. 獲取初始計數
    const initialCount = await getCharacterFavorites(TEST_CHARACTER_ID);
    info(`初始 totalFavorites: ${initialCount}`);

    // 2. 確保用戶已收藏此角色
    let userFavorites = await getUserFavorites(TEST_USER_ID);
    if (!userFavorites.includes(TEST_CHARACTER_ID)) {
      info('用戶未收藏此角色，先收藏');
      await addFavoriteForUser(TEST_USER_ID, TEST_CHARACTER_ID);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // 3. 取消收藏
    info('執行取消收藏操作...');
    await removeFavoriteForUser(TEST_USER_ID, TEST_CHARACTER_ID);

    // 4. 等待 transaction 完成
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 5. 驗證計數減少
    const newCount = await getCharacterFavorites(TEST_CHARACTER_ID);
    info(`新的 totalFavorites: ${newCount}`);

    if (newCount === initialCount - 1) {
      success(`計數正確減少：${initialCount} → ${newCount}`);
      return true;
    } else {
      error(`計數錯誤：預期 ${initialCount - 1}，實際 ${newCount}`);
      return false;
    }
  } catch (err) {
    error(`測試失敗: ${err.message}`);
    console.error(err);
    return false;
  }
}

/**
 * 測試 3：防止負數
 */
async function test3_PreventNegativeCount() {
  section('測試 3: 防止 totalFavorites 變成負數');

  try {
    // 1. 創建一個測試角色，totalFavorites = 0
    const testCharId = `test-char-${Date.now()}`;
    info(`創建測試角色: ${testCharId}`);

    await db.collection('characters').doc(testCharId).set({
      id: testCharId,
      display_name: '測試角色',
      gender: '女性',
      background: '測試用角色',
      totalFavorites: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. 嘗試取消收藏（即使用戶沒有收藏過）
    info('嘗試取消收藏（用戶未收藏過）...');
    try {
      await removeFavoriteForUser(TEST_USER_ID, testCharId);
    } catch (err) {
      // 可能會失敗，因為用戶沒有收藏過
      warning(`取消收藏失敗（預期行為）: ${err.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    // 3. 驗證計數仍為 0（不是負數）
    const count = await getCharacterFavorites(testCharId);
    info(`totalFavorites: ${count}`);

    // 4. 清理測試角色
    await db.collection('characters').doc(testCharId).delete();

    if (count >= 0) {
      success(`計數未變成負數：${count}`);
      return true;
    } else {
      error(`計數變成負數：${count}`);
      return false;
    }
  } catch (err) {
    error(`測試失敗: ${err.message}`);
    console.error(err);
    return false;
  }
}

/**
 * 測試 4：緩存清除
 */
async function test4_CacheClear() {
  section('測試 4: 緩存清除');

  try {
    // 1. 清除現有緩存
    deleteCachedUserProfile(TEST_USER_ID);
    info('已清除現有緩存');

    // 2. 獲取用戶資料（會被緩存）
    const user1 = await getUserProfileWithCache(TEST_USER_ID);
    const favorites1 = user1?.favorites || [];
    info(`第一次讀取收藏數: ${favorites1.length}`);

    // 3. 添加收藏
    info('添加收藏...');
    await addFavoriteForUser(TEST_USER_ID, TEST_CHARACTER_ID);
    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. 再次讀取（應該從 Firestore 讀取，因為緩存已被清除）
    const user2 = await getUserProfileWithCache(TEST_USER_ID);
    const favorites2 = user2?.favorites || [];
    info(`第二次讀取收藏數: ${favorites2.length}`);

    // 5. 驗證數據更新
    if (favorites2.includes(TEST_CHARACTER_ID)) {
      success('緩存已正確清除，讀取到最新數據');
      return true;
    } else {
      error('緩存未清除，數據未更新');
      return false;
    }
  } catch (err) {
    error(`測試失敗: ${err.message}`);
    console.error(err);
    return false;
  }
}

/**
 * 測試 5：重複收藏
 */
async function test5_DuplicateFavorite() {
  section('測試 5: 重複收藏不會重複增加計數');

  try {
    // 1. 確保用戶已收藏
    let userFavorites = await getUserFavorites(TEST_USER_ID);
    if (!userFavorites.includes(TEST_CHARACTER_ID)) {
      await addFavoriteForUser(TEST_USER_ID, TEST_CHARACTER_ID);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // 2. 獲取計數
    const count1 = await getCharacterFavorites(TEST_CHARACTER_ID);
    info(`收藏前計數: ${count1}`);

    // 3. 重複收藏
    info('執行重複收藏...');
    const result = await addFavoriteForUser(TEST_USER_ID, TEST_CHARACTER_ID);

    if (result.isNewFavorite) {
      warning('isNewFavorite 為 true，但應該是重複收藏');
    } else {
      info('isNewFavorite 正確為 false');
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    // 4. 驗證計數未增加
    const count2 = await getCharacterFavorites(TEST_CHARACTER_ID);
    info(`收藏後計數: ${count2}`);

    if (count2 === count1) {
      success(`計數未重複增加：${count1} → ${count2}`);
      return true;
    } else {
      error(`計數錯誤增加：${count1} → ${count2}`);
      return false;
    }
  } catch (err) {
    error(`測試失敗: ${err.message}`);
    console.error(err);
    return false;
  }
}

/**
 * 主測試函數
 */
async function runTests() {
  log('\n🧪 開始測試收藏功能改進\n', 'cyan');

  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false,
    test5: false,
  };

  // 執行所有測試
  results.test1 = await test1_AddFavoriteIncreasesCount();
  results.test2 = await test2_RemoveFavoriteDecreasesCount();
  results.test3 = await test3_PreventNegativeCount();
  results.test4 = await test4_CacheClear();
  results.test5 = await test5_DuplicateFavorite();

  // 匯總結果
  section('測試結果匯總');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  log('\n測試項目:', 'cyan');
  log(`  測試 1 - 收藏增加計數: ${results.test1 ? '✅ 通過' : '❌ 失敗'}`, results.test1 ? 'green' : 'red');
  log(`  測試 2 - 取消減少計數: ${results.test2 ? '✅ 通過' : '❌ 失敗'}`, results.test2 ? 'green' : 'red');
  log(`  測試 3 - 防止負數: ${results.test3 ? '✅ 通過' : '❌ 失敗'}`, results.test3 ? 'green' : 'red');
  log(`  測試 4 - 緩存清除: ${results.test4 ? '✅ 通過' : '❌ 失敗'}`, results.test4 ? 'green' : 'red');
  log(`  測試 5 - 重複收藏: ${results.test5 ? '✅ 通過' : '❌ 失敗'}`, results.test5 ? 'green' : 'red');

  log(`\n總計: ${passed}/${total} 測試通過`, passed === total ? 'green' : 'yellow');

  if (passed === total) {
    log('\n🎉 所有測試通過！', 'green');
  } else {
    log('\n⚠️  部分測試失敗，請檢查日誌', 'yellow');
  }

  process.exit(passed === total ? 0 : 1);
}

// 執行測試
runTests().catch(err => {
  error(`測試執行失敗: ${err.message}`);
  console.error(err);
  process.exit(1);
});
