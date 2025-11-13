# 測試運行說明

## ⚠️ 環境變數問題

由於測試腳本使用 ES Module，環境變數需要在運行前就已經存在於環境中。

## 🚀 運行測試的方法

### 方法 1: 使用後端服務環境（推薦）

在後端服務已經運行的情況下，環境變數已經被載入：

```bash
# 終端 1: 啟動後端服務（這會載入環境變數）
cd chat-app/backend
npm run dev

# 終端 2: 運行測試（會繼承環境變數）
cd chat-app/backend
node scripts/test-membership-upgrade.js
node scripts/test-character-unlock.js
```

### 方法 2: 使用 dotenv-cli（推薦）

安裝 `dotenv-cli`：

```bash
cd chat-app/backend
npm install --save-dev dotenv-cli
```

然後運行測試：

```bash
# 使用 dotenv-cli 載入環境變數
npx dotenv -e .env -- node scripts/test-membership-upgrade.js
npx dotenv -e .env -- node scripts/test-character-unlock.js
npx dotenv -e .env -- node scripts/test-all-business-logic.js
```

### 方法 3: 手動設置環境變數（臨時）

#### Windows (PowerShell)

```powershell
# 設置環境變數（從 .env 文件中複製值）
$env:FIREBASE_ADMIN_PROJECT_ID="your-project-id"
$env:FIREBASE_ADMIN_CLIENT_EMAIL="your-client-email"
$env:FIREBASE_ADMIN_PRIVATE_KEY="your-private-key"

# 運行測試
node scripts/test-membership-upgrade.js
```

#### Linux/Mac (Bash)

```bash
# 載入 .env 文件
export $(cat .env | grep -v '^#' | xargs)

# 運行測試
node scripts/test-membership-upgrade.js
```

### 方法 4: 修改 package.json 腳本

在 `package.json` 中添加使用 `dotenv-cli` 的腳本：

```json
{
  "scripts": {
    "test:business-logic": "dotenv -e .env -- node ./scripts/test-all-business-logic.js",
    "test:membership": "dotenv -e .env -- node ./scripts/test-membership-upgrade.js",
    "test:unlock": "dotenv -e .env -- node ./scripts/test-character-unlock.js"
  }
}
```

然後運行：

```bash
npm run test:business-logic
npm run test:membership
npm run test:unlock
```

## 📝 驗證環境變數

運行測試前，可以先驗證環境變數：

```bash
# Windows (PowerShell)
echo $env:FIREBASE_ADMIN_PROJECT_ID

# Linux/Mac (Bash)
echo $FIREBASE_ADMIN_PROJECT_ID
```

## 🎯 推薦方案

**方法 2（使用 dotenv-cli）** 是最簡單和最可靠的方法：

```bash
# 1. 安裝 dotenv-cli（一次性）
npm install --save-dev dotenv-cli

# 2. 運行測試
npx dotenv -e .env -- node scripts/test-membership-upgrade.js
```

## 🐛 常見問題

### Q: 測試報錯 "Missing Firebase Admin environment variables"

**A**: 環境變數未正確載入，請使用上述方法 2 或方法 4。

### Q: 可以在生產環境運行測試嗎？

**A**: 可以，但請注意：
- 測試會創建測試用戶（ID 包含 `test-` 前綴）
- 測試完成後會自動清理數據
- 不會影響真實用戶數據

建議在測試環境或 Firebase Emulator 上運行：

```bash
# 使用 Emulator
export USE_FIREBASE_EMULATOR=true
npx dotenv -e .env -- node scripts/test-membership-upgrade.js
```

### Q: 測試需要多長時間？

**A**:
- 會員升級測試: 約 15-30 秒（5 個場景）
- 角色解鎖測試: 約 20-40 秒（6 個場景）
- 總計: 約 1 分鐘

## 📚 相關文檔

- [TEST_GUIDE.md](TEST_GUIDE.md) - 詳細測試指南
- [../TEST_EXECUTION_SUMMARY.md](../../../TEST_EXECUTION_SUMMARY.md) - 測試執行總結
