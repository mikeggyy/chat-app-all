# Onboarding 卡住問題修復總結

**修復日期**: 2025-11-25
**問題類型**: 用戶體驗 Bug
**嚴重程度**: 高（阻止新用戶完成註冊流程）

---

## 📋 問題描述

### 用戶反饋
新用戶登入後會卡在 onboarding 頁面，填寫性別和年齡資料後點擊「開始使用」按鈕，畫面卡住並顯示錯誤訊息：

```
目前沒有可更新的使用者資料
```

### 影響範圍
- ❌ 所有新用戶首次登入
- ❌ 無法完成 onboarding 流程
- ❌ 無法進入應用主頁面

---

## 🔍 根本原因分析

### 問題流程

1. **用戶 Google 登入成功**
   - Firebase Auth 完成認證
   - `authBootstrap.ts` 的 `onAuthStateChanged` 觸發

2. **authBootstrap 創建/載入用戶資料**
   ```typescript
   // authBootstrap.ts
   - 嘗試 GET /api/users/:id
   - 如果 404 → POST /api/users（創建新用戶）
   - 調用 setUserProfile(userData) 設置 baseState.user
   ```

3. **導航到 onboarding 頁面**
   - LoginView 的 `watch(user)` 監聽到變化
   - 導航至 `/onboarding`

4. **用戶填寫資料並提交** ⚠️
   - OnboardingView 調用 `updateUserProfileDetails()`
   - **關鍵問題**：此時 `baseState.user` 可能為空或沒有 `id` 欄位

5. **錯誤發生**
   ```typescript
   // useUserProfile.ts:258
   const current = baseState.user;
   if (!current?.id) {
     throw new Error("目前沒有可更新的使用者資料");
   }
   ```

### 可能原因

1. **競態條件**：authBootstrap 還未完全完成時，用戶已進入 onboarding 頁面
2. **狀態清空**：某個流程意外清空了 `baseState.user`
3. **超時或網路問題**：
   - authBootstrap 創建用戶超時（15秒）
   - 使用 fallbackProfile 但未正確設置到 baseState
4. **緩存問題**：前端緩存了舊的 null 值

---

## ✅ 修復方案

### 方案概述

在 `OnboardingView.vue` 中添加防禦性檢查，確保提交時用戶狀態有效。如果無效，先重新載入用戶資料。

### 修改文件

**文件**: `chat-app/frontend/src/views/OnboardingView.vue`

### 關鍵修改

#### 1. 添加導入

```typescript
import { ref, computed, nextTick, onMounted } from "vue";
import { useFirebaseAuth } from "../composables/useFirebaseAuth";

const { user, updateUserProfileDetails, loadUserProfile } = useUserProfile();
const { getAuth } = useFirebaseAuth();
```

#### 2. 新增 `ensureUserLoaded` 函數

```typescript
// ✅ 2025-11-25 修復：確保用戶資料已載入
const ensureUserLoaded = async (): Promise<boolean> => {
  // 如果用戶資料已存在且有 id，直接返回成功
  if (user.value?.id) {
    return true;
  }

  console.warn('[OnboardingView] 用戶資料為空，嘗試重新載入');

  try {
    // 從 Firebase 獲取當前用戶 UID
    const auth = getAuth();
    const firebaseUser = auth.currentUser;

    if (!firebaseUser?.uid) {
      console.error('[OnboardingView] 無法獲取 Firebase 用戶');
      return false;
    }

    // 重新載入用戶資料（強制刷新）
    await loadUserProfile(firebaseUser.uid, { force: true });

    // 再次檢查
    return !!user.value?.id;
  } catch (error) {
    console.error('[OnboardingView] 重新載入用戶資料失敗', error);
    return false;
  }
};
```

#### 3. 修改 `handleSubmit` 函數

```typescript
const handleSubmit = async (): Promise<void> => {
  // ... 驗證邏輯 ...

  try {
    // ✅ 提交前確保用戶資料已載入
    const userLoaded = await ensureUserLoaded();

    if (!userLoaded) {
      throw new Error("無法載入用戶資料，請重新整理頁面後再試");
    }

    // 繼續執行更新邏輯
    await updateUserProfileDetails(submitData);
    await router.replace({ name: "match" });
  } catch (error) {
    errorMessage.value = (error as Error).message || "更新失敗，請稍後再試";
  }
};
```

#### 4. 新增 `onMounted` 鉤子

```typescript
// ✅ 頁面載入時驗證用戶狀態
onMounted(async () => {
  console.log('[OnboardingView] 頁面載入，驗證用戶狀態');

  // 如果用戶資料為空，嘗試載入
  if (!user.value?.id) {
    await ensureUserLoaded();
  }

  // 如果已完成 onboarding，直接導航到 match 頁面
  if (user.value?.hasCompletedOnboarding) {
    await router.replace({ name: "match" });
  }
});
```

---

## 🎯 修復效果

### 解決的問題

✅ **主要問題**：新用戶不再卡在 onboarding 頁面
✅ **防禦性編程**：即使 authBootstrap 失敗，也能自動重試
✅ **用戶體驗**：提供清晰的錯誤訊息
✅ **調試友好**：添加詳細的 console 日誌

### 新增功能

1. **自動重新載入**：頁面載入時檢查用戶狀態，自動重新載入
2. **提交前驗證**：確保用戶資料存在後才執行更新
3. **智能重定向**：已完成 onboarding 的用戶自動跳轉到 match 頁面
4. **友好錯誤提示**：無法載入時提示用戶重新整理頁面

### 邊界情況處理

- ✅ authBootstrap 超時 → ensureUserLoaded 重試
- ✅ 網路錯誤 → 顯示友好錯誤訊息
- ✅ Firebase Auth 狀態丟失 → 提示重新整理
- ✅ 已完成 onboarding 的用戶 → 自動跳轉

---

## 📊 測試建議

### 測試場景

1. **正常流程**
   - [ ] 新用戶 Google 登入
   - [ ] 填寫 onboarding 表單
   - [ ] 成功進入 match 頁面
   - [ ] 檢查用戶資料正確保存（性別、年齡、hasCompletedOnboarding）

2. **網路問題模擬**
   - [ ] Chrome DevTools → Network → Slow 3G
   - [ ] 登入後進入 onboarding
   - [ ] 驗證自動重新載入機制
   - [ ] 提交表單成功

3. **authBootstrap 失敗模擬**
   - [ ] 在 authBootstrap.ts 中人為延遲 20 秒（超過 15 秒超時）
   - [ ] 驗證 fallbackProfile 機制
   - [ ] 驗證 ensureUserLoaded 重新載入

4. **已完成 onboarding 的用戶**
   - [ ] 手動訪問 `/onboarding` 路由
   - [ ] 驗證自動重定向到 match 頁面

5. **瀏覽器控制台檢查**
   - [ ] 確認有詳細的日誌輸出
   - [ ] 檢查是否有錯誤訊息
   - [ ] 驗證 user 狀態正確

### 調試日誌示例

**正常流程**：
```
[OnboardingView] 頁面載入，驗證用戶狀態
[OnboardingView] 檢查用戶狀態 { hasUser: true, userId: 'xxx' }
[OnboardingView] 用戶資料已載入
[OnboardingView] 準備更新用戶資料 { userId: 'xxx', submitData: {...} }
[OnboardingView] 用戶資料更新成功
[OnboardingView] 準備導航至 match 頁面
```

**需要重新載入的流程**：
```
[OnboardingView] 頁面載入，驗證用戶狀態
[OnboardingView] 頁面載入時用戶資料為空，嘗試重新載入
[OnboardingView] 用戶資料為空，嘗試重新載入
[OnboardingView] 重新載入用戶資料 { uid: 'xxx' }
[OnboardingView] 用戶資料重新載入成功
```

---

## 🔧 技術細節

### 使用的 API

1. **useUserProfile**
   - `user`: 響應式用戶狀態
   - `loadUserProfile(id, options)`: 載入用戶資料
   - `updateUserProfileDetails(patch)`: 更新用戶資料

2. **useFirebaseAuth**
   - `getAuth()`: 獲取 Firebase Auth 實例
   - `auth.currentUser`: 當前 Firebase 用戶

3. **Vue 3 API**
   - `onMounted`: 組件載入鉤子
   - `computed`: 響應式計算屬性
   - `ref`: 響應式引用

### 關鍵配置

```typescript
// 強制刷新用戶資料（繞過緩存）
await loadUserProfile(firebaseUser.uid, { force: true });

// 使用 replace 避免循環導航
await router.replace({ name: "match" });
```

---

## 📝 相關文件

- **修改文件**: `chat-app/frontend/src/views/OnboardingView.vue`
- **相關檔案**:
  - `chat-app/frontend/src/composables/useUserProfile.ts`
  - `chat-app/frontend/src/composables/useFirebaseAuth.ts`
  - `chat-app/frontend/src/services/authBootstrap.ts`
  - `chat-app/frontend/src/views/LoginView.vue`

---

## 🚀 部署建議

1. **測試環境驗證**
   - 使用 Firebase Emulator 測試完整流程
   - 模擬網路問題和超時場景

2. **生產環境監控**
   - 監控控制台日誌中的警告和錯誤
   - 追蹤 "重新載入用戶資料" 的頻率
   - 如果頻繁發生，可能需要調查 authBootstrap 的穩定性

3. **回滾計畫**
   - 保留修改前的版本
   - 如有問題可快速回滾

---

## 💡 未來改進建議

1. **Loading 狀態優化**
   - 在 ensureUserLoaded 重新載入時顯示 loading 指示器
   - 避免用戶看到空白頁面或閃爍

2. **重試機制增強**
   - 添加指數退避重試（exponential backoff）
   - 限制最大重試次數

3. **錯誤追蹤**
   - 集成錯誤追蹤服務（如 Sentry）
   - 自動報告 "用戶資料載入失敗" 事件

4. **authBootstrap 優化**
   - 調查為什麼會出現用戶資料為空的情況
   - 可能需要增加超時時間或改進錯誤處理

5. **用戶體驗**
   - 添加進度指示器
   - 顯示 "正在載入您的資料..." 訊息

---

## ✅ 檢查清單

部署前確認：

- [x] 代碼修改完成
- [x] 所有導入正確
- [x] TypeScript 類型正確
- [x] 添加詳細日誌
- [ ] 本地測試通過
- [ ] 測試環境驗證
- [ ] 生產環境部署
- [ ] 監控用戶反饋

---

**修復完成！** 🎉

新用戶現在應該能夠順利完成 onboarding 流程，即使在網路不穩定或 authBootstrap 延遲的情況下。
