# 角色創建資料保存修復 - Schema 驗證問題

## 🎯 根本原因

**後端 Schema 缺少必要字段！**

文件：`chat-app/backend/src/match/match.schemas.js`

### 問題代碼（第 61-89 行）

```javascript
export const createMatchSchema = {
  body: z.object({
    name: z.string().optional(),
    display_name: z.string().optional(),
    gender: z.enum(["male", "female", "其他"]),

    // ❌ 缺少以下關鍵字段：
    // - background (角色設定)
    // - secret_background (隱藏設定)
    // - first_message (開場白)
    // - portraitUrl (圖片 URL)
    // - appearanceDescription (外觀描述)
    // - styles (風格陣列)
    // - voice (語音)

    personality: z.string().optional(),
    hobbies: z.array(z.string()).optional(),
    // ...
  }),
};
```

### 問題流程

```
前端發送完整數據
  ↓
  {
    display_name: "若曦",
    background: "若曦是一位充滿好奇心的冒險者...",
    secret_background: "若曦的內心深處藏著對過去的懷念...",
    first_message: "嗨！準備好一起冒險了嗎？",
    portraitUrl: "https://...",
    voice: { id: "coral", ... }
  }
  ↓
validateRequest(createMatchSchema) 中間件
  ↓ ❌ 過濾掉未在 schema 中定義的字段
  ↓
  {
    display_name: "若曦",
    // background: ❌ 被過濾
    // secret_background: ❌ 被過濾
    // first_message: ❌ 被過濾
    // portraitUrl: ❌ 被過濾
    // voice: ❌ 被過濾
  }
  ↓
createMatch(req.body)
  ↓
保存到 Firestore
  ↓ ❌ 所有欄位都是空的
  {
    display_name: "若曦",
    background: "",  // ❌ 空字串
    secret_background: "",  // ❌ 空字串
    first_message: "",  // ❌ 空字串
    portraitUrl: "",  // ❌ 空字串
    voice: ""  // ❌ 空字串
  }
```

## ✅ 修復方案

### 修復後的 Schema（第 61-112 行）

```javascript
export const createMatchSchema = {
  body: z.object({
    // 基本資訊
    name: z.string().min(1).max(50).trim().optional(),
    display_name: z.string().min(1).max(50).trim().optional(),
    gender: z.enum(["male", "female", "其他"]),

    // ✅ 新增：角色創建流程必要字段
    background: z.string().max(1000).trim().optional(),
    secret_background: z.string().max(1000).trim().optional(),
    first_message: z.string().max(500).trim().optional(),
    portraitUrl: z.string().optional(),
    appearanceDescription: z.string().max(1000).trim().optional(),
    styles: z.array(z.string()).max(10).optional(),
    voice: z.union([
      z.string(),
      z.object({
        id: z.string(),
        label: z.string().optional(),
        description: z.string().optional(),
        gender: z.string().optional(),
        ageGroup: z.string().optional(),
      })
    ]).optional(),

    // 選填資訊
    personality: z.string().max(500).trim().optional(),
    hobbies: z.array(z.string()).max(10).optional(),
    // ...

    // 系統資訊
    creatorUid: commonSchemas.userId.optional(),
    creatorDisplayName: z.string().max(100).trim().optional(),
    flowId: z.string().min(1).trim().optional(),
    plot_hooks: z.array(z.string()).max(20).optional(),
    totalChatUsers: z.number().int().min(0).optional(),
    totalFavorites: z.number().int().min(0).optional(),
    locale: z.string().max(10).optional(),
    tags: z.array(z.string()).max(20).optional(),
    // ...
  }),
};
```

## 測試步驟

### 1. 重啟後端服務器（必須！）

```bash
# 停止後端服務器（按 Ctrl+C）
# 然後重新啟動
cd chat-app/backend
npm run dev
```

### 2. 創建新角色

1. 訪問 `http://192.168.1.107:5173/#/create-character/gender`
2. 選擇性別 → 選擇外觀 → 等待圖片生成
3. 選擇一張圖片 → 點擊「下一步」
4. 填寫所有設定欄位：
   - 角色名：例如「測試角色」
   - 角色設定：例如「一個友善的 AI 助手」
   - 隱藏設定：例如「測試用角色」
   - 開場白：例如「你好，很高興認識你！」
5. 點擊「下一步」→ 選擇語音（或跳過）→ 點擊「完成創建」

### 3. 驗證資料

#### 方法 1：查看角色詳情頁面

點擊「查看角色」，檢查以下字段是否顯示：
- ✅ 角色名
- ✅ 背景設定（角色設定）
- ✅ 隱藏設定
- ✅ 開場白
- ✅ 圖片
- ✅ 語音（如果選擇了）

#### 方法 2：使用診斷腳本

```bash
cd chat-app/backend
node scripts/check-character-data.js <角色ID>
```

角色 ID 可以從角色詳情頁面的 URL 獲取：`/#/character/match-xxxxx`

### 預期結果

✅ **修復成功的標誌**：

```bash
📋 檢查角色數據: match-xxxxx

============================================================

📌 基本信息:
  ID: match-xxxxx
  姓名: 測試角色
  性別: 女性
  語音: coral
  狀態: active

🖼️  圖片:
  頭像 URL: ✅ https://...

📝 詳細設定:
  背景設定 (background):
    ✅ 一個友善的 AI 助手

  隱藏設定 (secret_background):
    ✅ 測試用角色

  開場白 (first_message):
    ✅ 你好，很高興認識你！

  外觀描述 (appearanceDescription):
    ✅ 一位年輕女性，擁有及肩的波浪栗色長髮...

============================================================
```

❌ **仍有問題的標誌**：

```bash
📝 詳細設定:
  背景設定 (background):
    ❌ 未設定或為空

  隱藏設定 (secret_background):
    ❌ 未設定或為空

  開場白 (first_message):
    ❌ 未設定或為空
```

## 修復的文件清單

### 後端修復

1. ✅ **`chat-app/backend/src/match/match.schemas.js`**（第 69-104 行）
   - 新增 `background` 字段驗證
   - 新增 `secret_background` 字段驗證
   - 新增 `first_message` 字段驗證
   - 新增 `portraitUrl` 字段驗證
   - 新增 `appearanceDescription` 字段驗證
   - 新增 `styles` 字段驗證
   - 新增 `voice` 字段驗證（支援字串和物件兩種格式）
   - 新增其他系統字段（`creatorDisplayName`、`plot_hooks`、`totalChatUsers`、`totalFavorites`、`locale`）

### 前端修復（之前完成）

2. ✅ **`chat-app/frontend/src/composables/useCharacterCreationFlow.ts`**（第 427-462 行）
   - `syncSummaryToBackend()` 重新拋出所有錯誤

3. ✅ **`chat-app/frontend/src/views/CharacterCreateGeneratingView.vue`**（第 487-548 行）
   - `persistCreationSummary()` 改進錯誤處理
   - 選擇步驟和設定步驟的確認按鈕都有錯誤處理

4. ✅ **`chat-app/frontend/src/views/CharacterCreateVoiceView.vue`**（第 180-186 行）
   - AI 魔法師重置邏輯

## 技術細節

### 為什麼之前沒發現這個問題？

1. **驗證中間件的行為**：`validateRequest` 中間件使用 Zod 的 `.parse()` 方法，會**丟棄所有未在 schema 中定義的字段**。
2. **沒有錯誤提示**：因為數據格式「技術上」是正確的（符合 schema），只是缺少某些欄位。
3. **前端日誌具有誤導性**：前端日誌顯示數據正確發送，但看不到中間件過濾的過程。

### Zod Schema 驗證行為

```javascript
// Zod 的預設行為：strict mode
const schema = z.object({
  name: z.string(),
});

const input = {
  name: "test",
  age: 25,  // ← 未在 schema 中定義
};

const result = schema.parse(input);
console.log(result);
// 輸出: { name: "test" }
// age 字段被丟棄了！
```

### 防止類似問題的建議

1. **定期檢查 schema**：確保 schema 包含所有前端發送的字段
2. **使用 TypeScript**：在前後端都使用 TypeScript，可以在編譯時發現類型不匹配
3. **添加測試**：為創建角色的完整流程添加端到端測試
4. **日誌記錄**：在驗證中間件中記錄被過濾的字段（開發環境）

## 相關文檔

- 完整摘要：[CHARACTER_CREATION_FIX_SUMMARY.md](CHARACTER_CREATION_FIX_SUMMARY.md)
- 測試指南：[TESTING_CHARACTER_CREATION_FIX.md](TESTING_CHARACTER_CREATION_FIX.md)

---

**修復完成時間**：2025-01-19
**修復者**：Claude Code
**問題類型**：後端 Schema 驗證缺少必要字段
**受影響版本**：所有版本（直到此修復）
