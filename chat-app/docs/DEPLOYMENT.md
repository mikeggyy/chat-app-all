# 部署指南 - Cloud Run + Firebase Hosting

本指南說明如何將應用程式部署到 Google Cloud Platform。

## 架構概覽

```
使用者請求
    ↓
Firebase Hosting (CDN)
    ├─→ 靜態資源 (HTML, CSS, JS, 圖片) → 直接服務
    └─→ API 請求 (/api/**, /match/**, /auth/**) → 轉發到 Cloud Run
            ↓
        Cloud Run (後端服務)
            ├─→ Firestore (資料庫)
            ├─→ Firebase Auth (身份驗證)
            ├─→ Firebase Storage (檔案儲存)
            ├─→ OpenAI API (AI 對話)
            └─→ Replicate API (圖片生成)
```

## 前置準備

### 1. 安裝必要工具

```bash
# Google Cloud SDK
# 前往 https://cloud.google.com/sdk/docs/install 下載安裝

# Firebase CLI
npm install -g firebase-tools

# 驗證安裝
gcloud --version
firebase --version
```

### 2. 登入帳號

```bash
# 登入 Google Cloud
gcloud auth login

# 登入 Firebase
firebase login
```

### 3. 建立 GCP 專案

```bash
# 在 Google Cloud Console 建立新專案
# https://console.cloud.google.com/projectcreate

# 或使用 CLI
gcloud projects create your-project-id --name="Chat App"

# 設置當前專案
gcloud config set project your-project-id

# 啟用計費（必須）
# https://console.cloud.google.com/billing
```

### 4. 初始化 Firebase 專案

```bash
# 在專案根目錄執行
firebase init

# 選擇以下功能：
# - Firestore
# - Hosting
# - Storage
# - Emulators

# 選擇剛才建立的 GCP 專案
```

## 部署步驟

### 第一步：部署後端到 Cloud Run

#### 1. 修改部署腳本配置

編輯 `backend/deploy-cloudrun.sh`：

```bash
# 修改這些變數
PROJECT_ID="your-project-id"              # 替換為您的 GCP 專案 ID
SERVICE_NAME="chat-backend"               # Cloud Run 服務名稱
REGION="asia-east1"                       # 台灣區域
```

#### 2. 執行部署

```bash
cd backend

# 給予執行權限（Linux/Mac）
chmod +x deploy-cloudrun.sh

# 執行部署
./deploy-cloudrun.sh

# Windows 用戶可以手動執行命令：
gcloud builds submit --tag gcr.io/your-project-id/chat-backend
gcloud run deploy chat-backend \
  --image gcr.io/your-project-id/chat-backend \
  --platform managed \
  --region asia-east1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10
```

#### 3. 設置環境變數

在 [Cloud Run 控制台](https://console.cloud.google.com/run) 設置以下環境變數：

**必要變數**：
```
NODE_ENV=production
PORT=8080
USE_FIREBASE_EMULATOR=false
CORS_ORIGIN=https://your-project-id.web.app

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----

# AI API Keys
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...
```

**建議使用 Secret Manager**（更安全）：

```bash
# 創建 Secret
echo -n "sk-your-openai-key" | gcloud secrets create openai-api-key --data-file=-

# 授權 Cloud Run 訪問
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:your-project-number-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 在 Cloud Run 控制台將 Secret 綁定到環境變數
```

#### 4. 獲取後端 URL

```bash
gcloud run services describe chat-backend \
  --region asia-east1 \
  --format 'value(status.url)'

# 輸出範例：https://chat-backend-xxxxxxxxxx-de.a.run.app
```

### 第二步：構建並部署前端

#### 1. 更新前端環境變數

編輯 `frontend/.env.production`：

```env
# API URL（使用 Cloud Run URL 或保持為空讓 Firebase 代理）
VITE_API_URL=

# Firebase 配置（從 Firebase Console 複製）
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# 關閉模擬器
VITE_USE_EMULATOR=false
```

#### 2. 構建前端

```bash
cd frontend
npm run build

# 驗證 dist 目錄已生成
ls dist/
```

#### 3. 部署到 Firebase Hosting

```bash
# 從專案根目錄執行
firebase deploy --only hosting

# 或部署所有資源（Firestore rules, Storage rules）
firebase deploy
```

#### 4. 訪問應用

```bash
# 部署完成後會顯示 URL
# Hosting URL: https://your-project-id.web.app
```

## 驗證部署

### 1. 檢查後端健康狀態

```bash
curl https://chat-backend-xxxxxxxxxx-de.a.run.app/health
# 應返回: {"status":"ok"}
```

### 2. 檢查 API 代理

```bash
curl https://your-project-id.web.app/api/welcome
# 應返回: {"message":"Welcome to the chat app API scaffold."}
```

### 3. 測試完整流程

1. 訪問 `https://your-project-id.web.app`
2. 使用 Google 登入
3. 測試對話功能
4. 測試圖片生成功能
5. 檢查 Firestore 資料是否正確寫入

## 監控與日誌

### Cloud Run 日誌

```bash
# 查看日誌
gcloud run services logs read chat-backend \
  --region asia-east1 \
  --limit 50

# 即時查看日誌
gcloud run services logs tail chat-backend --region asia-east1
```

### Firebase Hosting 流量

- 訪問 [Firebase Console](https://console.firebase.google.com/)
- 進入 Hosting → Usage 查看流量統計

### 成本監控

```bash
# 查看當前費用
gcloud billing accounts list

# 設置預算警報（建議）
# https://console.cloud.google.com/billing/budgets
```

## 更新部署

### 更新後端

```bash
cd backend
./deploy-cloudrun.sh
```

### 更新前端

```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

### 僅更新 Firestore Rules

```bash
firebase deploy --only firestore:rules
```

## 回滾

### 回滾 Cloud Run

```bash
# 列出所有版本
gcloud run revisions list --service chat-backend --region asia-east1

# 回滾到特定版本
gcloud run services update-traffic chat-backend \
  --region asia-east1 \
  --to-revisions chat-backend-00001-abc=100
```

### 回滾 Firebase Hosting

```bash
# 查看歷史版本
firebase hosting:channel:list

# 回滾
firebase hosting:rollback
```

## 成本優化建議

### 1. Cloud Run 優化

```bash
# 設置最小實例為 0（無流量時不計費）
gcloud run services update chat-backend \
  --min-instances 0 \
  --region asia-east1

# 啟用 CPU 節流
gcloud run services update chat-backend \
  --cpu-throttling \
  --region asia-east1
```

### 2. Firestore 優化

- 減少讀取次數：使用 Cloud Run 記憶體快取
- 使用批次操作：多筆寫入合併為一個 batch
- 舊對話歷史考慮遷移到 Cloud Storage

### 3. 圖片優化

- 繼續使用 WebP 壓縮
- 考慮使用 Cloud Storage 儲存生成的圖片
- 設置 CDN 快取

## 疑難排解

### 問題：部署後 API 返回 404

**解決方案**：
1. 檢查 `firebase.json` 中的 `serviceId` 是否正確
2. 確認 Cloud Run 服務已允許未經身份驗證的訪問
3. 檢查 Cloud Run 日誌查看錯誤訊息

### 問題：CORS 錯誤

**解決方案**：
1. 在 Cloud Run 設置 `CORS_ORIGIN` 環境變數
2. 包含 Firebase Hosting 域名：`https://your-project-id.web.app`

### 問題：環境變數未生效

**解決方案**：
1. 確認已在 Cloud Run 控制台設置環境變數
2. 重新部署服務使變更生效
3. 檢查變數名稱是否正確（區分大小寫）

### 問題：成本過高

**解決方案**：
1. 檢查是否設置 `min-instances=0`
2. 啟用 CPU 節流
3. 檢查 Firestore 讀寫次數
4. 設置預算警報

## 安全性建議

### 1. 設置 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 用戶只能讀寫自己的資料
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // 角色資料為公開讀取
    match /characters/{characterId} {
      allow read: if true;
      allow write: if false;  // 僅後端可寫入
    }
  }
}
```

### 2. 設置 Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /user-uploads/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 3. 啟用 Cloud Armor（DDoS 防護）

```bash
# 為 Cloud Run 設置防火牆規則
# https://cloud.google.com/armor/docs/configure-security-policies
```

## 效能優化

### 1. 啟用 CDN

Firebase Hosting 預設已啟用 CDN，確保靜態資源有正確的快取標頭（已在 `firebase.json` 設置）。

### 2. 圖片優化

- 使用 WebP 格式（已實現）
- 設置適當的圖片尺寸
- 考慮使用 Cloud CDN

### 3. 程式碼分割

前端已使用 Vite 自動進行程式碼分割，確保：
- 路由級別的懶載入
- 第三方庫分離到 vendor chunk

## 相關連結

- [Google Cloud Console](https://console.cloud.google.com/)
- [Firebase Console](https://console.firebase.google.com/)
- [Cloud Run 文檔](https://cloud.google.com/run/docs)
- [Firebase Hosting 文檔](https://firebase.google.com/docs/hosting)
- [Firestore 文檔](https://firebase.google.com/docs/firestore)
- [價格計算器](https://cloud.google.com/products/calculator)

## 支援

如遇到問題，請參考：
1. Cloud Run 日誌
2. Firebase Console 中的錯誤報告
3. Google Cloud 支援論壇
