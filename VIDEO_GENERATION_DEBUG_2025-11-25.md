# 影片生成前後端串接診斷指南

**日期**: 2025-11-25
**問題**: 後端影片生成成功，但前端未正確顯示

---

## 🔍 診斷步驟

### 1. 檢查後端成功日誌

**查找日誌**：
```
[Hailuo 02] 影片已上傳到 R2:
[Hailuo 02] 影片記錄已儲存到 Firestore
[相簿] Hailuo 02 影片已保存到相簿
```

**驗證返回數據**：
- ✅ 確認有 `videoUrl`
- ✅ 確認有 `duration`
- ✅ 確認有 `resolution`

---

### 2. 檢查前端 Console（F12 → Console）

**正常情況應該看到**：
```javascript
[VideoGeneration] 發送影片生成 API 請求
[VideoGeneration] 影片 API 回應 { hasData: true }
```

**錯誤情況可能看到**：
```javascript
[VideoGeneration] 影片 API 回應 { hasData: false }
// 或
Error: 影片生成失敗：未返回有效的影片 URL
```

---

### 3. 檢查 Network 標籤（F12 → Network）

**查找請求**：
- URL: `POST /api/ai/generate-video`
- Status: 應該是 `200 OK`

**檢查回應內容**：
```json
{
  "success": true,
  "videoUrl": "https://pub-xxx.r2.dev/...",
  "duration": "10s",
  "resolution": "512p",
  "size": 123456,
  "provider": "hailuo",
  "model": "minimax/hailuo-02"
}
```

---

## 🐛 常見問題排查

### 問題 A：API 回應格式錯誤

**症狀**：
- Console 顯示 `hasData: false`
- 前端無法提取 `videoUrl`

**可能原因**：
1. **回應被包裝了多層** - 需要 `response.data.videoUrl` 而非 `response.videoUrl`
2. **sendSuccess 格式問題** - 檢查後端 `sendSuccess` 函數

**檢查後端代碼**（ai.routes.js:413-416）：
```javascript
sendSuccess(res, {
  success: true,
  ...result,  // ← 確認這裡展開了 videoUrl 等字段
});
```

**修復方案**：
如果 `videoUrl` 被嵌套在 `data` 中，修改前端代碼（useVideoGeneration.ts:299-302）：
```typescript
const normalizedResult =
  videoResult && typeof videoResult === 'object' && 'videoUrl' in videoResult
    ? videoResult
    : (videoResult as any)?.data || null;
```

---

### 問題 B：CORS 錯誤

**症狀**：
- Network 標籤顯示 CORS 錯誤
- 影片 URL 無法訪問

**可能原因**：
1. R2 的 CORS 設定不正確
2. 影片 URL 缺少公開訪問權限

**檢查 R2 配置**（r2Storage.service.js）：
- 確認 bucket 的 CORS 設定允許前端域名
- 確認影片上傳時設定了正確的 `ACL` 或公開權限

---

### 問題 C：影片消息未顯示

**症狀**：
- API 成功返回
- Console 沒有錯誤
- 但聊天界面沒有影片

**可能原因**：
1. **消息列表未更新** - React/Vue 狀態沒有觸發重新渲染
2. **影片組件渲染問題** - 影片 URL 無法播放
3. **臨時消息未被替換** - 臨時消息仍在，實際消息沒有顯示

**檢查前端代碼**（useVideoGeneration.ts:336-341）：
```typescript
// 替換臨時消息
const tempIndex = messages.value.findIndex((m) => m.id === tempVideoMessageId);
if (tempIndex !== -1) {
  messages.value.splice(tempIndex, 1, aiVideoMessage);
} else {
  messages.value.push(aiVideoMessage);
}
```

**調試方法**：
```typescript
// 在 useVideoGeneration.ts:341 後添加
console.log('[DEBUG] 影片消息已添加到列表', {
  messageId: aiVideoMessage.id,
  videoUrl: aiVideoMessage.video?.url,
  messagesCount: messages.value.length,
});
```

---

### 問題 D：超時問題

**症狀**：
- 請求超時（504 Gateway Timeout）
- 或前端顯示超時錯誤

**可能原因**：
1. **影片生成時間過長** - Hailuo 02 生成 10 秒影片需要 30-60 秒
2. **前端超時設定太短** - 預設 180 秒可能不夠

**檢查前端超時設定**（useVideoGeneration.ts:23）：
```typescript
const VIDEO_GENERATION_TIMEOUT_MS = 180000; // 3 分鐘
```

**建議調整**：
```typescript
const VIDEO_GENERATION_TIMEOUT_MS = 300000; // 5 分鐘
```

---

## 🔧 修復建議

### 修復 1：添加詳細日誌

**前端添加日誌**（useVideoGeneration.ts:298 後）：
```typescript
const videoResult = await apiJson(`/api/ai/generate-video`, { ... });

// ✅ 添加詳細日誌
console.log('[DEBUG] API 原始回應', videoResult);
console.log('[DEBUG] 回應類型', typeof videoResult);
console.log('[DEBUG] 是否有 videoUrl', 'videoUrl' in (videoResult || {}));
console.log('[DEBUG] 是否有 data.videoUrl', videoResult?.data?.videoUrl);
```

---

### 修復 2：增強錯誤處理

**前端改進錯誤處理**（useVideoGeneration.ts:309-316）：
```typescript
if (!normalizedResult || !normalizedResult.videoUrl) {
  // ✅ 詳細的錯誤日誌
  console.error('[DEBUG] 影片生成失敗 - 回應檢查', {
    hasNormalizedResult: Boolean(normalizedResult),
    normalizedResult,
    hasVideoUrl: Boolean(normalizedResult?.videoUrl),
    videoUrl: normalizedResult?.videoUrl,
  });

  // 移除臨時消息
  const tempIndex = messages.value.findIndex((m) => m.id === tempVideoMessageId);
  if (tempIndex !== -1) {
    messages.value.splice(tempIndex, 1);
  }
  throw new Error('影片生成失敗：未返回有效的影片 URL');
}
```

---

### 修復 3：驗證後端回應格式

**後端添加日誌**（ai.routes.js:413 前）：
```javascript
// ✅ 記錄返回給前端的數據
logger.info('[Video API] 準備返回結果給前端', {
  hasVideoUrl: Boolean(result.videoUrl),
  videoUrlPreview: result.videoUrl?.substring(0, 100),
  duration: result.duration,
  resolution: result.resolution,
});

sendSuccess(res, {
  success: true,
  ...result,
});
```

---

### 修復 4：檢查 sendSuccess 函數

**查看 sendSuccess 實現**（可能在 utils/ 或 middleware/）：
```javascript
// 確認格式是否正確
export const sendSuccess = (res, data) => {
  res.json({
    success: true,
    ...data,  // ← 確認這裡正確展開了數據
  });
};

// 如果是這樣的格式，前端需要調整：
export const sendSuccess = (res, data) => {
  res.json({
    success: true,
    data: data,  // ← 數據被包裝在 data 字段中
  });
};
```

---

## 📊 完整診斷流程

### 步驟 1：後端確認

1. ✅ 查看後端日誌，確認影片生成成功
2. ✅ 查看 `[Hailuo 02] 影片已上傳到 R2:` 後的 URL
3. ✅ 手動訪問該 URL，確認影片可播放

### 步驟 2：API 確認

1. ✅ 打開瀏覽器 DevTools（F12）
2. ✅ 切換到 Network 標籤
3. ✅ 生成影片，找到 `generate-video` 請求
4. ✅ 檢查 Response 標籤，確認回應格式：
   ```json
   {
     "success": true,
     "videoUrl": "...",
     "duration": "10s",
     "resolution": "512p"
   }
   ```

### 步驟 3：前端確認

1. ✅ 切換到 Console 標籤
2. ✅ 查找 `[VideoGeneration]` 相關日誌
3. ✅ 確認是否有錯誤訊息
4. ✅ 檢查 `messages.value` 是否包含影片消息

### 步驟 4：界面確認

1. ✅ 檢查聊天界面是否顯示影片
2. ✅ 如果顯示但無法播放，檢查影片 URL 是否有效
3. ✅ 如果完全不顯示，檢查 Vue DevTools 的組件狀態

---

## 🎯 快速修復方案

### 方案 1：修改前端回應處理（最常見問題）

**文件**: `chat-app/frontend/src/composables/chat/useVideoGeneration.ts`

**修改第 299-302 行**：
```typescript
// ❌ 原始代碼
const normalizedResult =
  videoResult && typeof videoResult === 'object' && 'videoUrl' in videoResult
    ? videoResult
    : (videoResult as any)?.data || null;

// ✅ 改進版本（支援多種格式）
const normalizedResult = (() => {
  if (!videoResult) return null;

  // 直接包含 videoUrl
  if ('videoUrl' in videoResult) {
    return videoResult;
  }

  // 包裝在 data 中
  if (videoResult.data && 'videoUrl' in videoResult.data) {
    return videoResult.data;
  }

  // 其他可能的格式
  if (videoResult.result && 'videoUrl' in videoResult.result) {
    return videoResult.result;
  }

  console.error('[DEBUG] 無法識別的回應格式', videoResult);
  return null;
})();
```

---

### 方案 2：增加超時時間

**文件**: `chat-app/frontend/src/composables/chat/useVideoGeneration.ts`

**修改第 23 行**：
```typescript
// ❌ 原始
const VIDEO_GENERATION_TIMEOUT_MS = 180000; // 3 分鐘

// ✅ 改進
const VIDEO_GENERATION_TIMEOUT_MS = 300000; // 5 分鐘
```

---

### 方案 3：修復後端回應格式（如果 sendSuccess 包裝了數據）

**文件**: `chat-app/backend/src/ai/ai.routes.js`

**修改第 413-416 行**：
```javascript
// ❌ 如果 sendSuccess 包裝數據
sendSuccess(res, {
  success: true,
  data: result,  // 數據被包裝在 data 中
});

// ✅ 改為直接展開
sendSuccess(res, {
  success: true,
  ...result,  // 直接展開，videoUrl 在頂層
});
```

---

## 🧪 測試方法

### 測試 1：手動測試 API

**使用 curl 或 Postman 測試**：
```bash
curl -X POST http://localhost:4000/api/ai/generate-video \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "characterId": "match-001",
    "useVideoCard": false
  }'
```

**檢查回應格式**：
- 應該直接包含 `videoUrl` 而非 `data.videoUrl`

---

### 測試 2：前端 Console 測試

**在瀏覽器 Console 執行**：
```javascript
// 模擬 API 調用
const testVideo = await fetch('http://localhost:4000/api/ai/generate-video', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    characterId: 'match-001',
    useVideoCard: false,
  })
}).then(r => r.json());

console.log('測試結果', testVideo);
console.log('是否有 videoUrl', 'videoUrl' in testVideo);
console.log('videoUrl 值', testVideo.videoUrl);
```

---

## 💡 常見錯誤模式

### 錯誤 1：回應被包裝兩層

**後端返回**：
```json
{
  "success": true,
  "data": {
    "videoUrl": "...",
    "duration": "10s"
  }
}
```

**前端需要**：
```typescript
const videoUrl = videoResult.data.videoUrl; // 需要訪問 data
```

---

### 錯誤 2：videoUrl 為 null 或 undefined

**可能原因**：
- R2 上傳失敗但沒有拋出錯誤
- `uploadResult.url` 為空

**檢查後端日誌**：
```
[Hailuo 02] 影片已上傳到 R2: { url: undefined, size: ... }
```

---

### 錯誤 3：前端狀態未更新

**可能原因**：
- `messages.value` 是響應式的，但沒有觸發更新
- Vue 無法檢測到深層對象變化

**修復方法**：
```typescript
// ❌ 直接修改（可能不觸發更新）
messages.value[tempIndex] = aiVideoMessage;

// ✅ 使用 splice（確保觸發更新）
messages.value.splice(tempIndex, 1, aiVideoMessage);
```

---

## 🎉 成功標誌

### 後端日誌應該顯示：
```
[Hailuo 02] 開始生成影片
[Hailuo 02] API 回應成功
[Hailuo 02] 影片下載成功，大小: 1234 KB
[Hailuo 02] 影片已上傳到 R2: { url: "https://pub-xxx.r2.dev/...", size: ... }
[Hailuo 02] 影片記錄已儲存到 Firestore
[相簿] Hailuo 02 影片已保存到相簿
```

### 前端 Console 應該顯示：
```
[VideoGeneration] 發送影片生成 API 請求
[VideoGeneration] 影片 API 回應 { hasData: true }
[DEBUG] 影片消息已添加到列表 { messageId: "...", videoUrl: "..." }
```

### 用戶界面應該：
1. ✅ 顯示影片消息泡泡
2. ✅ 影片可以正常播放
3. ✅ 影片保存到相簿

---

**文檔版本**: 1.0
**最後更新**: 2025-11-25
