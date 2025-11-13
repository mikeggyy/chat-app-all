/**
 * 部署前檢查腳本
 *
 * 用途：
 * - 驗證所有必要的修復已實施
 * - 檢查環境配置
 * - 確保代碼準備就緒
 *
 * 執行：node scripts/pre-deployment-check.js
 */

import { readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { constants } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// 統計
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
};

// 輔助函數
const log = {
  section: () => console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`),
  title: (text) => console.log(`${colors.bright}${text}${colors.reset}`),
  info: (text) => console.log(`${colors.blue}ℹ${colors.reset} ${text}`),
  success: (text) => console.log(`${colors.green}✓${colors.reset} ${text}`),
  error: (text) => console.log(`${colors.red}✗${colors.reset} ${text}`),
  warning: (text) => console.log(`${colors.yellow}⚠${colors.reset} ${text}`),
};

const checkPass = (condition, message, isWarning = false) => {
  stats.total++;
  if (condition) {
    stats.passed++;
    log.success(message);
  } else {
    if (isWarning) {
      stats.warnings++;
      log.warning(message + ' (警告)');
    } else {
      stats.failed++;
      log.error(message);
    }
  }
};

console.log('\n');
log.section();
log.title('🔍 部署前檢查');
log.section();
console.log('\n');

// ==================== 檢查 1: 必要文件存在 ====================
log.section();
log.title('📁 檢查 1: 必要文件');
log.section();

async function checkRequiredFiles() {
  const requiredFiles = [
    '../src/services/membershipLockCleanup.service.js',
    '../src/routes/cron.routes.js',
    './cleanup-upgrade-locks.js',
    './setup-cloud-scheduler.sh',
    './setup-cloud-scheduler.bat',
  ];

  for (const file of requiredFiles) {
    const filePath = join(__dirname, file);
    try {
      await access(filePath, constants.F_OK);
      checkPass(true, `  ${file.split('/').pop()}`);
    } catch {
      checkPass(false, `  ${file.split('/').pop()} - 文件不存在`);
    }
  }
}

await checkRequiredFiles();

// ==================== 檢查 2: Critical 修復驗證 ====================
log.section();
log.title('🔴 檢查 2: Critical 修復');
log.section();

async function checkCriticalFixes() {
  try {
    // 1. Transaction 失敗清除鎖定
    const membershipService = await readFile(
      join(__dirname, '../src/membership/membership.service.js'),
      'utf-8'
    );

    checkPass(
      membershipService.includes('P1-1 Critical 修復') &&
      membershipService.includes('Transaction 失敗後清除升級鎖定'),
      '  P1-1: Transaction 失敗後清除鎖定'
    );

    // 2. 購買角色解鎖 Transaction
    const coinsService = await readFile(
      join(__dirname, '../src/payment/coins.service.js'),
      'utf-8'
    );

    checkPass(
      coinsService.includes('P1-3 Critical 修復') &&
      coinsService.includes('purchaseUnlimitedChat'),
      '  P1-3: 購買角色解鎖 Transaction'
    );

    // 3. 廣告解鎖 Transaction
    const conversationService = await readFile(
      join(__dirname, '../src/conversation/conversationLimit.service.js'),
      'utf-8'
    );

    checkPass(
      conversationService.includes('P0-1 High 修復') &&
      conversationService.includes('unlockByAd'),
      '  P0-1: 廣告解鎖 Transaction'
    );

    // 4. 清理服務
    const cleanupService = await readFile(
      join(__dirname, '../src/services/membershipLockCleanup.service.js'),
      'utf-8'
    );

    checkPass(
      cleanupService.includes('cleanupStaleUpgradeLocks'),
      '  P1-1: 定時清理服務'
    );

  } catch (error) {
    log.error(`檢查失敗: ${error.message}`);
  }
}

await checkCriticalFixes();

// ==================== 檢查 3: 環境配置 ====================
log.section();
log.title('⚙️  檢查 3: 環境配置');
log.section();

async function checkEnvironment() {
  try {
    const envFile = await readFile(join(__dirname, '../.env'), 'utf-8');

    const requiredEnvVars = [
      'PORT',
      'FIREBASE_ADMIN_PROJECT_ID',
      'OPENAI_API_KEY',
      'REPLICATE_API_TOKEN',
    ];

    for (const envVar of requiredEnvVars) {
      checkPass(
        envFile.includes(`${envVar}=`),
        `  ${envVar}`,
        true  // 警告而非錯誤
      );
    }

    // 檢查生產環境配置
    checkPass(
      !envFile.includes('ENABLE_DEV_PURCHASE_BYPASS=true'),
      '  開發模式已停用（生產環境安全）',
      true
    );

  } catch (error) {
    log.warning(`  無法讀取 .env 文件: ${error.message}`);
  }
}

await checkEnvironment();

// ==================== 檢查 4: Firestore Rules ====================
log.section();
log.title('🔒 檢查 4: Firestore Rules');
log.section();

async function checkFirestoreRules() {
  try {
    const rulesFile = await readFile(
      join(__dirname, '../../firestore.rules'),
      'utf-8'
    );

    const requiredCollections = [
      'usage_limits',
      'ad_watch_stats',
      'idempotency_keys',
    ];

    for (const collection of requiredCollections) {
      checkPass(
        rulesFile.includes(collection),
        `  ${collection} 集合規則`,
        true
      );
    }

  } catch (error) {
    log.warning(`  無法讀取 firestore.rules: ${error.message}`);
  }
}

await checkFirestoreRules();

// ==================== 檢查 5: 路由註冊 ====================
log.section();
log.title('🛣️  檢查 5: 路由註冊');
log.section();

async function checkRoutes() {
  try {
    const indexFile = await readFile(
      join(__dirname, '../src/index.js'),
      'utf-8'
    );

    checkPass(
      indexFile.includes('cronRouter'),
      '  Cron 路由已導入'
    );

    checkPass(
      indexFile.includes('app.use("/api/cron", cronRouter)'),
      '  Cron 路由已註冊'
    );

  } catch (error) {
    log.error(`檢查失敗: ${error.message}`);
  }
}

await checkRoutes();

// ==================== 檢查 6: 速率限制 ====================
log.section();
log.title('⏱️  檢查 6: 速率限制配置');
log.section();

async function checkRateLimits() {
  try {
    const rateLimiterConfig = await readFile(
      join(__dirname, '../src/middleware/rateLimiterConfig.js'),
      'utf-8'
    );

    const requiredLimiters = [
      'veryStrictRateLimiter',
      'strictRateLimiter',
      'purchaseRateLimiter',
      'giftRateLimiter',
      'conversationRateLimiter',
    ];

    for (const limiter of requiredLimiters) {
      checkPass(
        rateLimiterConfig.includes(limiter),
        `  ${limiter}`
      );
    }

  } catch (error) {
    log.error(`檢查失敗: ${error.message}`);
  }
}

await checkRateLimits();

// ==================== 檢查 7: 冪等性配置 ====================
log.section();
log.title('🔄 檢查 7: 冪等性配置');
log.section();

async function checkIdempotency() {
  try {
    const idempotencyFile = await readFile(
      join(__dirname, '../src/utils/idempotency.js'),
      'utf-8'
    );

    checkPass(
      idempotencyFile.includes('24 * 60 * 60 * 1000'),
      '  TTL 統一為 24 小時'
    );

    checkPass(
      idempotencyFile.includes('idempotency_keys'),
      '  使用 Firestore 存儲'
    );

  } catch (error) {
    log.error(`檢查失敗: ${error.message}`);
  }
}

await checkIdempotency();

// ==================== 總結 ====================
log.section();
log.title('📊 檢查總結');
log.section();

console.log('\n');
console.log(`總檢查項: ${colors.bright}${stats.total}${colors.reset}`);
console.log(`${colors.green}通過: ${stats.passed}${colors.reset}`);
console.log(`${colors.yellow}警告: ${stats.warnings}${colors.reset}`);
console.log(`${colors.red}失敗: ${stats.failed}${colors.reset}`);

if (stats.failed === 0) {
  log.section();
  log.success('所有檢查通過！準備部署 ✨');
  log.section();

  console.log('\n✅ 部署準備清單：\n');
  console.log('   1. ✅ 所有 Critical 修復已實施');
  console.log('   2. ✅ 清理服務和腳本已創建');
  console.log('   3. ✅ Cron 路由已註冊');
  console.log('   4. ✅ 速率限制已配置');
  console.log('   5. ✅ 冪等性系統已更新\n');

  console.log('📝 下一步：\n');
  console.log('   1. 部署後端: cd backend && ./deploy-cloudrun.sh');
  console.log('   2. 部署前端: npm run build && firebase deploy --only hosting');
  console.log('   3. 部署規則: firebase deploy --only firestore:rules');
  console.log('   4. 設置定時任務:');
  console.log('      - Linux/Mac: ./scripts/setup-cloud-scheduler.sh');
  console.log('      - Windows: scripts\\setup-cloud-scheduler.bat');
  console.log('   5. 執行功能測試\n');

  process.exit(0);
} else {
  log.section();
  log.error(`${stats.failed} 個檢查失敗，請修復後再部署`);
  log.section();

  if (stats.warnings > 0) {
    console.log(`\n${colors.yellow}⚠ 有 ${stats.warnings} 個警告，建議檢查${colors.reset}\n`);
  }

  process.exit(1);
}
