# 重試策略實施示例

## 概述

此文檔展示如何在 VEO 視頻生成服務中實施指數退避重試策略，以應對 429 配額超限錯誤。

---

## 🔧 可用的重試工具

已創建 [retryWithBackoff.js](../backend/src/utils/retryWithBackoff.js)，提供三種重試函數：

### 1. `retryWithExponentialBackoff()` - 通用重試函數

```javascript
import { retryWithExponentialBackoff } from '../utils/retryWithBackoff.js';

const result = await retryWithExponentialBackoff(
  async () => {
    // 您的 API 調用
    return await someApiCall();
  },
  {
    maxRetries: 3,           // 最多重試 3 次
    baseDelay: 1000,         // 基礎延遲 1 秒
    maxDelay: 10000,         // 最大延遲 10 秒
    shouldRetry: (error) => {
      // 自定義重試條件
      return error.message.includes('429');
    },
    onRetry: (error, attempt, delay) => {
      // 重試前的回調
      console.log(`重試第 ${attempt + 1} 次...`);
    }
  }
);
```

### 2. `retryVeoApiCall()` - VEO 專用重試函數

```javascript
import { retryVeoApiCall } from '../utils/retryWithBackoff.js';

const result = await retryVeoApiCall(async () => {
  return await model.generateContent(generateRequest);
});
```

### 3. `retryWithTimeout()` - 帶超時的重試

```javascript
import { retryWithTimeout } from '../utils/retryWithBackoff.js';

const result = await retryWithTimeout(
  async () => await apiCall(),
  30000,  // 30 秒總超時
  { maxRetries: 3 }
);
```

---

## 📝 實施示例

### 選項 A：最小修改（推薦）

只在 API 調用處添加重試：

```javascript
// 在 videoGeneration.service.js 中

import { retryVeoApiCall } from "../utils/retryWithBackoff.js";

// ... 現有代碼 ...

export const generateVideoForCharacter = async (userId, characterId, options = {}) => {
  // ... 現有驗證和準備代碼 ...

  try {
    // ... 構建 generateRequest ...

    logger.info("[Veo] 發送影片生成請求...");

    // ✅ 添加重試邏輯（只需包裝原有調用）
    const result = await retryVeoApiCall(async () => {
      return await model.generateContent(generateRequest);
    });

    // ... 其餘代碼保持不變 ...
  } catch (error) {
    // ... 現有錯誤處理 ...
  }
};
```

**修改內容**：
- 1 行 import
- 3 行代碼包裝（添加 `retryVeoApiCall` 和 `async () =>`）

**優點**：
- 最小侵入性
- 自動處理 429 錯誤
- 不影響其他邏輯

---

### 選項 B：完整實施（最佳實踐）

添加重試並改進錯誤處理：

```javascript
// 在 videoGeneration.service.js 中

import { retryWithExponentialBackoff } from "../utils/retryWithBackoff.js";

export const generateVideoForCharacter = async (userId, characterId, options = {}) => {
  // ... 現有驗證和準備代碼 ...

  try {
    // ... 構建 generateRequest ...

    logger.info("[Veo] 發送影片生成請求...");

    // 使用自定義重試策略
    const result = await retryWithExponentialBackoff(
      async () => {
        const startTime = Date.now();
        const apiResult = await model.generateContent(generateRequest);
        const duration = Date.now() - startTime;

        logger.info(`[Veo] API 調用成功，耗時: ${duration}ms`);
        return apiResult;
      },
      {
        maxRetries: 3,
        baseDelay: 2000,     // VEO 較慢，使用 2 秒基礎延遲
        maxDelay: 16000,     // 最多等待 16 秒
        shouldRetry: (error) => {
          // 重試 429 和網絡錯誤
          if (error.message && error.message.includes("429")) {
            return true;
          }
          if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
            return true;
          }
          return false;
        },
        onRetry: (error, attempt, delay) => {
          // 記錄重試資訊
          logger.warn(`[Veo] 重試 ${attempt + 1}/3: ${error.message}`);
          logger.info(`[Veo] 等待 ${Math.round(delay / 1000)} 秒後重試...`);

          // 可選：發送監控事件
          // metrics.increment('veo.retry', { error_type: '429' });
        },
      }
    );

    // ... 其餘代碼保持不變 ...
  } catch (error) {
    // 改進的錯誤處理
    logger.error("[Veo] 影片生成失敗（所有重試都失敗）:");
    logger.error(`  錯誤訊息: ${error.message}`);

    // 處理 429 配額超限錯誤
    if (error.message && error.message.includes("429")) {
      const quotaError = new Error(
        "影片生成服務暫時繁忙，已嘗試多次重試仍失敗。請稍後再試或聯繫管理員增加配額。"
      );
      quotaError.status = 429;
      quotaError.originalError = error;
      throw quotaError;
    }

    // ... 其他錯誤處理 ...
  }
};
```

**優點**：
- 詳細的日誌記錄
- 自定義重試邏輯
- 更好的錯誤訊息
- 支持監控整合

---

### 選項 C：環境變數控制（彈性最高）

允許通過環境變數啟用/停用重試：

```javascript
// 在 videoGeneration.service.js 中

import { retryVeoApiCall } from "../utils/retryWithBackoff.js";

// 從環境變數讀取配置
const ENABLE_RETRY = process.env.VEO_ENABLE_RETRY !== "false"; // 預設啟用
const MAX_RETRIES = parseInt(process.env.VEO_MAX_RETRIES || "3");

export const generateVideoForCharacter = async (userId, characterId, options = {}) => {
  // ... 現有驗證和準備代碼 ...

  try {
    // ... 構建 generateRequest ...

    logger.info("[Veo] 發送影片生成請求...");

    let result;
    if (ENABLE_RETRY) {
      // 使用重試
      logger.info(`[Veo] 重試已啟用（最多 ${MAX_RETRIES} 次）`);
      result = await retryVeoApiCall(async () => {
        return await model.generateContent(generateRequest);
      });
    } else {
      // 不使用重試（原始行為）
      logger.info("[Veo] 重試已停用");
      result = await model.generateContent(generateRequest);
    }

    // ... 其餘代碼保持不變 ...
  } catch (error) {
    // ... 現有錯誤處理 ...
  }
};
```

**在 `.env` 中配置**：
```env
# VEO 重試配置
VEO_ENABLE_RETRY=true    # 啟用重試（預設 true）
VEO_MAX_RETRIES=3        # 最大重試次數（預設 3）
```

**優點**：
- 可以隨時啟用/停用
- 生產環境和開發環境可以不同配置
- 不需要修改代碼就能調整行為

---

## 📊 重試行為演示

### 重試時間軸

假設基礎延遲 2000ms，最大延遲 16000ms：

| 嘗試 | 指數延遲 | 抖動 | 實際延遲 | 累計時間 |
|------|---------|------|---------|---------|
| 1 | - | - | 0ms | 0s |
| 2 | 2000ms | 0-1000ms | 2000-3000ms | 2-3s |
| 3 | 4000ms | 0-1000ms | 4000-5000ms | 6-8s |
| 4 | 8000ms | 0-1000ms | 8000-9000ms | 14-17s |

**最壞情況**：3 次重試失敗 = ~17 秒總延遲

**最好情況**：第 2 次重試成功 = ~2 秒延遲

---

## 🎯 推薦配置

### 開發環境

```env
USE_MOCK_VIDEO=true           # 使用測試模式
VEO_ENABLE_RETRY=false        # 開發時不需要重試
```

### 測試環境

```env
USE_MOCK_VIDEO=false          # 測試真實 API
VEO_ENABLE_RETRY=true         # 啟用重試
VEO_MAX_RETRIES=2             # 較少重試次數（快速失敗）
```

### 生產環境

```env
USE_MOCK_VIDEO=false          # 使用真實 API
VEO_ENABLE_RETRY=true         # 必須啟用重試
VEO_MAX_RETRIES=3             # 標準重試次數
```

---

## ⚠️ 注意事項

### 1. 用戶體驗

重試會增加等待時間：
- 無重試：立即失敗（不友好）
- 3 次重試：可能等待 17 秒（較好，但慢）

**建議**：
- 在前端顯示進度指示
- 告知用戶「正在生成，請稍候...」
- 提供取消選項

### 2. 成本考量

每次重試都會：
- ❌ 不增加費用（429 錯誤不計費）
- ✅ 增加成功率
- ⚠️ 增加服務器負載

**建議**：
- 合理設置 maxRetries（2-3 次）
- 使用速率限制保護配額

### 3. 日誌管理

重試會產生大量日誌：
- 每次重試 = 2 條日誌（警告 + 資訊）
- 3 次重試 = 6 條日誌

**建議**：
- 使用適當的日誌級別
- 考慮日誌聚合和分析

---

## 🧪 測試重試邏輯

創建測試腳本驗證重試行為：

```javascript
// test-retry-logic.js
import { retryVeoApiCall } from './src/utils/retryWithBackoff.js';

let attemptCount = 0;

async function mockApiCall() {
  attemptCount++;
  console.log(`\n📞 API 調用 #${attemptCount}`);

  if (attemptCount < 3) {
    // 前兩次失敗（模擬 429）
    const error = new Error('[VertexAI.ClientError]: got status: 429 Too Many Requests');
    console.log('❌ 失敗：429 錯誤');
    throw error;
  }

  // 第三次成功
  console.log('✅ 成功！');
  return { success: true, data: 'Mock video URL' };
}

(async () => {
  console.log('🧪 測試重試邏輯\n');

  try {
    const result = await retryVeoApiCall(mockApiCall);
    console.log('\n🎉 最終結果:', result);
  } catch (error) {
    console.log('\n💥 最終失敗:', error.message);
  }
})();
```

執行測試：
```bash
node test-retry-logic.js
```

**預期輸出**：
```
🧪 測試重試邏輯

📞 API 調用 #1
❌ 失敗：429 錯誤
[重試] 嘗試 1/3 失敗: 429 Too Many Requests
[重試] 2000ms 後重試...

📞 API 調用 #2
❌ 失敗：429 錯誤
[重試] 嘗試 2/3 失敗: 429 Too Many Requests
[重試] 4000ms 後重試...

📞 API 調用 #3
✅ 成功！

🎉 最終結果: { success: true, data: 'Mock video URL' }
```

---

## ✅ 實施檢查清單

- [ ] 已創建 `retryWithBackoff.js` 工具文件
- [ ] 在 `videoGeneration.service.js` 中導入重試函數
- [ ] 包裝 `model.generateContent()` 調用
- [ ] 更新錯誤處理訊息
- [ ] 在 `.env` 中添加配置選項
- [ ] 測試重試邏輯
- [ ] 監控日誌輸出
- [ ] 更新前端 UI（顯示載入狀態）

---

## 📚 相關文檔

- [VEO 429 錯誤解決方案](./VEO_429_ERROR_SOLUTIONS.md)
- [配額管理指南](./VEO_QUOTA_GUIDE.md)
- [配額問題排查](./GCP_QUOTA_TROUBLESHOOTING.md)
