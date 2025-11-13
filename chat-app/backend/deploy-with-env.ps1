# ============================================
# Cloud Run 部署腳本（含環境變數）
# 使用方式:
# 1. 複製 .env.cloudrun.template 為 .env.cloudrun
# 2. 填寫所有必要的環境變數
# 3. 執行此腳本: .\deploy-with-env.ps1
# ============================================

$PROJECT_ID = "chat-app-3-8a7ee"
$SERVICE_NAME = "chat-backend"
$REGION = "asia-east1"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "`n=== Cloud Run 環境變數部署腳本 ===`n" -ForegroundColor Cyan

# 檢查 .env.cloudrun 是否存在
if (-not (Test-Path ".env.cloudrun")) {
    Write-Host "[錯誤] 找不到 .env.cloudrun 文件" -ForegroundColor Red
    Write-Host "請先複製 .env.cloudrun.template 為 .env.cloudrun 並填寫配置" -ForegroundColor Yellow
    Write-Host "`ncp .env.cloudrun.template .env.cloudrun"
    Write-Host "然後編輯 .env.cloudrun，填寫所有必要的 API keys 和配置`n"
    Read-Host "按 Enter 鍵退出"
    exit 1
}

Write-Host "[步驟 1/3] 讀取環境變數..." -ForegroundColor Yellow

# 讀取 .env 文件並構建環境變數字符串
$envVars = @()
Get-Content ".env.cloudrun" | ForEach-Object {
    $line = $_.Trim()
    # 跳過空行和註釋
    if ($line -and -not $line.StartsWith("#")) {
        # 處理包含 = 的行
        if ($line -match "^([^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()

            # 移除值兩端的引號
            $value = $value -replace '^["'']|["'']$', ''

            # 檢查是否為佔位符（包含 xxxxx 或 YOUR_）
            if ($value -match "xxxxx|YOUR_" -and $key -ne "NODE_ENV" -and $key -ne "USE_FIREBASE_EMULATOR" -and $key -ne "PORT") {
                Write-Host "  ⚠️  $key 包含佔位符，請填寫實際值" -ForegroundColor Yellow
            }

            $envVars += "$key=$value"
        }
    }
}

if ($envVars.Count -eq 0) {
    Write-Host "[錯誤] 未找到任何環境變數" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

Write-Host "  找到 $($envVars.Count) 個環境變數" -ForegroundColor Green

Write-Host "`n[步驟 2/3] 檢查必要的環境變數..." -ForegroundColor Yellow

$requiredVars = @(
    "FIREBASE_ADMIN_PROJECT_ID",
    "OPENAI_API_KEY",
    "GOOGLE_AI_API_KEY",
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
    "VIDEO_GENERATION_PROVIDER",
    "CORS_ORIGIN"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    $found = $envVars | Where-Object { $_ -like "$var=*" }
    if (-not $found) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "  ❌ 缺少以下必要的環境變數:" -ForegroundColor Red
    $missingVars | ForEach-Object { Write-Host "     - $_" -ForegroundColor Red }
    Read-Host "`n按 Enter 鍵退出"
    exit 1
}

Write-Host "  ✅ 所有必要的環境變數都已設置" -ForegroundColor Green

Write-Host "`n[步驟 3/3] 部署到 Cloud Run..." -ForegroundColor Yellow
Write-Host "  這可能需要 1-2 分鐘...`n" -ForegroundColor Cyan

# 構建環境變數參數
$envVarsString = $envVars -join ","

# 部署到 Cloud Run
gcloud run deploy $SERVICE_NAME `
  --image $IMAGE_NAME `
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
  --set-env-vars $envVarsString

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[錯誤] Cloud Run 部署失敗" -ForegroundColor Red
    Read-Host "按 Enter 鍵退出"
    exit 1
}

# 獲取服務 URL
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --region $REGION --format "value(status.url)"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  部署成功！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n後端 URL: $SERVICE_URL" -ForegroundColor Cyan
Write-Host "`n下一步:" -ForegroundColor Yellow
Write-Host "  1. 測試後端健康檢查:"
Write-Host "     curl $SERVICE_URL/health"
Write-Host "  2. 更新前端 .env 中的 VITE_API_URL"
Write-Host "  3. 部署前端`n"

Read-Host "按 Enter 鍵退出"
