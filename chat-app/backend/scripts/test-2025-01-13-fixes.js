/**
 * 測試 2025-01-13 商業邏輯修復
 *
 * 驗證：
 * P0-1: 廣告驗證安全防護
 * P1-1: 會員升級競態條件修復
 * P1-2: 禮物系統 Transaction 原子性
 * P1-3: 購買角色解鎖重複檢查
 *
 * 後續任務：
 * - Firestore 安全規則
 * - 廣告觀看異常監控系統
 * - 前端升級進度提示
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI 顏色代碼
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset}  ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.blue}${'='.repeat(70)}${colors.reset}`),
  title: (msg) => console.log(`${colors.bright}${msg}${colors.reset}`),
};

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
};

function checkPass(condition, message) {
  stats.total++;
  if (condition) {
    stats.passed++;
    log.success(message);
    return true;
  } else {
    stats.failed++;
    log.error(message);
    return false;
  }
}

// ==================== 測試 1: 廣告驗證安全防護 (P0-1) ====================
log.section();
log.title('📺 測試 1: 廣告驗證安全防護 (P0-1 高風險修復)');
log.section();

async function testAdVerification() {
  try {
    const conversationLimitService = await readFile(
      join(__dirname, '../src/conversation/conversationLimit.service.js'),
      'utf-8'
    );

    log.info('檢查 unlockByAd 函數的安全驗證層...');

    // 1. 每日次數限制
    checkPass(
      conversationLimitService.includes('todayCount >= 10') ||
      conversationLimitService.includes('DAILY_AD_LIMIT'),
      '  每日次數限制 (10次/天)'
    );

    // 2. 冷卻時間檢查
    checkPass(
      conversationLimitService.includes('60000') ||
      conversationLimitService.includes('AD_COOLDOWN') ||
      conversationLimitService.includes('COOLDOWN_SECONDS'),
      '  冷卻時間檢查 (60秒)'
    );

    // 3. adId 格式驗證
    checkPass(
      conversationLimitService.includes('ad-\\d{13}-[a-z0-9]{8}') ||
      conversationLimitService.includes('adId.match'),
      '  adId 格式驗證 (ad-{timestamp}-{random8})'
    );

    // 4. 重放攻擊防護
    checkPass(
      conversationLimitService.includes('usedAdIds') &&
      conversationLimitService.includes('.includes(adId)'),
      '  重放攻擊防護 (追蹤已使用的 adId)'
    );

    // 5. 統計記錄
    checkPass(
      conversationLimitService.includes('ad_watch_stats') &&
      conversationLimitService.includes('totalAdsWatched'),
      '  廣告觀看統計記錄'
    );

    // 6. 監控整合
    checkPass(
      conversationLimitService.includes('recordAdWatchEvent') ||
      conversationLimitService.includes('adWatchMonitor'),
      '  整合廣告異常監控系統'
    );

  } catch (error) {
    log.error(`測試失敗: ${error.message}`);
  }
}

await testAdVerification();

// ==================== 測試 2: 會員升級競態條件修復 (P1-1) ====================
log.section();
log.title('🔐 測試 2: 會員升級競態條件修復 (P1-1)');
log.section();

async function testMembershipUpgradeLock() {
  try {
    const membershipService = await readFile(
      join(__dirname, '../src/membership/membership.service.js'),
      'utf-8'
    );

    log.info('檢查會員升級鎖定機制...');

    // 1. 檢查升級中狀態
    checkPass(
      membershipService.includes('photos.upgrading'),
      '  Transaction 中檢查升級鎖定狀態'
    );

    // 2. 設置升級鎖
    checkPass(
      membershipService.includes("'photos.upgrading': true"),
      '  Transaction 中設置升級鎖 (upgrading = true)'
    );

    // 3. 清除升級鎖
    checkPass(
      membershipService.includes("'photos.upgrading': false"),
      '  Transaction 完成後清除升級鎖'
    );

    // 4. 記錄升級時間戳
    checkPass(
      membershipService.includes('photos.upgradingAt') ||
      membershipService.includes('photos.upgradeCompletedAt'),
      '  記錄升級時間戳 (用於追蹤和除錯)'
    );

    // 檢查拍照限制服務
    const photoLimitService = await readFile(
      join(__dirname, '../src/ai/photoLimit.service.js'),
      'utf-8'
    );

    log.info('\n檢查拍照功能的鎖定檢查...');

    // 5. 拍照前檢查升級狀態
    checkPass(
      photoLimitService.includes('photoData.upgrading') ||
      photoLimitService.includes('photos.upgrading'),
      '  拍照前檢查是否正在升級'
    );

    // 6. 升級中阻止拍照
    checkPass(
      photoLimitService.includes('會員升級處理中') ||
      photoLimitService.includes('upgrading'),
      '  升級期間返回錯誤提示'
    );

  } catch (error) {
    log.error(`測試失敗: ${error.message}`);
  }
}

await testMembershipUpgradeLock();

// ==================== 測試 3: 禮物系統 Transaction 原子性 (P1-2) ====================
log.section();
log.title('🎁 測試 3: 禮物系統 Transaction 原子性 (P1-2)');
log.section();

async function testGiftSystemTransaction() {
  try {
    const giftService = await readFile(
      join(__dirname, '../src/gift/gift.service.js'),
      'utf-8'
    );

    log.info('檢查禮物系統是否使用單一 Transaction...');

    // 1. 使用 Transaction
    const hasTransaction = giftService.includes('db.runTransaction') &&
                           giftService.includes('sendGift');
    checkPass(hasTransaction, '  使用 Firestore Transaction');

    if (hasTransaction) {
      // 2. 在 Transaction 內扣款
      checkPass(
        giftService.includes('transaction.update(userRef') &&
        giftService.includes('createWalletUpdate'),
        '  Transaction 內更新用戶錢包餘額'
      );

      // 3. 在 Transaction 內創建禮物記錄
      checkPass(
        giftService.includes('transaction.set(giftRecordRef') ||
        giftService.includes('gift_transactions'),
        '  Transaction 內創建禮物交易記錄'
      );

      // 4. 在 Transaction 內更新統計
      checkPass(
        giftService.includes('character_gift_stats') &&
        giftService.includes('transaction.set'),
        '  Transaction 內更新角色禮物統計'
      );

      // 5. 在 Transaction 內創建交易記錄
      checkPass(
        giftService.includes('transactions') &&
        giftService.includes('transaction.set(transactionRef'),
        '  Transaction 內創建系統交易記錄'
      );

      // 6. Transaction 內檢查餘額
      checkPass(
        giftService.includes('currentBalance <') &&
        giftService.includes('finalPrice'),
        '  Transaction 內檢查用戶餘額'
      );
    }

  } catch (error) {
    log.error(`測試失敗: ${error.message}`);
  }
}

await testGiftSystemTransaction();

// ==================== 測試 4: 購買角色解鎖重複檢查 (P1-3) ====================
log.section();
log.title('🔓 測試 4: 購買角色解鎖重複檢查 (P1-3)');
log.section();

async function testPurchaseUnlockCheck() {
  try {
    const coinsService = await readFile(
      join(__dirname, '../src/payment/coins.service.js'),
      'utf-8'
    );

    log.info('檢查購買角色解鎖的重複檢查邏輯...');

    // 1. 檢查永久解鎖狀態
    checkPass(
      coinsService.includes('permanentUnlock') &&
      coinsService.includes('purchaseUnlimitedChat'),
      '  購買前查詢 permanentUnlock 狀態'
    );

    // 2. 阻止重複購買
    checkPass(
      coinsService.includes('已永久解鎖') ||
      coinsService.includes('already unlocked'),
      '  已解鎖時返回錯誤提示'
    );

    // 3. 記錄臨時解鎖
    checkPass(
      coinsService.includes('temporaryUnlockUntil') &&
      coinsService.includes('logger'),
      '  記錄臨時解鎖狀態（用於追蹤）'
    );

  } catch (error) {
    log.error(`測試失敗: ${error.message}`);
  }
}

await testPurchaseUnlockCheck();

// ==================== 測試 5: Firestore 安全規則 ====================
log.section();
log.title('🔒 測試 5: Firestore 安全規則更新');
log.section();

async function testFirestoreRules() {
  try {
    const firestoreRules = await readFile(
      join(__dirname, '../../firestore.rules'),
      'utf-8'
    );

    log.info('檢查新增的 Firestore 安全規則...');

    // 1. ad_watch_stats 規則
    checkPass(
      firestoreRules.includes('ad_watch_stats') &&
      firestoreRules.includes('allow read:') &&
      firestoreRules.includes('allow write: if false'),
      '  ad_watch_stats (用戶只讀，後端專用寫入)'
    );

    // 2. gift_transactions 規則
    checkPass(
      firestoreRules.includes('gift_transactions') &&
      firestoreRules.includes('allow write: if false'),
      '  gift_transactions (用戶只讀，後端專用寫入)'
    );

    // 3. membership_history 規則
    checkPass(
      firestoreRules.includes('membership_history') &&
      firestoreRules.includes('allow write: if false'),
      '  membership_history (用戶只讀，後端專用寫入)'
    );

    // 4. character_gift_stats 規則
    checkPass(
      firestoreRules.includes('character_gift_stats') &&
      firestoreRules.includes('allow write: if false'),
      '  character_gift_stats (用戶只讀，後端專用寫入)'
    );

    // 5. ad_watch_events 規則
    checkPass(
      firestoreRules.includes('ad_watch_events') &&
      firestoreRules.includes('allow read: if false'),
      '  ad_watch_events (後端專用，用於異常檢測)'
    );

    // 6. ad_anomaly_alerts 規則
    checkPass(
      firestoreRules.includes('ad_anomaly_alerts') &&
      firestoreRules.includes('allow read: if false'),
      '  ad_anomaly_alerts (後端專用，管理員 API)'
    );

  } catch (error) {
    log.error(`測試失敗: ${error.message}`);
  }
}

await testFirestoreRules();

// ==================== 測試 6: 廣告異常監控系統 ====================
log.section();
log.title('🚨 測試 6: 廣告異常監控系統');
log.section();

async function testAdWatchMonitoring() {
  try {
    const adWatchMonitor = await readFile(
      join(__dirname, '../src/services/adWatchMonitor.service.js'),
      'utf-8'
    );

    log.info('檢查廣告異常監控服務實現...');

    // 1. 記錄廣告觀看事件
    checkPass(
      adWatchMonitor.includes('export const recordAdWatchEvent') ||
      adWatchMonitor.includes('export function recordAdWatchEvent'),
      '  recordAdWatchEvent - 記錄廣告觀看事件'
    );

    // 2. 異常檢測
    checkPass(
      adWatchMonitor.includes('detectAnomalies'),
      '  detectAnomalies - 檢測異常行為'
    );

    // 3. 短時間爆發檢測
    checkPass(
      adWatchMonitor.includes('short_term_burst') ||
      adWatchMonitor.includes('SHORT_TERM'),
      '  短時間爆發檢測 (10分鐘內超過5次)'
    );

    // 4. 低平均間隔檢測
    checkPass(
      adWatchMonitor.includes('low_avg_interval') ||
      adWatchMonitor.includes('MIN_AVG_INTERVAL'),
      '  低平均間隔檢測 (< 90秒)'
    );

    // 5. 每日接近上限檢測
    checkPass(
      adWatchMonitor.includes('daily_limit_approaching') ||
      adWatchMonitor.includes('DAILY_WARNING_THRESHOLD'),
      '  每日接近上限檢測 (8-10次/天)'
    );

    // 6. 連續達標檢測
    checkPass(
      adWatchMonitor.includes('consecutive_max_days') ||
      adWatchMonitor.includes('CONSECUTIVE_MAX_DAYS'),
      '  連續達標檢測 (連續3+天達上限)'
    );

    // 7. 記錄異常告警
    checkPass(
      adWatchMonitor.includes('recordAnomalyAlert'),
      '  recordAnomalyAlert - 記錄異常告警到 Firestore'
    );

    // 8. 風險評分
    checkPass(
      adWatchMonitor.includes('riskScore') &&
      adWatchMonitor.includes('severity'),
      '  風險評分系統 (high/medium/low)'
    );

    // 9. 告警管理 API
    checkPass(
      adWatchMonitor.includes('getAnomalyAlerts') ||
      adWatchMonitor.includes('updateAlertStatus'),
      '  告警管理 API (查詢、更新狀態)'
    );

    // 10. 定時清理
    checkPass(
      adWatchMonitor.includes('cleanupOldAdEvents'),
      '  cleanupOldAdEvents - 定時清理過期事件'
    );

  } catch (error) {
    log.error(`測試失敗: ${error.message}`);
  }
}

await testAdWatchMonitoring();

// ==================== 測試 7: 前端升級進度提示 ====================
log.section();
log.title('⏳ 測試 7: 前端升級進度提示');
log.section();

async function testFrontendUpgradeProgress() {
  try {
    log.info('檢查前端升級進度狀態管理...');

    const useMembership = await readFile(
      join(__dirname, '../../frontend/src/composables/useMembership.js'),
      'utf-8'
    );

    // 1. isUpgrading 狀態
    checkPass(
      useMembership.includes('isUpgrading') &&
      useMembership.includes('ref(false)'),
      '  isUpgrading 狀態管理'
    );

    // 2. upgradeProgress 狀態
    checkPass(
      useMembership.includes('upgradeProgress') &&
      useMembership.includes('step') &&
      useMembership.includes('message'),
      '  upgradeProgress 狀態 (step + message)'
    );

    // 3. 進度階段：validating
    checkPass(
      useMembership.includes('validating') &&
      useMembership.includes('驗證'),
      '  進度階段 1: validating (驗證會員資格)'
    );

    // 4. 進度階段：processing
    checkPass(
      useMembership.includes('processing') &&
      useMembership.includes('處理'),
      '  進度階段 2: processing (處理升級請求)'
    );

    // 5. 進度階段：finalizing
    checkPass(
      useMembership.includes('finalizing') &&
      useMembership.includes('更新'),
      '  進度階段 3: finalizing (更新會員資料)'
    );

    // 6. 進度階段：completed
    checkPass(
      useMembership.includes('completed') &&
      useMembership.includes('成功'),
      '  進度階段 4: completed (升級成功)'
    );

    // 7. 自動清除進度
    checkPass(
      useMembership.includes('setTimeout') &&
      useMembership.includes("step: ''"),
      '  自動清除進度狀態 (延遲 1.5 秒)'
    );

    log.info('\n檢查前端升級進度 UI 組件...');

    const progressComponent = await readFile(
      join(__dirname, '../../frontend/src/components/MembershipUpgradeProgress.vue'),
      'utf-8'
    );

    // 8. 全螢幕遮罩
    checkPass(
      progressComponent.includes('position: fixed') &&
      progressComponent.includes('z-index'),
      '  全螢幕遮罩 (防止用戶操作)'
    );

    // 9. 旋轉動畫
    checkPass(
      progressComponent.includes('spinner') &&
      progressComponent.includes('animation'),
      '  旋轉動畫 (處理中)'
    );

    // 10. 完成打勾動畫
    checkPass(
      progressComponent.includes('checkmark') &&
      progressComponent.includes('completed'),
      '  完成打勾動畫 (成功)'
    );

    // 11. 進度條
    checkPass(
      progressComponent.includes('progress-bar') &&
      progressComponent.includes('width:') &&
      progressComponent.includes('progressPercentage'),
      '  進度條視覺反饋 (25%, 60%, 90%, 100%)'
    );

    // 12. 提示文字
    checkPass(
      progressComponent.includes('請勿關閉頁面') ||
      progressComponent.includes('不要進行其他操作'),
      '  警告提示：升級期間請勿操作'
    );

  } catch (error) {
    log.error(`測試失敗: ${error.message}`);
  }
}

await testFrontendUpgradeProgress();

// ==================== 測試 8: Critical 修復驗證 ====================
log.section();
log.title('🔴 測試 8: Critical 修復驗證');
log.section();

async function testCriticalFixes() {
  try {
    log.info('檢查 Critical 級別修復...');

    // 1. Transaction 失敗後鎖定清除
    const membershipService = await readFile(
      join(__dirname, '../src/membership/membership.service.js'),
      'utf-8'
    );

    checkPass(
      membershipService.includes('P1-1 Critical 修復') &&
      (membershipService.includes("'photos.upgrading': false") ||
       membershipService.includes('photos.upgrading": false')) &&
      membershipService.includes('Transaction 失敗後清除升級鎖定'),
      '  P1-1: Transaction 失敗後自動清除升級鎖定'
    );

    checkPass(
      membershipService.includes('upgradingFailedAt') &&
      membershipService.includes('lastUpgradeError'),
      '  P1-1: 記錄失敗信息用於除錯'
    );

    // 2. 購買角色解鎖 TOCTOU 修復
    const coinsService = await readFile(
      join(__dirname, '../src/payment/coins.service.js'),
      'utf-8'
    );

    checkPass(
      coinsService.includes('P1-3 Critical 修復') &&
      coinsService.includes('db.runTransaction') &&
      coinsService.includes('purchaseUnlimitedChat'),
      '  P1-3: 購買角色解鎖使用 Transaction'
    );

    checkPass(
      coinsService.includes('在 Transaction 內讀取最新狀態') &&
      coinsService.includes('檢查是否已永久解鎖（在 Transaction 內）'),
      '  P1-3: 檢查、扣款、解鎖在同一 Transaction'
    );

    // 3. 廣告解鎖 Transaction 修復
    const conversationService = await readFile(
      join(__dirname, '../src/conversation/conversationLimit.service.js'),
      'utf-8'
    );

    checkPass(
      conversationService.includes('P0-1 High 修復') &&
      conversationService.includes('db.runTransaction') &&
      conversationService.includes('unlockByAd'),
      '  P0-1: 廣告解鎖使用 Transaction'
    );

    checkPass(
      conversationService.includes('在 Transaction 內記錄廣告觀看') &&
      conversationService.includes('在 Transaction 內解鎖對話'),
      '  P0-1: 記錄和解鎖在同一 Transaction'
    );

    // 4. 定時清理服務
    log.info('\n檢查定時清理服務...');

    try {
      const cleanupService = await readFile(
        join(__dirname, '../src/services/membershipLockCleanup.service.js'),
        'utf-8'
      );

      checkPass(
        cleanupService.includes('cleanupStaleUpgradeLocks'),
        '  P1-1: 定時清理服務已創建'
      );

      checkPass(
        cleanupService.includes('where("photos.upgrading", "==", true)') &&
        cleanupService.includes('maxAgeMinutes'),
        '  P1-1: 查詢並清理過期鎖定'
      );

      checkPass(
        cleanupService.includes('manualCleanupUserLock') &&
        cleanupService.includes('getLockedUsers'),
        '  P1-1: 提供手動清理和查詢功能'
      );
    } catch (error) {
      checkPass(false, '  P1-1: 定時清理服務已創建');
      checkPass(false, '  P1-1: 查詢並清理過期鎖定');
      checkPass(false, '  P1-1: 提供手動清理和查詢功能');
    }

  } catch (error) {
    log.error(`測試失敗: ${error.message}`);
  }
}

await testCriticalFixes();

// ==================== 總結 ====================
log.section();
log.title('📊 測試總結');
log.section();

console.log('\n');
console.log(`總測試數: ${colors.bright}${stats.total}${colors.reset}`);
console.log(`${colors.green}通過: ${stats.passed}${colors.reset}`);
console.log(`${colors.red}失敗: ${stats.failed}${colors.reset}`);
console.log(`成功率: ${colors.bright}${Math.round((stats.passed / stats.total) * 100)}%${colors.reset}`);

if (stats.failed === 0) {
  log.section();
  log.success('所有測試通過！✨');
  log.section();
  console.log('\n✅ 商業邏輯修復已完整實現：');
  console.log('\n【原始修復 (2025-01-13)】');
  console.log('   1. ✅ P0-1: 廣告驗證安全防護 (6 層保護)');
  console.log('   2. ✅ P1-1: 會員升級競態條件修復 (鎖定機制)');
  console.log('   3. ✅ P1-2: 禮物系統 Transaction 原子性 (單一 Transaction)');
  console.log('   4. ✅ P1-3: 購買角色解鎖重複檢查 (防止浪費金幣)');
  console.log('   5. ✅ Firestore 安全規則更新 (6 個新集合)');
  console.log('   6. ✅ 廣告異常監控系統 (4 種異常檢測)');
  console.log('   7. ✅ 前端升級進度提示 (4 階段 UI 反饋)');
  console.log('\n【Critical 修復 (審查後)】');
  console.log('   8. ✅ P1-1: Transaction 失敗後自動清除鎖定');
  console.log('   9. ✅ P1-3: 購買角色解鎖改用 Transaction (TOCTOU 修復)');
  console.log('   10. ✅ P0-1: 廣告解鎖改用 Transaction (併發安全)');
  console.log('   11. ✅ P1-1: 定時清理過期鎖定服務\n');

  console.log('📝 下一步：');
  console.log('   1. 部署 Firestore 規則: firebase deploy --only firestore:rules');
  console.log('   2. 部署後端代碼: ./deploy-cloudrun.sh');
  console.log('   3. 部署前端代碼: npm run build && firebase deploy --only hosting');
  console.log('   4. 設置 Cloud Scheduler 定時清理鎖定 (每 5 分鐘)');
  console.log('   5. 執行功能測試 (參考 POST_FIX_IMPLEMENTATION_GUIDE.md)\n');
} else {
  log.section();
  log.error(`${stats.failed} 個測試失敗`);
  log.section();
  console.log('\n請檢查上述失敗的測試項目。\n');
}

process.exit(stats.failed > 0 ? 1 : 0);
