# Cloudflare R2 公開訪問 + CORS 完整設置指南

## 🎯 目標

讓您的 R2 Bucket (`lovstory-videos`) 可以：
1. ✅ 公開訪問（任何人都能看到影片/圖片）
2. ✅ CORS 正確配置（前端可以載入資源）

---

## 📋 **完整設置步驟**

### **步驟 1: 登入 Cloudflare Dashboard**

1. 打開瀏覽器
2. 訪問：https://dash.cloudflare.com/
3. 輸入您的 Email 和密碼登入

---

### **步驟 2: 進入 R2 管理介面**

1. 登入後，在**左側選單**找到 **R2** 圖標（雲朵圖標 ☁️）
2. 點擊 **R2**
3. 您會看到 Bucket 列表

---

### **步驟 3: 選擇您的 Bucket**

1. 找到名為 **`lovstory-videos`** 的 Bucket
2. **點擊** Bucket 名稱（不是右側的按鈕）
3. 進入 Bucket 詳情頁面

---

### **步驟 4: 啟用公開訪問（最重要！）**

在 Bucket 詳情頁面，您會看到幾個標籤（Settings, Objects, Access 等）。

#### **方法 A: 使用 Settings 標籤**

1. 點擊頂部的 **Settings** 標籤
2. 向下滾動找到 **Public Access** 或 **R2.dev subdomain** 區塊
3. 您會看到類似這樣的文字：
   ```
   Public access via R2.dev subdomain
   Currently: Not allowed
   ```
4. 點擊 **Allow Access** 按鈕
5. 系統會顯示一個確認對話框，點擊 **Allow**
6. 成功後，會顯示您的公開 URL：
   ```
   https://pub-xxxxx.r2.dev
   ```
7. **複製這個 URL**，待會要用

#### **方法 B: 使用 Custom Domains（進階）**

如果您有自己的域名：

1. 在 Settings 標籤找到 **Custom Domains** 區塊
2. 點擊 **Connect Domain**
3. 輸入您的域名（如 `cdn.yourapp.com`）
4. 按照提示設置 DNS 記錄
5. 等待域名生效（可能需要幾分鐘）

---

### **步驟 5: 設置 CORS 規則**

**注意**: CORS 設置可能在不同的位置，請嘗試以下方法：

#### **方法 5A: 在 Settings 標籤設置 CORS**

1. 還是在 **Settings** 標籤
2. 繼續向下滾動，找到 **CORS Policy** 區塊
3. 點擊 **Edit** 或 **Configure CORS** 按鈕
4. 將以下 JSON 配置**完整複製貼上**：

```json
[
  {
    "AllowedOrigins": [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:5174",
      "http://localhost:5174",
      "http://192.168.1.107:5173"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT"
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

5. 點擊 **Save** 或 **Update CORS Policy**

#### **方法 5B: 找不到 CORS 設置？使用命令行**

如果 UI 找不到 CORS 設置，使用命令行：

**Windows PowerShell / CMD:**
```powershell
# 1. 安裝 Wrangler（Cloudflare CLI）
npm install -g wrangler

# 2. 登入 Cloudflare
wrangler login

# 3. 應用 CORS 配置
cd chat-app
wrangler r2 bucket cors put lovstory-videos --file cors-config.json

# 4. 驗證配置
wrangler r2 bucket cors get lovstory-videos
```

---

### **步驟 6: 更新 .env 配置（如果公開 URL 變了）**

如果步驟 4 生成的公開 URL 與目前的不同，請更新 `.env` 文件：

1. 打開 `chat-app/backend/.env`
2. 找到 `R2_PUBLIC_URL` 這一行
3. 替換為新的 URL：
   ```env
   R2_PUBLIC_URL=https://pub-新的ID.r2.dev
   ```
4. **保存文件**
5. **重啟後端服務**

---

### **步驟 7: 驗證設置**

#### **7A. 在瀏覽器測試**

1. 複製您的 R2 公開 URL（如 `https://pub-xxxxx.r2.dev`）
2. 在瀏覽器地址欄貼上
3. 按 Enter

**預期結果**:
- ✅ 顯示 XML 格式的 Bucket 列表，或
- ✅ 顯示 404（表示 Bucket 存在但是空的）

**錯誤結果**:
- ❌ 連接超時或拒絕連接
- ❌ 顯示 "Access Denied"
- → 表示公開訪問未啟用，回到步驟 4

#### **7B. 使用測試腳本**

重新運行測試：

```bash
cd chat-app
node scripts/test-r2-connectivity.js
```

**預期輸出**:
```
🧪 Cloudflare R2 連接性測試

1️⃣ 測試基本連接...
   ✅ 狀態: 200 OK
   ✅ R2 端點可訪問

2️⃣ 測試 CORS 配置...
   ✅ Origin: http://127.0.0.1:5173
      - Allow-Origin: http://127.0.0.1:5173
      - Allow-Methods: GET, HEAD
      - Max-Age: 3600

✅ 所有測試通過！
```

#### **7C. 測試實際功能**

1. 打開前端應用：http://127.0.0.1:5173
2. 清除瀏覽器快取（Ctrl+Shift+Delete）
3. 重新整理頁面（F5）
4. 測試生成影片：
   - 選擇一個角色
   - 點擊生成影片
   - **等待影片生成完成**
   - 查看影片是否能正常播放

5. 測試禮物照片：
   - 送一個帶照片的禮物
   - 查看照片是否正常顯示

---

## 🚨 **常見問題排查**

### **Q1: 找不到 "Allow Access" 按鈕**

**可能原因**: Cloudflare 界面版本不同

**解決方案**:
1. 檢查所有標籤（Settings, Access, Configuration）
2. 尋找這些關鍵字：
   - "Public Access"
   - "R2.dev subdomain"
   - "Allow Access"
   - "Enable public access"
3. 如果真的找不到，使用命令行（見方法 5B）

---

### **Q2: CORS 設置後仍然失敗**

**原因**: CDN 快取未更新

**解決方案**:
1. 等待 5-10 分鐘
2. 清除瀏覽器快取（Ctrl+Shift+Delete）
3. 使用無痕模式測試（Ctrl+Shift+N）
4. 確認 R2_PUBLIC_URL 配置正確

---

### **Q3: 影片上傳成功但無法播放**

**診斷步驟**:

1. **檢查影片 URL**:
   - 打開瀏覽器開發者工具（F12）
   - 切換到 Network 標籤
   - 找到影片請求（`.mp4` 結尾）
   - 查看 HTTP 狀態碼

2. **狀態碼含義**:
   - `200 OK` → CORS 配置正確，影片可播放 ✅
   - `403 Forbidden` → 公開訪問未啟用，回到步驟 4 ❌
   - `404 Not Found` → 影片文件不存在 ❌
   - `ERR_CONNECTION_RESET` → CORS 配置缺失，回到步驟 5 ❌

---

### **Q4: 如何確認 CORS 已生效？**

**方法 1: 瀏覽器開發者工具**

1. 打開前端應用
2. F12 打開開發者工具
3. 切換到 **Console** 標籤
4. 貼上並執行：

```javascript
fetch('https://pub-5187f353f7054fb9822594d3416854ea.r2.dev', {
  method: 'HEAD',
  headers: { 'Origin': 'http://127.0.0.1:5173' }
})
.then(res => {
  console.log('✅ CORS Allow-Origin:', res.headers.get('access-control-allow-origin'));
  console.log('✅ CORS Allow-Methods:', res.headers.get('access-control-allow-methods'));
})
.catch(err => {
  console.error('❌ CORS 錯誤:', err.message);
});
```

**方法 2: 命令行測試（Windows PowerShell）**

```powershell
curl -I -H "Origin: http://127.0.0.1:5173" https://pub-5187f353f7054fb9822594d3416854ea.r2.dev
```

查看輸出中是否有：
```
access-control-allow-origin: http://127.0.0.1:5173
```

---

## 📸 **完成後的檢查清單**

- [ ] ✅ R2 Bucket 已啟用公開訪問
- [ ] ✅ 瀏覽器能訪問 R2_PUBLIC_URL
- [ ] ✅ CORS 規則已設置
- [ ] ✅ `.env` 中的 `R2_PUBLIC_URL` 正確
- [ ] ✅ 後端服務已重啟
- [ ] ✅ 前端瀏覽器快取已清除
- [ ] ✅ 測試腳本顯示「所有測試通過」
- [ ] ✅ 影片能正常播放
- [ ] ✅ 禮物照片能正常顯示

---

## 🎉 **完成！**

如果所有檢查清單都打勾了，恭喜您！R2 已正確配置。

如果仍有問題，請提供：
1. 測試腳本的完整輸出
2. 瀏覽器開發者工具的錯誤訊息（Console 和 Network 標籤）
3. R2_PUBLIC_URL 的值

我會幫您進一步診斷。
