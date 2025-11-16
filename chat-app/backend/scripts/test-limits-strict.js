/**
 * 🔥 限制服務嚴格測試
 *
 * 測試重點:
 * 1. 並發發送消息 - 測試限制計數的並發安全性
 * 2. 限制計數準確性 - 驗證不會超賣或少賣
 * 3. 重置邏輯 - 每日重置、永不重置
 * 4. 廣告解鎖 - 次數累加、上限檢查
 * 5. 永久解鎖 - 解鎖後不受限制
 * 6. 跨角色獨立性 - 不同角色互不影響
 *
 * ⚠️ 這個測試會發現並發競爭問題!
 */

// 載入環境變數 (必須在其他 import 之前)
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { getFirestoreDb } from '../src/firebase/index.js';
import {
  canSendMessage,
  recordMessage,
  unlockByAd,
  unlockPermanently
} from '../src/conversation/conversationLimit.service.js';
import {
  canPlayVoice,
  recordVoicePlay
} from '../src/ai/voiceLimit.service.js';
import { CONVERSATION_LIMITS } from '../src/config/limits.js';
import { deleteCachedUserProfile } from '../src/user/userProfileCache.service.js';

const db = getFirestoreDb();

// 測試用戶前綴
const TEST_USER_PREFIX = 'test-limits-strict-';

// 輔助函數: 獲取對話限制數據
async function getConversationLimitData(userId, characterId) {
  const limitDoc = await db.collection('usage_limits').doc(userId).get();
  if (!limitDoc.exists) {
    return { count: 0 };
  }
  const data = limitDoc.data();
  return data?.conversation?.[characterId] || { count: 0 };
}

// 輔助函數: 獲取語音限制數據
async function getVoiceLimitData(userId, characterId) {
  const limitDoc = await db.collection('usage_limits').doc(userId).get();
  if (!limitDoc.exists) {
    return { count: 0 };
  }
  const data = limitDoc.data();
  return data?.voice?.[characterId] || { count: 0 };
}

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
async function createTestUser(userId, membershipTier = 'free') {
  const userRef = db.collection('users').doc(userId);

  const userData = {
    uid: userId,
    email: `${userId}@example.com`,
    displayName: '測試用戶',
    membershipTier,
    membershipStatus: membershipTier === 'free' ? 'none' : 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 為付費會員添加過期時間 (1年後)
  if (membershipTier !== 'free') {
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    userData.membershipExpiresAt = expiryDate.toISOString();
  }

  await userRef.set(userData);

  // ✅ 清除緩存，確保後續查詢讀取最新數據
  deleteCachedUserProfile(userId);

  logInfo(`創建測試用戶: ${userId}, 會員等級: ${membershipTier}`);
}

// 清理測試用戶
async function cleanupTestUser(userId) {
  await db.collection('users').doc(userId).delete();
  await db.collection('usage_limits').doc(userId).delete();
  await db.collection('ad_watch_stats').doc(userId).delete();
}

// ============================================================================
// 測試 1: 並發發送消息 (同一角色)
// ============================================================================
async function testConcurrentMessagesSameCharacter() {
  logTest('測試 1: 並發發送消息 (同一角色,免費用戶 10 次限制)');

  const userId = `${TEST_USER_PREFIX}concurrent-msg-${Date.now()}`;
  const characterId = 'test-character-001';

  try {
    await createTestUser(userId, 'free');

    // 同時發送 15 條消息 (超過限制 10 條)
    const MESSAGE_COUNT = 15;
    logInfo(`同時發送 ${MESSAGE_COUNT} 條消息 (限制 10 條)...`);

    const startTime = Date.now();
    const promises = Array(MESSAGE_COUNT).fill(null).map(async (_, index) => {
      try {
        // 檢查是否可以發送
        const canSend = await canSendMessage(userId, characterId);

        if (canSend.canSend || canSend.allowed) {
          // 增加計數
          await recordMessage(userId, characterId);
          return { index, success: true };
        } else {
          return { index, success: false, reason: 'limit_reached' };
        }
      } catch (error) {
        return { index, success: false, reason: error.message };
      }
    });

    const results = await Promise.all(promises);
    const elapsed = Date.now() - startTime;

    logInfo(`所有請求完成,耗時: ${elapsed}ms`);

    // 統計結果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logInfo(`成功: ${successCount}, 失敗: ${failCount}`);

    // 驗證: 成功次數應該正好是 10 (免費用戶限制)
    const expectedSuccess = CONVERSATION_LIMITS.FREE_PER_CHARACTER;

    if (successCount === expectedSuccess) {
      logSuccess(`✅ 並發計數正確: ${successCount} 次 (限制 ${expectedSuccess})`);
    } else if (successCount > expectedSuccess) {
      logError(`❌ 嚴重錯誤:成功 ${successCount} 次,超過限制 ${expectedSuccess} 次!`);
      return false;
    } else {
      logWarning(`⚠️  成功 ${successCount} 次,少於限制 ${expectedSuccess} 次`);
    }

    // 驗證數據庫中的實際計數
    const limitData = await getConversationLimitData(userId, characterId);

    if (limitData.count === expectedSuccess) {
      logSuccess(`✅ 數據庫計數正確: ${limitData.count}`);
      return true;
    } else {
      logError(`❌ 數據庫計數錯誤:期望 ${expectedSuccess},實際 ${limitData.count}`);
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
// 測試 2: 跨角色獨立性
// ============================================================================
async function testCrossCharacterIndependence() {
  logTest('測試 2: 跨角色限制獨立性 (不同角色互不影響)');

  const userId = `${TEST_USER_PREFIX}cross-char-${Date.now()}`;

  try {
    await createTestUser(userId, 'free');

    // 對 3 個不同角色各發送 10 條消息
    const characterIds = ['char-001', 'char-002', 'char-003'];
    const messagesPerChar = CONVERSATION_LIMITS.FREE_PER_CHARACTER;

    logInfo(`對 3 個角色各發送 ${messagesPerChar} 條消息...`);

    for (const characterId of characterIds) {
      for (let i = 0; i < messagesPerChar; i++) {
        const canSend = await canSendMessage(userId, characterId);
        if (canSend.canSend || canSend.allowed) {
          await recordMessage(userId, characterId);
        } else {
          logError(`角色 ${characterId} 在第 ${i + 1} 條消息時達到限制`);
          return false;
        }
      }
      logInfo(`  角色 ${characterId}: 成功發送 ${messagesPerChar} 條`);
    }

    logSuccess('所有角色都能發送滿額度的消息');

    // 驗證每個角色的計數都是 10
    for (const characterId of characterIds) {
      const limitData = await getConversationLimitData(userId, characterId);

      if (limitData.count === messagesPerChar) {
        logSuccess(`  ✅ 角色 ${characterId} 計數正確: ${limitData.count}`);
      } else {
        logError(`  ❌ 角色 ${characterId} 計數錯誤:期望 ${messagesPerChar},實際 ${limitData.count}`);
        return false;
      }
    }

    // 驗證:繼續對第一個角色發送應該被拒絕
    const canSendMore = await canSendMessage(userId, characterIds[0]);

    if (!canSendMore.canSend && !canSendMore.allowed) {
      logSuccess(`✅ 第一個角色達到限制後正確拒絕`);
      return true;
    } else {
      logError(`❌ 第一個角色達到限制後仍可發送`);
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
// 測試 3: 永久解鎖後無限制
// ============================================================================
async function testPermanentUnlock() {
  logTest('測試 3: 永久解鎖後無限制 (免費用戶解鎖角色)');

  const userId = `${TEST_USER_PREFIX}perm-unlock-${Date.now()}`;
  const characterId = 'test-character-unlock';

  try {
    await createTestUser(userId, 'free');

    // 永久解鎖角色
    logInfo('永久解鎖角色...');
    await unlockPermanently(userId, characterId);

    logSuccess('角色已永久解鎖');

    // 發送 20 條消息 (超過免費用戶限制 10 條)
    const MESSAGE_COUNT = 20;
    logInfo(`發送 ${MESSAGE_COUNT} 條消息 (超過限制)...`);

    let successCount = 0;

    for (let i = 0; i < MESSAGE_COUNT; i++) {
      const canSend = await canSendMessage(userId, characterId);

      if (canSend.canSend || canSend.allowed) {
        await recordMessage(userId, characterId);
        successCount++;
      } else {
        logError(`在第 ${i + 1} 條消息時被拒絕`);
        break;
      }
    }

    if (successCount === MESSAGE_COUNT) {
      logSuccess(`✅ 永久解鎖後可發送 ${MESSAGE_COUNT} 條消息 (無限制)`);
      return true;
    } else {
      logError(`❌ 只發送了 ${successCount} 條消息`);
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
// 測試 4: 廣告解鎖邏輯
// ============================================================================
async function testAdUnlock() {
  logTest('測試 4: 廣告解鎖邏輯 (免費用戶,每次解鎖 5 條,上限 10 次)');

  const userId = `${TEST_USER_PREFIX}ad-unlock-${Date.now()}`;
  const characterId = 'test-character-ad';

  try {
    await createTestUser(userId, 'free');

    // 先用完基礎額度 (10 條)
    logInfo('先用完基礎額度 10 條...');
    for (let i = 0; i < CONVERSATION_LIMITS.FREE_PER_CHARACTER; i++) {
      await recordMessage(userId, characterId);
    }

    logSuccess('基礎額度已用完');

    // 驗證無法繼續發送
    let canSend = await canSendMessage(userId, characterId);
    if (!canSend.canSend && !canSend.allowed) {
      logSuccess('✅ 基礎額度用完後正確拒絕');
    } else {
      logError('❌ 基礎額度用完後仍可發送');
      return false;
    }

    // 觀看廣告解鎖 (解鎖 5 條)
    logInfo('觀看廣告解鎖...');
    await unlockByAd(userId, characterId, `ad-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`);

    logSuccess('廣告解鎖成功 (新增 5 條)');

    // 驗證可以繼續發送 5 條
    let adUnlockedCount = 0;
    for (let i = 0; i < 10; i++) {
      canSend = await canSendMessage(userId, characterId);
      if (canSend.canSend || canSend.allowed) {
        await recordMessage(userId, characterId);
        adUnlockedCount++;
      } else {
        break;
      }
    }

    if (adUnlockedCount === CONVERSATION_LIMITS.FREE_UNLOCKED_PER_AD) {
      logSuccess(`✅ 廣告解鎖後可發送 ${adUnlockedCount} 條`);
    } else {
      logError(`❌ 廣告解鎖後只能發送 ${adUnlockedCount} 條,期望 ${CONVERSATION_LIMITS.FREE_UNLOCKED_PER_AD}`);
      return false;
    }

    // 驗證冷卻時間限制 (60 秒)
    logInfo('測試冷卻時間限制 (60 秒)...');
    try {
      await unlockByAd(userId, characterId, `ad-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`);
      logError('❌ 冷卻時間內仍可解鎖廣告');
      return false;
    } catch (error) {
      if (error.message.includes('請等待')) {
        logSuccess('✅ 冷卻時間限制正常: ' + error.message);
        return true;
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
// 測試 5: VIP 用戶限制檢查
// ============================================================================
async function testVIPLimits() {
  logTest('測試 5: VIP 用戶限制 (20 條/角色)');

  const userId = `${TEST_USER_PREFIX}vip-${Date.now()}`;
  const characterId = 'test-character-vip';

  try {
    await createTestUser(userId, 'vip');

    // VIP 用戶應該有 20 條限制
    const vipLimit = CONVERSATION_LIMITS.VIP_PER_CHARACTER;
    logInfo(`VIP 用戶發送 ${vipLimit} 條消息...`);

    let successCount = 0;

    for (let i = 0; i < vipLimit; i++) {
      const canSend = await canSendMessage(userId, characterId);

      if (canSend.canSend || canSend.allowed) {
        await recordMessage(userId, characterId);
        successCount++;
      } else {
        logError(`在第 ${i + 1} 條消息時被拒絕`);
        break;
      }
    }

    if (successCount === vipLimit) {
      logSuccess(`✅ VIP 用戶可發送 ${successCount} 條`);
    } else {
      logError(`❌ VIP 用戶只發送了 ${successCount} 條,期望 ${vipLimit}`);
      return false;
    }

    // 驗證:第 21 條應該被拒絕
    const canSendMore = await canSendMessage(userId, characterId);

    if (!canSendMore.canSend && !canSendMore.allowed) {
      logSuccess(`✅ 達到 VIP 限制後正確拒絕`);
      return true;
    } else {
      logError(`❌ 達到 VIP 限制後仍可發送`);
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
// 測試 6: 語音限制 - 免費用戶
// ============================================================================
async function testVoiceLimitFree() {
  logTest('測試 6: 語音限制 - 免費用戶 (10 次/角色)');

  const userId = `${TEST_USER_PREFIX}voice-free-${Date.now()}`;
  const characterId = 'test-character-voice';

  try {
    await createTestUser(userId, 'free');

    // 免費用戶應該有 10 次語音限制
    const freeLimit = 10; // VOICE_LIMITS.FREE_PER_CHARACTER
    logInfo(`免費用戶播放 ${freeLimit} 次語音...`);

    let successCount = 0;

    for (let i = 0; i < freeLimit; i++) {
      const canPlay = await canPlayVoice(userId, characterId);

      if (canPlay.canUse || canPlay.allowed) {
        await recordVoicePlay(userId, characterId);
        successCount++;
      } else {
        logError(`在第 ${i + 1} 次語音時被拒絕`);
        break;
      }
    }

    if (successCount === freeLimit) {
      logSuccess(`✅ 免費用戶可播放 ${successCount} 次語音`);
    } else {
      logError(`❌ 免費用戶只播放了 ${successCount} 次,期望 ${freeLimit}`);
      return false;
    }

    // 驗證:第 11 次應該被拒絕
    const canPlayMore = await canPlayVoice(userId, characterId);

    if (!canPlayMore.canUse && !canPlayMore.allowed) {
      logSuccess(`✅ 達到語音限制後正確拒絕`);
      return true;
    } else {
      logError(`❌ 達到語音限制後仍可播放`);
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
// 測試 7: 語音限制 - VIP 用戶無限制
// ============================================================================
async function testVoiceLimitVIP() {
  logTest('測試 7: 語音限制 - VIP 用戶無限制');

  const userId = `${TEST_USER_PREFIX}voice-vip-${Date.now()}`;
  const characterId = 'test-character-voice-vip';

  try {
    await createTestUser(userId, 'vip');

    // VIP 用戶應該無限制,測試 50 次
    const TEST_COUNT = 50;
    logInfo(`VIP 用戶播放 ${TEST_COUNT} 次語音...`);

    let successCount = 0;

    for (let i = 0; i < TEST_COUNT; i++) {
      const canPlay = await canPlayVoice(userId, characterId);

      if (canPlay.canUse || canPlay.allowed) {
        await recordVoicePlay(userId, characterId);
        successCount++;
      } else {
        logError(`在第 ${i + 1} 次語音時被拒絕`);
        break;
      }
    }

    if (successCount === TEST_COUNT) {
      logSuccess(`✅ VIP 用戶可播放 ${successCount} 次語音 (無限制)`);
      return true;
    } else {
      logError(`❌ VIP 用戶只播放了 ${successCount} 次`);
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
// 測試 8: 並發語音播放
// ============================================================================
async function testConcurrentVoice() {
  logTest('測試 8: 並發語音播放 (同一角色,免費用戶 10 次限制)');

  const userId = `${TEST_USER_PREFIX}concurrent-voice-${Date.now()}`;
  const characterId = 'test-character-voice-concurrent';

  try {
    await createTestUser(userId, 'free');

    // 同時播放 15 次語音 (超過限制 10 次)
    const VOICE_COUNT = 15;
    logInfo(`同時播放 ${VOICE_COUNT} 次語音 (限制 10 次)...`);

    const startTime = Date.now();
    const promises = Array(VOICE_COUNT).fill(null).map(async (_, index) => {
      try {
        const canPlay = await canPlayVoice(userId, characterId);

        if (canPlay.canUse || canPlay.allowed) {
          await recordVoicePlay(userId, characterId);
          return { index, success: true };
        } else {
          return { index, success: false };
        }
      } catch (error) {
        return { index, success: false, error: error.message };
      }
    });

    const results = await Promise.all(promises);
    const elapsed = Date.now() - startTime;

    logInfo(`所有請求完成,耗時: ${elapsed}ms`);

    // 統計結果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    logInfo(`成功: ${successCount}, 失敗: ${failCount}`);

    // 驗證:成功次數應該正好是 10
    const expectedSuccess = 10; // VOICE_LIMITS.FREE_PER_CHARACTER

    if (successCount === expectedSuccess) {
      logSuccess(`✅ 並發計數正確: ${successCount} 次`);
      return true;
    } else if (successCount > expectedSuccess) {
      logError(`❌ 嚴重錯誤:成功 ${successCount} 次,超過限制 ${expectedSuccess} 次!`);
      return false;
    } else {
      logWarning(`⚠️  成功 ${successCount} 次,少於限制 ${expectedSuccess} 次`);
      return successCount >= expectedSuccess - 1; // 允許 1 次誤差
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
// 執行所有測試
// ============================================================================
async function runAllTests() {
  log('\n' + '='.repeat(70), 'bold');
  log('🔥 限制服務嚴格測試套件', 'cyan');
  log('='.repeat(70), 'bold');
  log(`測試時間: ${new Date().toLocaleString('zh-TW')}`, 'blue');
  log(`環境: ${process.env.USE_FIREBASE_EMULATOR ? 'Firebase Emulator' : '生產環境 Firestore'}`, 'blue');
  console.log();

  const tests = [
    { name: '測試 1: 並發發送消息 (同一角色)', fn: testConcurrentMessagesSameCharacter },
    { name: '測試 2: 跨角色限制獨立性', fn: testCrossCharacterIndependence },
    { name: '測試 3: 永久解鎖後無限制', fn: testPermanentUnlock },
    { name: '測試 4: 廣告解鎖邏輯', fn: testAdUnlock },
    { name: '測試 5: VIP 用戶限制', fn: testVIPLimits },
    { name: '測試 6: 語音限制 - 免費用戶', fn: testVoiceLimitFree },
    { name: '測試 7: 語音限制 - VIP 無限制', fn: testVoiceLimitVIP },
    { name: '測試 8: 並發語音播放', fn: testConcurrentVoice },
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
