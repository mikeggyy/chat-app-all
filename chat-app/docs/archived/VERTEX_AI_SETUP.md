# Vertex AI 設置指南

本指南說明如何設置 Google Cloud Vertex AI 以使用 Veo 影片生成功能。

## 目錄

- [前置要求](#前置要求)
- [步驟 1：創建 Google Cloud 專案](#步驟-1創建-google-cloud-專案)
- [步驟 2：啟用必要的 API](#步驟-2啟用必要的-api)
- [步驟 3：創建服務帳號](#步驟-3創建服務帳號)
- [步驟 4：設置環境變數](#步驟-4設置環境變數)
- [步驟 5：測試配置](#步驟-5測試配置)
- [常見問題](#常見問題)
- [定價資訊](#定價資訊)

---

## 前置要求

- Google Cloud 帳號（需要信用卡驗證）
- 已安裝 `@google-cloud/vertexai` SDK（已在 `npm install` 時安裝）
- 對 Google Cloud 控制台有基本了解

---

## 步驟 1：創建 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點擊頂部的「選擇專案」下拉選單
3. 點擊「新增專案」
4. 輸入專案名稱（例如：`my-veo-video-app`）
5. 選擇帳單帳戶（如果沒有，需要先創建一個）
6. 點擊「建立」

**記錄您的專案 ID**（例如：`my-veo-video-app-123456`），稍後會用到。

---

## 步驟 2：啟用必要的 API

### 2.1 啟用 Vertex AI API

1. 在 Google Cloud Console 中，前往 [API 與服務 > 資料庫](https://console.cloud.google.com/apis/library)
2. 搜尋 "Vertex AI API"
3. 點擊「啟用」

### 2.2 啟用 Generative AI API

1. 搜尋 "Generative Language API" 或 "Generative AI API"
2. 點擊「啟用」

### 2.3 檢查 Veo 模型可用性

**重要**：Veo 3.1 模型可能需要特殊存取權限或在某些區域不可用。

1. 前往 [Vertex AI Studio](https://console.cloud.google.com/vertex-ai/generative/multimodal/create/video)
2. 確認您可以看到影片生成選項
3. 如果看到「申請存取權限」的訊息，請按照說明申請

支援的區域：
- `us-central1`（美國中部）
- `europe-west4`（荷蘭）
- `asia-southeast1`（新加坡）

---

## 步驟 3：創建服務帳號

服務帳號用於在您的應用程式中驗證 Vertex AI API。

### 3.1 創建服務帳號

1. 前往 [IAM 與管理 > 服務帳號](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. 點擊「建立服務帳號」
3. 輸入服務帳號名稱（例如：`veo-video-generator`）
4. 輸入描述（例如：「用於 Veo 影片生成功能」）
5. 點擊「建立並繼續」

### 3.2 授予權限

為服務帳號授予以下角色：

- **Vertex AI User** (`roles/aiplatform.user`)
- **Service Account Token Creator** (`roles/iam.serviceAccountTokenCreator`)（可選，用於進階功能）

步驟：
1. 在「授予此服務帳號存取專案的權限」區段
2. 點擊「選取角色」
3. 搜尋並選擇「Vertex AI User」
4. 點擊「繼續」
5. 點擊「完成」

### 3.3 創建金鑰

1. 在服務帳號列表中，找到剛創建的服務帳號
2. 點擊服務帳號名稱進入詳細資訊頁面
3. 切換到「金鑰」分頁
4. 點擊「新增金鑰」>「建立新金鑰」
5. 選擇金鑰類型為「JSON」
6. 點擊「建立」

**重要**：
- JSON 金鑰檔案會自動下載到您的電腦
- 請妥善保管此檔案，不要將其提交到 Git 儲存庫
- 建議將金鑰檔案命名為 `google-cloud-service-account.json`

---

## 步驟 4：設置環境變數

### 4.1 本地開發環境

1. 將下載的 JSON 金鑰檔案移動到安全的位置（例如：`chat-app-3/backend/secrets/`）

2. 創建或編輯 `chat-app-3/backend/.env` 檔案：

```env
# Google Cloud Vertex AI（用於 Veo 3.1 Fast 影片生成）
GOOGLE_CLOUD_PROJECT_ID=my-veo-video-app-123456  # 替換為您的專案 ID
GOOGLE_CLOUD_LOCATION=us-central1                # 或其他支援的區域

# 服務帳號 JSON 金鑰路徑
GOOGLE_APPLICATION_CREDENTIALS=./secrets/google-cloud-service-account.json
```

3. 確保 `.gitignore` 包含以下內容：

```gitignore
# Google Cloud 服務帳號金鑰
secrets/
*.json
!package.json
!package-lock.json
```

### 4.2 生產環境（Cloud Run / Google Cloud）

如果您的應用程式部署在 Google Cloud 上（例如 Cloud Run），您不需要手動設置 `GOOGLE_APPLICATION_CREDENTIALS`，因為 Google Cloud 會自動提供應用程式預設憑證。

只需在環境變數中設置：

```env
GOOGLE_CLOUD_PROJECT_ID=my-veo-video-app-123456
GOOGLE_CLOUD_LOCATION=us-central1
```

確保 Cloud Run 服務使用的服務帳號具有 Vertex AI User 權限。

### 4.3 其他雲端平台（AWS、Azure、Heroku 等）

如果部署在非 Google Cloud 平台上，您需要設置服務帳號金鑰：

**選項 1：使用環境變數**（推薦）

將 JSON 金鑰內容轉換為 Base64 字串：

```bash
cat google-cloud-service-account.json | base64
```

設置環境變數：

```env
GOOGLE_APPLICATION_CREDENTIALS_JSON=<base64 編碼的 JSON 內容>
```

然後在代碼中解碼並使用（需要在初始化 Vertex AI 前處理）。

**選項 2：使用檔案路徑**

將 JSON 金鑰檔案上傳到伺服器的安全位置，並設置：

```env
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-cloud-service-account.json
```

---

## 步驟 5：測試配置

### 5.1 檢查環境變數

確認所有必要的環境變數已設置：

```bash
cd chat-app-3/backend
cat .env | grep GOOGLE_CLOUD
```

應該看到：
```
GOOGLE_CLOUD_PROJECT_ID=...
GOOGLE_CLOUD_LOCATION=...
```

### 5.2 啟動後端伺服器

```bash
npm run dev
```

### 5.3 測試影片生成 API

使用 curl 或 Postman 測試：

```bash
curl -X POST http://localhost:4000/api/video/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "characterId": "YOUR_CHARACTER_ID",
    "duration": "4s",
    "resolution": "720p"
  }'
```

如果配置正確，您應該會收到包含 `videoUrl` 的回應。

---

## 常見問題

### Q1: 遇到「Permission denied」錯誤

**錯誤訊息**：
```
Error: Permission 'aiplatform.endpoints.predict' denied
```

**解決方法**：
1. 確認服務帳號具有「Vertex AI User」角色
2. 檢查專案 ID 是否正確
3. 等待幾分鐘讓權限變更生效

### Q2: 遇到「Quota exceeded」錯誤

**錯誤訊息**：
```
Error: Quota exceeded for quota metric 'GenerateContent requests per minute'
```

**解決方法**：
1. 前往 [Google Cloud Console > IAM 與管理 > 配額](https://console.cloud.google.com/iam-admin/quotas)
2. 搜尋「Vertex AI」或「Generative AI」
3. 請求提高配額限制
4. 在應用程式中實作速率限制

### Q3: Veo 模型不可用

**錯誤訊息**：
```
Error: Model 'veo-002' not found or not available in region 'us-central1'
```

**解決方法**：
1. 確認您的 Google Cloud 專案已啟用 Vertex AI API
2. 檢查區域是否支援 Veo 模型（試試 `us-central1`）
3. 確認您已申請並獲得 Veo 存取權限
4. 嘗試聯繫 Google Cloud 支援

### Q4: 找不到服務帳號金鑰

**錯誤訊息**：
```
Error: ENOENT: no such file or directory, open './secrets/google-cloud-service-account.json'
```

**解決方法**：
1. 確認金鑰檔案路徑正確
2. 確認 `GOOGLE_APPLICATION_CREDENTIALS` 環境變數設置正確
3. 如果使用相對路徑，確保從正確的目錄啟動應用程式

### Q5: 金鑰檔案格式錯誤

**錯誤訊息**：
```
Error: Unable to parse private key
```

**解決方法**：
1. 確認 JSON 金鑰檔案完整且未損壞
2. 重新下載服務帳號金鑰
3. 確認檔案編碼為 UTF-8

---

## 定價資訊

### Vertex AI Veo 3.1 影片生成定價

**截至 2025 年**（請查看 [官方定價頁面](https://cloud.google.com/vertex-ai/pricing) 以獲取最新資訊）：

- **影片生成**：每秒 $0.XX USD
- **儲存**：使用 Google Cloud Storage 或 Cloudflare R2（本專案使用 R2）

### 免費配額

Google Cloud 新用戶可能獲得：
- $300 美元免費試用額度（90 天內）
- 部分 API 有免費配額（視具體 API 而定）

### 成本估算範例

假設：
- 每個影片 4 秒
- 每月生成 1,000 個影片
- 單價 $0.10 USD/秒

**每月成本**：
```
1,000 影片 × 4 秒 × $0.10 = $400 USD
```

**建議**：
1. 設置預算警報以避免意外費用
2. 實作用戶使用限制（VIP 會員才能生成影片）
3. 快取已生成的影片，避免重複生成

---

## 安全最佳實踐

1. **不要將服務帳號金鑰提交到 Git**
   - 使用 `.gitignore` 排除 `secrets/` 目錄和 `.json` 檔案

2. **定期輪換金鑰**
   - 建議每 90 天更換一次服務帳號金鑰

3. **使用最小權限原則**
   - 只授予服務帳號必要的權限（Vertex AI User）

4. **監控 API 使用量**
   - 設置 Google Cloud 預算警報
   - 監控異常的 API 調用

5. **生產環境建議**
   - 使用 Google Cloud 的應用程式預設憑證（ADC）
   - 避免在環境變數中存儲敏感金鑰

---

## 額外資源

- [Vertex AI 官方文檔](https://cloud.google.com/vertex-ai/docs)
- [Veo 模型文檔](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo)
- [Google Cloud 定價計算器](https://cloud.google.com/products/calculator)
- [服務帳號最佳實踐](https://cloud.google.com/iam/docs/best-practices-service-accounts)

---

## 支援

如果您在設置過程中遇到問題，請：

1. 查看 [常見問題](#常見問題) 部分
2. 查看後端日誌：`cd chat-app-3/backend && npm run dev`
3. 查看 Google Cloud 日誌：[Cloud Console > 日誌](https://console.cloud.google.com/logs)
4. 提交 GitHub Issue 或聯繫技術支援

---

**上次更新**：2025-01-05
