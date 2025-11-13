# 🚀 手動部署命令清單

**說明**: 由於 gcloud 認證需要在你的終端環境中執行，請按順序複製以下命令到 **PowerShell** 或 **命令提示字元**中執行。

---

## 準備工作

確認你已經完成：
- ✅ Firestore Rules 已部署
- ✅ 前端已構建（`chat-app/frontend/dist/`）
- ✅ gcloud 已認證（你已完成）

---

## 步驟 1: 部署後端到 Cloud Run

### 1.1 設置 GCP 項目

```powershell
# 進入後端目錄
cd D:\project\chat-app-all\chat-app\backend

# 設置項目
gcloud config set project chat-app-3-8a7ee
```

**預期輸出**:
```
Updated property [core/project].
```

---

### 1.2 啟用必要的 API

```powershell
# 啟用 Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# 啟用 Cloud Run API
gcloud services enable run.googleapis.com

# 啟用 Container Registry API
gcloud services enable containerregistry.googleapis.com
```

**預期輸出**: 每個命令會顯示 `Operation "..." finished successfully.`

**注意**: 首次啟用 API 可能需要 1-2 分鐘。

---

### 1.3 構建 Docker 鏡像

```powershell
# 使用 Cloud Build 構建 Docker 鏡像
gcloud builds submit --tag gcr.io/chat-app-3-8a7ee/chat-backend
```

**預期輸出**:
```
Creating temporary tarball archive of XX files in D:\project\chat-app-all\chat-app\backend...
Uploading tarball of [.] to [gs://...]
...
DONE
-------------------------------------------------------------------
ID                                    CREATE_TIME                DURATION
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  2025-XX-XXTXX:XX:XX+00:00  XXs
SUCCESS
```

**注意**:
- 這個步驟需要 3-5 分鐘
- 會上傳所有後端代碼到 Cloud Build
- 構建 Docker 鏡像

---

### 1.4 部署到 Cloud Run

```powershell
# 部署服務（成本優化配置）
gcloud run deploy chat-backend `
  --image gcr.io/chat-app-3-8a7ee/chat-backend `
  --platform managed `
  --region asia-east1 `
  --allow-unauthenticated `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 3 `
  --concurrency 80 `
  --cpu-throttling `
  --execution-environment gen2 `
  --cpu-boost `
  --timeout 60 `
  --set-env-vars "NODE_ENV=production,USE_FIREBASE_EMULATOR=false"
```

**預期輸出**:
```
Deploying container to Cloud Run service [chat-backend] in project [chat-app-3-8a7ee] region [asia-east1]
✓ Deploying new service... Done.
  ✓ Creating Revision...
  ✓ Routing traffic...
Done.
Service [chat-backend] revision [chat-backend-00001-xxx] has been deployed and is serving 100 percent of traffic.
Service URL: https://chat-backend-xxxxxxxxxx-xx.run.app
```

**重要**: **複製並保存 Service URL**（你需要它來配置 Cloud Scheduler）

---

### 1.5 獲取服務 URL（如果上面沒有顯示）

```powershell
gcloud run services describe chat-backend --region asia-east1 --format "value(status.url)"
```

**輸出**: `https://chat-backend-xxxxxxxxxx-xx.run.app`

**保存這個 URL！**

---

### 1.6 設置環境變數（重要！）

Cloud Run 服務需要設置 API Keys。有兩種方式：

#### 方式 A: 使用命令行（快速但不安全）

```powershell
# 從 .env 文件獲取 API Keys
# 替換下面的值為你的實際 API Keys

gcloud run services update chat-backend `
  --region asia-east1 `
  --set-env-vars "OPENAI_API_KEY=sk-your-actual-key" `
  --set-env-vars "REPLICATE_API_TOKEN=r8_your-actual-token" `
  --set-env-vars "FIREBASE_ADMIN_PROJECT_ID=chat-app-3-8a7ee" `
  --set-env-vars "CORS_ORIGIN=https://your-frontend-url"
```

#### 方式 B: 使用 Cloud Console（推薦，更安全）

1. 訪問：https://console.cloud.google.com/run/detail/asia-east1/chat-backend/variables-and-secrets?project=chat-app-3-8a7ee

2. 點擊「EDIT & DEPLOY NEW REVISION」

3. 在「Variables & Secrets」標籤中添加：
   - `OPENAI_API_KEY` = 你的 OpenAI API Key
   - `REPLICATE_API_TOKEN` = 你的 Replicate Token
   - `FIREBASE_ADMIN_PROJECT_ID` = chat-app-3-8a7ee
   - `CORS_ORIGIN` = 你的前端 URL
   - （其他必要的環境變數參考 `backend/.env.example`）

4. 點擊「DEPLOY」

---

### 1.7 驗證後端部署

```powershell
# 測試健康檢查端點
curl https://your-backend-url.run.app/health
```

**預期響應**: `{"status":"ok"}`

如果返回 `{"status":"ok"}`，後端部署成功！✅

---

## 步驟 2: 部署前端

前端已構建完成（`frontend/dist/`），選擇以下方式之一部署：

### 選項 A: Cloudflare Pages（推薦，已配置）

```powershell
# 1. 安裝 Wrangler CLI（如果還沒安裝）
npm install -g wrangler

# 2. 登錄 Cloudflare
wrangler login

# 3. 部署前端
cd D:\project\chat-app-all\chat-app
npm run deploy:pages
```

**或使用 npx（無需全局安裝）**:
```powershell
cd D:\project\chat-app-all\chat-app\frontend
npx wrangler pages deploy dist --project-name=chat-app-frontend
```

**預期輸出**:
```
✨ Success! Uploaded X files
✨ Deployment complete! Take a peek over at https://xxxxxxxx.chat-app-frontend.pages.dev
```

---

### 選項 B: Firebase Hosting

如果想使用 Firebase Hosting，需要先添加配置。

**步驟 1**: 編輯 `chat-app/firebase.json`，添加 hosting 配置：

```json
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": { ... }
}
```

**步驟 2**: 部署

```powershell
cd D:\project\chat-app-all\chat-app
firebase deploy --only hosting
```

**預期輸出**:
```
✔  Deploy complete!
Hosting URL: https://chat-app-3-8a7ee.web.app
```

---

## 步驟 3: 配置 Cloud Scheduler

### 3.1 設置環境變數

```powershell
# 設置環境變數（替換 BACKEND_URL 為步驟 1.4 中獲取的 URL）
$env:GCP_PROJECT_ID="chat-app-3-8a7ee"
$env:BACKEND_URL="https://chat-backend-xxxxxxxxxx-xx.run.app"
$env:SERVICE_ACCOUNT_EMAIL="chat-app-3-8a7ee@appspot.gserviceaccount.com"
```

---

### 3.2 啟用 Cloud Scheduler API

```powershell
gcloud services enable cloudscheduler.googleapis.com
```

---

### 3.3 創建定時任務

```powershell
# 創建清理任務（每 5 分鐘執行）
gcloud scheduler jobs create http cleanup-upgrade-locks `
  --location=asia-east1 `
  --schedule="*/5 * * * *" `
  --uri="$env:BACKEND_URL/api/cron/cleanup-locks" `
  --http-method=POST `
  --headers="Content-Type=application/json" `
  --message-body='{\"maxAgeMinutes\": 5}' `
  --oidc-service-account-email="$env:SERVICE_ACCOUNT_EMAIL" `
  --oidc-token-audience="$env:BACKEND_URL" `
  --time-zone="Asia/Taipei" `
  --description="清理過期的會員升級鎖定（每 5 分鐘）" `
  --attempt-deadline=120s `
  --max-retry-attempts=3
```

**預期輸出**:
```
Created job [cleanup-upgrade-locks].
```

---

### 3.4 測試定時任務

```powershell
# 手動執行一次
gcloud scheduler jobs run cleanup-upgrade-locks --location=asia-east1

# 查看任務狀態
gcloud scheduler jobs describe cleanup-upgrade-locks --location=asia-east1

# 查看執行日誌
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=cleanup-upgrade-locks" --limit=10
```

**預期**: 任務應該成功執行，日誌中顯示清理結果。

---

## 步驟 4: 驗證部署

### 4.1 後端驗證

```powershell
# 健康檢查
curl https://your-backend-url.run.app/health

# 測試 Cron 端點（如果你在測試環境）
curl -X POST https://your-backend-url.run.app/api/cron/test
```

### 4.2 前端驗證

1. 訪問前端 URL（Cloudflare 或 Firebase）
2. 嘗試登錄測試帳號
3. 檢查瀏覽器控制台無錯誤
4. 測試會員升級流程

### 4.3 Cloud Scheduler 驗證

```powershell
# 查看任務列表
gcloud scheduler jobs list --location=asia-east1

# 查看最近的執行日誌
gcloud logging read "resource.type=cloud_run_revision AND jsonPayload.message=~\"鎖定清理\"" --limit=10
```

---

## 🎉 部署完成檢查清單

部署完成後，確認以下項目：

- [ ] 後端健康檢查正常（`/health` 返回 ok）
- [ ] 後端環境變數已設置（API Keys）
- [ ] 前端可以正常訪問
- [ ] 前端可以連接到後端 API
- [ ] Cloud Scheduler 任務已創建
- [ ] 清理任務可以手動執行成功
- [ ] 會員升級流程測試通過
- [ ] 無嚴重錯誤或告警

---

## 📊 獲取部署信息

執行以下命令獲取所有部署信息：

```powershell
Write-Host "`n=== 部署信息總結 ===" -ForegroundColor Green

# 後端 URL
$backendUrl = gcloud run services describe chat-backend --region asia-east1 --format "value(status.url)"
Write-Host "後端 URL: $backendUrl" -ForegroundColor Cyan

# Cloud Scheduler 任務
Write-Host "`nCloud Scheduler 任務:" -ForegroundColor Cyan
gcloud scheduler jobs list --location=asia-east1

# 前端 URL（需要手動填寫）
Write-Host "`n前端 URL: [你的前端 URL]" -ForegroundColor Cyan

Write-Host "`n=== 部署完成！===" -ForegroundColor Green
```

---

## 🆘 常見問題

### 問題 1: Cloud Build 失敗

**錯誤**: `ERROR: (gcloud.builds.submit) INVALID_ARGUMENT: could not resolve source`

**解決方案**:
1. 確認你在 `chat-app/backend` 目錄中
2. 檢查 `Dockerfile` 是否存在
3. 確認 `.gcloudignore` 文件設置正確

---

### 問題 2: Cloud Run 部署超時

**錯誤**: `ERROR: (gcloud.run.deploy) Revision 'xxx' is not ready and cannot serve traffic.`

**解決方案**:
1. 檢查 Docker 鏡像是否正確構建
2. 查看 Cloud Run 日誌：
   ```powershell
   gcloud logging read "resource.type=cloud_run_revision" --limit=50
   ```
3. 確認環境變數設置正確

---

### 問題 3: CORS 錯誤

**症狀**: 前端無法連接後端，瀏覽器控制台顯示 CORS 錯誤

**解決方案**:
```powershell
# 更新後端 CORS 設置
gcloud run services update chat-backend `
  --region asia-east1 `
  --set-env-vars "CORS_ORIGIN=https://your-frontend-url"
```

---

## 📞 需要幫助？

- **Cloud Run 控制台**: https://console.cloud.google.com/run?project=chat-app-3-8a7ee
- **Cloud Scheduler 控制台**: https://console.cloud.google.com/cloudscheduler?project=chat-app-3-8a7ee
- **日誌查看器**: https://console.cloud.google.com/logs/query?project=chat-app-3-8a7ee

---

**創建時間**: 2025-11-13
**項目**: chat-app-3-8a7ee
**區域**: asia-east1
