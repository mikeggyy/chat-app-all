/**
 * 測試運行包裝腳本 - 自動載入環境變數
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 載入環境變數
const envPath = join(__dirname, '..', '.env');
config({ path: envPath });

console.log('🔧 載入環境變數...');
console.log(`📁 環境文件: ${envPath}`);
console.log(`✅ Firebase Project ID: ${process.env.FIREBASE_ADMIN_PROJECT_ID ? '已設置' : '❌ 未設置'}\n`);

// 獲取測試腳本名稱
const testScript = process.argv[2];

if (!testScript) {
  console.error('❌ 請指定測試腳本名稱');
  console.log('\n使用方式:');
  console.log('  node scripts/run-tests.js test-membership-upgrade.js');
  console.log('  node scripts/run-tests.js test-character-unlock.js');
  console.log('  node scripts/run-tests.js test-all-business-logic.js');
  process.exit(1);
}

// 運行測試腳本
const scriptPath = join(__dirname, testScript);
console.log(`🚀 運行測試: ${testScript}\n`);

const child = spawn('node', [scriptPath], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env }, // 傳遞環境變數
});

child.on('close', (code) => {
  process.exit(code);
});

child.on('error', (error) => {
  console.error(`❌ 執行錯誤: ${error.message}`);
  process.exit(1);
});
