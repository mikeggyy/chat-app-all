# TypeScript 快速開始指南

## 🎉 TypeScript 已安裝並配置完成！

### ✅ 已完成的工作

1. **安裝了所有必要的依賴**
   - TypeScript 5.9.3
   - Vue TypeScript 編譯器（vue-tsc）
   - Node 類型定義

2. **創建了 2 個 TypeScript Composables**
   - ✅ `useSuggestions.ts` - 建議系統（完整類型）
   - ✅ `useChatCore.ts` - 核心聊天邏輯（完整類型）

3. **添加了類型檢查工具**
   ```bash
   npm run type-check      # TypeScript 類型檢查
   npm run check:params    # 靜態參數分析
   ```

---

## 🚀 立即測試 TypeScript

### 1. 運行類型檢查

```bash
cd chat-app/frontend
npm run type-check
```

### 2. 查看類型如何防止參數錯誤

創建一個測試文件：

```typescript
// src/test-typescript.ts
import { ref } from 'vue';
import { useSuggestions } from './composables/chat/useSuggestions';

// ❌ 這會立即報錯 - 缺少參數
const result1 = useSuggestions();
// Error TS2554: Expected 4 arguments, but got 0

// ✅ 正確的調用
const messages = ref([]);
const partner = ref(null);
const firebaseAuth = { getCurrentUserIdToken: async () => 'token' };
const currentUserId = ref('user-123');

const result2 = useSuggestions(messages, partner, firebaseAuth, currentUserId);
// ✅ 類型檢查通過！
```

然後運行：
```bash
npm run type-check
```

---

## 📝 使用 TypeScript Composables

### 在 JavaScript 文件中使用（向後兼容）

```javascript
// ✅ JavaScript 文件可以導入 TypeScript composables
import { useSuggestions } from './composables/chat/useSuggestions.ts';

// ✅ 正常使用，只是沒有類型檢查
const { suggestionOptions, loadSuggestions } = useSuggestions(
  messages,
  partner,
  firebaseAuth,
  currentUserId
);
```

### 在 TypeScript 文件中使用

```typescript
// ✅ 完整的類型安全
import { useSuggestions, type UseSuggestionsReturn } from './composables/chat/useSuggestions';

// ✅ IDE 會自動提示參數類型
const suggestions: UseSuggestionsReturn = useSuggestions(
  messages,         // Ref<Message[]>
  partner,          // Ref<Partner | null>
  firebaseAuth,     // FirebaseAuthService
  currentUserId     // Ref<string> | ComputedRef<string>
);

// ✅ IDE 會提示所有可用的屬性和方法
suggestions.loadSuggestions();  // () => Promise<void>
suggestions.suggestionOptions;  // Ref<string[]>
```

---

## 🎯 下一步做什麼？

### 選項 1: 繼續使用 JavaScript（推薦開始）

現有的 JavaScript 代碼可以繼續工作，TypeScript composables 完全向後兼容：

```javascript
// ✅ JavaScript 文件照常工作
import { useChatCore } from './composables/chat/setup/useChatCore.ts';

const core = useChatCore();
// 一切正常，只是沒有類型檢查
```

### 選項 2: 逐步遷移到 TypeScript

逐個將文件轉換為 TypeScript：

**優先級順序**：
1. 🔴 高優先級：`useUserProfile.js`, `useFirebaseAuth.js`, `usePartner.js`
2. 🟡 中優先級：`useChatMessages.js`, `useToast.js`
3. 🟢 低優先級：其他 composables

**轉換模板**：

```typescript
// Before: myComposable.js
export function useMyComposable() {
  const data = ref(null);
  return { data };
}

// After: myComposable.ts
import type { Ref } from 'vue';

export interface UseMyComposableReturn {
  data: Ref<YourDataType | null>;
}

export function useMyComposable(): UseMyComposableReturn {
  const data: Ref<YourDataType | null> = ref(null);
  return { data };
}
```

### 選項 3: 在新功能中使用 TypeScript

**推薦**：所有新的 composables 都用 TypeScript 編寫：

```typescript
// src/composables/useNewFeature.ts
import type { Ref } from 'vue';
import type { User } from '../types';

export interface UseNewFeatureReturn {
  data: Ref<User | null>;
  loading: Ref<boolean>;
  fetchData: () => Promise<void>;
}

export function useNewFeature(userId: string): UseNewFeatureReturn {
  // ...
}
```

---

## 🔧 開發工具配置

### VSCode 設置（推薦）

安裝擴展：
- **Volar** - Vue 3 + TypeScript 支援
- **TypeScript Vue Plugin (Volar)** - Vue TypeScript 增強

在 `.vscode/settings.json` 添加：

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### 在 CI 中添加類型檢查（可選）

```yaml
# .github/workflows/ci.yml
- name: Type Check
  run: npm run type-check
```

---

## 💡 實用技巧

### 1. IDE 自動完成

```typescript
const { ... } = useSuggestions(
  // 輸入 "mess" 時，IDE 會自動提示 "messages"
  // 輸入 "part" 時，IDE 會自動提示 "partner"
);
```

### 2. 快速查看類型定義

在 VSCode 中：
- 按住 `Ctrl` (或 `Cmd`) 並懸停在函數上
- 點擊可跳轉到類型定義

### 3. 查看所有可用屬性

```typescript
const suggestions = useSuggestions(...);

// 輸入 "suggestions." 時，IDE 會列出所有可用屬性：
// - suggestionOptions
// - isLoadingSuggestions
// - suggestionError
// - hasCachedSuggestions
// - loadSuggestions
// - selectSuggestion
// - invalidateSuggestions
```

---

## 🐛 常見問題

### Q: 我需要把所有文件都轉換為 TypeScript 嗎？

**A**: 不需要！JavaScript 和 TypeScript 可以混合使用。逐步遷移即可。

### Q: TypeScript 會影響性能嗎？

**A**: 不會！TypeScript 只在編譯時工作，生產環境中運行的仍然是 JavaScript。

### Q: 我不熟悉 TypeScript，怎麼辦？

**A**: 沒關係！可以繼續使用 JavaScript，TypeScript composables 完全向後兼容。

### Q: 如何禁用某個文件的類型檢查？

**A**: 在 `tsconfig.json` 的 `exclude` 中添加該文件。

---

## 📚 更多資源

- 📖 [完整遷移指南](./TYPESCRIPT_MIGRATION.md)
- 📖 [測試缺口分析](./TESTING_GAPS.md)
- 🔧 [參數檢查腳本](./check-composable-params.js)

---

**總結**: TypeScript 設置完成！現在可以：
1. ✅ 使用新的 TypeScript composables (useSuggestions.ts, useChatCore.ts)
2. ✅ 運行 `npm run type-check` 檢查類型
3. ✅ 享受 IDE 自動完成和錯誤提示
4. ✅ 防止參數錯誤（如之前的 useSuggestions bug）

🎉 恭喜！你的項目現在有了類型安全保障！
