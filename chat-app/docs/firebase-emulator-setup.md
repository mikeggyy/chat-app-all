# Firebase Emulator 設置指南

本專案已配置 Firebase Emulator，讓你可以在本地開發環境中測試 Firebase Authentication，無需連接到真實的 Firebase 服務。

## 優點

- ✅ **免費**：不消耗 Firebase 配額
- ✅ **快速**：本地運行，無網絡延遲
- ✅ **離線開發**：不需要網絡連接
- ✅ **數據隔離**：測試數據不會污染生產環境
- ✅ **重置簡單**：重啟模擬器即可清空數據
- ✅ **無需測試帳號邏輯**：直接使用 Google OAuth 登入（模擬）

## 安裝步驟

### 1. 安裝 Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. 登入 Firebase（僅需一次）

```bash
firebase login
```

### 3. 初始化 Firebase Emulator（已完成）

專案已經配置好 `firebase.json`，你不需要再執行 `firebase init`。

## 使用方式

### 啟動 Firebase Emulator

在專案根目錄執行：

```bash
firebase emulators:start
```

你會看到類似以下輸出：

```
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://localhost:4001                │
└─────────────────────────────────────────────────────────────┘

┌────────────┬────────────────┬─────────────────────────────────┐
│ Emulator   │ Host:Port      │ View in Emulator UI             │
├────────────┼────────────────┼─────────────────────────────────┤
│ Auth       │ localhost:9099 │ http://localhost:4001/auth      │
└────────────┴────────────────┴─────────────────────────────────┘
```

### 啟動後端 API

在另一個終端執行：

```bash
cd backend
npm run dev
```

你應該會看到：

```
🔧 Firebase Auth Emulator enabled at localhost:9099
Server is running on port 4000
```

### 啟動前端

在第三個終端執行：

```bash
cd frontend
npm run dev
```

你應該會在瀏覽器控制台看到：

```
🔧 Firebase Auth Emulator connected at http://localhost:9099
```

### 使用 Emulator UI

打開瀏覽器訪問 `http://localhost:4001`，你可以：

- 查看所有註冊的用戶
- 手動創建測試用戶
- 刪除測試數據
- 查看認證事件日誌

## 登入流程

當使用 Firebase Emulator 時：

1. 點擊「Google 登入」按鈕
2. 會彈出一個**模擬的 Google OAuth 頁面**（不是真實的 Google）
3. 輸入任意 email（例如：`test@example.com`）
4. 立即完成登入，無需真實的 Google 帳號

## 環境變數配置

### 開發環境（使用 Emulator）

前端 `frontend/.env`：
```env
VITE_USE_EMULATOR=true
VITE_EMULATOR_HOST=localhost
VITE_EMULATOR_AUTH_PORT=9099
```

後端 `backend/.env`：
```env
USE_FIREBASE_EMULATOR=true
FIREBASE_EMULATOR_HOST=localhost
FIREBASE_EMULATOR_AUTH_PORT=9099
```

### 生產環境（使用真實 Firebase）

前端 `frontend/.env.production`：
```env
VITE_USE_EMULATOR=false
```

後端 `backend/.env.production`：
```env
USE_FIREBASE_EMULATOR=false
```

## 常見問題

### Q: Emulator 數據會持久化嗎？

A: 默認不會。重啟 emulator 後數據會清空。如果需要持久化，可以使用：

```bash
firebase emulators:start --import=./emulator-data --export-on-exit
```

### Q: 可以同時使用 Emulator 和真實 Firebase 嗎？

A: 可以。透過環境變數 `VITE_USE_EMULATOR` 和 `USE_FIREBASE_EMULATOR` 控制。

### Q: Emulator 支援所有 Firebase 功能嗎？

A: 目前專案只使用 Auth Emulator。未來如果需要 Firestore、Functions 等，可以在 `firebase.json` 中添加。

### Q: 測試帳號還需要嗎？

A: 使用 Emulator 後，測試帳號邏輯可以移除。你可以直接用任意 email 登入 Emulator。

## 移除測試帳號邏輯（可選）

現在有了 Firebase Emulator，你可以考慮移除 `backend/src/config/testAccounts.js` 中的測試帳號邏輯，以及 `backend/src/auth/firebaseAuth.middleware.js` 中處理 `TEST_ACCOUNTS.GUEST_TOKEN` 的程式碼。

使用 Emulator 更符合真實場景，且不需要特殊的 token 處理邏輯。

## 部署到生產環境

部署前記得：

1. 設置環境變數關閉 Emulator：
   - `VITE_USE_EMULATOR=false`
   - `USE_FIREBASE_EMULATOR=false`

2. 確保有正確的 Firebase Admin 憑證（`FIREBASE_ADMIN_*` 環境變數）

3. 測試真實的 Google OAuth 登入流程
