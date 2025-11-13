# 🚀 部署步驟指南 - 2025-01-13 修復版本

**版本**: 2025-01-13 Critical Fixes
**更新日期**: 2025-11-13
**狀態**: ✅ 準備就緒

---

## 📋 部署前檢查清單

在開始部署前，請確認：

- [ ] 所有代碼已推送到 Git 倉庫
- [ ] 部署前檢查已通過（`node scripts/pre-deployment-check.js`）
- [ ] 有備份計劃（Firestore 數據導出）
- [ ] 團隊已知悉部署時間
- [ ] 監控系統已準備就緒

---

## 🔍 步驟 0: 執行部署前檢查

```bash
# 在 backend 目錄執行
cd chat-app/backend
node scripts/pre-deployment-check.js
```

**預期結果**: 所有檢查通過（24/26 通過，2 個警告可忽略）

如果檢查失敗，請修復問題後再繼續。

---

## 📦 步驟 1: 部署 Firestore Rules

**重要性**: ⭐⭐⭐⭐⭐ (必須先部署)

Firestore Rules 已更新，添加了 `idempotency_keys` 集合的規則。

```bash
# 在專案根目錄執行
cd chat-app
firebase deploy --only firestore:rules

# 驗證部署
firebase firestore:rules get
```

**預期輸出**:
```
✔  Deploy complete!
```

**驗證步驟**:
1. 訪問 Firebase Console → Firestore → Rules
2. 確認看到 `idempotency_keys` 規則
3. 檢查 `ad_watch_stats` 規則（應該只允許後端寫入）

**回滾方案**（如果出錯）:
```bash
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules
```

---

## 🔧 步驟 2: 部署後端 API

**重要性**: ⭐⭐⭐⭐⭐ (核心修復)

後端包含所有 Critical 修復和清理任務 API。

### 2.1 部署到 Cloud Run

```bash
# 在 backend 目錄執行
cd chat-app/backend

# Linux/Mac
chmod +x deploy-cloudrun.sh
./deploy-cloudrun.sh

# Windows（需要 Docker Desktop）
deploy-cloudrun.bat
```

**部署配置**:
- 服務名稱: `chat-app-backend`
- 區域: `asia-east1`
- 最小實例: 1
- 最大實例: 10
- 記憶體: 1GB
- CPU: 1

**預期輸出**:
```
Service [chat-app-backend] revision [chat-app-backend-00042-abc] has been deployed
Service URL: https://chat-app-backend-xxx.run.app
```

### 2.2 驗證後端部署

```bash
# 1. 檢查健康端點
curl https://your-backend.run.app/health

# 預期響應：{"status":"ok"}

# 2. 檢查 Cron 端點（開發環境測試）
curl -X POST https://your-backend.run.app/api/cron/test \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# 預期響應：{"success":true,"message":"Cron 端點測試成功",...}

# 3. 檢查清理任務狀態
curl https://your-backend.run.app/api/cron/status \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)"

# 預期響應：{"success":true,"totalLocked":0,...}
```

**回滾方案**（如果出錯）:
```bash
# 回滾到上一個版本
gcloud run services update-traffic chat-app-backend \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-east1
```

---

## 🌐 步驟 3: 部署前端

**重要性**: ⭐⭐⭐ (UI 改進)

前端包含會員升級進度提示等 UI 改進。

```bash
# 在專案根目錄執行
cd chat-app

# 構建前端
npm run build:frontend

# 部署到 Firebase Hosting（或 Cloudflare Pages）
firebase deploy --only hosting

# 或部署到 Cloudflare Pages
npm run deploy:pages
```

**預期輸出**:
```
✔  Deploy complete!
Hosting URL: https://your-app.web.app
```

**驗證步驟**:
1. 訪問前端 URL
2. 嘗試登入測試帳號
3. 檢查會員升級流程（應顯示進度提示）
4. 檢查瀏覽器控制台無錯誤

**回滾方案**（如果出錯）:
```bash
firebase hosting:rollback
```

---

## ⏰ 步驟 4: 配置 Cloud Scheduler

**重要性**: ⭐⭐⭐⭐ (自動清理必需)

配置定時任務，每 5 分鐘清理一次過期鎖定。

### 4.1 設置環境變數

```bash
# 設置必要的環境變數
export GCP_PROJECT_ID="chat-app-3-8a7ee"
export BACKEND_URL="https://your-backend.run.app"
export SERVICE_ACCOUNT_EMAIL="your-project@appspot.gserviceaccount.com"
```

### 4.2 執行設置腳本

```bash
# Linux/Mac
cd chat-app/backend
chmod +x scripts/setup-cloud-scheduler.sh
./scripts/setup-cloud-scheduler.sh

# Windows
cd chat-app\backend
scripts\setup-cloud-scheduler.bat
```

**預期輸出**:
```
✅ Cloud Scheduler 設置完成！
任務將每 5 分鐘自動執行一次。
```

### 4.3 驗證定時任務

```bash
# 1. 查看任務列表
gcloud scheduler jobs list --location=asia-east1

# 2. 手動執行一次測試
gcloud scheduler jobs run cleanup-upgrade-locks --location=asia-east1

# 3. 等待 10 秒後查看日誌
sleep 10
gcloud logging read '
  resource.type="cloud_scheduler_job"
  resource.labels.job_id="cleanup-upgrade-locks"
' --limit=10 --format=json

# 4. 檢查 API 日誌
gcloud logging read '
  resource.type="cloud_run_revision"
  jsonPayload.message=~"鎖定清理"
' --limit=10
```

**預期日誌**:
```json
{
  "message": "[Cron] 鎖定清理任務完成",
  "result": {
    "scanned": 0,
    "cleaned": 0,
    "errors": 0
  }
}
```

---

## 📊 步驟 5: 配置監控告警（可選但推薦）

**重要性**: ⭐⭐⭐ (生產環境推薦)

設置告警，及時發現問題。

### 5.1 創建通知頻道

```bash
# 創建 Email 通知頻道
gcloud alpha monitoring channels create \
  --display-name="Team Email" \
  --type=email \
  --channel-labels=email_address=your-team@example.com
```

### 5.2 創建日誌指標

```bash
# 1. 清理任務處理數量
gcloud logging metrics create cleanup_locks_count \
  --description="清理任務處理的鎖定數量" \
  --log-filter='
    resource.type="cloud_run_revision"
    jsonPayload.message=~"清理任務完成"
  ' \
  --value-extractor='EXTRACT(jsonPayload.result.cleaned)'

# 2. Scheduler Job 錯誤
gcloud logging metrics create scheduler_job_error \
  --description="Scheduler Job 執行錯誤" \
  --log-filter='
    resource.type="cloud_scheduler_job"
    resource.labels.job_id="cleanup-upgrade-locks"
    severity="ERROR"
  '

# 3. Transaction 失敗率
gcloud logging metrics create membership_upgrade_transaction_failure_rate \
  --description="會員升級 Transaction 失敗率" \
  --log-filter='
    resource.type="cloud_run_revision"
    jsonPayload.message=~"Transaction 失敗"
  '
```

### 5.3 創建告警策略

參考 `backend/monitoring-alerts.yaml` 文件，在 Cloud Console 中手動創建告警策略：

1. 訪問：https://console.cloud.google.com/monitoring/alerting/policies
2. 點擊「創建策略」
3. 根據 `monitoring-alerts.yaml` 配置每個告警

**推薦告警**:
- ⚠️ 清理任務失敗率 > 50%
- ⚠️ 檢測到 > 10 個過期鎖定
- ⚠️ Transaction 失敗率 > 10%
- ⚠️ API 響應時間 > 30 秒

---

## ✅ 步驟 6: 執行功能測試

**重要性**: ⭐⭐⭐⭐⭐ (確保一切正常)

部署完成後，執行完整的功能測試。

### 6.1 會員升級流程測試

```bash
# 測試帳號資訊（參考 shared/config/testAccounts.js）
# Email: test@example.com
# UID: PS7LYFSstdgyr7b9sCOKFgt3QVB3
```

**測試步驟**:
1. 使用測試帳號登入前端
2. 進入會員升級頁面
3. 選擇 VIP 方案
4. 觀察升級進度提示（應顯示 4 個階段）
5. 升級完成後檢查：
   - 會員等級已更新為 VIP
   - 金幣餘額正確扣除
   - 解鎖券已發放
   - 照片限制已更新（50 次/月）

**預期結果**: 升級成功，無錯誤

### 6.2 Transaction 失敗恢復測試

這個測試需要在開發環境進行：

```javascript
// 在 membership.service.js 中臨時添加強制失敗邏輯
if (userId === 'TEST_USER_ID') {
  throw new Error('測試 Transaction 失敗');
}
```

**測試步驟**:
1. 使用測試帳號嘗試升級
2. Transaction 應該失敗
3. 檢查 Firestore `usage_limits` 集合
4. 確認 `photos.upgrading` 已被清除（不是 true）

**預期結果**: 鎖定已自動清除，用戶可以再次嘗試升級

### 6.3 清理任務測試

```bash
# 1. 手動創建一個過期鎖定（在 Firestore Console）
# 集合: usage_limits
# 文檔 ID: TEST_USER_ID
# 數據: {photos: {upgrading: true, upgradingAt: <6分鐘前的時間戳>}}

# 2. 手動執行清理
gcloud scheduler jobs run cleanup-upgrade-locks --location=asia-east1

# 3. 等待 10 秒後檢查日誌
sleep 10
gcloud logging read '
  resource.type="cloud_run_revision"
  jsonPayload.message=~"清理任務完成"
' --limit=5

# 4. 檢查 Firestore，確認 TEST_USER_ID 的鎖定已清除
```

**預期結果**: 清理任務成功執行，過期鎖定已清除

### 6.4 併發購買測試

使用工具（如 Apache Bench 或 Postman）模擬併發購買：

```bash
# 使用 Apache Bench 模擬 10 個併發請求
ab -n 10 -c 10 -T 'application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -p purchase-payload.json \
  https://your-backend.run.app/api/coins/purchase-unlimited-chat
```

**預期結果**: 只有一個請求成功，其他請求返回「已永久解鎖」錯誤

### 6.5 廣告解鎖測試

**測試步驟**:
1. 使用測試帳號登入
2. 與一個角色對話到達限制
3. 觀看廣告解鎖
4. 快速連續觀看多個廣告（測試冷卻時間）
5. 嘗試使用相同 adId 再次解鎖（測試重放攻擊防護）

**預期結果**:
- 觀看廣告後解鎖 5 次對話
- 60 秒冷卻時間生效
- 相同 adId 無法重複使用

---

## 📈 步驟 7: 監控部署後狀態

部署完成後的前 24 小時，密切監控系統狀態。

### 7.1 關鍵監控指標

**Cloud Console 監控頁面**:
- Scheduler Jobs: https://console.cloud.google.com/cloudscheduler
- Cloud Run Metrics: https://console.cloud.google.com/run
- Firestore Usage: https://console.cloud.google.com/firestore/usage
- Logs Explorer: https://console.cloud.google.com/logs

**關鍵指標**:
1. **清理任務執行率**: 應該每 5 分鐘執行一次
2. **清理任務成功率**: 應該 > 95%
3. **Transaction 失敗率**: 應該 < 5%
4. **API 響應時間**: /api/cron/cleanup-locks < 10 秒
5. **當前過期鎖定數**: 應該 = 0

### 7.2 定期檢查腳本

創建一個定期檢查腳本（每小時執行）:

```bash
#!/bin/bash
# check-health.sh

echo "=== 健康檢查 $(date) ==="

# 1. 檢查清理任務狀態
echo "1. 清理任務狀態:"
gcloud scheduler jobs describe cleanup-upgrade-locks \
  --location=asia-east1 \
  --format="value(state)"

# 2. 檢查過期鎖定數量
echo "2. 過期鎖定檢查:"
curl -s https://your-backend.run.app/api/cron/status \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  | jq '.staleLocks'

# 3. 檢查最近的清理日誌
echo "3. 最近清理日誌:"
gcloud logging read '
  resource.type="cloud_run_revision"
  jsonPayload.message=~"清理任務完成"
' --limit=1 --format=json | jq '.result'

echo "=== 檢查完成 ==="
```

```bash
# 添加到 crontab（每小時執行）
0 * * * * /path/to/check-health.sh >> /var/log/health-check.log 2>&1
```

---

## 🆘 故障排除

### 問題 1: 清理任務執行失敗

**症狀**: Cloud Scheduler 顯示錯誤狀態

**可能原因**:
1. 後端 API 未部署或無法訪問
2. 服務帳號權限不足
3. OIDC 認證失敗

**解決方案**:
```bash
# 1. 檢查後端健康
curl https://your-backend.run.app/health

# 2. 檢查服務帳號權限
gcloud projects get-iam-policy chat-app-3-8a7ee \
  --flatten="bindings[].members" \
  --filter="bindings.members:$SERVICE_ACCOUNT_EMAIL"

# 3. 手動執行清理（繞過 Scheduler）
node chat-app/backend/scripts/cleanup-upgrade-locks.js
```

### 問題 2: 發現大量過期鎖定

**症狀**: 清理任務報告 cleaned > 10

**可能原因**:
1. Transaction 失敗率過高
2. 清理任務執行間隔過長
3. 系統負載過高

**解決方案**:
```bash
# 1. 立即手動清理
gcloud scheduler jobs run cleanup-upgrade-locks --location=asia-east1

# 2. 縮短執行間隔（改為 3 分鐘）
gcloud scheduler jobs update http cleanup-upgrade-locks \
  --schedule="*/3 * * * *" \
  --location=asia-east1

# 3. 查看 Transaction 失敗日誌
gcloud logging read '
  resource.type="cloud_run_revision"
  jsonPayload.message=~"Transaction 失敗"
' --limit=50 --format=json
```

### 問題 3: Transaction 失敗率過高

**症狀**: 日誌中頻繁出現 "Transaction 失敗" 錯誤

**可能原因**:
1. 用戶在升級過程中同時操作
2. Firestore 寫入衝突
3. 網絡問題

**解決方案**:
1. 優化前端 UI：在升級過程中禁用其他操作
2. 增加 Transaction 重試次數
3. 分析衝突模式，優化數據結構

### 問題 4: 用戶報告無法拍照

**症狀**: 用戶報告永久無法使用照片生成功能

**可能原因**: 升級鎖定未被清除

**解決方案**:
```bash
# 1. 檢查用戶的鎖定狀態
# 在 Firestore Console 查看 usage_limits/{userId}
# 檢查 photos.upgrading 是否為 true

# 2. 手動清除鎖定
node chat-app/backend/scripts/cleanup-upgrade-locks.js --user-id=USER_ID

# 3. 驗證清除成功
# 在 Firestore Console 確認 photos.upgrading = false
```

---

## 📝 部署後檢查清單

部署完成後，確認以下項目：

- [ ] Firestore Rules 已更新
- [ ] 後端 API 正常運行（/health 返回 ok）
- [ ] 前端可以正常訪問
- [ ] Cloud Scheduler 任務已創建且執行成功
- [ ] 清理任務 API 端點可訪問（/api/cron/cleanup-locks）
- [ ] 監控告警已配置
- [ ] 功能測試全部通過：
  - [ ] 會員升級流程
  - [ ] Transaction 失敗恢復
  - [ ] 清理任務執行
  - [ ] 併發購買防護
  - [ ] 廣告解鎖限制
- [ ] 日誌監控正常
- [ ] 無嚴重錯誤或告警

---

## 📚 相關文檔

- [驗證報告](VERIFICATION_REPORT_2025-01-13.md) - 完整驗證報告
- [修復說明](BUSINESS_LOGIC_FIXES_2025-01-13.md) - 修復詳細說明
- [實施指南](POST_FIX_IMPLEMENTATION_GUIDE.md) - 實施後操作指南
- [部署指南](chat-app/docs/DEPLOYMENT.md) - 通用部署指南
- [Cloud Scheduler 配置](chat-app/backend/scripts/setup-cloud-scheduler.sh)
- [監控配置](chat-app/backend/monitoring-alerts.yaml)

---

## 🎉 部署完成

恭喜！所有商業邏輯修復已成功部署到生產環境。

**下一步**:
1. 持續監控系統狀態（前 24 小時）
2. 收集用戶反饋
3. 分析清理任務執行數據
4. 準備下一次優化

**緊急聯絡**:
- 技術支援: [聯絡方式]
- 故障報告: [Issue Tracker]
- 文檔: [Documentation Site]

---

**部署完成時間**: __________
**部署負責人**: __________
**驗證負責人**: __________
