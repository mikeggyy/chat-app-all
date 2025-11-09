# Google Cloud TTS 設置指南

## 📋 概述

這份文件說明如何將專案的 TTS（Text-to-Speech）服務從 OpenAI TTS 切換到 Google Cloud TTS。

**優勢**：
- 💰 **成本降低 73%**（$15 → $4 per 1M 字元）
- 🎁 **每月 100 萬字元免費額度**
- 🇹🇼 **專屬台灣口音語音**（cmn-TW）
- 🎵 **40+ 語音選擇**（OpenAI 只有 10 種）
- 🎛️ **進階控制**：語速、音調、SSML

---

## 🚀 快速開始（5 分鐘）

### 步驟 1：安裝 Google Cloud TTS SDK

```bash
cd chat-app/backend
npm install @google-cloud/text-to-speech
```

### 步驟 2：啟用 Google Cloud TTS

在 `backend/.env` 文件中設置：

```env
# 啟用 Google Cloud TTS（推薦）
USE_GOOGLE_TTS=true

# Google Cloud 憑證（與 Veo 共用）
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json
```

**💡 提示**：如果你已經設置了 Veo 影片生成，那麼 `GOOGLE_APPLICATION_CREDENTIALS` 已經配置好了！

### 步驟 3：啟用 Text-to-Speech API

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇你的專案（與 Veo 相同）
3. 搜尋「Text-to-Speech API」
4. 點擊「啟用」

### 步驟 4：測試

啟動後端：

```bash
cd chat-app/backend
npm run dev:backend
```

測試語音生成 API：

```bash
# 獲取可用語音列表
curl http://localhost:4000/api/voices

# 獲取推薦語音（台灣語音）
curl http://localhost:4000/api/voices/recommended

# 獲取當前 TTS 服務資訊
curl http://localhost:4000/api/voices/service
```

✅ **完成！** 現在你的應用已經使用 Google Cloud TTS 了。

---

## 📊 詳細設置步驟

### 1. 安裝依賴套件

```bash
cd chat-app/backend
npm install @google-cloud/text-to-speech
```

**驗證安裝**：

```bash
npm list @google-cloud/text-to-speech
```

應該看到：

```
@google-cloud/text-to-speech@5.x.x
```

---

### 2. Google Cloud 設置

#### 選項 A：使用現有的 Veo 憑證（推薦）

如果你已經設置了 Veo 影片生成，可以直接使用相同的服務帳號。

✅ **無需額外設置**，只需啟用 Text-to-Speech API 即可（見步驟 3）。

#### 選項 B：創建新的服務帳號

如果沒有 Google Cloud 服務帳號：

1. **前往 Google Cloud Console**
   https://console.cloud.google.com/

2. **創建或選擇專案**
   - 如果有現有專案（Veo），選擇它
   - 否則點擊「建立專案」

3. **啟用計費**
   - 前往「計費」頁面
   - 設置付款方式（可使用免費額度）

4. **創建服務帳號**
   - 前往「IAM 與管理」→「服務帳號」
   - 點擊「建立服務帳號」
   - 名稱：`tts-service-account`
   - 角色：選擇「Cloud Text-to-Speech API 使用者」

5. **下載金鑰**
   - 點擊建立的服務帳號
   - 「金鑰」→「新增金鑰」→「JSON」
   - 儲存為 `service-account-key.json`

6. **放置金鑰文件**

   ```bash
   # 將金鑰放到專案根目錄（不要提交到 Git！）
   mv ~/Downloads/service-account-key.json chat-app/backend/
   ```

7. **設置環境變數**

   在 `backend/.env`：

   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
   ```

---

### 3. 啟用 Text-to-Speech API

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 確認選擇了正確的專案
3. 搜尋「**Text-to-Speech API**」
4. 點擊「**啟用**」

**驗證啟用成功**：

```bash
# 測試 API（需要先設置憑證）
node -e "
const {TextToSpeechClient} = require('@google-cloud/text-to-speech');
const client = new TextToSpeechClient();
client.listVoices({languageCode: 'cmn-TW'})
  .then(([result]) => console.log('✓ API 已啟用，可用語音數:', result.voices.length))
  .catch(e => console.error('✗ 錯誤:', e.message));
"
```

---

### 4. 配置環境變數

編輯 `chat-app/backend/.env`：

```env
# ==================== TTS 配置 ====================

# TTS 服務選擇
USE_GOOGLE_TTS=true  # true = Google TTS, false = OpenAI TTS

# Google Cloud 憑證（與 Veo 共用）
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=asia-east1

# OpenAI API Key（保留作為備用）
OPENAI_API_KEY=sk-...
```

**環境變數說明**：

| 變數 | 必填 | 說明 |
|------|------|------|
| `USE_GOOGLE_TTS` | ✅ 是 | `true` 使用 Google，`false` 使用 OpenAI |
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅ 是 | 服務帳號金鑰路徑 |
| `GOOGLE_CLOUD_PROJECT_ID` | 建議 | Google Cloud 專案 ID |
| `GOOGLE_CLOUD_LOCATION` | 建議 | 地區（`asia-east1` 推薦） |
| `OPENAI_API_KEY` | 建議保留 | 備用 TTS 服務 |

---

### 5. 生成語音預覽（可選）

生成 40+ 語音的預覽音頻供前端試聽：

```bash
cd chat-app/backend

# 生成所有語音預覽（40+ 個）
node scripts/generateVoicePreviewsGoogle.js

# 僅生成台灣語音（推薦）
node scripts/generateVoicePreviewsGoogle.js --locale=cmn-TW

# 僅生成大陸語音
node scripts/generateVoicePreviewsGoogle.js --locale=cmn-CN
```

**輸出位置**：
```
frontend/public/voices/google/
├── cmn-TW-Wavenet-A.mp3   # 台灣女聲 A
├── cmn-TW-Wavenet-B.mp3   # 台灣男聲 B
├── cmn-TW-Wavenet-C.mp3   # 台灣男聲 C
├── ...
└── voices.json             # 語音列表（給前端使用）
```

**⏱️ 預估時間**：
- 台灣語音（6 個）：約 1 分鐘
- 所有語音（40+ 個）：約 5-10 分鐘

---

## 🎤 可用語音列表

### 台灣口音（推薦）⭐

| 語音 ID | 性別 | 品質 | 描述 |
|---------|------|------|------|
| `cmn-TW-Wavenet-A` | 女性 | Wavenet | 溫柔、清晰的台灣女性聲音 ⭐ |
| `cmn-TW-Wavenet-B` | 男性 | Wavenet | 穩重、自然的台灣男性聲音 ⭐ |
| `cmn-TW-Wavenet-C` | 男性 | Wavenet | 成熟、低沉的台灣男性聲音 ⭐ |
| `cmn-TW-Standard-A` | 女性 | Standard | 標準台灣女性聲音 |
| `cmn-TW-Standard-B` | 男性 | Standard | 標準台灣男性聲音 |
| `cmn-TW-Standard-C` | 男性 | Standard | 標準台灣男性聲音（低沉） |

### 大陸口音

| 語音 ID | 性別 | 品質 | 描述 |
|---------|------|------|------|
| `cmn-CN-Neural2-A` | 女性 | Neural2 | 大陸女性聲音（Neural2） |
| `cmn-CN-Neural2-B` | 男性 | Neural2 | 大陸男性聲音（Neural2） |
| `cmn-CN-Neural2-C` | 男性 | Neural2 | 大陸男性聲音（成熟） |
| `cmn-CN-Neural2-D` | 女性 | Neural2 | 大陸女性聲音（溫柔） |
| `cmn-CN-Wavenet-A/B/C/D` | 多種 | Wavenet | 高品質大陸語音 |
| `cmn-CN-Standard-A/B/C/D` | 多種 | Standard | 標準大陸語音 |

### 其他語言（可選）

- **粵語**：`yue-HK-Standard-A/B/C/D`（香港粵語）
- **日語**：`ja-JP-Neural2-B/C`、`ja-JP-Wavenet-A/B/C/D`
- **韓語**：`ko-KR-Neural2-A/B/C`、`ko-KR-Wavenet-A/B/C/D`
- **英語**：`en-US-Neural2-A/C/D/E/F/G/H/I/J`

**完整列表**：查看 [googleTts.service.js](chat-app\backend\src\ai\googleTts.service.js) 中的 `GOOGLE_VOICES` 陣列。

---

## 🧪 測試

### 1. 測試 API 端點

```bash
# 獲取所有可用語音
curl http://localhost:4000/api/voices

# 獲取推薦語音（台灣語音）
curl http://localhost:4000/api/voices/recommended

# 按語言分組獲取語音
curl http://localhost:4000/api/voices/by-locale

# 獲取當前使用的 TTS 服務
curl http://localhost:4000/api/voices/service

# 獲取 OpenAI → Google 語音映射
curl http://localhost:4000/api/voices/mapping
```

### 2. 測試語音生成

在前端應用中：

1. 登入應用
2. 選擇一個 AI 角色開始對話
3. 發送訊息並點擊「播放語音」
4. 應該聽到台灣口音的語音

### 3. 測試備用切換

測試如果 Google TTS 失敗，是否自動切換到 OpenAI：

```bash
# 暫時設置錯誤的憑證來模擬失敗
GOOGLE_APPLICATION_CREDENTIALS=/invalid/path npm run dev:backend
```

應該看到日誌：

```
[TTS] Google TTS 失敗，切換到 OpenAI TTS
```

---

## 🔄 從 OpenAI 遷移

### 現有角色語音自動映射

系統會自動將現有角色的 OpenAI 語音映射到 Google 語音：

| OpenAI 語音 | Google 語音 | 說明 |
|-------------|-------------|------|
| `nova` | `cmn-TW-Wavenet-A` | 溫暖女性 → 台灣女性 A |
| `shimmer` | `cmn-TW-Wavenet-A` | 柔和女性 → 台灣女性 A |
| `echo` | `cmn-TW-Wavenet-B` | 男性 → 台灣男性 B |
| `onyx` | `cmn-TW-Wavenet-C` | 深沉男性 → 台灣男性 C |
| `alloy` | `cmn-TW-Wavenet-A` | 中性 → 台灣女性 A |
| ... | ... | ... |

**無需修改資料庫**，映射會自動生效！

### 逐步遷移策略

#### Phase 1：測試環境驗證（1-3 天）

```env
# 開發環境 .env
USE_GOOGLE_TTS=true
```

1. 在開發環境啟用 Google TTS
2. 測試所有語音功能
3. 比較語音品質
4. 收集反饋

#### Phase 2：生產環境部分切換（1 週）

```javascript
// 可以根據用戶等級選擇不同 TTS
const USE_GOOGLE_TTS = user.membershipTier === 'free'
  ? true   // 免費用戶使用 Google（節省成本）
  : false; // 付費用戶保持 OpenAI（或給予選擇）
```

#### Phase 3：完全遷移（1 週）

```env
# 生產環境 .env
USE_GOOGLE_TTS=true
```

1. 所有用戶切換到 Google TTS
2. 監控錯誤率和用戶反饋
3. 保留 OpenAI API Key 作為備用

---

## 📊 成本對比

### 假設使用量：每月 100 萬字元

| 項目 | OpenAI TTS | Google Cloud TTS | 節省 |
|------|------------|------------------|------|
| **基礎費用** | $15.00 | $0 (免費額度) | **$15 (100%)** |

### 假設使用量：每月 200 萬字元

| 項目 | OpenAI TTS | Google Cloud TTS | 節省 |
|------|------------|------------------|------|
| **基礎費用** | $30.00 | $4.00 | **$26 (87%)** |

### 假設使用量：每月 500 萬字元

| 項目 | OpenAI TTS | Google Cloud TTS | 節省 |
|------|------------|------------------|------|
| **基礎費用** | $75.00 | $16.00 | **$59 (79%)** |

**💰 預估年度節省：$120-708 USD**

---

## 🐛 故障排除

### 問題 1：`UNAUTHENTICATED` 錯誤

**錯誤訊息**：
```
Google Cloud 憑證驗證失敗，請檢查 GOOGLE_APPLICATION_CREDENTIALS 設定
```

**解決方案**：

1. 確認服務帳號金鑰文件存在：
   ```bash
   ls -la chat-app/backend/service-account-key.json
   ```

2. 確認環境變數正確：
   ```bash
   echo $GOOGLE_APPLICATION_CREDENTIALS
   ```

3. 確認金鑰文件格式正確（應為 JSON）：
   ```bash
   head chat-app/backend/service-account-key.json
   ```

---

### 問題 2：`PERMISSION_DENIED` 錯誤

**錯誤訊息**：
```
沒有 Text-to-Speech API 權限，請在 Google Cloud Console 啟用
```

**解決方案**：

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 搜尋「Text-to-Speech API」
3. 點擊「啟用」

---

### 問題 3：`RESOURCE_EXHAUSTED` 錯誤

**錯誤訊息**：
```
Google TTS 配額已用盡，請檢查用量或升級方案
```

**解決方案**：

1. 查看配額使用量：
   - 前往 Google Cloud Console
   - 「API 和服務」→「配額」
   - 搜尋「Text-to-Speech」

2. 選項 A：等待配額重置（每月 1 號）

3. 選項 B：暫時切回 OpenAI TTS：
   ```env
   USE_GOOGLE_TTS=false
   ```

---

### 問題 4：語音品質不佳

**解決方案**：

1. 確認使用的是 Wavenet 語音（最高品質）：
   ```
   cmn-TW-Wavenet-A  ✅ 推薦
   cmn-TW-Standard-A  ⚠️ 品質較低
   ```

2. 調整語速和音調（可選）：
   ```javascript
   await generateSpeech(text, characterId, {
     speakingRate: 1.0,  // 0.25-4.0
     pitch: 0,           // -20 ~ +20
   });
   ```

---

### 問題 5：啟動時找不到模組

**錯誤訊息**：
```
Cannot find module '@google-cloud/text-to-speech'
```

**解決方案**：

```bash
cd chat-app/backend
npm install @google-cloud/text-to-speech
```

---

## 📖 API 文檔

### 語音列表 API

#### `GET /api/voices`

獲取所有可用語音列表。

**回應範例**：
```json
{
  "service": "google",
  "count": 43,
  "voices": [
    {
      "id": "cmn-TW-Wavenet-A",
      "name": "台灣女聲 A",
      "gender": "FEMALE",
      "locale": "cmn-TW",
      "quality": "Wavenet",
      "description": "溫柔、清晰的台灣女性聲音",
      "recommended": true,
      "previewUrl": "/voices/google/cmn-TW-Wavenet-A.mp3"
    },
    // ... 更多語音
  ]
}
```

---

#### `GET /api/voices/recommended`

獲取推薦語音（台灣語音優先）。

**回應範例**：
```json
{
  "service": "google",
  "count": 6,
  "voices": [
    // 台灣 Wavenet 語音
  ]
}
```

---

#### `GET /api/voices/by-locale`

按語言分組獲取語音。

**回應範例**：
```json
{
  "service": "google",
  "locales": ["cmn-TW", "cmn-CN", "yue-HK", "ja-JP", "ko-KR", "en-US"],
  "voices": {
    "cmn-TW": [ /* 台灣語音 */ ],
    "cmn-CN": [ /* 大陸語音 */ ],
    // ...
  }
}
```

---

#### `GET /api/voices/service`

獲取當前使用的 TTS 服務資訊。

**回應範例**：
```json
{
  "service": "google",
  "name": "Google Cloud TTS",
  "features": {
    "costPerMillion": "$4",
    "freeQuota": "100 萬字元/月",
    "voiceCount": 43,
    "taiwanVoices": true,
    "ssmlSupport": true,
    "speedControl": true,
    "pitchControl": true
  }
}
```

---

## 📚 相關文件

- **[TTS_COMPARISON.md](TTS_COMPARISON.md)** - OpenAI vs Google TTS 詳細對比
- **[COST_OPTIMIZATION_PLAN.md](COST_OPTIMIZATION_PLAN.md)** - 完整成本優化方案
- **[googleTts.service.js](chat-app\backend\src\ai\googleTts.service.js)** - Google TTS 服務實作

---

## 🆘 需要幫助？

如有問題，請：

1. 查看本文檔的「故障排除」章節
2. 查看 Google Cloud Console 的配額和計費頁面
3. 查看後端日誌（`backend/logs/`）

---

## ✅ 檢查清單

部署前確認：

- [ ] 已安裝 `@google-cloud/text-to-speech` 套件
- [ ] 已設置 `GOOGLE_APPLICATION_CREDENTIALS` 環境變數
- [ ] 已在 Google Cloud Console 啟用 Text-to-Speech API
- [ ] 已設置 `USE_GOOGLE_TTS=true`
- [ ] 已測試語音生成功能
- [ ] 已生成語音預覽檔案（可選）
- [ ] 已更新前端語音選擇 UI（可選）

🎉 **恭喜！你已成功切換到 Google Cloud TTS！**
