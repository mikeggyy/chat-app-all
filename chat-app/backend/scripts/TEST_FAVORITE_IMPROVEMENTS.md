# 收藏功能改進測試指南

## 📋 測試概覽

本目錄包含兩個測試腳本，用於驗證收藏功能的改進：

1. **test-favorite-improvements.js** - 功能測試
2. **test-favorite-validation.js** - API 參數驗證測試

---

## 🧪 測試 1: 功能測試

### 測試內容

- ✅ 收藏時增加 `totalFavorites`
- ✅ 取消收藏時減少 `totalFavorites`
- ✅ 防止 `totalFavorites` 變成負數
- ✅ 緩存清除驗證
- ✅ 重複收藏不會重複增加計數

### 運行方式

```bash
cd chat-app/backend
node scripts/test-favorite-improvements.js
```

### 預期輸出

```
🧪 開始測試收藏功能改進

============================================================
  測試 1: 收藏時增加 totalFavorites
============================================================
ℹ️  初始 totalFavorites: 5
ℹ️  執行收藏操作...
ℹ️  新的 totalFavorites: 6
✅ 計數正確增加：5 → 6

============================================================
  測試 2: 取消收藏時減少 totalFavorites
============================================================
ℹ️  初始 totalFavorites: 6
ℹ️  執行取消收藏操作...
ℹ️  新的 totalFavorites: 5
✅ 計數正確減少：6 → 5

... (其他測試)

============================================================
  測試結果匯總
============================================================

測試項目:
  測試 1 - 收藏增加計數: ✅ 通過
  測試 2 - 取消減少計數: ✅ 通過
  測試 3 - 防止負數: ✅ 通過
  測試 4 - 緩存清除: ✅ 通過
  測試 5 - 重複收藏: ✅ 通過

總計: 5/5 測試通過

🎉 所有測試通過！
```

---

## 🔒 測試 2: API 參數驗證測試

### 測試內容

- ✅ 空參數返回 400 錯誤
- ✅ 錯誤類型（數字）返回 400 錯誤
- ✅ 超長輸入返回 400 錯誤
- ✅ 特殊字符正確處理
- ✅ null/undefined 返回 400 錯誤

### 前置條件

**安裝依賴**：
```bash
npm install node-fetch
```

**啟動後端服務**：
```bash
# 在另一個終端
cd chat-app
npm run dev:backend
```

### 運行方式

```bash
cd chat-app/backend
node scripts/test-favorite-validation.js
```

### 預期輸出

```
🧪 開始測試 API 參數驗證

ℹ️  API URL: http://localhost:4000
ℹ️  測試用戶: 6FXftJp96WeXYqAO4vRYs52EFXN2

============================================================
  測試 1: 空參數驗證
============================================================
ℹ️  發送空 body...
ℹ️  狀態碼: 400
ℹ️  響應: {
  "error": "VALIDATION_ERROR",
  "message": "請提供有效的角色 ID",
  ...
}
✅ 正確返回 400 錯誤

... (其他測試)

============================================================
  測試結果匯總
============================================================

總計: 5/5 測試通過

🎉 所有測試通過！
```

---

## 🐛 故障排除

### 問題 1: Firebase 連接失敗

**錯誤信息**:
```
Error: Could not load the default credentials
```

**解決方案**:
1. 檢查 `.env` 文件配置
2. 確認 Firebase 專案 ID 正確
3. 運行 `firebase login`

### 問題 2: 測試用戶不存在

**錯誤信息**:
```
找不到指定的使用者資料
```

**解決方案**:
1. 檢查 `shared/config/testAccounts.js`
2. 確認測試用戶 ID 存在於 Firestore
3. 或修改測試腳本使用你的用戶 ID

### 問題 3: API 請求失敗 (驗證測試)

**錯誤信息**:
```
fetch failed
```

**解決方案**:
1. 確認後端服務已啟動：`npm run dev:backend`
2. 檢查端口是否正確（默認 4000）
3. 修改 `API_URL` 環境變數

### 問題 4: 角色不存在

**錯誤信息**:
```
角色 match-001 不存在
```

**解決方案**:
1. 運行導入腳本：`npm run import:characters`
2. 或修改測試腳本使用存在的角色 ID

---

## 📊 測試覆蓋範圍

### 已覆蓋的改進

| 改進項目 | 測試腳本 | 測試項目 |
|---------|---------|---------|
| 收藏計數增加 | test-favorite-improvements.js | 測試 1 |
| 收藏計數減少 | test-favorite-improvements.js | 測試 2 |
| 防止負數 | test-favorite-improvements.js | 測試 3 |
| 緩存清除 | test-favorite-improvements.js | 測試 4 |
| 重複收藏處理 | test-favorite-improvements.js | 測試 5 |
| 空參數驗證 | test-favorite-validation.js | 測試 1 |
| 類型驗證 | test-favorite-validation.js | 測試 2 |
| 長度驗證 | test-favorite-validation.js | 測試 3 |
| 特殊字符處理 | test-favorite-validation.js | 測試 4 |
| null/undefined 驗證 | test-favorite-validation.js | 測試 5 |

### 未覆蓋的場景

以下場景需要手動測試或在生產環境中驗證：

- 併發收藏請求（多用戶同時收藏）
- 角色緩存實時同步
- 網絡異常時的錯誤處理
- 認證失敗場景

---

## 🎯 快速測試指令

```bash
# 完整測試流程
cd chat-app/backend

# 1. 安裝依賴（如需要）
npm install node-fetch

# 2. 運行功能測試
node scripts/test-favorite-improvements.js

# 3. 啟動後端（另一個終端）
npm run dev:backend

# 4. 運行 API 驗證測試
node scripts/test-favorite-validation.js
```

---

## 📝 測試注意事項

1. **數據安全**：
   - 測試會修改測試用戶的收藏列表
   - 測試會修改角色的 `totalFavorites` 計數
   - 建議使用開發環境或 Firebase Emulator

2. **執行順序**：
   - 先運行功能測試
   - 再運行 API 驗證測試

3. **清理數據**：
   - 測試 3 會創建臨時角色並自動刪除
   - 其他測試使用現有數據，不會創建新數據

4. **時間延遲**：
   - 測試包含等待時間，確保 Firestore transaction 完成
   - 總執行時間約 10-15 秒

---

## ✅ 成功標準

**所有測試通過**時，你應該看到：

```
總計: 5/5 測試通過
🎉 所有測試通過！
```

**如果有測試失敗**，檢查：

1. 後端服務是否正常運行
2. Firebase 連接是否正常
3. 測試用戶和角色是否存在
4. 日誌中的具體錯誤信息

---

## 🆘 需要幫助？

如果測試失敗或遇到問題：

1. 查看詳細的日誌輸出
2. 檢查 Firebase Console 中的數據
3. 查看後端服務日誌
4. 參考上方的故障排除部分

---

## 📅 最後更新

- **日期**: 2025-01-14
- **版本**: 1.0.0
- **作者**: Claude Code
