# Cloudflare Pages 快速開始指南 ⚡

> 5 分鐘完成前端部署，完全免費！

## 🚀 最快部署方式（推薦）

### 步驟 1：推送代碼到 GitHub

```bash
git add .
git commit -m "準備部署到 Cloudflare Pages"
git push origin main
```

### 步驟 2：連接 Cloudflare Pages

1. 訪問 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 選擇 **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. 選擇 **GitHub** 並授權
4. 選擇您的儲存庫

### 步驟 3：配置構建設置

| 設定項目 | 值 |
|---------|---|
| **Project name** | `chat-app-frontend` |
| **Production branch** | `main` |
| **Framework preset** | `Vite` |
| **Build command** | `cd chat-app/frontend && npm install && npm run build` |
| **Build output directory** | `chat-app/frontend/dist` |

### 步驟 4：添加環境變數

點擊 **Add variable** 添加以下變數（從您的 `.env` 文件複製）：

```env
VITE_FIREBASE_API_KEY=<your-key>
VITE_FIREBASE_AUTH_DOMAIN=chat-app-3-8a7ee.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=chat-app-3-8a7ee
VITE_FIREBASE_STORAGE_BUCKET=chat-app-3-8a7ee.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<your-id>
VITE_FIREBASE_APP_ID=<your-id>
VITE_API_URL=https://your-backend.run.app
VITE_USE_EMULATOR=false
```

**獲取 Firebase 配置**：
- 前往 [Firebase Console](https://console.firebase.google.com/)
- 選擇專案 `chat-app-3-8a7ee`
- 專案設定 > 一般 > 您的應用程式 > 配置

### 步驟 5：部署

點擊 **Save and Deploy**，等待 2-5 分鐘。

✅ 完成！您的網站將部署到：`https://chat-app-frontend.pages.dev`

---

## 🔧 後續配置

### 1. 更新後端 CORS

在 `chat-app/backend/.env` 添加 Cloudflare Pages URL：

```env
CORS_ORIGIN=https://chat-app-frontend.pages.dev
```

然後重新部署後端：

```bash
cd chat-app/backend
# 重新部署到 Cloud Run
```

### 2. 自動部署設置

✅ **已完成**！每次推送到 `main` 分支會自動部署。

### 3. 自定義域名（可選）

1. 前往 **Custom domains** → **Set up a custom domain**
2. 輸入您的域名（例如：`app.yourdomain.com`）
3. 添加 DNS 記錄（如果域名在 Cloudflare 會自動配置）
4. 等待 SSL 憑證自動生成（1-5 分鐘）

---

## 📊 成本對比

| 服務 | 每月成本 |
|------|---------|
| Firebase Hosting（100GB 流量） | $15 |
| Cloudflare Pages（無限流量） | **$0** ✅ |

**每年節省**: **$180** 💰

---

## 🐛 常見問題

### 構建失敗？

檢查 Build command 是否正確：
```bash
cd chat-app/frontend && npm install && npm run build
```

### API 請求失敗？

1. 檢查 `VITE_API_URL` 是否正確
2. 確認後端 CORS 已添加 Cloudflare Pages URL

### 頁面刷新出現 404？

✅ 已解決！我們已添加 `_redirects` 文件處理 SPA 路由。

---

## 📚 詳細文檔

需要更多資訊？查看完整指南：
- [Cloudflare Pages 完整部署指南](./cloudflare-pages-deployment.md)
- [Cloudflare 官方文檔](https://developers.cloudflare.com/pages/)

---

## ✅ 檢查清單

部署前確認：

- [ ] 代碼已推送到 GitHub
- [ ] 已準備好 Firebase 配置資訊
- [ ] 已確認後端 API URL
- [ ] 已創建 Cloudflare 帳號

部署後確認：

- [ ] 網站可以訪問
- [ ] Firebase 登入功能正常
- [ ] API 請求成功（檢查瀏覽器控制台）
- [ ] 後端 CORS 已更新
- [ ] （可選）自定義域名已配置

---

**需要幫助？** 查看 [完整部署指南](./cloudflare-pages-deployment.md) 或 [故障排除章節](./cloudflare-pages-deployment.md#故障排除)
