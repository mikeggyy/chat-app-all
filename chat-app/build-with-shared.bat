@echo off
REM 從 chat-app 目錄構建，包含 shared 目錄

echo === 構建 Docker 映像（包含 shared 目錄）===

REM 創建臨時構建目錄
echo 創建臨時構建目錄...
if exist temp-build rmdir /s /q temp-build
mkdir temp-build

REM 複製 backend 文件
echo 複製 backend 文件...
xcopy backend temp-build\backend /E /I /H /Y

REM 複製 shared 目錄到正確的位置
echo 複製 shared 目錄...
mkdir temp-build\shared
xcopy ..\shared temp-build\shared /E /I /H /Y

REM 從臨時目錄構建
echo 構建 Docker 映像...
cd temp-build\backend
gcloud builds submit --tag gcr.io/chat-app-3-8a7ee/chat-backend .

REM 清理
cd ..\..
echo 清理臨時文件...
rmdir /s /q temp-build

echo === 構建完成 ===
