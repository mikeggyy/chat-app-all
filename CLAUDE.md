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

## 快速命令參考

| 任務 | 命令 |
|-----|------|
| 啟動所有服務 | `npm run dev` |
| 主應用開發 | `cd chat-app && npm run dev` |
| 管理後台開發 | `cd chat-app-admin && npm run dev` |
| 使用 Emulator | `cd chat-app && npm run dev:with-emulator` |
| 運行測試 | `cd chat-app/backend && npm test` |
| 清理端口 | `npm run cleanup-ports` |
| 安裝所有依賴 | `npm run install:all` |
| 驗證配置 | `npm run verify-config` |
| **部署後端** | `npm run deploy` |

**端口配置**: 主應用 `5173/4000`，管理後台 `5174/4001`（詳見 [PORTS.md](PORTS.md)）

**最近更新**: 後端 API 測試 100% 完成 (688 tests)、安全性增強（日誌脫敏、速率限制、統一錯誤碼）— 詳見 [CHANGELOG.md](CHANGELOG.md)

## 首次設置檢查清單

在開始開發之前，請確保完成以下步驟：

- [ ] **安裝 Node.js** (需要 ESM 支援，建議使用 Node.js 18+)
- [ ] **安裝 Firebase CLI**: `npm install -g firebase-tools`
- [ ] **Firebase 登入**: `firebase login`
- [ ] **複製環境變數文件**:
  ```bash
  # 主應用
  cp chat-app/frontend/.env.example chat-app/frontend/.env
  cp chat-app/backend/.env.example chat-app/backend/.env

  # 管理後臺
  cp chat-app-admin/frontend/.env.example chat-app-admin/frontend/.env
  cp chat-app-admin/backend/.env.example chat-app-admin/backend/.env
  ```
- [ ] **配置環境變數**: 填寫必要的配置
  - Firebase 配置（Project ID, API Key 等）
  - OpenAI API Key (`OPENAI_API_KEY`)
  - Gemini API Key (`GEMINI_API_KEY`)
  - 其他第三方服務 API Key
- [ ] **驗證環境配置**: `cd chat-app && npm run test:env`
- [ ] **安裝依賴**: `npm install && npm run install:all`
- [ ] **驗證端口配置**: `npm run verify-config`
- [ ] **選擇開發模式**:
  - 🔧 **Emulator 模式**（推薦首次使用）: `cd chat-app && npm run dev:with-emulator`
  - 🌐 **生產模式**: `npm run dev`（連接真實的 Firebase）

**⚠️ 重要提醒**: 預設情況下，開發環境會連接到**生產環境 Firebase**。如果要測試新功能或進行實驗性修改，請使用 Emulator 模式。

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
chat-app-all/            # 根目錄
├── chat-app/              # 主應用 - AI 聊天應用
│   ├── frontend/          # Vue 3 + Vite 前端 (port 5173)
│   ├── backend/           # Node.js + Express 後端 (port 4000)
│   ├── shared/            # 應用內共享配置和工具
│   ├── config/            # 集中化端口和環境配置
│   ├── scripts/           # 開發和部署腳本
│   ├── docs/              # 詳細文檔
│   └── CLAUDE.md          # 主應用完整開發指南 ⭐
│
├── chat-app-admin/        # 管理後臺
│   ├── frontend/          # Vue 3 + Element Plus 前端 (port 5174)
│   ├── backend/           # Node.js + Express 後端 (port 4001)
│   └── README.md          # 管理後臺完整文檔 ⭐
│
├── shared/                # 跨應用共享資源（主應用 + 管理後臺）
│   ├── config/            # 共享配置
│   │   └── testAccounts.js  # 統一的測試帳號配置
│   ├── utils/             # 共享工具函數
│   │   ├── errorFormatter.js  # 錯誤格式化工具
│   │   ├── errorCodes.js      # 統一錯誤碼定義
│   │   └── imageProcessor.js  # 圖片處理工具
│   └── backend-utils/     # 後端共享工具
│       ├── firebase.js        # Firebase 初始化
│       ├── logger.js          # 日誌工具
│       ├── sanitizer.js       # 日誌脫敏工具
│       └── csrfProtection.js  # CSRF 保護
│
├── docs/                  # 共享文檔（部署、會員機制、TTS 等）
├── scripts/               # 根目錄工具腳本
│   ├── cleanup-ports.js   # 清理特定端口（推薦）
│   ├── kill-all-node.js   # 終止所有 Node.js 進程（測試用）
│   └── README.md          # 腳本使用說明
├── start-all.js           # 統一啟動腳本（同時啟動所有服務）
├── CHANGELOG.md           # 版本更新日誌 📋
└── PORTS.md               # 端口配置說明
```

## 開發環境

- **平台**: Windows (win32)
- **Firebase 專案**: chat-app-3-8a7ee
- **默認模式**: 連接生產環境 Firebase（非 Emulator）
- **Node.js**: 需要 ESM 支援（`"type": "module"`）

### ⚠️ 當前環境狀態警告

**默認配置狀態**：
- 🌐 **Firebase 模式**: 生產環境（非 Emulator）
- 📊 **數據庫**: 直接連接到生產 Firestore
- 🔒 **認證**: 生產環境 Firebase Auth
- ⚡ **即時生效**: 所有數據操作會立即影響生產資料庫

**開發建議**：
1. ✅ **測試新功能**: 使用 `npm run dev:with-emulator`（主應用）
2. ✅ **本地測試**: 設置 `USE_FIREBASE_EMULATOR=true`
3. ⚠️ **生產操作**: 修改生產數據前務必確認操作正確性
4. 📝 **數據備份**: 重要操作前建議先備份相關數據

💡 **本地開發**: 如需使用 Firebase Emulator 進行本地測試，請參閱 [chat-app/docs/firebase-emulator-setup.md](chat-app/docs/firebase-emulator-setup.md)。

## 常用命令

詳細命令請參考上方「快速命令參考」表格。

### 數據管理（Emulator 模式）

```bash
cd chat-app
npm run import:all          # 導入所有 Firestore 數據
npm run import:characters   # 僅導入 AI 角色
npm run import:configs      # 僅導入系統配置
npm run import:membership   # 僅導入會員方案
npm run import:test-data    # 導入測試數據
```

### 構建生產版本

```bash
cd chat-app && npm run build:frontend      # 主應用
cd chat-app-admin && npm run build:frontend # 管理後台
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

## 核心架構概覽

此章節提供主應用的關鍵架構概覽。詳細架構說明請參閱 [chat-app/CLAUDE.md](chat-app/CLAUDE.md)。

### 緩存系統架構

應用使用多層緩存提升性能：

**1. Character Cache（角色緩存）**
- **位置**: `backend/src/services/character/characterCache.service.js`
- **策略**: 啟動時預加載所有 AI 角色到內存
- **更新**: 支援熱更新，無需重啟服務
- **優勢**: 減少 99% 的 Firestore 讀取請求

**2. User Profile Cache（用戶資料緩存）**
- **位置**: `backend/src/user/userProfileCache.service.js`
- **策略**: LRU (最近最少使用) 緩存，最多 1000 個用戶
- **TTL**: 15 分鐘自動過期
- **監控**: 內建緩存命中率監控

**3. Conversation Cache（對話緩存）**
- **位置**: `backend/src/conversation/conversation.service.js`
- **存儲**: 內存 Map，key 為 `userId::characterId`
- **持久化**: Firestore 作為持久層
- **管理**: 自動清理不活躍對話

### 中間件系統

**1. 冪等性中間件** (`middleware/idempotency.js`)
- 防止重複消耗虛擬貨幣或資源
- 使用 Firestore 存儲冪等性 key
- 支援自動過期（24 小時）
- 詳見：[chat-app/docs/IDEMPOTENCY.md](chat-app/docs/IDEMPOTENCY.md)

**2. 認證中間件** (`auth/firebaseAuth.middleware.js`, `middleware/adminAuth.middleware.js`)
- Firebase Auth token 驗證
- 測試帳號支援（開發環境）
- 管理員權限驗證（Custom Claims）

**3. 速率限制中間件** (`middleware/rateLimiter.js`)
- 基於用戶 ID 的速率限制
- 不同 API 端點有不同限制
- 防止 API 濫用

**4. 驗證中間件** (`middleware/validation.middleware.js`)
- 請求參數驗證
- 統一錯誤響應格式

**5. 安全性中間件**
- **日誌脫敏** (`backend/src/utils/sanitizer.js`) - 自動過濾日誌中的敏感信息（密碼、Token、Email、手機等）
- **錯誤碼系統** (`backend/src/utils/errorCodes.js`) - 統一的錯誤碼體系（8 大類別，80+ 標準錯誤碼）
- **速率限制配置** (`backend/src/middleware/rateLimiterConfig.js`) - 分級速率限制策略
  - `veryStrictRateLimiter` (5次/分) - AI 圖片/影片生成
  - `strictRateLimiter` (10次/分) - TTS 語音生成
  - `purchaseRateLimiter` (10次/分) - 購買操作
  - `giftRateLimiter` (15次/分) - 送禮操作
  - `conversationRateLimiter` (20次/分) - AI 對話
  - `standardRateLimiter` (30次/分) - 一般寫操作
  - `relaxedRateLimiter` (60次/分) - 讀取操作
  - `authRateLimiter` (5次/5分，基於 IP) - 認證操作
- 詳見：[chat-app/backend/RATE_LIMITING_GUIDE.md](chat-app/backend/RATE_LIMITING_GUIDE.md)

### 限制服務系統

統一的使用限制追蹤系統，位於 `backend/src/services/limitService/`：

**核心服務**：
- `conversationLimit.service.js` - 對話次數限制（每角色計數）
- `voiceLimit.service.js` - 語音播放限制（每角色計數）
- `photoLimit.service.js` - AI 照片生成限制（月度重置）
- `ad.service.js` - 廣告觀看追蹤（每日限制 10 次）

**會員系統整合**：
- Free 用戶：有限次數 + 廣告解鎖
- VIP/VVIP 用戶：大幅提升或無限次數
- 重置邏輯：對話/語音每日重置（廣告解鎖），照片每月重置

詳細限制邏輯請參閱：`backend/src/services/limitService/` 目錄下的各個服務文件

### 主要功能系統

**1. 配對/角色系統**
- **位置**: `backend/src/match/`, `backend/src/services/character/`
- **功能**: 角色發現、搜尋、收藏
- **緩存**: 啟動時預加載所有角色
- **API**: `/api/match`, `/api/characters`

**2. 對話系統**
- **位置**: `backend/src/conversation/`, `backend/src/ai/`
- **AI 整合**: OpenAI GPT-4o-mini 生成回覆
- **上下文**: 保留最近 12 條訊息
- **建議系統**: 基於最近 6 條訊息生成 3 個快速回覆

**3. 虛擬商品系統**
- **禮物**: `backend/src/gift/` - 用戶送禮給 AI 角色
- **商店**: `backend/src/shop/` - 虛擬貨幣、解鎖券、藥水
- **資產**: `backend/src/user/assetPurchase.routes.js` - 用戶資產管理
- **交易**: `backend/src/payment/` - 訂單、交易記錄

**4. AI 功能**
- **TTS 語音**: OpenAI TTS，支援多種語音（shimmer, nova, coral 等）
- **圖片生成**: Gemini 2.5 Flash，自動壓縮為 WebP（減少 70-85% 大小）
- **角色創建**: 多步驟流程（性別 → 外觀 → 生成 → 語音）

**5. 會員系統**
- **位置**: `backend/src/membership/`
- **等級**: Free, VIP, VVIP
- **解鎖券**: 用於解鎖特定 AI 角色
- **藥水**: 暫時提升使用限制

### 前端架構：Composables

主應用前端使用 Vue 3 Composition API，關鍵 composables 位於 `frontend/src/composables/`：

**📁 組織結構**：
```
composables/
├── chat/                   # 聊天相關 composables
├── character-creation/     # 角色創建流程
├── limit/                  # 限制服務
├── match/                  # 配對和發現
├── photo-gallery/          # 照片相簿
├── ranking/                # 排行榜
├── search/                 # 搜尋功能
├── shop/                   # 商城購買
├── voice-selection/        # 語音選擇
└── *.ts                    # 核心共用 composables
```

**核心功能**：
- `useUserProfile` - 用戶資料和認證狀態管理
- `useFirebaseAuth` - Firebase 認證整合
- `useMembership` - 會員等級和權限檢查
- `useCoins` - 虛擬貨幣餘額管理
- `useGuestGuard` - 訪客權限守衛和限制

**限制系統**：
- `useConversationLimit` - 對話次數限制查詢
- `useVoiceLimit` - 語音播放限制查詢
- `usePhotoLimit` - 照片生成限制查詢
- `useBaseLimitService` - 統一限制服務基類

**聊天核心** (`composables/chat/`)：
- `useSendMessage` - 消息發送完整邏輯（含限制檢查、訪客處理）
- `useChatMessages` - 消息列表管理、歷史加載、API 通訊
- `useChatActions` - 聊天操作（重置對話、刪除消息等）
- `useSuggestions` - 快速回覆建議生成和管理
- `useChatInitialization` - 聊天頁面初始化流程
- `usePartner` - 對話夥伴資料和背景管理
- `useEventHandlers` - 聊天事件處理（發送、重試等）
- `useChatWatchers` - 聊天狀態監聽器

**聊天進階功能**：
- `useVoiceManagement` - TTS 語音播放管理和限制檢查
- `useSelfieGeneration` - AI 自拍照片生成和顯示
- `useVideoGeneration` - AI 視頻生成和處理
- `useGiftManagement` - 禮物發送管理和購買流程
- `usePotionManagement` - 藥水使用和效果管理
- `useFavoriteManagement` - 角色收藏/取消收藏
- `useConversationReset` - 對話重置確認和執行

**角色解鎖與限制**：
- `useCharacterUnlock` - 角色解鎖邏輯和狀態檢查
- `useConversationLimitActions` - 對話限制彈窗和解鎖操作

**聊天 UI 管理**：
- `useModalManager` - 聊天相關彈窗管理（禮物、照片等）
- `usePhotoVideoHandler` - 照片/視頻全螢幕查看處理
- `useShareFunctionality` - 分享功能（對話、照片等）
- `useChatListState` - 聊天列表狀態管理
- `useChatListActions` - 聊天列表操作（刪除、標記等）
- `useMenuActions` - 聊天選單操作（更多選項）

**角色創建**：
- `useCharacterCreationFlow` - 角色創建流程狀態管理
- `useGenderPreference` - 性別偏好設置

**UI 增強**：
- `useVirtualScroll` - 虛擬滾動（長列表性能優化）
- `useChatVirtualScroll` - 聊天訊息虛擬滾動
- `usePaginatedConversations` - 對話列表分頁加載
- `usePanelManager` - 面板管理（個人資料編輯）
- `useToast` - 通知提示
- `useConfirmDialog` - 確認對話框

**商店和購買**：
- `usePurchaseConfirm` - 購買確認流程
- `useUnlockTickets` - 解鎖券管理
- `useLimitModalActions` - 限制提示彈窗操作

### 性能優化策略

**1. 圖片壓縮**
- AI 生成圖片自動壓縮為 WebP 格式
- 品質設置：60（平衡品質和檔案大小）
- 減少 70-85% 檔案大小（從 ~1MB → ~100-200KB）
- 防止 localStorage QuotaExceededError

**2. 虛擬滾動**
- 長列表（聊天訊息、對話列表）使用虛擬滾動
- 只渲染可見區域的元素
- 大幅減少 DOM 節點數量

**3. 分頁加載**
- 對話列表分頁加載（每頁 20 條）
- 無限滾動自動加載下一頁
- 減少初始載入時間

**4. 緩存策略**
- 角色數據啟動時預加載
- 用戶資料使用 LRU 緩存
- 對話數據內存緩存 + Firestore 持久化

### 錯誤處理和日誌

**日誌系統** (`backend/src/utils/logger.js`)
- 使用自定義 logger
- 區分環境（開發/生產）
- HTTP 請求日誌記錄

**錯誤處理**
- 統一錯誤響應格式（`shared/utils/errorFormatter.js`）
- 錯誤處理中間件自動捕獲異常
- 詳細錯誤訊息（開發環境）vs 簡化訊息（生產環境）

**環境驗證** (`backend/src/utils/validateEnv.js`)
- 啟動時自動驗證必要的環境變數
- 缺少配置時阻止啟動並提示錯誤
- 詳見：[chat-app/docs/ENVIRONMENT_VALIDATION.md](chat-app/docs/ENVIRONMENT_VALIDATION.md)

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
10. **錯誤處理標準化** - 使用統一的錯誤碼系統（`backend/src/utils/errorCodes.js`）
11. **日誌安全** - 確保敏感信息自動脫敏（已內建於 logger）
12. **速率限制分級** - 根據操作成本選擇適當的速率限制器

## 文檔索引

### 根目錄文檔

- **[CHANGELOG.md](CHANGELOG.md)** - 版本更新日誌 📋
- **[PORTS.md](PORTS.md)** - 端口配置詳細說明
- **[會員機制說明.md](docs/會員機制說明.md)** - 會員系統完整說明

### 部署相關文檔

- **[docs/cloudflare-pages-quickstart.md](docs/cloudflare-pages-quickstart.md)** ⚡ - Cloudflare Pages 快速部署（5 分鐘）
- **[docs/cloudflare-pages-deployment.md](docs/cloudflare-pages-deployment.md)** - Cloudflare Pages 完整部署指南

### AI 服務文檔

- **[docs/TTS_COMPARISON.md](docs/TTS_COMPARISON.md)** - TTS 服務比較分析
- **[docs/GOOGLE_TTS_SETUP.md](docs/GOOGLE_TTS_SETUP.md)** - Google TTS 設置指南

### 主應用文檔（chat-app）

- **[chat-app/CLAUDE.md](chat-app/CLAUDE.md)** - 主應用完整開發指南 ⭐
- **[chat-app/docs/ENVIRONMENT_VALIDATION.md](chat-app/docs/ENVIRONMENT_VALIDATION.md)** - 環境變數驗證系統 🔍
- **[chat-app/backend/RATE_LIMITING_GUIDE.md](chat-app/backend/RATE_LIMITING_GUIDE.md)** - 速率限制應用指南 🛡️
- [chat-app/docs/firestore-collections.md](chat-app/docs/firestore-collections.md) - Firestore 資料庫架構
- [chat-app/docs/firebase-emulator-setup.md](chat-app/docs/firebase-emulator-setup.md) - Firebase Emulator 設置指南
- [chat-app/docs/IDEMPOTENCY.md](chat-app/docs/IDEMPOTENCY.md) - 冪等性系統實現指南
- [chat-app/docs/DEPLOYMENT.md](chat-app/docs/DEPLOYMENT.md) - 部署指南
- [chat-app/docs/COST-OPTIMIZATION.md](chat-app/docs/COST-OPTIMIZATION.md) - 成本優化指南
- [chat-app/docs/DATABASE-OPTIMIZATION-SUMMARY.md](chat-app/docs/DATABASE-OPTIMIZATION-SUMMARY.md) - 資料庫優化總結
- [chat-app/docs/ASSET_SYSTEM_ARCHITECTURE.md](chat-app/docs/ASSET_SYSTEM_ARCHITECTURE.md) - 資產系統架構
- [chat-app/docs/CHARACTER_CREATION_FLOW.md](chat-app/docs/CHARACTER_CREATION_FLOW.md) - 角色創建流程
- [chat-app/docs/USER_PROFILE_CACHE.md](chat-app/docs/USER_PROFILE_CACHE.md) - 用戶資料緩存說明
- [chat-app/backend/scripts/README.md](chat-app/backend/scripts/README.md) - 數據導入腳本指南

### 管理後臺文檔（chat-app-admin）

- **[chat-app-admin/README.md](chat-app-admin/README.md)** - 管理後臺完整文檔 ⭐

### 詳細架構說明

詳細的系統架構、API 設計、數據流程等說明請參閱各子項目的文檔：
- 主應用架構：[chat-app/CLAUDE.md](chat-app/CLAUDE.md#architecture-overview)
- Firestore 集合：[chat-app/docs/firestore-collections.md](chat-app/docs/firestore-collections.md)

## 已知問題與修復記錄

本專案持續追蹤和修復問題，主要修復包含：
- 商品價格不一致修復
- 角色創建資料保存修復
- CSRF 安全修復
- 錢包同步修復

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

## 調試技巧

### 常用調試命令

```bash
# 監控端點
curl http://localhost:4000/api/monitoring/health
curl http://localhost:4000/api/monitoring/stats

# 驗證環境變數
cd chat-app && npm run test:env
```

### 調試工具

- **後端**: VSCode Debugger, Postman, Firebase Emulator UI
- **前端**: Vue DevTools, 瀏覽器 DevTools (Network/Console)
- **數據庫**: Firebase Console, Firestore Emulator

### 常見問題快速排查

| 問題 | 解決方案 |
|-----|---------|
| Firebase 權限錯誤 | 檢查 `.env` 配置，運行 `npm run test:env` |
| API 429 錯誤 | 等待 1 分鐘或調整 `rateLimiterConfig.js` |
| 緩存未更新 | 調用 `invalidateUserCache(userId)` 或重啟服務 |
| 前端狀態不同步 | 調用 `fetchProfile()` 或刷新頁面 |

## 測試

### 運行測試

```bash
# 運行所有後端測試（688 tests, ~1.4s）
cd chat-app/backend && npm test

# 運行功能測試腳本
cd chat-app/backend
node scripts/test-membership-upgrade.js
node scripts/test-user-assets.js
```

**測試框架**: Vitest + Supertest

**測試位置**:
- API 路由測試: `chat-app/backend/src/**/*.routes.spec.js`
- 功能測試腳本: `chat-app/backend/scripts/test-*.js`

### 測試帳號

```javascript
import { TEST_ACCOUNTS } from '../../../../shared/config/testAccounts.js';

TEST_ACCOUNTS.GUEST_USER_ID  // "test-user"
TEST_ACCOUNTS.DEV_USER_ID    // 開發者測試帳號
```

### 測試策略

- ✅ **新功能**: 使用 `npm run dev:with-emulator`
- ✅ **Bug 修復**: 使用生產環境測試帳號
- ⚠️ **生產環境**: 僅使用 `shared/config/testAccounts.js` 中的帳號

## 部署

詳細部署指南：[chat-app/docs/DEPLOYMENT.md](chat-app/docs/DEPLOYMENT.md)

| 架構方案 | 前端 | 後端 | 快速指南 |
|---------|------|------|---------|
| Firebase | Firebase Hosting | Cloud Run | [DEPLOYMENT.md](chat-app/docs/DEPLOYMENT.md) |
| Cloudflare | Cloudflare Pages | Cloud Run | [cloudflare-pages-quickstart.md](docs/cloudflare-pages-quickstart.md) |

**快速部署**：
```bash
# 後端 → Cloud Run
cd chat-app/backend && ./deploy-cloudrun.sh

# 前端 → Firebase Hosting
cd chat-app && npm run build:frontend && firebase deploy --only hosting

# Firestore Rules
firebase deploy --only firestore:rules
```

## Agent 工作指南

### 開發模式選擇

**生產環境模式**（默認）：
```bash
npm run dev  # 連接生產 Firebase
```
- ⚠️ 所有操作直接影響生產資料庫
- 適合：Bug 修復、小型改進、查看生產數據
- 注意：修改數據前務必確認操作正確性

**Emulator 模式**（推薦用於開發新功能）：
```bash
cd chat-app
npm run dev:with-emulator  # 使用 Firebase Emulator + 自動導入測試數據
```
- ✅ 完全隔離的本地環境
- ✅ 自動導入測試數據（角色、配置、會員方案）
- 適合：開發新功能、測試數據變更、實驗性修改

### 配置管理

**集中化配置原則**：
- **端口配置**: 從 `config/ports.js` 導入（前後端統一）
- **限制配置**: 從 `backend/src/config/limits.js` 導入
- **測試帳號**: 從 `shared/config/testAccounts.js` 導入
- **禁止硬編碼**: 不要在代碼中直接寫端口號、限制值等

**修改配置後的步驟**：
```bash
# 1. 修改配置文件（如 config/ports.js）
# 2. 驗證配置同步
npm run verify-config
# 3. 重啟相關服務
```

### 代碼組織決策指南

在開發新功能時，遵循以下指南確保代碼組織的一致性：

**何時創建新的 Service**:
- ✅ 需要直接訪問 Firestore 或外部 API
- ✅ 包含複雜的商業邏輯（會員系統、交易處理等）
- ✅ 需要被多個路由或其他 service 共享
- ✅ 需要維護內部狀態或緩存
- 📂 **位置**: `backend/src/services/`, `backend/src/{feature}/`
- 📝 **命名**: `{feature}.service.js` (如 `user.service.js`, `payment.service.js`)
- 🔍 **示例**:
  - `backend/src/services/limitService/` - 限制追蹤服務
  - `backend/src/ai/gemini.service.js` - AI 圖片生成服務
  - `backend/src/user/userAssets.service.js` - 用戶資產管理

**何時創建新的 Composable**:
- ✅ 需要在多個 Vue 組件間共享邏輯
- ✅ 包含響應式狀態管理（ref, reactive, computed）
- ✅ 處理 API 調用、錯誤處理、加載狀態
- ✅ 可重用的 UI 邏輯（彈窗、表單驗證等）
- 📂 **位置**: `frontend/src/composables/`
- 📝 **命名**: `use{Feature}.js` (如 `useUserProfile.js`, `useCoins.js`)
- 🔍 **示例**:
  - `useUserProfile.js` - 用戶資料和認證狀態
  - `useConversationLimit.js` - 對話限制查詢
  - `useChatMessages.js` - 聊天消息管理

**何時創建新的 Middleware**:
- ✅ 需要在多個路由前執行的邏輯
- ✅ 認證、授權檢查
- ✅ 請求參數驗證
- ✅ 速率限制、冪等性檢查
- ✅ 日誌記錄、性能監控
- 📂 **位置**: `backend/src/middleware/`, `backend/src/auth/`
- 📝 **命名**: `{purpose}.middleware.js` 或 `{purpose}.js`
- 🔍 **示例**:
  - `firebaseAuth.middleware.js` - Firebase 認證驗證
  - `idempotency.js` - 冪等性中間件
  - `rateLimiterConfig.js` - 速率限制配置

**何時創建新的 Route**:
- ✅ 新增 API 端點或端點組
- ✅ 將相關端點分組（用戶、對話、支付等）
- ✅ 路由邏輯超過 50 行，需要拆分
- 📂 **位置**: `backend/src/{feature}/{feature}.routes.js`
- 📝 **命名**: `{feature}.routes.js` (如 `user.routes.js`, `conversation.routes.js`)
- 🔍 **模式**:
  ```javascript
  import express from 'express';
  import { authMiddleware } from '../auth/firebaseAuth.middleware.js';
  import { rateLimiter } from '../middleware/rateLimiterConfig.js';

  const router = express.Router();

  // 所有路由都需要認證
  router.use(authMiddleware);

  // 具體端點
  router.get('/:id', rateLimiter, getHandler);
  router.post('/', rateLimiter, createHandler);

  export default router;
  ```

**何時創建新的 Component**:
- ✅ UI 元素需要在多處重用（按鈕、卡片、表單等）
- ✅ 單個頁面組件超過 500 行，需要拆分
- ✅ 具有獨立職責的 UI 模塊
- 📂 **位置**: `frontend/src/components/`, `frontend/src/views/`
- 📝 **命名**:
  - 頁面：`{Name}View.vue` (如 `ChatView.vue`, `ProfileView.vue`)
  - 組件：`{Name}.vue` (如 `MessageBubble.vue`, `UserCard.vue`)
- 🔍 **拆分策略**: 查看 `ChatView.vue` + `composables/chat/` 的拆分模式

**何時使用 Helper/Utility**:
- ✅ 純函數工具（無狀態、無副作用）
- ✅ 數據格式化、驗證、轉換
- ✅ 常量定義、配置管理
- 📂 **位置**:
  - `backend/src/utils/` - 後端工具
  - `frontend/src/utils/` - 前端工具
  - `shared/utils/` - 跨應用共享工具
- 📝 **命名**: `{purpose}.js` 或 `{purpose}.helpers.js`
- 🔍 **示例**:
  - `sanitizer.js` - 日誌脫敏工具
  - `errorCodes.js` - 錯誤碼定義
  - `membershipUtils.js` - 會員工具函數

**文件命名規範**:

| 類型 | 命名格式 | 示例 |
|-----|---------|------|
| Service | `{feature}.service.js` | `user.service.js` |
| Route | `{feature}.routes.js` | `conversation.routes.js` |
| Middleware | `{purpose}.middleware.js` | `auth.middleware.js` |
| Composable | `use{Feature}.js` | `useUserProfile.js` |
| Component (Page) | `{Name}View.vue` | `ChatView.vue` |
| Component (Reusable) | `{Name}.vue` | `MessageBubble.vue` |
| Utility | `{purpose}.js` | `logger.js` |
| Config | `{feature}.config.js` 或 `{feature}.js` | `limits.js` |
| Schema | `{feature}.schemas.js` | `user.schemas.js` |

**Firestore 集合命名規範**:
- ✅ 使用小寫 + 下劃線：`user_conversations`, `user_favorites`
- ✅ 配置類集合：單數形式 `membership_tiers`, `gift_rarities`
- ✅ 用戶數據：使用子集合 `users/{userId}/conversations/{characterId}`
- ✅ 時間戳欄位：統一使用 `createdAt`, `updatedAt`, `expiresAt`
- 🔍 **詳細架構**: 查看 [chat-app/docs/firestore-collections.md](chat-app/docs/firestore-collections.md)

**代碼組織最佳實踐**:

1. **單一職責原則** - 每個文件只做一件事
2. **依賴注入** - 通過參數傳遞依賴，而非硬編碼
3. **配置集中化** - 使用 `config/` 目錄，避免魔法數字
4. **錯誤處理標準化** - 使用統一的錯誤碼系統
5. **文檔完整性** - 複雜邏輯添加 JSDoc 註釋
6. **測試覆蓋** - 關鍵業務邏輯編寫測試腳本

### 功能開發

**新增使用限制功能**：
1. 在 `backend/src/config/limits.js` 定義限制值
2. 參考 `backend/src/services/limitService/` 的模式創建服務
3. 使用 `baseLimitService.js` 作為基類
4. 實現 Firestore 持久化追蹤
5. 前端使用對應的 composable（如 `useConversationLimit`）

**實現冪等性**（消耗性操作必須）：
```javascript
// Backend 路由
import { handleIdempotentRequest } from './middleware/idempotency.js';

router.post('/purchase', handleIdempotentRequest, async (req, res) => {
  // 業務邏輯（只會執行一次）
});

// Frontend 調用
const idempotencyKey = `purchase_${userId}_${Date.now()}`;
await api.post('/purchase', { data }, {
  headers: { 'Idempotency-Key': idempotencyKey }
});
```

**組件開發規範**：
- **大小限制**: 單個組件不超過 500 行
- **邏輯提取**: 複雜邏輯提取到 composables
- **重用性**: 可重用邏輯放在 `src/composables/`
- **示例**: 查看 `ChatView.vue` + `composables/chat/` 的拆分模式

**錯誤處理和安全性**：
```javascript
// 使用統一的錯誤碼系統
import { ErrorCodes, createErrorResponse } from './utils/errorCodes.js';

// 返回標準化錯誤響應
return res.status(400).json(
  createErrorResponse(ErrorCodes.VALIDATION.MISSING_PARAMETER, 'userId')
);

// 速率限制應用
import { giftRateLimiter } from './middleware/rateLimiterConfig.js';
router.post('/send', giftRateLimiter, handleIdempotentRequest, async (req, res) => {
  // 業務邏輯
});

// 日誌記錄（自動脫敏）
logger.info('User login', { userId, email: 'user@example.com' });
// 輸出: { userId: '...', email: 'us***@example.com' }
```

### 緩存系統開發

**Character Cache（角色緩存）**：
```javascript
// 獲取角色（自動從緩存讀取）
import { getCharacterById } from './services/character/characterCache.service.js';
const character = getCharacterById('match-001');

// 更新緩存（修改角色後）
import { updateCharacterInCache } from './services/character/characterCache.service.js';
await updateCharacterInCache(characterId, updatedData);
```

**User Profile Cache（用戶緩存）**：
```javascript
// 獲取用戶（自動緩存）
import { getUserProfile } from './user/userProfileCache.service.js';
const profile = await getUserProfile(userId);

// 清除緩存（修改用戶資料後）
import { invalidateUserCache } from './user/userProfileCache.service.js';
invalidateUserCache(userId);
```

### 資料庫操作

**新增 Firestore 集合的步驟**：
1. 在 `docs/firestore-collections.md` 記錄數據結構
2. 創建導入腳本（`backend/scripts/import-*.js`）
3. 在 `firestore.indexes.json` 添加必要的索引
4. 更新 `firestore.rules` 添加安全規則
5. 使用 Emulator 測試：`npm run dev:with-emulator`

### 前端開發

**Composables 使用模式**：
```javascript
// 在組件中使用
import { useUserProfile } from '@/composables/useUserProfile';
import { useConversationLimit } from '@/composables/useConversationLimit';

export default {
  setup() {
    const { profile, isVIP } = useUserProfile();
    const { canSendMessage, remainingMessages } = useConversationLimit(characterId);

    return { profile, isVIP, canSendMessage, remainingMessages };
  }
}
```

**API 調用規範**：
```javascript
// 使用統一的 API 客戶端
import { apiJson } from '@/utils/api';

// GET 請求
const characters = await apiJson('/api/characters');

// POST 請求（自動處理錯誤和認證）
const result = await apiJson('/api/conversations/send', {
  method: 'POST',
  body: JSON.stringify({ message, characterId })
});
```

### 測試和驗證

**環境變數驗證**（新增環境變數後）：
```bash
cd chat-app
npm run test:env  # 驗證所有必要的環境變數
```

**端口配置驗證**（修改端口後）：
```bash
npm run verify-config  # 確保前後端端口配置同步
```

**數據導入測試**（Emulator 模式）：
```bash
npm run import:all          # 導入所有數據
npm run import:characters   # 僅測試角色導入
npm run import:test-data    # 導入測試用戶和對話
```

**安全性驗證**：
```bash
# 查看所有標準錯誤碼
cat chat-app/backend/src/utils/errorCodes.js

# 查看速率限制配置
cat chat-app/backend/src/middleware/rateLimiterConfig.js

# 查看日誌脫敏配置
cat chat-app/backend/src/utils/sanitizer.js
```

### 性能優化指南

**何時使用虛擬滾動**：
- 列表項目 > 100 個
- 每個列表項目渲染成本較高
- 示例：聊天訊息列表、對話列表

**圖片處理**：
- AI 生成圖片：自動壓縮為 WebP（已實現）
- 用戶上傳圖片：需要在前端壓縮後再上傳
- 使用 `sharp` (後端) 或 `browser-image-compression` (前端)

**緩存使用時機**：
- 靜態數據（角色列表）：啟動時預加載
- 熱數據（用戶資料）：LRU 緩存
- 會話數據（對話記錄）：內存 + Firestore 雙層

### 文檔維護

**修改後必須更新的文檔**：
1. **新增 API 端點** → `chat-app/CLAUDE.md` 的 API 列表
2. **新增 Firestore 集合** → `chat-app/docs/firestore-collections.md`
3. **修改限制邏輯** → 更新對應的 limit service 和 `backend/src/config/limits.js`
4. **新增優化措施** → `chat-app/docs/COST-OPTIMIZATION.md` 或 `DATABASE-OPTIMIZATION-SUMMARY.md`
5. **部署流程變更** → `chat-app/docs/DEPLOYMENT.md`

**文檔位置索引**：
- 總體架構 → 根目錄 `CLAUDE.md`（本文件）
- 主應用詳細 → `chat-app/CLAUDE.md`
- 管理後臺 → `chat-app-admin/README.md`
- API 參考 → `chat-app/docs/`
- Firestore 架構 → `chat-app/docs/firestore-collections.md`

### 常見開發任務

| 任務 | 方法 |
|-----|------|
| 添加 AI 角色 | 管理後臺 (localhost:5174) 或 `npm run import:characters` |
| 添加虛擬商品 | 管理後臺或直接修改 Firestore `gifts` 集合 |
| 修改會員限制 | Firestore `membership_tiers` → `features` 欄位 |
| 添加限制類型 | 參考 `backend/src/services/limitService/` 模式 |
| 添加速率限制 | 使用 `rateLimiterConfig.js` 中的限制器 |
| 添加錯誤碼 | 在 `errorCodes.js` 中定義，使用 `createErrorResponse()` |

### 重要提醒

**生產環境操作**：
- ⚠️ **默認連接生產環境**: 所有數據修改操作需格外小心
- 🔍 **先查後改**: 修改前先查詢確認數據正確
- 💾 **重要數據備份**: Firestore Console 導出備份
- 📝 **記錄變更**: 在 git commit 中詳細說明生產數據變更

**測試建議**：
- ✅ **新功能用 Emulator**: `npm run dev:with-emulator`
- ✅ **測試帳號測試**: 使用 `shared/config/testAccounts.js` 中的測試帳號
- ✅ **小範圍驗證**: 生產環境測試時使用測試帳號先驗證

**代碼規範**：
- 📝 **繁體中文回應**: 與用戶的所有溝通使用繁體中文
- 🔒 **安全第一**: 所有用戶輸入必須驗證和清理
- 🚫 **避免硬編碼**: 使用集中化配置
- ♻️ **可重用性**: 重複邏輯提取為函數或 composable
- 🛡️ **錯誤處理**: 使用統一的錯誤碼系統
- 🔐 **敏感信息**: 永不記錄敏感信息到日誌（已自動脫敏）
- ⏱️ **速率限制**: 所有寫操作和成本較高的操作必須有速率限制
