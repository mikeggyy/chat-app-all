# 推薦修復方案

## 修復 #1: 保護 `onUpdateProfile` 回調（優先級 1）

### 現在的代碼

```javascript
// toggleFavorite 第 242-246 行
if (onUpdateProfile) {
  onUpdateProfile({
    ...currentProfile,
    favorites: favoritesList,
  });
}
```

### 問題

- 如果 `onUpdateProfile` 拋出異常，會導致函數中斷
- `return true` 不會執行（第 249 行）
- 錯誤不會被正確記錄

### 推薦修復

```javascript
try {
  if (onUpdateProfile) {
    onUpdateProfile({
      ...currentProfile,
      favorites: favoritesList,
    });
  }
} catch (updateError) {
  // onUpdateProfile 失敗不應該回滾
  // 因為 favoriteIds 和 API 已經成功更新
  logger.error('更新用戶資料快取失敗，但收藏已成功更新:', updateError);
  // 繼續執行，不影響正常流程
}
```

### 修改位置

文件：`d:\project\chat-app-all\chat-app\frontend\src\composables\match\useMatchFavorites.js`

在 `toggleFavorite` 函數中，第 242-246 行之後（API 成功分支）

### 修改前後對比

```diff
      favoriteIds.value = new Set(favoritesList);
-     if (onUpdateProfile) {
-       onUpdateProfile({
-         ...currentProfile,
-         favorites: favoritesList,
-       });
-     }
+     try {
+       if (onUpdateProfile) {
+         onUpdateProfile({
+           ...currentProfile,
+           favorites: favoritesList,
+         });
+       }
+     } catch (updateError) {
+       logger.error('更新用戶資料快取失敗，但收藏已成功更新:', updateError);
+     }

      return true;
```

---

## 修復 #2: 使用最新的用戶資料（優先級 1）

### 現在的代碼

```javascript
// toggleFavorite 第 182 行
const currentProfile = user?.value;
// ... 異步操作（可能 0.5-2 秒） ...

// 第 244 行
onUpdateProfile({
  ...currentProfile,  // 可能過時！
  favorites: favoritesList,
});
```

### 問題

- `currentProfile` 是在 T182 時刻的快照
- 如果在異步操作期間用戶資料被修改（例如通過其他 API 調用），會導致使用舊數據
- 儘管競態檢查已保護了用戶 ID，但其他欄位可能過時

### 推薦修復

```javascript
// 第 242-246 行（API 成功分支）
const updatedProfile = user.value;

try {
  // 再次檢查用戶是否仍然相同
  if (updatedProfile?.id === requestUserId && onUpdateProfile) {
    onUpdateProfile({
      ...updatedProfile,  // 使用最新的用戶資料
      favorites: favoritesList,
    });
  }
} catch (updateError) {
  logger.error('更新用戶資料快取失敗，但收藏已成功更新:', updateError);
}
```

### 修改位置

文件：`d:\project\chat-app-all\chat-app\frontend\src\composables\match\useMatchFavorites.js`

在 `toggleFavorite` 函數中，API 成功分支（第 237-246 行）

### 修改前後對比

```diff
      const favoritesList = Array.isArray(response?.favorites)
        ? response.favorites
        : [];

      favoriteIds.value = new Set(favoritesList);
-     if (onUpdateProfile) {
-       onUpdateProfile({
-         ...currentProfile,
-         favorites: favoritesList,
-       });
-     }
+
+     const updatedProfile = user.value;
+     try {
+       if (updatedProfile?.id === requestUserId && onUpdateProfile) {
+         onUpdateProfile({
+           ...updatedProfile,
+           favorites: favoritesList,
+         });
+       }
+     } catch (updateError) {
+       logger.error('更新用戶資料快取失敗，但收藏已成功更新:', updateError);
+     }

      return true;
```

---

## 修復 #3: 改進 `fetchFavoritesForCurrentUser` 的日誌（優先級 2）

### 現在的代碼

```javascript
// 第 87-106 行
let headers = {};
try {
  const token = await firebaseAuth.getCurrentUserIdToken();
  headers = {
    Authorization: `Bearer ${token}`,
  };
} catch (tokenError) {
  const currentProfile = user?.value;
  const profileMismatch =
    !currentProfile?.id || currentProfile.id !== targetUserId;

  if (profileMismatch) {
    favoriteRequestState.loading = false;
    return;
  }

  const expectedUnauthenticated =
    (tokenError instanceof Error &&
      tokenError.message.includes('尚未登入')) ||
    (typeof tokenError?.code === 'string' &&
      tokenError.code.includes('auth/'));

  if (!expectedUnauthenticated) {
    logger.warn('獲取認證 token 失敗:', tokenError);
  }
}
```

### 問題

- 當 `profileMismatch` 為 true 時（用戶已切換），沒有日誌
- 難以調試用戶切換期間發生的問題

### 推薦修復

```javascript
let headers = {};
try {
  const token = await firebaseAuth.getCurrentUserIdToken();
  headers = {
    Authorization: `Bearer ${token}`,
  };
} catch (tokenError) {
  const currentProfile = user?.value;
  const profileMismatch =
    !currentProfile?.id || currentProfile.id !== targetUserId;

  if (profileMismatch) {
    // 用戶已切換，這是預期行為
    logger.debug('用戶已切換，中止收藏列表加載', {
      targetUserId,
      currentUserId: currentProfile?.id,
    });
    favoriteRequestState.loading = false;
    return;
  }

  const expectedUnauthenticated =
    (tokenError instanceof Error &&
      tokenError.message.includes('尚未登入')) ||
    (typeof tokenError?.code === 'string' &&
      tokenError.code.includes('auth/'));

  if (!expectedUnauthenticated) {
    logger.warn('獲取認證 token 失敗:', tokenError);
  }
}
```

### 修改位置

文件：`d:\project\chat-app-all\chat-app\frontend\src\composables\match\useMatchFavorites.js`

在 `fetchFavoritesForCurrentUser` 函數中，第 92-94 行

---

## 修復 #4: 實現 profileCache 大小限制（優先級 2）

### 現在的代碼

```javascript
// useUserProfile.js 第 79-87 行
const cacheUserProfile = (payload) => {
  const profile = normalizeUser(payload);

  if (profile.id) {
    profileCache.set(profile.id, profile);  // 無限增長！
  }
  baseState.user = profile;
  return profile;
};
```

### 問題

- `profileCache` 是一個無限增長的 Map
- 如果應用長時間運行，可能導致記憶體洩漏
- 沒有清理機制

### 推薦修復

```javascript
const MAX_PROFILE_CACHE_SIZE = 100;

const cacheUserProfile = (payload) => {
  const profile = normalizeUser(payload);

  if (profile.id) {
    // 簡單的 FIFO 清除：當快取超過限制時，刪除最舊的項目
    if (profileCache.size >= MAX_PROFILE_CACHE_SIZE) {
      const firstKey = profileCache.keys().next().value;
      profileCache.delete(firstKey);
      logger.debug('快取已滿，清除最舊的用戶資料:', firstKey);
    }
    profileCache.set(profile.id, profile);
  }
  baseState.user = profile;
  return profile;
};
```

### 修改位置

文件：`d:\project\chat-app-all\chat-app\frontend\src\composables\useUserProfile.js`

在文件頂部定義常數，修改 `cacheUserProfile` 函數

### 修改前後對比

```diff
+const MAX_PROFILE_CACHE_SIZE = 100;
+
 const cacheUserProfile = (payload) => {
   const profile = normalizeUser(payload);

   if (profile.id) {
+    if (profileCache.size >= MAX_PROFILE_CACHE_SIZE) {
+      const firstKey = profileCache.keys().next().value;
+      profileCache.delete(firstKey);
+      logger.debug('快取已滿，清除最舊的用戶資料:', firstKey);
+    }
     profileCache.set(profile.id, profile);
   }
   baseState.user = profile;
   return profile;
 };
```

---

## 修復 #5: 改進 Promise.allSettled 的錯誤處理（優先級 3）

### 現在的代碼

```javascript
// MatchView.vue 第 222-231 行
if (profileResult.status === 'rejected') {
  logger.warn('載入用戶資料失敗:', profileResult.reason);
}
if (favoritesResult.status === 'rejected') {
  logger.warn('載入收藏列表失敗:', favoritesResult.reason);
}
if (matchesResult.status === 'rejected') {
  logger.warn('載入匹配列表失敗:', matchesResult.reason);
}
```

### 問題

- 錯誤日誌分散在代碼中
- 難以在一個地方看到所有錯誤
- 沒有統計失敗次數

### 推薦修復

```javascript
// 在 watch 回調開始時添加錯誤收集
const errors = [];
if (profileResult.status === 'rejected') {
  errors.push({ type: '用戶資料', error: profileResult.reason });
}
if (favoritesResult.status === 'rejected') {
  errors.push({ type: '收藏列表', error: favoritesResult.reason });
}
if (matchesResult.status === 'rejected') {
  errors.push({ type: '匹配列表', error: matchesResult.reason });
}

if (errors.length > 0) {
  logger.warn('MatchView 數據加載部分失敗', {
    count: errors.length,
    failures: errors.map(e => e.type),
  });
  errors.forEach(({ type, error }) => {
    logger.debug(`${type} 詳細錯誤:`, error);
  });
}
```

### 修改位置

文件：`d:\project\chat-app-all\chat-app\frontend\src\views\MatchView.vue`

在 watch 回調中，第 222-231 行

---

## 完整修復清單

### 立即修復（Patch v1）

```checklist
□ 修復 #1: 添加 onUpdateProfile 的 try-catch
  文件: useMatchFavorites.js
  行數: ~245

□ 修復 #2: 使用最新用戶資料而非舊快照
  文件: useMatchFavorites.js
  行數: ~242
```

### 後續優化（v1.1）

```checklist
□ 修復 #3: 改進 fetchFavoritesForCurrentUser 的日誌
  文件: useMatchFavorites.js
  行數: ~92

□ 修復 #4: 實現 profileCache 大小限制
  文件: useUserProfile.js
  行數: ~79

□ 修復 #5: 改進 Promise.allSettled 錯誤處理
  文件: MatchView.vue
  行數: ~222
```

---

## 測試驗證清單

### 單元測試

```javascript
// useMatchFavorites.test.js
describe('useMatchFavorites', () => {
  it('應處理 onUpdateProfile 拋出的異常', async () => {
    const onUpdateProfile = () => {
      throw new Error('Update failed');
    };

    const { toggleFavorite } = useMatchFavorites({
      user,
      firebaseAuth,
      onUpdateProfile,
    });

    // 應該不拋出異常
    const result = await toggleFavorite('match-001');
    expect(result).toBe(true);  // 操作成功
  });

  it('應使用最新的用戶資料', async () => {
    const updatedUser = ref({ id: 'user-A', displayName: 'Alice' });
    let capturedProfile = null;

    const { toggleFavorite } = useMatchFavorites({
      user: updatedUser,
      firebaseAuth,
      onUpdateProfile: (profile) => {
        capturedProfile = profile;
      },
    });

    // 修改用戶資料
    updatedUser.value.displayName = 'Bob';

    await toggleFavorite('match-001');

    // 應該捕獲最新的 displayName
    expect(capturedProfile.displayName).toBe('Bob');
  });
});
```

### 集成測試

```javascript
// MatchView.integration.test.js
describe('MatchView 競態條件', () => {
  it('應在用戶切換時忽略過期的收藏更新', async () => {
    // Setup
    const { favoriteIds } = useMatchFavorites({...});

    // User A 點擊收藏
    toggleFavorite('match-001');

    // 用戶立即切換到 B
    setUser('user-B');

    // 等待 User A 的 API 返回
    await waitForApiResponse();

    // favoriteIds 應該表示 user-B 的收藏
    expect(favoriteIds.value).toContain('match-005');  // user-B 已有的收藏
    expect(favoriteIds.value).not.toContain('match-001');  // user-A 的操作被忽略
  });

  it('應在遊客登入期間中止加載', async () => {
    // Setup
    const { syncFavoriteSet } = useMatchFavorites({...});
    const user = ref(null);  // 遊客

    // 遊客模式加載開始（延遲 2 秒）
    const loadPromise = matchData.loadMatches();

    // 0.5 秒後登入
    setTimeout(() => {
      user.value = { id: 'user-A', favorites: ['match-001'] };
    }, 500);

    // 等待完成
    await loadPromise;

    // 應該使用登入後的資料
    expect(user.value.id).toBe('user-A');
  });
});
```

### 手動測試

```markdown
## 手動測試步驟

### 場景 1: onUpdateProfile 失敗
1. 在 onUpdateProfile 中注入一個會拋出異常的回調
2. 點擊收藏按鈕
3. 驗證：
   - 收藏狀態已更新（UI 顯示心形）✓
   - 錯誤信息未出現（因為 onUpdateProfile 失敗）✓
   - 控制台有「更新用戶資料快取失敗」的日誌 ✓

### 場景 2: 快速用戶切換
1. 打開 MatchView
2. 點擊收藏按鈕
3. 立即點擊另一個用戶（或切換用戶）
4. 等待 API 返回
5. 驗證：
   - favoriteIds 表示新用戶的收藏 ✓
   - 沒有混合狀態 ✓
   - 控制台有「用戶已切換，忽略過期的...」的日誌 ✓

### 場景 3: profileCache 大小限制
1. 修改 MAX_PROFILE_CACHE_SIZE = 5
2. 快速登入 10 個不同的用戶
3. 驗證：
   - 快取大小不超過 5 ✓
   - 控制台有「快取已滿，清除...」的日誌 ✓
   - 舊用戶資料被清除，但當前用戶資料保留 ✓
```

---

## 部署檢查清單

在提交修復前：

```checklist
□ 所有修復都已實施
□ 開發環境測試通過
□ 控制台無警告或錯誤
□ 性能測試通過（無明顯變化）
□ 代碼風格檢查通過
□ 提交消息遵循 Conventional Commits 格式
□ 更新相關文檔（如有）
```

---

## 回滾計畫

如果修復導致問題：

```bash
# 回滾到之前的版本
git revert <commit-hash>

# 或者如果還未提交
git checkout -- chat-app/frontend/src/composables/match/useMatchFavorites.js
git checkout -- chat-app/frontend/src/composables/useUserProfile.js
git checkout -- chat-app/frontend/src/views/MatchView.vue
```

