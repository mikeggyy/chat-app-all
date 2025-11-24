@echo off
REM Cloud Run 部署腳本 (Windows 版本)
REM 使用方式: deploy-cloudrun.bat

setlocal enabledelayedexpansion

REM 配置變數
set PROJECT_ID=chat-app-3-8a7ee
set SERVICE_NAME=chat-backend
set REGION=asia-east1
set IMAGE_NAME=gcr.io/%PROJECT_ID%/%SERVICE_NAME%

echo === Chat App Backend - Cloud Run 部署 ===
echo.

REM 檢查是否已登入 GCP
echo 檢查 GCP 登入狀態...
for /f "tokens=*" %%a in ('gcloud auth list --format^="value(account)" 2^>nul') do set GCP_ACCOUNT=%%a
if not defined GCP_ACCOUNT (
    echo 錯誤：未登入 GCP，請執行 'gcloud auth login'
    exit /b 1
)
echo 已登入：%GCP_ACCOUNT%

REM 設置專案
echo 設置 GCP 專案...
gcloud config set project %PROJECT_ID%

REM 啟用必要的 API（首次部署需要）
echo 啟用必要的 Google Cloud API...
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

REM 構建 Docker 映像
echo 構建 Docker 映像...
gcloud builds submit --tag %IMAGE_NAME%

REM 部署到 Cloud Run（成本優化配置）
echo 部署到 Cloud Run（成本優化配置）...
gcloud run deploy %SERVICE_NAME% ^
  --image %IMAGE_NAME% ^
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
  --set-env-vars "NODE_ENV=production" ^
  --set-env-vars "USE_FIREBASE_EMULATOR=false"

REM 成本優化說明
echo.
echo ✅ 已套用成本優化配置：
echo   - 記憶體：512Mi（比 1Gi 便宜 50%%）
echo   - 最小實例：0（無流量時不計費）
echo   - 最大實例：3（限制突發費用）
echo   - CPU 節流：已啟用（空閒時降低成本）
echo   - 執行環境：Gen2（冷啟動快 2-3 倍）
echo   - CPU Boost：已啟用（加速啟動）
echo.

REM 注意：敏感環境變數（OPENAI_API_KEY, REPLICATE_API_TOKEN 等）
REM 請使用 Secret Manager 或在 Cloud Run 控制台手動設置

REM 獲取服務 URL
echo.
echo 部署完成！
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region %REGION% --format "value(status.url)"') do set SERVICE_URL=%%i
echo 服務 URL: !SERVICE_URL!

echo.
echo 後續步驟：
echo 1. 在 Cloud Run 控制台設置環境變數（API Keys）
echo 2. 更新 firebase.json 中的 serviceId 為: %SERVICE_NAME%
echo 3. 更新前端 .env 中的 VITE_API_URL 為: !SERVICE_URL!
echo 4. 執行 'firebase deploy --only hosting' 部署前端

endlocal
