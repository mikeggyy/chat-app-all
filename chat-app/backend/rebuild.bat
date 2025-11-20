@echo off
echo === 重新構建並部署 Docker 映像 ===
echo.

REM 先檢查 shared 目錄內容
echo 檢查 shared 目錄內容...
dir /s /b shared\*.js | find "userUtils.js"
if %ERRORLEVEL% EQU 0 (
    echo ✓ userUtils.js 存在
) else (
    echo ✗ 錯誤：找不到 userUtils.js
    pause
    exit /b 1
)
echo.

echo 正在構建新映像（這可能需要幾分鐘）...
echo 使用 Cloud Build 配置文件構建（自動打破緩存）...
gcloud builds submit --config=cloudbuild.yaml . --project=chat-app-3-8a7ee

if %ERRORLEVEL% EQU 0 (
    echo.
    echo === 構建成功！===
    echo.
    echo 現在部署新映像到 Cloud Run...
    gcloud run deploy chat-backend ^
      --image gcr.io/chat-app-3-8a7ee/chat-backend ^
      --region asia-east1 ^
      --project=chat-app-3-8a7ee ^
      --platform managed

    if %ERRORLEVEL% EQU 0 (
        echo.
        echo === 部署成功！===
    ) else (
        echo.
        echo === 部署失敗 ===
    )
) else (
    echo.
    echo === 構建失敗 ===
)

pause
