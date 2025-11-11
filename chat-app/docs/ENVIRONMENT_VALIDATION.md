# 環境變數驗證系統

## 概述

環境變數驗證系統會在應用啟動時自動檢查所有必要的環境變數，確保配置正確並提供詳細的錯誤提示。

## 功能特點

✅ **啟動時自動驗證** - 應用啟動前自動檢查所有必要環境變數
✅ **智能條件驗證** - 根據環境（開發/生產）和服務配置動態調整驗證規則
✅ **詳細錯誤提示** - 清晰指出缺失或無效的環境變數
✅ **格式驗證** - 驗證 URL、端口號等格式是否正確
✅ **安全性檢查** - 檢測生產環境的安全配置問題
✅ **配置摘要輸出** - 啟動時顯示當前配置（敏感信息已遮罩）

## 驗證內容

### 主應用 (chat-app)

#### 必要環境變數

| 類別 | 環境變數 | 說明 |
|-----|---------|------|
| **Firebase Admin** | `FIREBASE_ADMIN_PROJECT_ID` | Firebase 專案 ID |
| | `FIREBASE_ADMIN_CLIENT_EMAIL` | 服務帳號 Email（生產環境）|
| | `FIREBASE_ADMIN_PRIVATE_KEY` | 服務帳號私鑰（生產環境）|
| **AI 服務** | `OPENAI_API_KEY` | OpenAI API Key（對話 + TTS）|
| | `GOOGLE_AI_API_KEY` | Google AI API Key（圖片生成）|
| **影片生成** | `VIDEO_GENERATION_PROVIDER` | 影片生成提供者（hailuo/veo/replicate）|
| **Cloudflare R2** | `R2_ENDPOINT` | R2 Storage 端點 |
| | `R2_ACCESS_KEY_ID` | R2 存取金鑰 ID |
| | `R2_SECRET_ACCESS_KEY` | R2 秘密存取金鑰 |
| | `R2_BUCKET_NAME` | R2 Bucket 名稱 |
| | `R2_PUBLIC_URL` | R2 公開 URL |

#### 條件性必要變數

| 條件 | 環境變數 | 說明 |
|-----|---------|------|
| `VIDEO_GENERATION_PROVIDER=veo` | `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud 專案 ID |
| | `GOOGLE_CLOUD_LOCATION` | Google Cloud 地區（必須為 us-central1）|
| `VIDEO_GENERATION_PROVIDER=replicate` | `REPLICATE_API_TOKEN` | Replicate API Token |
| `USE_GOOGLE_TTS=true` | `GOOGLE_CLOUD_PROJECT_ID` | Google Cloud 專案 ID |
| | `GOOGLE_CLOUD_LOCATION` | Google Cloud 地區 |

#### 可選環境變數

- `PORT` - 伺服器端口（預設 4000）
- `NODE_ENV` - 執行環境（development/production）
- `CORS_ORIGIN` - CORS 允許的來源（生產環境必需）
- `USE_FIREBASE_EMULATOR` - 是否使用 Firebase Emulator
- `USE_GOOGLE_TTS` - 是否使用 Google Cloud TTS
- `USE_MOCK_VIDEO` - 是否使用 Mock 影片（測試用）
- `ENABLE_DEV_PURCHASE_BYPASS` - 開發環境購買繞過

### 管理後臺 (chat-app-admin)

#### 必要環境變數

| 類別 | 環境變數 | 說明 |
|-----|---------|------|
| **Firebase Admin** | `FIREBASE_ADMIN_PROJECT_ID` | Firebase 專案 ID |
| **Cloudflare R2** | `R2_ENDPOINT` | R2 Storage 端點 |
| | `R2_ACCESS_KEY_ID` | R2 存取金鑰 ID |
| | `R2_SECRET_ACCESS_KEY` | R2 秘密存取金鑰 |
| | `R2_BUCKET_NAME` | R2 Bucket 名稱 |
| | `R2_PUBLIC_URL` | R2 公開 URL |

#### 可選環境變數

- `PORT` - 伺服器端口（預設 4001）
- `NODE_ENV` - 執行環境
- `CORS_ORIGIN` - CORS 允許的來源（生產環境必需）
- `MAIN_APP_API_URL` - 主應用 API URL

## 使用方法

### 自動驗證（應用啟動時）

環境變數驗證會在應用啟動時自動執行，無需任何額外配置：

```bash
# 主應用
cd chat-app/backend
npm run dev

# 管理後臺
cd chat-app-admin/backend
npm run dev
```

如果環境變數配置有問題，應用會：
1. 顯示詳細的錯誤訊息
2. 列出所有缺失或無效的環境變數
3. 提供修正建議
4. 終止啟動（避免在錯誤配置下運行）

### 手動測試驗證

在不啟動整個應用的情況下測試環境變數配置：

```bash
# 主應用
cd chat-app/backend
npm run test:env

# 管理後臺
cd chat-app-admin/backend
npm run test:env
```

### 驗證輸出範例

#### ✅ 驗證通過

```
╔═══════════════════════════════════════════════════════════════╗
║         環境變數驗證測試 - Chat App Backend                  ║
╚═══════════════════════════════════════════════════════════════╝

🔍 驗證環境變數配置...
環境: 開發環境
Firebase Emulator: 啟用
✅ 環境變數驗證通過

📋 環境變數配置摘要:
────────────────────────────────────────────────────────────
🖥️  伺服器配置:
   NODE_ENV: development
   PORT: 4000
   CORS_ORIGIN: 未設置（開發模式預設）

🔥 Firebase 配置:
   USE_FIREBASE_EMULATOR: true
   FIREBASE_ADMIN_PROJECT_ID: chat-app-3-8a7ee
   FIREBASE_STORAGE_BUCKET: chat-app-3-8a7ee.appspot.com

🤖 AI 服務配置:
   OPENAI_API_KEY: sk-p...TxZQ
   GOOGLE_AI_API_KEY: AIza...abc3
   USE_GOOGLE_TTS: true

☁️  Google Cloud 配置:
   PROJECT_ID: my-project-123
   LOCATION: us-central1
   CREDENTIALS: /path/to/service-account.json

🎬 影片生成配置:
   PROVIDER: hailuo
   USE_MOCK_VIDEO: false

💾 Cloudflare R2 Storage:
   BUCKET_NAME: my-bucket
   PUBLIC_URL: https://cdn.example.com
   ENDPOINT: http...com
   ACCESS_KEY_ID: 1234...5678
────────────────────────────────────────────────────────────

🎉 環境變數配置完整，應用可以正常啟動！
```

#### ❌ 驗證失敗

```
🔍 驗證環境變數配置...
環境: 開發環境
Firebase Emulator: 停用
❌ 缺少必要的環境變數: OPENAI_API_KEY, GOOGLE_AI_API_KEY
❌ Cloudflare R2 Storage 配置不完整，缺少: R2_ENDPOINT, R2_ACCESS_KEY_ID
❌ 圖片和影片儲存將無法使用
⚠️  FIREBASE_ADMIN_CLIENT_EMAIL 未設置，可能影響 Firebase Admin SDK
❌ 環境變數驗證失敗

═══════════════════════════════════════════════════════════════
❌ 驗證結果: 失敗

發現以下問題：

  1. 缺少必要的環境變數: OPENAI_API_KEY, GOOGLE_AI_API_KEY
  2. Cloudflare R2 Storage 配置不完整，缺少: R2_ENDPOINT, R2_ACCESS_KEY_ID
  3. VIDEO_GENERATION_PROVIDER 未設置，影片生成功能將無法使用

警告：
  1. FIREBASE_ADMIN_CLIENT_EMAIL 未設置，可能影響 Firebase Admin SDK

💡 提示：
  1. 請檢查 .env 文件是否存在
  2. 參考 .env.example 文件補充缺失的環境變數
  3. 確認環境變數格式正確（特別是 URL 和 API Key）
```

## 驗證規則

### 格式驗證

- **端口號**: 必須是 1-65535 之間的整數
- **R2 URL**: 必須以 `https://` 開頭
- **影片生成提供者**: 必須是 `hailuo`, `veo`, 或 `replicate` 之一
- **CORS_ORIGIN**: 生產環境不允許使用 `*`

### 條件驗證

1. **生產環境 + 非 Emulator** → 需要完整的 Firebase 憑證
2. **Veo 影片生成** → 需要 Google Cloud 配置，且地區必須為 `us-central1`
3. **Replicate 影片生成** → 需要 Replicate API Token
4. **Google Cloud TTS** → 需要 Google Cloud 配置

### 安全性檢查

- ⚠️ 生產環境啟用測試帳號 → 發出警告
- ⚠️ 生產環境啟用購買繞過 → 發出錯誤並終止啟動
- ⚠️ 生產環境 CORS 設為 `*` → 發出錯誤並終止啟動

## 故障排除

### 常見問題

#### Q1: `.env` 文件存在但仍提示缺少環境變數

**原因**: 環境變數值為空或僅包含空格

**解決方案**:
```bash
# ❌ 錯誤
OPENAI_API_KEY=

# ✅ 正確
OPENAI_API_KEY=sk-your-key-here
```

#### Q2: R2 配置正確但仍提示格式錯誤

**原因**: URL 缺少 `https://` 前綴

**解決方案**:
```bash
# ❌ 錯誤
R2_ENDPOINT=account-id.r2.cloudflarestorage.com

# ✅ 正確
R2_ENDPOINT=https://account-id.r2.cloudflarestorage.com
```

#### Q3: 使用 Veo 提示地區錯誤

**原因**: Veo 僅支援 `us-central1` 地區

**解決方案**:
```bash
# ❌ 錯誤
GOOGLE_CLOUD_LOCATION=asia-east1

# ✅ 正確
GOOGLE_CLOUD_LOCATION=us-central1
```

#### Q4: 生產環境無法啟動

**原因**: 生產環境有更嚴格的驗證規則

**檢查清單**:
- [ ] `CORS_ORIGIN` 已設置且不是 `*`
- [ ] Firebase 憑證完整（`FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`）
- [ ] `ENABLE_DEV_PURCHASE_BYPASS` 未設置或為 `false`
- [ ] `ENABLE_TEST_ACCOUNTS_IN_PROD` 未設置或為 `false`

## 程式化使用

### 在代碼中使用驗證工具

```javascript
import { validateEnvironment, printEnvSummary } from './utils/validateEnv.js';

// 驗證環境變數（不退出進程）
const result = validateEnvironment({
  strict: true,
  exitOnError: false,
});

if (result.valid) {
  console.log('✅ 環境變數配置正確');
  printEnvSummary();
} else {
  console.log('❌ 環境變數配置有誤');
  console.log('錯誤:', result.errors);
  console.log('警告:', result.warnings);
}
```

### 自定義驗證邏輯

如需添加自定義驗證規則，修改 `backend/src/utils/validateEnv.js`:

```javascript
// 添加新的必要環境變數
const ENV_CONFIG = {
  // ...現有配置
  myService: {
    required: ["MY_API_KEY", "MY_API_SECRET"],
    optional: ["MY_API_TIMEOUT"],
  },
};

// 在 validateEnvironment() 函數中添加自定義驗證邏輯
export function validateEnvironment(options = {}) {
  // ...現有代碼

  // 自定義驗證
  if (process.env.MY_API_KEY && process.env.MY_API_KEY.length < 32) {
    errors.push("MY_API_KEY 長度不足，至少需要 32 個字符");
  }
}
```

## 相關文件

- [環境配置指南](../CLAUDE.md#環境配置) - 詳細的環境變數配置說明
- [.env.example](../backend/.env.example) - 環境變數範例文件
- [故障排除](../CLAUDE.md#故障排除) - 常見問題解決方案

## 更新日誌

### v1.0.0 (2025-11-11)

**新增功能**:
- ✅ 完整的環境變數驗證系統
- ✅ 支援主應用和管理後臺
- ✅ 條件性驗證規則
- ✅ 格式驗證
- ✅ 安全性檢查
- ✅ 詳細的錯誤提示
- ✅ 配置摘要輸出
- ✅ 獨立測試腳本

**驗證覆蓋**:
- Firebase Admin SDK 配置
- AI 服務 API Keys（OpenAI, Google AI）
- Google Cloud Vertex AI 配置
- 影片生成服務配置
- Cloudflare R2 Storage 配置
- TTS 服務配置
- 伺服器配置
- 開發環境配置
