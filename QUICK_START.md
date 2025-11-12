# 商業邏輯修復 - 快速開始指南

## 🚀 30 分鐘快速部署

本指南幫助你在 30 分鐘內完成所有商業邏輯修復的部署。

---

## ✅ 部署前檢查清單

在開始之前，請確認：

- [ ] 已備份 Firestore 數據（或使用 Emulator 測試）
- [ ] 已備份 `.env` 文件
- [ ] 了解修復內容（查看審計報告）
- [ ] 已安裝 Node.js 和 Firebase CLI
- [ ] 有 30 分鐘不被打擾的時間

---

## 📋 方法 1：自動部署（推薦）

### Windows 用戶

```bash
# 1. 雙擊運行
apply-business-logic-fixes.bat

# 或在命令提示符中執行
.\apply-business-logic-fixes.bat
```

### Linux/Mac 用戶

```bash
# 1. 添加執行權限
chmod +x apply-business-logic-fixes.sh

# 2. 執行腳本
./apply-business-logic-fixes.sh
```

### 腳本會自動完成：
- ✅ 備份原始文件
- ✅ 部署修復文件
- ✅ 檢查語法錯誤
- ✅ 部署 Firestore 索引（如有 Firebase CLI）
- ⚠️ 如果失敗會自動回滾

---

## 📋 方法 2：手動部署

### 步驟 1：備份（5 分鐘）

```bash
cd chat-app/backend/src

# 備份所有要修改的文件
cp ad/ad.service.js ad/ad.service.BACKUP.js
cp ad/ad.routes.js ad/ad.routes.BACKUP.js
cp gift/gift.service.js gift/gift.service.BACKUP.js
cp membership/unlockTickets.service.js membership/unlockTickets.service.BACKUP.js
cp membership/unlockTickets.routes.js membership/unlockTickets.routes.BACKUP.js
cp services/limitService/limitReset.js services/limitService/limitReset.BACKUP.js
```

### 步驟 2：部署修復文件（10 分鐘）

```bash
# 繼續在 chat-app/backend/src 目錄

# 廣告系統
cp ad/ad.service.FIXED.js ad/ad.service.js
cp ad/ad.routes.FIXED.js ad/ad.routes.js

# 禮物系統
cp gift/gift.service.FIXED.js gift/gift.service.js

# 解鎖券系統
cp membership/unlockTickets.service.FIXED.js membership/unlockTickets.service.js
cp membership/unlockTickets.routes.FIXED.js membership/unlockTickets.routes.js

# 限制系統
cp services/limitService/limitReset.FIXED.js services/limitService/limitReset.js

# 開發模式安全
cp ../../../devModeHelper.js utils/devModeHelper.js
```

### 步驟 3：手動應用補丁（10 分鐘）

參考以下文件的說明手動修改：

1. **baseLimitService.PATCH.js** → 修改 `services/baseLimitService.js`
   - 查找 `import { checkAndReset`
   - 替換為 `import { checkAndResetAll, checkAndResetAdUnlocks`
   - 應用其他修改（參考補丁文件）

2. **coins.routes.PATCH.js** → 修改 `payment/coins.routes.js`
   - 添加 `import { validateDevModeBypass }`
   - 在開發模式繞過處添加安全驗證
   - 同樣修改應用到 `membership/membership.routes.js`

### 步驟 4：部署 Firestore 索引（3 分鐘）

```bash
cd chat-app

# Firestore 索引已自動合併到 firestore.indexes.json
# 只需部署即可
firebase deploy --only firestore:indexes
```

### 步驟 5：驗證語法（2 分鐘）

```bash
cd chat-app/backend/src

# 檢查所有修改的文件
node -c ad/ad.service.js
node -c ad/ad.routes.js
node -c gift/gift.service.js
node -c membership/unlockTickets.service.js
node -c membership/unlockTickets.routes.js
node -c services/limitService/limitReset.js
node -c utils/devModeHelper.js

# 如果全部通過，應該沒有輸出
echo "✓ 所有文件語法正確"
```

---

## 🧪 測試驗證（開發環境）

### 啟動 Emulator 測試

```bash
cd chat-app

# 設置環境變數
export NODE_ENV=development
export ENABLE_DEV_PURCHASE_BYPASS=false
export USE_FIREBASE_EMULATOR=true

# 啟動 Emulator
npm run dev:with-emulator
```

### 快速測試清單

#### 測試 1：廣告系統
```bash
# 1. 登入測試帳號
# 2. 請求觀看廣告
POST /api/ads/watch
Body: { "characterId": "match-001" }

# 3. 檢查 Firestore ad_records 集合
# 應該看到新的記錄

# 4. 驗證廣告
POST /api/ads/verify
Body: { "adId": "剛才返回的 adId" }

# 5. 領取獎勵
POST /api/ads/claim
Body: { "adId": "同上" }

# 6. 再次領取（應該返回已領取）
POST /api/ads/claim
Body: { "adId": "同上" }
```

#### 測試 2：禮物購買
```bash
# 1. 設置餘額 100 金幣
POST /api/coins/set-balance
Body: { "balance": 100 }

# 2. 送禮（80 金幣）
POST /api/gifts/send
Body: { "characterId": "match-001", "giftId": "gift_rose", "requestId": "test-1" }

# 3. 檢查餘額（應該是 20）
GET /api/coins/balance

# 4. 快速重複送禮（應該失敗 - 餘額不足）
POST /api/gifts/send
Body: { "characterId": "match-001", "giftId": "gift_rose", "requestId": "test-2" }
```

#### 測試 3：解鎖券
```bash
# 1. 檢查餘額
GET /api/unlock-tickets/balances

# 2. 使用解鎖券
POST /api/unlock-tickets/use/character
Body: { "characterId": "match-001", "requestId": "test-1" }

# 3. 重複使用（應該失敗 - 卡片不足）
POST /api/unlock-tickets/use/character
Body: { "characterId": "match-001", "requestId": "test-2" }
```

#### 測試 4：限制重置
```bash
# 1. 查看對話限制
GET /api/limits/conversation/stats

# 2. 觀看廣告解鎖 5 次
# （參考測試 1）

# 3. 檢查 unlocked 次數（應該是 5）
GET /api/limits/conversation/stats

# 4. 模擬第二天（手動修改 Firestore 的 lastAdResetDate）
# 或等待實際的一天

# 5. 再次檢查（unlocked 應該重置為 0）
GET /api/limits/conversation/stats
```

#### 測試 5：開發模式保護
```bash
# 1. 設置環境變數
export NODE_ENV=production
export ENABLE_DEV_PURCHASE_BYPASS=true

# 2. 重啟服務

# 3. 嘗試開發模式購買
POST /api/coins/purchase/package
Body: { "packageId": "coin_100" }

# 應該返回錯誤：「生產環境不允許使用開發模式繞過」
```

---

## 🚨 如果遇到問題

### 問題 1：語法錯誤

```bash
# 回滾到備份文件
cd chat-app/backend/src
cp ad/ad.service.BACKUP.js ad/ad.service.js
# ... 其他文件

# 檢查錯誤訊息，修正後重新部署
```

### 問題 2：Firestore 索引錯誤

```bash
# 檢查索引狀態
firebase firestore:indexes

# 刪除錯誤的索引（如有）
firebase firestore:indexes:delete

# 重新部署
firebase deploy --only firestore:indexes
```

### 問題 3：測試失敗

1. 檢查 Firestore Emulator 是否正常運行
2. 檢查環境變數設置
3. 查看後端日誌（console 輸出）
4. 檢查 Firestore 數據是否正確寫入

### 問題 4：服務無法啟動

```bash
# 檢查端口是否被佔用
netstat -ano | findstr :4000  # Windows
lsof -i :4000                 # Linux/Mac

# 清理端口
npm run cleanup-ports

# 重啟服務
npm run dev
```

---

## ✅ 部署成功後

### 檢查清單

- [ ] 所有測試通過
- [ ] Firestore 有新的集合（ad_records, gift_transactions）
- [ ] 廣告系統正常運作
- [ ] 禮物購買無競態條件
- [ ] 解鎖券使用正常
- [ ] 限制重置邏輯正確
- [ ] 開發模式保護已啟用

### 下一步

1. **在生產環境部署前**：
   - 確認所有測試通過
   - 確認環境變數設置正確（`NODE_ENV=production`）
   - 備份生產 Firestore 數據

2. **生產環境部署**：
   ```bash
   # 部署後端到 Cloud Run
   cd chat-app/backend
   gcloud run deploy chat-app-backend --source .

   # 部署前端到 Firebase Hosting
   cd ../frontend
   npm run build
   firebase deploy --only hosting
   ```

3. **監控和觀察**：
   - 查看 Cloud Run 日誌
   - 監控錯誤率
   - 檢查 Firestore 寫入量
   - 收集用戶反饋

---

## 📞 需要幫助？

如果遇到任何問題：

1. 查看完整的部署指南：`BUSINESS_LOGIC_FIX_DEPLOYMENT_GUIDE.md`
2. 查看審計報告了解修復內容
3. 檢查日誌和錯誤訊息
4. 回滾到備份文件（所有 `.BACKUP.js` 文件）

---

## 🎉 恭喜！

你已經成功完成商業邏輯修復的部署！

**重要提醒**：
- ⚠️ 生產環境部署前務必完整測試
- ⚠️ 確認 `ENABLE_DEV_PURCHASE_BYPASS=false`
- ⚠️ 定期備份 Firestore 數據
- ⚠️ 監控系統運行狀況

**修復成果**：
- ✅ 廣告系統持久化，重啟後不丟失
- ✅ 禮物購買無競態條件，餘額安全
- ✅ 解鎖券有並發保護和冪等性
- ✅ 限制重置邏輯正確（廣告解鎖每日重置）
- ✅ 開發模式有安全保護（生產環境禁用）
