#!/bin/bash

###############################################################################
# Cloud Scheduler 設置腳本
#
# 用途：自動配置 Cloud Scheduler 定時任務
# 執行：chmod +x scripts/setup-cloud-scheduler.sh && ./scripts/setup-cloud-scheduler.sh
###############################################################################

set -e  # 遇到錯誤立即退出

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Cloud Scheduler 設置腳本${NC}"
echo -e "${BLUE}========================================${NC}\n"

# 1. 檢查必要的環境變數
echo -e "${YELLOW}📋 步驟 1: 檢查環境配置...${NC}"

if [ -z "$GCP_PROJECT_ID" ]; then
  echo -e "${RED}❌ 錯誤: GCP_PROJECT_ID 環境變數未設置${NC}"
  echo -e "${YELLOW}請執行: export GCP_PROJECT_ID=your-project-id${NC}"
  exit 1
fi

if [ -z "$BACKEND_URL" ]; then
  echo -e "${RED}❌ 錯誤: BACKEND_URL 環境變數未設置${NC}"
  echo -e "${YELLOW}請執行: export BACKEND_URL=https://your-backend.run.app${NC}"
  exit 1
fi

if [ -z "$SERVICE_ACCOUNT_EMAIL" ]; then
  echo -e "${YELLOW}⚠️  警告: SERVICE_ACCOUNT_EMAIL 未設置，將使用默認服務帳號${NC}"
  SERVICE_ACCOUNT_EMAIL="$GCP_PROJECT_ID@appspot.gserviceaccount.com"
fi

echo -e "${GREEN}✅ 環境配置檢查完成${NC}"
echo -e "   專案 ID: $GCP_PROJECT_ID"
echo -e "   後端 URL: $BACKEND_URL"
echo -e "   服務帳號: $SERVICE_ACCOUNT_EMAIL\n"

# 2. 檢查 gcloud CLI
echo -e "${YELLOW}📋 步驟 2: 檢查 gcloud CLI...${NC}"

if ! command -v gcloud &> /dev/null; then
  echo -e "${RED}❌ 錯誤: gcloud CLI 未安裝${NC}"
  echo -e "${YELLOW}請訪問: https://cloud.google.com/sdk/docs/install${NC}"
  exit 1
fi

echo -e "${GREEN}✅ gcloud CLI 已安裝${NC}\n"

# 3. 設置當前專案
echo -e "${YELLOW}📋 步驟 3: 設置 GCP 專案...${NC}"
gcloud config set project "$GCP_PROJECT_ID"
echo -e "${GREEN}✅ 專案設置完成${NC}\n"

# 4. 啟用必要的 API
echo -e "${YELLOW}📋 步驟 4: 啟用必要的 API...${NC}"
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable run.googleapis.com
echo -e "${GREEN}✅ API 啟用完成${NC}\n"

# 5. 創建 Cloud Scheduler 任務
echo -e "${YELLOW}📋 步驟 5: 創建定時任務...${NC}\n"

# 任務 1: 清理過期鎖定（每 5 分鐘）
echo -e "${BLUE}🔧 創建任務: cleanup-upgrade-locks${NC}"

# 檢查任務是否已存在
if gcloud scheduler jobs describe cleanup-upgrade-locks --location=asia-east1 &> /dev/null; then
  echo -e "${YELLOW}⚠️  任務已存在，將更新配置${NC}"

  gcloud scheduler jobs update http cleanup-upgrade-locks \
    --location=asia-east1 \
    --schedule="*/5 * * * *" \
    --uri="$BACKEND_URL/api/cron/cleanup-locks" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body='{"maxAgeMinutes": 5}' \
    --oidc-service-account-email="$SERVICE_ACCOUNT_EMAIL" \
    --oidc-token-audience="$BACKEND_URL" \
    --time-zone="Asia/Taipei" \
    --description="清理過期的會員升級鎖定（每 5 分鐘）" \
    --attempt-deadline=120s \
    --max-retry-attempts=3
else
  echo -e "${YELLOW}📝 創建新任務${NC}"

  gcloud scheduler jobs create http cleanup-upgrade-locks \
    --location=asia-east1 \
    --schedule="*/5 * * * *" \
    --uri="$BACKEND_URL/api/cron/cleanup-locks" \
    --http-method=POST \
    --headers="Content-Type=application/json" \
    --message-body='{"maxAgeMinutes": 5}' \
    --oidc-service-account-email="$SERVICE_ACCOUNT_EMAIL" \
    --oidc-token-audience="$BACKEND_URL" \
    --time-zone="Asia/Taipei" \
    --description="清理過期的會員升級鎖定（每 5 分鐘）" \
    --attempt-deadline=120s \
    --max-retry-attempts=3
fi

echo -e "${GREEN}✅ 任務創建完成${NC}\n"

# 6. 測試任務執行
echo -e "${YELLOW}📋 步驟 6: 測試任務執行...${NC}"
echo -e "${BLUE}立即執行一次清理任務（測試）${NC}"

gcloud scheduler jobs run cleanup-upgrade-locks --location=asia-east1

echo -e "${GREEN}✅ 測試任務已觸發${NC}"
echo -e "${YELLOW}請等待幾秒鐘後檢查日誌：${NC}"
echo -e "   gcloud logging read 'resource.type=cloud_scheduler_job AND resource.labels.job_id=cleanup-upgrade-locks' --limit=10 --format=json\n"

# 7. 顯示配置摘要
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  配置摘要${NC}"
echo -e "${BLUE}========================================${NC}\n"

gcloud scheduler jobs describe cleanup-upgrade-locks --location=asia-east1

echo -e "\n${GREEN}✅ Cloud Scheduler 設置完成！${NC}\n"

echo -e "${YELLOW}📝 下一步操作：${NC}"
echo -e "   1. 查看任務列表: ${BLUE}gcloud scheduler jobs list --location=asia-east1${NC}"
echo -e "   2. 暫停任務: ${BLUE}gcloud scheduler jobs pause cleanup-upgrade-locks --location=asia-east1${NC}"
echo -e "   3. 恢復任務: ${BLUE}gcloud scheduler jobs resume cleanup-upgrade-locks --location=asia-east1${NC}"
echo -e "   4. 刪除任務: ${BLUE}gcloud scheduler jobs delete cleanup-upgrade-locks --location=asia-east1${NC}"
echo -e "   5. 手動執行: ${BLUE}gcloud scheduler jobs run cleanup-upgrade-locks --location=asia-east1${NC}\n"

echo -e "${YELLOW}📊 監控任務執行：${NC}"
echo -e "   • Cloud Console: ${BLUE}https://console.cloud.google.com/cloudscheduler?project=$GCP_PROJECT_ID${NC}"
echo -e "   • 日誌查詢: ${BLUE}https://console.cloud.google.com/logs/query?project=$GCP_PROJECT_ID${NC}\n"

echo -e "${GREEN}🎉 設置完成！任務將每 5 分鐘自動執行一次。${NC}\n"
