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
call gcloud config set project %PROJECT_ID%

REM 啟用必要的 API（首次部署需要）
echo 啟用必要的 Google Cloud API...
call gcloud services enable cloudbuild.googleapis.com
call gcloud services enable run.googleapis.com
call gcloud services enable containerregistry.googleapis.com

REM 構建 Docker 映像
echo 構建 Docker 映像...
call gcloud builds submit --tag %IMAGE_NAME% --quiet

REM 獲取新構建的映像 digest
echo 獲取映像 digest...
for /f "tokens=*" %%i in ('gcloud container images describe %IMAGE_NAME%:latest --format="value(image_summary.digest)"') do set IMAGE_DIGEST=%%i
set FULL_IMAGE=%IMAGE_NAME%@%IMAGE_DIGEST%
echo ✅ 映像: %FULL_IMAGE%

REM 部署到 Cloud Run（只更新映像，保留所有環境變數）
echo.
echo 部署到 Cloud Run...
echo 注意：保留所有現有環境變數，只更新 Docker 映像
call gcloud run deploy %SERVICE_NAME% ^
  --image %FULL_IMAGE% ^
  --region %REGION% ^
  --platform managed ^
  --quiet

REM 檢查部署狀態
echo.
echo 檢查部署狀態...

REM 獲取服務 URL 和當前 revision
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region %REGION% --format "value(status.url)"') do set SERVICE_URL=%%i
for /f "tokens=*" %%i in ('gcloud run services describe %SERVICE_NAME% --region %REGION% --format "value(status.traffic[0].revisionName)"') do set CURRENT_REVISION=%%i

echo ✅ 當前 revision: %CURRENT_REVISION%
echo ✅ 服務 URL: !SERVICE_URL!

REM 測試 health endpoint
echo.
echo 測試服務健康狀態...
curl -sf "!SERVICE_URL!/health" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ 服務健康檢查通過
    echo.
    echo 🎉 部署成功！
) else (
    echo ⚠️  警告：健康檢查失敗，請檢查日誌
    echo    日誌 URL: https://console.cloud.google.com/run/detail/%REGION%/%SERVICE_NAME%/logs?project=%PROJECT_ID%
)

REM 顯示最終狀態
echo.
echo === 部署完成 ===
echo 服務 URL: !SERVICE_URL!
echo Revision: %CURRENT_REVISION%
echo 映像: %FULL_IMAGE%

echo.
echo 後續操作：
echo 1. 測試 API: curl !SERVICE_URL!/health
echo 2. 查看日誌: gcloud run services logs read %SERVICE_NAME% --region %REGION%
echo 3. 管理服務: https://console.cloud.google.com/run/detail/%REGION%/%SERVICE_NAME%?project=%PROJECT_ID%

echo.
echo 💡 提示：
echo • 環境變數已保留，無需重新設置
echo • 如需修改環境變數，請在 Cloud Run 控制台手動設置
echo • 下次部署直接執行此腳本即可

endlocal
