/**
 * 測試運行時環境變數
 * 用於診斷環境變數加載問題
 */

import 'dotenv/config';

console.log('========== 環境變數檢查 ==========\n');

const requiredVars = [
  'PORT',
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
];

console.log('必要環境變數：\n');

let allPresent = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    if (varName === 'FIREBASE_ADMIN_PRIVATE_KEY') {
      // 只顯示前後各 30 個字元
      const preview = value.substring(0, 30) + '...' + value.substring(value.length - 30);
      console.log(`✅ ${varName}: ${preview}`);
    } else {
      console.log(`✅ ${varName}: ${value}`);
    }
  } else {
    console.log(`❌ ${varName}: 未設置`);
    allPresent = false;
  }
});

console.log('\n其他重要環境變數：\n');

const optionalVars = [
  'NODE_ENV',
  'CORS_ORIGIN',
  'USE_FIREBASE_EMULATOR',
];

optionalVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`${value ? '✅' : '⚪'} ${varName}: ${value || '(未設置)'}`);
});

console.log('\n========== 總結 ==========\n');

if (allPresent) {
  console.log('✅ 所有必要環境變數都已設置');
} else {
  console.log('❌ 有環境變數缺失，請檢查 .env 文件');
}
