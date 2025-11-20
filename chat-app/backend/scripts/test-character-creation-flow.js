/**
 * 角色創建完整流程測試腳本
 *
 * 測試步驟：
 * 1. 創建 Flow
 * 2. 選擇性別和風格
 * 3. 生成外觀描述（可選，使用 AI 魔法師）
 * 4. 生成角色圖片
 * 5. 選擇圖片
 * 6. 生成角色設定（使用 AI 魔法師）
 * 7. 選擇語音
 * 8. 完成創建
 */

import axios from 'axios';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// 載入環境變數
config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:4000';
// 使用開發者測試帳號（非訪客），才能使用角色創建功能
const TEST_USER_ID = process.env.TEST_USER_ID || '6FXftJp96WeXYqAO4vRYs52EFXN2';
const TEST_TOKEN = 'test-token';  // 測試環境使用的 Bearer Token

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`步驟 ${step}: ${message}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message, error) {
  log(`❌ ${message}`, 'red');
  if (error?.response?.data) {
    console.error('錯誤詳情:', JSON.stringify(error.response.data, null, 2));
  } else if (error?.message) {
    console.error('錯誤訊息:', error.message);
  }
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// API 客戶端
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // 允許發送 cookies
});

// CSRF Token 和 Cookie 存儲
let csrfToken = null;
let cookies = null;

// 添加請求攔截器（模擬認證 + CSRF Token）
api.interceptors.request.use((config) => {
  // 添加測試用戶 Bearer Token
  config.headers['Authorization'] = `Bearer ${TEST_TOKEN}`;

  // 添加測試用戶 ID（向後兼容，某些端點可能還在使用）
  config.headers['x-test-user-id'] = TEST_USER_ID;

  // 如果已有 Cookie，添加到請求頭
  if (cookies) {
    config.headers['Cookie'] = cookies;
  }

  // 如果已有 CSRF Token，添加到請求頭
  if (csrfToken) {
    config.headers['x-csrf-token'] = csrfToken;
  }

  return config;
});

// 測試數據
const testData = {
  gender: 'female',
  styles: ['modern-urban', 'highschool-life'],
  description: '一位年輕活潑的高中女生，有著長長的黑髮和明亮的眼睛',
  voice: 'shimmer',
};

// 主測試流程
async function testCharacterCreationFlow() {
  let flowId = null;
  let generatedImages = [];
  let selectedImage = null;
  let characterId = null;

  try {
    // ==================== 步驟 0: 獲取 CSRF Token ====================
    logStep(0, '獲取 CSRF Token');

    try {
      const csrfResponse = await api.get('/api/csrf-token');
      csrfToken = csrfResponse.data.csrfToken;

      // 保存 cookies（從 set-cookie 響應頭中提取）
      if (csrfResponse.headers['set-cookie']) {
        cookies = csrfResponse.headers['set-cookie'].join('; ');
      }

      logSuccess(`CSRF Token 獲取成功`);
      logInfo(`Token: ${csrfToken.substring(0, 20)}...`);
      if (cookies) {
        logInfo(`Cookies 已保存`);
      }
    } catch (error) {
      logError('CSRF Token 獲取失敗', error);
      throw error;
    }

    await sleep(500);

    // ==================== 步驟 1: 創建 Flow ====================
    logStep(1, '創建角色創建流程');

    const flowResponse = await api.post('/api/character-creation/flows', {
      metadata: {
        gender: testData.gender,
        createdAt: new Date().toISOString(),
      },
    });

    flowId = flowResponse.data.data.flow.id;
    logSuccess(`Flow 創建成功: ${flowId}`);
    logInfo(`初始狀態: ${flowResponse.data.data.flow.status}`);

    // 等待一下，模擬用戶操作
    await sleep(1000);

    // ==================== 步驟 2: 更新性別和風格 ====================
    logStep(2, '設置性別和風格偏好');

    const genderResponse = await api.patch(`/api/character-creation/flows/${flowId}`, {
      metadata: {
        gender: testData.gender,
        styles: testData.styles,
      },
    });

    logSuccess(`性別和風格設置成功`);
    logInfo(`性別: ${testData.gender}`);
    logInfo(`風格: ${testData.styles.join(', ')}`);

    await sleep(1000);

    // ==================== 步驟 3: 生成外觀描述（AI 魔法師） ====================
    logStep(3, '使用 AI 魔法師生成外觀描述（可選）');

    try {
      const descriptionResponse = await api.post('/api/character-creation/ai-description', {
        gender: testData.gender,
        styles: testData.styles,
      });

      const generatedDescription = descriptionResponse.data.data.description;
      logSuccess(`外觀描述生成成功（${generatedDescription.length} 字）`);
      logInfo(`描述預覽: ${generatedDescription.substring(0, 100)}...`);

      // 使用生成的描述
      testData.description = generatedDescription;
    } catch (error) {
      logWarning('外觀描述生成失敗，使用預設描述');
      if (error?.response?.status === 429) {
        logWarning('速率限制：請稍後再試');
      }
    }

    await sleep(1000);

    // ==================== 步驟 4: 更新外觀描述 ====================
    logStep(4, '保存外觀描述到流程');

    const appearanceResponse = await api.post(`/api/character-creation/flows/${flowId}/steps/appearance`, {
      description: testData.description,
      styles: testData.styles,
    });

    logSuccess('外觀描述已保存');

    await sleep(1000);

    // ==================== 步驟 5: 生成角色圖片 ====================
    logStep(5, '生成角色圖片（這可能需要 30-60 秒）');

    logInfo('正在生成 4 張圖片...');
    const startTime = Date.now();

    try {
      const imageResponse = await api.post(
        `/api/character-creation/flows/${flowId}/generate-images`,
        {
          styles: testData.styles,
          description: testData.description,
          count: 4,
        },
        {
          timeout: 120000, // 2 分鐘超時
        }
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      generatedImages = imageResponse.data.data.images || [];

      logSuccess(`圖片生成成功！耗時 ${duration} 秒`);
      logInfo(`生成了 ${generatedImages.length} 張圖片`);

      if (imageResponse.data.data.reused) {
        logWarning('使用了緩存的圖片（相同設定的圖片已存在）');
      }

      // 顯示圖片 URL（前 100 個字符）
      generatedImages.forEach((img, index) => {
        const preview = img.url.substring(0, 80) + '...';
        logInfo(`圖片 ${index + 1}: ${preview}`);
      });
    } catch (error) {
      logError('圖片生成失敗', error);
      if (error?.code === 'ECONNABORTED') {
        logError('請求超時，圖片生成時間過長');
      }
      throw error;
    }

    await sleep(1000);

    // ==================== 步驟 6: 選擇圖片 ====================
    logStep(6, '選擇生成的圖片');

    if (generatedImages.length === 0) {
      throw new Error('沒有可選擇的圖片');
    }

    // 選擇第一張圖片
    selectedImage = generatedImages[0].url;

    const selectImageResponse = await api.post(`/api/character-creation/flows/${flowId}/steps/appearance`, {
      image: selectedImage,
      description: testData.description,
      styles: testData.styles,
    });

    logSuccess('圖片選擇成功');
    logInfo(`已選擇: 圖片 1`);

    await sleep(1000);

    // ==================== 步驟 7: 生成角色設定（AI 魔法師） ====================
    logStep(7, '使用 AI 魔法師生成角色設定');

    try {
      const personaResponse = await api.post(
        `/api/character-creation/flows/${flowId}/ai-magician`,
        {},
        {
          timeout: 30000, // 30 秒超時
        }
      );

      const persona = personaResponse.data.data.persona;
      logSuccess('角色設定生成成功');
      logInfo(`角色名: ${persona.name}`);
      logInfo(`角色設定: ${persona.tagline.substring(0, 50)}...`);
      logInfo(`隱藏設定: ${persona.hiddenProfile.substring(0, 50)}...`);
      logInfo(`開場白: ${persona.prompt.substring(0, 50)}...`);

      // 檢查字數限制
      logInfo(`角色設定字數: ${persona.tagline.length} / 200`);
      logInfo(`隱藏設定字數: ${persona.hiddenProfile.length} / 200`);

      if (persona.tagline.length > 200 || persona.hiddenProfile.length > 200) {
        logWarning('生成的內容超過 200 字限制，後端應該已經智能截斷');
      }
    } catch (error) {
      logError('角色設定生成失敗', error);
      if (error?.response?.status === 429) {
        logWarning('速率限制：請稍後再試');
      }
      throw error;
    }

    await sleep(1000);

    // ==================== 步驟 8: 獲取最新的 Flow 數據 ====================
    logStep(8, '獲取完整的流程數據');

    const flowDataResponse = await api.get(`/api/character-creation/flows/${flowId}`);
    const flowData = flowDataResponse.data.data;

    logSuccess('流程數據獲取成功');
    logInfo(`Flow 狀態: ${flowData.status}`);
    logInfo(`AI 魔法師使用次數: ${flowData.metadata?.aiMagicianUsageCount || 0} / 3`);

    await sleep(1000);

    // ==================== 步驟 9: 選擇語音 ====================
    logStep(9, '設置角色語音');

    const voiceResponse = await api.post(`/api/character-creation/flows/${flowId}/steps/voice`, {
      voice: testData.voice,
    });

    logSuccess(`語音設置成功: ${testData.voice}`);

    await sleep(1000);

    // ==================== 步驟 10: 完成創建 ====================
    logStep(10, '完成角色創建');

    // 準備最終數據
    const finalData = {
      flowId: flowId,
      display_name: flowData.persona?.name || '測試角色',
      gender: testData.gender,
      background: flowData.persona?.tagline || '',
      first_message: flowData.persona?.prompt || '',
      secret_background: flowData.persona?.hiddenProfile || '',
      portraitUrl: selectedImage,
      voice: testData.voice,
      appearanceDescription: testData.description,
      styles: testData.styles,
      creatorUid: TEST_USER_ID,
      creatorDisplayName: '測試用戶',
    };

    logInfo('正在創建角色...');
    console.log('創建數據:', JSON.stringify(finalData, null, 2));

    const createResponse = await api.post('/api/match/create', finalData);

    characterId = createResponse.data.data?.id;
    logSuccess(`角色創建成功！`);
    logSuccess(`角色 ID: ${characterId}`);
    logSuccess(`角色名稱: ${finalData.display_name}`);

    // ==================== 測試總結 ====================
    logStep('✅', '測試完成總結');

    log('\n測試結果:', 'bright');
    logSuccess(`Flow ID: ${flowId}`);
    logSuccess(`角色 ID: ${characterId}`);
    logSuccess(`角色名稱: ${finalData.display_name}`);
    logSuccess(`生成圖片數: ${generatedImages.length}`);
    logSuccess(`所有步驟執行成功！`);

    log('\n角色資訊:', 'bright');
    logInfo(`性別: ${testData.gender}`);
    logInfo(`風格: ${testData.styles.join(', ')}`);
    logInfo(`語音: ${testData.voice}`);
    logInfo(`角色設定長度: ${finalData.background.length} 字`);
    logInfo(`隱藏設定長度: ${finalData.secret_background.length} 字`);

    return {
      success: true,
      flowId,
      characterId,
      data: finalData,
    };

  } catch (error) {
    logError('測試流程失敗', error);

    // 清理：如果創建了 Flow 但失敗了，記錄 Flow ID 以便手動清理
    if (flowId) {
      logWarning(`請手動清理 Flow: ${flowId}`);
    }

    return {
      success: false,
      error: error.message,
      flowId,
    };
  }
}

// 輔助函數：延遲
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 主程序 ====================
async function main() {
  log('\n' + '='.repeat(60), 'cyan');
  log('角色創建完整流程測試', 'bright');
  log('='.repeat(60), 'cyan');

  logInfo(`API Base URL: ${API_BASE_URL}`);
  logInfo(`測試用戶 ID: ${TEST_USER_ID}`);

  const startTime = Date.now();

  try {
    const result = await testCharacterCreationFlow();

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    if (result.success) {
      log('\n' + '='.repeat(60), 'green');
      log('🎉 測試成功完成！', 'bright');
      log('='.repeat(60), 'green');
      logSuccess(`總耗時: ${totalTime} 秒`);
    } else {
      log('\n' + '='.repeat(60), 'red');
      log('❌ 測試失敗', 'bright');
      log('='.repeat(60), 'red');
      logError(`總耗時: ${totalTime} 秒`);
    }

    process.exit(result.success ? 0 : 1);

  } catch (error) {
    logError('測試執行失敗', error);
    process.exit(1);
  }
}

// 執行測試
// 檢查是否為直接執行（非 import）
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  main();
}

export { testCharacterCreationFlow };
