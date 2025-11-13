@echo off
REM ============================================
REM 一鍵部署腳本 - 2025-01-13 修復版本
REM ============================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   Chat App 完整部署腳本
echo ========================================
echo.

REM 配置變數
set PROJECT_ID=chat-app-3-8a7ee
set BACKEND_SERVICE=chat-backend
set REGION=asia-east1
set BACKEND_IMAGE=gcr.io/%PROJECT_ID%/%BACKEND_SERVICE%

REM ============================================
REM 步驟 1: 設置項目
REM ============================================
echo [步驟 1/6] 設置 GCP 項目...
gcloud config set project %PROJECT_ID%
if errorlevel 1 (
    echo [錯誤] 設置項目失敗，請確認已執行 gcloud auth login
    pause
    exit /b 1
)
echo [完成] 項目設置成功
echo.

REM ============================================
REM 步驟 2: 啟用必要的 API
REM ============================================
echo [步驟 2/6] 啟用必要的 Google Cloud API...
echo   - Cloud Build API
gcloud services enable cloudbuild.googleapis.com
echo   - Cloud Run API
gcloud services enable run.googleapis.com
echo   - Container Registry API
gcloud services enable containerregistry.googleapis.com
echo   - Cloud Scheduler API
gcloud services enable cloudscheduler.googleapis.com
echo [完成] API 啟用成功
echo.

REM ============================================
REM 步驟 3: 構建並部署後端
REM ============================================
echo [步驟 3/6] 構建並部署後端到 Cloud Run...
echo   注意：這個步驟需要 5-8 分鐘，請耐心等待...
echo.

cd /d "%~dp0chat-app\backend"

echo   [3.1] 構建 Docker 鏡像...
gcloud builds submit --tag %BACKEND_IMAGE%
if errorlevel 1 (
    echo [錯誤] Docker 鏡像構建失敗
    pause
    exit /b 1
)
echo   [完成] Docker 鏡像構建成功
echo.

echo   [3.2] 部署到 Cloud Run...
gcloud run deploy %BACKEND_SERVICE% ^
  --image %BACKEND_IMAGE% ^
  --platform managed ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --memory 512Mi ^
  --cpu 1 ^
  --min-instances 0 ^
  --max-instances 3 ^
  --concurrency 80 ^
  --cpu-throttling ^
  --execution-environment gen2 ^
  --cpu-boost ^
  --timeout 60 ^
  --set-env-vars "NODE_ENV=production,USE_FIREBASE_EMULATOR=false"

if errorlevel 1 (
    echo [錯誤] Cloud Run 部署失敗
    pause
    exit /b 1
)

REM 獲取後端 URL
for /f "tokens=*" %%i in ('gcloud run services describe %BACKEND_SERVICE% --region %REGION% --format "value(status.url)"') do set BACKEND_URL=%%i
echo [完成] 後端部署成功
echo   後端 URL: %BACKEND_URL%
echo.

REM ============================================
REM 步驟 4: 設置後端環境變數提醒
REM ============================================
echo [步驟 4/6] 後端環境變數設置
echo.
echo [重要] 請手動設置以下環境變數：
echo   1. 訪問：https://console.cloud.google.com/run/detail/%REGION%/%BACKEND_SERVICE%/variables-and-secrets?project=%PROJECT_ID%
echo   2. 點擊「EDIT ^& DEPLOY NEW REVISION」
echo   3. 添加環境變數：
echo      - OPENAI_API_KEY = 你的 OpenAI API Key
echo      - REPLICATE_API_TOKEN = 你的 Replicate Token
echo      - FIREBASE_ADMIN_PROJECT_ID = %PROJECT_ID%
echo      - CORS_ORIGIN = 你的前端 URL
echo.
echo 是否已完成環境變數設置？
pause
echo.

REM ============================================
REM 步驟 5: 部署前端
REM ============================================
echo [步驟 5/6] 部署前端...
echo.
echo 前端已構建完成，請選擇部署方式：
echo   A. Cloudflare Pages（推薦）
echo   B. Firebase Hosting
echo   S. 跳過前端部署
echo.
set /p FRONTEND_CHOICE="請選擇 (A/B/S): "

if /i "%FRONTEND_CHOICE%"=="A" (
    echo.
    echo [前端部署] 使用 Cloudflare Pages
    echo 請在另一個終端執行：
    echo   cd %~dp0chat-app
    echo   npm install -g wrangler
    echo   wrangler login
    echo   npm run deploy:pages
    echo.
    pause
) else if /i "%FRONTEND_CHOICE%"=="B" (
    echo.
    echo [前端部署] 使用 Firebase Hosting
    cd /d "%~dp0chat-app"
    firebase deploy --only hosting
    if errorlevel 1 (
        echo [警告] Firebase Hosting 部署失敗，可能需要先配置 firebase.json
    )
) else (
    echo [跳過] 前端部署已跳過
)
echo.

REM ============================================
REM 步驟 6: 配置 Cloud Scheduler
REM ============================================
echo [步驟 6/6] 配置 Cloud Scheduler...
echo.

REM 檢查任務是否已存在
gcloud scheduler jobs describe cleanup-upgrade-locks --location=%REGION% >nul 2>&1
if errorlevel 1 (
    echo   [創建] 創建新的清理任務...
    gcloud scheduler jobs create http cleanup-upgrade-locks ^
      --location=%REGION% ^
      --schedule="*/5 * * * *" ^
      --uri="%BACKEND_URL%/api/cron/cleanup-locks" ^
      --http-method=POST ^
      --headers="Content-Type=application/json" ^
      --message-body="{\"maxAgeMinutes\": 5}" ^
      --oidc-service-account-email="%PROJECT_ID%@appspot.gserviceaccount.com" ^
      --oidc-token-audience="%BACKEND_URL%" ^
      --time-zone="Asia/Taipei" ^
      --description="清理過期的會員升級鎖定（每 5 分鐘）" ^
      --attempt-deadline=120s ^
      --max-retry-attempts=3
) else (
    echo   [更新] 更新現有的清理任務...
    gcloud scheduler jobs update http cleanup-upgrade-locks ^
      --location=%REGION% ^
      --schedule="*/5 * * * *" ^
      --uri="%BACKEND_URL%/api/cron/cleanup-locks" ^
      --http-method=POST ^
      --headers="Content-Type=application/json" ^
      --message-body="{\"maxAgeMinutes\": 5}" ^
      --oidc-service-account-email="%PROJECT_ID%@appspot.gserviceaccount.com" ^
      --oidc-token-audience="%BACKEND_URL%" ^
      --time-zone="Asia/Taipei" ^
      --description="清理過期的會員升級鎖定（每 5 分鐘）" ^
      --attempt-deadline=120s ^
      --max-retry-attempts=3
)

if errorlevel 1 (
    echo [錯誤] Cloud Scheduler 配置失敗
) else (
    echo [完成] Cloud Scheduler 配置成功

    echo.
    echo   [測試] 手動執行一次清理任務...
    gcloud scheduler jobs run cleanup-upgrade-locks --location=%REGION%
)
echo.

REM ============================================
REM 部署完成總結
REM ============================================
echo.
echo ========================================
echo   部署完成總結
echo ========================================
echo.
echo [後端]
echo   Service: %BACKEND_SERVICE%
echo   URL: %BACKEND_URL%
echo   區域: %REGION%
echo.
echo [Cloud Scheduler]
echo   任務: cleanup-upgrade-locks
echo   頻率: 每 5 分鐘
echo   狀態: 已創建
echo.
echo [下一步]
echo   1. 驗證後端：curl %BACKEND_URL%/health
echo   2. 設置後端環境變數（如果還沒設置）
echo   3. 部署前端（如果還沒部署）
echo   4. 執行功能測試
echo.
echo [文檔]
echo   - 詳細步驟: DEPLOYMENT_STEPS_2025-01-13.md
echo   - 手動命令: MANUAL_DEPLOYMENT_COMMANDS.md
echo   - 驗證報告: VERIFICATION_REPORT_2025-01-13.md
echo.
echo ========================================
echo   感謝使用自動部署腳本！
echo ========================================
echo.

REM 驗證後端
echo [驗證] 測試後端健康檢查...
curl -s %BACKEND_URL%/health
echo.
echo.

pause

endlocal
