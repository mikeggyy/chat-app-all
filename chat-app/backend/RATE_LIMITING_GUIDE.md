# 速率限制應用指南

## 概述

本指南說明如何在現有 API 路由中應用速率限制保護，防止 API 濫用並保護系統資源。

## 速率限制器配置

速率限制器已在 `src/middleware/rateLimiterConfig.js` 中定義，提供不同級別的限制：

| 限制器 | 速率 | 適用場景 |
|--------|------|----------|
| `veryStrictRateLimiter` | 5 次/分鐘 | 極高消耗操作（AI 圖片/影片生成） |
| `strictRateLimiter` | 10 次/分鐘 | 高消耗操作（TTS 語音生成） |
| `purchaseRateLimiter` | 10 次/分鐘 | 購買操作（防止惡意購買） |
| `giftRateLimiter` | 15 次/分鐘 | 送禮操作（防止刷禮物） |
| `conversationRateLimiter` | 20 次/分鐘 | AI 對話生成 |
| `standardRateLimiter` | 30 次/分鐘 | 一般寫操作 |
| `relaxedRateLimiter` | 60 次/分鐘 | 讀取操作 |
| `authRateLimiter` | 5 次/5分鐘 | 認證操作（基於 IP） |

## 應用速率限制

### 基本用法

```javascript
import { giftRateLimiter } from '../middleware/rateLimiterConfig.js';

// 在路由中添加速率限制中間件
router.post('/api/gifts/send',
  requireFirebaseAuth,
  giftRateLimiter, // ✅ 添加速率限制
  asyncHandler(async (req, res) => {
    // 處理邏輯
  })
);
```

### 已應用速率限制的路由

✅ **AI 相關路由** (`src/ai/ai.routes.js`):
- `POST /conversations/:userId/:characterId/reply` - 已有限制
- `POST /conversations/:userId/:characterId/suggestions` - 已有限制
- `POST /tts/:characterId/:messageId` - 已有限制
- `POST /photo/:characterId` - 已有限制
- `POST /video/:characterId` - 已有限制

✅ **禮物路由** (`src/gift/gift.routes.js`):
- `POST /api/gifts/send` - 已添加 `giftRateLimiter`

## 待應用速率限制的路由

### 高優先級（購買相關）

#### 1. 金幣購買 (`src/payment/coins.routes.js`)

```javascript
import { purchaseRateLimiter, relaxedRateLimiter } from '../middleware/rateLimiterConfig.js';

// ✅ 購買金幣套餐
router.post('/api/coins/purchase/package',
  requireFirebaseAuth,
  purchaseRateLimiter, // 添加這行
  validateRequest(coinSchemas.purchasePackage),
  async (req, res, next) => {
    // 處理邏輯
  }
);

// ✅ 購買 AI 拍照功能
router.post('/api/coins/purchase/ai-photo',
  requireFirebaseAuth,
  purchaseRateLimiter, // 添加這行
  validateRequest(coinSchemas.purchaseAiPhoto),
  async (req, res, next) => {
    // 處理邏輯
  }
);

// ✅ 購買 AI 影片功能
router.post('/api/coins/purchase/ai-video',
  requireFirebaseAuth,
  purchaseRateLimiter, // 添加這行
  validateRequest(coinSchemas.purchaseAiVideo),
  async (req, res, next) => {
    // 處理邏輯
  }
);

// ✅ 獲取餘額（讀取操作，使用寬鬆限制）
router.get('/api/coins/balance',
  requireFirebaseAuth,
  relaxedRateLimiter, // 添加這行
  validateRequest(coinSchemas.getBalance),
  async (req, res, next) => {
    // 處理邏輯
  }
);
```

#### 2. 資產購買 (`src/user/assetPurchase.routes.js`)

```javascript
import { purchaseRateLimiter, relaxedRateLimiter } from '../middleware/rateLimiterConfig.js';

// ✅ 購買資產（解鎖券、藥水等）
router.post('/api/assets/purchase',
  requireFirebaseAuth,
  purchaseRateLimiter, // 添加這行
  validateRequest(assetSchemas.purchasePackage),
  async (req, res, next) => {
    // 處理邏輯
  }
);

// ✅ 使用解鎖券
router.post('/api/assets/use-unlock-ticket',
  requireFirebaseAuth,
  standardRateLimiter, // 添加這行
  validateRequest(assetSchemas.useUnlockTicket),
  async (req, res, next) => {
    // 處理邏輯
  }
);

// ✅ 獲取用戶資產
router.get('/api/assets',
  requireFirebaseAuth,
  relaxedRateLimiter, // 添加這行
  async (req, res, next) => {
    // 處理邏輯
  }
);
```

#### 3. 會員升級 (`src/membership/membership.routes.js`)

```javascript
import { purchaseRateLimiter, relaxedRateLimiter } from '../middleware/rateLimiterConfig.js';

// ✅ 升級會員
router.post('/api/membership/upgrade',
  requireFirebaseAuth,
  purchaseRateLimiter, // 添加這行
  validateRequest(membershipSchemas.upgradeMembership),
  async (req, res, next) => {
    // 處理邏輯
  }
);

// ✅ 獲取會員方案
router.get('/api/membership/plans',
  relaxedRateLimiter, // 添加這行
  async (req, res, next) => {
    // 處理邏輯
  }
);
```

### 中優先級（一般操作）

#### 4. 對話路由 (`src/conversation/conversation.routes.js`)

```javascript
import { standardRateLimiter, relaxedRateLimiter } from '../middleware/rateLimiterConfig.js';

// ✅ 清除對話
router.delete('/api/conversations/:userId/:characterId',
  requireFirebaseAuth,
  standardRateLimiter, // 添加這行
  async (req, res, next) => {
    // 處理邏輯
  }
);

// ✅ 獲取對話記錄
router.get('/api/conversations/:userId/:characterId',
  requireFirebaseAuth,
  relaxedRateLimiter, // 添加這行
  async (req, res, next) => {
    // 處理邏輯
  }
);
```

#### 5. 用戶路由 (`src/user/user.routes.js`)

```javascript
import { standardRateLimiter, relaxedRateLimiter } from '../middleware/rateLimiterConfig.js';

// ✅ 更新用戶資料
router.put('/api/users/:userId',
  requireFirebaseAuth,
  standardRateLimiter, // 添加這行
  validateRequest(userSchemas.updateProfile),
  async (req, res, next) => {
    // 處理邏輯
  }
);

// ✅ 獲取用戶資料
router.get('/api/users/:userId',
  requireFirebaseAuth,
  relaxedRateLimiter, // 添加這行
  async (req, res, next) => {
    // 處理邏輯
  }
);
```

#### 6. 角色路由 (`src/match/match.routes.js`)

```javascript
import { standardRateLimiter, relaxedRateLimiter } from '../middleware/rateLimiterConfig.js';

// ✅ 收藏角色
router.post('/api/favorites/:characterId',
  requireFirebaseAuth,
  standardRateLimiter, // 添加這行
  async (req, res, next) => {
    // 處理邏輯
  }
);

// ✅ 獲取角色列表
router.get('/api/characters',
  relaxedRateLimiter, // 添加這行
  async (req, res, next) => {
    // 處理邏輯
  }
);
```

### 低優先級（特殊場景）

#### 7. 角色創建 (`src/characterCreation/characterCreation.routes.js`)

```javascript
import { veryStrictRateLimiter, standardRateLimiter } from '../middleware/rateLimiterConfig.js';

// ✅ 生成角色圖片（極高消耗）
router.post('/api/character-creation/generate-image',
  requireFirebaseAuth,
  veryStrictRateLimiter, // 添加這行
  async (req, res, next) => {
    // 處理邏輯
  }
);

// ✅ 創建角色
router.post('/api/character-creation/create',
  requireFirebaseAuth,
  standardRateLimiter, // 添加這行
  async (req, res, next) => {
    // 處理邏輯
  }
);
```

## 監控和調試

### 查看速率限制狀態

```javascript
import { getRateLimiterStats } from '../middleware/rateLimiterConfig.js';

// 在管理端點中添加監控
router.get('/api/admin/rate-limit-stats', async (req, res) => {
  const stats = getRateLimiterStats();
  res.json({
    success: true,
    stats,
    timestamp: new Date().toISOString(),
  });
});
```

### 日誌記錄

速率限制觸發時會自動記錄：

```
[速率限制] 請求被限制
- userId: user123
- endpoint: /api/gifts/send
- ip: 192.168.1.1
- count: 16
- resetAt: 2025-11-12T12:00:00Z
```

## 測試速率限制

### 測試腳本示例

```javascript
// test-rate-limiting.js
async function testRateLimit() {
  const endpoint = 'http://localhost:4000/api/gifts/send';
  const token = 'your-test-token';

  for (let i = 0; i < 20; i++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          characterId: 'test-character',
          giftId: 'test-gift',
          requestId: `test-${i}`,
        }),
      });

      const data = await response.json();
      console.log(`Request ${i + 1}: ${response.status}`, data);

      if (response.status === 429) {
        console.log(`✅ 速率限制在第 ${i + 1} 次請求時觸發`);
        console.log(`重試時間: ${data.retryAfter} 秒`);
        break;
      }
    } catch (error) {
      console.error(`Request ${i + 1} failed:`, error);
    }

    // 短暫延遲
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

testRateLimit();
```

## 最佳實踐

1. **分層保護**
   - 高消耗操作使用嚴格限制
   - 一般操作使用標準限制
   - 讀取操作使用寬鬆限制

2. **用戶體驗**
   - 在 `retryAfter` 字段中提供重試時間
   - 提供清晰的錯誤消息
   - 考慮在前端顯示剩餘配額

3. **監控和調整**
   - 定期檢查速率限制觸發頻率
   - 根據實際使用情況調整限制
   - 監控異常用戶行為

4. **與其他保護機制結合**
   - 速率限制 + 冪等性保護 = 雙重安全
   - 速率限制 + 輸入驗證 = 完整防護
   - 速率限制 + 會員限制 = 分級服務

## 故障排除

### 問題：速率限制過於嚴格

**症狀**: 正常用戶頻繁觸發限制

**解決方案**:
1. 檢查 `maxRequests` 和 `windowMs` 設置
2. 考慮根據會員等級調整限制
3. 為特殊用戶（測試帳號）提供繞過機制

### 問題：速率限制不生效

**症狀**: 可以無限制發送請求

**解決方案**:
1. 確認中間件已正確添加到路由
2. 檢查 `keyGenerator` 是否正確識別用戶
3. 查看日誌確認中間件是否被調用

### 問題：內存占用過高

**症狀**: 速率限制 buckets 占用大量內存

**解決方案**:
1. 速率限制器會自動清理過期 buckets
2. 調整 `cleanupIntervalMs` 參數
3. 使用 `getBucketsSize()` 監控 bucket 數量

## 參考資料

- [rateLimiter.js](../src/middleware/rateLimiter.js) - 速率限制器實現
- [rateLimiterConfig.js](../src/middleware/rateLimiterConfig.js) - 速率限制配置
- [errorCodes.js](../src/utils/errorCodes.js) - 錯誤碼系統
