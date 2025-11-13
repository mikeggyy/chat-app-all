# 🚀 生產環境部署指南

本指南涵蓋最新商業邏輯修復和 UTC+8 時區變更的部署流程。

## 📋 部署前檢查清單

### ✅ 代碼變更確認

- [x] **FieldValue 導入修復** - `backend/src/payment/coins.service.js:24`
- [x] **UTC+8 時區統一** - `backend/src/services/limitService/limitReset.js`
- [x] **會員過期檢查增強** - `backend/src/utils/membershipUtils.js`
- [x] **照片/影片卡片邏輯** - `backend/src/ai/photoLimit.service.js`, `videoLimit.service.js`
- [x] **圖片生成大小限制** - `backend/src/ai/imageGeneration.service.js`
- [x] **影片提示詞限制** - `backend/src/ai/videoGeneration.service.js`
- [x] **完整退款流程** - `backend/src/payment/coins.service.js`
- [x] **對話/語音每日重置** - `backend/src/conversation/conversationLimit.service.js`, `backend/src/ai/voiceLimit.service.js`
- [x] **API 成本監控系統** - `backend/src/services/apiCostMonitoring.service.js`

---

## 📦 任務 1: 本地測試（開發環境）

### 1.1 環境變數配置

確保 `.env` 文件包含所有必要的配置：

```bash
# Firebase Admin
FIREBASE_ADMIN_PROJECT_ID=chat-app-3-8a7ee
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account@chat-app-3-8a7ee.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# API 成本監控（新增）
DAILY_COST_WARNING=10
DAILY_COST_CRITICAL=50
MONTHLY_COST_WARNING=100
MONTHLY_COST_CRITICAL=500
```

### 1.2 運行測試腳本

```bash
cd chat-app/backend

# 測試 1: 商業邏輯修復驗證（靜態分析，不需要 Firebase）
node scripts/test-business-logic-fixes.js

# 測試 2: UTC+8 時區邏輯驗證（靜態分析）
node scripts/test-utc8-timezone.js

# 測試 3: 退款功能測試（需要 Firebase 連接）
# ⚠️ 確保已配置 Firebase 環境變數
node scripts/test-refund-function.js
```

**預期結果**：
- ✅ 測試 1: 所有靜態檢查通過
- ✅ 測試 2: 所有時區邏輯測試通過
- ✅ 測試 3: 退款功能 7 項測試全部通過

---

## 🔥 任務 2: 部署 Firestore 索引

### 2.1 驗證索引配置

檢查 `firestore.indexes.json` 包含新增的成本監控索引：

```bash
# 查看索引配置（應包含 api_calls, api_cost_stats, cost_alerts）
cat chat-app/firestore.indexes.json | grep -A 10 "api_calls\|api_cost_stats\|cost_alerts"
```

### 2.2 部署索引

```bash
cd chat-app

# 方法 1: 僅部署索引（推薦）
firebase deploy --only firestore:indexes

# 方法 2: 部署索引 + 規則
firebase deploy --only firestore

# 驗證部署狀態
firebase firestore:indexes
```

**預期輸出**：
```
✔  Deploy complete!

Firestore indexes:
  - (api_calls) userId ASC, timestamp DESC
  - (api_calls) service ASC, timestamp DESC
  - (api_calls) date ASC, service ASC
  - (api_cost_stats) date ASC
  - (cost_alerts) acknowledged ASC, timestamp DESC
```

### 2.3 等待索引建立

- ⏳ **小型資料庫**（<1000 文檔）：1-5 分鐘
- ⏳ **中型資料庫**（1000-10000 文檔）：10-30 分鐘
- ⏳ **大型資料庫**（>10000 文檔）：可能需要數小時

**檢查索引狀態**：
```bash
# Firebase Console 查看索引建立進度
# https://console.firebase.google.com/project/chat-app-3-8a7ee/firestore/indexes
```

---

## 🚀 任務 3: 部署後端代碼

### 3.1 選擇部署方法

#### **方法 A: Cloud Run（推薦）**

```bash
cd chat-app/backend

# 1. 確保已安裝 Google Cloud CLI
gcloud --version

# 2. 登入並設置專案
gcloud auth login
gcloud config set project chat-app-3-8a7ee

# 3. 構建 Docker 映像（如果有 Dockerfile）
docker build -t gcr.io/chat-app-3-8a7ee/backend:latest .

# 4. 推送到 Google Container Registry
docker push gcr.io/chat-app-3-8a7ee/backend:latest

# 5. 部署到 Cloud Run
gcloud run deploy chat-app-backend \
  --image gcr.io/chat-app-3-8a7ee/backend:latest \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="DAILY_COST_WARNING=10" \
  --set-env-vars="DAILY_COST_CRITICAL=50" \
  --set-env-vars="MONTHLY_COST_WARNING=100" \
  --set-env-vars="MONTHLY_COST_CRITICAL=500"
```

#### **方法 B: 使用部署腳本（Windows）**

```bash
cd chat-app/backend

# Windows
deploy-cloudrun.bat

# Linux/Mac
./deploy-cloudrun.sh
```

#### **方法 C: Firebase Hosting + Cloud Functions**

```bash
cd chat-app

# 部署 Functions
firebase deploy --only functions

# 部署 Hosting
firebase deploy --only hosting
```

### 3.2 驗證部署

```bash
# 檢查部署狀態
gcloud run services describe chat-app-backend --region=asia-east1

# 測試健康檢查端點
curl https://your-backend-url.run.app/health

# 測試成本監控端點（需要認證）
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-backend-url.run.app/api/admin/cost-stats/today
```

---

## 🌐 任務 4: 部署前端（可選）

如果前端有相關變更（如顯示 `allowedWithCard` 欄位）：

```bash
cd chat-app/frontend

# 1. 更新環境變數（如果需要）
# 編輯 .env.production

# 2. 構建生產版本
npm run build

# 3. 部署到 Firebase Hosting
firebase deploy --only hosting

# 或部署到 Cloudflare Pages
npm run deploy:pages
```

---

## 📊 任務 5: 部署後驗證

### 5.1 功能驗證清單

使用 Postman 或 curl 測試以下端點：

#### **1. 會員過期檢查**
```bash
# 測試付費會員（應該檢查過期時間）
curl -X GET "https://your-api.com/api/user/profile" \
  -H "Authorization: Bearer USER_TOKEN"

# 驗證：如果 membershipExpiresAt 無效或過期，應降級為 free
```

#### **2. 照片/影片卡片邏輯**
```bash
# 測試照片生成限制查詢
curl -X GET "https://your-api.com/api/ai/photo/can-generate" \
  -H "Authorization: Bearer USER_TOKEN"

# 預期響應：
# {
#   "allowed": false,
#   "allowedWithCard": true,  // ✅ 新增欄位
#   "photoCards": 5,
#   "canGenerate": true
# }
```

#### **3. 退款功能**
```bash
# ⚠️ 僅在測試環境測試！
curl -X POST "https://your-api.com/api/payment/refund" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "TEST_TRANSACTION_ID",
    "reason": "測試退款",
    "forceRefund": true
  }'

# 預期：金幣退還 + 資產回滾
```

#### **4. UTC+8 時區重置**
```bash
# 在 UTC+8 午夜前後測試對話限制
# 應該在台灣時間 00:00 重置

# 測試對話限制查詢
curl -X GET "https://your-api.com/api/conversations/limit/CHARACTER_ID" \
  -H "Authorization: Bearer USER_TOKEN"
```

#### **5. API 成本監控**
```bash
# 查看今日成本
curl -X GET "https://your-api.com/api/admin/cost-stats/today" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 查看本月成本
curl -X GET "https://your-api.com/api/admin/cost-stats/month" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 查看成本預警
curl -X GET "https://your-api.com/api/admin/cost-alerts?unacknowledged=true" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 5.2 日誌監控

```bash
# Cloud Run 日誌
gcloud logging read "resource.type=cloud_run_revision" \
  --limit 50 \
  --format json

# 查看成本監控日誌
gcloud logging read "jsonPayload.message=~'API 成本監控'" \
  --limit 20

# 查看重置日誌（UTC+8）
gcloud logging read "jsonPayload.message=~'限制重置.*UTC+8'" \
  --limit 20
```

### 5.3 Firestore 數據驗證

在 Firebase Console 檢查以下集合：

1. **`api_calls`** - 是否有新的 API 調用記錄
2. **`api_cost_stats`** - 是否有每日統計數據
3. **`cost_alerts`** - 如果超過閾值，是否有預警記錄
4. **`transactions`** - 退款交易記錄和狀態更新
5. **`usage_limits`** - 用戶限制數據的 `lastResetDate` 是否使用 UTC+8

---

## ⚠️ 回滾計畫

如果部署後發現問題，快速回滾步驟：

### 回滾後端

```bash
# Cloud Run - 回滾到前一個版本
gcloud run services update-traffic chat-app-backend \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-east1

# 查看所有版本
gcloud run revisions list --service=chat-app-backend --region=asia-east1
```

### 回滾 Firestore 索引

```bash
# 如果新索引導致問題，刪除它們
# ⚠️ 注意：這會影響成本監控查詢性能

# 在 Firebase Console 手動刪除索引
# https://console.firebase.google.com/project/chat-app-3-8a7ee/firestore/indexes
```

### 回滾代碼

```bash
# Git 回滾到前一個版本
git log --oneline -5  # 查看最近的提交
git revert HEAD       # 撤銷最後一次提交（保留歷史）

# 或者硬回滾（慎用！）
git reset --hard PREVIOUS_COMMIT_HASH
git push --force
```

---

## 📈 監控和維護

### 日常監控項目

1. **API 成本追蹤**
   - 每日檢查 `api_cost_stats` 集合
   - 設置 Cloud Monitoring 警報（超過 $50/天）

2. **重置邏輯驗證**
   - 監控 UTC+8 午夜（00:00）前後的日誌
   - 確認用戶限制正確重置

3. **退款審計**
   - 定期審查退款交易記錄
   - 檢查異常的退款模式

4. **錯誤監控**
   - Cloud Error Reporting 查看新錯誤
   - 特別關注 `FieldValue` 相關錯誤

### 定期維護任務

- **每週**：檢查成本統計，確認在預算內
- **每月**：審查退款記錄，更新退款政策
- **每季**：評估 UTC+8 時區設置對用戶體驗的影響

---

## 🔗 相關文檔

- [CHANGELOG.md](CHANGELOG.md) - 完整變更記錄
- [測試腳本](chat-app/backend/scripts/) - 所有測試腳本
- [Firebase Console](https://console.firebase.google.com/project/chat-app-3-8a7ee)
- [Cloud Run Console](https://console.cloud.google.com/run?project=chat-app-3-8a7ee)

---

## 📞 支援和故障排除

### 常見問題

**Q: FieldValue 錯誤**
```
ReferenceError: FieldValue is not defined
```
**A**: 確保 `coins.service.js` 第 24 行有 `import { FieldValue } from "firebase-admin/firestore";`

**Q: 重置時間不正確**
```
用戶反映凌晨沒有重置
```
**A**: 檢查 `limitReset.js` 是否使用 `getUTC8Date()`，確認日誌顯示 `(UTC+8)`

**Q: 索引未建立**
```
Firestore 查詢錯誤：需要索引
```
**A**: 等待索引建立完成，或在 Firebase Console 手動建立

**Q: 成本監控沒有數據**
```
api_cost_stats 集合為空
```
**A**: 確認 `.env` 有成本監控配置，檢查 `ai.service.js` 是否調用 `recordApiCall()`

---

## ✅ 部署完成檢查清單

- [ ] 本地測試全部通過
- [ ] Firestore 索引已部署並建立完成
- [ ] 後端代碼已部署到生產環境
- [ ] 前端代碼已部署（如有變更）
- [ ] 功能驗證清單全部通過
- [ ] 日誌監控正常
- [ ] Firestore 數據驗證通過
- [ ] 回滾計畫已準備
- [ ] 監控和警報已設置

**部署日期**: _____________
**部署人員**: _____________
**驗證人員**: _____________

---

**祝部署順利！** 🚀
