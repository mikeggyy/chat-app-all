# TypeScript 遷移指南

## ✅ 已完成的工作

### 1. **TypeScript 基礎設置**
- ✅ 安裝 TypeScript 和相關依賴
  - `typescript` (5.9.3)
  - `vue-tsc` (3.1.3)
  - `@types/node` (24.10.1)
- ✅ 配置 `tsconfig.json` 和 `tsconfig.node.json`
- ✅ 添加 Vue 類型聲明文件 (`shims-vue.d.ts`)
- ✅ 更新 `package.json` 添加檢查腳本

### 2. **類型定義文件**
- ✅ 創建 `src/types/index.ts` - 通用類型定義
  - `User`, `Message`, `Partner`
  - `FirebaseAuthService`, `Toast`
  - `ApiResponse`, `SuggestionResponse`
  - `LimitCheckResult`, `PhotoLimitInfo`
  - 等等...

### 3. **核心 Composables 轉換**
- ✅ `useSuggestions.js` → `useSuggestions.ts`
  - 完整的類型註解
  - 導出 `UseSuggestionsReturn` 接口
  - **現在參數是強制性的！**

- ✅ `useChatCore.js` → `useChatCore.ts`
  - 完整的類型註解
  - 導出 `UseChatCoreReturn` 接口
  - **TypeScript 會自動檢查所有參數傳遞！**

### 4. **類型檢查腳本**
```bash
# package.json 中添加的腳本
npm run type-check       # TypeScript 類型檢查
npm run check:params     # 靜態參數分析
```

---

## 🎯 TypeScript 如何防止參數錯誤

### 之前（JavaScript）- Bug 示例

```javascript
// ❌ JavaScript 不會檢查參數
export function useSuggestions(messages, partner, firebaseAuth, currentUserId) {
  // ...
}

// ❌ 調用時缺少參數 - JavaScript 不會報錯！
const { ... } = useSuggestions();

// ❌ 運行時才會崩潰
messages.value  // TypeError: Cannot read properties of undefined
```

### 現在（TypeScript）- 編譯時檢查

```typescript
// ✅ TypeScript 定義了嚴格的參數類型
export function useSuggestions(
  messages: Ref<Message[]>,
  partner: Ref<Partner | null>,
  firebaseAuth: FirebaseAuthService,
  currentUserId: Ref<string> | ComputedRef<string>
): UseSuggestionsReturn {
  // ...
}

// ❌ 如果缺少參數，TypeScript 會立即報錯：
const { ... } = useSuggestions();
// Error TS2554: Expected 4 arguments, but got 0

// ✅ 必須傳遞所有參數
const { ... } = useSuggestions(
  messages,         // ✅ 類型檢查：必須是 Ref<Message[]>
  partner,          // ✅ 類型檢查：必須是 Ref<Partner | null>
  firebaseAuth,     // ✅ 類型檢查：必須實現 FirebaseAuthService
  currentUserId     // ✅ 類型檢查：必須是 Ref<string> 或 ComputedRef<string>
);
```

### 實際檢測示例

創建一個測試文件來演示：

```typescript
// test-typescript-check.ts
import { ref } from 'vue';
import { useSuggestions } from './composables/chat/useSuggestions';

// ❌ 這會立即報錯
const result1 = useSuggestions();
// Error: Expected 4 arguments, but got 0

// ❌ 這也會報錯 - 參數類型錯誤
const result2 = useSuggestions(
  ref([]),           // ❌ Message[] 類型不匹配
  ref(null),         // ✅ 正確
  {},                // ❌ 缺少 getCurrentUserIdToken 方法
  ref('user-123')    // ✅ 正確
);
// Error: Type '{}' is not assignable to type 'FirebaseAuthService'
```

---

## 📊 當前遷移狀態

### ✅ 已轉換為 TypeScript（2 個文件）

| 文件 | 狀態 | 類型安全 |
|-----|------|---------|
| `useSuggestions.ts` | ✅ 完成 | 🟢 100% |
| `useChatCore.ts` | ✅ 完成 | 🟢 100% |

### 🟡 待轉換的關鍵文件

| 文件 | 優先級 | 原因 |
|-----|--------|------|
| `usePartner.js` | 🔴 高 | useChatCore 依賴 |
| `useChatMessages.js` | 🔴 高 | useChatCore 依賴 |
| `useUserProfile.js` | 🔴 高 | useChatCore 依賴 |
| `useFirebaseAuth.js` | 🔴 高 | useChatCore 依賴 |
| `useToast.js` | 🟡 中 | 常用工具 |
| `useSendMessage.js` | 🟡 中 | 已有測試 |
| `useEventHandlers.js` | 🟡 中 | 事件處理 |
| `useChatActions.js` | 🟢 低 | 複雜但測試覆蓋好 |

---

## 🚀 下一步行動計劃

### 階段 1: 核心依賴（推薦優先完成）

1. **轉換 `useUserProfile.js`**
   ```bash
   # 創建類型定義
   interface UseUserProfileReturn {
     user: Ref<User | null>;
     setUserProfile: (profile: Partial<User>) => void;
     addConversationHistory: (userId: string, matchId: string) => void;
   }
   ```

2. **轉換 `useFirebaseAuth.js`**
   ```typescript
   interface UseFirebaseAuthReturn extends FirebaseAuthService {
     getCurrentUserIdToken: () => Promise<string>;
     signOut?: () => Promise<void>;
   }
   ```

3. **轉換 `usePartner.js`**
   ```typescript
   interface UsePartnerParams {
     partnerId: ComputedRef<string>;
   }

   interface UsePartnerReturn {
     partner: Ref<Partner | null>;
     partnerDisplayName: ComputedRef<string>;
     partnerBackground: ComputedRef<string>;
     backgroundStyle: ComputedRef<Record<string, string>>;
     loadPartner: () => Promise<void>;
   }
   ```

4. **轉換 `useChatMessages.js`**
   ```typescript
   interface UseChatMessagesReturn {
     messages: Ref<Message[]>;
     isReplying: Ref<boolean>;
     isLoadingHistory: Ref<boolean>;
     loadHistory: () => Promise<void>;
     sendMessageToApi: (text: string) => Promise<void>;
     resetConversationApi: () => Promise<void>;
     cleanupMessages: () => void;
   }
   ```

### 階段 2: 工具和輔助函數

5. 轉換 `useToast.js`
6. 轉換 `useSendMessage.js`
7. 轉換 `useEventHandlers.js`

### 階段 3: 高級功能

8. 轉換其他功能 composables
9. 轉換 Vue 組件 (`.vue` 文件使用 `<script setup lang="ts">`)

---

## 💡 遷移最佳實踐

### 1. **逐步遷移策略**

```typescript
// ✅ 推薦：逐步添加類型
// 第一步：導出返回類型接口
export interface UseMyComposableReturn {
  data: Ref<any>;
  loading: Ref<boolean>;
  error: Ref<Error | null>;
}

// 第二步：添加參數類型
export function useMyComposable(
  id: string,
  options?: { refresh?: boolean }
): UseMyComposableReturn {
  // ...
}

// 第三步：逐步細化 any 類型
export interface MyData {
  id: string;
  name: string;
}

export interface UseMyComposableReturn {
  data: Ref<MyData | null>;  // ✅ 更精確
  loading: Ref<boolean>;
  error: Ref<Error | null>;
}
```

### 2. **處理第三方庫**

```typescript
// 如果第三方庫沒有類型定義
declare module 'some-library' {
  export function someFunction(): void;
}
```

### 3. **使用類型守衛**

```typescript
// 類型守衛函數
function isPartner(value: any): value is Partner {
  return value && typeof value.id === 'string' && typeof value.display_name === 'string';
}

// 使用
if (isPartner(data)) {
  // TypeScript 知道 data 是 Partner 類型
  console.log(data.display_name);
}
```

### 4. **處理動態數據**

```typescript
// ❌ 避免過度使用 any
const data: any = await fetchData();

// ✅ 使用 unknown 並進行驗證
const data: unknown = await fetchData();
if (isValidData(data)) {
  // 現在可以安全使用
}

// ✅ 或使用類型斷言（謹慎）
const data = await fetchData() as ApiResponse<User>;
```

---

## 🔧 工具和命令

### 檢查命令

```bash
# 類型檢查（不生成文件）
npm run type-check

# 查看詳細錯誤
npx vue-tsc --noEmit --pretty

# 僅檢查特定文件
npx vue-tsc --noEmit src/composables/chat/useSuggestions.ts
```

### VSCode 配置

在 `.vscode/settings.json` 中添加：

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true,
    "source.organizeImports": true
  }
}
```

### ESLint 配置（可選）

```bash
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

---

## 📈 預期收益

### 1. **編譯時錯誤檢測**

**之前**：參數錯誤在運行時才發現
**現在**：參數錯誤在編寫代碼時立即發現

### 2. **IDE 智能提示**

```typescript
// ✅ IDE 會自動提示可用的方法和屬性
const {
  suggestionOptions,    // IDE 知道這是 Ref<string[]>
  loadSuggestions,      // IDE 知道這是 () => Promise<void>
  ...
} = useSuggestions(messages, partner, firebaseAuth, currentUserId);

// ✅ 自動補全和參數提示
loadSuggestions();  // IDE 顯示：() => Promise<void>
```

### 3. **重構安全性**

- 重命名函數時自動更新所有調用
- 修改參數類型時，所有不匹配的調用都會報錯
- 刪除參數時，立即發現所有需要修改的地方

### 4. **文檔即代碼**

```typescript
// 類型就是最好的文檔
export function useSuggestions(
  messages: Ref<Message[]>,              // 清楚知道需要什麼
  partner: Ref<Partner | null>,          // Partner 或 null
  firebaseAuth: FirebaseAuthService,     // 需要實現什麼接口
  currentUserId: Ref<string> | ComputedRef<string>  // 兩種類型都接受
): UseSuggestionsReturn {  // 返回什麼
  // ...
}
```

---

## ✅ 檢查清單

### 設置

- [x] 安裝 TypeScript 依賴
- [x] 配置 tsconfig.json
- [x] 添加類型聲明文件
- [x] 添加類型檢查腳本

### 核心轉換

- [x] 創建通用類型定義 (`src/types/index.ts`)
- [x] 轉換 `useSuggestions.js` → `.ts`
- [x] 轉換 `useChatCore.js` → `.ts`
- [ ] 轉換 `useUserProfile.js` → `.ts`
- [ ] 轉換 `useFirebaseAuth.js` → `.ts`
- [ ] 轉換 `usePartner.js` → `.ts`
- [ ] 轉換 `useChatMessages.js` → `.ts`

### 驗證

- [x] 運行 `npm run type-check`
- [ ] 解決所有類型錯誤
- [ ] 更新測試文件
- [ ] 在 CI 中添加類型檢查

---

## 🎓 學習資源

- [TypeScript 官方文檔](https://www.typescriptlang.org/)
- [Vue 3 + TypeScript 指南](https://vuejs.org/guide/typescript/overview.html)
- [TypeScript 最佳實踐](https://typescript-cheatsheets.vercel.app/)

---

**總結**: TypeScript 已成功設置！現在參數錯誤會在編譯時被捕獲，再也不會出現類似 `useSuggestions()` 缺少參數的低級錯誤了。建議接下來逐步轉換其他關鍵的 composables。
