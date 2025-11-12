# Admin Dashboard

AI Chat Application 管理後臺系統

## 功能概覽

- 👥 用戶管理（會員資料、會員等級、使用統計）
- 🤖 AI 角色管理（新增、編輯、刪除角色）
- 💬 對話監控（對話記錄、內容審核）
- 📊 數據統計（使用量、營收、用戶活躍度）
- ⚙️ 系統配置（禮物、會員方案、功能限制）
- 💰 交易管理（訂單記錄、退款處理）

## 技術棧

- **Frontend**: Vue 3 + Vite + Vue Router + Element Plus
- **Backend**: Node.js + Express + Firebase Admin SDK
- **Database**: Firestore (共用主應用資料庫)
- **Authentication**: Firebase Auth (管理員權限驗證)

## 快速開始

### 1. 安裝依賴

**⚠️ 首次使用必須先安裝依賴：**

```bash
npm run install:all
```

這會自動安裝根目錄、backend、frontend 的所有依賴。

### 2. 配置環境變數

複製並填寫環境配置文件：

**Frontend** (`frontend/.env`):
- 已創建模板，填入 Firebase 配置即可
- 與主應用 (chat-app) 共用相同的 Firebase 專案

**Backend** (`backend/.env`):
- 已創建模板，填入 Firebase Admin SDK 憑證
- 可以從主應用的 `chat-app/backend/.env` 複製相同配置

### 3. 啟動開發模式

```bash
# 同時啟動前後端（推薦）
npm run dev

# 或分別啟動
npm run dev:backend    # Backend: http://localhost:4001
npm run dev:frontend   # Frontend: http://localhost:5174
```

**💡 Windows 用戶注意**: 已使用 `--raw` 選項解決 PowerShell 亂碼問題。

### 訪問端點

- 🟢 管理前端: http://localhost:5174
- 🔵 管理後端 API: http://localhost:4001

## 專案結構

```
admin-dashboard/
├── frontend/           # Vue 3 管理前端
│   ├── src/
│   │   ├── components/ # 可復用組件
│   │   ├── views/      # 頁面組件
│   │   ├── router/     # 路由配置
│   │   ├── stores/     # Pinia 狀態管理
│   │   └── utils/      # 工具函數
│   └── package.json
├── backend/           # Express 管理後端
│   ├── src/
│   │   ├── routes/    # API 路由
│   │   ├── services/  # 業務邏輯
│   │   ├── middleware/# 中間件（權限驗證等）
│   │   └── utils/     # 工具函數
│   └── package.json
└── package.json       # 根配置
```

## 開發工具與腳本

### Firebase Emulator 支援

管理後台現在支援 Firebase Emulator 模式進行本地測試：

**配置文件**: `backend/src/setup-emulator.js`
- 自動設置 Auth、Firestore、Storage Emulator
- 與主應用一致的 Emulator 架構
- 通過 `USE_FIREBASE_EMULATOR=true` 環境變數啟用

**創建管理員帳號** (Emulator 模式):
```bash
cd backend
USE_FIREBASE_EMULATOR=true node scripts/create-admin-user.js
```

### 可用腳本

| 腳本路徑 | 說明 | 用途 |
|---------|------|------|
| `scripts/create-admin-user.js` | 創建管理員帳號 | 在 Emulator 或生產環境創建測試管理員 |

詳細腳本文檔請參考：`backend/scripts/README.md`

## 權限管理

管理後臺使用 Firebase Custom Claims 進行權限控制：

- **super_admin**: 超級管理員（完整權限）
- **admin**: 一般管理員（部分權限）
- **moderator**: 內容審核員（僅內容審核權限）

## 環境配置

### Frontend (.env)

```env
VITE_API_URL=http://localhost:4001
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### Backend (.env)

```env
PORT=4001
CORS_ORIGIN=http://localhost:5174
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Cloudflare R2 Storage（用於刪除用戶圖片）
# 注意：這些配置需要與主應用 (chat-app) 保持一致
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-custom-domain
```

**重要說明**：
- R2 配置用於刪除用戶時同步刪除 Cloudflare R2 上的圖片文件
- 如果未配置 R2，刪除用戶時會跳過圖片刪除（僅刪除 Firestore 記錄）
- R2 配置需要與主應用相同，因為兩者使用同一個 R2 bucket

## 開發規範

- 遵循 chat-app 的編碼規範
- 所有 API 請求需要管理員權限驗證
- 使用 Firestore 作為數據源（不創建重複數據）
- UI 組件使用 Element Plus
- 響應式設計支援平板和桌面端

## 代碼維護

### 最近更新（2025-01）

**代碼清理** 🧹
- 移除未完成的 `Settings.vue` 和 `settings.routes.js`（系統設置功能）
- 新增 `setup-emulator.js` 支援 Firebase Emulator 模式
- 移除未註冊的測試腳本
- 代碼健康度提升至 98%

詳細清理報告：[docs/CODE_CLEANUP_2025-01.md](../docs/CODE_CLEANUP_2025-01.md)

### 核心服務

**角色統計服務** (`backend/src/services/character/characterStats.service.js`)

管理後台提供角色統計同步功能，通過以下 API 端點使用：
- `POST /api/characters/sync-chat-users` - 批量同步所有角色統計
- `POST /api/characters/:characterId/sync-chat-users` - 同步單個角色統計
- `GET /api/characters/stats/overview` - 獲取統計概覽

⚠️ **注意**: 批量同步是高成本操作，建議只在低流量時段執行。

## 部署

待補充...
