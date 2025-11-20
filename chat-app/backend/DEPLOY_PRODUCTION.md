# 🚀 生產環境緊急部署指南（明天 Demo）

## ⏰ 預計時間：5-7 分鐘

---

## 方法一：使用 Cloud Console（推薦，最可靠）

### 1. 打開 Cloud Console 並啟動 Cloud Shell

1. 訪問：https://console.cloud.google.com/run?project=chat-app-3-8a7ee
2. 點擊右上角的 **Cloud Shell** 圖標（`>_`）
3. 等待 Cloud Shell 啟動

### 2. 上傳修改的文件

在 Cloud Shell 中，點擊右上角的 **"⋮"** → **"Upload"**

上傳這個文件：
```
d:\project\chat-app-all\shared\backend-utils\csrfProtection.js
```

上傳後，文件會在 `~` 目錄。

### 3. 克隆或下載現有代碼

**選項 A - 如果代碼在 GitHub**：
```bash
git clone YOUR_GITHUB_REPO_URL
cd YOUR_REPO
```

**選項 B - 從 Cloud Run 下載現有代碼**：
```bash
# 創建工作目錄
mkdir -p ~/backend-deploy
cd ~/backend-deploy

# 下載現有服務的源代碼（如果有）
# 或者手動創建必要的文件結構
```

**選項 C - 最簡單：只部署修改的文件**：

我們可以創建一個最小化的 Docker 部署，只更新修改的文件。

```bash
# 1. 創建工作目錄
mkdir -p ~/csrf-fix
cd ~/csrf-fix

# 2. 移動上傳的文件
mkdir -p shared/backend-utils
mv ~/csrfProtection.js shared/backend-utils/

# 3. 創建 Dockerfile
cat > Dockerfile << 'EOF'
FROM gcr.io/chat-app-3-8a7ee/chat-backend:latest

# 只替換修改的文件
COPY shared/backend-utils/csrfProtection.js /app/shared/backend-utils/csrfProtection.js

EOF

# 4. 構建新映像
gcloud builds submit --tag gcr.io/chat-app-3-8a7ee/chat-backend .

# 5. 部署到 Cloud Run
gcloud run deploy chat-backend \
  --image gcr.io/chat-app-3-8a7ee/chat-backend \
  --region asia-east1 \
  --project chat-app-3-8a7ee \
  --platform managed
```

---

## 方法二：直接修改環境（最快，但不推薦長期使用）

如果上述方法太複雜，可以**臨時禁用 CSRF 保護**，demo 後再正式部署。

### 在 Cloud Run 控制台：

1. 訪問：https://console.cloud.google.com/run/detail/asia-east1/chat-backend?project=chat-app-3-8a7ee
2. 點擊 **"EDIT & DEPLOY NEW REVISION"**
3. **Container** → **Variables & Secrets** → **Environment variables**
4. 添加環境變數：
   ```
   Name: DISABLE_CSRF
   Value: true
   ```
5. 點擊 **"DEPLOY"**（1-2 分鐘）

然後修改後端代碼（本地或 Cloud Shell）：

**文件**：`chat-app/backend/src/index.js`（第 160-175 行）

**修改前**：
```javascript
app.use((req, res, next) => {
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/test-session',
  ];

  const isPublicPath = publicPaths.some(path => req.path.startsWith(path));
  const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);

  if (isWriteMethod && !isPublicPath) {
    return csrfProtection()(req, res, next);
  }

  next();
});
```

**修改後**：
```javascript
app.use((req, res, next) => {
  // ⚠️ 臨時：允許通過環境變數禁用 CSRF（僅用於緊急情況）
  if (process.env.DISABLE_CSRF === 'true') {
    logger.warn('[CSRF] ⚠️ CSRF 保護已禁用（DISABLE_CSRF=true）');
    return next();
  }

  const publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/test-session',
  ];

  const isPublicPath = publicPaths.some(path => req.path.startsWith(path));
  const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);

  if (isWriteMethod && !isPublicPath) {
    return csrfProtection()(req, res, next);
  }

  next();
});
```

---

## 🧪 快速驗證

部署完成後（1-2 分鐘），立即測試：

### 1. 訪問前端

```
https://chat-app-all.pages.dev
```

### 2. 清除瀏覽器緩存

按 `Ctrl + Shift + Delete` → 清除 Cookie 和緩存

### 3. 測試發送消息

選擇一個角色，發送測試消息。

**預期結果**：
- ✅ 消息成功發送
- ✅ 收到 AI 回覆
- ✅ 沒有 403 錯誤

---

## 🔍 如果還是失敗

### 檢查後端日誌

1. Cloud Console → Cloud Run → chat-backend → **LOGS**
2. 查找錯誤信息
3. 告訴我具體的錯誤，我立即幫您解決

### 緊急聯絡

如果遇到任何問題，立即告訴我：
1. 錯誤截圖
2. 後端日誌
3. 我會在 5 分鐘內提供解決方案

---

## 📝 Demo 前檢查清單

- [ ] 生產環境可以發送消息
- [ ] 生產環境可以接收 AI 回覆
- [ ] 沒有 403 Forbidden 錯誤
- [ ] 其他核心功能正常（登入、角色選擇等）

---

**現在立即開始！我會隨時待命幫助您解決任何問題。加油！** 🚀
