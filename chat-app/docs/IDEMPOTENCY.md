# 冪等性實現文檔

## 概述

本系統實現了完整的冪等性設計，確保所有消耗性操作（語音播放、拍照、送禮、AI回覆）在失敗時不會錯誤扣費，重試時也不會重複執行。

## 設計原則

### 什麼是冪等性？

冪等性（Idempotency）是指同一個操作執行多次產生的結果與執行一次相同。在我們的系統中：

- ✅ **成功後再扣費** - 只有操作成功完成後才記錄使用次數或扣除金幣
- ✅ **失敗可重試** - 操作失敗時不扣費，允許用戶重試
- ✅ **重試不重複** - 相同請求重試時返回緩存結果，不重複執行

### 為什麼需要冪等性？

**問題場景**：
1. 用戶點擊送禮 → 後端扣除金幣 → 網絡中斷 → 用戶未收到結果
2. 用戶重試 → 後端再次扣除金幣 → **金幣被重複扣除**

**解決方案**：
使用請求ID標識每個操作，已處理的請求返回緩存結果，防止重複執行。

---

## 實現架構

### 後端：冪等性處理系統

**核心文件**: `backend/src/utils/idempotency.js`

```javascript
import { handleIdempotentRequest } from './utils/idempotency.js';

// 使用冪等性處理
const result = await handleIdempotentRequest(
  requestId,           // 唯一請求ID
  async () => {        // 實際操作
    return await performOperation();
  },
  { ttl: 15 * 60 * 1000 }  // 緩存15分鐘
);
```

**功能特性**：
- 自動緩存成功結果（15分鐘有效期）
- 防止並發重複請求（處理鎖機制）
- 自動清理過期緩存（每5分鐘）
- 最多緩存10000個請求

### 前端：請求ID生成

**核心文件**: `frontend/src/utils/requestId.js`

```javascript
import {
  generateVoiceRequestId,
  generatePhotoRequestId,
  generateGiftRequestId
} from './utils/requestId.js';

// 語音播放 - 使用消息ID（確定性）
const requestId = generateVoiceRequestId(userId, characterId, messageId);
// 同一消息的語音播放使用相同ID

// 拍照 - 使用時間戳（每次新請求）
const requestId = generatePhotoRequestId(userId, characterId);

// 送禮 - 使用時間戳（每次新請求）
const requestId = generateGiftRequestId(userId, characterId, giftId);
```

---

## 已實現的冪等性操作

### 1. 語音播放

**API**: `POST /api/ai/tts`

**請求參數**:
```json
{
  "text": "要轉換的文字",
  "characterId": "角色ID",
  "requestId": "voice-userId-characterId-messageId"
}
```

**流程**:
1. 前端檢查語音限制
2. 生成確定性請求ID（基於messageId）
3. 後端檢查是否已處理：
   - 已處理 → 返回緩存的音頻
   - 未處理 → 生成語音 → 記錄次數 → 緩存結果
4. 返回音頻數據

**特點**: 相同消息的語音可以重複播放緩存結果，不重複扣次數

**實現文件**:
- 後端: `backend/src/ai/ai.routes.js` (line 207-323)
- 前端: `frontend/src/composables/chat/useChatActions.js` (line 447-470)

---

### 2. 拍照

**API**: `POST /api/ai/generate-selfie`

**請求參數**:
```json
{
  "userId": "用戶ID",
  "characterId": "角色ID",
  "requestId": "photo-userId-characterId-timestamp-random"
}
```

**流程**:
1. 前端檢查拍照限制
2. 生成唯一請求ID
3. 後端檢查是否已處理：
   - 已處理 → 返回緩存的照片消息
   - 未處理 → 生成照片 → 記錄次數 → 緩存結果
4. 返回照片消息

**特點**: 每次拍照都是新請求，但網絡失敗重試時不會重複扣次數

**實現文件**:
- 後端: `backend/src/ai/ai.routes.js` (line 325-387)
- 前端: `frontend/src/composables/chat/useChatActions.js` (line 100-120)

---

### 3. 送禮物

**API**: `POST /api/gifts/send`

**請求參數**:
```json
{
  "userId": "用戶ID",
  "characterId": "角色ID",
  "giftId": "禮物ID",
  "requestId": "gift-userId-characterId-giftId-timestamp-random"
}
```

**流程**:
1. 生成唯一請求ID
2. 後端檢查是否已處理：
   - 已處理 → 返回緩存的交易結果
   - 未處理 → 檢查餘額 → 扣除金幣 → 記錄交易 → 緩存結果
3. 返回交易結果

**特點**: 防止重複扣除金幣，重試時返回相同交易ID

**實現文件**:
- 後端: `backend/src/gift/gift.routes.js` (line 13-61)
- 前端: `frontend/src/composables/chat/useChatActions.js` (line 259-272)

---

### 4. AI 回覆

**API**: `POST /api/conversations/:userId/:characterId/reply`

**請求參數**:
```json
{
  "userMessage": "用戶消息",
  "requestId": "ai-reply-userId-characterId-userMessageId"
}
```

**流程**:
1. 前端檢查對話限制
2. 生成請求ID（基於用戶消息ID）
3. 後端檢查是否已處理：
   - 已處理 → 返回緩存的AI回覆
   - 未處理 → 生成AI回覆 → 記錄次數 → 緩存結果
4. 返回AI回覆和歷史

**特點**: 相同用戶消息不會重複請求AI，防止重複扣次數

**實現文件**:
- 後端: `backend/src/ai/ai.routes.js` (line 86-199)

---

## 響應格式

所有使用冪等性的響應都會包含特殊標記：

```json
{
  // ... 正常響應數據 ...
  "_idempotent": false,  // 是否為冪等性返回
  "_cached": false       // 是否為緩存結果
}
```

**標記說明**:
- `_idempotent: false, _cached: false` - 新執行的操作
- `_idempotent: true, _cached: true` - 返回的緩存結果（未重複執行）

---

## 緩存管理

### 自動清理

系統每5分鐘自動清理過期緩存：
- 清理超過TTL時間的緩存
- 超過10000條時清理最舊的條目

### 手動清理（僅開發/調試）

```javascript
import { clearIdempotencyCache } from './utils/idempotency.js';

// 清除特定請求
clearIdempotencyCache('request-id-123');

// 清除所有緩存
clearIdempotencyCache();
```

### 獲取統計信息

```javascript
import { getIdempotencyStats } from './utils/idempotency.js';

const stats = getIdempotencyStats();
console.log(stats);
// {
//   total: 1234,      // 總緩存數
//   valid: 1200,      // 有效緩存數
//   expired: 34,      // 過期緩存數
//   processing: 5     // 正在處理的請求數
// }
```

---

## 測試建議

### 功能測試

1. **正常流程測試**
   - 執行語音播放、拍照、送禮
   - 驗證操作成功且正確扣費

2. **網絡中斷測試**
   - 在開發者工具中模擬網絡斷開
   - 執行操作 → 失敗
   - 恢復網絡 → 重試
   - 驗證不會重複扣費

3. **重複請求測試**
   - 快速連續點擊相同操作
   - 驗證只執行一次，其他請求等待結果

4. **緩存過期測試**
   - 執行操作（成功）
   - 等待16分鐘（超過TTL）
   - 重試相同操作
   - 驗證重新執行並再次扣費

### 負載測試

- 並發執行1000個不同請求
- 驗證緩存大小不超過10000
- 驗證過期緩存被正確清理

---

## 向後兼容

所有API都支持不帶`requestId`的請求（向後兼容舊版本）：

```javascript
// 新版本（支持冪等性）
POST /api/gifts/send
{
  "userId": "123",
  "giftId": "gift-001",
  "requestId": "req-123"  // ✅ 支持冪等性
}

// 舊版本（不支持冪等性）
POST /api/gifts/send
{
  "userId": "123",
  "giftId": "gift-001"    // ✅ 向後兼容
}
```

---

## 注意事項

1. **請求ID必須唯一** - 避免使用簡單遞增數字，使用時間戳+隨機數
2. **不要緩存失敗結果** - 只緩存成功結果，允許失敗重試
3. **合理設置TTL** - 太短會失去冪等性，太長會佔用內存
4. **監控緩存大小** - 定期檢查緩存統計，避免內存洩漏

---

## 未來改進

1. **持久化緩存** - 使用Redis替代內存緩存，支持分布式部署
2. **細粒度控制** - 不同操作使用不同的TTL
3. **緩存預熱** - 預測常用操作，提前生成結果
4. **指標監控** - 記錄緩存命中率、平均響應時間等

---

## 相關文件

**後端**:
- `backend/src/utils/idempotency.js` - 冪等性核心工具
- `backend/src/ai/ai.routes.js` - 語音、拍照、AI回覆路由
- `backend/src/gift/gift.routes.js` - 送禮路由

**前端**:
- `frontend/src/utils/requestId.js` - 請求ID生成工具
- `frontend/src/composables/chat/useChatActions.js` - 聊天操作（語音、拍照、送禮）

**文檔**:
- `CLAUDE.md` - 項目主文檔
- `docs/IDEMPOTENCY.md` - 本文檔

---

## 聯繫方式

如有問題或建議，請提交Issue或Pull Request。
