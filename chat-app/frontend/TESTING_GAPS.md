# 測試缺口分析報告

## 🔍 為什麼現有測試沒有發現參數傳遞問題？

### 問題總結

**發現的 Bug**: `useChatCore.js` 調用 `useSuggestions()` 時缺少 4 個必要參數

**為什麼測試沒發現**:
1. ❌ `useChatCore.js` 沒有測試文件
2. ❌ 缺少集成測試
3. ❌ JavaScript 缺乏靜態類型檢查
4. ⚠️ 單元測試只測試隔離的 composable

---

## 📊 當前測試覆蓋情況

### ✅ 有測試的 Composables（5 個）

| Composable | 測試文件 | 測試數量 | 狀態 |
|-----------|---------|---------|------|
| `useSuggestions` | `useSuggestions.spec.js` | 34 | ✅ 通過 |
| `useChatMessages` | `useChatMessages.spec.js` | 31 | ✅ 通過 |
| `useSendMessage` | `useSendMessage.spec.js` | 25 | ✅ 通過 |
| `useGiftManagement` | `useGiftManagement.spec.js` | ? | ✅ 通過 |
| `usePotionManagement` | `usePotionManagement.spec.js` | ? | ✅ 通過 |

**這些測試都正確傳遞了參數**，例如：

```javascript
// ✅ useSuggestions.spec.js - 正確調用
const suggestions = useSuggestions(
  mockMessages,        // ✅
  mockPartner,         // ✅
  mockFirebaseAuth,    // ✅
  mockCurrentUserId    // ✅
);
```

### ❌ 缺少測試的關鍵文件（6+ 個）

| 文件 | 類型 | 風險等級 | 說明 |
|-----|------|---------|------|
| `useChatCore.js` | 集成層 | 🔴 高 | **Bug 就在這裡！** |
| `useChatSetup.js` | 集成層 | 🔴 高 | 組合所有 composables |
| `useChatFeatures.js` | 集成層 | 🟡 中 | 管理功能模組 |
| `useChatHandlers.js` | 集成層 | 🟡 中 | 事件處理器組合 |
| `useEventHandlers.js` | 邏輯層 | 🟢 低 | 相對簡單 |
| `usePartner.js` | 邏輯層 | 🟢 低 | 相對簡單 |

---

## 🎯 為什麼單元測試不夠？

### 測試金字塔

```
      /\
     /E2E\          ← 端到端測試（缺失）
    /------\
   /集成測試 \       ← 集成測試（缺失！）
  /----------\
 / 單元測試    \     ← ✅ 有，但不夠
/--------------\
```

### 實際情況

```javascript
// ✅ 單元測試：測試 useSuggestions 本身
describe('useSuggestions', () => {
  it('應該正確工作', () => {
    // ✅ 測試代碼中正確傳遞參數
    const result = useSuggestions(messages, partner, auth, userId);
    // ✅ 測試通過
  });
});

// ❌ 集成測試：測試 useChatCore 如何使用 useSuggestions（缺失！）
describe('useChatCore', () => {
  it('應該正確調用 useSuggestions', () => {
    // 這個測試不存在！
    // 如果存在，會發現 useSuggestions() 缺少參數
  });
});
```

### Bug 的執行路徑

```
用戶操作 (ChatView.vue)
    ↓ ✅ 測試通過
useChatSetup.js
    ↓ ❌ 無測試
useChatCore.js ← 🐛 Bug 在這裡：useSuggestions() 缺少參數
    ↓ ✅ 函數本身有測試
useSuggestions.js
    ↓ ❌ 運行時錯誤
messages.value ← TypeError: Cannot read properties of undefined
```

---

## 🛠️ 改進方案

### 方案 1: 添加集成測試（推薦）

**已創建**: `useChatCore.spec.js`

```javascript
it('應該正確傳遞 4 個參數給 useSuggestions', () => {
  useChatCore();

  expect(useSuggestionsMock).toHaveBeenCalledWith(
    expect.any(Object), // messages
    expect.any(Object), // partner
    expect.any(Object), // firebaseAuth
    expect.any(Object)  // currentUserId
  );

  // ✅ 如果缺少參數，這個測試會失敗！
  const callArgs = useSuggestionsMock.mock.calls[0];
  expect(callArgs).toHaveLength(4);
  expect(callArgs[0]).toBeDefined();
  expect(callArgs[1]).toBeDefined();
  expect(callArgs[2]).toBeDefined();
  expect(callArgs[3]).toBeDefined();
});
```

### 方案 2: 使用 TypeScript/JSDoc

**已創建**: `tsconfig.json`

啟用 `checkJs` 後，TypeScript 會在編譯時檢查：

```javascript
/**
 * @param {import('vue').Ref} messages
 * @param {import('vue').Ref} partner
 * @param {Object} firebaseAuth
 * @param {import('vue').ComputedRef<string>} currentUserId
 */
export function useSuggestions(messages, partner, firebaseAuth, currentUserId) {
  // ...
}

// ❌ TypeScript 會報錯：
// Expected 4 arguments, but got 0
const { ... } = useSuggestions();
```

**使用方法**:

```bash
# 安裝 TypeScript
npm install -D typescript

# 檢查 JavaScript 文件
npx tsc --noEmit
```

### 方案 3: 靜態分析腳本（已創建）

**文件**: `check-composable-params.js`

```bash
# 運行檢查
node check-composable-params.js
```

這個腳本會：
- ✅ 提取函數簽名
- ✅ 查找所有調用點
- ✅ 驗證參數數量
- ✅ 檢測缺少參數的調用

### 方案 4: 添加 JSDoc 類型註解

在所有 composables 中添加 JSDoc：

```javascript
/**
 * Chat 核心服務
 * @returns {{
 *   user: import('vue').Ref,
 *   partnerId: import('vue').ComputedRef<string>,
 *   messages: import('vue').Ref<Array>,
 *   suggestionOptions: import('vue').Ref<Array>,
 *   loadSuggestions: Function,
 *   ...
 * }}
 */
export function useChatCore() {
  // ...

  /**
   * @type {ReturnType<typeof import('../useSuggestions').useSuggestions>}
   */
  const suggestions = useSuggestions(
    messages,        // IDE 會自動提示
    partner,         // 缺少參數時會警告
    firebaseAuth,
    currentUserId
  );
}
```

---

## 📝 測試策略建議

### 短期（立即）

1. ✅ **運行參數檢查腳本**
   ```bash
   node check-composable-params.js
   ```

2. ✅ **添加集成測試**（已創建 `useChatCore.spec.js`）
   ```bash
   npm test useChatCore.spec.js
   ```

### 中期（1-2 週）

3. **為其他集成層添加測試**
   - `useChatSetup.spec.js`
   - `useChatFeatures.spec.js`
   - `useChatHandlers.spec.js`

4. **啟用 TypeScript 檢查**
   ```bash
   npm install -D typescript
   npx tsc --noEmit  # 添加到 CI
   ```

### 長期（1-2 月）

5. **添加 E2E 測試**（使用 Playwright/Cypress）
   ```javascript
   test('建議功能完整流程', async ({ page }) => {
     await page.goto('/chat/char-001');
     await page.click('[data-testid="suggestion-button"]');
     await expect(page.locator('.suggestion-menu')).toBeVisible();
     // ...
   });
   ```

6. **考慮遷移到 TypeScript**
   - 將 `.js` 轉換為 `.ts`
   - 獲得完整的類型安全

---

## 🎯 測試覆蓋率目標

### 當前覆蓋率（估計）

- 單元測試：~40%（只測試部分 composables）
- 集成測試：0%（缺失）
- E2E 測試：0%（缺失）

### 目標覆蓋率

- 單元測試：80%（所有核心 composables）
- 集成測試：60%（關鍵集成點）
- E2E 測試：30%（核心用戶流程）

---

## 📚 相關資源

- [Testing Library - Integration Testing](https://testing-library.com/docs/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [TypeScript for JavaScript Programmers](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)
- [JSDoc Type Checking](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)

---

## ✅ 檢查清單

- [x] 識別測試缺口
- [x] 創建集成測試範例
- [x] 創建靜態分析腳本
- [x] 配置 TypeScript 檢查
- [ ] 運行新的測試
- [ ] 添加更多集成測試
- [ ] 啟用 CI 檢查
- [ ] 添加 JSDoc 註解
- [ ] 考慮 E2E 測試

---

**總結**: 你的單元測試很好，但缺少**集成測試**和**靜態類型檢查**。這就是為什麼參數傳遞錯誤沒有被發現。現在我們提供了 3 種工具來防止類似問題：集成測試、TypeScript 檢查、和靜態分析腳本。
