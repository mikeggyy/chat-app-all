@echo off
REM ================================================
REM Chat App Backend - Cloud Run 快速部署腳本
REM 用途：一鍵建構並部署後端到 Cloud Run
REM ================================================

setlocal enabledelayedexpansion

REM 配置變數
set PROJECT_ID=chat-app-3-8a7ee
set SERVICE_NAME=chat-backend
set REGION=asia-east1
set IMAGE_NAME=gcr.io/%PROJECT_ID%/%SERVICE_NAME%

echo.
echo ===================================================
echo   Chat App Backend - Cloud Run 部署
echo ===================================================
echo   專案: %PROJECT_ID%
echo   服務: %SERVICE_NAME%
echo   區域: %REGION%
echo ===================================================
echo.

REM 確認是否繼續
set /p CONFIRM="確定要部署到 Cloud Run? (Y/n): "
if /i "%CONFIRM%"=="n" (
    echo 已取消部署
    exit /b 0
)

echo.
echo [1/4] 檢查 GCP 登入狀態...
gcloud auth list --filter=status:ACTIVE --format="value(account)" >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 未登入 GCP
    echo 請執行: gcloud auth login
    pause
    exit /b 1
)
echo [OK] GCP 已登入

echo.
echo [2/4] 設置 GCP 專案...
gcloud config set project %PROJECT_ID% >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 無法設置專案
    pause
    exit /b 1
)
echo [OK] 專案已設置: %PROJECT_ID%

echo.
echo [3/4] 建構 Docker 映像...
echo      這可能需要 2-5 分鐘...
gcloud builds submit --tag %IMAGE_NAME% --quiet
if errorlevel 1 (
    echo.
    echo [錯誤] Docker 建構失敗
    echo 請檢查 Dockerfile 和 cloudbuild.yaml
    pause
    exit /b 1
)
echo [OK] Docker 映像建構完成

echo.
echo [4/4] 部署到 Cloud Run...
gcloud run deploy %SERVICE_NAME% ^
  --image %IMAGE_NAME% ^
  --platform managed ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --memory 512Mi ^
  --cpu 1 ^
  --min-instances 0 ^
  --max-instances 5 ^
  --concurrency 80 ^
  --cpu-throttling ^
  --execution-environment gen2 ^
  --cpu-boost ^
  --timeout 60 ^
  --set-env-vars "NODE_ENV=production" ^
  --set-env-vars "USE_FIREBASE_EMULATOR=false" ^
  --quiet

if errorlevel 1 (
    echo.
    echo [錯誤] Cloud Run 部署失敗
    pause
    exit /b 1
)

REM 獲取服務 URL
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region %REGION% --format "value(status.url)"') do set SERVICE_URL=%%i

echo.
echo ===================================================
echo   部署成功!
echo ===================================================
echo.
echo   服務 URL: !SERVICE_URL!
echo.
echo   成本優化配置：
echo   - 記憶體: 512Mi
echo   - 最小實例: 0 (無流量時不計費)
echo   - 最大實例: 5
echo   - CPU 節流: 已啟用
echo   - Gen2 執行環境: 冷啟動更快
echo.
echo   注意：API Keys 等敏感變數請在 Cloud Console 設置
echo   https://console.cloud.google.com/run/detail/%REGION%/%SERVICE_NAME%/revisions
echo.
echo ===================================================

endlocal
pause
