# 🔧 CSRF Token 跨域問題修復指南

## 問題總結

**症狀**：
- 本地開發和生產環境都出現 403 Forbidden 錯誤
- 錯誤信息：`請先獲取 CSRF Token` 或 `CSRF Token 驗證失敗`

**根本原因**：
1. **本地開發**：前端（localhost:5173）和後端（localhost:4000）跨端口，Cookie 的 `sameSite` 屬性阻止跨端口訪問
2. **生產環境**：前端（Cloudflare Pages）和後端（Cloud Run）跨域，`sameSite: 'strict'` 阻止跨域 Cookie
3. **生產 CORS 配置**：Cloud Run 的 `CORS_ORIGIN` 還是佔位符，未設置實際前端 URL

## ✅ 已完成的修復

### 1. CSRF Cookie 配置修復

已修改 `shared/backend-utils/csrfProtection.js`：

**開發環境**：
- `sameSite: undefined`（不設置，允許跨端口）
- `secure: false`（HTTP）

**生產環境**：
- `sameSite: 'none'`（允許跨域）
- `secure: true`（HTTPS 必須）

### 2. 本地後端已重啟

本地開發環境的後端已經重啟並應用了新的配置。

## 🚀 待完成的步驟

### 步驟 1：確認前端部署 URL

請確認您的前端實際部署在哪裡：

**選項 A - Cloudflare Pages 默認 URL**：
```
https://chat-app-frontend.pages.dev
```

**選項 B - 自定義域名**：
如果您設置了自定義域名，請使用實際的域名。

**如何查看 Cloudflare Pages URL**：
1. 登入 Cloudflare Dashboard
2. 進入 Workers & Pages → chat-app-frontend
3. 查看 "Deployments" 或 "Custom domains"

### 步驟 2：更新 Cloud Run 環境變數

1. **登入 Google Cloud Console**：
   - 訪問：https://console.cloud.google.com
   - 選擇專案：`chat-app-3-8a7ee`

2. **進入 Cloud Run 服務**：
   - 導航至：Cloud Run
   - 選擇服務：`chat-backend`（或您的後端服務名稱）

3. **編輯環境變數**：
   - 點擊 "EDIT & DEPLOY NEW REVISION"
   - 滾動到 "Variables & Secrets" → "Environment variables"
   - 找到並修改 `CORS_ORIGIN`

4. **設置正確的 CORS_ORIGIN**：

   **如果前端只有一個域名**：
   ```
   CORS_ORIGIN=https://chat-app-frontend.pages.dev
   ```

   **如果前端有多個域名（推薦）**：
   ```
   CORS_ORIGIN=https://chat-app-frontend.pages.dev,https://your-custom-domain.com
   ```

5. **保存並部署**：
   - 點擊 "DEPLOY"
   - 等待新版本部署完成（約 1-2 分鐘）

### 步驟 3：重新部署後端（可選，如果不想手動更新）

如果您使用自動化部署，可以運行：

```bash
# Windows
cd chat-app/backend
deploy-to-cloudrun.bat

# Linux/Mac
cd chat-app/backend
./deploy-cloudrun.sh
```

**注意**：部署前請先更新 `cloud-run-env-vars.txt` 文件中的 `CORS_ORIGIN`。

### 步驟 4：更新本地配置文件（可選，保持一致性）

編輯 `chat-app/backend/cloud-run-env-vars.txt`：

```bash
# 修改第 8 行
CORS_ORIGIN=https://chat-app-frontend.pages.dev
```

### 步驟 5：測試修復

**本地開發環境**：
1. 刷新前端頁面（`Ctrl + Shift + R`）
2. 打開開發者工具 → Application → Cookies
3. 確認有 `_csrf` Cookie
4. 嘗試發送消息

**生產環境**：
1. 等待 Cloud Run 部署完成
2. 訪問前端 URL
3. 強制刷新頁面
4. 清除瀏覽器緩存（可選）
5. 嘗試發送消息

## 🔍 驗證方法

### 檢查 Cookie 是否正確設置

**瀏覽器開發者工具**：
1. 按 F12 打開開發者工具
2. Application → Cookies → 您的前端域名
3. 應該看到 `_csrf` Cookie

**Cookie 屬性檢查**：
- ✅ `HttpOnly`: false（允許 JavaScript 讀取）
- ✅ `Secure`: true（生產環境，HTTPS）
- ✅ `SameSite`: None（生產環境，允許跨域）
- ✅ `Path`: /

### 檢查網絡請求

1. 打開開發者工具 → Network 標籤
2. 嘗試發送消息
3. 查看 POST 請求：
   - ✅ Request Headers 應包含 `x-csrf-token: <token>`
   - ✅ Request Headers 應包含 `Cookie: _csrf=<token>`
   - ✅ 狀態碼應為 200（不是 403）

### 檢查後端日誌

**本地開發**：
- 應該看到正常的請求日誌
- 不應該有 `[CSRF] 請求缺少 CSRF Cookie` 警告

**生產環境（Cloud Run）**：
1. Google Cloud Console → Cloud Run → 您的服務
2. 點擊 "LOGS" 標籤
3. 查看最近的請求日誌

## 🐛 故障排除

### 問題 1：本地開發仍然 403

**解決方法**：
```bash
# 1. 重啟後端
cd chat-app/backend
# 終止當前進程（Ctrl+C）
npm run dev

# 2. 清除瀏覽器緩存
# Chrome: Ctrl+Shift+Delete → 選擇 "Cached images and files" → Clear data

# 3. 強制刷新前端
# Ctrl+Shift+R
```

### 問題 2：生產環境仍然 403

**可能原因**：
1. Cloud Run 環境變數未更新
2. CORS_ORIGIN 設置錯誤
3. 前端域名不匹配

**檢查清單**：
```bash
# 1. 確認 Cloud Run 環境變數
gcloud run services describe chat-backend \
  --region=asia-east1 \
  --format="value(spec.template.spec.containers[0].env)"

# 2. 檢查 CORS_ORIGIN 是否包含前端 URL
# 應該看到類似：
# - name: CORS_ORIGIN
#   value: https://chat-app-frontend.pages.dev

# 3. 檢查前端實際訪問的 URL
# 確保與 CORS_ORIGIN 中的 URL 完全一致（包括協議、端口）
```

### 問題 3：Cookie 未設置

**瀏覽器開發者工具檢查**：
1. Network → 查找 `/api/csrf-token` 請求
2. 查看 Response Headers → 應該有 `Set-Cookie: _csrf=...`
3. 如果沒有，檢查：
   - 後端是否正常運行
   - CORS 配置是否正確
   - 請求是否包含 `credentials: 'include'`

## 📋 配置檢查清單

### 本地開發環境

- [x] `shared/backend-utils/csrfProtection.js` 已修改
- [x] 後端已重啟
- [ ] 前端已刷新
- [ ] 瀏覽器緩存已清除
- [ ] Cookie 已設置

### 生產環境

- [x] `shared/backend-utils/csrfProtection.js` 已修改
- [ ] 確認前端 URL（Cloudflare Pages）
- [ ] 更新 Cloud Run `CORS_ORIGIN` 環境變數
- [ ] Cloud Run 新版本已部署
- [ ] 前端已刷新
- [ ] Cookie 已設置

## 🎯 快速測試命令

### 測試本地 CSRF Token

```bash
# 1. 獲取 CSRF Token
curl -v http://localhost:4000/api/csrf-token

# 應該看到 Set-Cookie: _csrf=...

# 2. 提取 Token 並測試 POST 請求
# （需要手動從上面的響應中複製 Token）
curl -X POST http://localhost:4000/api/conversations/test-user/match-001 \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <從上面複製的 token>" \
  -H "Cookie: _csrf=<從上面複製的 token>" \
  --data '{"message":"測試"}'
```

### 測試生產環境 CSRF Token

```bash
# 替換為實際的前端 URL
curl -v https://chat-backend-412373024299.asia-east1.run.app/api/csrf-token \
  -H "Origin: https://chat-app-frontend.pages.dev"

# 應該看到：
# - HTTP 200
# - Set-Cookie: _csrf=...; SameSite=None; Secure
```

## 💡 注意事項

1. **SameSite=None 要求 HTTPS**：
   - 生產環境必須使用 HTTPS（Cloud Run 默認支持）
   - 開發環境使用 HTTP，所以不設置 `sameSite`

2. **Cookie Domain**：
   - Cookie 不會自動跨域
   - 必須確保 CORS 配置正確
   - 必須在請求中包含 `credentials: 'include'`

3. **瀏覽器兼容性**：
   - `SameSite=None` 在舊版瀏覽器可能不支持
   - 建議測試主流瀏覽器（Chrome, Firefox, Safari, Edge）

## 📞 需要幫助？

如果按照以上步驟操作後仍然有問題，請提供以下信息：

1. **前端部署 URL**：`https://...`
2. **後端 URL**：`https://chat-backend-412373024299.asia-east1.run.app`
3. **錯誤截圖**：瀏覽器開發者工具的 Network 和 Console 標籤
4. **Cookie 狀態**：Application → Cookies 的截圖
5. **Cloud Run 環境變數**：`CORS_ORIGIN` 的值

---

**最後更新**：2025-11-21
**相關文件**：
- `shared/backend-utils/csrfProtection.js` - CSRF 保護實現
- `chat-app/backend/cloud-run-env-vars.txt` - Cloud Run 環境變數
- `chat-app/frontend/src/main.ts` - 前端 CSRF Token 初始化
- `chat-app/frontend/src/utils/api.ts` - API 請求處理
