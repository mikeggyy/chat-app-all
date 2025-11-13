# ============================================
# 一鍵部署腳本 - 2025-01-13 修復版本
# PowerShell 版本
# ============================================

# 配置變數
$PROJECT_ID = "chat-app-3-8a7ee"
$BACKEND_SERVICE = "chat-backend"
$REGION = "asia-east1"
$BACKEND_IMAGE = "gcr.io/$PROJECT_ID/$BACKEND_SERVICE"

Write-Host "`n========================================"
Write-Host "  Chat App 完整部署腳本"
Write-Host "========================================`n"

# ============================================
# 步驟 1: 設置項目
# ============================================
Write-Host "[步驟 1/6] 設置 GCP 項目..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID
if ($LASTEXITCODE -ne 0) {
    Write-Host "[錯誤] 設置項目失敗，請確認已執行 gcloud auth login" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}
Write-Host "[完成] 項目設置成功`n" -ForegroundColor Green

# ============================================
# 步驟 2: 啟用必要的 API
# ============================================
Write-Host "[步驟 2/6] 啟用必要的 Google Cloud API..." -ForegroundColor Yellow
Write-Host "  - Cloud Build API"
gcloud services enable cloudbuild.googleapis.com
Write-Host "  - Cloud Run API"
gcloud services enable run.googleapis.com
Write-Host "  - Container Registry API"
gcloud services enable containerregistry.googleapis.com
Write-Host "  - Cloud Scheduler API"
gcloud services enable cloudscheduler.googleapis.com
Write-Host "[完成] API 啟用成功`n" -ForegroundColor Green

# ============================================
# 步驟 3: 構建並部署後端
# ============================================
Write-Host "[步驟 3/6] 構建並部署後端到 Cloud Run..." -ForegroundColor Yellow
Write-Host "  注意：這個步驟需要 5-8 分鐘，請耐心等待...`n" -ForegroundColor Cyan

Set-Location "$PSScriptRoot\chat-app\backend"

Write-Host "  [3.1] 構建 Docker 鏡像..." -ForegroundColor Cyan
gcloud builds submit --tag $BACKEND_IMAGE
if ($LASTEXITCODE -ne 0) {
    Write-Host "[錯誤] Docker 鏡像構建失敗" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}
Write-Host "  [完成] Docker 鏡像構建成功`n" -ForegroundColor Green

Write-Host "  [3.2] 部署到 Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $BACKEND_SERVICE `
  --image $BACKEND_IMAGE `
  --platform managed `
  --region $REGION `
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

if ($LASTEXITCODE -ne 0) {
    Write-Host "[錯誤] Cloud Run 部署失敗" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

# 獲取後端 URL
$BACKEND_URL = gcloud run services describe $BACKEND_SERVICE --region $REGION --format "value(status.url)"
Write-Host "[完成] 後端部署成功" -ForegroundColor Green
Write-Host "  後端 URL: $BACKEND_URL`n" -ForegroundColor Cyan

# ============================================
# 步驟 4: 設置後端環境變數提醒
# ============================================
Write-Host "[步驟 4/6] 後端環境變數設置`n" -ForegroundColor Yellow
Write-Host "[重要] 請手動設置以下環境變數：" -ForegroundColor Red
Write-Host "  1. 訪問：https://console.cloud.google.com/run/detail/$REGION/$BACKEND_SERVICE/variables-and-secrets?project=$PROJECT_ID"
Write-Host "  2. 點擊「EDIT & DEPLOY NEW REVISION」"
Write-Host "  3. 添加環境變數："
Write-Host "     - OPENAI_API_KEY = 你的 OpenAI API Key"
Write-Host "     - REPLICATE_API_TOKEN = 你的 Replicate Token"
Write-Host "     - FIREBASE_ADMIN_PROJECT_ID = $PROJECT_ID"
Write-Host "     - CORS_ORIGIN = 你的前端 URL"
Write-Host "`n是否已完成環境變數設置？"
Read-Host "按 Enter 鍵繼續"

# ============================================
# 步驟 5: 部署前端
# ============================================
Write-Host "`n[步驟 5/6] 部署前端...`n" -ForegroundColor Yellow
Write-Host "前端已構建完成，請選擇部署方式："
Write-Host "  A. Cloudflare Pages（推薦）"
Write-Host "  B. Firebase Hosting"
Write-Host "  S. 跳過前端部署`n"
$frontendChoice = Read-Host "請選擇 (A/B/S)"

switch ($frontendChoice.ToUpper()) {
    "A" {
        Write-Host "`n[前端部署] 使用 Cloudflare Pages" -ForegroundColor Cyan
        Write-Host "請在另一個終端執行：" -ForegroundColor Yellow
        Write-Host "  cd $PSScriptRoot\chat-app"
        Write-Host "  npm install -g wrangler"
        Write-Host "  wrangler login"
        Write-Host "  npm run deploy:pages"
        Read-Host "`n按 Enter 鍵繼續"
    }
    "B" {
        Write-Host "`n[前端部署] 使用 Firebase Hosting" -ForegroundColor Cyan
        Set-Location "$PSScriptRoot\chat-app"
        firebase deploy --only hosting
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[警告] Firebase Hosting 部署失敗，可能需要先配置 firebase.json" -ForegroundColor Yellow
        }
    }
    default {
        Write-Host "[跳過] 前端部署已跳過" -ForegroundColor Yellow
    }
}

# ============================================
# 步驟 6: 配置 Cloud Scheduler
# ============================================
Write-Host "`n[步驟 6/6] 配置 Cloud Scheduler...`n" -ForegroundColor Yellow

# 檢查任務是否已存在
$jobExists = gcloud scheduler jobs describe cleanup-upgrade-locks --location=$REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [創建] 創建新的清理任務..." -ForegroundColor Cyan
    gcloud scheduler jobs create http cleanup-upgrade-locks `
      --location=$REGION `
      --schedule="*/5 * * * *" `
      --uri="$BACKEND_URL/api/cron/cleanup-locks" `
      --http-method=POST `
      --headers="Content-Type=application/json" `
      --message-body='{\"maxAgeMinutes\": 5}' `
      --oidc-service-account-email="$PROJECT_ID@appspot.gserviceaccount.com" `
      --oidc-token-audience="$BACKEND_URL" `
      --time-zone="Asia/Taipei" `
      --description="清理過期的會員升級鎖定（每 5 分鐘）" `
      --attempt-deadline=120s `
      --max-retry-attempts=3
} else {
    Write-Host "  [更新] 更新現有的清理任務..." -ForegroundColor Cyan
    gcloud scheduler jobs update http cleanup-upgrade-locks `
      --location=$REGION `
      --schedule="*/5 * * * *" `
      --uri="$BACKEND_URL/api/cron/cleanup-locks" `
      --http-method=POST `
      --headers="Content-Type=application/json" `
      --message-body='{\"maxAgeMinutes\": 5}' `
      --oidc-service-account-email="$PROJECT_ID@appspot.gserviceaccount.com" `
      --oidc-token-audience="$BACKEND_URL" `
      --time-zone="Asia/Taipei" `
      --description="清理過期的會員升級鎖定（每 5 分鐘）" `
      --attempt-deadline=120s `
      --max-retry-attempts=3
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[錯誤] Cloud Scheduler 配置失敗" -ForegroundColor Red
} else {
    Write-Host "[完成] Cloud Scheduler 配置成功" -ForegroundColor Green

    Write-Host "`n  [測試] 手動執行一次清理任務..." -ForegroundColor Cyan
    gcloud scheduler jobs run cleanup-upgrade-locks --location=$REGION
}

# ============================================
# 部署完成總結
# ============================================
Write-Host "`n========================================"
Write-Host "  部署完成總結"
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "[後端]" -ForegroundColor Cyan
Write-Host "  Service: $BACKEND_SERVICE"
Write-Host "  URL: $BACKEND_URL"
Write-Host "  區域: $REGION`n"

Write-Host "[Cloud Scheduler]" -ForegroundColor Cyan
Write-Host "  任務: cleanup-upgrade-locks"
Write-Host "  頻率: 每 5 分鐘"
Write-Host "  狀態: 已創建`n"

Write-Host "[下一步]" -ForegroundColor Yellow
Write-Host "  1. 驗證後端：curl $BACKEND_URL/health"
Write-Host "  2. 設置後端環境變數（如果還沒設置）"
Write-Host "  3. 部署前端（如果還沒部署）"
Write-Host "  4. 執行功能測試`n"

Write-Host "[文檔]" -ForegroundColor Cyan
Write-Host "  - 詳細步驟: DEPLOYMENT_STEPS_2025-01-13.md"
Write-Host "  - 手動命令: MANUAL_DEPLOYMENT_COMMANDS.md"
Write-Host "  - 驗證報告: VERIFICATION_REPORT_2025-01-13.md`n"

Write-Host "========================================"
Write-Host "  感謝使用自動部署腳本！"
Write-Host "========================================`n" -ForegroundColor Green

# 驗證後端
Write-Host "[驗證] 測試後端健康檢查..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/health" -Method Get
    Write-Host "響應: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "健康檢查失敗（可能需要設置環境變數後才能正常工作）" -ForegroundColor Yellow
}

Write-Host "`n"
Read-Host "按 Enter 鍵退出"
