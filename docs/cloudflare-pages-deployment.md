# Cloudflare Pages 部署指南

> 🎉 **完全免費**的前端託管方案，無限流量、全球 CDN、自動 SSL

## 📋 目錄

- [為什麼選擇 Cloudflare Pages](#為什麼選擇-cloudflare-pages)
- [前置準備](#前置準備)
- [方法 1：通過 GitHub 自動部署（推薦）](#方法-1通過-github-自動部署推薦)
- [方法 2：通過 Wrangler CLI 手動部署](#方法-2通過-wrangler-cli-手動部署)
- [環境變數配置](#環境變數配置)
- [自定義域名設置](#自定義域名設置)
- [故障排除](#故障排除)

---

## 為什麼選擇 Cloudflare Pages

| 功能 | Firebase Hosting | Cloudflare Pages |
|------|------------------|------------------|
| **流量費用** | $0.15/GB | **完全免費** ✅ |
| **每月免費額度** | 10GB | **無限** ✅ |
| **全球 CDN** | ✅ | ✅ |
| **自動 SSL** | ✅ | ✅ |
| **構建次數** | 有限 | 每天 500 次 ✅ |
| **自動部署** | 需配置 | 內建 Git 整合 ✅ |

**預估節省**: 每月可省下 **100% 的前端託管費用**！

---

## 前置準備

### 1. 註冊 Cloudflare 帳號

前往 [Cloudflare](https://dash.cloudflare.com/sign-up) 註冊免費帳號

### 2. 確認專案結構

```
chat-app/
├── frontend/
│   ├── dist/           # 構建輸出目錄（自動生成）
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── wrangler.toml       # Cloudflare 配置（已創建）
└── .pages/
    └── build-config.json  # 構建配置（已創建）
```

### 3. 確保程式碼已推送到 GitHub

```bash
git add .
git commit -m "準備部署到 Cloudflare Pages"
git push origin main
```

---

## 方法 1：通過 GitHub 自動部署（推薦）

### 步驟 1：創建 Pages 專案

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左側選單選擇 **Workers & Pages**
3. 點擊 **Create application**
4. 選擇 **Pages** 標籤
5. 點擊 **Connect to Git**

### 步驟 2：連接 GitHub

1. 選擇 **GitHub** 並授權 Cloudflare 訪問
2. 選擇您的儲存庫（例如：`your-username/chat-app-all`）
3. 點擊 **Begin setup**

### 步驟 3：配置構建設置

在 **Build settings** 頁面填入以下資訊：

| 設定項目 | 值 |
|---------|---|
| **Project name** | `chat-app-frontend`（或自訂名稱） |
| **Production branch** | `main` |
| **Framework preset** | `Vite` |
| **Build command** | `cd chat-app/frontend && npm install && npm run build` |
| **Build output directory** | `chat-app/frontend/dist` |
| **Root directory** | 留空（或 `chat-app`） |

### 步驟 4：設置環境變數

在 **Environment variables** 區域點擊 **Add variable**，添加以下變數：

#### 必要環境變數：

```env
# Firebase 配置
VITE_FIREBASE_API_KEY=<your-firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=chat-app-3-8a7ee.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=chat-app-3-8a7ee
VITE_FIREBASE_STORAGE_BUCKET=chat-app-3-8a7ee.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
VITE_FIREBASE_APP_ID=<your-app-id>

# 後端 API URL（使用您的 Cloud Run URL）
VITE_API_URL=https://your-backend.run.app

# Firebase Emulator（生產環境設為 false）
VITE_USE_EMULATOR=false
```

> 💡 **獲取 Firebase 配置**：
> 1. 前往 [Firebase Console](https://console.firebase.google.com/)
> 2. 選擇專案 `chat-app-3-8a7ee`
> 3. 專案設定 > 一般 > 您的應用程式 > SDK 設置和配置
> 4. 複製配置值

### 步驟 5：開始部署

1. 點擊 **Save and Deploy**
2. Cloudflare 會自動：
   - 克隆您的 GitHub 儲存庫
   - 安裝依賴
   - 執行構建命令
   - 部署到全球 CDN

### 步驟 6：查看部署狀態

部署通常需要 2-5 分鐘，完成後會顯示：

```
✅ Success! Your site is live at:
https://chat-app-frontend.pages.dev
```

### 步驟 7：設置自動部署

✅ **已自動啟用**！每次推送到 `main` 分支都會自動觸發部署。

---

## 方法 2：通過 Wrangler CLI 手動部署

### 步驟 1：安裝 Wrangler

```bash
npm install -g wrangler
```

### 步驟 2：登入 Cloudflare

```bash
wrangler login
```

這會打開瀏覽器進行授權。

### 步驟 3：構建前端

```bash
cd chat-app/frontend
npm install
npm run build
```

### 步驟 4：部署

```bash
# 從 chat-app/ 目錄執行
cd ..
wrangler pages deploy frontend/dist --project-name=chat-app-frontend
```

首次部署會提示創建專案，輸入 `y` 確認。

### 步驟 5：設置環境變數（CLI 方式）

```bash
# 設置 Firebase API Key
wrangler pages secret put VITE_FIREBASE_API_KEY --project-name=chat-app-frontend
# 輸入值後按 Enter

# 設置其他變數（重複執行）
wrangler pages secret put VITE_FIREBASE_AUTH_DOMAIN --project-name=chat-app-frontend
wrangler pages secret put VITE_FIREBASE_PROJECT_ID --project-name=chat-app-frontend
wrangler pages secret put VITE_API_URL --project-name=chat-app-frontend
# ... 其他變數
```

---

## 環境變數配置

### 完整環境變數清單

將以下變數添加到 Cloudflare Pages Dashboard：

**Workers & Pages > chat-app-frontend > Settings > Environment variables**

```env
# ==================== Firebase 配置 ====================
VITE_FIREBASE_API_KEY=<從 Firebase Console 取得>
VITE_FIREBASE_AUTH_DOMAIN=chat-app-3-8a7ee.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=chat-app-3-8a7ee
VITE_FIREBASE_STORAGE_BUCKET=chat-app-3-8a7ee.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<從 Firebase Console 取得>
VITE_FIREBASE_APP_ID=<從 Firebase Console 取得>

# ==================== API 配置 ====================
# 後端 API URL - 使用 Cloud Run 部署的 URL
VITE_API_URL=https://your-backend-api.run.app

# ==================== 其他配置 ====================
VITE_USE_EMULATOR=false
NODE_VERSION=18
```

### 設置預覽環境變數（可選）

如果您想為 Pull Request 預覽設置不同的變數：

1. 進入 **Settings > Environment variables**
2. 選擇 **Preview** 環境
3. 添加預覽專用變數（例如測試 API URL）

---

## 自定義域名設置

### 添加自定義域名

1. 前往 **Workers & Pages > chat-app-frontend > Custom domains**
2. 點擊 **Set up a custom domain**
3. 輸入您的域名（例如：`app.yourdomain.com`）
4. 按照指示添加 DNS 記錄：

#### 選項 A：域名在 Cloudflare

✅ **自動配置**！Cloudflare 會自動添加 DNS 記錄。

#### 選項 B：域名在其他服務商

添加 CNAME 記錄：

```
類型: CNAME
名稱: app（或您想要的子域名）
目標: chat-app-frontend.pages.dev
```

5. 等待 DNS 傳播（通常 5-10 分鐘）
6. ✅ **自動 SSL**！Cloudflare 會自動配置 HTTPS

---

## 更新 .gitignore

確保不提交敏感檔案：

```bash
# 在 chat-app/.gitignore 添加
.env.production
.wrangler/
.pages/
```

---

## 構建優化建議

### 1. 啟用生產環境優化

在 `chat-app/frontend/.env.production` 設置：

```env
NODE_ENV=production
```

### 2. 添加部署腳本

在 `chat-app/package.json` 添加：

```json
{
  "scripts": {
    "deploy:frontend": "cd frontend && npm run build && cd .. && wrangler pages deploy frontend/dist --project-name=chat-app-frontend",
    "deploy:preview": "cd frontend && npm run build && cd .. && wrangler pages deploy frontend/dist --project-name=chat-app-frontend --branch=preview"
  }
}
```

---

## 故障排除

### 問題 1：構建失敗 - "Cannot find module"

**原因**: 依賴未安裝

**解決**:
- 確認 `Build command` 包含 `npm install`
- 檢查 `package.json` 是否有遺漏的依賴

### 問題 2：環境變數未生效

**原因**: Vite 環境變數必須以 `VITE_` 開頭

**解決**:
- 確保所有前端環境變數都以 `VITE_` 開頭
- 修改環境變數後需重新部署

### 問題 3：API 請求失敗 - CORS 錯誤

**原因**: 後端未允許 Cloudflare Pages 域名

**解決**:
在後端 `.env` 添加 Cloudflare Pages URL：

```env
CORS_ORIGIN=https://chat-app-frontend.pages.dev,https://your-custom-domain.com
```

### 問題 4：404 錯誤（刷新頁面時）

**原因**: SPA 路由配置問題

**解決**:
創建 `chat-app/frontend/public/_redirects` 文件：

```
/*    /index.html   200
```

Cloudflare Pages 會自動處理 SPA 路由。

### 問題 5：構建超時

**原因**: 構建時間過長

**解決**:
- Cloudflare Pages 有 20 分鐘構建時間限制（通常夠用）
- 檢查是否有不必要的構建步驟

---

## 監控和分析

### 查看部署記錄

1. 前往 **Workers & Pages > chat-app-frontend > Deployments**
2. 可查看每次部署的：
   - 構建日誌
   - 部署時間
   - 提交記錄

### 查看流量分析

1. 前往 **Workers & Pages > chat-app-frontend > Analytics**
2. 可查看：
   - 請求數
   - 頻寬使用
   - 錯誤率
   - 地理分佈

---

## 回滾部署

如果新版本有問題，可快速回滾：

1. 前往 **Deployments**
2. 找到穩定的舊版本
3. 點擊 **Rollback to this deployment**
4. 確認回滾

---

## 成本對比

### Firebase Hosting vs Cloudflare Pages

假設每月流量 100GB：

| 項目 | Firebase Hosting | Cloudflare Pages |
|------|------------------|------------------|
| 流量費用 | $13.50 | **$0** |
| 構建費用 | $0 | **$0** |
| SSL 憑證 | $0 | **$0** |
| **總計** | **$13.50/月** | **$0/月** |

**每年節省**: **$162** 💰

---

## 下一步

✅ 部署完成後：

1. 測試所有功能是否正常
2. 更新後端 CORS 設置允許新域名
3. 設置自定義域名（可選）
4. 配置 GitHub 保護規則（可選）
5. 享受完全免費的全球 CDN！🎉

---

## 相關資源

- [Cloudflare Pages 文檔](https://developers.cloudflare.com/pages/)
- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html)
- [Firebase Console](https://console.firebase.google.com/)
- [Wrangler CLI 文檔](https://developers.cloudflare.com/workers/wrangler/)

---

## 需要幫助？

遇到問題請參考：
- Cloudflare Pages 問題：[Cloudflare Community](https://community.cloudflare.com/)
- 專案相關問題：查看專案 README 或聯繫開發團隊
