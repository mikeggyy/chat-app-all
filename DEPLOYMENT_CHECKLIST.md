# ✅ 快速部署檢查清單

## 📦 步驟 1: 本地驗證（無需 Firebase 連接）

### 靜態代碼檢查

```bash
cd chat-app/backend

# 1. 驗證 FieldValue 導入
grep -n "import.*FieldValue" src/payment/coins.service.js
# 預期：應該在第 24 行看到導入語句

# 2. 驗證 UTC+8 函數存在
grep -n "getUTC8Date\|getUTC8Month" src/services/limitService/limitReset.js
# 預期：應該看到這兩個函數定義

# 3. 驗證 UTC+8 函數被使用
grep -n "getUTC8Date()" src/services/limitService/limitReset.js
# 預期：應該在 3 個地方使用（基礎重置、廣告重置、初始化）

# 4. 驗證對話/語音改為每日重置
grep -n "RESET_PERIOD.DAILY" src/conversation/conversationLimit.service.js src/ai/voiceLimit.service.js
# 預期：兩個文件都應該使用 DAILY

# 5. 運行靜態測試
node scripts/test-business-logic-fixes.js
node scripts/test-utc8-timezone.js
```

**預期結果**：
- ✅ FieldValue 已導入
- ✅ UTC+8 函數已定義並使用
- ✅ 對話/語音使用每日重置
- ✅ 所有靜態測試通過

---

## 🔥 步驟 2: 部署 Firestore 索引

```bash
cd chat-app

# 檢查 Firebase 登入狀態
firebase login --status

# 如果未登入，執行登入
firebase login

# 部署索引
firebase deploy --only firestore:indexes

# 驗證索引狀態
firebase firestore:indexes
```

**預期輸出**：
```
✔  Deploy complete!

Firestore indexes:
  ✓ (api_calls) userId, timestamp
  ✓ (api_calls) service, timestamp
  ✓ (api_calls) date, service
  ✓ (api_cost_stats) date
  ✓ (cost_alerts) acknowledged, timestamp
```

**等待時間**：通常 5-30 分鐘（取決於現有數據量）

---

## 🚀 步驟 3: 部署後端代碼

### 選擇部署方法：

#### **選項 A: Cloud Run（推薦）**
```bash
cd chat-app/backend

# Windows
deploy-cloudrun.bat

# Linux/Mac
./deploy-cloudrun.sh
```

#### **選項 B: Firebase Functions**
```bash
cd chat-app
firebase deploy --only functions
```

#### **選項 C: 手動部署**
```bash
# 1. 提交代碼到 Git
git add .
git commit -m "feat: 退款功能修復和 UTC+8 時區統一"
git push

# 2. 觸發 CI/CD 流程（如果有配置）
# 或手動在伺服器上拉取最新代碼並重啟
```

---

## 📊 步驟 4: 部署後快速驗證

### 4.1 健康檢查

```bash
# 測試後端是否正常運行
curl https://your-backend-url/health

# 預期響應：
# {"status":"ok","timestamp":"2025-11-13T..."}
```

### 4.2 功能驗證（選擇 2-3 個關鍵功能測試）

#### **測試 1: 照片卡片邏輯**
```bash
# 使用真實用戶 Token 測試
curl -X GET "https://your-api.com/api/ai/photo/can-generate" \
  -H "Authorization: Bearer YOUR_USER_TOKEN"

# 檢查響應是否包含新欄位：
# {
#   "allowed": true/false,
#   "allowedWithCard": true/false,  // ✅ 新欄位
#   "photoCards": 5,
#   "canGenerate": true
# }
```

#### **測試 2: 對話限制**
```bash
# 測試對話限制查詢
curl -X GET "https://your-api.com/api/conversations/stats" \
  -H "Authorization: Bearer YOUR_USER_TOKEN"

# 檢查 resetPeriod 是否為 "daily"（新值）
```

#### **測試 3: API 成本監控**（管理員功能）
```bash
# 查看今日成本統計
curl -X GET "https://your-api.com/api/admin/cost-stats/today" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 預期：返回成本數據（即使是 $0.00）
```

### 4.3 日誌檢查

在 Cloud Run 或 Cloud Logging 中查看最近日誌：

```bash
# 查看最近的日誌（5 分鐘內）
gcloud logging read "resource.type=cloud_run_revision AND timestamp>\"$(date -u -d '5 minutes ago' '+%Y-%m-%dT%H:%M:%S')Z\"" \
  --limit 20 \
  --format json

# 或在 Cloud Console 查看：
# https://console.cloud.google.com/logs
```

**檢查重點**：
- ✅ 沒有 `FieldValue is not defined` 錯誤
- ✅ 看到 `[限制重置] ... (UTC+8)` 日誌（如果有重置發生）
- ✅ 看到 `[API 成本監控]` 日誌（如果有 AI API 調用）

---

## ⚠️ 如果發現問題

### 問題 1: FieldValue 錯誤

**症狀**:
```
ReferenceError: FieldValue is not defined
```

**解決**:
```bash
# 確認修復已部署
cd chat-app/backend
grep -n "import.*FieldValue" src/payment/coins.service.js

# 如果沒有，手動添加：
# 在第 24 行添加：import { FieldValue } from "firebase-admin/firestore";

# 重新部署
git add src/payment/coins.service.js
git commit -m "fix: add missing FieldValue import"
git push
```

### 問題 2: 重置時間不正確

**症狀**: 用戶反映限制沒有在午夜重置

**檢查**:
```bash
# 查看重置日誌
gcloud logging read "jsonPayload.message=~'限制重置'" --limit 10

# 確認日誌顯示 (UTC+8)
```

### 問題 3: 索引未建立

**症狀**:
```
Firestore: The query requires an index
```

**解決**:
```bash
# 檢查索引狀態
firebase firestore:indexes

# 如果狀態是 "Building"，等待建立完成
# 如果狀態是 "Error"，在 Firebase Console 手動重建
```

---

## 🎯 完整檢查清單

### 部署前
- [ ] 代碼已提交到 Git
- [ ] FieldValue 導入已確認
- [ ] UTC+8 函數已確認
- [ ] 靜態測試已通過

### 部署中
- [ ] Firebase 索引已部署
- [ ] 索引建立狀態：正在建立中/已完成
- [ ] 後端代碼已部署
- [ ] 部署沒有錯誤訊息

### 部署後
- [ ] 健康檢查通過
- [ ] 照片卡片邏輯測試通過
- [ ] 對話限制測試通過（resetPeriod = "daily"）
- [ ] API 成本監控有數據
- [ ] 日誌沒有錯誤
- [ ] 用戶功能正常

### 監控設置（可選，但推薦）
- [ ] Cloud Monitoring 警報已設置（成本超過閾值）
- [ ] 錯誤追蹤已啟用（Cloud Error Reporting）
- [ ] 日誌查詢已保存（快速查看重置日誌）

---

## 📞 快速參考

### 重要 URL
- Firebase Console: https://console.firebase.google.com/project/chat-app-3-8a7ee
- Cloud Run: https://console.cloud.google.com/run?project=chat-app-3-8a7ee
- Cloud Logging: https://console.cloud.google.com/logs?project=chat-app-3-8a7ee

### 關鍵文件
- `backend/src/payment/coins.service.js:24` - FieldValue 導入
- `backend/src/services/limitService/limitReset.js:23-40` - UTC+8 函數
- `backend/src/conversation/conversationLimit.service.js:21` - 每日重置
- `backend/src/ai/voiceLimit.service.js:22` - 每日重置

### 測試腳本
- `backend/scripts/test-business-logic-fixes.js` - 商業邏輯驗證
- `backend/scripts/test-utc8-timezone.js` - 時區邏輯驗證
- `backend/scripts/test-refund-function.js` - 退款功能測試（需 Firebase）

---

**部署日期**: ________________

**部署狀態**: [ ] 成功  [ ] 部分成功  [ ] 失敗

**備註**: _____________________________________

---

**祝部署順利！** 🚀
