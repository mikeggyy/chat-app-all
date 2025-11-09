# ✅ Google Cloud TTS 遷移完成總結

## 🎉 已完成的工作

我已經成功將你的專案切換到 **Google Cloud TTS**，並配置了 **40+ 語音選項**！

### 已創建/修改的文件

#### 1️⃣ **後端核心服務**

- ✅ **[chat-app/backend/src/ai/googleTts.service.js](chat-app\backend\src\ai\googleTts.service.js)**
  - 完整的 Google Cloud TTS 服務實作
  - 包含 40+ 語音配置（台灣、大陸、粵語、日語、韓語、英語）
  - OpenAI → Google 語音自動映射
  - SSML 進階語音支援

- ✅ **[chat-app/backend/src/ai/ai.service.js](chat-app\backend\src\ai\ai.service.js)**
  - 添加 TTS 服務選擇邏輯
  - 環境變數控制（`USE_GOOGLE_TTS`）
  - 自動備用切換（Google 失敗時切換到 OpenAI）

#### 2️⃣ **API 路由**

- ✅ **[chat-app/backend/src/ai/voices.routes.js](chat-app\backend\src\ai\voices.routes.js)**
  - `GET /api/voices` - 獲取所有可用語音
  - `GET /api/voices/recommended` - 獲取推薦語音（台灣語音）
  - `GET /api/voices/by-locale` - 按語言分組
  - `GET /api/voices/service` - 獲取當前 TTS 服務資訊
  - `GET /api/voices/mapping` - 獲取語音映射表

- ✅ **[chat-app/backend/src/index.js](chat-app\backend\src\index.js)**
  - 註冊語音路由到主應用

#### 3️⃣ **腳本工具**

- ✅ **[chat-app/backend/scripts/generateVoicePreviewsGoogle.js](chat-app\backend\scripts\generateVoicePreviewsGoogle.js)**
  - 生成 40+ 語音預覽音頻
  - 支援按語言過濾
  - 自動生成 JSON 語音列表

#### 4️⃣ **配置文件**

- ✅ **[chat-app/backend/.env.example](chat-app\backend\.env.example)**
  - 添加 `USE_GOOGLE_TTS` 環境變數
  - 更新 Google Cloud 配置說明
  - 標註與 Veo 共用憑證

#### 5️⃣ **文檔**

- ✅ **[docs/GOOGLE_TTS_SETUP.md](docs\GOOGLE_TTS_SETUP.md)**
  - 完整的設置指南
  - 故障排除
  - API 文檔
  - 成本對比

- ✅ **[docs/TTS_COMPARISON.md](docs\TTS_COMPARISON.md)**
  - OpenAI vs Google TTS 詳細對比
  - 40+ 語音列表
  - 實作範例

- ✅ **[COST_OPTIMIZATION_PLAN.md](COST_OPTIMIZATION_PLAN.md)**
  - 完整的成本優化方案
  - TTS 只是其中一部分

#### 6️⃣ **依賴套件**

- ✅ **已安裝 `@google-cloud/text-to-speech`**
  ```
  ✓ @google-cloud/text-to-speech@5.x.x
  ```

---

## 📊 語音配置總覽

### 已配置的語音數量：**43 個**

| 語言/地區 | 語音數量 | 品質等級 |
|-----------|----------|----------|
| 🇹🇼 台灣中文 | 6 個 | Wavenet (3) + Standard (3) |
| 🇨🇳 大陸中文 | 12 個 | Neural2 (4) + Wavenet (4) + Standard (4) |
| 🇭🇰 香港粵語 | 4 個 | Standard (4) |
| 🇯🇵 日語 | 7 個 | Neural2 (2) + Wavenet (4) + Standard (1) |
| 🇰🇷 韓語 | 7 個 | Neural2 (3) + Wavenet (4) |
| 🇺🇸 美式英語 | 9 個 | Neural2 (9) |

### 推薦語音（台灣口音）⭐

```javascript
// 最推薦使用（Wavenet 最高品質）
'cmn-TW-Wavenet-A'  // 台灣女聲 A - 溫柔、清晰
'cmn-TW-Wavenet-B'  // 台灣男聲 B - 穩重、自然
'cmn-TW-Wavenet-C'  // 台灣男聲 C - 成熟、低沉
```

---

## 🚀 接下來需要做的事

### ⚠️ **必須完成**（約 5 分鐘）

#### 1. 更新 `.env` 文件

編輯 `chat-app/backend/.env`（不是 `.env.example`）：

```env
# 啟用 Google Cloud TTS
USE_GOOGLE_TTS=true

# 如果你已經有 Veo 的設置，這些應該已經存在：
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=asia-east1
```

#### 2. 啟用 Text-to-Speech API

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇你的專案（與 Veo 相同）
3. 搜尋「**Text-to-Speech API**」
4. 點擊「**啟用**」

#### 3. 重啟後端服務

```bash
cd chat-app/backend
npm run dev:backend
```

---

### 🎯 **建議完成**（可選，約 30 分鐘）

#### 4. 生成語音預覽（可選）

```bash
cd chat-app/backend

# 生成台灣語音預覽（推薦）
node scripts/generateVoicePreviewsGoogle.js --locale=cmn-TW

# 或生成所有語音預覽（40+ 個）
node scripts/generateVoicePreviewsGoogle.js
```

輸出位置：`frontend/public/voices/google/`

#### 5. 測試 API

```bash
# 獲取可用語音列表
curl http://localhost:4000/api/voices

# 獲取推薦語音
curl http://localhost:4000/api/voices/recommended

# 獲取當前 TTS 服務資訊
curl http://localhost:4000/api/voices/service
```

預期回應：
```json
{
  "service": "google",
  "name": "Google Cloud TTS",
  "features": {
    "costPerMillion": "$4",
    "freeQuota": "100 萬字元/月",
    "voiceCount": 43,
    "taiwanVoices": true
  }
}
```

---

## 💰 成本節省預估

### 假設每月使用量：100 萬字元

| 項目 | OpenAI TTS | Google Cloud TTS | 你的節省 |
|------|------------|------------------|----------|
| **費用** | $15.00 | **$0** (免費額度) | **$15 (100%)** |

### 假設每月使用量：200 萬字元

| 項目 | OpenAI TTS | Google Cloud TTS | 你的節省 |
|------|------------|------------------|----------|
| **費用** | $30.00 | **$4.00** | **$26 (87%)** |

**💸 預估年度節省：$180-312 USD**

---

## 🔄 自動備用機制

系統已配置自動備用機制：

1. **主要服務**：Google Cloud TTS（成本更低）
2. **備用服務**：OpenAI TTS（如果 Google 失敗）

```javascript
// 已實作的邏輯
try {
  // 嘗試使用 Google TTS
  return await generateSpeechWithGoogle(text, characterId);
} catch (error) {
  // 如果失敗，自動切換到 OpenAI TTS
  logger.warn('[TTS] Google TTS 失敗，切換到 OpenAI TTS');
  return await generateSpeechWithOpenAI(text, characterId);
}
```

**✅ 確保服務穩定性**，即使 Google TTS 暫時不可用也能正常運作！

---

## 📋 語音映射（現有角色自動轉換）

現有角色的 OpenAI 語音會自動映射到 Google 語音，無需修改資料庫：

| 現有角色語音 | 自動映射到 | 說明 |
|--------------|------------|------|
| `nova` | `cmn-TW-Wavenet-A` | 溫暖女性 → 台灣女性 A |
| `shimmer` | `cmn-TW-Wavenet-A` | 柔和女性 → 台灣女性 A |
| `echo` | `cmn-TW-Wavenet-B` | 男性 → 台灣男性 B |
| `onyx` | `cmn-TW-Wavenet-C` | 深沉男性 → 台灣男性 C |
| `alloy` | `cmn-TW-Wavenet-A` | 中性 → 台灣女性 A |

**範例**：
- 艾米麗角色（`voice: "shimmer"`）→ 自動使用 `cmn-TW-Wavenet-A`
- 雅晴角色（`voice: "nova"`）→ 自動使用 `cmn-TW-Wavenet-A`

---

## 🧪 測試檢查清單

完成遷移後，請測試以下功能：

### 基本測試

- [ ] 後端啟動成功，無錯誤
- [ ] API `/api/voices` 返回 43 個語音
- [ ] API `/api/voices/service` 顯示 `"service": "google"`

### 功能測試

- [ ] 前端對話介面正常載入
- [ ] 可以發送訊息並收到 AI 回應
- [ ] 點擊「播放語音」可以聽到台灣口音
- [ ] 語音播放流暢，無卡頓

### 錯誤處理測試

- [ ] 如果 Google TTS 失敗，自動切換到 OpenAI TTS
- [ ] 日誌中顯示正確的 TTS 服務選擇

---

## 📚 相關文件

詳細設置和使用說明請查看：

1. **[docs/GOOGLE_TTS_SETUP.md](docs\GOOGLE_TTS_SETUP.md)** - 完整設置指南
2. **[docs/TTS_COMPARISON.md](docs\TTS_COMPARISON.md)** - 服務對比分析
3. **[COST_OPTIMIZATION_PLAN.md](COST_OPTIMIZATION_PLAN.md)** - 成本優化方案

---

## ⚠️ 注意事項

### 1. 環境變數

確保 `chat-app/backend/.env` 已設置：
```env
USE_GOOGLE_TTS=true
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### 2. API 啟用

必須在 Google Cloud Console 啟用 **Text-to-Speech API**！

### 3. 保留 OpenAI API Key

建議保留 `OPENAI_API_KEY`，作為備用 TTS 服務。

### 4. Git 安全

**不要提交**以下敏感文件到 Git：
- `service-account-key.json`
- `.env`（包含 API 金鑰）

確認 `.gitignore` 已包含：
```
.env
.env.local
.env.production
service-account-key.json
*.key.json
```

---

## 🎯 下一步優化（可選）

如果想進一步優化，可以考慮：

### 1. 對話 API 切換到 Gemini

預估額外節省：**$40-70/月**

詳見：[COST_OPTIMIZATION_PLAN.md](COST_OPTIMIZATION_PLAN.md)

### 2. 加入 Redis 快取層

預估額外節省：**$10-20/月**（Firestore 讀取費用）

### 3. 嚴格限制影片生成

預估額外節省：**$45-180/月**

---

## 🆘 需要幫助？

### 常見問題

**Q: 啟動時出現 `UNAUTHENTICATED` 錯誤？**

A: 檢查 `GOOGLE_APPLICATION_CREDENTIALS` 是否正確指向服務帳號金鑰文件。

**Q: 語音品質不如預期？**

A: 確認使用的是 **Wavenet** 語音（`cmn-TW-Wavenet-A`），而不是 Standard。

**Q: 想暫時切回 OpenAI TTS？**

A: 在 `.env` 設置：
```env
USE_GOOGLE_TTS=false
```

### 詳細故障排除

請查看：[docs/GOOGLE_TTS_SETUP.md#故障排除](docs\GOOGLE_TTS_SETUP.md)

---

## ✅ 最終檢查清單

部署前確認：

- [ ] ✅ 已安裝 `@google-cloud/text-to-speech` 套件
- [ ] ⚠️ 已在 `.env` 設置 `USE_GOOGLE_TTS=true`
- [ ] ⚠️ 已在 Google Cloud Console 啟用 Text-to-Speech API
- [ ] ⚠️ 已設置 `GOOGLE_APPLICATION_CREDENTIALS`
- [ ] ⚠️ 已重啟後端服務
- [ ] 🟢 已測試 `/api/voices` API（可選）
- [ ] 🟢 已生成語音預覽（可選）
- [ ] 🟢 已測試語音播放功能（可選）

**⚠️ = 必須完成**
**🟢 = 建議完成**

---

## 🎉 恭喜！

你已經成功切換到 **Google Cloud TTS**，享受：

✅ **73% 成本節省**（$15 → $4 per 1M 字元）
✅ **每月 100 萬字元免費額度**
✅ **40+ 語音選擇**（包含台灣、粵語、日韓英等）
✅ **專屬台灣口音**
✅ **進階控制**（語速、音調、SSML）
✅ **自動備用機制**（穩定性保證）

**年度預估節省：$180-312 USD** 💰

---

**如有任何問題，請參考詳細文檔或詢問我！** 🚀
