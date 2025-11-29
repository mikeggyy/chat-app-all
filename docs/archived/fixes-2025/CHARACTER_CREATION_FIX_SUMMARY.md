# 角色創建資料保存修復 - 完整摘要

## 問題描述

用戶報告創建角色後，角色詳情頁面缺少以下欄位：
- **背景設定** (`background`)
- **隱藏設定** (`secret_background`)
- **開場白** (`first_message`)
- **圖片** (`portraitUrl`)
- **語音** (`voice`)

測試案例：角色 "美玲" (ID: `match-1763545954300-rrzog6v`) 的所有 persona 欄位都是空的。

## 根本原因分析

### 🔥 核心問題：靜默錯誤吞併

**問題文件**：`chat-app/frontend/src/composables/useCharacterCreationFlow.ts`

**問題代碼**（第 427-456 行）：

```typescript
const syncSummaryToBackend = async (options: SyncSummaryOptions = {}): Promise<void> => {
  // ... 構建 payload ...

  try {
    await ensureFlowInitialized();
  } catch (error) {
    return;  // ❌ 靜默返回，調用者不知道失敗了
  }

  if (!flowId.value) {
    return;  // ❌ 靜默返回，調用者不知道失敗了
  }

  try {
    // ... 調用 API ...
    const updated = await updateCharacterCreationFlow(flowId.value, payload);
    applyFlowRecord(updated);
    lastFlowSyncError.value = null;
  } catch (error: any) {
    lastFlowSyncError.value = error;  // ❌ 只設置錯誤，不重新拋出
  } finally {
    isSyncingSummary.value = false;
  }
};
```

**影響**：
1. 當 `syncSummaryToBackend` 失敗時（網絡錯誤、後端錯誤等），函數靜默返回
2. 調用者（`CharacterCreateGeneratingView.vue`）無法知道同步失敗
3. 即使 persona 數據沒有保存到後端，用戶仍能繼續下一步
4. 最終創建角色時，因為沒有 persona 數據，導致所有欄位都是空的

### 次要問題：前端也有錯誤吞併

**問題文件**：`chat-app/frontend/src/views/CharacterCreateGeneratingView.vue`

**原始問題代碼**（第 492-494 行）：

```javascript
} catch {
  // 錯誤已在函式內處理  ← 這會吞併錯誤！
}
```

雖然我們修復了這個問題，但因為 `syncSummaryToBackend` 內部已經吞併了錯誤，所以這個 catch 塊實際上不會捕獲到任何錯誤。

## 修復方案

### 修復 1：`useCharacterCreationFlow.ts` - 重新拋出錯誤

**文件**：`chat-app/frontend/src/composables/useCharacterCreationFlow.ts`

**修改位置**：第 427-462 行

**修改內容**：

```typescript
const syncSummaryToBackend = async (options: SyncSummaryOptions = {}): Promise<void> => {
  // ... 構建 payload ...

  try {
    await ensureFlowInitialized();
  } catch (error) {
    // ✅ 修復：重新拋出初始化錯誤
    console.error('[useCharacterCreationFlow] Flow 初始化失敗:', error);
    throw new Error('無法初始化角色創建流程，請檢查網絡連接');
  }

  if (!flowId.value) {
    // ✅ 修復：沒有 flowId 時拋出錯誤
    throw new Error('缺少角色創建流程 ID，請重新開始創建流程');
  }

  try {
    isSyncingSummary.value = true;
    // ... 調用 API ...
    const updated = await updateCharacterCreationFlow(flowId.value, payload);
    applyFlowRecord(updated);
    lastFlowSyncError.value = null;
  } catch (error: any) {
    lastFlowSyncError.value = error;
    // ✅ 修復：重新拋出同步錯誤
    console.error('[useCharacterCreationFlow] 同步摘要到後端失敗:', error);
    throw new Error(error?.message || '保存角色資料失敗，請檢查網絡連接後重試');
  } finally {
    isSyncingSummary.value = false;
  }
};
```

### 修復 2：`CharacterCreateGeneratingView.vue` - 改進錯誤處理

**文件**：`chat-app/frontend/src/views/CharacterCreateGeneratingView.vue`

**修改 1**：`persistCreationSummary()` 函數（第 487-501 行）

```javascript
try {
  await syncSummaryToBackend({
    summary,
    statusOverride: "voice",
  });
} catch (error: any) {
  // ✅ 修復：捕獲錯誤並顯示提示
  console.error('[CharacterCreateGeneratingView] 保存角色設定失敗:', error);
  showErrorToast(error?.message || "保存角色設定失敗，請檢查網絡連接後重試");

  // ✅ 修復：重新拋出錯誤，阻止後續的頁面跳轉
  throw error;
}
```

**修改 2**：設定步驟確認按鈕（第 541-548 行）

```javascript
try {
  await persistCreationSummary();
  // 只有在數據成功保存後才跳轉
  router.push({ name: "character-create-voice" }).catch(() => {});
} catch (error) {
  // ✅ 保存失敗，停留在當前頁面，讓用戶重試
  console.error('[CharacterCreateGeneratingView] 無法進入語音選擇步驟:', error);
}
```

**修改 3**：選擇步驟確認按鈕（第 524-532 行）

```javascript
try {
  // 在進入設定步驟前，先同步選擇的外觀到後端
  await syncSummaryToBackend({} as any);
  enterSettingsStep();
} catch (error: any) {
  // ✅ 同步失敗，停留在當前頁面
  console.error('[CharacterCreateGeneratingView] 同步外觀數據失敗:', error);
  showErrorToast(error?.message || "保存外觀設定失敗，請檢查網絡連接後重試");
}
```

### 修復 3：AI 魔法師重置

**文件**：`chat-app/frontend/src/views/CharacterCreateVoiceView.vue`

**修改位置**：第 180-186 行

```typescript
// 🔥 新增：清除 characterCreation store 狀態（包括 AI 魔法師計數）
const { useCharacterCreationStore } = await import('../stores/characterCreation.js');
const ccStore = useCharacterCreationStore();
ccStore.resetFlow();  // 重置整個流程（包括 AI 魔法師計數）
ccStore.clearSession();  // 清除 sessionStorage

console.log('[CharacterCreateVoiceView] 已清除所有暫存資料、草稿和 store 狀態');
```

## 測試步驟

### ⚠️ 重要：必須重啟前端開發服務器

修復代碼需要重新編譯才能生效。請按照以下步驟：

```bash
# 停止前端服務器（按 Ctrl+C）
# 然後重新啟動
cd chat-app/frontend
npm run dev
```

### 清除瀏覽器緩存

1. 打開瀏覽器開發者工具（F12）
2. Application 標籤 → Storage → Clear storage
3. 勾選所有選項（Local storage, Session storage, Cache storage）
4. 點擊「Clear site data」
5. 刷新頁面（Ctrl+R）

### 測試流程

1. **創建新角色**：
   - 選擇性別 → 選擇外觀 → 等待圖片生成
   - 選擇一張圖片 → 點擊「下一步」
   - **觀察**：應該進入設定步驟，不應該有錯誤

2. **填寫設定並保存**：
   - 填寫所有字段（角色名、角色設定、隱藏設定、開場白）
   - 點擊「下一步」
   - **觀察**：
     - ✅ 成功：跳轉到語音選擇頁面
     - ❌ 失敗：顯示錯誤提示「保存角色設定失敗，請檢查網絡連接後重試」，停留在當前頁面

3. **檢查網絡請求**（F12 → Network 標籤）：
   - 應該看到 `PATCH /api/character-creation/flows/{flowId}` 請求
   - Request Payload 應該包含 `persona` 數據
   - Response 應該返回 200/201 狀態碼

4. **完成創建並驗證**：
   - 選擇語音（或跳過）→ 點擊「完成創建」
   - 查看角色詳情頁面
   - **驗證**：所有字段都應該正確顯示

### 診斷工具

如果創建後資料仍然缺失，使用診斷腳本檢查：

```bash
cd chat-app/backend
node scripts/check-character-data.js <角色ID>
```

## 預期行為

### 修復前（錯誤行為）

1. 用戶填寫設定步驟 → 點擊「下一步」
2. **即使網絡失敗或後端錯誤**，頁面仍然跳轉到語音選擇
3. 用戶完成創建後，角色詳情頁面所有欄位都是空的
4. 沒有任何錯誤提示，用戶不知道哪裡出錯了

### 修復後（正確行為）

1. 用戶填寫設定步驟 → 點擊「下一步」
2. **如果同步失敗**：
   - 顯示錯誤提示：「保存角色設定失敗，請檢查網絡連接後重試」
   - 停留在當前頁面
   - 用戶可以檢查網絡連接後重試
3. **只有同步成功後**，才會跳轉到語音選擇頁面
4. 完成創建後，所有欄位都正確保存

## 技術細節

### 數據流程

```
Frontend (CharacterCreateGeneratingView.vue)
  ↓
  personaForm { name, tagline, hiddenProfile, prompt }
  ↓
  buildSummaryPayload() → SummaryPayload { persona, appearance, gender }
  ↓
  syncSummaryToBackend() → PATCH /api/character-creation/flows/{flowId}
  ↓
Backend (flow.routes.js → characterCreation.service.js)
  ↓
  mergeCreationFlow() → sanitizePersona()
  ↓
  setFlowInFirestore() → Firestore collection: character_creation_flows
  ↓
  finalizeCharacterCreation()
  ↓
  createMatch() → Firestore collection: characters
    {
      display_name: flow.persona.name,
      background: flow.persona.tagline,
      secret_background: flow.persona.hiddenProfile,
      first_message: flow.persona.prompt
    }
```

### Persona 字段映射

| Frontend (personaForm) | Flow (persona) | Match (character) |
|------------------------|----------------|-------------------|
| `name`                 | `name`         | `display_name`    |
| `tagline`              | `tagline`      | `background`      |
| `hiddenProfile`        | `hiddenProfile`| `secret_background`|
| `prompt`               | `prompt`       | `first_message`   |

### 錯誤傳播鏈

**修復前**：
```
syncSummaryToBackend 失敗
  ↓ (捕獲錯誤，靜默返回)
persistCreationSummary 繼續執行
  ↓ (沒有錯誤拋出)
handleConfirm 繼續執行
  ↓
router.push 跳轉到語音頁面 ❌
```

**修復後**：
```
syncSummaryToBackend 失敗
  ↓ (重新拋出錯誤)
persistCreationSummary 捕獲錯誤
  ↓ (顯示提示，重新拋出錯誤)
handleConfirm 捕獲錯誤
  ↓ (記錄日誌，停止執行)
停留在當前頁面 ✅
```

## 相關文件

- `chat-app/frontend/src/composables/useCharacterCreationFlow.ts` - 主要修復
- `chat-app/frontend/src/views/CharacterCreateGeneratingView.vue` - 錯誤處理改進
- `chat-app/frontend/src/views/CharacterCreateVoiceView.vue` - AI 魔法師重置
- `chat-app/frontend/src/services/characterCreation.service.ts` - API 調用
- `chat-app/backend/src/characterCreation/routes/flow.routes.js` - 後端路由
- `chat-app/backend/src/characterCreation/characterCreation.service.js` - 後端服務

## 診斷腳本

- `chat-app/backend/scripts/check-character-data.js` - 檢查角色數據完整性
- `chat-app/backend/scripts/check-character-flow.js` - 檢查創建流程和角色數據映射

## 測試指南

完整的測試指南請參閱：[TESTING_CHARACTER_CREATION_FIX.md](TESTING_CHARACTER_CREATION_FIX.md)

---

**修復完成時間**：2025-01-19
**修復者**：Claude Code
**受影響版本**：所有版本（直到此修復）
