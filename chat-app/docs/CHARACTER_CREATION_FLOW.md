# 角色創建流程文檔

## 📋 完整流程概覽

```
用戶進入 → 性別選擇 → 外觀設計 → 圖片生成 → 角色設定 → 語音選擇 → 創建完成
   ↓          ↓          ↓          ↓          ↓          ↓          ↓
清除狀態   保存性別   保存外觀   扣除資源   填寫資料   保存角色   清除狀態
```

---

## 🎯 各階段詳細說明

### 1️⃣ 性別選擇階段 (CharacterCreateGenderView.vue)

**路由**: `/character-create/gender`

**關鍵操作**:
```javascript
onMounted(() => {
  // 1. 強制清除所有舊狀態（確保全新開始）
  clearStoredCharacterCreationFlowId();  // 清除 localStorage 中的 flow ID
  clearCreationState();                   // 清除 sessionStorage

  // 2. 檢查用戶權限
  // 3. 查詢剩餘創建次數
  // 4. 顯示性別選項
});
```

**狀態清除內容**:
- `localStorage.removeItem('character-create-flow-id')`
- `sessionStorage.removeItem('character-create-summary')`
- `sessionStorage.removeItem('characterCreation.gender')`

**為什麼要在這裡清除?**
- ✅ 確保每次創建都是全新的 flow
- ✅ 避免重用舊圖片
- ✅ 避免創建卡未扣除問題

---

### 2️⃣ 外觀設計階段 (CharacterCreateAppearanceView.vue)

**路由**: `/character-create/appearance`

**關鍵操作**:
```javascript
// 用戶填寫/生成角色形象描述
const appearanceForm = {
  description: '',      // 形象描述
  styles: [],          // 風格標籤
  referenceImage: null // 參考圖片（可選）
};

// AI Magician 使用（限3次）
const aiMagicianUsageCount = ref(0);  // 存在 sessionStorage: `ai-magician-usage-${gender}`

// 點擊「確認生成」
const confirmGenerate = async () => {
  // 1. 創建/更新 flow（保存 appearance 數據）
  const flow = await createCharacterCreationFlow({
    status: 'appearance',
    appearance: appearanceData,
    metadata: { gender }
  });

  // 2. 保存 flow ID 到 localStorage
  storeCharacterCreationFlowId(flow.id);

  // 3. 跳轉到生成頁面
  router.push({ name: 'character-create-generating' });
};
```

**Flow 數據結構**:
```javascript
{
  id: 'flow-xxx',
  userId: 'user-123',
  status: 'appearance',
  persona: { name, tagline, hiddenProfile, prompt },
  appearance: { description, styles, referenceInfo },
  voice: { id, label },
  metadata: { gender: 'male' | 'female' | 'non-binary' },
  generation: {
    status: 'idle' | 'generating' | 'completed' | 'failed',
    result: { images: [...] }  // 生成的圖片
  }
}
```

---

### 3️⃣ 圖片生成階段 (CharacterCreateGeneratingView.vue)

**路由**: `/character-create/generating`

**關鍵操作**:
```javascript
onMounted(async () => {
  // 1. 檢查 flow 是否已有生成的圖片
  const flow = await fetchCharacterCreationFlow(flowId);

  if (flow?.generation?.result?.images?.length > 0) {
    // 已有圖片，直接顯示（重用）
    generatedResults.value = flow.generation.result.images;
    progress.value = 100;
  } else {
    // 2. 調用後端 API 生成圖片
    await triggerImageGeneration();
  }
});

const triggerImageGeneration = async () => {
  // 調用 POST /api/character-creation/flows/:flowId/generate-images
  const { images, flow } = await generateCharacterImages(flowId, {
    quality: 'low',
    count: 4
  });

  // 顯示生成的 4 張圖片
  generatedResults.value = images.map((img, index) => ({
    id: `generated-${index}`,
    label: `風格 ${index + 1}`,
    image: img.url
  }));
};
```

**後端 API 邏輯** (`POST /api/character-creation/flows/:flowId/generate-images`):

```javascript
// 1. 檢查 flow 和 appearance
const flow = getCreationFlow(flowId);
if (!flow?.appearance?.description) {
  throw new Error('尚未填寫角色形象描述');
}

// 2. 檢查並扣除創建資源（⭐ 關鍵邏輯）
const userId = flow.userId;
const limitCheck = await canCreateCharacter(userId);
if (!limitCheck.allowed) {
  throw new Error('已達到角色創建次數限制');
}

const stats = await getCreationStats(userId);

if (stats.remaining <= 0) {
  // ⚠️ 免費次數用完，必須扣除創建卡
  try {
    await consumeUserAsset(userId, 'createCards', 1);
    usedCreateCard = true;
    shouldRecordCreation = true;
  } catch (error) {
    // 創建卡不足，阻止創建
    throw new Error('創建卡數量不足');
  }
} else {
  // ✅ 有免費次數，稍後記錄使用
  shouldRecordCreation = true;
}

// 3. 生成圖片（使用 Gemini API）
const { flow, reused } = await generateCreationResult(flowId, {
  idempotencyKey,
  generator: async () => {
    const result = await generateCharacterImages({
      gender,
      description,
      styles,
      quality,
      count
    });
    return { images: result.images };
  }
});

// 4. 如果生成成功且不是重用，記錄創建次數
if (!reused && userId && shouldRecordCreation) {
  await recordCreation(userId, flowId);
}

// 5. 返回生成結果
return { flow, reused, images };
```

**Idempotency 機制**:
```javascript
// generateCreationResult() 函數的冪等性邏輯
if (flow.generation.status === 'completed' &&
    flow.generation.result &&
    flow.generation.idempotencyKey === requestedKey) {
  // 已經生成過且 key 相同，直接返回舊結果
  return {
    flow,
    reused: true,  // ⚠️ 重用標記
    result: flow.generation.result
  };
}

// 否則執行新的生成
flow.generation.status = 'generating';
flow.generation.idempotencyKey = requestedKey;
const result = await generator();
flow.generation.result = result;
flow.generation.status = 'completed';

return { flow, reused: false, result };
```

**重要：為什麼 `reused: true` 時不扣除創建卡?**
- Flow 已經生成過圖片，代表資源已經被消耗
- 避免重複扣除（例如網絡重試、頁面刷新）
- **這就是為什麼清除 flow ID 很重要！**

---

### 4️⃣ 角色設定階段 (CharacterCreateGeneratingView.vue - Settings Step)

**操作**:
```javascript
// 用戶選擇圖片後進入設定步驟
const personaForm = {
  name: '',           // 角色名（最多8字）
  tagline: '',        // 角色設定（最多200字）
  hiddenProfile: '',  // 隱藏設定（最多200字）
  prompt: ''          // 開場白（最多50字）
};

// 可選：使用 AI Magician 自動填寫
const openAIMagician = async () => {
  const persona = await generateCharacterPersonaWithAI(flowId);
  personaForm.name = persona.name;
  personaForm.tagline = persona.tagline;
  personaForm.hiddenProfile = persona.hiddenProfile;
  personaForm.prompt = persona.prompt;
};

// 填寫完成後跳轉到語音頁面
router.push({ name: 'character-create-voice' });
```

---

### 5️⃣ 語音選擇階段 (CharacterCreateVoiceView.vue)

**路由**: `/character-create/voice`

**關鍵操作**:
```javascript
// 選擇語音
const selectedVoiceId = ref('');

// 點擊「完成創建」
const handleComplete = async () => {
  // 1. 從 sessionStorage 讀取完整數據
  const summary = JSON.parse(sessionStorage.getItem('character-create-summary'));

  // 2. 組裝角色數據
  const characterData = {
    display_name: summary.persona.name,
    background: summary.persona.tagline,
    secret_background: summary.persona.hiddenProfile,
    first_message: summary.persona.prompt,
    portraitUrl: summary.appearance.image,
    gender: summary.gender,
    voice: selectedVoiceId.value,
    creator: userId,
    isPublic: false
  };

  // 3. 調用 API 保存角色
  const character = await createCharacter(characterData);

  // 4. ⭐ 清除所有創建狀態（關鍵）
  clearStoredCharacterCreationFlowId();  // 清除 flow ID

  sessionStorage.removeItem('character-create-summary');
  sessionStorage.removeItem('characterCreation.gender');

  // 清除所有性別的 AI Magician 計數器
  ['male', 'female', 'non-binary'].forEach(gender => {
    sessionStorage.removeItem(`ai-magician-usage-${gender}`);
  });

  // 5. 顯示成功彈窗
  isCharacterCreatedModalVisible.value = true;

  // 6. 跳轉到「我的角色」頁面
  router.replace({ name: 'my-characters' });
};
```

---

## 🔑 關鍵邏輯總結

### 創建卡扣除邏輯

```
用戶點擊「確認生成」
    ↓
進入生成頁面
    ↓
後端 API: POST /flows/:flowId/generate-images
    ↓
檢查是否為 Flow 重用？
    ├─ 是（reused: true）
    │   ↓
    │   直接返回舊圖片，不扣除創建卡 ✅
    │
    └─ 否（reused: false）
        ↓
        檢查免費次數是否用完？
        ├─ 是（remaining <= 0）
        │   ↓
        │   扣除 1 張創建卡 💳
        │   ↓
        │   創建卡不足？
        │   ├─ 是 → 拋出錯誤，阻止生成 ❌
        │   └─ 否 → 繼續生成 ✅
        │
        └─ 否（remaining > 0）
            ↓
            使用免費次數，不扣除創建卡 🆓
```

### Flow 重用條件

Flow 會被重用（`reused: true`）當：
1. ✅ `flow.generation.status === 'completed'`
2. ✅ `flow.generation.result` 存在
3. ✅ `flow.generation.idempotencyKey === requestedKey`（或都為空）

**避免重用的方法**：
- 在創建成功後清除 flow ID
- 在性別選擇頁面清除 flow ID
- 每次創建使用全新的 flow

### AI Magician 計數器

**存儲位置**:
```javascript
sessionStorage.setItem(`ai-magician-usage-${gender}`, count);
// 例如：ai-magician-usage-male = 2
```

**重置時機**:
1. ✅ 創建成功後（CharacterCreateVoiceView.vue）
2. ✅ 性別選擇頁面載入時（CharacterCreateGenderView.vue）

---

## 🐛 已修復的問題

### 問題 1：創建卡未扣除
**原因**: Flow 被重用，`reused: true` 時不執行扣除邏輯
**修復**: 在性別選擇頁面強制清除 flow ID

### 問題 2：總是顯示同一張圖片
**原因**: 舊 flow ID 保存在 localStorage，重用舊圖片
**修復**: 在性別選擇頁面和創建成功後清除 flow ID

### 問題 3：AI Magician 計數器未重置
**原因**: 創建成功後沒有清除 sessionStorage 計數器
**修復**: 在創建成功後清除所有性別的計數器

---

## 📊 數據流向圖

```
┌─────────────────────────────────────────────────────────────┐
│                    前端 Flow 狀態管理                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  localStorage                    sessionStorage               │
│  ├─ character-create-flow-id    ├─ character-create-summary │
│  │  (flow UUID)                 │  { persona, appearance }  │
│  │                               │                            │
│  │                               ├─ characterCreation.gender │
│  │                               │  (male/female/non-binary) │
│  │                               │                            │
│  │                               └─ ai-magician-usage-*      │
│  │                                  (0-3 次計數)             │
│  │                                                            │
│  └─ 清除時機：                                               │
│     • 性別選擇頁面載入時 ✅                                  │
│     • 創建成功後 ✅                                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          ↕ API 調用
┌─────────────────────────────────────────────────────────────┐
│                    後端 Flow 記憶體存儲                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  flowStore (Map)                                             │
│  └─ flow-xxx: {                                              │
│       id: 'flow-xxx',                                        │
│       userId: 'user-123',                                    │
│       status: 'completed',                                   │
│       generation: {                                          │
│         status: 'completed',                                 │
│         idempotencyKey: 'flow-xxx-images',                  │
│         result: {                                            │
│           images: [url1, url2, url3, url4]  // 生成的圖片   │
│         }                                                    │
│       }                                                      │
│     }                                                        │
│                                                               │
│  ⚠️ 注意：後端重啟後 flowStore 會清空                       │
│  ✅ 前端通過 localStorage 保存 flow ID 實現持久化            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          ↕ 資產扣除
┌─────────────────────────────────────────────────────────────┐
│                    Firestore 數據持久化                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  users/{userId}/                                             │
│  └─ assets: {                                                │
│       createCards: 5  // 創建卡數量                         │
│     }                                                        │
│                                                               │
│  usage_limits/{userId}/                                      │
│  └─ character_creation: {                                    │
│       count: 2,        // 已使用次數                        │
│       cards: 0         // 購買的卡片（已棄用）              │
│     }                                                        │
│                                                               │
│  asset_audit_logs/                                           │
│  └─ {logId}: {                                               │
│       userId,                                                │
│       assetType: 'createCards',                             │
│       action: 'consume',                                     │
│       amount: 1,                                             │
│       reason: '創建角色'                                     │
│     }                                                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 測試場景

### 場景 1：正常創建流程（有免費次數）
1. ✅ 用戶有 3 次免費創建次數
2. ✅ 創建角色成功
3. ✅ 不扣除創建卡
4. ✅ 免費次數 3 → 2

### 場景 2：正常創建流程（無免費次數）
1. ✅ 用戶免費次數用完（remaining = 0）
2. ✅ 用戶有 5 張創建卡
3. ✅ 創建角色成功
4. ✅ 扣除 1 張創建卡（5 → 4）

### 場景 3：創建失敗（創建卡不足）
1. ✅ 用戶免費次數用完
2. ✅ 用戶創建卡數量 = 0
3. ❌ 創建失敗，提示「創建卡數量不足」
4. ✅ 不記錄創建次數

### 場景 4：Flow 重用（頁面刷新）
1. ✅ 用戶生成圖片成功（扣除了創建卡）
2. ✅ 用戶刷新頁面
3. ✅ Flow 重用，直接顯示舊圖片
4. ✅ 不重複扣除創建卡

### 場景 5：重新創建（狀態清除）
1. ✅ 用戶創建完成第一個角色
2. ✅ 系統清除 flow ID 和 AI Magician 計數器
3. ✅ 用戶點擊「創建新角色」
4. ✅ 進入性別選擇頁面，清除所有舊狀態
5. ✅ 創建第二個角色時生成全新圖片
6. ✅ AI Magician 計數器從 0 開始

---

## 📖 相關文件

- **前端組件**:
  - [CharacterCreateGenderView.vue](../frontend/src/views/CharacterCreateGenderView.vue)
  - [CharacterCreateAppearanceView.vue](../frontend/src/views/CharacterCreateAppearanceView.vue)
  - [CharacterCreateGeneratingView.vue](../frontend/src/views/CharacterCreateGeneratingView.vue)
  - [CharacterCreateVoiceView.vue](../frontend/src/views/CharacterCreateVoiceView.vue)

- **後端服務**:
  - [characterCreation.service.js](../backend/src/characterCreation/characterCreation.service.js)
  - [characterCreation.routes.js](../backend/src/characterCreation/characterCreation.routes.js)
  - [characterCreationLimit.service.js](../backend/src/characterCreation/characterCreationLimit.service.js)

- **資產服務**:
  - [assets.service.js](../backend/src/user/assets.service.js)
  - [assetAuditLog.service.js](../backend/src/user/assetAuditLog.service.js)

---

## 版本歷史

### v1.2 (2025-11-09) - 修復 Flow 重用問題
- ✅ 在性別選擇頁面強制清除 flow ID
- ✅ 在創建成功後清除 AI Magician 計數器
- ✅ 修復創建卡未扣除問題
- ✅ 修復總是顯示同一張圖片問題

### v1.1 (2025-11-08) - 添加 Idempotency
- ✅ 實現 Flow 重用機制
- ✅ 添加 idempotencyKey 避免重複生成

### v1.0 - 初始版本
- ✅ 基本創建流程
- ✅ AI 圖片生成
- ✅ 創建限制系統
