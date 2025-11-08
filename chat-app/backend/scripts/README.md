# Backend Scripts 說明文檔

這個目錄包含所有的後端腳本，包括資料導入、測試工具等。

## 📦 資料導入腳本

### 🚀 快速開始

```bash
# 從根目錄執行（推薦）
npm run import:all              # 導入所有資料（自動執行所有導入腳本）

# 從 backend 目錄執行
cd backend && npm run import:all
```

### 📋 完整導入清單

`import:all` 會依序執行以下腳本：

1. **AI 角色資料** (`import-characters-to-firestore.js`)
   - 導入 AI 角色定義和元數據
   - Collection: `characters`

2. **系統配置** (`import-configs-to-firestore.js`)
   - 導入禮物、稀有度、自拍訊息等配置
   - Collections: `gifts`, `gift_rarities`, `selfie_messages`, `system_configs`

3. **會員方案** (`import-membership-configs.js`)
   - 導入會員等級和定價配置
   - Collections: `membership_tiers`, `ai_feature_prices`, `coin_packages`

4. **角色風格** (`import-character-styles.js`)
   - 導入角色創建可選風格配置
   - Collection: `character_styles`

5. **測試資料** (`seed-test-data.js`)
   - 導入測試用戶和對話資料（可選）
   - 用於開發環境測試

### 🎯 單獨執行導入

你也可以單獨執行任何一個導入腳本：

```bash
# 從根目錄執行
npm run import:characters        # 只導入 AI 角色
npm run import:configs           # 只導入系統配置
npm run import:membership        # 只導入會員方案
npm run import:character-styles  # 只導入角色風格
npm run import:test-data         # 只導入測試資料

# 從 backend 目錄執行
cd backend
npm run import:characters
npm run import:configs
npm run import:membership
npm run import:character-styles
npm run import:test-data
```

## 🔧 其他腳本

### 語音生成

```bash
cd backend && npm run generate:voices
```

生成所有語音預覽文件（使用 OpenAI TTS）。

### 數據清理

```bash
cd backend && node scripts/clean-invalid-usage-limits.js
```

清理 `usage_limits` 集合中的無效鍵名（如 "null", "undefined" 等）。

**使用場景**：
- Firestore 中出現了 `undefined` 或 `null` 作為鍵名
- `voice` 或 `conversation` 中包含非標準的角色 ID
- 數據結構不符合預期格式

**清理範圍**：
- 移除頂層無效鍵名（只保留 `userId`, `photos`, `voice`, `conversation`, `createdAt`, `updatedAt`）
- 移除 `voice` 和 `conversation` 中無效的角色 ID（只保留 `match-XXX` 格式）

### 測試工具

```bash
cd backend && npm run test:add-coins
```

添加測試金幣到指定用戶。

## 📁 檔案結構

```
backend/scripts/
├── README.md                           # 本文檔
├── import-all-data.js                  # 🔥 整合導入腳本（執行所有導入）
├── import-characters-to-firestore.js   # AI 角色導入
├── import-configs-to-firestore.js      # 系統配置導入
├── import-membership-configs.js        # 會員方案導入
├── import-character-styles.js          # 角色風格導入
├── seed-test-data.js                   # 測試資料導入
├── generateVoicePreviews.js            # 語音預覽生成
├── clean-invalid-usage-limits.js       # 清理無效使用限制數據
└── add-test-coins.js                   # 測試金幣工具
```

## 🔄 npm run dev 自動化流程

當你執行 `npm run dev` 時，系統會自動：

1. ✅ 啟動 Firebase Emulator
2. ✅ 執行 `npm run import:all`（導入所有資料）
3. ✅ 啟動 Backend API
4. ✅ 啟動 Frontend

這樣你就不需要手動導入資料了！

### 如果不想自動導入

使用以下命令啟動開發環境但跳過自動導入：

```bash
npm run dev:no-import
```

## 💡 使用建議

- **首次啟動**：使用 `npm run dev`，自動導入所有必要資料
- **開發期間**：資料已存在時，可使用 `npm run dev:no-import` 加快啟動
- **資料更新**：修改資料後，執行 `npm run import:all` 重新導入
- **單一更新**：只修改某類資料時，使用對應的單獨導入命令

## ⚠️ 注意事項

1. 所有導入腳本都支持 Firebase Emulator 和正式環境
2. 確保環境變數 `.env` 已正確設置
3. 導入前確保 Firebase Emulator 已啟動（如使用模擬器）
4. 測試資料僅用於開發環境，勿在生產環境執行

## 🛠️ 開發指南

如需添加新的導入腳本：

1. 在 `backend/scripts/` 目錄下創建新腳本
2. 在 `import-all-data.js` 的 `importScripts` 陣列中添加配置
3. 在 `backend/package.json` 和根目錄 `package.json` 添加對應命令
4. 更新本文檔

範例：

```javascript
// 在 import-all-data.js 中添加
{
  name: "新功能",
  file: "scripts/import-new-feature.js",
  description: "導入新功能資料",
}
```

```json
// 在 package.json 中添加
"import:new-feature": "node ./scripts/import-new-feature.js"
```
