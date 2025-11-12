#!/bin/bash
# 商業邏輯修復 - 自動部署腳本 (Linux/Mac)
# 執行前請確保已備份數據！

set -e  # 遇到錯誤立即退出

echo "===================================="
echo "商業邏輯修復 - 自動部署腳本"
echo "===================================="
echo ""

# 檢查是否在正確的目錄
if [ ! -d "chat-app/backend/src" ]; then
    echo "[錯誤] 請在 chat-app-all 根目錄執行此腳本"
    exit 1
fi

echo "[步驟 1/6] 檢查環境..."
echo ""

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo "[錯誤] 未安裝 Node.js"
    exit 1
fi
echo "✓ Node.js 已安裝: $(node --version)"

# 檢查 Firebase CLI
SKIP_FIREBASE=0
if ! command -v firebase &> /dev/null; then
    echo "[警告] 未安裝 Firebase CLI，跳過索引部署"
    SKIP_FIREBASE=1
else
    echo "✓ Firebase CLI 已安裝: $(firebase --version | head -n 1)"
fi

echo ""
echo "[步驟 2/6] 備份原始文件..."
echo ""

cd chat-app/backend/src

# 備份廣告系統
if [ -f "ad/ad.service.js" ]; then
    cp ad/ad.service.js ad/ad.service.BACKUP.js
    echo "✓ 已備份 ad.service.js"
fi
if [ -f "ad/ad.routes.js" ]; then
    cp ad/ad.routes.js ad/ad.routes.BACKUP.js
    echo "✓ 已備份 ad.routes.js"
fi

# 備份禮物系統
if [ -f "gift/gift.service.js" ]; then
    cp gift/gift.service.js gift/gift.service.BACKUP.js
    echo "✓ 已備份 gift.service.js"
fi

# 備份解鎖券系統
if [ -f "membership/unlockTickets.service.js" ]; then
    cp membership/unlockTickets.service.js membership/unlockTickets.service.BACKUP.js
    echo "✓ 已備份 unlockTickets.service.js"
fi
if [ -f "membership/unlockTickets.routes.js" ]; then
    cp membership/unlockTickets.routes.js membership/unlockTickets.routes.BACKUP.js
    echo "✓ 已備份 unlockTickets.routes.js"
fi

# 備份限制系統
if [ -f "services/limitService/limitReset.js" ]; then
    cp services/limitService/limitReset.js services/limitService/limitReset.BACKUP.js
    echo "✓ 已備份 limitReset.js"
fi

echo ""
echo "[步驟 3/6] 部署修復文件..."
echo ""

# 部署廣告系統
if [ -f "ad/ad.service.FIXED.js" ]; then
    cp ad/ad.service.FIXED.js ad/ad.service.js
    echo "✓ 已部署 ad.service.js"
else
    echo "[警告] 找不到 ad.service.FIXED.js"
fi

if [ -f "ad/ad.routes.FIXED.js" ]; then
    cp ad/ad.routes.FIXED.js ad/ad.routes.js
    echo "✓ 已部署 ad.routes.js"
else
    echo "[警告] 找不到 ad.routes.FIXED.js"
fi

# 部署禮物系統
if [ -f "gift/gift.service.FIXED.js" ]; then
    cp gift/gift.service.FIXED.js gift/gift.service.js
    echo "✓ 已部署 gift.service.js"
else
    echo "[警告] 找不到 gift.service.FIXED.js"
fi

# 部署解鎖券系統
if [ -f "membership/unlockTickets.service.FIXED.js" ]; then
    cp membership/unlockTickets.service.FIXED.js membership/unlockTickets.service.js
    echo "✓ 已部署 unlockTickets.service.js"
else
    echo "[警告] 找不到 unlockTickets.service.FIXED.js"
fi

if [ -f "membership/unlockTickets.routes.FIXED.js" ]; then
    cp membership/unlockTickets.routes.FIXED.js membership/unlockTickets.routes.js
    echo "✓ 已部署 unlockTickets.routes.js"
else
    echo "[警告] 找不到 unlockTickets.routes.FIXED.js"
fi

# 部署限制系統
if [ -f "services/limitService/limitReset.FIXED.js" ]; then
    cp services/limitService/limitReset.FIXED.js services/limitService/limitReset.js
    echo "✓ 已部署 limitReset.js"
else
    echo "[警告] 找不到 limitReset.FIXED.js"
fi

# 部署開發模式安全輔助
if [ -f "../../../devModeHelper.js" ]; then
    cp ../../../devModeHelper.js utils/devModeHelper.js
    echo "✓ 已部署 devModeHelper.js"
else
    echo "[警告] 找不到 devModeHelper.js"
fi

cd ../../..

echo ""
echo "[步驟 4/6] 檢查語法錯誤..."
echo ""

if node -c chat-app/backend/src/ad/ad.service.js; then
    echo "✓ ad.service.js 語法正確"
else
    echo "[錯誤] ad.service.js 語法錯誤"
    exit 1
fi

if node -c chat-app/backend/src/gift/gift.service.js; then
    echo "✓ gift.service.js 語法正確"
else
    echo "[錯誤] gift.service.js 語法錯誤"
    exit 1
fi

if node -c chat-app/backend/src/membership/unlockTickets.service.js; then
    echo "✓ unlockTickets.service.js 語法正確"
else
    echo "[錯誤] unlockTickets.service.js 語法錯誤"
    exit 1
fi

echo ""
echo "[步驟 5/6] 部署 Firestore 索引..."
echo ""

if [ $SKIP_FIREBASE -eq 1 ]; then
    echo "[跳過] Firebase CLI 未安裝，請手動部署索引："
    echo "  firebase deploy --only firestore:indexes"
else
    cd chat-app
    if firebase deploy --only firestore:indexes; then
        echo "✓ Firestore 索引部署成功"
    else
        echo "[警告] Firestore 索引部署失敗，可稍後手動部署"
    fi
    cd ..
fi

echo ""
echo "[步驟 6/6] 完成部署"
echo ""
echo "===================================="
echo "✓ 商業邏輯修復部署完成！"
echo "===================================="
echo ""
echo "接下來的步驟："
echo "1. 查看 BUSINESS_LOGIC_FIX_DEPLOYMENT_GUIDE.md"
echo "2. 手動應用以下補丁："
echo "   - baseLimitService.PATCH.js"
echo "   - coins.routes.PATCH.js"
echo "3. 在開發環境測試功能"
echo "4. 部署到生產環境"
echo ""
echo "備份文件位置："
echo "  chat-app/backend/src/**/*.BACKUP.js"
echo ""
