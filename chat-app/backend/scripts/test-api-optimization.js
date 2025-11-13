/**
 * API 優化效果測試腳本
 * 用於驗證優化後的 API 端點響應大小和性能
 *
 * 使用方法：
 * 1. 確保後端服務正在運行（npm run dev:backend）
 * 2. 執行: node scripts/test-api-optimization.js
 */

import fetch from 'node-fetch';

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';
const TEST_TOKEN = process.env.TEST_TOKEN || ''; // 如需認證，設置測試 token

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function testEndpoint(config) {
  const { name, url, method = 'GET', headers = {}, expectedFields = [], notExpectedFields = [] } = config;

  log(`\n${'='.repeat(70)}`, colors.cyan);
  log(`📊 測試: ${name}`, colors.bright);
  log(`🔗 URL: ${url}`, colors.blue);
  log(`${'='.repeat(70)}`, colors.cyan);

  try {
    const startTime = Date.now();

    const response = await fetch(`${API_BASE_URL}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    const responseTime = Date.now() - startTime;
    const contentLength = response.headers.get('content-length');
    const body = await response.text();
    const actualSize = Buffer.byteLength(body, 'utf8');

    // 解析 JSON
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      log(`⚠️  響應不是有效的 JSON`, colors.yellow);
      data = null;
    }

    // 顯示基本信息
    log(`\n📈 響應信息:`, colors.bright);
    log(`   狀態碼: ${response.status} ${response.statusText}`, response.ok ? colors.green : colors.red);
    log(`   響應時間: ${responseTime}ms`, colors.cyan);
    log(`   Content-Length: ${contentLength ? formatBytes(parseInt(contentLength)) : 'N/A'}`, colors.cyan);
    log(`   實際大小: ${formatBytes(actualSize)}`, colors.cyan);

    // 檢查期望的字段
    if (data && expectedFields.length > 0) {
      log(`\n✅ 檢查期望字段:`, colors.bright);

      const dataToCheck = Array.isArray(data) ? data[0] : data;
      const missingFields = [];

      expectedFields.forEach((field) => {
        const exists = checkFieldExists(dataToCheck, field);
        if (exists) {
          log(`   ✓ ${field}`, colors.green);
        } else {
          log(`   ✗ ${field} (缺失)`, colors.red);
          missingFields.push(field);
        }
      });

      if (missingFields.length > 0) {
        log(`\n⚠️  警告: ${missingFields.length} 個期望字段缺失`, colors.yellow);
      }
    }

    // 檢查不應該存在的字段
    if (data && notExpectedFields.length > 0) {
      log(`\n🚫 檢查不應該存在的字段:`, colors.bright);

      const dataToCheck = Array.isArray(data) ? data[0] : data;
      const foundFields = [];

      notExpectedFields.forEach((field) => {
        const exists = checkFieldExists(dataToCheck, field);
        if (!exists) {
          log(`   ✓ ${field} (已移除)`, colors.green);
        } else {
          log(`   ✗ ${field} (仍存在)`, colors.red);
          foundFields.push(field);
        }
      });

      if (foundFields.length > 0) {
        log(`\n⚠️  警告: ${foundFields.length} 個不應該存在的字段仍然存在`, colors.yellow);
      }
    }

    // 顯示數據樣本
    if (data) {
      log(`\n📋 數據結構樣本:`, colors.bright);
      const sample = Array.isArray(data) ? data[0] : data;
      if (sample && typeof sample === 'object') {
        const keys = Object.keys(sample);
        log(`   字段數量: ${keys.length}`, colors.cyan);
        log(`   字段列表: ${keys.join(', ')}`, colors.cyan);
      }
    }

    log(`\n${'='.repeat(70)}\n`, colors.cyan);

    return {
      success: response.ok,
      status: response.status,
      responseTime,
      size: actualSize,
      data,
    };
  } catch (error) {
    log(`\n❌ 測試失敗: ${error.message}`, colors.red);
    log(`${'='.repeat(70)}\n`, colors.cyan);

    return {
      success: false,
      error: error.message,
    };
  }
}

function checkFieldExists(obj, field) {
  if (!obj || typeof obj !== 'object') return false;

  // 支持嵌套字段（例如：'character.id'）
  if (field.includes('.')) {
    const parts = field.split('.');
    let current = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }

    return true;
  }

  return field in obj;
}

async function runTests() {
  log(`\n${'='.repeat(70)}`, colors.bright);
  log(`🧪 API 優化效果測試`, colors.bright);
  log(`${'='.repeat(70)}`, colors.bright);
  log(`\n🔧 配置:`, colors.cyan);
  log(`   API Base URL: ${API_BASE_URL}`, colors.cyan);
  log(`   認證: ${TEST_TOKEN ? '已配置' : '未配置（僅測試公開端點）'}`, colors.cyan);

  const results = [];

  // ==================== 測試 1: 角色列表 ====================
  results.push(
    await testEndpoint({
      name: '角色列表 API (GET /api/match/all)',
      url: '/api/match/all',
      expectedFields: ['id', 'display_name', 'gender', 'portraitUrl', 'tags', 'totalChatUsers'],
      notExpectedFields: ['secret_background', 'personality', 'background', 'creatorUid'],
    })
  );

  // ==================== 測試 2: 熱門角色 ====================
  results.push(
    await testEndpoint({
      name: '熱門角色 API (GET /api/match/popular)',
      url: '/api/match/popular?limit=10',
      expectedFields: [
        'characters',
        'characters[0].id',
        'characters[0].display_name',
        'characters[0].portraitUrl',
      ],
      notExpectedFields: ['characters[0].secret_background', 'characters[0].background'],
    })
  );

  // ==================== 測試 3: 隨機角色 ====================
  results.push(
    await testEndpoint({
      name: '隨機角色 API (GET /api/match/next)',
      url: '/api/match/next',
      // 這個端點未優化（向後兼容），應該返回完整數據
    })
  );

  // ==================== 測試總結 ====================
  log(`\n${'='.repeat(70)}`, colors.bright);
  log(`📊 測試總結`, colors.bright);
  log(`${'='.repeat(70)}`, colors.bright);

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  log(`\n✅ 成功: ${successCount} 個測試`, colors.green);
  log(`❌ 失敗: ${failCount} 個測試`, failCount > 0 ? colors.red : colors.green);

  // 響應大小統計
  const sizes = results.filter((r) => r.size).map((r) => r.size);
  if (sizes.length > 0) {
    const totalSize = sizes.reduce((a, b) => a + b, 0);
    const avgSize = totalSize / sizes.length;

    log(`\n📦 響應大小統計:`, colors.cyan);
    log(`   總計: ${formatBytes(totalSize)}`, colors.cyan);
    log(`   平均: ${formatBytes(avgSize)}`, colors.cyan);
    log(`   最大: ${formatBytes(Math.max(...sizes))}`, colors.cyan);
    log(`   最小: ${formatBytes(Math.min(...sizes))}`, colors.cyan);
  }

  // 響應時間統計
  const times = results.filter((r) => r.responseTime).map((r) => r.responseTime);
  if (times.length > 0) {
    const totalTime = times.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / times.length;

    log(`\n⏱️  響應時間統計:`, colors.cyan);
    log(`   平均: ${avgTime.toFixed(2)}ms`, colors.cyan);
    log(`   最快: ${Math.min(...times)}ms`, colors.cyan);
    log(`   最慢: ${Math.max(...times)}ms`, colors.cyan);
  }

  log(`\n${'='.repeat(70)}\n`, colors.bright);

  if (failCount === 0) {
    log(`🎉 所有測試通過！`, colors.green);
  } else {
    log(`⚠️  部分測試失敗，請檢查上方詳細信息`, colors.yellow);
  }

  log('');
}

// 執行測試
runTests().catch((error) => {
  log(`\n❌ 測試執行失敗: ${error.message}`, colors.red);
  process.exit(1);
});
