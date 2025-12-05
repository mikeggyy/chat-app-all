#!/bin/bash

# 修復 Cloud Run 環境變數腳本
# 從穩定版本複製所有環境變數到最新版本

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
PROJECT_ID="chat-app-3-8a7ee"
SERVICE_NAME="chat-backend"
REGION="asia-east1"
SOURCE_REVISION="chat-backend-node20-fixed"  # 有完整環境變數的版本

echo -e "${GREEN}=== 修復 Cloud Run 環境變數 ===${NC}\n"

# 1. 獲取穩定版本的所有環境變數
echo -e "${YELLOW}[1/4] 從 ${SOURCE_REVISION} 獲取環境變數...${NC}"

# 獲取環境變數並轉換為 --set-env-vars 格式
ENV_VARS=$(gcloud run revisions describe ${SOURCE_REVISION} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format='json' | python3 -c "
import sys, json

data = json.load(sys.stdin)
containers = data.get('spec', {}).get('containers', [{}])
env_list = containers[0].get('env', []) if containers else []

# 過濾掉 valueFrom（Secret 引用）的變數，這些需要單獨處理
env_pairs = []
secrets = []

for env in env_list:
    name = env.get('name', '')
    if 'value' in env:
        value = env['value']
        # 處理特殊字符
        value = value.replace('\"', '\\\"')
        env_pairs.append(f'{name}={value}')
    elif 'valueFrom' in env:
        # Secret 引用
        secret_ref = env.get('valueFrom', {}).get('secretKeyRef', {})
        secret_name = secret_ref.get('name', '')
        secret_key = secret_ref.get('key', 'latest')
        if secret_name:
            secrets.append(f'{name}={secret_name}:{secret_key}')

# 輸出普通環境變數
if env_pairs:
    print('ENV:' + ','.join(env_pairs))

# 輸出 Secret 引用
if secrets:
    print('SECRETS:' + ','.join(secrets))
")

# 解析輸出
PLAIN_ENV=$(echo "$ENV_VARS" | grep "^ENV:" | sed 's/^ENV://' || echo "")
SECRET_ENV=$(echo "$ENV_VARS" | grep "^SECRETS:" | sed 's/^SECRETS://' || echo "")

if [ -z "$PLAIN_ENV" ] && [ -z "$SECRET_ENV" ]; then
  echo -e "${RED}錯誤：無法獲取環境變數${NC}"
  exit 1
fi

ENV_COUNT=$(echo "$PLAIN_ENV" | tr ',' '\n' | wc -l)
SECRET_COUNT=$(echo "$SECRET_ENV" | tr ',' '\n' | grep -c . || echo "0")

echo -e "${GREEN}✅ 找到 ${ENV_COUNT} 個環境變數${NC}"
echo -e "${GREEN}✅ 找到 ${SECRET_COUNT} 個 Secret 引用${NC}"

# 2. 獲取最新的映像
echo -e "\n${YELLOW}[2/4] 獲取最新映像...${NC}"
LATEST_IMAGE=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format='value(spec.template.spec.containers[0].image)')

echo -e "${GREEN}✅ 映像: ${LATEST_IMAGE}${NC}"

# 3. 部署新版本（帶完整環境變數）
echo -e "\n${YELLOW}[3/4] 部署新版本（帶完整環境變數）...${NC}"

# 構建部署命令
DEPLOY_CMD="gcloud run deploy ${SERVICE_NAME} \
  --image ${LATEST_IMAGE} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --platform managed"

# 添加環境變數
if [ -n "$PLAIN_ENV" ]; then
  DEPLOY_CMD="$DEPLOY_CMD --set-env-vars=\"${PLAIN_ENV}\""
fi

# 添加 Secret
if [ -n "$SECRET_ENV" ]; then
  DEPLOY_CMD="$DEPLOY_CMD --set-secrets=\"${SECRET_ENV}\""
fi

# 執行部署
echo -e "${YELLOW}執行部署...${NC}"
eval $DEPLOY_CMD

# 4. 驗證
echo -e "\n${YELLOW}[4/4] 驗證部署...${NC}"

NEW_REVISION=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format='value(status.traffic[0].revisionName)')

NEW_ENV_COUNT=$(gcloud run revisions describe ${NEW_REVISION} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format='json' | python3 -c "
import sys, json
data = json.load(sys.stdin)
containers = data.get('spec', {}).get('containers', [{}])
env_list = containers[0].get('env', []) if containers else []
print(len(env_list))
")

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format='value(status.url)')

echo -e "${GREEN}✅ 新版本: ${NEW_REVISION}${NC}"
echo -e "${GREEN}✅ 環境變數數量: ${NEW_ENV_COUNT}${NC}"
echo -e "${GREEN}✅ 服務 URL: ${SERVICE_URL}${NC}"

# 測試健康檢查
echo -e "\n${YELLOW}測試健康檢查...${NC}"
sleep 3
if curl -sf "${SERVICE_URL}/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ 健康檢查通過！${NC}"
else
  echo -e "${YELLOW}⚠️ 健康檢查失敗，可能需要等待服務啟動${NC}"
fi

echo -e "\n${GREEN}=== 完成！ ===${NC}"
