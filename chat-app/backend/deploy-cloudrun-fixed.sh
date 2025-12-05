#!/bin/bash

# Cloud Run 部署腳本（改進版 - 確保保留環境變數）
# 使用方式: ./deploy-cloudrun-fixed.sh

set -e  # 遇到錯誤立即退出

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置變數
PROJECT_ID="chat-app-3-8a7ee"             # GCP 專案 ID
SERVICE_NAME="chat-backend"               # Cloud Run 服務名稱
REGION="asia-east1"                       # 台灣區域
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "${GREEN}=== Chat App Backend - Cloud Run 部署（改進版） ===${NC}\n"

# 檢查是否已登入 GCP
echo -e "${YELLOW}[1/8] 檢查 GCP 登入狀態...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  echo -e "${RED}錯誤：未登入 GCP，請執行 'gcloud auth login'${NC}"
  exit 1
fi
echo -e "${GREEN}✅ 已登入 GCP${NC}"

# 設置專案
echo -e "\n${YELLOW}[2/8] 設置 GCP 專案...${NC}"
gcloud config set project ${PROJECT_ID}
echo -e "${GREEN}✅ 專案已設置: ${PROJECT_ID}${NC}"

# 檢查服務是否存在並獲取當前環境變數數量
echo -e "\n${YELLOW}[3/8] 檢查現有服務配置...${NC}"
if gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format="value(status.url)" > /dev/null 2>&1; then
  EXISTING_SERVICE=true

  # 獲取當前環境變數數量
  ENV_COUNT=$(gcloud run services describe ${SERVICE_NAME} \
    --region ${REGION} \
    --format json 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); env=data.get('spec',{}).get('template',{}).get('spec',{}).get('containers',[{}])[0].get('env',[]); print(len(env))" 2>/dev/null || echo "0")

  echo -e "${GREEN}✅ 現有服務存在，環境變數數量: ${ENV_COUNT}${NC}"

  if [ "$ENV_COUNT" -lt 10 ]; then
    echo -e "${RED}⚠️  警告：現有服務環境變數不足（少於 10 個）${NC}"
    echo -e "${YELLOW}   建議：先在 Cloud Run 控制台手動設置所有環境變數${NC}"
    echo -e "${YELLOW}   控制台 URL: https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/revisions?project=${PROJECT_ID}${NC}"
    read -p "是否繼續部署？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${YELLOW}部署已取消${NC}"
      exit 0
    fi
  fi

  # 獲取當前穩定版本
  CURRENT_REVISION=$(gcloud run services describe ${SERVICE_NAME} \
    --region ${REGION} \
    --format='value(status.traffic[0].revisionName)' 2>/dev/null || echo "")

  if [ -n "$CURRENT_REVISION" ]; then
    echo -e "${BLUE}   當前穩定版本: ${CURRENT_REVISION}${NC}"
  fi
else
  EXISTING_SERVICE=false
  echo -e "${YELLOW}⚠️  服務不存在，將創建新服務${NC}"
  echo -e "${YELLOW}   注意：需要手動在 Cloud Run 控制台設置環境變數${NC}"
fi

# 啟用必要的 API（首次部署需要）
echo -e "\n${YELLOW}[4/8] 啟用必要的 Google Cloud API...${NC}"
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable run.googleapis.com --quiet
gcloud services enable containerregistry.googleapis.com --quiet
echo -e "${GREEN}✅ API 已啟用${NC}"

# 構建 Docker 映像
echo -e "\n${YELLOW}[5/8] 構建 Docker 映像...${NC}"
gcloud builds submit --tag ${IMAGE_NAME} --quiet
echo -e "${GREEN}✅ 映像構建完成${NC}"

# 獲取新構建的映像 digest
echo -e "\n${YELLOW}[6/8] 獲取映像 digest...${NC}"
IMAGE_DIGEST=$(gcloud container images describe ${IMAGE_NAME}:latest --format='get(image_summary.digest)')
FULL_IMAGE="${IMAGE_NAME}@${IMAGE_DIGEST}"
echo -e "${GREEN}✅ 映像: ${FULL_IMAGE}${NC}"

# 部署到 Cloud Run
echo -e "\n${YELLOW}[7/8] 部署到 Cloud Run...${NC}"

if [ "$EXISTING_SERVICE" = true ]; then
  # 現有服務 - 只更新映像，保留環境變數
  echo -e "${BLUE}   模式: 更新現有服務（保留環境變數）${NC}"
  gcloud run deploy ${SERVICE_NAME} \
    --image ${FULL_IMAGE} \
    --region ${REGION} \
    --platform managed \
    --quiet
else
  # 新服務 - 需要設置基本配置
  echo -e "${BLUE}   模式: 創建新服務${NC}"
  gcloud run deploy ${SERVICE_NAME} \
    --image ${FULL_IMAGE} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --port 8080 \
    --quiet
fi

echo -e "${GREEN}✅ 部署完成${NC}"

# 檢查部署狀態
echo -e "\n${YELLOW}[8/8] 驗證部署...${NC}"

# 獲取服務 URL 和當前 revision
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format='value(status.url)')

NEW_REVISION=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format='value(status.traffic[0].revisionName)')

# 檢查流量分配
TRAFFIC_PERCENT=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format='value(status.traffic[0].percent)')

echo -e "${GREEN}✅ 服務 URL: ${SERVICE_URL}${NC}"
echo -e "${GREEN}✅ 當前 Revision: ${NEW_REVISION}${NC}"
echo -e "${GREEN}✅ 流量分配: ${TRAFFIC_PERCENT}%${NC}"

# 檢查新版本的環境變數數量
NEW_ENV_COUNT=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format json 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); env=data.get('spec',{}).get('template',{}).get('spec',{}).get('containers',[{}])[0].get('env',[]); print(len(env))" 2>/dev/null || echo "未知")

echo -e "${BLUE}   環境變數數量: ${NEW_ENV_COUNT}${NC}"

if [ "$NEW_ENV_COUNT" != "未知" ] && [ "$NEW_ENV_COUNT" -lt 10 ]; then
  echo -e "\n${RED}⚠️  警告：環境變數可能不完整（只有 ${NEW_ENV_COUNT} 個）${NC}"
  echo -e "${YELLOW}請在 Cloud Run 控制台檢查並補齊環境變數：${NC}"
  echo -e "${YELLOW}https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/revisions?project=${PROJECT_ID}${NC}"
fi

# 測試 health endpoint
echo -e "\n${YELLOW}測試服務健康狀態...${NC}"
sleep 5  # 等待服務就緒

if curl -sf "${SERVICE_URL}/health" > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s "${SERVICE_URL}/health")
    echo -e "${GREEN}✅ 健康檢查通過: ${HEALTH_RESPONSE}${NC}"
else
    echo -e "${RED}⚠️  健康檢查失敗${NC}"
    echo -e "${YELLOW}   可能原因：${NC}"
    echo -e "${YELLOW}   1. 環境變數配置不完整${NC}"
    echo -e "${YELLOW}   2. 服務啟動中，請稍後再試${NC}"
    echo -e "${YELLOW}   3. 查看日誌: gcloud run services logs read ${SERVICE_NAME} --region ${REGION}${NC}"
fi

# 顯示最終狀態
echo -e "\n${GREEN}=== 部署完成 ===${NC}"
echo -e "服務 URL: ${SERVICE_URL}"
echo -e "Revision: ${NEW_REVISION}"
echo -e "映像: ${FULL_IMAGE}"
echo -e "環境變數: ${NEW_ENV_COUNT} 個"

echo -e "\n${YELLOW}後續操作：${NC}"
echo "1. 測試 API: curl ${SERVICE_URL}/health"
echo "2. 查看日誌: gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
echo "3. 管理服務: https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}?project=${PROJECT_ID}"

if [ "$NEW_ENV_COUNT" != "未知" ] && [ "$NEW_ENV_COUNT" -lt 10 ]; then
  echo -e "\n${RED}⚠️  重要：請立即在控制台檢查環境變數配置！${NC}"
fi
