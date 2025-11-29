# 🎯 CSRF Token 問題最終解決方案

## ✅ 問題已解決

**本地開發環境**：✅ 已修復
**生產環境**：⏳ 待部署

---

## 📋 問題總結

### 原始問題

1. **本地開發**：前端（localhost:5173）和後端（localhost:4000）跨端口，CSRF Cookie 無法正常工作
2. **生產環境**：前端（Cloudflare Pages）和後端（Cloud Run）跨域，Cookie 的 `SameSite: Strict` 阻止跨域傳遞

### 錯誤信息

```
POST http://localhost:4000/api/... 403 (Forbidden)
錯誤: 請先獲取 CSRF Token
[CSRF] 請求缺少 CSRF Cookie
```

---

## 🔧 最終解決方案

### 本地開發環境（已完成 ✅）

**方案**：使用 **Vite 代理**，讓前後端看起來在同一個域名

**修改的文件**：

1. **`chat-app/frontend/.env`**
   ```env
   # 開發環境留空，使用 Vite 代理（解決 CSRF Cookie 跨端口問題）
   # 生產環境設置為實際的後端 URL
   VITE_API_URL=
   ```

2. **`chat-app/frontend/vite.config.js`**（已有配置，無需修改）
   ```javascript
   server: {
     proxy: {
       "/api": {
         target: "http://localhost:4000",
         changeOrigin: true,
       },
       // ... 其他路徑
     }
   }
   ```

**工作原理**：
- 前端訪問：`http://localhost:5173/api/...`
- Vite 代理轉發到：`http://localhost:4000/api/...`
- 瀏覽器認為前後端在同一域名（localhost:5173）
- Cookie 可以正常工作 ✅

---

### 生產環境（待部署 ⏳）

**方案**：修改 CSRF Cookie 配置，支持跨域

**已修改的文件**：

1. **`shared/backend-utils/csrfProtection.js`**

   **開發環境**：
   ```javascript
   sameSite: isDevelopment ? undefined : 'none'
   secure: !isDevelopment  // false（HTTP）
   ```

   **生產環境**：
   ```javascript
   sameSite: 'none'  // 允許跨域
   secure: true      // HTTPS 必須
   ```

2. **`chat-app/backend/cloud-run-env-vars.txt`**
   ```
   CORS_ORIGIN=https://chat-app-all.pages.dev
   ```

**待執行步驟**：

1. ✅ Cloud Run 環境變數已更新（`CORS_ORIGIN=https://chat-app-all.pages.dev`）
2. ⏳ 需要重新部署後端代碼到 Cloud Run

---

## 🚀 生產環境部署步驟

### 選項 A：使用 Google Cloud Console（推薦）

1. **打開 Cloud Console**：
   - 訪問：https://console.cloud.google.com/run?project=chat-app-3-8a7ee

2. **打開 Cloud Shell**（點擊右上角的 `>_` 圖標）

3. **在 Cloud Shell 中執行**：
   ```bash
   # 克隆代碼（如果還沒有）
   git clone YOUR_GITHUB_REPO_URL
   cd YOUR_REPO/chat-app/backend

   # 或者上傳代碼（使用 Cloud Shell 的上傳功能）

   # 構建並部署
   gcloud builds submit --config=cloudbuild.yaml . --project=chat-app-3-8a7ee

   gcloud run deploy chat-backend \
     --image gcr.io/chat-app-3-8a7ee/chat-backend \
     --region asia-east1 \
     --project=chat-app-3-8a7ee \
     --platform managed
   ```

### 選項 B：本地部署（如果 gcloud 已配置）

1. **確保已登入**：
   ```bash
   gcloud auth login
   gcloud config set project chat-app-3-8a7ee
   ```

2. **運行部署腳本**：
   ```bash
   cd d:\project\chat-app-all\chat-app\backend

   # PowerShell
   .\deploy-now.bat

   # 或 CMD
   deploy-now.bat
   ```

---

## 🧪 部署後驗證

### 1. 測試 CORS 和 CSRF Token

```bash
curl -v https://chat-backend-412373024299.asia-east1.run.app/api/csrf-token \
  -H "Origin: https://chat-app-all.pages.dev"
```

**預期輸出**：
```
< HTTP/2 200
< access-control-allow-origin: https://chat-app-all.pages.dev
< set-cookie: _csrf=...; Path=/; SameSite=None; Secure
```

**關鍵點**：
- ✅ `access-control-allow-origin` 包含前端 URL
- ✅ `SameSite=None`（不再是 `Strict`）
- ✅ `Secure`（HTTPS）

### 2. 測試前端功能

1. 訪問：https://chat-app-all.pages.dev
2. 清除瀏覽器緩存和 Cookie（`Ctrl + Shift + Delete`）
3. 強制刷新（`Ctrl + Shift + R`）
4. 檢查 Cookie（F12 → Application → Cookies）
   - 應該看到 `_csrf` Cookie
5. 測試發送消息
   - 應該成功，不再有 403 錯誤 ✅

---

## 📊 配置對比

### 開發環境（本地）

| 項目 | 配置 | 說明 |
|------|------|------|
| 前端 URL | `http://localhost:5173` | Vite 開發服務器 |
| 後端 URL | `http://localhost:4000` | Express 服務器 |
| API 訪問 | `/api/...`（相對路徑） | 通過 Vite 代理 |
| VITE_API_URL | 空字符串 | 使用 Vite 代理 |
| Cookie SameSite | `undefined` | 不設置（瀏覽器默認） |
| Cookie Secure | `false` | HTTP |
| CORS Origin | `http://localhost:5173` | 本地前端 |

### 生產環境

| 項目 | 配置 | 說明 |
|------|------|------|
| 前端 URL | `https://chat-app-all.pages.dev` | Cloudflare Pages |
| 後端 URL | `https://chat-backend-412373024299.asia-east1.run.app` | Cloud Run |
| API 訪問 | `https://chat-backend-...`（完整 URL） | 直接訪問 |
| VITE_API_URL | `https://chat-backend-...` | 完整後端 URL |
| Cookie SameSite | `'none'` | 允許跨域 |
| Cookie Secure | `true` | HTTPS 必須 |
| CORS Origin | `https://chat-app-all.pages.dev` | 生產前端 |

---

## 🔍 故障排除

### 問題 1：本地開發仍然 403

**檢查清單**：
- [ ] `.env` 中 `VITE_API_URL` 是否為空
- [ ] 前端是否重啟（`npm run dev`）
- [ ] 瀏覽器 Cookie 是否清除
- [ ] 訪問的 URL 是 `http://localhost:5173`（不是 127.0.0.1）

**解決方法**：
```bash
# 1. 確認 .env 配置
cat chat-app/frontend/.env | grep VITE_API_URL
# 應該顯示：VITE_API_URL=

# 2. 重啟前端
cd chat-app/frontend
npm run dev

# 3. 清除瀏覽器 Cookie（在瀏覽器控制台）
document.cookie.split(";").forEach(c => {
  document.cookie = c.trim().split("=")[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
});
location.reload();
```

### 問題 2：生產環境仍然 403

**可能原因**：
1. 後端代碼未部署（仍然是舊版本）
2. CORS_ORIGIN 配置錯誤
3. 前端 URL 和 CORS_ORIGIN 不匹配

**檢查方法**：
```bash
# 測試 CORS
curl -v https://chat-backend-412373024299.asia-east1.run.app/api/csrf-token \
  -H "Origin: https://chat-app-all.pages.dev" 2>&1 | grep -i "sameSite"

# 應該看到：SameSite=None（不是 Strict）
```

**如果仍是 `SameSite=Strict`**：
- 說明後端代碼未更新，需要重新部署

### 問題 3：Cookie 未設置

**檢查瀏覽器開發者工具**：

1. Network 標籤 → `/api/csrf-token` 請求
2. Response Headers → 查找 `Set-Cookie`
3. 應該看到：`Set-Cookie: _csrf=...; SameSite=None; Secure`

**如果沒有 Set-Cookie**：
- 檢查後端日誌
- 確認 CORS 配置正確
- 確認請求包含 `Origin` 頭

---

## 📝 重要提醒

### 開發環境

1. **永久配置**（不需要再改）：
   - `frontend/.env` 中 `VITE_API_URL` 保持為空
   - Vite 代理會自動處理所有 API 請求

2. **每次啟動**：
   - 後端：`cd chat-app/backend && npm run dev`
   - 前端：`cd chat-app/frontend && npm run dev`
   - 或統一：`cd chat-app && npm run dev`

### 生產環境

1. **部署前**：
   - 確認 `cloud-run-env-vars.txt` 中 `CORS_ORIGIN` 正確
   - 確認 `shared/backend-utils/csrfProtection.js` 已修改

2. **部署後**：
   - 驗證 CSRF Token 配置（`SameSite=None`）
   - 測試前端功能
   - 監控 Cloud Run 日誌

3. **前端部署**：
   - 確認 `.env.production` 中 `VITE_API_URL` 設置為完整後端 URL
   - 重新構建並部署前端：`npm run deploy:pages`

---

## 🎓 技術總結

### 為什麼會出現這個問題？

1. **同源策略**（Same-Origin Policy）：
   - 瀏覽器默認阻止跨域 Cookie
   - `localhost:5173` 和 `localhost:4000` 被視為不同的源（端口不同）

2. **SameSite Cookie 屬性**：
   - `Strict`：只在同源請求時發送 Cookie（最嚴格）
   - `Lax`：允許部分跨站請求（導航請求）
   - `None`：允許所有跨站請求（必須配合 `Secure`，即 HTTPS）

3. **CSRF 保護原理**：
   - 使用 Cookie 存儲 Token（`_csrf`）
   - 前端在 Header 中發送相同的 Token（`x-csrf-token`）
   - 後端驗證兩者是否匹配

### 為什麼 Vite 代理可以解決？

1. **統一域名**：
   - 所有請求都通過 `localhost:5173`
   - 瀏覽器認為前後端在同一個源

2. **代理轉發**：
   - Vite 開發服務器接收請求
   - 自動轉發到後端（`localhost:4000`）
   - 後端響應通過代理返回給前端

3. **Cookie 可用**：
   - Cookie 設置在 `localhost:5173`
   - 所有請求都包含此域名的 Cookie
   - CSRF 驗證通過 ✅

### 生產環境為什麼不同？

1. **無法使用代理**：
   - 生產環境前端是靜態文件（Cloudflare Pages）
   - 沒有開發服務器可以做代理

2. **必須直接訪問**：
   - 前端直接請求後端 API（完整 URL）
   - 屬於跨域請求

3. **需要特殊配置**：
   - CORS：允許前端域名
   - Cookie：`SameSite=None` + `Secure=true`
   - HTTPS：生產環境必須

---

## 📚 相關文檔

- [CSRF_FIX_GUIDE.md](CSRF_FIX_GUIDE.md) - 詳細修復指南
- [chat-app/CLAUDE.md](chat-app/CLAUDE.md) - 主應用開發指南
- [chat-app/docs/DEPLOYMENT.md](chat-app/docs/DEPLOYMENT.md) - 部署指南
- [shared/backend-utils/csrfProtection.js](shared/backend-utils/csrfProtection.js) - CSRF 保護實現

---

**最後更新**：2025-11-21
**狀態**：本地開發環境 ✅ | 生產環境 ⏳ 待部署
