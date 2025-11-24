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
gcloud builds submit --tag ${IMAGE_NAME} --quiet

# 獲取新構建的映像 digest
echo -e "${YELLOW}獲取映像 digest...${NC}"
IMAGE_DIGEST=$(gcloud container images describe ${IMAGE_NAME}:latest --format='get(image_summary.digest)')
FULL_IMAGE="${IMAGE_NAME}@${IMAGE_DIGEST}"
echo -e "${GREEN}✅ 映像: ${FULL_IMAGE}${NC}"

# 部署到 Cloud Run（只更新映像，保留所有環境變數）
echo -e "${YELLOW}部署到 Cloud Run...${NC}"
echo -e "${YELLOW}注意：保留所有現有環境變數，只更新 Docker 映像${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image ${FULL_IMAGE} \
  --region ${REGION} \
  --platform managed \
  --quiet

# 檢查部署狀態
echo -e "\n${YELLOW}檢查部署狀態...${NC}"

# 獲取服務 URL 和當前 revision
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format='value(status.url)')

CURRENT_REVISION=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format='value(status.traffic[0].revisionName)')

echo -e "${GREEN}✅ 當前 revision: ${CURRENT_REVISION}${NC}"
echo -e "${GREEN}✅ 服務 URL: ${SERVICE_URL}${NC}"

# 測試 health endpoint
echo -e "\n${YELLOW}測試服務健康狀態...${NC}"
if curl -sf "${SERVICE_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 服務健康檢查通過${NC}"
    echo -e "\n${GREEN}🎉 部署成功！${NC}"
else
    echo -e "${RED}⚠️  警告：健康檢查失敗，請檢查日誌${NC}"
    echo -e "   日誌 URL: https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/logs?project=${PROJECT_ID}"
fi

# 顯示最終狀態
echo -e "\n${GREEN}=== 部署完成 ===${NC}"
echo -e "服務 URL: ${SERVICE_URL}"
echo -e "Revision: ${CURRENT_REVISION}"
echo -e "映像: ${FULL_IMAGE}"

echo -e "\n${YELLOW}後續操作：${NC}"
echo "1. 測試 API: curl ${SERVICE_URL}/health"
echo "2. 查看日誌: gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
echo "3. 管理服務: https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}?project=${PROJECT_ID}"

echo -e "\n${YELLOW}💡 提示：${NC}"
echo "• 環境變數已保留，無需重新設置"
echo "• 如需修改環境變數，請在 Cloud Run 控制台手動設置"
echo "• 下次部署直接執行此腳本即可"
