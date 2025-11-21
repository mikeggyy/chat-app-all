# ⚡ 快速部署步驟 - 3 種方案任選

## 方案 A：直接設置環境變數（最快 - 1 分鐘）✅ 推薦

**不需要重新部署代碼**，直接在 Cloud Run 控制台設置環境變數即可。

### 步驟：

1. **訪問 Cloud Run 控制台**：
   ```
   https://console.cloud.google.com/run/detail/asia-east1/chat-backend?project=chat-app-3-8a7ee
   ```

2. **點擊頂部「EDIT & DEPLOY NEW REVISION」**

3. **向下滾動到「Container」→「Variables & Secrets」**

4. **添加環境變數**：
   - 點擊「+ ADD VARIABLE」
   - Name: `DISABLE_CSRF`
   - Value: `true`

5. **檢查 CORS_ORIGIN**（如果沒有就添加）：
   - Name: `CORS_ORIGIN`
   - Value: `https://chat-app-all.pages.dev`

6. **點擊底部「DEPLOY」**，等待 1-2 分鐘

7. **測試**：
   - 訪問 https://chat-app-all.pages.dev
   - 清除瀏覽器緩存（Ctrl + Shift + Delete）
   - 發送測試消息

---

## 方案 B：使用 Cloud Shell 部署新代碼（5 分鐘）

如果想部署完整的 CSRF 修復（推薦長期使用）。

### 步驟：

1. **打開 Cloud Console**：
   ```
   https://console.cloud.google.com/?project=chat-app-3-8a7ee
   ```

2. **點擊右上角 Cloud Shell 圖標（`>_`）**

3. **在 Cloud Shell 中執行**：
   ```bash
   # 克隆代碼（如果有 GitHub repo）
   git clone YOUR_GITHUB_REPO_URL
   cd YOUR_REPO/chat-app/backend

   # 或者上傳修改的文件
   # 點擊 Cloud Shell 右上角「⋮」→「Upload」
   # 上傳這兩個文件：
   # - chat-app/backend/src/index.js
   # - shared/backend-utils/csrfProtection.js
   ```

4. **構建並部署**：
   ```bash
   gcloud builds submit --config=cloudbuild.yaml . --project=chat-app-3-8a7ee

   gcloud run deploy chat-backend \
     --image gcr.io/chat-app-3-8a7ee/chat-backend \
     --region asia-east1 \
     --project=chat-app-3-8a7ee \
     --platform managed
   ```

5. **設置環境變數**（在 Cloud Run 控制台）：
   - `CORS_ORIGIN=https://chat-app-all.pages.dev`

---

## 方案 C：本地部署（需要 gcloud 配置）

如果本地已經配置好 gcloud：

```bash
# 在 chat-app/backend 目錄下執行
cd d:\project\chat-app-all\chat-app\backend

# 登入 GCP
gcloud auth login

# 設置專案
gcloud config set project chat-app-3-8a7ee

# 構建並部署
gcloud builds submit --config=cloudbuild.yaml .

gcloud run deploy chat-backend \
  --image gcr.io/chat-app-3-8a7ee/chat-backend \
  --region asia-east1 \
  --platform managed
```

---

## ✅ 驗證部署成功

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

1. **Cloud Run 控制台**：
   ```
   https://console.cloud.google.com/run/detail/asia-east1/chat-backend?project=chat-app-3-8a7ee
   ```

2. **點擊「LOGS」標籤**

3. **查找錯誤訊息**，例如：
   - CSRF 相關錯誤
   - CORS 錯誤
   - 其他異常

4. **截圖發給我，我立即幫你解決**

---

## 📝 重要提醒

- **方案 A** 是緊急臨時方案，Demo 後建議使用方案 B 部署完整修復
- **DISABLE_CSRF=true** 會禁用 CSRF 保護，僅用於緊急情況
- Demo 成功後請儘快移除 `DISABLE_CSRF` 環境變數並部署正式修復

---

**現在立即選擇一個方案開始部署！** 🚀

推薦：**先用方案 A 確保明天 Demo 順利**，Demo 後再用方案 B 部署完整修復。
