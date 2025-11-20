@echo off
echo ===================================
echo 部署映像到 Cloud Run...
echo ===================================
echo.

gcloud run deploy chat-backend ^
  --image gcr.io/chat-app-3-8a7ee/chat-backend ^
  --region asia-east1 ^
  --project=chat-app-3-8a7ee ^
  --platform managed

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================
    echo 部署成功！
    echo ===================================
) else (
    echo.
    echo 部署失敗，請檢查錯誤訊息
)

pause
