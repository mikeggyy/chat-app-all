#!/bin/bash
# 快速部署腳本 - 上傳到 Cloud Shell 執行

echo "🚀 開始部署修復..."

# 創建目錄結構
mkdir -p backend-deploy/src
mkdir -p backend-deploy/shared/backend-utils

# 移動上傳的文件
mv ~/index.js backend-deploy/src/ 2>/dev/null || echo "index.js 已在目標位置"
mv ~/csrfProtection.js backend-deploy/shared/backend-utils/ 2>/dev/null || echo "csrfProtection.js 已在目標位置"

cd backend-deploy

# 創建 Dockerfile
cat > Dockerfile << 'EOF'
FROM gcr.io/chat-app-3-8a7ee/chat-backend:latest
COPY src/index.js /app/src/index.js
COPY shared/backend-utils/csrfProtection.js /app/shared/backend-utils/csrfProtection.js
CMD ["node", "/app/src/index.js"]
EOF

echo "📦 構建 Docker 映像..."
gcloud builds submit --tag gcr.io/chat-app-3-8a7ee/chat-backend .

echo "🚢 部署到 Cloud Run..."
gcloud run deploy chat-backend \
  --image gcr.io/chat-app-3-8a7ee/chat-backend \
  --region asia-east1 \
  --project chat-app-3-8a7ee \
  --platform managed

echo "✅ 部署完成！"
echo ""
echo "請訪問 https://chat-app-all.pages.dev 測試"
echo "記得按 Ctrl + Shift + R 強制刷新瀏覽器"
