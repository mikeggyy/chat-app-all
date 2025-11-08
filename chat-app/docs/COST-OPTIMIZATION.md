# 成本優化配置指南

## 🎯 目標

將專案上線成本控制在：
- **小型應用（<10 萬請求/月）**：約 **$0-5 USD/月**（免費額度內）
- **中型應用（<100 萬請求/月）**：約 **$10-25 USD/月**
- **高流量應用（>500 萬請求/月）**：$50-200 USD/月

## 📊 成本結構分析

### 主要費用來源（按佔比排序）

1. **Cloud Run（40-50%）** - 後端服務
   - 計費單位：vCPU 秒 + 記憶體 GB-秒 + 請求數
   - 免費額度：每月 200 萬次請求、36 萬 vCPU-秒

2. **Firestore（30-40%）** - 資料庫
   - 計費單位：讀取、寫入、刪除次數
   - 免費額度：每日 5 萬次讀取、2 萬次寫入、2 萬次刪除

3. **Firebase Hosting（5-10%）** - 前端託管
   - 計費單位：頻寬 GB
   - 免費額度：每月 10 GB 儲存、360 MB/日傳輸

4. **外部 API（10-20%）** - OpenAI、Replicate
   - 計費單位：API 呼叫次數
   - 建議：實作用戶付費或限制使用次數

5. **其他（<5%）** - Storage、網路流量

---

## ⚙️ Cloud Run 省錢配置

### 推薦配置（適合 95% 的應用場景）

```bash
gcloud run deploy chat-backend \
  --image gcr.io/YOUR_PROJECT_ID/chat-backend \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --memory 512Mi \                    # 512MB 記憶體（夠用且便宜）
  --cpu 1 \                           # 1 個 vCPU
  --min-instances 0 \                 # ⭐ 無流量時不計費
  --max-instances 3 \                 # ⭐ 限制最大實例數（防止突發高額費用）
  --concurrency 80 \                  # 每個實例處理 80 個併發請求
  --cpu-throttling \                  # ⭐ 啟用 CPU 節流（空閒時降低 CPU 使用）
  --timeout 60s \                     # 60 秒超時（AI 生成圖片需要時間）
  --execution-environment gen2 \      # ⭐ 第二代執行環境（啟動快 2-3 倍）
  --cpu-boost                         # ⭐ CPU boost（加快冷啟動）
```

### 成本對比

| 配置 | 月費用（10 萬次請求） | 月費用（100 萬次請求） |
|------|---------------------|----------------------|
| **優化前**（1Gi, min=1） | ~$15 | ~$45 |
| **優化後**（512Mi, min=0） | ~$3 | ~$12 |
| **節省** | **$12（80%）** | **$33（73%）** |

---

## 🗄️ Firestore 費用優化

### 1. 實作快取層（最重要！）

**安裝依賴**：
```bash
cd backend
npm install node-cache
```

**應用快取**（參考 `backend/src/utils/firestoreCacheExample.js`）：

```javascript
import { getCached, CACHE_TTL } from './utils/firestoreCache.js';

// ✅ 對不常變動的資料使用快取
export async function getCharacter(characterId) {
  return getCached(
    `character:${characterId}`,
    async () => {
      const doc = await db.collection('characters').doc(characterId).get();
      return doc.data();
    },
    CACHE_TTL.CHARACTERS // 1 小時
  );
}
```

**成本節省**：
- 減少 **70-90%** 的 Firestore 讀取次數
- 每月可節省 **$5-20**（取決於流量）

### 2. 批次操作

```javascript
// ❌ 錯誤：逐筆寫入（每次都計費）
for (const item of items) {
  await db.collection('items').add(item);
}

// ✅ 正確：批次寫入（一次計費）
const batch = db.batch();
items.forEach(item => {
  const ref = db.collection('items').doc();
  batch.set(ref, item);
});
await batch.commit();
```

### 3. 避免不必要的快照監聽

```javascript
// ❌ 錯誤：使用 onSnapshot（持續計費）
db.collection('characters').onSnapshot(snapshot => {
  // 每次資料變動都會計費
});

// ✅ 正確：使用 get()（只讀取一次）
const snapshot = await db.collection('characters').get();
```

### 4. 清理舊資料

```javascript
// 定期清理超過 90 天的對話記錄
const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

const oldConversations = await db.collection('user_conversations')
  .where('lastMessageAt', '<', cutoffDate)
  .get();

const batch = db.batch();
oldConversations.docs.forEach(doc => batch.delete(doc.ref));
await batch.commit();
```

---

## 🖼️ Firebase Hosting 優化

### 1. 壓縮資源

```bash
# 安裝 compression-webpack-plugin（Vite 已內建）
cd frontend
npm run build  # 自動生成 .gz 檔案
```

### 2. 優化圖片

```bash
# 將所有圖片轉換為 WebP（已實作）
# frontend/public/ai-role/ 中的圖片

# 進一步壓縮（可選）
npm install -g @squoosh/cli
squoosh-cli --webp auto frontend/public/ai-role/*.webp
```

### 3. 快取設置（已在 `firebase.json` 配置）

```json
{
  "headers": [
    {
      "source": "**/*.@(jpg|jpeg|gif|png|webp|svg|ico)",
      "headers": [{ "key": "Cache-Control", "value": "max-age=31536000" }]
    }
  ]
}
```

---

## 🤖 外部 API 費用控制

### 1. OpenAI API 優化

```javascript
// 使用更便宜的模型
const model = 'gpt-4o-mini'; // 比 gpt-4 便宜 60 倍

// 限制 token 數量
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: conversationHistory.slice(-12), // 只傳最後 12 則訊息
  max_tokens: 200, // 限制回覆長度
});
```

**成本對比**：
- GPT-4：$0.03/1K tokens
- GPT-4o-mini：$0.00015/1K tokens（便宜 **200 倍**）

### 2. Replicate API 優化

```javascript
// 使用更快更便宜的模型
const model = 'lucataco/gemini-2.5-flash-image'; // 便宜且快速

// 降低圖片品質（已實作 WebP 壓縮）
const compressedImage = await sharp(imageBuffer)
  .webp({ quality: 60 }) // 壓縮到 60%
  .toBuffer();
```

### 3. 實作用戶限制（已實作）

- 免費用戶：每天 3 張圖片
- VIP 用戶：每月 10 張圖片
- 語音播放：前 10 次免費，後續觀看廣告解鎖

---

## 📈 監控與預算警報

### 1. 設置預算警報

```bash
# 訪問 Google Cloud Console
https://console.cloud.google.com/billing/budgets

# 建議設置：
# - 月預算：$10
# - 警報閾值：50%, 90%, 100%
# - 通知方式：Email
```

### 2. 查看即時費用

```bash
# 查看當月費用
gcloud billing accounts list
gcloud billing projects describe YOUR_PROJECT_ID

# 查看 Cloud Run 使用量
gcloud run services describe chat-backend \
  --region asia-east1 \
  --format="value(status.url)"
```

### 3. 啟用成本報告

訪問：https://console.cloud.google.com/billing/reports

篩選條件：
- 服務：Cloud Run, Firestore, Firebase Hosting
- 時間範圍：最近 30 天
- 分組依據：SKU（詳細項目）

---

## 🚀 部署檢查清單

在部署前確認以下配置：

### Cloud Run
- [ ] `min-instances=0`
- [ ] `max-instances=3`（或根據需求調整）
- [ ] `memory=512Mi`
- [ ] `cpu-throttling` 已啟用
- [ ] `execution-environment=gen2`
- [ ] Dockerfile 使用 `node:18-alpine`

### Firestore
- [ ] 已實作快取層（`firestoreCache.js`）
- [ ] 角色資料使用快取（1 小時）
- [ ] 系統配置使用快取（24 小時）
- [ ] 使用批次操作
- [ ] 定期清理舊資料

### Firebase Hosting
- [ ] `firebase.json` 已設置快取標頭
- [ ] 圖片已壓縮為 WebP
- [ ] 前端已執行 `npm run build`

### 外部 API
- [ ] OpenAI 使用 `gpt-4o-mini`
- [ ] 限制 conversation history 長度（12 則）
- [ ] 圖片壓縮已啟用（WebP 60%）
- [ ] 用戶限制已設定

### 監控
- [ ] 預算警報已設置（$10/月）
- [ ] 啟用成本報告
- [ ] 設置 Cloud Run 日誌

---

## 🔍 成本分析範例

### 小型應用（10 萬次請求/月）

| 服務 | 用量 | 費用 |
|------|------|------|
| Cloud Run | 10 萬次請求、5 萬 vCPU-秒 | **$0-2** |
| Firestore | 3 萬次讀取、1 萬次寫入 | **$0** (免費額度內) |
| Firebase Hosting | 2 GB 傳輸 | **$0** (免費額度內) |
| OpenAI API | 1,000 次呼叫 | **$0.50** |
| Replicate API | 200 張圖片 | **$1** |
| **總計** | | **$1.50-3.50/月** |

### 中型應用（100 萬次請求/月）

| 服務 | 用量 | 費用 |
|------|------|------|
| Cloud Run | 100 萬次請求、50 萬 vCPU-秒 | **$8-12** |
| Firestore | 30 萬次讀取、10 萬次寫入 | **$2-4** |
| Firebase Hosting | 20 GB 傳輸 | **$1-2** |
| OpenAI API | 10,000 次呼叫 | **$5** |
| Replicate API | 2,000 張圖片 | **$10** |
| **總計** | | **$26-33/月** |

---

## 💡 進階優化技巧

### 1. 使用 Cloud CDN

```bash
# 為 Cloud Run 啟用 CDN（加速 + 減少請求）
gcloud run services update chat-backend \
  --region asia-east1 \
  --ingress all \
  --allow-unauthenticated
```

### 2. 實作請求去重（已實作）

參考：`backend/src/utils/idempotency.js`

### 3. 延遲載入圖片

```javascript
// 前端使用 lazy loading
<img src="portrait.webp" loading="lazy" />
```

### 4. 使用 Service Worker 快取

```javascript
// 前端快取 API 回應
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

---

## 📞 支援資源

- [GCP 價格計算器](https://cloud.google.com/products/calculator)
- [Cloud Run 定價](https://cloud.google.com/run/pricing)
- [Firestore 定價](https://firebase.google.com/docs/firestore/quotas)
- [Firebase Hosting 定價](https://firebase.google.com/pricing)

---

## ⚠️ 常見陷阱

1. **min-instances > 0**
   - ❌ 即使沒流量也會計費
   - ✅ 設為 0，冷啟動只需 1-2 秒

2. **未限制 max-instances**
   - ❌ 突發流量可能啟動 100+ 個實例
   - ✅ 設為 3-10 個（根據預期流量）

3. **未實作快取**
   - ❌ 每次 API 呼叫都讀取 Firestore
   - ✅ 快取角色、配置等不常變動的資料

4. **使用昂貴的 AI 模型**
   - ❌ GPT-4（$0.03/1K tokens）
   - ✅ GPT-4o-mini（$0.00015/1K tokens）

5. **未壓縮圖片**
   - ❌ 1MB PNG 圖片
   - ✅ 100KB WebP 圖片（壓縮 90%）

---

**估計總成本（優化後）**：
- 小型應用：**$2-5/月**
- 中型應用：**$15-30/月**
- 大型應用：**$50-100/月**

比未優化前便宜 **70-80%**！
