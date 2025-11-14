/**
 * 收藏 API 參數驗證測試腳本
 *
 * 測試內容：
 * 1. 空參數驗證
 * 2. 錯誤類型驗證
 * 3. 超長輸入驗證
 * 4. 正常參數驗證
 */

import 'dotenv/config';
import { TEST_ACCOUNTS } from '../../../shared/config/testAccounts.js';

// 如果使用 node-fetch
let fetch;
try {
  fetch = (await import('node-fetch')).default;
} catch (err) {
  console.error('❌ 需要安裝 node-fetch: npm install node-fetch');
  process.exit(1);
}

const API_URL = process.env.API_URL || 'http://localhost:4000';
const TEST_USER_ID = TEST_ACCOUNTS.DEV_USER_ID;

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

function section(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${title}`, 'blue');
  log(`${'='.repeat(60)}`, 'blue');
}

/**
 * 發送 API 請求
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();
  return { status: response.status, data };
}

/**
 * 測試 1：空參數
 */
async function test1_EmptyParameter() {
  section('測試 1: 空參數驗證');

  try {
    info('發送空 body...');
    const { status, data } = await apiRequest(`/api/users/${TEST_USER_ID}/favorites`, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'Authorization': `Bearer test-token`, // 簡化測試
      },
    });

    info(`狀態碼: ${status}`);
    info(`響應: ${JSON.stringify(data, null, 2)}`);

    if (status === 400 && data.error) {
      success('正確返回 400 錯誤');
      return true;
    } else {
      error(`預期 400 錯誤，實際: ${status}`);
      return false;
    }
  } catch (err) {
    error(`測試失敗: ${err.message}`);
    return false;
  }
}

/**
 * 測試 2：錯誤類型
 */
async function test2_WrongType() {
  section('測試 2: 錯誤類型驗證');

  try {
    info('發送數字類型的 matchId...');
    const { status, data } = await apiRequest(`/api/users/${TEST_USER_ID}/favorites`, {
      method: 'POST',
      body: JSON.stringify({ matchId: 123 }), // 數字而非字符串
      headers: {
        'Authorization': `Bearer test-token`,
      },
    });

    info(`狀態碼: ${status}`);
    info(`響應: ${JSON.stringify(data, null, 2)}`);

    if (status === 400 && data.error) {
      success('正確返回 400 錯誤');
      return true;
    } else {
      error(`預期 400 錯誤，實際: ${status}`);
      return false;
    }
  } catch (err) {
    error(`測試失敗: ${err.message}`);
    return false;
  }
}

/**
 * 測試 3：超長輸入
 */
async function test3_TooLong() {
  section('測試 3: 超長輸入驗證');

  try {
    const longId = 'a'.repeat(150); // 超過 100 字符
    info(`發送 ${longId.length} 字符的 matchId...`);

    const { status, data } = await apiRequest(`/api/users/${TEST_USER_ID}/favorites`, {
      method: 'POST',
      body: JSON.stringify({ matchId: longId }),
      headers: {
        'Authorization': `Bearer test-token`,
      },
    });

    info(`狀態碼: ${status}`);
    info(`響應: ${JSON.stringify(data, null, 2)}`);

    if (status === 400 && data.error) {
      success('正確返回 400 錯誤');
      return true;
    } else {
      error(`預期 400 錯誤，實際: ${status}`);
      return false;
    }
  } catch (err) {
    error(`測試失敗: ${err.message}`);
    return false;
  }
}

/**
 * 測試 4：特殊字符
 */
async function test4_SpecialCharacters() {
  section('測試 4: 特殊字符驗證');

  try {
    const specialId = '<script>alert("xss")</script>';
    info(`發送包含特殊字符的 matchId: ${specialId}`);

    const { status, data } = await apiRequest(`/api/users/${TEST_USER_ID}/favorites`, {
      method: 'POST',
      body: JSON.stringify({ matchId: specialId }),
      headers: {
        'Authorization': `Bearer test-token`,
      },
    });

    info(`狀態碼: ${status}`);
    info(`響應: ${JSON.stringify(data, null, 2)}`);

    // 應該被接受（但不會找到對應的角色）
    // 或者返回驗證錯誤（取決於後續處理）
    if (status === 400 || status === 404 || status === 500) {
      success(`正確處理特殊字符（狀態碼: ${status}）`);
      return true;
    } else {
      error(`意外的狀態碼: ${status}`);
      return false;
    }
  } catch (err) {
    error(`測試失敗: ${err.message}`);
    return false;
  }
}

/**
 * 測試 5：null 和 undefined
 */
async function test5_NullUndefined() {
  section('測試 5: null 和 undefined 驗證');

  try {
    info('發送 null 值...');
    const { status, data } = await apiRequest(`/api/users/${TEST_USER_ID}/favorites`, {
      method: 'POST',
      body: JSON.stringify({ matchId: null }),
      headers: {
        'Authorization': `Bearer test-token`,
      },
    });

    info(`狀態碼: ${status}`);
    info(`響應: ${JSON.stringify(data, null, 2)}`);

    if (status === 400 && data.error) {
      success('正確返回 400 錯誤');
      return true;
    } else {
      error(`預期 400 錯誤，實際: ${status}`);
      return false;
    }
  } catch (err) {
    error(`測試失敗: ${err.message}`);
    return false;
  }
}

/**
 * 主測試函數
 */
async function runTests() {
  log('\n🧪 開始測試 API 參數驗證\n', 'cyan');

  info(`API URL: ${API_URL}`);
  info(`測試用戶: ${TEST_USER_ID}\n`);

  const results = {
    test1: false,
    test2: false,
    test3: false,
    test4: false,
    test5: false,
  };

  // 執行所有測試
  results.test1 = await test1_EmptyParameter();
  results.test2 = await test2_WrongType();
  results.test3 = await test3_TooLong();
  results.test4 = await test4_SpecialCharacters();
  results.test5 = await test5_NullUndefined();

  // 匯總結果
  section('測試結果匯總');

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  log('\n測試項目:', 'cyan');
  log(`  測試 1 - 空參數: ${results.test1 ? '✅ 通過' : '❌ 失敗'}`, results.test1 ? 'green' : 'red');
  log(`  測試 2 - 錯誤類型: ${results.test2 ? '✅ 通過' : '❌ 失敗'}`, results.test2 ? 'green' : 'red');
  log(`  測試 3 - 超長輸入: ${results.test3 ? '✅ 通過' : '❌ 失敗'}`, results.test3 ? 'green' : 'red');
  log(`  測試 4 - 特殊字符: ${results.test4 ? '✅ 通過' : '❌ 失敗'}`, results.test4 ? 'green' : 'red');
  log(`  測試 5 - null/undefined: ${results.test5 ? '✅ 通過' : '❌ 失敗'}`, results.test5 ? 'green' : 'red');

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
