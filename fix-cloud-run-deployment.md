# Cloud Run 部署修復指南

## 當前問題
1. ✅ 新版本已部署但流量為 0%
2. ❌ 環境變數只剩 2 個（應該有 26 個）

## 解決步驟

### 步驟 1：複製舊版本的環境變數

1. **在 Cloud Run 控制台找到 `chat-backend-node20-fixed` 版本**
   - URL: https://console.cloud.google.com/run/detail/asia-east1/chat-backend/revisions?project=chat-app-3-8a7ee

2. **查看並記錄所有環境變數（26 個）**
   - 點擊 `chat-backend-node20-fixed` 查看詳情
   - 展開「環境變數」區塊
   - 複製所有環境變數的名稱和值

3. **必要的環境變數清單**（根據 .env.example）：

```env
# ===== 必要環境變數（生產環境） =====

# 1. 執行環境
NODE_ENV=production
PORT=8080

# 2. CORS 設定
CORS_ORIGIN=https://chat-app-all.pages.dev

# 3. Firebase 設定
USE_FIREBASE_EMULATOR=false
FIREBASE_ADMIN_PROJECT_ID=chat-app-3-8a7ee
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@chat-app-3-8a7ee.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
FIREBASE_STORAGE_BUCKET=chat-app-3-8a7ee.appspot.com

# 4. AI 服務 API Keys
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AIza...
GOOGLE_CLOUD_PROJECT_ID=chat-app-3-8a7ee
GOOGLE_CLOUD_LOCATION=us-central1

# 5. TTS 設定
USE_GOOGLE_TTS=true

# 6. 影片生成設定
VIDEO_GENERATION_PROVIDER=hailuo

# 7. Cloudflare R2 Storage
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://...

# 8. 開發模式設定（生產環境應設為 false）
ENABLE_DEV_PURCHASE_BYPASS=false
REQUIRE_TEST_ACCOUNT_FOR_DEV_BYPASS=true
ENABLE_STRICT_AD_VERIFICATION=false

# 9. Veo 重試設定
VEO_ENABLE_RETRY=true
VEO_MAX_RETRIES=3

# 10. 成本監控
DAILY_COST_WARNING=10
DAILY_COST_CRITICAL=50
MONTHLY_COST_WARNING=100
MONTHLY_COST_CRITICAL=500
```

### 步驟 2：編輯新版本並添加環境變數

1. **點擊最新版本** `chat-backend-00074-d9w`

2. **點擊「編輯和部署新修訂版本」**

3. **在「容器」→「變數和密鑰」區塊**：
   - 點擊「新增變數」
   - 逐一添加上述所有環境變數
   - ⚠️ **重要**：`FIREBASE_ADMIN_PRIVATE_KEY` 要保留換行符 `\n`

4. **設置資源**：
   - CPU：1
   - 記憶體：512MiB（或 1GiB）
   - 最小實例：0
   - 最大實例：10

5. **點擊「部署」**

### 步驟 3：設置流量分配

部署完成後，新版本會自動獲得 100% 流量。如果沒有：

1. 回到服務主頁
2. 點擊「修訂版本」分頁
3. 選擇最新的修訂版本
4. 點擊「管理流量」
5. 將流量設為 100% 到最新版本
6. 點擊「儲存」

### 步驟 4：驗證部署

```bash
# 1. 檢查服務 URL
curl https://chat-app-all.pages.dev/api/health

# 2. 查看日誌
gcloud run services logs read chat-backend --region asia-east1 --limit 20

# 3. 測試 API
curl https://chat-app-all.pages.dev/api/welcome
```

---

## 方案二：使用改進的部署腳本（推薦）

如果手動設置太麻煩，我可以幫你創建一個改進的部署腳本，自動保留環境變數。

---

## 為什麼會發生這個問題？

1. **流量分配問題**：
   - 當使用 `gcloud run deploy --quiet` 時，Cloud Run 預設會創建新版本
   - 但如果已經有穩定版本在運行，新版本不會自動獲得流量
   - 需要明確指定 `--no-traffic` 或手動分配流量

2. **環境變數丟失**：
   - 部署腳本使用 `--image` 參數只更新映像
   - 但這只在「服務已存在且環境變數已設置」的情況下有效
   - 如果是全新部署或服務名稱變更，環境變數不會自動複製

---

## 預防措施（下次部署）

### 選項 1：在部署前檢查環境變數

```bash
# 查看當前服務的環境變數
gcloud run services describe chat-backend \
  --region asia-east1 \
  --format yaml > current-config.yaml

# 檢查環境變數數量
gcloud run services describe chat-backend \
  --region asia-east1 \
  --format json | jq '.spec.template.spec.containers[0].env | length'
```

### 選項 2：使用改進的部署腳本

我可以幫你創建一個腳本，自動：
1. 保存當前環境變數
2. 部署新映像
3. 確保環境變數完整
4. 自動分配 100% 流量到新版本
5. 驗證健康檢查

---

## 下一步

你想要：
1. **手動修復**（約 10 分鐘）- 按照「步驟 1-4」操作
2. **自動修復**（約 5 分鐘）- 我創建改進的部署腳本，一鍵執行

請告訴我你的選擇！
