# Cloudflare R2 CORS 設置指南

## 問題描述

當前 R2 Bucket (`lovstory-videos`) 缺少 CORS 配置，導致：
- ❌ 影片無法在前端播放 (`ERR_CONNECTION_RESET`)
- ❌ 禮物照片下載失敗 (`DOWNLOAD_FAILED`)

## 解決方案：設置 R2 CORS

### 1. 登入 Cloudflare Dashboard

訪問：https://dash.cloudflare.com/

### 2. 進入 R2 設置

1. 左側選單選擇 **R2**
2. 找到您的 Bucket：`lovstory-videos`
3. 點擊 Bucket 名稱進入設置頁面

### 3. 配置 CORS 規則

在 Bucket 設置頁面：

1. 找到 **CORS Policy** 或 **Settings** → **CORS** 標籤
2. 點擊 **Edit CORS Policy** 或 **Add CORS Rule**
3. 添加以下 CORS 規則：

#### 方案 A：開發 + 生產環境（推薦）

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "https://your-production-domain.com"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT",
      "POST"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

#### 方案 B：僅開發環境（快速測試）

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

⚠️ **警告**: 方案 B 允許所有來源訪問，僅用於開發測試，生產環境請使用方案 A

### 4. 保存設置

點擊 **Save** 或 **Update CORS Policy**

### 5. 驗證 CORS 設置

等待 1-2 分鐘讓設置生效，然後測試：

#### 方法 1：瀏覽器開發者工具

1. 打開前端應用：http://127.0.0.1:5173
2. 生成一個影片或照片
3. 打開瀏覽器 DevTools (F12) → Network 標籤
4. 查看影片/圖片請求：
   - ✅ 成功：狀態碼 200，能正常播放
   - ❌ 失敗：`ERR_CONNECTION_RESET` 或 CORS 錯誤

#### 方法 2：命令行測試

```bash
# 測試影片 URL（替換為實際的影片 URL）
curl -I https://pub-5187f353f7054fb9822594d3416854ea.r2.dev/videos/test.mp4

# 測試 CORS（從瀏覽器來源）
curl -I -H "Origin: http://127.0.0.1:5173" \
  -H "Access-Control-Request-Method: GET" \
  https://pub-5187f353f7054fb9822594d3416854ea.r2.dev/videos/test.mp4
```

**預期結果**:
```
HTTP/2 200
access-control-allow-origin: http://127.0.0.1:5173
access-control-allow-methods: GET, HEAD
access-control-max-age: 3600
...
```

## 常見問題排查

### Q1: CORS 設置後仍無法訪問

**解決方案**:
1. 清除瀏覽器快取 (Ctrl+Shift+Delete)
2. 等待 5-10 分鐘讓 CDN 快取過期
3. 使用無痕模式 (Ctrl+Shift+N) 測試

### Q2: 找不到 CORS 設置選項

**解決方案**:
- Cloudflare R2 UI 可能在更新，CORS 設置可能在：
  - Bucket 詳情頁 → **Settings** 標籤
  - Bucket 詳情頁 → **Access** 標籤
  - 或使用 Wrangler CLI 配置（見下方）

### Q3: 使用 Wrangler CLI 配置 CORS

如果 UI 找不到 CORS 設置，可使用命令行：

```bash
# 安裝 Wrangler
npm install -g wrangler

# 登入 Cloudflare
wrangler login

# 創建 CORS 配置文件
cat > cors.json << 'EOF'
[
  {
    "AllowedOrigins": ["http://127.0.0.1:5173", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
EOF

# 應用 CORS 配置
wrangler r2 bucket cors put lovstory-videos --file cors.json

# 驗證配置
wrangler r2 bucket cors get lovstory-videos
```

## 額外配置（可選）

### 設置自定義域名

如果您有自己的域名，可以設置自定義域名：

1. Cloudflare Dashboard → R2 → Bucket 設置
2. 找到 **Custom Domains** 或 **Public Access**
3. 添加自定義域名（如 `cdn.yourapp.com`）
4. 更新 `.env` 的 `R2_PUBLIC_URL`：
   ```env
   R2_PUBLIC_URL=https://cdn.yourapp.com
   ```

### 設置快取控制

已在代碼中設置：
```javascript
CacheControl: "public, max-age=31536000" // 1 年快取
```

這樣影片和圖片會被 CDN 快取，加快訪問速度。

## 參考資源

- [Cloudflare R2 CORS 文檔](https://developers.cloudflare.com/r2/api/s3/api/#cors)
- [Wrangler CLI 文檔](https://developers.cloudflare.com/workers/wrangler/)
- [CORS 標準說明](https://developer.mozilla.org/zh-TW/docs/Web/HTTP/CORS)
