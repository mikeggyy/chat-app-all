/**
 * 運行所有商業邏輯測試
 * 依次執行：會員升級測試、角色解鎖購買測試
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
  console.log('\n' + '='.repeat(70));
  log(`${message}`, 'cyan');
  console.log('='.repeat(70) + '\n');
}

// 運行單個測試腳本
function runTest(scriptName) {
  return new Promise((resolve, reject) => {
    log(`🚀 運行: ${scriptName}`, 'blue');

    const scriptPath = join(__dirname, scriptName);
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${scriptName} 通過\n`, 'green');
        resolve(true);
      } else {
        log(`❌ ${scriptName} 失敗\n`, 'red');
        resolve(false);
      }
    });

    child.on('error', (error) => {
      log(`❌ ${scriptName} 執行錯誤: ${error.message}\n`, 'red');
      reject(error);
    });
  });
}

// 主執行函數
async function runAllTests() {
  logHeader('🧪 商業邏輯測試套件');
  log(`測試時間: ${new Date().toLocaleString('zh-TW')}`, 'blue');
  log(`環境: ${process.env.USE_FIREBASE_EMULATOR ? 'Firebase Emulator' : '生產環境 Firestore'}`, 'blue');

  const tests = [
    { name: '會員升級測試', script: 'test-membership-upgrade.js' },
    { name: '角色解鎖購買測試', script: 'test-character-unlock.js' },
  ];

  const results = [];

  for (const test of tests) {
    logHeader(`📋 ${test.name}`);

    try {
      const passed = await runTest(test.script);
      results.push({ name: test.name, passed });
    } catch (error) {
      log(`❌ ${test.name} 執行失敗: ${error.message}`, 'red');
      results.push({ name: test.name, passed: false });
    }
  }

  // 輸出總結
  logHeader('📊 測試總結');

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  results.forEach(r => {
    if (r.passed) {
      log(`✅ ${r.name}: 通過`, 'green');
    } else {
      log(`❌ ${r.name}: 失敗`, 'red');
    }
  });

  console.log('\n' + '='.repeat(70));
  if (passedCount === totalCount) {
    log(`${colors.bold}${colors.green}🎉 所有測試通過！(${passedCount}/${totalCount})${colors.reset}`, 'green');
  } else {
    log(`${colors.bold}${colors.red}⚠️  部分測試失敗 (${passedCount}/${totalCount})${colors.reset}`, 'red');
  }
  console.log('='.repeat(70) + '\n');

  process.exit(passedCount === totalCount ? 0 : 1);
}

// 執行測試
runAllTests().catch(error => {
  log(`❌ 測試套件執行失敗: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
