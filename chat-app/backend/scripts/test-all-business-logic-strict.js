/**
 * 🔥 嚴格商業邏輯測試 - 統一執行腳本
 *
 * 運行所有嚴格的商業邏輯測試:
 * 1. test-coins-strict.js - 金幣系統 (並發、Transaction、邊界條件)
 * 2. test-limits-strict.js - 限制服務 (並發、重置邏輯、廣告解鎖)
 * 3. test-membership-upgrade.js - 會員升級 (現有測試)
 * 4. test-character-unlock.js - 角色解鎖 (現有測試)
 *
 * ⚠️ 這些測試會真正發現問題!
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('\n' + '='.repeat(80));
  log(`${message}`, 'cyan');
  console.log('='.repeat(80) + '\n');
}

// 運行單個測試腳本
function runTest(scriptName, description) {
  return new Promise((resolve, reject) => {
    log(`🚀 運行: ${description}`, 'blue');
    log(`   腳本: ${scriptName}`, 'blue');
    console.log();

    const scriptPath = join(__dirname, scriptName);
    const startTime = Date.now();

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      const elapsed = Date.now() - startTime;

      if (code === 0) {
        log(`✅ ${description} - 通過 (${elapsed}ms)\n`, 'green');
        resolve({ name: description, passed: true, elapsed });
      } else {
        log(`❌ ${description} - 失敗 (${elapsed}ms)\n`, 'red');
        resolve({ name: description, passed: false, elapsed });
      }
    });

    child.on('error', (error) => {
      log(`❌ ${description} - 執行錯誤: ${error.message}\n`, 'red');
      reject(error);
    });
  });
}

// 主執行函數
async function runAllTests() {
  const startTime = Date.now();

  logHeader('🔥 嚴格商業邏輯測試套件 - 開始執行');
  log(`測試時間: ${new Date().toLocaleString('zh-TW')}`, 'blue');
  log(`環境: ${process.env.USE_FIREBASE_EMULATOR ? 'Firebase Emulator' : '生產環境 Firestore'}`, 'blue');

  const tests = [
    {
      name: '金幣系統嚴格測試',
      script: 'test-coins-strict.js',
      description: '並發購買、Transaction 原子性、數據一致性、邊界條件 (8 個測試)'
    },
    {
      name: '限制服務嚴格測試',
      script: 'test-limits-strict.js',
      description: '並發消息、語音限制、廣告解鎖、跨角色獨立性 (8 個測試)'
    },
    {
      name: '冪等性系統嚴格測試',
      script: 'test-idempotency-strict.js',
      description: '並發相同 key、key 過期重新執行、響應緩存、跨集合一致性 (8 個測試)'
    },
    {
      name: '會員升級測試',
      script: 'test-membership-upgrade.js',
      description: '會員升級流程、並發防護、獎勵發放 (5 個測試)'
    },
    {
      name: '角色解鎖購買測試',
      script: 'test-character-unlock.js',
      description: '解鎖券/金幣購買、數據遷移、重複購買防護 (6 個測試)'
    },
  ];

  const results = [];

  for (const test of tests) {
    logHeader(`📋 ${test.name}`);
    log(test.description, 'blue');
    console.log();

    try {
      const result = await runTest(test.script, test.name);
      results.push(result);
    } catch (error) {
      log(`❌ ${test.name} 執行失敗: ${error.message}`, 'red');
      results.push({ name: test.name, passed: false, elapsed: 0 });
    }
  }

  const totalElapsed = Date.now() - startTime;

  // 輸出總結
  logHeader('📊 測試總結');

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  results.forEach(r => {
    if (r.passed) {
      log(`✅ ${r.name}: 通過 (${r.elapsed}ms)`, 'green');
    } else {
      log(`❌ ${r.name}: 失敗 (${r.elapsed}ms)`, 'red');
    }
  });

  console.log('\n' + '='.repeat(80));
  log(`總耗時: ${(totalElapsed / 1000).toFixed(2)}s`, 'blue');

  if (passedCount === totalCount) {
    log(`${colors.bold}${colors.green}🎉 所有測試通過！(${passedCount}/${totalCount})${colors.reset}`, 'green');
    console.log('='.repeat(80));

    // 顯示統計
    console.log('\n' + '='.repeat(80));
    log('📈 測試統計', 'cyan');
    console.log('='.repeat(80));
    log('✅ 金幣系統: 8 個嚴格測試 (並發、Transaction、邊界)', 'blue');
    log('✅ 限制服務: 8 個嚴格測試 (並發、限制計數、廣告)', 'blue');
    log('✅ 冪等性系統: 8 個嚴格測試 (並發 key、過期重執行、響應緩存)', 'blue');
    log('✅ 會員升級: 5 個測試 (並發防護、獎勵發放)', 'blue');
    log('✅ 角色解鎖: 6 個測試 (購買、數據遷移)', 'blue');
    log('', 'reset');
    log(`${colors.bold}總計: 35+ 個嚴格商業邏輯測試${colors.reset}`, 'cyan');
    console.log('='.repeat(80) + '\n');

    process.exit(0);
  } else {
    log(`${colors.bold}${colors.red}⚠️  部分測試失敗 (${passedCount}/${totalCount})${colors.reset}`, 'red');
    console.log('='.repeat(80));

    // 顯示失敗的測試
    console.log('\n' + '='.repeat(80));
    log('❌ 失敗的測試', 'red');
    console.log('='.repeat(80));

    results.filter(r => !r.passed).forEach(r => {
      log(`  - ${r.name}`, 'red');
    });

    console.log('='.repeat(80) + '\n');

    process.exit(1);
  }
}

// 執行測試
log('\n🚀 開始執行嚴格商業邏輯測試套件...\n', 'cyan');

runAllTests().catch(error => {
  log(`❌ 測試套件執行失敗: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
