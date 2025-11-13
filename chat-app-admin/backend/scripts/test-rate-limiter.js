/**
 * 速率限制器測試腳本
 * 驗證管理後台的速率限制配置是否正常工作
 *
 * 使用方法：
 * 1. 確保後端服務正在運行（npm run dev）
 * 2. 設置環境變數 ADMIN_TOKEN（管理員的 Firebase Auth Token）
 * 3. 運行：node scripts/test-rate-limiter.js
 */

import 'dotenv/config';
import axios from 'axios';

// 配置
const API_URL = process.env.API_URL || 'http://localhost:4001';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

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
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}`),
};

// 創建 axios 實例
const createApiClient = (token, csrfToken = null) => {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 如果有 CSRF token，添加到標頭
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  return axios.create({
    baseURL: API_URL,
    headers,
    validateStatus: () => true, // 不自動拋出錯誤
  });
};

// 延遲函數
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 測試速率限制器
 */
async function testRateLimiter(api, endpoint, method = 'GET', limit = 5, windowMs = 60000) {
  log.section(`測試端點: ${method} ${endpoint}`);
  log.info(`預期限制: ${limit} 次/${windowMs / 1000} 秒`);

  const results = {
    success: 0,
    rateLimited: 0,
    errors: 0,
  };

  // 快速發送請求直到觸發速率限制
  for (let i = 1; i <= limit + 5; i++) {
    try {
      const response = await api.request({
        method,
        url: endpoint,
        data: method !== 'GET' ? {} : undefined,
      });

      if (response.status === 429) {
        results.rateLimited++;
        log.warning(`請求 ${i}: 觸發速率限制 (429)`);

        // 驗證響應頭（draft-7 組合格式）
        const retryAfter = response.headers['retry-after'];
        const rateLimitPolicy = response.headers['ratelimit-policy'];
        const rateLimit = response.headers['ratelimit'];

        log.info(`  Retry-After: ${retryAfter || 'N/A'}`);
        if (rateLimitPolicy) {
          log.info(`  RateLimit-Policy: ${rateLimitPolicy}`);
        }
        if (rateLimit) {
          log.info(`  RateLimit: ${rateLimit}`);
        }

        // 驗證錯誤消息
        if (response.data?.error === 'RATE_LIMIT_EXCEEDED') {
          log.success(`  錯誤碼正確: RATE_LIMIT_EXCEEDED`);
        }

        if (response.data?.message) {
          log.info(`  錯誤消息: ${response.data.message}`);
        }

        break; // 觸發限制後停止
      } else if (response.status >= 200 && response.status < 300) {
        results.success++;
        log.success(`請求 ${i}: 成功 (${response.status})`);
      } else if (response.status === 401 || response.status === 403) {
        results.errors++;
        log.error(`請求 ${i}: 認證/權限錯誤 (${response.status})`);
        log.warning(`請確保 ADMIN_TOKEN 是有效的管理員 token`);
        break;
      } else if (response.status === 404) {
        results.errors++;
        log.error(`請求 ${i}: 端點不存在 (404)`);
        break;
      } else {
        results.errors++;
        log.error(`請求 ${i}: 其他錯誤 (${response.status})`);
      }

      // 短暫延遲避免網絡擁塞
      await delay(100);
    } catch (error) {
      results.errors++;
      log.error(`請求 ${i}: 網絡錯誤 - ${error.message}`);
      break;
    }
  }

  // 結果摘要
  log.section('測試結果');
  console.log(`  成功請求: ${results.success}`);
  console.log(`  觸發限制: ${results.rateLimited}`);
  console.log(`  錯誤請求: ${results.errors}`);

  // 判斷測試是否通過
  if (results.rateLimited > 0 && results.success >= limit - 2) {
    log.success(`✓ 測試通過：速率限制器正常工作`);
    return true;
  } else if (results.errors > 0) {
    log.error(`✗ 測試失敗：請求出現錯誤`);
    return false;
  } else {
    log.warning(`⚠ 測試未完成：未能觸發速率限制`);
    return false;
  }
}

/**
 * 測試修復的端點
 */
async function testFixedEndpoints(api) {
  log.section('═══════════════════════════════════════');
  log.section('測試修復的 5 個端點');
  log.section('═══════════════════════════════════════');

  const testUserId = 'test-user-id'; // 需要一個真實的用戶 ID
  const tests = [];

  // 1. GET /:userId - relaxedAdminRateLimiter (200/15分鐘)
  log.section('\n測試 1/5: GET /api/users/:userId');
  log.info('速率限制器: relaxedAdminRateLimiter (200 次/15 分鐘)');
  log.warning('注意：需要真實的用戶 ID，當前使用測試 ID 可能返回 404');
  const test1 = await testRateLimiter(
    api,
    `/api/users/${testUserId}`,
    'GET',
    200,
    15 * 60 * 1000
  );
  tests.push({ name: 'GET /api/users/:userId', passed: test1 });

  await delay(2000);

  // 2. PATCH /:userId/usage-limits - standardAdminRateLimiter (100/15分鐘)
  log.section('\n測試 2/5: PATCH /api/users/:userId/usage-limits');
  log.info('速率限制器: standardAdminRateLimiter (100 次/15 分鐘)');
  log.warning('注意：需要真實的用戶 ID 和有效的請求體');
  const test2 = await testRateLimiter(
    api,
    `/api/users/${testUserId}/usage-limits`,
    'PATCH',
    100,
    15 * 60 * 1000
  );
  tests.push({ name: 'PATCH /api/users/:userId/usage-limits', passed: test2 });

  await delay(2000);

  // 3. GET /:userId/potions/details - relaxedAdminRateLimiter (200/15分鐘)
  log.section('\n測試 3/5: GET /api/users/:userId/potions/details');
  log.info('速率限制器: relaxedAdminRateLimiter (200 次/15 分鐘)');
  const test3 = await testRateLimiter(
    api,
    `/api/users/${testUserId}/potions/details`,
    'GET',
    200,
    15 * 60 * 1000
  );
  tests.push({ name: 'GET /api/users/:userId/potions/details', passed: test3 });

  await delay(2000);

  // 4. GET /:userId/potion-effects - relaxedAdminRateLimiter (200/15分鐘)
  log.section('\n測試 4/5: GET /api/users/:userId/potion-effects');
  log.info('速率限制器: relaxedAdminRateLimiter (200 次/15 分鐘)');
  const test4 = await testRateLimiter(
    api,
    `/api/users/${testUserId}/potion-effects`,
    'GET',
    200,
    15 * 60 * 1000
  );
  tests.push({ name: 'GET /api/users/:userId/potion-effects', passed: test4 });

  await delay(2000);

  // 5. GET /:userId/resource-limits - relaxedAdminRateLimiter (200/15分鐘)
  log.section('\n測試 5/5: GET /api/users/:userId/resource-limits');
  log.info('速率限制器: relaxedAdminRateLimiter (200 次/15 分鐘)');
  const test5 = await testRateLimiter(
    api,
    `/api/users/${testUserId}/resource-limits`,
    'GET',
    200,
    15 * 60 * 1000
  );
  tests.push({ name: 'GET /api/users/:userId/resource-limits', passed: test5 });

  return tests;
}

/**
 * 快速測試（只測試是否應用了速率限制器）
 */
async function quickTest(api) {
  log.section('═══════════════════════════════════════');
  log.section('快速測試：驗證速率限制器已應用');
  log.section('═══════════════════════════════════════');

  // 獲取 CSRF token（用於 PATCH/POST/PUT/DELETE 請求）
  log.info('正在獲取 CSRF token...');
  let csrfToken = null;
  let csrfCookie = null;
  try {
    const csrfResponse = await api.get('/api/csrf-token');
    csrfToken = csrfResponse.data?.csrfToken;

    // 提取 CSRF cookie
    const setCookieHeader = csrfResponse.headers['set-cookie'];
    if (setCookieHeader && Array.isArray(setCookieHeader)) {
      const csrfCookieHeader = setCookieHeader.find(c => c.startsWith('_csrf='));
      if (csrfCookieHeader) {
        // 提取 cookie 值（只要 cookie 名稱和值，不要其他屬性）
        csrfCookie = csrfCookieHeader.split(';')[0];
        log.info(`CSRF cookie 已提取: ${csrfCookie.substring(0, 30)}...`);
      }
    }

    if (csrfToken) {
      log.success(`CSRF token 已獲取: ${csrfToken.substring(0, 20)}...`);
    } else {
      log.warning('CSRF token 響應中未找到 csrfToken 欄位');
    }
  } catch (error) {
    log.warning(`無法獲取 CSRF token: ${error.message}`);
  }

  const testUserId = 'test-user-id';
  const endpoints = [
    { path: `/api/users/${testUserId}`, method: 'GET' },
    { path: `/api/users/${testUserId}/usage-limits`, method: 'PATCH' },
    { path: `/api/users/${testUserId}/potions/details`, method: 'GET' },
    { path: `/api/users/${testUserId}/potion-effects`, method: 'GET' },
    { path: `/api/users/${testUserId}/resource-limits`, method: 'GET' },
  ];

  let totalPassed = 0;

  for (const endpoint of endpoints) {
    try {
      // 為寫操作（PATCH/POST/PUT/DELETE）添加 CSRF token
      const requestConfig = {
        method: endpoint.method,
        url: endpoint.path,
        data: endpoint.method !== 'GET' ? {} : undefined,
      };

      // 如果有 CSRF token 且是寫操作，添加到請求標頭和 Cookie
      if (csrfToken && csrfCookie && endpoint.method !== 'GET') {
        requestConfig.headers = {
          'x-csrf-token': csrfToken,
          'Cookie': csrfCookie,  // 發送 CSRF cookie
        };
        log.info(`  → 發送 CSRF token 和 cookie 到 ${endpoint.method} 請求`);
      }

      const response = await api.request(requestConfig);

      // 調試：顯示所有響應頭和響應體
      console.log(`\n[DEBUG] 所有響應頭 for ${endpoint.method} ${endpoint.path}:`);
      console.log(JSON.stringify(response.headers, null, 2));
      console.log(`[DEBUG] 響應狀態: ${response.status}`);
      console.log(`[DEBUG] 響應內容:`, response.data);

      // 檢查是否有速率限制頭
      // express-rate-limit v7 draft-7 格式使用組合標頭：
      // - ratelimit-policy: "200;w=900"
      // - ratelimit: "limit=200, remaining=199, reset=900"
      const rateLimitPolicy = response.headers['ratelimit-policy'];
      const rateLimit = response.headers['ratelimit'];

      // 也支持分開的標頭格式（某些配置可能使用）
      const limit = response.headers['ratelimit-limit'];
      const remaining = response.headers['ratelimit-remaining'];
      const reset = response.headers['ratelimit-reset'];

      const hasCombinedHeaders = rateLimitPolicy || rateLimit;
      const hasSeparateHeaders = limit || remaining || reset;
      const hasRateLimitHeaders = hasCombinedHeaders || hasSeparateHeaders;

      if (hasRateLimitHeaders) {
        log.success(`${endpoint.method} ${endpoint.path}: 已應用速率限制器`);

        if (hasCombinedHeaders) {
          // 組合格式
          if (rateLimitPolicy) {
            log.info(`  RateLimit-Policy: ${rateLimitPolicy}`);
          }
          if (rateLimit) {
            log.info(`  RateLimit: ${rateLimit}`);
            // 解析組合值
            const match = rateLimit.match(/limit=(\d+), remaining=(\d+), reset=(\d+)/);
            if (match) {
              log.info(`    → Limit: ${match[1]}, Remaining: ${match[2]}, Reset: ${match[3]}s`);
            }
          }
        } else {
          // 分開格式
          log.info(`  RateLimit-Limit: ${limit || 'N/A'}`);
          log.info(`  RateLimit-Remaining: ${remaining || 'N/A'}`);
          if (reset) {
            log.info(`  RateLimit-Reset: ${reset}`);
          }
        }
        totalPassed++;
      } else {
        log.error(`${endpoint.method} ${endpoint.path}: 未檢測到速率限制器`);
      }
    } catch (error) {
      log.error(`${endpoint.method} ${endpoint.path}: 請求失敗 - ${error.message}`);
    }

    await delay(500);
  }

  log.section('\n快速測試結果');
  console.log(`  通過: ${totalPassed}/${endpoints.length}`);

  if (totalPassed === endpoints.length) {
    log.success('✓ 所有端點都已正確應用速率限制器');
    return true;
  } else {
    log.error(`✗ 有 ${endpoints.length - totalPassed} 個端點未應用速率限制器`);
    return false;
  }
}

/**
 * 主測試函數
 */
async function main() {
  console.log('\n');
  log.section('═══════════════════════════════════════');
  log.section('管理後台速率限制器測試');
  log.section('═══════════════════════════════════════');

  // 檢查配置
  if (!ADMIN_TOKEN) {
    log.error('錯誤：未設置 ADMIN_TOKEN 環境變數');
    log.info('請設置管理員的 Firebase Auth Token：');
    log.info('  export ADMIN_TOKEN="your-firebase-auth-token"');
    log.info('或者在 .env 文件中添加：');
    log.info('  ADMIN_TOKEN=your-firebase-auth-token');
    process.exit(1);
  }

  log.info(`API URL: ${API_URL}`);
  log.info(`Token: ${ADMIN_TOKEN.substring(0, 20)}...`);

  const api = createApiClient(ADMIN_TOKEN);

  // 測試類型選擇
  const testType = process.argv[2] || 'quick';

  if (testType === 'full') {
    // 完整測試（會觸發速率限制）
    log.warning('\n⚠️  完整測試會發送大量請求，可能觸發速率限制');
    log.warning('   如果不想等待，請使用快速測試：node scripts/test-rate-limiter.js quick');

    const tests = await testFixedEndpoints(api);

    // 最終報告
    log.section('\n═══════════════════════════════════════');
    log.section('最終測試報告');
    log.section('═══════════════════════════════════════');

    const passedTests = tests.filter(t => t.passed).length;
    const totalTests = tests.length;

    tests.forEach(test => {
      if (test.passed) {
        log.success(`✓ ${test.name}`);
      } else {
        log.error(`✗ ${test.name}`);
      }
    });

    console.log(`\n通過率: ${passedTests}/${totalTests} (${Math.round(passedTests / totalTests * 100)}%)`);

    if (passedTests === totalTests) {
      log.success('\n✓ 所有測試通過！速率限制器工作正常。');
    } else {
      log.warning(`\n⚠️  有 ${totalTests - passedTests} 個測試未通過`);
      log.info('可能的原因：');
      log.info('  1. 使用了測試用戶 ID（不存在的用戶會返回 404）');
      log.info('  2. Token 權限不足');
      log.info('  3. 後端服務未運行');
    }
  } else {
    // 快速測試（只檢查是否應用了速率限制器）
    const passed = await quickTest(api);

    log.section('\n═══════════════════════════════════════');

    if (passed) {
      log.success('\n✓ 快速測試通過！所有端點都已應用速率限制器。');
      log.info('\n提示：如需測試速率限制是否真的會觸發，請運行完整測試：');
      log.info('  node scripts/test-rate-limiter.js full');
    } else {
      log.error('\n✗ 快速測試失敗！部分端點未應用速率限制器。');
    }
  }

  log.section('═══════════════════════════════════════\n');
}

// 運行測試
main().catch(error => {
  log.error(`測試失敗: ${error.message}`);
  console.error(error);
  process.exit(1);
});
