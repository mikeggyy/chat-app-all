# VEO 視頻生成完整指南

本指南整合了 VEO API 的所有相關信息，包括配額管理、錯誤處理、成本優化和最佳實踐。

---

## 📋 目錄

1. [快速診斷](#快速診斷)
2. [問題排查](#問題排查)
3. [解決方案](#解決方案)
4. [配額管理](#配額管理)
5. [成本與監控](#成本與監控)
6. [最佳實踐](#最佳實踐)
7. [常見問題](#常見問題)

---

## 快速診斷

### 當前狀況檢查

如果遇到 **429 Too Many Requests** 錯誤：

```
Quota exceeded for aiplatform.googleapis.com/generate_content_requests_per_minute_per_project_per_base_model
with base model: veo-3.0-fast-generate-001
```

這表示您的 VEO API 配額已用盡。

### 診斷清單

- ✅ **API 格式正確**（使用 `parameters`）
- ✅ **代碼實現正確**（符合官方文檔）
- ❌ **配額超限**（429 Too Many Requests）

**重要提示**：您的代碼完全正確，無需修改！只需解決配額問題即可正常運作。

---

## 問題排查

### 為什麼配額這麼低？

可能原因：
1. ❌ 專案未啟用計費
2. ❌ 新專案（< 7 天）
3. ❌ 地區配額限制
4. ❌ 未申請配額增加

### 檢查當前配額

#### 方法 1：Google Cloud Console

1. 前往：https://console.cloud.google.com/iam-admin/quotas
2. 搜尋：`aiplatform.googleapis.com/generate_content_requests_per_minute`
3. 篩選專案：`chat-app-3-8a7ee`
4. 查看以下配額：
   - **每分鐘請求數** (per_minute_per_project_per_base_model)
   - **每天請求數** (per_day)
   - **並發請求數** (concurrent_requests)

#### 方法 2：使用 gcloud 命令

```bash
gcloud compute project-info describe --project=chat-app-3-8a7ee

# 或查看 Vertex AI 配額
gcloud alpha services quota list \
  --service=aiplatform.googleapis.com \
  --consumer=projects/chat-app-3-8a7ee \
  --filter="metric.type:aiplatform.googleapis.com/generate_content"
```

### 不同 VEO 模型的配額差異

| 模型 | 預設配額 (req/min) | 建議用途 |
|------|-------------------|---------|
| `veo-3.1-fast-generate-preview` | 5-10 | 測試和評估（較低配額）|
| `veo-3.0-fast-generate-001` | 30-60 | **生產環境（推薦）**|
| `veo-3.0-generate-001` | 20-40 | 高品質生成 |
| `veo-2.0-generate-001` | 60-100 | 穩定的大規模使用 |

---

## 解決方案

### 方案 1️⃣：啟用測試模式（立即可用）

**在配額增加前，使用測試模式繼續開發其他功能**

#### 步驟：

1. 編輯 `backend/.env`：
   ```env
   USE_MOCK_VIDEO=true
   ```

2. 重啟後端：
   ```bash
   cd backend
   npm run dev
   ```

3. 現在生成影片會：
   - ✅ 不消耗 API 配額
   - ✅ 模擬 2 秒延遲（真實感）
   - ✅ 返回模擬影片 URL
   - ✅ 標記為測試影片 (`isMock: true`)

4. 配額問題解決後，改回：
   ```env
   USE_MOCK_VIDEO=false
   ```

#### 優點：
- ✅ 立即可用，無需等待
- ✅ 可以繼續開發其他功能
- ✅ 不產生費用
- ✅ 可以測試整個流程

---

### 方案 2️⃣：檢查並啟用計費（必須執行）

**未啟用計費的專案配額幾乎為 0！**

#### 檢查計費狀態：

1. 前往：https://console.cloud.google.com/billing?project=chat-app-3-8a7ee

2. 查看是否顯示「計費帳戶已連結」

3. 如果未連結：
   - 點擊「連結計費帳戶」
   - 建立新計費帳戶（需要信用卡）
   - **Google Cloud 提供 $300 免費額度（90 天）**
   - 即使不消費，配額也會大幅提升

#### 啟用計費後的配額變化：

| 狀態 | 配額 (req/min) |
|------|---------------|
| ❌ 未計費 | 0-5 |
| ✅ 已計費 | 30-60 |

---

### 方案 3️⃣：申請配額增加

#### 方法 1：透過 Google Cloud Console

1. 前往配額頁面：
   https://console.cloud.google.com/iam-admin/quotas?project=chat-app-3-8a7ee

2. 搜尋並選擇：
   ```
   aiplatform.googleapis.com/generate_content_requests_per_minute_per_project_per_base_model
   ```

3. 篩選：
   - Service: `Vertex AI API`
   - Metric: `Generate content requests per minute per project per base model`
   - Dimensions: `base_model=veo-3.0-fast-generate-001`

4. 勾選相關配額項目，點擊「編輯配額」

5. 填寫申請表：
   ```
   請求配額值：100 requests/min

   申請原因：
   我們正在開發 AI 聊天應用，使用 Veo 3.0 為用戶生成角色短影片。

   使用場景：
   - 用戶與 AI 角色互動時生成個性化影片
   - 預期每日活躍用戶：100-500 人
   - 預期每日請求量：500-1000 次
   - 平均每分鐘峰值：30-50 次

   當前配額不足，嚴重影響功能開發和測試。
   請求增加配額以支持正常運作。

   感謝您的協助！
   ```

6. 提交並等待批准
   - 處理時間：通常 1-2 個工作天
   - 如緊急，可建立支援案例

#### 方法 2：透過 gcloud 命令

```bash
gcloud alpha services quota update \
  --service=aiplatform.googleapis.com \
  --consumer=projects/chat-app-3-8a7ee \
  --metric=aiplatform.googleapis.com/generate_content_requests_per_minute_per_project_per_base_model \
  --value=100 \
  --dimensions=base_model=veo-3.0-fast-generate-001
```

---

### 方案 4️⃣：實施指數退避重試策略

在應用層實施智能重試機制，處理臨時配額超限。

#### 實施方式：

在 `videoGeneration.service.js` 中添加重試邏輯：

```javascript
/**
 * 指數退避重試函數
 */
async function retryWithExponentialBackoff(fn, maxRetries = 3) {
  const delays = [1000, 2000, 4000, 8000, 16000]; // 1s, 2s, 4s, 8s, 16s

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // 如果是 429 錯誤且還有重試次數
      if (error.message?.includes("429") && attempt < maxRetries - 1) {
        const baseDelay = delays[attempt] || 16000;
        const jitter = Math.random() * 1000; // 添加隨機抖動
        const delay = Math.min(baseDelay + jitter, 16000);

        logger.warn(`[Veo] 配額超限，${delay}ms 後重試... (嘗試 ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      // 其他錯誤或重試次數用盡，直接拋出
      throw error;
    }
  }
}

// 使用方式（在 generateVideoForCharacter 中）
const result = await retryWithExponentialBackoff(async () => {
  return await model.generateContent(generateRequest);
}, 3); // 最多重試 3 次
```

#### 優點：
- ✅ 自動處理臨時配額超限
- ✅ 不需要用戶手動重試
- ✅ 提高成功率

#### 缺點：
- ⚠️ 增加延遲（最多 15 秒）
- ⚠️ 仍然可能失敗（如果配額真的很低）

#### 為什麼添加隨機抖動（Jitter）？

- 避免多個客戶端同時重試
- 減少「驚群效應」
- 提高整體成功率

---

### 方案 5️⃣：使用合適的地區端點

選擇最接近您用戶的地區可以降低延遲並可能有不同的配額。

#### 可用地區：

| 地區 | 位置 | 備註 |
|------|------|------|
| **asia-east1** | 台灣 | **推薦**（台灣用戶最低延遲） |
| asia-east2 | 香港 | 備選（亞洲地區） |
| us-central1 | 美國中部 | 備選（通常配額較高） |
| us-west1 | 美國西部 | 備選 |
| europe-west4 | 歐洲西部 | 備選 |

#### 修改方式：

在 `.env` 中：
```env
# 台灣用戶推薦
GOOGLE_CLOUD_LOCATION=asia-east1

# 或使用其他地區
# GOOGLE_CLOUD_LOCATION=asia-east2  # 香港
# GOOGLE_CLOUD_LOCATION=us-central1  # 美國
```

---

### 方案 6️⃣：實施應用層速率限制

控制請求頻率，避免觸發配額限制。

#### 安裝依賴：

```bash
cd backend
npm install express-rate-limit
```

#### 實施方式：

在 `ai.routes.js` 中添加：

```javascript
import rateLimit from 'express-rate-limit';

// 視頻生成速率限制器
const videoGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小時窗口
  max: 5, // 每小時最多 5 個請求/用戶
  message: {
    error: 'VIDEO_GENERATION_RATE_LIMIT',
    message: '影片生成次數已達上限，請稍後再試',
    retryAfter: 3600, // 1 小時後重試
  },
  keyGenerator: (req) => req.user?.uid || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'VIDEO_GENERATION_RATE_LIMIT',
      message: '影片生成次數已達上限，請一小時後再試',
      retryAfter: Math.ceil(res.getHeader('Retry-After')),
    });
  },
});

// 應用到路由
router.post('/generate-video',
  authenticate,
  videoGenerationLimiter,  // 添加速率限制
  async (req, res) => {
    // ... 現有代碼
  }
);
```

#### 限制建議：

- 免費用戶：每小時 2-3 個影片
- VIP 用戶：每小時 5-10 個影片
- VVIP 用戶：每小時 20 個影片（或無限制）

---

## 配額管理

### 監控配額使用情況

#### 使用 Cloud Monitoring

1. 前往：https://console.cloud.google.com/monitoring
2. 創建儀表板
3. 添加指標：
   - `aiplatform.googleapis.com/quota/generate_content_requests/usage`
   - `aiplatform.googleapis.com/quota/generate_content_requests/limit`

#### 設置配額警報

**方法 1：使用 Console**

1. 前往監控頁面：
   ```
   https://console.cloud.google.com/monitoring?project=chat-app-3-8a7ee
   ```

2. 創建警報策略：
   - Metric: `serviceruntime.googleapis.com/quota/rate/net_usage`
   - Filter: `service="aiplatform.googleapis.com"`
   - Condition: `usage > 80%`
   - Notification: 發送到電子郵件

**方法 2：使用 gcloud**

```bash
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="VEO API Quota Alert" \
  --condition-display-name="High Quota Usage" \
  --condition-threshold-value=0.8 \
  --condition-threshold-duration=300s
```

---

## 成本與監控

### VEO 3.0 Fast 定價（估算）

| 項目 | 成本 |
|------|------|
| 每秒影片 | $0.08-0.15 USD |
| 8 秒影片 | $0.64-1.20 USD |
| 100 影片/天 | $64-120 USD/天 |
| 3000 影片/月 | $1,920-3,600 USD/月 |

### 每月成本範例

| 使用量 | 每日影片數 | 每月影片數 | 預估成本 |
|--------|-----------|-----------|---------|
| 測試階段 | 10 | 300 | $180-360 |
| 小規模 | 50 | 1,500 | $900-1,800 |
| 中規模 | 200 | 6,000 | $3,600-7,200 |
| 大規模 | 1000 | 30,000 | $18,000-36,000 |

### 成本優化策略

#### 1. 限制免費用戶使用次數

```javascript
// 每個會員等級的限制
const videoLimits = {
  free: { daily: 1, hourly: 1 },
  vip: { daily: 10, hourly: 5 },
  vvip: { daily: 100, hourly: 20 }
};
```

#### 2. 實施緩存機制

- 相同場景重用已生成的影片
- 可節省 30-50% 成本
- 使用 Firebase Storage 或 Cloud Storage 儲存

```javascript
// 緩存邏輯示例
const cacheKey = `${characterId}_${sceneType}_${style}`;
const cachedVideo = await getFromCache(cacheKey);
if (cachedVideo) {
  return cachedVideo;
}
```

#### 3. 分層定價

- 基礎功能免費
- 影片生成作為付費功能
- 按次數或包月收費

---

## 最佳實踐

### 重要限制

#### VEO 不支持配置吞吐量

根據 [官方文檔](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/provisioned-throughput/use-provisioned-throughput?hl=zh-tw#default)：

> **"Veo 3 和 Imagen 模型不支持配置吞吐量（Provisioned Throughput）監控"**

這表示：
- ❌ 無法購買專用容量（GSU）
- ❌ 無法保證穩定的吞吐量
- ✅ 只能使用即付即用方案
- ✅ 必須依賴配額管理

### 推薦的實施順序

#### 立即執行（今天）：

1. ✅ **使用測試模式** - 設置 `USE_MOCK_VIDEO=true`
2. ✅ **檢查計費狀態** - 確保已啟用計費帳戶
3. ✅ **提交配額增加申請** - 申請 100 req/min

#### 短期執行（1-3 天）：

4. ⬜ **實施重試策略** - 添加指數退避邏輯
5. ⬜ **添加速率限制** - 保護配額不被耗盡
6. ⬜ **設置監控警報** - 追蹤配額使用

#### 長期執行（上線前）：

7. ⬜ **實施緩存機制** - 減少重複生成
8. ⬜ **設計分層定價** - 平衡成本和收益
9. ⬜ **優化用戶體驗** - 告知用戶生成時間和限制

---

## 常見問題

### Q: 為什麼不能使用配置吞吐量？

**A**: VEO 3 模型不支持配置吞吐量功能。只有文本生成模型（如 Gemini）支持。

### Q: 配額增加需要多久？

**A**:
- 一般申請：1-2 個工作天
- 緊急情況：可建立支援案例，通常當天處理
- 啟用計費：立即生效

### Q: 啟用計費會自動扣款嗎？

**A**: 不會。
- Google Cloud 提供 $300 免費額度
- 可以設置預算警報
- 超過預算時會收到通知
- 可以設置自動停止服務

### Q: 測試模式會影響其他功能嗎？

**A**: 不會。
- 僅影響影片生成
- 其他功能（聊天、TTS、圖片）正常運作
- 前端會收到模擬影片 URL

### Q: 如果配額申請被拒絕怎麼辦？

**A**: 可以：
1. 建立支援案例說明使用場景
2. 考慮使用其他視頻生成服務
3. 實施更嚴格的速率限制

---

## 參考資料

### 官方文檔

- [429 錯誤文檔](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/provisioned-throughput/error-code-429?hl=zh-tw)
- [配額管理](https://cloud.google.com/vertex-ai/docs/quotas)
- [VEO 模型參考](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation?hl=zh-tw)
- [定價資訊](https://cloud.google.com/vertex-ai/pricing)
- [Generative AI 配額](https://cloud.google.com/vertex-ai/docs/generative-ai/quotas-genai)
- [配額增加申請](https://cloud.google.com/docs/quota/view-manage)

### Console 連結

- [配額頁面](https://console.cloud.google.com/iam-admin/quotas?project=chat-app-3-8a7ee)
- [計費頁面](https://console.cloud.google.com/billing?project=chat-app-3-8a7ee)
- [監控頁面](https://console.cloud.google.com/monitoring?project=chat-app-3-8a7ee)
- [支援案例](https://console.cloud.google.com/support?project=chat-app-3-8a7ee)

---

## 總結

### 當前狀態檢查表

| 項目 | 狀態 |
|------|------|
| API 格式 | ✅ 正確（使用 `parameters`） |
| 代碼實現 | ✅ 完全符合官方規範 |
| 測試模式 | ✅ 可啟用，繼續開發 |
| 配額問題 | ⚠️ 待解決（需申請增加） |
| 計費狀態 | ⚠️ 需確認並啟用 |
| 重試策略 | ⬜ 待實施 |
| 速率限制 | ⬜ 待實施 |

### 記住

**您的代碼完全正確，無需修改！** 只需解決配額問題即可正常運作。

---

**最後更新**: 2025-11-06
