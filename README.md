# Love Story - Chat App & Admin Dashboard

完整的 AI 聊天應用系統，包含主應用和管理後台。

## 專案結構

```
loveStory/
├── chat-app/          # 主應用 - AI 聊天應用
│   ├── frontend/        # Vue 3 前端 (port 5173)
│   ├── backend/         # Node.js 後端 (port 4000)
│   └── ...
├── chat-app-admin/      # 管理後台
│   ├── frontend/        # Vue 3 + Element Plus 前端 (port 5174)
│   ├── backend/         # Node.js 後端 (port 4001)
│   └── ...
├── start-all.js         # 統一啟動腳本
└── package.json         # 根目錄配置
```

## 快速開始

### 1. 安裝依賴

首次使用需要安裝所有依賴：

```bash
# 根目錄
npm install

# 安裝所有子項目依賴
npm run install:all
```

### 2. 啟動所有服務（推薦）

**一鍵啟動前後台所有服務（連接 Production Firebase）：**

```bash
npm run dev
```

這會同時啟動：

- ✅ 主應用後端 API (port 4000)
- ✅ 主應用前端 (port 5173)
- ✅ 管理後台後端 API (port 4001)
- ✅ 管理後台前端 (port 5174)

啟動後訪問：

- **主應用**: http://127.0.0.1:5173
- **管理後台**: http://127.0.0.1:5174

### 3. 單獨啟動服務

如果只需要啟動部分服務：

```bash
# 只啟動主應用後端
npm run dev:app-backend

# 只啟動主應用前端
npm run dev:app-frontend

# 只啟動管理後台後端
npm run dev:admin-backend

# 只啟動管理後台前端
npm run dev:admin-frontend
```

### 4. 停止所有服務

在啟動窗口按 `Ctrl + C` 即可停止所有服務。

## 環境配置

### 主應用 (chat-app)

1. **Backend** (`chat-app/backend/.env`)

   - 已配置連接真實 Firebase
   - Firebase Emulator 已關閉

2. **Frontend** (`chat-app/frontend/.env`)
   - `VITE_USE_EMULATOR=false` - 連接真實 Firebase
   - `VITE_API_URL=http://127.0.0.1:4000` - 後端 API 地址

### 管理後台 (chat-app-admin)

1. **Backend** (`chat-app-admin/backend/.env`)

   - 已配置連接真實 Firebase
   - 與主應用共用同一個 Firebase 專案

2. **Frontend** (`chat-app-admin/frontend/.env`)
   - 與主應用共用 Firebase 配置
   - API 代理到 `http://127.0.0.1:4001`

## 主要功能

### 主應用 (chat-app)

- 🤖 與 AI 角色實時對話
- 🎤 TTS 語音播放
- 📸 AI 生成角色照片
- 🎁 虛擬禮物系統
- 👥 會員系統 (免費/VIP/VVIP)
- 📊 使用限制管理

### 管理後台 (chat-app-admin)

- 👥 用戶管理（查看、編輯、刪除）
- 💰 會員等級管理
- 🎁 禮物資產管理
- 📊 使用限制重置
- 🤖 AI 角色管理
- 💬 對話監控

## 技術棧

- **Frontend**: Vue 3, Vite, Pinia, Element Plus
- **Backend**: Node.js, Express
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **AI**: OpenAI (GPT-4o-mini, TTS), Gemini (Image)

## 開發指南

詳細的開發文檔請參閱：

- [主應用文檔](./chat-app/CLAUDE.md)
- [管理後台文檔](./chat-app-admin/README.md)
- [專案總覽](./CLAUDE.md)

## 故障排除

### Port 衝突

如果遇到端口被占用的問題：

```bash
cd chat-app
npm run cleanup-ports
```

### Firebase 連接問題

確保 `.env` 文件中：

- `USE_FIREBASE_EMULATOR=false`
- Firebase Emulator 相關配置已註解

### 依賴問題

重新安裝所有依賴：

```bash
npm run install:all
```

## 授權

Private - All Rights Reserved
