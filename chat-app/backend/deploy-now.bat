@echo off
echo ===================================
echo 正在建置和部署後端到 Cloud Run...
echo ===================================
echo.

echo [步驟 1/2] 建置 Docker 映像...
gcloud builds submit --config=cloudbuild.yaml . --project=chat-app-3-8a7ee

if %ERRORLEVEL% EQU 0 (
    echo.
    echo === 建置成功！===
    echo.
    echo [步驟 2/2] 部署到 Cloud Run...
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
) else (
    echo.
    echo 建置失敗，請檢查錯誤訊息
)

pause
