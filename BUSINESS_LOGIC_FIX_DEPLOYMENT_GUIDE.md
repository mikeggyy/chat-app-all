# 商業邏輯修復 - 部署指南

## 📋 修復概覽

本次修復解決了 **30+ 個商業邏輯和安全問題**，包括：

### 🔥 P0 嚴重問題（已修復）
1. ✅ **廣告驗證系統** - 添加 Firestore 持久化和驗證邏輯
2. ✅ **禮物購買競態條件** - 使用 Firestore Transaction 保護
3. ✅ **解鎖券系統** - 添加 Transaction 和冪等性保護
4. ✅ **限制系統重置邏輯** - 分離廣告解鎖的每日重置
5. ✅ **開發模式繞過** - 添加環境和權限檢查

---

## 🚀 部署步驟

### 第一階段：準備工作（30 分鐘）

#### 1. 備份數據
```bash
# 備份 Firestore 數據（使用 Firebase Console 或 CLI）
firebase firestore:export gs://chat-app-3-8a7ee-backup/$(date +%Y%m%d)

# 備份 .env 文件
cp chat-app/backend/.env chat-app/backend/.env.backup
cp chat-app/frontend/.env chat-app/frontend/.env.backup
```

#### 2. 檢查環境變數
```bash
# 確認生產環境設置正確
echo $NODE_ENV  # 必須為 "production"

# 確認開發繞過已關閉（生產環境）
# chat-app/backend/.env 中：
# ENABLE_DEV_PURCHASE_BYPASS=false (或不設置)
```

#### 3. 安裝依賴（如需要新的套件）
```bash
cd chat-app/backend
npm install firebase-admin@latest
cd ../..
```

---

### 第二階段：部署修復文件（1 小時）

#### 1. 廣告驗證系統

**文件列表：**
- ✅ `backend/src/ad/ad.service.FIXED.js` → 替換 `ad.service.js`
- ✅ `backend/src/ad/ad.routes.FIXED.js` → 替換 `ad.routes.js`

**部署命令：**
```bash
cd chat-app/backend/src/ad

# 備份原文件
mv ad.service.js ad.service.OLD.js
mv ad.routes.js ad.routes.OLD.js

# 部署新文件
mv ad.service.FIXED.js ad.service.js
mv ad.routes.FIXED.js ad.routes.js
```

**驗證：**
```bash
# 檢查語法錯誤
node -c ad.service.js
node -c ad.routes.js
```

#### 2. 禮物購買系統

**文件列表：**
- ✅ `backend/src/gift/gift.service.FIXED.js` → 替換 `gift.service.js`

**部署命令：**
```bash
cd chat-app/backend/src/gift

# 備份原文件
mv gift.service.js gift.service.OLD.js

# 部署新文件
mv gift.service.FIXED.js gift.service.js
```

#### 3. 解鎖券系統

**文件列表：**
- ✅ `backend/src/membership/unlockTickets.service.FIXED.js` → 替換 `unlockTickets.service.js`
- ✅ `backend/src/membership/unlockTickets.routes.FIXED.js` → 替換 `unlockTickets.routes.js`

**部署命令：**
```bash
cd chat-app/backend/src/membership

# 備份原文件
mv unlockTickets.service.js unlockTickets.service.OLD.js
mv unlockTickets.routes.js unlockTickets.routes.OLD.js

# 部署新文件
mv unlockTickets.service.FIXED.js unlockTickets.service.js
mv unlockTickets.routes.FIXED.js unlockTickets.routes.js
```

#### 4. 限制系統重置邏輯

**文件列表：**
- ✅ `backend/src/services/limitService/limitReset.FIXED.js` → 替換 `limitReset.js`
- ⚠️ `backend/src/services/baseLimitService.PATCH.js` → 手動應用補丁

**部署命令：**
```bash
cd chat-app/backend/src/services/limitService

# 備份原文件
mv limitReset.js limitReset.OLD.js

# 部署新文件
mv limitReset.FIXED.js limitReset.js

# 手動應用 baseLimitService.PATCH.js 的修改
# 參考補丁文件中的說明
```

#### 5. 開發模式安全檢查

**文件列表：**
- ✅ `backend/src/utils/devModeHelper.js` → 新增文件
- ⚠️ `backend/src/payment/coins.routes.PATCH.js` → 手動應用補丁

**部署命令：**
```bash
cd chat-app/backend/src/utils

# 添加新文件
cp ../../../devModeHelper.js ./

# 手動應用 coins.routes.PATCH.js 的修改到：
# - backend/src/payment/coins.routes.js
# - backend/src/membership/membership.routes.js
```

#### 6. Firestore 索引配置

**部署命令：**
```bash
cd chat-app

# 合併新的索引配置
# 將 firestore.indexes.ADDITION.json 的內容添加到現有的 firestore.indexes.json

# 部署索引
firebase deploy --only firestore:indexes
```

---

### 第三階段：測試驗證（2 小時）

#### 1. 單元測試（本地環境）

```bash
cd chat-app/backend

# 設置測試環境變數
export NODE_ENV=test
export ENABLE_DEV_PURCHASE_BYPASS=false
export USE_FIREBASE_EMULATOR=true

# 啟動 Firebase Emulator
firebase emulators:start --only firestore &

# 運行測試
npm run test:business-logic
```

**測試用例：**

**測試 1：廣告驗證系統**
```javascript
// tests/ad.service.test.js

describe('廣告驗證系統', () => {
  test('廣告記錄應持久化到 Firestore', async () => {
    const userId = 'test-user-1';
    const characterId = 'match-001';

    const adRequest = await requestAdWatch(userId, characterId);

    // 檢查 Firestore 中是否有記錄
    const db = getFirestoreDb();
    const adDoc = await db.collection('ad_records').doc(adRequest.adId).get();

    expect(adDoc.exists).toBe(true);
    expect(adDoc.data().userId).toBe(userId);
  });

  test('重啟後廣告記錄仍然存在', async () => {
    const userId = 'test-user-1';
    const adId = 'test-ad-123';

    // 創建廣告記錄
    await requestAdWatch(userId, 'match-001');

    // 模擬重啟（清空內存）
    // ...

    // 驗證廣告
    const result = await verifyAdWatched(userId, adId);
    expect(result.verified).toBe(true);
  });

  test('廣告獎勵領取應有冪等性保護', async () => {
    const userId = 'test-user-1';
    const adId = 'test-ad-123';

    // 第一次領取
    const result1 = await claimAdReward(userId, adId);
    expect(result1.success).toBe(true);

    // 第二次領取（應該返回已領取）
    const result2 = await claimAdReward(userId, adId);
    expect(result2.alreadyClaimed).toBe(true);
  });
});
```

**測試 2：禮物購買競態條件**
```javascript
// tests/gift.service.test.js

describe('禮物購買系統', () => {
  test('並發購買不應導致餘額為負數', async () => {
    const userId = 'test-user-1';
    const giftId = 'gift_rose';

    // 設置初始餘額 100 金幣
    await setCoinsBalance(userId, 100);

    // 並發發送兩個購買請求（每個 80 金幣）
    const promises = [
      sendGift(userId, 'match-001', giftId),
      sendGift(userId, 'match-001', giftId)
    ];

    // 第二個請求應該失敗（餘額不足）
    await expect(Promise.all(promises)).rejects.toThrow('金幣不足');

    // 檢查最終餘額
    const balance = await getCoinsBalance(userId);
    expect(balance.balance).toBeGreaterThanOrEqual(0); // 不能為負數
  });
});
```

**測試 3：解鎖券系統**
```javascript
// tests/unlockTickets.service.test.js

describe('解鎖券系統', () => {
  test('並發使用解鎖券不應重複扣除', async () => {
    const userId = 'test-user-1';
    const characterId = 'match-001';

    // 設置初始解鎖券：1 張
    await setTicketBalance(userId, 'characterUnlockCards', 1);

    // 並發使用兩次
    const promises = [
      useCharacterUnlockTicket(userId, characterId),
      useCharacterUnlockTicket(userId, characterId)
    ];

    // 第二個請求應該失敗（卡片不足）
    await expect(Promise.all(promises)).rejects.toThrow('角色解鎖票不足');

    // 檢查最終餘額
    const balance = await getTicketBalance(userId, 'characterUnlock');
    expect(balance.balance).toBe(0); // 應該只扣一次
  });
});
```

**測試 4：限制重置邏輯**
```javascript
// tests/limitReset.test.js

describe('限制重置邏輯', () => {
  test('對話基礎限制不應重置', async () => {
    const userId = 'test-user-1';
    const characterId = 'match-001';

    // 使用 10 次對話（基礎限制）
    for (let i = 0; i < 10; i++) {
      await conversationLimitService.recordUse(userId, characterId);
    }

    // 等待一天（模擬）
    // ...

    // 基礎限制不應重置
    const stats = await conversationLimitService.getStats(userId, characterId);
    expect(stats.count).toBe(10); // 仍然是 10
  });

  test('廣告解鎖次數應每日重置', async () => {
    const userId = 'test-user-1';
    const characterId = 'match-001';

    // 觀看廣告解鎖 5 次對話
    await unlockByAd(userId, characterId, 'ad-123');

    const stats1 = await conversationLimitService.getStats(userId, characterId);
    expect(stats1.unlocked).toBe(5);

    // 等待一天（模擬）
    // ...

    // 廣告解鎖次數應重置為 0
    const stats2 = await conversationLimitService.getStats(userId, characterId);
    expect(stats2.unlocked).toBe(0);
  });
});
```

**測試 5：開發模式安全檢查**
```javascript
// tests/devModeHelper.test.js

describe('開發模式安全檢查', () => {
  test('生產環境應拒絕開發模式繞過', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEV_PURCHASE_BYPASS = 'true';

    expect(() => {
      validateDevModeBypass('test-user-1', {
        featureName: '測試功能',
      });
    }).toThrow('生產環境不允許使用開發模式繞過');
  });

  test('非測試帳號應拒絕開發模式繞過', () => {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_DEV_PURCHASE_BYPASS = 'true';

    expect(() => {
      validateDevModeBypass('regular-user-123', {
        featureName: '測試功能',
        requireTestAccount: true,
      });
    }).toThrow('只有測試帳號可以使用開發模式繞過');
  });
});
```

#### 2. 整合測試（開發環境）

```bash
cd chat-app

# 啟動開發環境（使用 Emulator）
npm run dev:with-emulator
```

**手動測試流程：**

1. **測試廣告系統**
   - 登入測試帳號
   - 請求觀看廣告 → 檢查 Firestore `ad_records` 集合
   - 驗證廣告 → 檢查狀態更新為 `verified: true`
   - 領取獎勵 → 檢查對話次數增加
   - 重複領取 → 應提示「已領取」

2. **測試禮物購買**
   - 設置餘額 100 金幣
   - 快速點擊兩次送禮（80 金幣）
   - 應該只扣一次，並提示餘額不足

3. **測試解鎖券**
   - 設置 1 張解鎖券
   - 快速點擊兩次使用
   - 應該只扣一次，並提示卡片不足

4. **測試限制重置**
   - 使用完對話次數
   - 觀看廣告解鎖 5 次
   - 等待一天（或手動修改 Firestore 的日期）
   - 廣告解鎖次數應重置為 0，基礎次數保持不變

5. **測試開發模式保護**
   - 設置 `NODE_ENV=production`
   - 嘗試使用開發模式購買
   - 應該被拒絕

---

### 第四階段：生產環境部署（1 小時）

#### 1. 部署前檢查清單

- [ ] 所有測試通過
- [ ] Firestore 數據已備份
- [ ] `.env` 文件已更新
- [ ] `NODE_ENV=production`
- [ ] `ENABLE_DEV_PURCHASE_BYPASS=false` 或未設置
- [ ] Firestore 索引已部署
- [ ] 團隊已通知即將部署

#### 2. 部署後端

```bash
cd chat-app/backend

# 構建（如需要）
npm run build

# 部署到 Cloud Run（或其他平台）
gcloud run deploy chat-app-backend \
  --source . \
  --region asia-east1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,ENABLE_DEV_PURCHASE_BYPASS=false
```

#### 3. 部署前端

```bash
cd chat-app/frontend

# 構建
npm run build

# 部署到 Firebase Hosting
firebase deploy --only hosting
```

#### 4. 驗證部署

**健康檢查：**
```bash
# 檢查後端健康
curl https://your-backend-url.run.app/health

# 檢查 API 響應
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-backend-url.run.app/api/ads/stats/test-user-id
```

**監控指標：**
- 檢查 Cloud Run 日誌，確認無錯誤
- 檢查 Firestore 寫入次數（應該增加）
- 檢查用戶活動（是否正常運作）

---

### 第五階段：監控和回滾計劃（持續）

#### 1. 監控指標

**關鍵指標：**
- 廣告驗證成功率
- 禮物購買成功率
- 解鎖券使用成功率
- 錯誤率（特別是 Transaction 錯誤）
- 響應時間（Transaction 可能稍慢）

**告警設置：**
```javascript
// Cloud Monitoring 告警規則
{
  "displayName": "商業邏輯錯誤率過高",
  "conditions": [{
    "displayName": "錯誤率 > 5%",
    "conditionThreshold": {
      "filter": "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.label.response_code_class=\"5xx\"",
      "comparison": "COMPARISON_GT",
      "thresholdValue": 0.05
    }
  }]
}
```

#### 2. 回滾計劃

如果出現問題，快速回滾：

```bash
# 回滾後端代碼
cd chat-app/backend/src

# 恢復備份文件
mv ad/ad.service.OLD.js ad/ad.service.js
mv ad/ad.routes.OLD.js ad/ad.routes.js
mv gift/gift.service.OLD.js gift/gift.service.js
# ... 其他文件

# 重新部署
cd ../..
gcloud run deploy chat-app-backend --source .

# 回滾 Firestore 數據（如需要）
firebase firestore:import gs://chat-app-3-8a7ee-backup/YYYYMMDD
```

---

## 📝 部署後檢查清單

- [ ] 後端服務正常啟動（無崩潰）
- [ ] 前端頁面可以正常訪問
- [ ] 用戶可以正常登入
- [ ] 廣告系統正常運作（可以觀看、驗證、領取）
- [ ] 禮物購買正常運作（正確扣款）
- [ ] 解鎖券使用正常運作（正確扣除卡片）
- [ ] 對話限制正常運作（每日重置廣告解鎖）
- [ ] 開發模式繞過已禁用（生產環境）
- [ ] Firestore 索引已創建（查詢無錯誤）
- [ ] 監控告警已設置

---

## 🚨 已知問題和限制

### 1. Firestore Transaction 性能

**問題**：Transaction 會增加響應時間（~100-200ms）

**緩解措施**：
- 只在關鍵操作使用 Transaction
- 優化查詢路徑
- 考慮使用 Firestore 批量操作（Batch）

### 2. 廣告驗證

**問題**：目前只有基礎驗證，未整合 AdMob Server-Side Verification

**後續工作**：
- 整合 Google AdMob SSV
- 添加防作弊機制
- 實施更嚴格的驗證邏輯

### 3. 數據遷移

**問題**：舊的廣告記錄和禮物交易記錄未遷移到 Firestore

**建議**：
- 舊記錄可以保留在內存中（7 天後自動清理）
- 新記錄全部存儲到 Firestore
- 如需遷移，編寫專門的遷移腳本

---

## 📞 支援和聯絡

如果在部署過程中遇到問題：

1. 檢查日誌：`gcloud run services logs read chat-app-backend`
2. 查看 Firestore 數據是否正確
3. 確認環境變數設置正確
4. 參考測試用例進行調試

---

## ✅ 部署完成

恭喜！你已經成功部署了所有商業邏輯修復。

**下一步：**
1. 持續監控系統運行狀況
2. 收集用戶反饋
3. 根據監控數據進行性能優化
4. 規劃下一階段的改進（如 AdMob SSV 整合）

**記得：**
- 定期備份 Firestore 數據
- 定期審查安全日誌
- 定期更新依賴套件
- 定期進行安全審計
