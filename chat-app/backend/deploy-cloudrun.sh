#!/bin/bash

# Cloud Run 部署腳本
# 使用方式: ./deploy-cloudrun.sh

set -e  # 遇到錯誤立即退出

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置變數
PROJECT_ID="chat-app-3-8a7ee"             # GCP 專案 ID
SERVICE_NAME="chat-backend"               # Cloud Run 服務名稱
REGION="asia-east1"                       # 台灣區域
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "${GREEN}=== Chat App Backend - Cloud Run 部署 ===${NC}\n"

# 檢查是否已登入 GCP
echo -e "${YELLOW}檢查 GCP 登入狀態...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  echo -e "${RED}錯誤：未登入 GCP，請執行 'gcloud auth login'${NC}"
  exit 1
fi

# 設置專案
echo -e "${YELLOW}設置 GCP 專案...${NC}"
gcloud config set project ${PROJECT_ID}

# 啟用必要的 API（首次部署需要）
echo -e "${YELLOW}啟用必要的 Google Cloud API...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# 構建 Docker 映像
echo -e "${YELLOW}構建 Docker 映像...${NC}"
gcloud builds submit --tag ${IMAGE_NAME}

# 部署到 Cloud Run（成本優化配置）
echo -e "${YELLOW}部署到 Cloud Run（成本優化配置）...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 80 \
  --cpu-throttling \
  --execution-environment gen2 \
  --cpu-boost \
  --timeout 60 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "USE_FIREBASE_EMULATOR=false"

# 成本優化說明
echo -e "\n${GREEN}✅ 已套用成本優化配置：${NC}"
echo -e "  - 記憶體：512Mi（比 1Gi 便宜 50%）"
echo -e "  - 最小實例：0（無流量時不計費）"
echo -e "  - 最大實例：3（限制突發費用）"
echo -e "  - CPU 節流：已啟用（空閒時降低成本）"
echo -e "  - 執行環境：Gen2（冷啟動快 2-3 倍）"
echo -e "  - CPU Boost：已啟用（加速啟動）"

# 注意：敏感環境變數（OPENAI_API_KEY, REPLICATE_API_TOKEN 等）
# 請使用 Secret Manager 或在 Cloud Run 控制台手動設置

# 獲取服務 URL
echo -e "\n${GREEN}部署完成！${NC}"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo -e "${GREEN}服務 URL: ${SERVICE_URL}${NC}"

echo -e "\n${YELLOW}後續步驟：${NC}"
echo "1. 在 Cloud Run 控制台設置環境變數（API Keys）"
echo "2. 更新 firebase.json 中的 serviceId 為: ${SERVICE_NAME}"
echo "3. 更新前端 .env 中的 VITE_API_URL 為: ${SERVICE_URL}"
echo "4. 執行 'firebase deploy --only hosting' 部署前端"
