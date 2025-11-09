# TTS 語音服務對比分析

## 📊 現有實作分析

### 目前使用：OpenAI TTS

#### 實作位置
- **主要服務**：[chat-app\backend\src\ai\ai.service.js:624-655](chat-app\backend\src\ai\ai.service.js)
- **API 路由**：[chat-app\backend\src\ai\ai.routes.js](chat-app\backend\src\ai\ai.routes.js)
- **語音預覽生成**：[chat-app\backend\scripts\generateVoicePreviews.js](chat-app\backend\scripts\generateVoicePreviews.js)

#### 目前實作方式

```javascript
// 從 ai.service.js
export const generateSpeech = async (text, characterId) => {
  // 獲取角色資料以取得語音設定
  const character = getMatchById(characterId);
  const voice = character?.voice || 'nova'; // 預設使用 nova 語音

  const client = getOpenAIClient();

  const response = await client.audio.speech.create({
    model: 'tts-1',           // 使用標準 TTS 模型
    voice: voice,              // 角色專屬語音
    input: text.trim(),        // 要轉換的文字
    response_format: 'mp3',    // 輸出格式 MP3
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
};
```

#### 可用語音選項（10 種）

| 語音 ID | 描述 | 用途 |
|---------|------|------|
| `alloy` | 中性、平衡 | 通用 |
| `ash` | - | - |
| `ballad` | - | - |
| `coral` | - | - |
| `echo` | 男性 | 男性角色 |
| `fable` | 英式口音 | 特定角色 |
| `onyx` | 深沉男性 | 成熟男性角色 |
| `nova` | **女性、溫暖**（預設） | 女性角色 |
| `sage` | - | - |
| `verse` | - | - |
| `shimmer` | 柔和女性 | 溫柔女性角色 |

**目前角色使用**：
- 艾米麗：`shimmer`
- 雅晴：`nova`

---

## 🆚 OpenAI TTS vs Google Cloud TTS 詳細對比

### 1️⃣ **成本對比**

| 項目 | OpenAI TTS | Google Cloud TTS |
|------|------------|------------------|
| **定價模型** | $15.00 / 1M 字元 | **$4.00 / 1M 字元** |
| **免費額度** | **無** | **前 100 萬字元/月** ✅ |
| **成本節省** | - | **73% 更便宜** |
| **月度免費額度價值** | $0 | **$4** (等值) |

#### 實際使用成本範例

假設每月處理 **50 萬字元**（約 16,666 次 30 字語音）：

| 服務 | 計算 | 月成本 |
|------|------|--------|
| OpenAI TTS | 0.5M × $15 | **$7.50** |
| Google Cloud TTS | 完全在免費額度內 | **$0** ✅ |

假設每月處理 **200 萬字元**（超出免費額度）：

| 服務 | 計算 | 月成本 |
|------|------|--------|
| OpenAI TTS | 2M × $15 | **$30.00** |
| Google Cloud TTS | (2M - 1M) × $4 | **$4.00** |

**💰 節省：$26/月（87%）**

---

### 2️⃣ **語音品質對比**

| 項目 | OpenAI TTS | Google Cloud TTS |
|------|------------|------------------|
| **自然度** | ⭐⭐⭐⭐⭐ 非常自然 | ⭐⭐⭐⭐⭐ 非常自然 |
| **情感表達** | ⭐⭐⭐⭐ 良好 | ⭐⭐⭐⭐ 良好 |
| **繁體中文支援** | ⭐⭐⭐⭐ 較佳（但語音有限） | ⭐⭐⭐⭐⭐ 優秀 |
| **台灣口音** | ❌ 不支援 | ✅ **專門的台灣口音** |
| **語音選擇** | 10 種通用語音 | **40+ 中文語音**（包含台灣） |

---

### 3️⃣ **語音選項對比**

#### OpenAI TTS - 10 種語音
```
通用語音（多語言共用）：
✓ alloy, ash, ballad, coral
✓ echo, fable, onyx
✓ nova, sage, verse, shimmer

限制：
- 無法指定語言專屬語音
- 無台灣口音選項
- 語音數量較少
```

#### Google Cloud TTS - 繁體中文專用語音（部分）

| 語音名稱 | 性別 | 口音 | 適合角色 |
|---------|------|------|----------|
| `cmn-TW-Wavenet-A` | 女性 | 台灣 | 溫柔女性 |
| `cmn-TW-Wavenet-B` | 男性 | 台灣 | 男性角色 |
| `cmn-TW-Wavenet-C` | 男性 | 台灣 | 成熟男性 |
| `cmn-TW-Standard-A` | 女性 | 台灣 | 通用女性 |
| `cmn-TW-Standard-B` | 男性 | 台灣 | 通用男性 |
| `cmn-TW-Standard-C` | 男性 | 台灣 | 通用男性 |
| `cmn-CN-Wavenet-A` | 女性 | 中國大陸 | 可選 |
| `cmn-CN-Wavenet-B` | 男性 | 中國大陸 | 可選 |
| ...更多選項... | - | - | - |

**Wavenet 語音**：最高品質（建議使用）
**Standard 語音**：標準品質（更便宜）

---

### 4️⃣ **技術特性對比**

| 特性 | OpenAI TTS | Google Cloud TTS |
|------|------------|------------------|
| **支援格式** | MP3, AAC, FLAC, WAV, PCM | MP3, WAV, OGG |
| **採樣率** | 固定 | **可自訂** (8k-48k Hz) |
| **語速控制** | ❌ 無 | ✅ **0.25x - 4.0x** |
| **音調控制** | ❌ 無 | ✅ **-20 ~ +20 semitones** |
| **SSML 支援** | ❌ 無 | ✅ **完整 SSML** |
| **音量標準化** | ❌ 無 | ✅ **可設定 dB gain** |
| **最大字元數** | 4096 字元 | **5000 字元** |

**SSML 範例**（Google Cloud TTS）：
```xml
<speak>
  你好！<break time="500ms"/>
  今天過得<prosody rate="slow" pitch="+2st">還好嗎</prosody>？
</speak>
```

可實現：
- 停頓控制
- 語速變化
- 音調變化
- 強調重音

---

### 5️⃣ **API 設定複雜度對比**

#### OpenAI TTS（目前實作）- 非常簡單 ✅

```javascript
// 1. 安裝套件
npm install openai

// 2. 設定 API Key
OPENAI_API_KEY=sk-...

// 3. 生成語音（3 行代碼）
const client = new OpenAI({ apiKey });
const response = await client.audio.speech.create({
  model: 'tts-1',
  voice: 'nova',
  input: text
});
```

**設定時間**：5 分鐘

---

#### Google Cloud TTS - 中等複雜度 ⚠️

```javascript
// 1. 安裝套件
npm install @google-cloud/text-to-speech

// 2. 設定服務帳號金鑰（與 Veo 共用）
// 已有 GOOGLE_APPLICATION_CREDENTIALS

// 3. 生成語音
const client = new TextToSpeechClient();
const [response] = await client.synthesizeSpeech({
  input: { text: text },
  voice: {
    languageCode: 'cmn-TW',
    name: 'cmn-TW-Wavenet-A',
    ssmlGender: 'FEMALE'
  },
  audioConfig: {
    audioEncoding: 'MP3',
    speakingRate: 1.0,
    pitch: 0
  }
});
```

**設定時間**：15-30 分鐘（需設定 GCP 服務帳號，但已有 Veo 設定）

---

### 6️⃣ **整合現有系統的難度**

#### 需要修改的文件

| 檔案 | 修改內容 | 難度 |
|------|----------|------|
| `backend/.env` | 已有 `GOOGLE_APPLICATION_CREDENTIALS` | ✅ 無需修改 |
| `ai.service.js` | 創建 `generateSpeechWithGoogle()` 函數 | 🟡 中等 |
| 新增文件 | `ai/googleTts.service.js` | 🟢 容易 |
| `ai.routes.js` | 切換調用 Google TTS | 🟢 容易 |

**預估工作量**：
- 創建服務：1-2 小時
- 測試調整：1-2 小時
- **總計**：2-4 小時

---

### 7️⃣ **現有限制系統相容性**

✅ **完全相容**！

目前的語音限制系統在以下文件中：
- `voiceLimit.service.js`
- `voiceLimit.routes.js`
- `config/limits.js`

**限制邏輯**：
```javascript
// 免費用戶：每個角色 10 次語音
FREE_PER_CHARACTER: 10

// VIP/VVIP：無限語音
PAID_UNLIMITED: -1

// 觀看廣告解鎖：+5 次
UNLOCKED_PER_AD: 5
```

**切換 TTS 服務不影響限制系統**，因為限制在 API 層而非 TTS 層。

---

## 📋 優缺點總結

### OpenAI TTS

#### ✅ 優點
1. **極簡設定**：3 行代碼即可使用
2. **已經整合**：目前已在使用，無需遷移
3. **穩定可靠**：OpenAI 官方服務
4. **多語言支援**：同一語音可處理多種語言

#### ❌ 缺點
1. **成本高**：$15/1M 字元，無免費額度
2. **無免費額度**：每次調用都要付費
3. **語音選擇少**：只有 10 種通用語音
4. **無台灣口音**：繁體中文使用通用語音
5. **無進階控制**：不支援語速、音調、SSML

---

### Google Cloud TTS

#### ✅ 優點
1. **成本超低**：比 OpenAI 便宜 **73%**
2. **大量免費額度**：每月前 100 萬字元免費
3. **專屬台灣語音**：`cmn-TW-Wavenet-A/B/C`
4. **語音選擇多**：40+ 中文語音
5. **進階控制**：語速、音調、SSML、音量
6. **高品質 Wavenet**：最先進的神經網路語音
7. **已有服務帳號**：與 Veo 共用 GCP 設定

#### ❌ 缺點
1. **設定較複雜**：需要 GCP 服務帳號（已設定）
2. **API 參數較多**：需要指定語言、語音、性別
3. **遷移成本**：需要修改現有代碼（2-4 小時）

---

## 🎯 建議方案

### 推薦：切換到 Google Cloud TTS ⭐

#### 理由：
1. **成本節省顯著**：每月可省 **$10-25** (83%)
2. **品質更好**：專屬台灣口音，用戶體驗更佳
3. **功能更強**：支援語速、音調控制
4. **免費額度充足**：小型應用可能完全免費
5. **已有基礎設施**：GCP 服務帳號已設定（Veo）

#### 實施建議：

**Phase 1：並行測試（1 週）**
```javascript
// 保留 OpenAI TTS，同時加入 Google TTS
// 讓部分測試用戶使用 Google TTS
// 收集品質反饋
```

**Phase 2：逐步切換（1-2 週）**
```javascript
// 免費用戶優先切換
// VIP/VVIP 用戶保持 OpenAI（或給予選擇）
// 監控錯誤率和滿意度
```

**Phase 3：完全遷移（1 週）**
```javascript
// 全部用戶切換到 Google TTS
// 移除 OpenAI TTS 依賴（保留備用）
```

---

## 💻 實作範例

### Google Cloud TTS 服務實作

創建新文件：`chat-app/backend/src/ai/googleTts.service.js`

```javascript
/**
 * Google Cloud Text-to-Speech 服務
 */
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import logger from '../utils/logger.js';
import { getMatchById } from '../match/match.service.js';

let cachedClient = null;

/**
 * 獲取 Google TTS 客戶端
 */
const getGoogleTtsClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  // 使用應用程式預設憑證（與 Veo 共用）
  // GOOGLE_APPLICATION_CREDENTIALS 環境變數已設定
  cachedClient = new TextToSpeechClient();
  return cachedClient;
};

/**
 * 語音映射表（OpenAI 語音 → Google 語音）
 * 用於平滑遷移現有角色
 */
const VOICE_MAPPING = {
  // 女性語音
  'nova': 'cmn-TW-Wavenet-A',      // 溫暖女性 → 台灣女性 A
  'shimmer': 'cmn-TW-Wavenet-A',   // 柔和女性 → 台灣女性 A
  'alloy': 'cmn-TW-Wavenet-C',     // 中性 → 台灣男性 C（中性）

  // 男性語音
  'echo': 'cmn-TW-Wavenet-B',      // 男性 → 台灣男性 B
  'fable': 'cmn-TW-Wavenet-B',     // 英式男性 → 台灣男性 B
  'onyx': 'cmn-TW-Wavenet-C',      // 深沉男性 → 台灣男性 C

  // 其他
  'ash': 'cmn-TW-Wavenet-A',
  'ballad': 'cmn-TW-Wavenet-B',
  'coral': 'cmn-TW-Wavenet-A',
  'sage': 'cmn-TW-Wavenet-C',
  'verse': 'cmn-TW-Wavenet-A',
};

/**
 * 從 Google 語音名稱判斷性別
 */
const getGenderFromVoiceName = (voiceName) => {
  if (voiceName.includes('-A')) return 'FEMALE';
  if (voiceName.includes('-B')) return 'MALE';
  if (voiceName.includes('-C')) return 'MALE';
  return 'NEUTRAL';
};

/**
 * 使用 Google Cloud TTS 生成語音
 * @param {string} text - 要轉換的文字
 * @param {string} characterId - 角色 ID
 * @param {object} options - 選項 { speakingRate, pitch }
 * @returns {Promise<Buffer>} 音頻數據
 */
export const generateSpeechWithGoogle = async (text, characterId, options = {}) => {
  if (!text || typeof text !== 'string' || !text.trim()) {
    const error = new Error("需要提供要轉換的文字");
    error.status = 400;
    throw error;
  }

  // 獲取角色資料以取得語音設定
  const character = getMatchById(characterId);
  const openaiVoice = character?.voice || 'nova';

  // 映射到 Google 語音
  const googleVoice = VOICE_MAPPING[openaiVoice] || 'cmn-TW-Wavenet-A';
  const gender = getGenderFromVoiceName(googleVoice);

  try {
    const client = getGoogleTtsClient();

    // 構建請求
    const request = {
      input: { text: text.trim() },
      voice: {
        languageCode: 'cmn-TW',        // 繁體中文（台灣）
        name: googleVoice,             // 語音名稱
        ssmlGender: gender,            // 性別
      },
      audioConfig: {
        audioEncoding: 'MP3',          // 輸出格式
        speakingRate: options.speakingRate || 1.0,  // 語速 (0.25-4.0)
        pitch: options.pitch || 0,     // 音調 (-20 ~ +20)
        volumeGainDb: 0,               // 音量增益
      },
    };

    logger.info('[Google TTS] 生成語音:', {
      characterId,
      openaiVoice,
      googleVoice,
      textLength: text.length,
    });

    const [response] = await client.synthesizeSpeech(request);

    // response.audioContent 已經是 Buffer
    return response.audioContent;

  } catch (error) {
    logger.error(
      `Google TTS 生成語音失敗:`,
      error instanceof Error ? error.message : error
    );
    throw new Error("語音生成失敗，請稍後再試");
  }
};

/**
 * 使用 SSML 生成進階語音（支援停頓、強調等）
 */
export const generateSpeechWithSSML = async (ssml, characterId, options = {}) => {
  // ... SSML 實作 ...
};
```

---

### 修改 ai.service.js

```javascript
// 在 ai.service.js 中添加選擇邏輯

import { generateSpeechWithGoogle } from './googleTts.service.js';

// 環境變數控制使用哪個 TTS
const USE_GOOGLE_TTS = process.env.USE_GOOGLE_TTS === 'true';

export const generateSpeech = async (text, characterId) => {
  if (USE_GOOGLE_TTS) {
    // 使用 Google Cloud TTS
    return generateSpeechWithGoogle(text, characterId);
  } else {
    // 使用 OpenAI TTS（保持現有實作）
    return generateSpeechWithOpenAI(text, characterId);
  }
};

// 將現有實作重命名
const generateSpeechWithOpenAI = async (text, characterId) => {
  // ... 現有的 OpenAI TTS 代碼 ...
};
```

---

### 環境變數配置

```env
# backend/.env

# TTS 服務選擇
USE_GOOGLE_TTS=true  # true = Google, false = OpenAI

# Google Cloud（已有，與 Veo 共用）
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json

# OpenAI（保留作為備用）
OPENAI_API_KEY=sk-...
```

---

## 📊 成本對比表（月度）

假設每月 50 萬字元（約 16,666 次 30 字語音）：

| 項目 | OpenAI TTS | Google Cloud TTS | 節省 |
|------|------------|------------------|------|
| 基礎費用 | $7.50 | **$0** (免費額度) | **$7.50 (100%)** |

假設每月 200 萬字元（中型應用）：

| 項目 | OpenAI TTS | Google Cloud TTS | 節省 |
|------|------------|------------------|------|
| 基礎費用 | $30.00 | $4.00 | **$26.00 (87%)** |

假設每月 500 萬字元（大型應用）：

| 項目 | OpenAI TTS | Google Cloud TTS | 節省 |
|------|------------|------------------|------|
| 基礎費用 | $75.00 | $16.00 | **$59.00 (79%)** |

---

## ⚠️ 遷移注意事項

### 1. 語音預覽需要重新生成

目前使用的語音預覽檔案（`frontend/public/voices/*.mp3`）是 OpenAI 語音。

**建議**：
```bash
# 創建新的 Google TTS 語音預覽生成腳本
node backend/scripts/generateVoicePreviewsGoogle.js

# 生成台灣語音預覽
- cmn-TW-Wavenet-A.mp3
- cmn-TW-Wavenet-B.mp3
- cmn-TW-Wavenet-C.mp3
```

### 2. 語音選擇 UI 需要更新

前端角色創建/編輯頁面的語音選擇下拉選單需要更新。

**目前**：
```javascript
voices: ['alloy', 'echo', 'fable', 'nova', 'shimmer', ...]
```

**更新後**：
```javascript
voices: [
  { id: 'cmn-TW-Wavenet-A', name: '台灣女聲 A', gender: '女性' },
  { id: 'cmn-TW-Wavenet-B', name: '台灣男聲 B', gender: '男性' },
  { id: 'cmn-TW-Wavenet-C', name: '台灣男聲 C', gender: '男性' },
  // ... 更多選項
]
```

### 3. 現有角色語音需要映射

使用 `VOICE_MAPPING` 自動轉換，無需修改資料庫。

### 4. 錯誤處理和重試

Google Cloud TTS 可能有不同的錯誤碼：
- `INVALID_ARGUMENT`
- `QUOTA_EXCEEDED`
- `UNAUTHENTICATED`

建議加入適當的錯誤處理和重試邏輯。

---

## 🚀 實施計畫

### Phase 1：開發環境測試（3 天）
- [ ] 安裝 `@google-cloud/text-to-speech`
- [ ] 創建 `googleTts.service.js`
- [ ] 在開發環境測試語音品質
- [ ] 生成 Google 語音預覽檔案
- [ ] 比較兩種 TTS 的品質差異

### Phase 2：並行運行（1 週）
- [ ] 添加 `USE_GOOGLE_TTS` 環境變數開關
- [ ] 保留 OpenAI TTS 作為備用
- [ ] 在測試帳號上使用 Google TTS
- [ ] 收集用戶反饋
- [ ] 監控錯誤率和延遲

### Phase 3：逐步遷移（1-2 週）
- [ ] 免費用戶優先切換到 Google TTS
- [ ] VIP 用戶選擇性切換
- [ ] 更新前端語音選擇 UI
- [ ] 更新文檔說明

### Phase 4：完全切換（1 週）
- [ ] 所有用戶切換到 Google TTS
- [ ] 移除 OpenAI TTS 依賴（保留代碼作為備用）
- [ ] 更新部署文檔
- [ ] 完成成本監控報表

**總時間**：3-4 週
**預估工作量**：10-15 小時

---

## 📞 需要協助嗎？

如果你決定進行遷移，我可以協助：

1. ✅ 撰寫完整的 `googleTts.service.js`
2. ✅ 修改 `ai.service.js` 添加 TTS 選擇邏輯
3. ✅ 創建 Google 語音預覽生成腳本
4. ✅ 更新前端語音選擇 UI
5. ✅ 撰寫遷移測試計畫
6. ✅ 設定錯誤監控和日誌

**請告訴我是否要開始實作？** 🎯
