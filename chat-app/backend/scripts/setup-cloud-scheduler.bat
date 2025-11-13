@echo off
REM ###############################################################################
REM Cloud Scheduler 設置腳本 (Windows)
REM
REM 用途：自動配置 Cloud Scheduler 定時任務
REM 執行：scripts\setup-cloud-scheduler.bat
REM ###############################################################################

echo ========================================
echo   Cloud Scheduler 設置腳本
echo ========================================
echo.

REM 1. 檢查必要的環境變數
echo [步驟 1] 檢查環境配置...

if "%GCP_PROJECT_ID%"=="" (
  echo [錯誤] GCP_PROJECT_ID 環境變數未設置
  echo 請執行: set GCP_PROJECT_ID=your-project-id
  exit /b 1
)

if "%BACKEND_URL%"=="" (
  echo [錯誤] BACKEND_URL 環境變數未設置
  echo 請執行: set BACKEND_URL=https://your-backend.run.app
  exit /b 1
)

if "%SERVICE_ACCOUNT_EMAIL%"=="" (
  echo [警告] SERVICE_ACCOUNT_EMAIL 未設置，將使用默認服務帳號
  set SERVICE_ACCOUNT_EMAIL=%GCP_PROJECT_ID%@appspot.gserviceaccount.com
)

echo [完成] 環境配置檢查完成
echo    專案 ID: %GCP_PROJECT_ID%
echo    後端 URL: %BACKEND_URL%
echo    服務帳號: %SERVICE_ACCOUNT_EMAIL%
echo.

REM 2. 檢查 gcloud CLI
echo [步驟 2] 檢查 gcloud CLI...

where gcloud >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [錯誤] gcloud CLI 未安裝
  echo 請訪問: https://cloud.google.com/sdk/docs/install
  exit /b 1
)

echo [完成] gcloud CLI 已安裝
echo.

REM 3. 設置當前專案
echo [步驟 3] 設置 GCP 專案...
gcloud config set project %GCP_PROJECT_ID%
echo [完成] 專案設置完成
echo.

REM 4. 啟用必要的 API
echo [步驟 4] 啟用必要的 API...
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable run.googleapis.com
echo [完成] API 啟用完成
echo.

REM 5. 創建 Cloud Scheduler 任務
echo [步驟 5] 創建定時任務...
echo.

echo [創建] cleanup-upgrade-locks 任務

REM 檢查任務是否已存在
gcloud scheduler jobs describe cleanup-upgrade-locks --location=asia-east1 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  echo [更新] 任務已存在，將更新配置

  gcloud scheduler jobs update http cleanup-upgrade-locks ^
    --location=asia-east1 ^
    --schedule="*/5 * * * *" ^
    --uri="%BACKEND_URL%/api/cron/cleanup-locks" ^
    --http-method=POST ^
    --headers="Content-Type=application/json" ^
    --message-body="{\"maxAgeMinutes\": 5}" ^
    --oidc-service-account-email="%SERVICE_ACCOUNT_EMAIL%" ^
    --oidc-token-audience="%BACKEND_URL%" ^
    --time-zone="Asia/Taipei" ^
    --description="清理過期的會員升級鎖定（每 5 分鐘）" ^
    --attempt-deadline=120s ^
    --max-retry-attempts=3
) else (
  echo [創建] 創建新任務

  gcloud scheduler jobs create http cleanup-upgrade-locks ^
    --location=asia-east1 ^
    --schedule="*/5 * * * *" ^
    --uri="%BACKEND_URL%/api/cron/cleanup-locks" ^
    --http-method=POST ^
    --headers="Content-Type=application/json" ^
    --message-body="{\"maxAgeMinutes\": 5}" ^
    --oidc-service-account-email="%SERVICE_ACCOUNT_EMAIL%" ^
    --oidc-token-audience="%BACKEND_URL%" ^
    --time-zone="Asia/Taipei" ^
    --description="清理過期的會員升級鎖定（每 5 分鐘）" ^
    --attempt-deadline=120s ^
    --max-retry-attempts=3
)

echo [完成] 任務創建完成
echo.

REM 6. 測試任務執行
echo [步驟 6] 測試任務執行...
echo [測試] 立即執行一次清理任務

gcloud scheduler jobs run cleanup-upgrade-locks --location=asia-east1

echo [完成] 測試任務已觸發
echo [提示] 請等待幾秒鐘後檢查日誌
echo.

REM 7. 顯示配置摘要
echo ========================================
echo   配置摘要
echo ========================================
echo.

gcloud scheduler jobs describe cleanup-upgrade-locks --location=asia-east1

echo.
echo [完成] Cloud Scheduler 設置完成！
echo.

echo 下一步操作：
echo    1. 查看任務列表: gcloud scheduler jobs list --location=asia-east1
echo    2. 暫停任務: gcloud scheduler jobs pause cleanup-upgrade-locks --location=asia-east1
echo    3. 恢復任務: gcloud scheduler jobs resume cleanup-upgrade-locks --location=asia-east1
echo    4. 刪除任務: gcloud scheduler jobs delete cleanup-upgrade-locks --location=asia-east1
echo    5. 手動執行: gcloud scheduler jobs run cleanup-upgrade-locks --location=asia-east1
echo.

echo 監控任務執行：
echo    • Cloud Console: https://console.cloud.google.com/cloudscheduler?project=%GCP_PROJECT_ID%
echo    • 日誌查詢: https://console.cloud.google.com/logs/query?project=%GCP_PROJECT_ID%
echo.

echo 設置完成！任務將每 5 分鐘自動執行一次。
echo.

pause
