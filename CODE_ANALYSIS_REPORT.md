# 前端代码深入分析報告

## 執行概要

本報告對以下五個關鍵文件進行了詳細分析：
1. **MatchView.vue** - 角色配對主視圖
2. **useMatchCarousel.js** - 輪播控制邏輯
3. **useMatchGestures.js** - 手勢控制邏輯
4. **useMatchFavorites.js** - 收藏管理邏輯
5. **MembershipView.vue** - 會員方案視圖

**總體評估**: 代碼邏輯健全，但存在 **5 個中等風險問題** 和 **3 個低風險問題**，主要集中在競態條件和邊緣情況處理。

---

## 發現的問題

### 高風險問題

**無** - 代碼不存在導致數據丟失或用戶錯誤的關鍵缺陷。

### 中等風險問題

#### 1. **MatchView.vue - 用戶快速切換時的 Watch 競態條件**

**位置**: 第 173-231 行

**問題描述**:
```javascript
watch(
  () => user.value?.id,
  async (nextId, prevId) => {
    // ... 複雜的異步操作
    const [profileResult, favoritesResult, matchesResult] =
      await Promise.allSettled([
        loadUserProfile(nextId, { skipGlobalLoading: true }),
        favorites.fetchFavoritesForCurrentUser({ skipGlobalLoading: true }),
        matchData.loadMatches(),
      ]);
    // ...
  },
  { immediate: true }
);
```

**潛在風險**:
- 當用戶在 Promise 執行中途（比如加載用戶資料時）快速切換賬號，會導致：
  - `nextId !== lastLoadedUserId` 檢查失效（第 187 行）
  - 舊數據與新用戶混合
  - `applyMatchData()` 回調使用過期的 `nextId`

**具體場景**:
```
時間線:
1. 用戶 A 登入，trigger watch，開始加載用戶 A 的數據
2. 加載中... (2秒)
3. 用戶快速登出並以用戶 B 身份登入
4. watch 再次觸發，但用戶 A 的加載仍在進行
5. 用戶 A 加載完成，`nextId` 檢查通過但實際當前用戶是 B
6. 用戶 A 的數據被應用到 UI，用戶 B 看到用戶 A 的收藏
```

**修復建議**:
```javascript
watch(
  () => user.value?.id,
  async (nextId, prevId) => {
    if (!nextId) {
      lastLoadedUserId = '';
      favorites.favoriteRequestState.lastUserId = '';
      favorites.syncFavoriteSet([]);
      await matchData.loadMatches();
      carousel.initialize();
      return;
    }

    if (nextId === prevId && nextId === lastLoadedUserId) {
      return;
    }

    favorites.clearError();

    if (nextId !== lastLoadedUserId) {
      lastLoadedUserId = nextId;

      // 使用 AbortController 取消舊請求
      const abortController = new AbortController();
      const currentRequestId = nextId; // 捕獲當前請求的 ID

      const [profileResult, favoritesResult, matchesResult] =
        await Promise.allSettled([
          loadUserProfile(nextId, { skipGlobalLoading: true }),
          favorites.fetchFavoritesForCurrentUser({ skipGlobalLoading: true }),
          matchData.loadMatches(),
        ]);

      // 檢查當前加載的用戶是否仍是目標用戶
      if (user.value?.id !== currentRequestId) {
        return; // 用戶已切換，忽略結果
      }

      // ... 其餘邏輯
    }
  },
  { immediate: true }
);
```

**影響範圍**: 中 - 多賬號快速切換時發生概率較低，但會造成用戶困惑

---

#### 2. **useMatchFavorites.js - Optimistic UI 更新與伺服器狀態不同步**

**位置**: 第 170-254 行

**問題描述**:
```javascript
const toggleFavorite = async (matchId) => {
  // ...
  const wasFavorited = favoriteIds.value.has(matchId);
  const previousSet = new Set(favoriteIds.value);
  const optimisticSet = new Set(previousSet);

  // Optimistic UI 更新
  if (wasFavorited) {
    optimisticSet.delete(matchId);
  } else {
    optimisticSet.add(matchId);
  }
  favoriteIds.value = optimisticSet; // 立即更新 UI

  try {
    const response = await apiJson(endpoint, { /* ... */ });
    const favoritesList = Array.isArray(response?.favorites) ? response.favorites : [];

    favoriteIds.value = new Set(favoritesList); // 用伺服器結果覆蓋
    if (onUpdateProfile) {
      onUpdateProfile({ ...currentProfile, favorites: favoritesList });
    }
    return true;
  } catch (requestError) {
    favoriteIds.value = previousSet; // 錯誤時回滾
    // ...
    return false;
  }
};
```

**潛在風險**:
- **同時多個請求**: 用戶快速點擊「收藏」/「取消收藏」時，會發送多個並發請求
- **數據競態**:
  ```
  時間線:
  1. 收藏 A (optimistic: {A}，request 已發送)
  2. 取消收藏 B (optimistic: {A}，request 已發送)
  3. 請求 1 返回: {A} (伺服器確認)
  4. UI: {A} ✓
  5. 請求 2 返回: {} (伺服器返回)
  6. UI: {} (錯誤！應該是 {A})
  ```

- **`favoriteMutating` 檢查不足**: 第 173 行只檢查是否正在變更，但不會阻止多個並發請求

**修復建議**:
```javascript
// 添加請求隊列機制
let favoriteRequestQueue = Promise.resolve();
const requestAbortControllers = new Map(); // 按 matchId 存儲

const toggleFavorite = async (matchId) => {
  if (favoriteMutating.value || !matchId) {
    return false;
  }

  // 取消該 matchId 的舊請求
  if (requestAbortControllers.has(matchId)) {
    requestAbortControllers.get(matchId).abort();
  }

  const abortController = new AbortController();
  requestAbortControllers.set(matchId, abortController);

  favoriteMutating.value = true;
  const wasFavorited = favoriteIds.value.has(matchId);
  const previousSet = new Set(favoriteIds.value);
  const optimisticSet = new Set(previousSet);

  if (wasFavorited) {
    optimisticSet.delete(matchId);
  } else {
    optimisticSet.add(matchId);
  }

  favoriteIds.value = optimisticSet;

  try {
    // 確保請求按順序執行
    favoriteRequestQueue = favoriteRequestQueue.then(async () => {
      const response = await apiJson(endpoint, {
        method: wasFavorited ? 'DELETE' : 'POST',
        body: wasFavorited ? undefined : { matchId },
        headers: { Authorization: `Bearer ${token}` },
        skipGlobalLoading: true,
        signal: abortController.signal, // 傳遞 abort signal
      });

      if (abortController.signal.aborted) {
        return; // 請求已被取消
      }

      const favoritesList = Array.isArray(response?.favorites)
        ? response.favorites
        : [];

      // 確認當前用戶未變更
      const currentProfile = user?.value;
      if (currentProfile?.id !== targetUserId) {
        return;
      }

      favoriteIds.value = new Set(favoritesList);
      if (onUpdateProfile) {
        onUpdateProfile({
          ...currentProfile,
          favorites: favoritesList,
        });
      }

      return true;
    });

    await favoriteRequestQueue;
    return true;
  } catch (requestError) {
    if (!abortController.signal.aborted) {
      favoriteIds.value = previousSet;
      // 錯誤處理...
    }
    return false;
  } finally {
    favoriteMutating.value = false;
    requestAbortControllers.delete(matchId);
  }
};
```

**影響範圍**: 中 - 只在用戶快速點擊時發生，但會導致 UI 狀態不正確

---

#### 3. **useMatchCarousel.js - `carouselContainer` ref 可能為 null**

**位置**: 第 106-108 行, 171-179 行

**問題描述**:
```javascript
const measureCardWidth = () => {
  cardWidth.value = carouselContainer.value?.offsetWidth ?? 0;
};

const animateTo = (direction) => {
  clearAnimationTimer();
  if (!cardWidth.value) {
    measureCardWidth();
  }

  const width =
    cardWidth.value ||
    carouselContainer.value?.offsetWidth ||
    window.innerWidth ||
    1;
  // ...
};
```

**潛在風險**:
- 如果組件卸載時 `measureCardWidth` 被調用（例如從 `onMounted` 的 `resize` 監聽器）
- `carouselContainer.value` 可能已被設置為 null
- `cardWidth.value` 會被設為 0，導致動畫異常
- 在 `MatchView.vue` 第 245 行：`window.addEventListener('resize', carousel.measureCardWidth)` 未綁定正確的上下文

**修復建議**:
```javascript
// 添加組件卸載狀態追蹤
let isMounted = true;

const measureCardWidth = () => {
  if (!isMounted || !carouselContainer.value) {
    return;
  }
  const width = carouselContainer.value.offsetWidth;
  if (width > 0) {
    cardWidth.value = width;
  }
};

const animateTo = (direction) => {
  clearAnimationTimer();

  // 確保卡片寬度已測量
  if (!cardWidth.value || cardWidth.value <= 0) {
    measureCardWidth();
  }

  const width =
    cardWidth.value ||
    (carouselContainer.value?.offsetWidth) ||
    (typeof window !== 'undefined' ? window.innerWidth : 0) ||
    1;

  if (!isMounted) return; // 檢查組件是否仍然掛載

  isAnimating.value = true;
  swipeOffset.value = direction === 'next' ? -width : width;

  resetTimerId = window.setTimeout(() => {
    if (!isMounted) return; // 再次檢查

    if (direction === 'next') {
      showMatchByIndex(currentIndex.value + 1);
    } else {
      showMatchByIndex(currentIndex.value - 1);
    }

    isAnimating.value = false;
    swipeOffset.value = 0;
  }, 220);
};

onBeforeUnmount(() => {
  isMounted = false;
  clearAnimationTimer();
});

// 在 MatchView.vue 中
onMounted(() => {
  carousel.measureCardWidth();

  // 使用箭頭函數綁定 this
  const handleResize = () => carousel.measureCardWidth();
  window.addEventListener('resize', handleResize);

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
  });
});
```

**影響範圍**: 低-中 - 只在特定時序下發生（快速切換視圖 + resize 事件）

---

#### 4. **MembershipView.vue - 未處理用戶在加載中登出的情況**

**位置**: 第 104-118 行

**問題描述**:
```javascript
onMounted(async () => {
  if (user.value?.id) {
    try {
      await loadMembership(user.value.id, { skipGlobalLoading: true });

      // 假設 user.value 在加載期間未變更
      if (currentTier.value === "vip" || currentTier.value === "vvip") {
        activeTierId.value = currentTier.value;
      }
    } catch (error) {
      logger.error('[會員方案] 載入會員資料失敗', error);
    }
  }
});
```

**潛在風險**:
- 用戶在 `loadMembership()` 執行期間（0.5-1秒）登出
- `user.value?.id` 變為 null/undefined
- `currentTier.value` 變為 'free'（computed property 的默認值）
- UI 可能顯示舊的會員等級直到下次加載

**修復建議**:
```javascript
let mountedUserId = null;

onMounted(async () => {
  if (user.value?.id) {
    mountedUserId = user.value.id;

    try {
      await loadMembership(user.value.id, { skipGlobalLoading: true });

      // 檢查用戶是否仍然登入且未變更
      if (user.value?.id === mountedUserId && (currentTier.value === "vip" || currentTier.value === "vvip")) {
        activeTierId.value = currentTier.value;
      }
    } catch (error) {
      logger.error('[會員方案] 載入會員資料失敗', error);
    }
  }
});

// 在 onBeforeUnmount 中清理
onBeforeUnmount(() => {
  mountedUserId = null;
});
```

**影響範圍**: 低 - 只在特定時序下發生，不影響功能正確性

---

### 低風險問題

#### 5. **useMatchGestures.js - Pointer Capture 異常未完全處理**

**位置**: 第 83-95, 101-125 行

**問題描述**:
```javascript
const capturePointer = (event) => {
  if (!(event instanceof PointerEvent)) return;
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  try {
    target.setPointerCapture(event.pointerId);
    activePointerId = event.pointerId;
    activePointerTarget = target;
  } catch {
    activePointerId = null;
    activePointerTarget = null;
  }
};
```

**潛在風險**:
- 如果 `setPointerCapture` 失敗但 `pointerId` 已被另一指針捕獲，會出現靜默失敗
- 某些舊版本瀏覽器或特殊場景（iframe）可能拋出未捕獲的異常
- 無法區分「失敗」與「不適用」的情況

**修復建議** (低優先級):
```javascript
const capturePointer = (event) => {
  if (!(event instanceof PointerEvent)) return false;
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return false;

  try {
    target.setPointerCapture(event.pointerId);
    activePointerId = event.pointerId;
    activePointerTarget = target;
    return true;
  } catch (err) {
    // 記錄異常以便調試
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Gesture] Pointer capture failed:', err.message);
    }
    activePointerId = null;
    activePointerTarget = null;
    return false;
  }
};
```

**影響範圍**: 極低 - 罕見情況，不影響核心功能

---

#### 6. **MatchView.vue - 背景對話框未預防 XSS**

**位置**: 第 124-135 行

**問題描述**:
```javascript
const openBackgroundDialog = (title, text) => {
  if (typeof text !== 'string') return;
  const content = text.trim();
  if (!content) return;

  backgroundDialog.title =
    typeof title === 'string' && title.trim().length
      ? `${title.trim()}・角色背景` // 直接字符串插值
      : '角色背景';
  backgroundDialog.text = content; // 直接賦值
  backgroundDialog.open = true;
};
```

**潛在風險**:
- 雖然 Vue 模板默認轉義文本節點，但如果 `backgroundDialog.text` 通過非 Vue 方式（如 `v-html`）渲染，會有 XSS 風險
- 後端返回的 `background` 和 `display_name` 未進行驗證

**現有保護**:
```javascript
// MatchView.vue 第 379 行
<p class="bio-dialog-body">{{ backgroundDialog.text }}</p>
```
✓ 使用 `{{ }}` 綁定會自動轉義，**目前安全**

**建議**: 確保配置不變為 `v-html` 或 `innerHTML`

**影響範圍**: 極低（當前已妥善防護）

---

## 邊緣情況分析

### ✓ 已正確處理

1. **空配對列表** (useMatchCarousel.js 第 52-69 行)
   ```javascript
   if (!len) return [];
   if (len === 1) return [build(0, 'current')]; // 單張卡片時只顯示當前
   ```
   ✓ 正確

2. **遊客模式** (MatchView.vue 第 176-183 行, useMatchFavorites.js 第 177-179 行)
   ```javascript
   if (!nextId) {
     lastLoadedUserId = '';
     favorites.syncFavoriteSet([]);
     // 清空數據
   }

   if (requireLogin && requireLogin({ feature: '收藏角色' })) {
     return false;
   }
   ```
   ✓ 正確處理

3. **手勢取消** (useMatchGestures.js 第 187-190 行)
   ```javascript
   if (offsetY > 90) {
     onSwipeCancel(); // 垂直滑動時自動取消
     return;
   }
   ```
   ✓ 正確

4. **網絡錯誤回滾** (useMatchFavorites.js 第 242-250 行)
   ```javascript
   catch (requestError) {
     favoriteIds.value = previousSet; // 恢復前一個狀態
     // 錯誤提示
     return false;
   }
   ```
   ✓ 正確

### ✗ 需要改進

1. **用戶快速切換帳戶** - 參見問題 #1

2. **快速連擊「收藏」按鈕** - 參見問題 #2

3. **組件掛載/卸載時序** - 參見問題 #3

---

## 內存洩漏檢查

### ✓ 事件監聽器正確清理

**MatchView.vue**:
```javascript
// 第 243-252 行
onMounted(() => {
  window.addEventListener('resize', carousel.measureCardWidth);
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', carousel.measureCardWidth); // ✓
  window.removeEventListener('keydown', handleKeydown);           // ✓
});
```

⚠️ **潛在問題**: `carousel.measureCardWidth` 沒有綁定到特定函數引用，可能導致無法正確移除
```javascript
// 錯誤示例
window.addEventListener('resize', carousel.measureCardWidth);
window.removeEventListener('resize', carousel.measureCardWidth); // 可能無效！
```

**修復**:
```javascript
const handleResize = () => carousel.measureCardWidth();
onMounted(() => {
  window.addEventListener('resize', handleResize);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize); // ✓ 可靠
});
```

### ✓ 定時器正確清理

**useMatchCarousel.js**:
```javascript
// 第 113-131 行
const clearAnimationTimer = () => {
  if (resetTimerId) {
    clearTimeout(resetTimerId);     // ✓
    resetTimerId = undefined;       // ✓
  }
};

onBeforeUnmount(() => {
  clearAnimationTimer();            // ✓
});
```

### ✓ Ref 正確管理

- `carouselContainer.ref` - 正確從模板綁定
- `swipeOffset.ref` - 動畫結束後正確重置
- `favoriteIds.ref` - 使用 Set，無需手動清理

### ⚠️ API 緩存可能洩漏（外部文件）

**api.js 中的 `jsonResultCache`**:
```javascript
const jsonResultCache = new Map();

const deduplicatedJsonRequest = (key, fetcher) => {
  if (jsonResultCache.has(key)) {
    return jsonResultCache.get(key);
  }
  const promise = fetcher().finally(() => {
    setTimeout(() => {
      jsonResultCache.delete(key);  // 100ms 後清理
    }, 100);
  });
  jsonResultCache.set(key, promise);
  return promise;
};
```

⚠️ 如果 Promise 在 100ms 內未完成，不會自動清理。對於長時間掛起的請求可能造成內存洩漏。

**建議**: 增加最大生存時間（TTL）上限：
```javascript
const deduplicatedJsonRequest = (key, fetcher) => {
  if (jsonResultCache.has(key)) {
    return jsonResultCache.get(key);
  }
  const promise = fetcher().finally(() => {
    setTimeout(() => {
      jsonResultCache.delete(key);
    }, 100);
  });

  // 5秒後強制清理
  const ttlTimer = setTimeout(() => {
    jsonResultCache.delete(key);
  }, 5000);

  jsonResultCache.set(key, promise);
  return promise;
};
```

---

## 數據流正確性檢查

### Watch 依賴順序

**MatchView.vue**:
```javascript
// Watch 1: 用戶切換
watch(() => user.value?.id, async (nextId) => {
  // 加載用戶資料、收藏、配對
  favorites.syncFavoriteSet([]);
});

// Watch 2: 用戶收藏變更
watch(
  () => user.value?.favorites,
  (next) => {
    favorites.syncFavoriteSet(next); // 同步本地狀態
  },
  { immediate: true }
);
```

**潛在風險**: 第一個 watch 可能在第二個 watch 之前執行，導致收藏數據被覆蓋：

```
時間線:
1. user.value.id 變更 → watch 1 開始加載
2. user.value.favorites 變更 → watch 2 觸發
3. watch 1 完成，呼叫 favorites.syncFavoriteSet([])
4. watch 2 的結果被覆蓋
```

**修復**: 在 watch 1 中檢查用戶是否變更：
```javascript
watch(
  () => user.value?.id,
  async (nextId, prevId) => {
    if (nextId === prevId) return;

    const currentUserId = nextId;

    await Promise.allSettled([...]);

    // 確認用戶未再次變更
    if (user.value?.id !== currentUserId) return;

    carousel.initialize();
  },
  { immediate: true }
);
```

### Computed Property 依賴

**MembershipView.vue** 第 32-37 行:
```javascript
const activeTier = computed(() => {
  return (
    membershipTiers.find((tier) => tier.id === activeTierId.value) ??
    membershipTiers[0]
  );
});
```

✓ 正確 - 依賴於 `activeTierId.value`，會自動追蹤

---

## API 請求安全檢查

### 1. 冪等性

**useMatchFavorites.js**:
- ✗ 未實現冪等性
- 快速點擊可能導致重複請求被多次執行

**useMembership.js**:
- ✓ 實現冪等性 (第 66-68 行)
```javascript
const idempotencyKey = generateIdempotencyKey();
const data = await apiJson(..., {
  body: { idempotencyKey, ... }
});
```

**建議**: 為 `toggleFavorite` 添加冪等性：
```javascript
const toggleFavorite = async (matchId) => {
  const idempotencyKey = `favorite_${user.value?.id}_${matchId}_${Date.now()}`;

  const response = await apiJson(endpoint, {
    method: wasFavorited ? 'DELETE' : 'POST',
    body: wasFavorited ? { idempotencyKey } : { matchId, idempotencyKey },
    headers: { ...headers },
    skipGlobalLoading: true,
  });
};
```

### 2. 鑑權

✓ 所有 API 調用都檢查並傳遞 token：
```javascript
const token = await firebaseAuth.getCurrentUserIdToken();
headers = { Authorization: `Bearer ${token}` };
```

### 3. 錯誤狀態碼處理

**useMatchFavorites.js**:
```javascript
if (err?.status === 404) {
  favoriteRequestState.lastUserId = targetUserId;
  syncFavoriteSet([]);
  return;
}
```
✓ 正確處理 404（用戶不存在）

### 4. 敏感數據傳輸

✓ 所有敏感操作都：
- 使用 HTTPS（生產環境）
- 檢查用戶身份
- 驗證所有權

---

## Ref 綁定正確性

### MatchView.vue

**第 284 行**:
```javascript
<div class="content-wrapper" ref="carouselContainerRef">
```

✗ **問題**: 在 `<script setup>` 中定義的 `carouselContainerRef` 應該直接定義為 ref，但代碼是：
```javascript
const carouselContainerRef = carousel.carouselContainer; // 指向 composable 中的 ref
```

⚠️ **潛在風險**: 如果 composable 中的 ref 初始化不當，會導致模板綁定失敗

**驗證**:
```javascript
// useMatchCarousel.js 第 40 行
const carouselContainer = ref(null); // ✓ 正確初始化
```

✓ 最終評估: 安全

---

## 錯誤處理完整性

### 完整的錯誤處理

1. **useMatchCarousel.js** - 無 API 調用，無錯誤處理需求 ✓
2. **useMatchGestures.js** - 本地事件處理，try-catch 覆蓋所有異常 ✓
3. **useMatchFavorites.js** - 完整的 try-catch-finally 和回滾邏輯 ✓
4. **useMatchData.js** - 完整的錯誤處理和 fallback ✓
5. **MembershipView.vue** - try-catch 覆蓋 `onMounted` 中的異步操作 ✓

### 缺失的邊界檢查

**useMatchCarousel.js** 第 138 行:
```javascript
const showMatchByIndex = (index) => {
  if (!matches?.value?.length) return;
  const normalized = (index + matches.value.length) % matches.value.length;
  currentIndex.value = normalized;

  if (onIndexChange) {
    const matchData = matches.value[normalized];
    onIndexChange(normalized, matchData); // ✓ matchData 可能 undefined
  }
};
```

✓ 已檢查 `matches.value.length`

---

## 總結與優先級建議

### 立即修復（P1 - 高優先級）

1. **MatchView.vue Watch 競態條件** - 添加 AbortController 取消舊請求
   - 預計修復時間: 15-20 分鐘
   - 影響: 多賬號快速切換

2. **useMatchFavorites.js 並發請求** - 添加請求隊列和 AbortController
   - 預計修復時間: 20-30 分鐘
   - 影響: 快速點擊收藏按鈕

### 後續修復（P2 - 中優先級）

3. **useMatchCarousel.js 卡片寬度測量** - 添加掛載狀態檢查
   - 預計修復時間: 10-15 分鐘
   - 影響: 快速切換視圖 + 調整窗口大小

4. **MembershipView.vue 登出競態** - 添加掛載用戶 ID 追蹤
   - 預計修復時間: 10 分鐘
   - 影響: 加載期間登出

### 優化項（P3 - 低優先級）

5. **useMatchGestures.js Pointer Capture** - 改進異常處理和日誌
   - 預計修復時間: 5 分鐘
   - 影響: 調試和防守性編程

6. **api.js 緩存 TTL** - 添加最大生存時間
   - 預計修復時間: 5 分鐘
   - 影響: 內存洩漏防護

7. **MatchView.vue 事件監聽器** - 使用函數引用確保清理
   - 預計修復時間: 5 分鐘
   - 影響: 內存洩漏防護

### 確認清單（檢查項）

- [ ] MatchView.vue 添加 AbortController
- [ ] useMatchFavorites.js 添加請求隊列
- [ ] useMatchCarousel.js 添加掛載檢查
- [ ] MembershipView.vue 添加掛載用戶追蹤
- [ ] api.js 添加緩存 TTL
- [ ] MatchView.vue 修復事件監聽器引用
- [ ] 測試多賬號快速切換場景
- [ ] 測試快速點擊收藏按鈕
- [ ] 測試登出過程中的狀態

---

## 代碼質量評分

| 維度 | 評分 | 說明 |
|-----|-----|------|
| 邏輯正確性 | 8/10 | 主體邏輯正確，存在競態條件 |
| 錯誤處理 | 8/10 | 覆蓋大多數錯誤，缺少 AbortController |
| 內存管理 | 7/10 | 基本清理到位，缺少 TTL 保護 |
| 邊緣情況處理 | 7/10 | 單用戶場景完善，多用戶/並發不完善 |
| 可維護性 | 9/10 | 代碼結構清晰，注釋完整 |
| **總體評分** | **7.8/10** | 良好，需小幅改進 |

