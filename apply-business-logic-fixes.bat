@echo off
REM 商業邏輯修復 - 自動部署腳本 (Windows)
REM 執行前請確保已備份數據！

echo ====================================
echo 商業邏輯修復 - 自動部署腳本
echo ====================================
echo.

REM 檢查是否在正確的目錄
if not exist "chat-app\backend\src" (
    echo [錯誤] 請在 chat-app-all 根目錄執行此腳本
    pause
    exit /b 1
)

echo [步驟 1/6] 檢查環境...
echo.

REM 檢查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 未安裝 Node.js
    pause
    exit /b 1
)
echo ✓ Node.js 已安裝

REM 檢查 Firebase CLI
firebase --version >nul 2>&1
if errorlevel 1 (
    echo [警告] 未安裝 Firebase CLI，跳過索引部署
    set SKIP_FIREBASE=1
) else (
    echo ✓ Firebase CLI 已安裝
    set SKIP_FIREBASE=0
)

echo.
echo [步驟 2/6] 備份原始文件...
echo.

cd chat-app\backend\src

REM 備份廣告系統
if exist ad\ad.service.js (
    copy ad\ad.service.js ad\ad.service.BACKUP.js >nul
    echo ✓ 已備份 ad.service.js
)
if exist ad\ad.routes.js (
    copy ad\ad.routes.js ad\ad.routes.BACKUP.js >nul
    echo ✓ 已備份 ad.routes.js
)

REM 備份禮物系統
if exist gift\gift.service.js (
    copy gift\gift.service.js gift\gift.service.BACKUP.js >nul
    echo ✓ 已備份 gift.service.js
)

REM 備份解鎖券系統
if exist membership\unlockTickets.service.js (
    copy membership\unlockTickets.service.js membership\unlockTickets.service.BACKUP.js >nul
    echo ✓ 已備份 unlockTickets.service.js
)
if exist membership\unlockTickets.routes.js (
    copy membership\unlockTickets.routes.js membership\unlockTickets.routes.BACKUP.js >nul
    echo ✓ 已備份 unlockTickets.routes.js
)

REM 備份限制系統
if exist services\limitService\limitReset.js (
    copy services\limitService\limitReset.js services\limitService\limitReset.BACKUP.js >nul
    echo ✓ 已備份 limitReset.js
)

echo.
echo [步驟 3/6] 部署修復文件...
echo.

REM 部署廣告系統
if exist ad\ad.service.FIXED.js (
    copy ad\ad.service.FIXED.js ad\ad.service.js >nul
    echo ✓ 已部署 ad.service.js
) else (
    echo [警告] 找不到 ad.service.FIXED.js
)

if exist ad\ad.routes.FIXED.js (
    copy ad\ad.routes.FIXED.js ad\ad.routes.js >nul
    echo ✓ 已部署 ad.routes.js
) else (
    echo [警告] 找不到 ad.routes.FIXED.js
)

REM 部署禮物系統
if exist gift\gift.service.FIXED.js (
    copy gift\gift.service.FIXED.js gift\gift.service.js >nul
    echo ✓ 已部署 gift.service.js
) else (
    echo [警告] 找不到 gift.service.FIXED.js
)

REM 部署解鎖券系統
if exist membership\unlockTickets.service.FIXED.js (
    copy membership\unlockTickets.service.FIXED.js membership\unlockTickets.service.js >nul
    echo ✓ 已部署 unlockTickets.service.js
) else (
    echo [警告] 找不到 unlockTickets.service.FIXED.js
)

if exist membership\unlockTickets.routes.FIXED.js (
    copy membership\unlockTickets.routes.FIXED.js membership\unlockTickets.routes.js >nul
    echo ✓ 已部署 unlockTickets.routes.js
) else (
    echo [警告] 找不到 unlockTickets.routes.FIXED.js
)

REM 部署限制系統
if exist services\limitService\limitReset.FIXED.js (
    copy services\limitService\limitReset.FIXED.js services\limitService\limitReset.js >nul
    echo ✓ 已部署 limitReset.js
) else (
    echo [警告] 找不到 limitReset.FIXED.js
)

REM 部署開發模式安全輔助
if exist ..\..\..\devModeHelper.js (
    copy ..\..\..\devModeHelper.js utils\devModeHelper.js >nul
    echo ✓ 已部署 devModeHelper.js
) else (
    echo [警告] 找不到 devModeHelper.js
)

cd ..\..\..

echo.
echo [步驟 4/6] 檢查語法錯誤...
echo.

node -c chat-app\backend\src\ad\ad.service.js
if errorlevel 1 (
    echo [錯誤] ad.service.js 語法錯誤
    goto :rollback
)
echo ✓ ad.service.js 語法正確

node -c chat-app\backend\src\gift\gift.service.js
if errorlevel 1 (
    echo [錯誤] gift.service.js 語法錯誤
    goto :rollback
)
echo ✓ gift.service.js 語法正確

node -c chat-app\backend\src\membership\unlockTickets.service.js
if errorlevel 1 (
    echo [錯誤] unlockTickets.service.js 語法錯誤
    goto :rollback
)
echo ✓ unlockTickets.service.js 語法正確

echo.
echo [步驟 5/6] 部署 Firestore 索引...
echo.

if %SKIP_FIREBASE%==1 (
    echo [跳過] Firebase CLI 未安裝，請手動部署索引：
    echo   firebase deploy --only firestore:indexes
) else (
    cd chat-app
    firebase deploy --only firestore:indexes
    if errorlevel 1 (
        echo [警告] Firestore 索引部署失敗，可稍後手動部署
    ) else (
        echo ✓ Firestore 索引部署成功
    )
    cd ..
)

echo.
echo [步驟 6/6] 完成部署
echo.
echo ====================================
echo ✓ 商業邏輯修復部署完成！
echo ====================================
echo.
echo 接下來的步驟：
echo 1. 查看 BUSINESS_LOGIC_FIX_DEPLOYMENT_GUIDE.md
echo 2. 手動應用以下補丁：
echo    - baseLimitService.PATCH.js
echo    - coins.routes.PATCH.js
echo 3. 在開發環境測試功能
echo 4. 部署到生產環境
echo.
echo 備份文件位置：
echo   chat-app\backend\src\**\*.BACKUP.js
echo.
pause
exit /b 0

:rollback
echo.
echo ====================================
echo [錯誤] 部署失敗，正在回滾...
echo ====================================
echo.
cd chat-app\backend\src

if exist ad\ad.service.BACKUP.js (
    copy ad\ad.service.BACKUP.js ad\ad.service.js >nul
    echo ✓ 已回滾 ad.service.js
)
if exist ad\ad.routes.BACKUP.js (
    copy ad\ad.routes.BACKUP.js ad\ad.routes.js >nul
    echo ✓ 已回滾 ad.routes.js
)
if exist gift\gift.service.BACKUP.js (
    copy gift\gift.service.BACKUP.js gift\gift.service.js >nul
    echo ✓ 已回滾 gift.service.js
)
if exist membership\unlockTickets.service.BACKUP.js (
    copy membership\unlockTickets.service.BACKUP.js membership\unlockTickets.service.js >nul
    echo ✓ 已回滾 unlockTickets.service.js
)
if exist membership\unlockTickets.routes.BACKUP.js (
    copy membership\unlockTickets.routes.BACKUP.js membership\unlockTickets.routes.js >nul
    echo ✓ 已回滾 unlockTickets.routes.js
)
if exist services\limitService\limitReset.BACKUP.js (
    copy services\limitService\limitReset.BACKUP.js services\limitService\limitReset.js >nul
    echo ✓ 已回滾 limitReset.js
)

cd ..\..\..

echo.
echo 所有文件已回滾到原始狀態
echo.
pause
exit /b 1
