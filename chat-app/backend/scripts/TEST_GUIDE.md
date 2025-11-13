# 商業邏輯測試指南

## 📋 測試概覽

本測試套件用於驗證商業邏輯修復後的功能完整性，包括：

1. **會員升級測試** - 測試會員升級流程、鎖定機制、並發控制
2. **角色解鎖購買測試** - 測試使用解鎖票/金幣購買角色的所有場景
3. **數據一致性測試** - 驗證新舊格式的數據遷移和同步

## 🚀 快速開始

### 前置要求

1. ✅ Firebase Admin SDK 已配置
2. ✅ 環境變數已設置（`.env` 文件）
3. ✅ 依賴已安裝（`npm install`）

### 運行所有測試

```bash
# 在 chat-app/backend 目錄下
cd chat-app/backend

# 運行所有測試
npm run test:business-logic

# 或者單獨運行
node scripts/test-all-business-logic.js
```

### 運行單獨測試

```bash
# 只測試會員升級
node scripts/test-membership-upgrade.js

# 只測試角色解鎖購買
node scripts/test-character-unlock.js
```

## 📊 測試內容詳解

### 1. 會員升級測試 (test-membership-upgrade.js)

**測試場景**:
- ✅ 測試 1: 正常升級流程（免費 → VIP，無剩餘拍照次數）
- ✅ 測試 2: 升級時保留剩餘拍照次數（已用 1 次）
- ✅ 測試 3: 防止並發升級（5 分鐘內重複升級）
- ✅ 測試 4: 過期鎖定自動解鎖（模擬 6 分鐘前的鎖定）
- ✅ 測試 5: 舊數據兼容（無時間戳的鎖定標記）

**驗證項目**:
- 會員等級是否正確更新
- 獎勵（解鎖票、金幣）是否正確發放
- 剩餘拍照次數是否正確計算和轉換
- 升級鎖定標記是否正確設置和清除
- 並發控制是否生效
- 過期鎖定是否自動解鎖
- 舊數據是否正確處理

**預期輸出**:
```
✅ 測試 1: 通過
✅ 測試 2: 通過
✅ 測試 3: 通過
✅ 測試 4: 通過
✅ 測試 5: 通過

✨ 所有測試通過！(5/5)
```

---

### 2. 角色解鎖購買測試 (test-character-unlock.js)

**測試場景**:
- ✅ 測試 1: 使用解鎖票購買角色（新格式 assets.*）
- ✅ 測試 2: 使用金幣購買角色
- ✅ 測試 3: 舊格式數據兼容（unlockTickets.*）
- ✅ 測試 4: 解鎖票不足（應使用金幣）
- ✅ 測試 5: 金幣不足（應拋出錯誤）
- ✅ 測試 6: 重複購買已解鎖角色（應拋出錯誤）

**驗證項目**:
- 解鎖票是否正確扣除
- 金幣是否正確扣除
- 交易記錄格式是否統一（type: "spend", amount: 絕對值）
- 永久解鎖標記是否正確設置
- 新舊格式是否同步更新
- 舊用戶數據是否正確遷移
- Transaction 回滾是否正確（錯誤情況）
- 重複購買是否正確防止

**預期輸出**:
```
✅ 測試 1: 通過
✅ 測試 2: 通過
✅ 測試 3: 通過
✅ 測試 4: 通過
✅ 測試 5: 通過
✅ 測試 6: 通過

✨ 所有測試通過！(6/6)
```

---

## 🔧 測試配置

### 測試用戶清理

測試腳本會自動：
1. **創建測試用戶** - 使用唯一的 ID（基於時間戳）
2. **執行測試** - 驗證功能邏輯
3. **清理數據** - 刪除測試用戶和相關數據

**清理範圍**:
- `users` 集合中的測試用戶
- `usage_limits` 集合中的測試數據
- `transactions` 集合中的測試交易記錄
- `membership_history` 集合中的測試歷史記錄

### 連接到哪個環境？

**默認**: 連接到生產環境 Firestore

⚠️ **重要**: 測試會在生產環境 Firestore 上創建和刪除測試數據，但：
- 測試用戶 ID 包含 `test-` 前綴和時間戳
- 測試完成後會自動清理所有數據
- 不會影響真實用戶數據

**如果想在 Emulator 上測試**:
```bash
# 設置環境變數
export USE_FIREBASE_EMULATOR=true

# 啟動 Emulator
firebase emulators:start

# 在另一個終端運行測試
node scripts/test-membership-upgrade.js
```

## 📈 測試輸出說明

### 成功輸出

```
============================================================
📋 測試: 測試 1: 正常升級流程（免費 → VIP，無剩餘拍照次數）
============================================================
創建測試用戶: test-membership-user-1234567890 (free, 拍照次數: 0)
執行升級...
✅ 升級成功
✅ 用戶會員等級已更新為 VIP
✅ 角色解鎖卡發放正確: 10
✅ 拍照解鎖卡發放正確: 20
✅ 升級鎖定標記已清除
已清理測試用戶: test-membership-user-1234567890
```

### 失敗輸出

```
============================================================
📋 測試: 測試 1: 正常升級流程
============================================================
創建測試用戶: test-membership-user-1234567890 (free, 拍照次數: 0)
執行升級...
❌ 升級失敗: tier = free
已清理測試用戶: test-membership-user-1234567890
```

## 🐛 常見問題

### 問題 1: Firebase 連接錯誤

**錯誤訊息**:
```
Error: Could not load the default credentials
```

**解決方案**:
1. 確認 `.env` 文件中的 Firebase 配置正確
2. 確認 Firebase Admin SDK 已正確初始化
3. 檢查 `FIREBASE_ADMIN_PROJECT_ID` 是否設置

---

### 問題 2: 測試數據未清理

**症狀**: 測試用戶仍然存在於 Firestore

**解決方案**:
```bash
# 手動清理測試數據
node scripts/cleanup-test-data.js
```

或在 Firebase Console 手動刪除以 `test-` 開頭的文檔。

---

### 問題 3: 測試超時

**症狀**: 測試運行時間過長或卡住

**解決方案**:
1. 檢查網絡連接
2. 檢查 Firestore 配額是否用盡
3. 嘗試單獨運行測試以定位問題

---

## 📝 添加新測試

### 創建新測試場景

```javascript
// 在測試文件中添加新函數
async function testNewScenario() {
  logTest('測試 X: 新測試場景描述');

  try {
    await createTestUser({ /* 初始狀態 */ });

    log('執行操作...', 'blue');
    // 執行測試邏輯

    // 驗證結果
    const data = await getUserData();
    if (/* 驗證條件 */) {
      logSuccess('驗證通過');
      return true;
    } else {
      logError('驗證失敗');
      return false;
    }
  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    return false;
  } finally {
    await cleanupTestUser();
  }
}

// 添加到測試列表
const tests = [
  // ... 現有測試
  { name: '測試 X', fn: testNewScenario },
];
```

### 測試最佳實踐

1. ✅ **每個測試應該獨立** - 不依賴其他測試的結果
2. ✅ **清理數據** - 使用 `try...finally` 確保測試後清理
3. ✅ **詳細日誌** - 使用 `logSuccess`、`logError` 記錄驗證過程
4. ✅ **明確驗證** - 每個驗證點都應該有清晰的成功/失敗訊息
5. ✅ **錯誤處理** - 捕獲並記錄錯誤訊息

## 🎯 測試檢查清單

### 部署前必做測試

- [ ] 運行所有測試並通過（`npm run test:business-logic`）
- [ ] 檢查測試輸出是否有警告訊息
- [ ] 驗證測試數據已清理（檢查 Firestore Console）
- [ ] 確認測試覆蓋所有關鍵場景

### 部署後驗證

- [ ] 在測試環境運行測試（連接測試環境 Firestore）
- [ ] 監控生產環境日誌
- [ ] 檢查是否出現預期的日誌訊息：
  - "檢測到過期的升級鎖定"
  - "檢測到無時間戳的升級鎖定"
  - 交易記錄格式正確（type: "spend", amount: 絕對值）

## 📞 支持

如果測試失敗或遇到問題：

1. 檢查測試輸出的詳細錯誤訊息
2. 查看 Firebase Console 中的實際數據
3. 檢查後端日誌（如果是服務端錯誤）
4. 參考 [LOGIC_VERIFICATION_REPORT_2025-01-13.md](../../LOGIC_VERIFICATION_REPORT_2025-01-13.md) 了解預期行為

## 📚 相關文檔

- [BUSINESS_LOGIC_FIXES_2025-01-13_FINAL.md](../../BUSINESS_LOGIC_FIXES_2025-01-13_FINAL.md) - 修復詳情
- [LOGIC_VERIFICATION_REPORT_2025-01-13.md](../../LOGIC_VERIFICATION_REPORT_2025-01-13.md) - 邏輯驗證報告
- [chat-app/CLAUDE.md](../../chat-app/CLAUDE.md) - 主應用開發指南

---

**測試套件版本**: 1.0.0
**創建日期**: 2025-01-13
**維護者**: Claude Code
