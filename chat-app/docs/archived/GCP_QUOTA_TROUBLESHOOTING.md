# GCP 配額問題排查指南

## 當前問題

遇到 `429 Too Many Requests` 錯誤，即使降級到 Veo 2.0 仍然超限。

## 立即檢查清單

### 1. 確認 GCP 專案已啟用計費

**未啟用計費的專案配額極低！**

```bash
# 檢查計費狀態
gcloud beta billing projects describe chat-app-3-8a7ee
```

或前往：https://console.cloud.google.com/billing?project=chat-app-3-8a7ee

**如果顯示「無計費帳戶」，您需要：**
1. 建立計費帳戶
2. 連結到專案
3. 免費試用提供 $300 額度

### 2. 檢查 Vertex AI API 是否已啟用

```bash
# 列出已啟用的 API
gcloud services list --enabled --project=chat-app-3-8a7ee | grep vertex

# 如果沒有啟用，執行：
gcloud services enable aiplatform.googleapis.com --project=chat-app-3-8a7ee
```

或前往：https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=chat-app-3-8a7ee

### 3. 查看當前配額

前往配額頁面：
https://console.cloud.google.com/iam-admin/quotas?project=chat-app-3-8a7ee

搜尋：`aiplatform.googleapis.com/generate_content`

**關鍵配額指標：**
- `generate_content_requests_per_minute_per_project_per_base_model`
  - 免費/未計費：**0-5 req/min**
  - 已計費：**30-100 req/min**
- `generate_content_requests_per_day`
  - 免費：**10-50 req/day**
  - 已計費：**1000+ req/day**

### 4. 檢查配額使用情況

```bash
# 使用 gcloud 查看配額
gcloud compute project-info describe --project=chat-app-3-8a7ee

# 或查看 Vertex AI 配額詳情
gcloud alpha services quota list \
  --service=aiplatform.googleapis.com \
  --consumer=projects/chat-app-3-8a7ee \
  --filter="metric.type:generate_content"
```

## 常見問題與解決方案

### 問題 1：專案是新建的（< 7 天）

**症狀**：所有 Vertex AI 配額都是 0 或非常低

**解決方案**：
1. 啟用計費帳戶
2. 等待 24-48 小時讓配額生效
3. 或申請配額增加（通常需要 1-2 工作天）

### 問題 2：使用免費層級

**症狀**：配額極低（5-10 req/min）

**解決方案**：
- 啟用計費並設置每月預算上限
- 即使不實際消費，啟用計費也會大幅提升配額

### 問題 3：地區限制

**症狀**：某些地區配額更低

**解決方案**：
檢查並使用配額較高的地區：
- `us-central1`（推薦，配額最高）
- `us-west1`
- `europe-west4`

修改環境變數：
```env
GOOGLE_CLOUD_LOCATION=us-central1
```

### 問題 4：達到每日配額

**症狀**：早上可以使用，下午就超限

**解決方案**：
1. 查看每日配額限制
2. 申請增加每日配額
3. 實施應用層級的速率限制

## 申請配額增加步驟

### 方法 1：透過 Console（推薦）

1. 前往：https://console.cloud.google.com/iam-admin/quotas?project=chat-app-3-8a7ee
2. 搜尋：`aiplatform.googleapis.com/generate_content_requests_per_minute`
3. 勾選相關配額
4. 點擊「編輯配額」
5. 填寫申請表：
   ```
   請求配額：60 requests/min

   申請原因：
   我們正在開發一個 AI 聊天應用，需要為用戶生成角色影片。
   預期每日活躍用戶：100-500 人
   預期每日請求量：約 1000-2000 次
   使用場景：用戶與 AI 角色互動時生成短影片
   ```
6. 提交申請

**處理時間**：通常 1-2 個工作天

### 方法 2：使用 gcloud 命令

```bash
gcloud alpha quotas update \
  --service=aiplatform.googleapis.com \
  --consumer=projects/chat-app-3-8a7ee \
  --metric=aiplatform.googleapis.com/generate_content_requests_per_minute_per_project_per_base_model \
  --value=60 \
  --dimensions=base_model=veo-2.0-generate-001 \
  --justification="開發 AI 聊天應用，需要為用戶生成角色影片"
```

## 臨時解決方案（在配額增加前）

### 1. 實施速率限制

在 [ai.routes.js](../backend/src/ai/ai.routes.js) 中添加：

```javascript
import rateLimit from 'express-rate-limit';

// 視頻生成速率限制器
const videoGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小時
  max: 3, // 每小時最多 3 個請求/用戶
  message: '影片生成次數已達上限，請一小時後再試',
  keyGenerator: (req) => req.user?.uid || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

// 應用到路由
router.post('/generate-video',
  videoGenerationLimiter,  // 添加這一行
  authenticate,
  async (req, res) => {
    // ... 現有代碼
  }
);
```

### 2. 使用佔位影片（測試期間）

暫時返回測試影片，避免超限：

```javascript
// 在 videoGeneration.service.js 頂部添加
const USE_MOCK_VIDEO = process.env.USE_MOCK_VIDEO === 'true';

export const generateVideoForCharacter = async (userId, characterId, options = {}) => {
  // 測試模式：返回佔位影片
  if (USE_MOCK_VIDEO) {
    logger.warn('[Veo] 使用測試模式，返回佔位影片');
    return {
      videoUrl: 'https://example.com/placeholder-video.mp4',
      duration: '8s',
      resolution: '720p',
      size: 1024 * 1024, // 1MB
    };
  }

  // ... 正常生成邏輯
};
```

在 `.env` 中：
```env
USE_MOCK_VIDEO=true  # 測試期間啟用
```

### 3. 實施排隊系統

使用 Bull Queue 或類似工具，將影片生成請求排隊處理：

```javascript
import Queue from 'bull';

const videoQueue = new Queue('video-generation', {
  redis: process.env.REDIS_URL
});

// 設置每分鐘最多處理 5 個請求
videoQueue.process(5, async (job) => {
  const { userId, characterId } = job.data;
  return await generateVideoForCharacter(userId, characterId);
});
```

## 監控配額使用

### 設置 Cloud Monitoring 警報

```bash
# 創建警報：當配額使用超過 80% 時通知
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="VEO API Quota Alert" \
  --condition-display-name="High Quota Usage (>80%)" \
  --condition-threshold-value=0.8 \
  --condition-threshold-duration=60s \
  --condition-filter='metric.type="serviceruntime.googleapis.com/quota/rate/net_usage" AND resource.type="consumer_quota" AND resource.labels.service="aiplatform.googleapis.com"'
```

### 查看配額使用儀表板

前往：https://console.cloud.google.com/monitoring/dashboards?project=chat-app-3-8a7ee

## 成本估算

### Veo 2.0 定價（參考）

- 每秒影片生成成本：約 $0.05-0.10 USD
- 8 秒影片成本：約 $0.40-0.80 USD

**每月成本估算**：
- 100 用戶/天，每人 1 影片 = 3000 影片/月
- 成本：3000 × $0.60 = **$1,800/月**

**建議**：
1. 限制免費用戶使用次數
2. VIP 用戶提供更多配額
3. 實施緩存機制避免重複生成

## 聯繫 Google Cloud 支持

如果配額增加請求被拒絕或需要更高配額：

1. 前往：https://console.cloud.google.com/support?project=chat-app-3-8a7ee
2. 選擇「建立支援案例」
3. 類別：「配額」
4. 詳細說明您的使用場景和需求

## 檢查清單總結

- [ ] 確認專案已啟用計費
- [ ] 確認 Vertex AI API 已啟用
- [ ] 檢查當前配額值（是否 > 0）
- [ ] 確認地區設置為 `us-central1`
- [ ] 提交配額增加請求
- [ ] 實施應用層速率限制
- [ ] 設置配額使用警報
- [ ] 考慮成本優化策略

## 參考資料

- [Vertex AI 配額文檔](https://cloud.google.com/vertex-ai/docs/quotas)
- [配額增加申請指南](https://cloud.google.com/docs/quota)
- [Vertex AI 定價](https://cloud.google.com/vertex-ai/pricing)
