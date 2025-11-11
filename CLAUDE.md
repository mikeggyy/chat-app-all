# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概覽

這是一個 **monorepo**，包含兩個相關但獨立的應用：

1. **chat-app** - AI 聊天應用（主應用）
   - 用戶與 AI 角色對話
   - 會員系統、虛擬貨幣、AI 生成圖片等功能

2. **chat-app-admin** - 管理後臺
   - 管理用戶、AI 角色、系統配置
   - 監控對話、交易、數據統計

**共享資源**：
- Firebase 專案：`chat-app-3-8a7ee`
- Firestore 資料庫（兩個應用共享）
- Firebase Authentication（主應用用戶 + 管理員權限）

## 快速開始

### 一鍵啟動所有服務（推薦）

```bash
# 根目錄 - 同時啟動主應用和管理後臺（4個服務）
npm install           # 首次安裝根目錄依賴
npm run install:all   # 首次安裝所有子項目依賴
npm run dev           # 啟動所有服務

# 訪問端點
# 主應用前端:     http://127.0.0.1:5173
# 主應用後端 API: http://127.0.0.1:4000
# 管理後台前端:   http://127.0.0.1:5174
# 管理後台後端 API: http://127.0.0.1:4001
```

這會透過 [start-all.js](start-all.js) 啟動 4 個服務：
- ✅ 主應用後端 API (port 4000)
- ✅ 主應用前端 (port 5173)
- ✅ 管理後台後端 API (port 4001)
- ✅ 管理後台前端 (port 5174)

### 單獨啟動應用

```bash
# 主應用 (chat-app)
cd chat-app
npm run install:all    # 首次安裝依賴
npm run dev            # 啟動前後端（連接生產環境 Firebase）

# 管理後臺 (chat-app-admin)
cd chat-app-admin
npm run install:all    # 首次安裝依賴
npm run dev            # 啟動前後端
```

## Repository 結構

```
loveStory/
├── chat-app/          # 主應用 - AI 聊天應用
│   ├── frontend/        # Vue 3 + Vite 前端 (port 5173)
│   ├── backend/         # Node.js + Express 後端 (port 4000)
│   ├── shared/          # 應用內共享配置和工具
│   ├── config/          # 集中化端口和環境配置
│   ├── scripts/         # 開發和部署腳本
│   ├── docs/            # 詳細文檔
│   └── CLAUDE.md        # 主應用完整開發指南 ⭐
│
├── chat-app-admin/      # 管理後臺
│   ├── frontend/        # Vue 3 + Element Plus 前端 (port 5174)
│   ├── backend/         # Node.js + Express 後端 (port 4001)
│   └── README.md        # 管理後臺完整文檔 ⭐
│
├── start-all.js         # 統一啟動腳本（同時啟動所有服務）
├── PORTS.md             # 端口配置說明
├── TESTING_GUIDE.md     # 測試指南
├── LIMIT_SYSTEM_EXPLAINED.md  # 限制系統說明
└── SECURITY_AUDIT_FIXES.md    # 安全審計修復記錄
```

## 開發環境

- **平台**: Windows (win32)
- **Firebase 專案**: chat-app-3-8a7ee
- **默認模式**: 連接生產環境 Firebase（非 Emulator）
- **Node.js**: 需要 ESM 支援（`"type": "module"`）

⚠️ **重要**: 默認情況下，所有服務連接到**生產環境 Firebase**。修改數據時需格外小心。

💡 **本地開發**: 如需使用 Firebase Emulator 進行本地測試，請參閱 [chat-app/docs/firebase-emulator-setup.md](chat-app/docs/firebase-emulator-setup.md)。

## 常用命令

### 根目錄命令

```bash
# 開發
npm run dev                 # 啟動所有服務 (主應用 + 管理後臺，共4個服務)
npm run install:all         # 安裝所有子項目的依賴

# 服務管理
npm run cleanup-ports       # 清理特定端口
npm run kill-all-node       # 關閉所有 Node.js 進程（測試時很有用）
```

### 主應用 (chat-app) 命令

```bash
cd chat-app

# 開發
npm run dev                 # 啟動前後端（生產環境 Firebase）
npm run dev:with-emulator   # 使用 Firebase Emulator 啟動
npm run dev:backend         # 僅啟動後端 (port 4000)
npm run dev:frontend        # 僅啟動前端 (port 5173)

# 構建
npm run build:frontend      # 構建前端生產版本
npm run build:backend       # 構建後端（如需要）

# 數據管理（Emulator 模式）
npm run import:all          # 導入所有 Firestore 數據
npm run import:characters   # 僅導入 AI 角色
npm run import:configs      # 僅導入系統配置
npm run import:membership   # 僅導入會員方案
npm run import:test-data    # 導入測試數據

# 開發工具
npm run test:env            # 驗證環境變數配置（推薦首次啟動前執行）
npm run cleanup-ports       # 清理被佔用的端口（Windows）
npm run kill-all-node       # 關閉所有 Node.js 進程（測試時很有用）
npm run verify-config       # 驗證端口配置同步
npm run dev:guide           # 互動式開發指南
```

### 管理後臺 (chat-app-admin) 命令

```bash
cd chat-app-admin

# 開發
npm run dev                 # 啟動前後端
npm run dev:backend         # 僅啟動後端 (port 4001)
npm run dev:frontend        # 僅啟動前端 (port 5174)

# 構建
npm run build:frontend      # 構建前端生產版本
npm run build:backend       # 構建後端（如需要）

# 開發工具
npm run test:env            # 驗證環境變數配置（推薦首次啟動前執行）
```

## 技術棧

### 主應用 (chat-app)

- **Frontend**: Vue 3, Vite, Vue Router, Pinia
- **Backend**: Node.js, Express, Firebase Admin SDK
- **Database**: Firestore
- **Authentication**: Firebase Auth（Google OAuth + 測試帳號）
- **AI Services**:
  - OpenAI GPT-4o-mini（對話）
  - OpenAI TTS（語音）
  - Gemini 2.5 Flash（圖片生成）

**主要功能**：
- 與 AI 角色實時對話，支援個性化系統
- 分級會員系統（免費、VIP、VVIP）
- 多種 TTS 語音播放
- AI 生成角色照片
- 虛擬禮物和貨幣系統
- 完整的限制和冪等性系統

### 管理後臺 (chat-app-admin)

- **Frontend**: Vue 3, Vite, Vue Router, Pinia, **Element Plus**
- **Backend**: Node.js, Express, Firebase Admin SDK
- **Database**: Firestore（與主應用共享）
- **Authentication**: Firebase Auth（管理員權限驗證）

**主要功能**：
- 👥 用戶管理（會員資料、會員等級、使用統計）
- 🤖 AI 角色管理（新增、編輯、刪除）
- 💬 對話監控（對話記錄、內容審核）
- 📊 數據統計（使用量、營收、用戶活躍度）
- ⚙️ 系統配置（禮物、會員方案、功能限制）
- 💰 交易管理（訂單記錄、退款處理）

## 環境配置

### 主應用配置

配置文件位置：
- 前端：`chat-app/frontend/.env`（複製自 `.env.example`）
- 後端：`chat-app/backend/.env`（複製自 `.env.example`）

**關鍵環境變數**：
```env
# Frontend
VITE_API_URL=http://localhost:4000
VITE_FIREBASE_PROJECT_ID=chat-app-3-8a7ee
# ... 其他 Firebase 配置

# Backend
PORT=4000
FIREBASE_ADMIN_PROJECT_ID=chat-app-3-8a7ee
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...
```

詳細配置說明請參閱：[chat-app/CLAUDE.md](chat-app/CLAUDE.md#environment-configuration)

### 管理後臺配置

配置文件位置：
- 前端：`chat-app-admin/frontend/.env`
- 後端：`chat-app-admin/backend/.env`

**關鍵環境變數**：
```env
# Frontend
VITE_API_URL=http://localhost:4001
VITE_FIREBASE_PROJECT_ID=chat-app-3-8a7ee  # 與主應用相同

# Backend
PORT=4001  # ⚠️ 不同於主應用的 4000
CORS_ORIGIN=http://localhost:5174
FIREBASE_ADMIN_PROJECT_ID=chat-app-3-8a7ee
```

詳細配置說明請參閱：[chat-app-admin/README.md](chat-app-admin/README.md#環境配置)

## 權限管理

管理後臺使用 Firebase Custom Claims 進行權限控制：

- **super_admin**: 超級管理員（完整權限）
- **admin**: 一般管理員（部分權限）
- **moderator**: 內容審核員（僅內容審核權限）

**設置管理員權限**（在後端代碼中使用 Firebase Admin SDK）：

```javascript
// 設置管理員權限
await admin.auth().setCustomUserClaims(userId, {
  admin: true  // 或 super_admin: true, moderator: true
});

// 驗證權限
const user = await admin.auth().getUser(userId);
console.log(user.customClaims);
```

## 關鍵原則

在此儲存庫中工作時遵循以下原則：

1. **使用集中化配置** - 從 `config/` 和 `shared/config/` 導入而非硬編碼值
2. **所有消耗性操作必須實現冪等性** - 使用 `handleIdempotentRequest()` 中間件（詳見 [chat-app/docs/IDEMPOTENCY.md](chat-app/docs/IDEMPOTENCY.md)）
3. **優先使用 Firestore** - 對於持久化數據，優先使用 Firestore 而非內存存儲
4. **保持組件精簡** - 組件保持在 500 行以下；提取邏輯到 composables
5. **謹慎處理生產環境** - 默認連接生產環境 Firebase，修改數據時需格外小心
6. **測試使用 Firebase Emulator** - 測試新功能時建議使用 Emulator 模式（`USE_FIREBASE_EMULATOR=true`）
7. **修改端口後運行驗證** - 修改端口配置後運行 `npm run verify-config`
8. **端口配置參考 PORTS.md** - 所有端口配置詳見 [PORTS.md](PORTS.md)
9. **所有回應使用繁體中文** - 與用戶的所有溝通應使用繁體中文

## 文檔索引

### 根目錄文檔

- **[PORTS.md](PORTS.md)** - 端口配置詳細說明
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - 測試指南
- **[LIMIT_SYSTEM_EXPLAINED.md](LIMIT_SYSTEM_EXPLAINED.md)** - 使用限制系統詳解
- **[SECURITY_AUDIT_FIXES.md](SECURITY_AUDIT_FIXES.md)** - 安全審計和修復記錄

### 部署相關文檔

- **[docs/cloudflare-pages-quickstart.md](docs/cloudflare-pages-quickstart.md)** ⚡ - Cloudflare Pages 快速部署（5 分鐘）
- **[docs/cloudflare-pages-deployment.md](docs/cloudflare-pages-deployment.md)** - Cloudflare Pages 完整部署指南
- **[docs/cloudflare-pages-migration-summary.md](docs/cloudflare-pages-migration-summary.md)** - 遷移總結和檢查清單

### 主應用文檔（chat-app）

- **[chat-app/CLAUDE.md](chat-app/CLAUDE.md)** - 主應用完整開發指南 ⭐
- **[chat-app/docs/ENVIRONMENT_VALIDATION.md](chat-app/docs/ENVIRONMENT_VALIDATION.md)** - 環境變數驗證系統 🔍
- [chat-app/docs/firestore-collections.md](chat-app/docs/firestore-collections.md) - Firestore 資料庫架構
- [chat-app/docs/firebase-emulator-setup.md](chat-app/docs/firebase-emulator-setup.md) - Firebase Emulator 設置指南
- [chat-app/docs/IDEMPOTENCY.md](chat-app/docs/IDEMPOTENCY.md) - 冪等性系統實現指南
- [chat-app/docs/DEPLOYMENT.md](chat-app/docs/DEPLOYMENT.md) - 部署指南
- [chat-app/backend/scripts/README.md](chat-app/backend/scripts/README.md) - 數據導入腳本指南

### 管理後臺文檔（chat-app-admin）

- **[chat-app-admin/README.md](chat-app-admin/README.md)** - 管理後臺完整文檔 ⭐

### 詳細架構說明

詳細的系統架構、API 設計、數據流程等說明請參閱各子項目的文檔：
- 主應用架構：[chat-app/CLAUDE.md](chat-app/CLAUDE.md#architecture-overview)
- Firestore 集合：[chat-app/docs/firestore-collections.md](chat-app/docs/firestore-collections.md)

## 常見任務

### 一鍵啟動/停止所有服務

```bash
# 根目錄 - 啟動所有服務（推薦）
npm run dev

# 停止：按 Ctrl+C
```

### 安裝依賴

```bash
# 根目錄 - 安裝所有項目依賴
npm install           # 安裝根目錄依賴
npm run install:all   # 安裝所有子項目依賴

# 單獨安裝主應用依賴
cd chat-app
npm run install:all

# 單獨安裝管理後臺依賴
cd chat-app-admin
npm run install:all
```

### 端口管理

```bash
# 查看端口配置
cat PORTS.md

# 清理被占用的端口（Windows）
cd chat-app
npm run cleanup-ports

# 手動清理特定端口
netstat -ano | findstr :4000    # 查找占用 port 4000 的進程
taskkill //F //PID <PID>        # 終止進程
```

### 構建生產版本

```bash
# 主應用
cd chat-app
npm run build:frontend

# 管理後臺
cd chat-app-admin
npm run build:frontend
```

### 添加新的 AI 角色

**方法 1: 直接在 Firestore 中創建**
1. 訪問 [Firebase Console](https://console.firebase.google.com)
2. 進入專案 `chat-app-3-8a7ee`
3. 在 `characters` 集合中添加新文檔

**方法 2: 使用管理後臺**
1. 訪問管理後臺前端：http://localhost:5174
2. 登入管理員帳號
3. 進入「AI 角色管理」頁面
4. 點擊「新增角色」

**方法 3: 使用導入腳本（Emulator 模式）**
```bash
cd chat-app
npm run import:characters
```

### 驗證配置

```bash
# 驗證端口和環境配置
cd chat-app
npm run verify-config
```

### 重置開發環境

```bash
# 1. 清理端口
cd chat-app
npm run cleanup-ports

# 2. 重新安裝依賴（如果需要）
npm run install:all

# 3. 重啟服務
npm run dev
```

## 故障排除

### 端口被占用

```bash
# Windows - 查看占用端口的進程
netstat -ano | findstr :4000
netstat -ano | findstr :4001
netstat -ano | findstr :5173
netstat -ano | findstr :5174

# 終止進程
taskkill //F //PID <PID>

# 或使用清理腳本
cd chat-app
npm run cleanup-ports
```

**詳細端口配置**: 請參閱 [PORTS.md](PORTS.md)

### Firebase 連接問題

**症狀**: 無法連接到 Firebase / 權限錯誤

**解決方案**:
1. 檢查 `.env` 文件配置
2. 確認 `USE_FIREBASE_EMULATOR` 設置正確（生產環境應為 `false` 或未設置）
3. 驗證 Firebase 專案 ID：`chat-app-3-8a7ee`
4. 確保已登入 Firebase CLI：`firebase login`

### 依賴安裝問題

```bash
# 清理並重新安裝所有依賴
cd chat-app
rm -rf node_modules backend/node_modules frontend/node_modules
npm run install:all

cd ../chat-app-admin
rm -rf node_modules backend/node_modules frontend/node_modules
npm run install:all
```

### 服務無法啟動

1. 確認端口未被占用（參考上方「端口被占用」）
2. 檢查 `.env` 文件是否存在且配置正確
3. 確認已安裝所有依賴：`npm run install:all`
4. 查看錯誤日誌，定位具體問題

### 管理後臺無法訪問

1. 確認管理後臺服務已啟動
2. 檢查用戶是否有管理員權限（Custom Claims）
3. 確認管理後臺後端端口為 4001（不是 4000）

### 更多故障排除

請參閱各子項目的詳細文檔：
- 主應用：[chat-app/CLAUDE.md](chat-app/CLAUDE.md)
- 管理後臺：[chat-app-admin/README.md](chat-app-admin/README.md)

## 部署

詳細的部署指南請參閱：
- **[chat-app/docs/DEPLOYMENT.md](chat-app/docs/DEPLOYMENT.md)** - 完整部署指南

**推薦架構**：
- **前端**: Firebase Hosting
- **後端**: Google Cloud Run
- **資料庫**: Firestore + Firebase Auth + Storage

**快速部署流程**：

```bash
# 1. 後端部署到 Cloud Run
cd chat-app/backend
./deploy-cloudrun.sh  # Linux/Mac
# 或
deploy-cloudrun.bat   # Windows

# 2. 前端部署到 Firebase Hosting
cd chat-app
npm run build:frontend
firebase deploy --only hosting

# 3. 部署 Firestore Rules
firebase deploy --only firestore:rules

# 4. 導入初始數據（首次部署）
cd backend
npm run import:all
```

## Agent 工作指南

### 配置管理

- **使用集中化配置**: 從 `config/` 和 `shared/config/` 導入，不要硬編碼
- **端口修改**: 修改端口後必須運行 `npm run verify-config`
- **共享常量**: 使用 `shared/config/constants.js` 中的常量，不要使用 magic numbers

### 功能開發

- **限制系統**: 新增使用限制功能時，參考 `backend/src/services/limitService/` 的模式
- **冪等性**: 所有消耗性操作必須使用 `handleIdempotentRequest()` 實現冪等性
- **組件大小**: 保持組件在 500 行以下，大型組件拆分為子組件和 composables

### 資料庫操作

- **優先使用 Firestore**: 新的持久化數據應使用 Firestore 而非內存存儲
- **集合命名**: 使用小寫加下劃線（如 `user_conversations`）
- **數據導入**: 新增 Firestore 集合時創建對應的導入腳本
- **Emulator 測試**: 測試 Firestore 變更時優先使用 Firebase Emulator

### 文檔維護

- **參考現有文檔**: 開發前先查閱 `docs/` 目錄中的相關文檔
- **更新文檔**: 重大功能變更時更新相關文檔
- **文檔位置**:
  - 架構說明 → `chat-app/CLAUDE.md`
  - API 文檔 → `chat-app/docs/`
  - 部署指南 → `chat-app/docs/DEPLOYMENT.md`

### 重要提醒

- ⚠️ **默認連接生產環境**: 所有數據修改操作需格外小心
- ✅ **測試用 Emulator**: 測試新功能時使用 Firebase Emulator
- 📝 **繁體中文回應**: 與用戶的所有溝通使用繁體中文
