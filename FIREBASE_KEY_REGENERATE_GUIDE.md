# Firebase Service Account Key 重新生成指南

## 問題
當前 Service Account 缺少必要的權限導致 Firebase Auth 驗證失敗。

## 解決方案：重新生成 Service Account Key

### 步驟 1：訪問 Firebase Service Accounts 頁面

打開以下網址：

https://console.firebase.google.com/project/chat-app-3-8a7ee/settings/serviceaccounts/adminsdk

### 步驟 2：生成新的私鑰

1. 在頁面中找到 **"Firebase Admin SDK"** 區塊
2. 點擊 **「產生新的私密金鑰」** 或 **"Generate new private key"** 按鈕
3. 在彈出的確認對話框中點擊 **「產生金鑰」**
4. 系統會自動下載一個 JSON 文件（類似 `chat-app-3-8a7ee-firebase-adminsdk-xxxxx.json`）

### 步驟 3：提取必要信息

打開下載的 JSON 文件，找到以下三個欄位：

```json
{
  "type": "service_account",
  "project_id": "chat-app-3-8a7ee",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@chat-app-3-8a7ee.iam.gserviceaccount.com",
  ...
}
```

需要的欄位：
- `project_id` → FIREBASE_ADMIN_PROJECT_ID
- `client_email` → FIREBASE_ADMIN_CLIENT_EMAIL
- `private_key` → FIREBASE_ADMIN_PRIVATE_KEY

### 步驟 4：更新後端 .env 文件

編輯 `chat-app/backend/.env`：

```env
# 更新這三個值
FIREBASE_ADMIN_PROJECT_ID=chat-app-3-8a7ee
FIREBASE_ADMIN_CLIENT_EMAIL=<從 JSON 複製 client_email>
FIREBASE_ADMIN_PRIVATE_KEY="<從 JSON 複製 private_key，包含引號>"
```

⚠️ **重要提示**：
- `FIREBASE_ADMIN_PRIVATE_KEY` 的值必須包含 `\n` 換行符
- 整個值必須用雙引號包裹
- 格式應該像這樣：`"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`

### 步驟 5：重啟後端服務

```bash
cd d:\project\chat-app-all\chat-app\backend

# 停止現有服務（Ctrl+C）

# 重新啟動
npm run dev
```

### 步驟 6：驗證修復

1. 觀察後端啟動日誌，確認沒有 Firebase 相關錯誤
2. 回到前端頁面刷新（F5）
3. 重新登入並測試

### 步驟 7：安全清理

⚠️ **重要安全提醒**：

1. **刪除下載的 JSON 文件**（已經提取了需要的信息）
2. **不要將 JSON 文件提交到 Git**
3. **確保 .env 文件在 .gitignore 中**

## 如果還是失敗

如果重新生成 key 後仍然失敗，可能需要：

1. **啟用 Identity Toolkit API**：
   https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=chat-app-3-8a7ee

2. **檢查計費帳戶**：
   確認 Firebase 專案已經關聯有效的計費帳戶

3. **聯繫專案管理員**：
   可能需要更高權限的帳戶來設置正確的 IAM 權限

## 疑難排解

### 問題：Private key 格式錯誤

如果遇到 "Invalid private key" 錯誤，檢查：

```env
# ❌ 錯誤格式（沒有引號）
FIREBASE_ADMIN_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...

# ❌ 錯誤格式（沒有 \n）
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"

# ✅ 正確格式
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
```

### 問題：環境變數未加載

確認 backend 目錄下的 .env 文件存在且格式正確：

```bash
cd d:\project\chat-app-all\chat-app\backend
node scripts/test-env-at-runtime.js
```

應該看到所有必要的環境變數都已設置。

## 完成

重新生成 Service Account key 後，系統應該可以正常驗證 Firebase tokens 了。
