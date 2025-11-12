# 前端代碼修復指南

本指南提供所有發現問題的詳細修復步驟。

---

## 修復 1：MatchView.vue - Watch 競態條件

### 問題
用戶快速切換賬號時，舊請求的數據可能覆蓋新用戶的數據。

### 修復步驟

**文件**: `d:\project\chat-app-all\chat-app\frontend\src\views\MatchView.vue`

**原始代碼** (第 171-231 行):
```javascript
let lastLoadedUserId = '';

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

      const [profileResult, favoritesResult, matchesResult] =
        await Promise.allSettled([
          loadUserProfile(nextId, { skipGlobalLoading: true }),
          favorites.fetchFavoritesForCurrentUser({ skipGlobalLoading: true }),
          matchData.loadMatches(),
        ]);

      // ... 錯誤處理 ...

      carousel.initialize();
      return;
    }

    if (favorites.favoriteRequestState.lastUserId !== nextId) {
      await favorites.fetchFavoritesForCurrentUser({ skipGlobalLoading: true });
    }
  },
  { immediate: true }
);
```

**修復後代碼**:
```javascript
let lastLoadedUserId = '';
let activeRequestId = null; // 追蹤當前活躍請求的用戶 ID

watch(
  () => user.value?.id,
  async (nextId, prevId) => {
    if (!nextId) {
      lastLoadedUserId = '';
      activeRequestId = null;
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
      activeRequestId = nextId; // 記錄此請求的用戶 ID

      const currentRequestId = nextId; // 捕獲閉包中的值

      const [profileResult, favoritesResult, matchesResult] =
        await Promise.allSettled([
          loadUserProfile(nextId, { skipGlobalLoading: true }),
          favorites.fetchFavoritesForCurrentUser({ skipGlobalLoading: true }),
          matchData.loadMatches(),
        ]);

      // 檢查用戶是否在請求期間變更
      if (user.value?.id !== currentRequestId) {
        logger.log('[MatchView] 用戶在加載期間變更，忽略舊請求結果');
        return;
      }

      // 記錄開發環境中的錯誤
      if (profileResult.status === 'rejected') {
        logger.warn('載入用戶資料失敗:', profileResult.reason);
      }
      if (favoritesResult.status === 'rejected') {
        logger.warn('載入收藏列表失敗:', favoritesResult.reason);
      }
      if (matchesResult.status === 'rejected') {
        logger.warn('載入匹配列表失敗:', matchesResult.reason);
      }

      // 再次檢查，確保用戶仍未變更（防止競態）
      if (user.value?.id !== currentRequestId) {
        return;
      }

      carousel.initialize();
      activeRequestId = null;
      return;
    }

    if (favorites.favoriteRequestState.lastUserId !== nextId) {
      await favorites.fetchFavoritesForCurrentUser({ skipGlobalLoading: true });
    }
  },
  { immediate: true }
);
```

### 驗證方法
```javascript
// 在瀏覽器控制台測試
// 1. 登入用戶 A
// 2. 立即快速登出並以用戶 B 身份登入（在數據加載完成前）
// 3. 檢查 UI 是否顯示用戶 B 的數據（而非混合數據）
// 4. 檢查瀏覽器控制台是否有"用戶在加載期間變更"的日誌
```

---

## 修復 2：useMatchFavorites.js - 並發請求問題

### 問題
用戶快速點擊「收藏」按鈕時，多個並發請求導致 UI 狀態與伺服器不同步。

### 修復步驟

**文件**: `d:\project\chat-app-all\chat-app\frontend\src\composables\match\useMatchFavorites.js`

**需要添加到文件頂部**:
```javascript
import { ref, reactive, computed } from 'vue';
import { apiJson } from '../../utils/api';
import { logger } from '../../utils/logger';

// 添加請求隊列控制
const favoriteRequestQueue = new Map(); // 按 matchId 存儲待處理的請求
```

**替換 `toggleFavorite` 函數**:

```javascript
const toggleFavorite = async (matchId) => {
  favoriteError.value = '';

  if (favoriteMutating.value || !matchId) {
    return false;
  }

  // 檢查是否為遊客
  if (requireLogin && requireLogin({ feature: '收藏角色' })) {
    return false;
  }

  const currentProfile = user?.value;
  if (!currentProfile?.id) {
    favoriteError.value = '請登入後才能收藏角色。';
    return false;
  }

  let token;
  try {
    token = await firebaseAuth.getCurrentUserIdToken();
  } catch (authError) {
    favoriteError.value =
      authError instanceof Error
        ? authError.message
        : '取得登入資訊時發生錯誤，請重新登入後再試。';
    return false;
  }

  favoriteMutating.value = true;
  const wasFavorited = favoriteIds.value.has(matchId);
  const previousSet = new Set(favoriteIds.value);
  const optimisticSet = new Set(previousSet);

  // Optimistic UI 更新
  if (wasFavorited) {
    optimisticSet.delete(matchId);
  } else {
    optimisticSet.add(matchId);
  }

  favoriteIds.value = optimisticSet;

  // 將請求加入隊列，確保順序執行
  const requestPromise = (
    favoriteRequestQueue.get(matchId) || Promise.resolve()
  ).then(async () => {
    try {
      const endpoint = wasFavorited
        ? `/api/users/${encodeURIComponent(
            currentProfile.id
          )}/favorites/${encodeURIComponent(matchId)}`
        : `/api/users/${encodeURIComponent(currentProfile.id)}/favorites`;

      const response = await apiJson(endpoint, {
        method: wasFavorited ? 'DELETE' : 'POST',
        body: wasFavorited ? undefined : { matchId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        skipGlobalLoading: true,
      });

      const favoritesList = Array.isArray(response?.favorites)
        ? response.favorites
        : [];

      // 檢查用戶是否仍為當前用戶（防止切換賬號後應用舊數據）
      const currentUser = user?.value;
      if (currentUser?.id !== currentProfile.id) {
        logger.log('[Favorites] 用戶在請求期間變更，忽略結果');
        return false;
      }

      favoriteIds.value = new Set(favoritesList);
      if (onUpdateProfile) {
        onUpdateProfile({
          ...currentProfile,
          favorites: favoritesList,
        });
      }

      return true;
    } catch (requestError) {
      // 只在最後一個請求失敗時回滾
      const queuedPromise = favoriteRequestQueue.get(matchId);
      if (queuedPromise === requestPromise) {
        favoriteIds.value = previousSet;
        favoriteError.value =
          requestError instanceof Error
            ? requestError.message
            : '更新收藏時發生錯誤，請稍後再試。';
        logger.error('切換收藏失敗:', requestError);
      }
      return false;
    }
  });

  // 存儲請求 Promise
  favoriteRequestQueue.set(matchId, requestPromise);

  // 清理完成後從隊列移除
  requestPromise.finally(() => {
    if (favoriteRequestQueue.get(matchId) === requestPromise) {
      favoriteRequestQueue.delete(matchId);
    }
    favoriteMutating.value = false;
  });

  await requestPromise;
  return true;
};
```

### 驗證方法
```javascript
// 在瀏覽器控制台測試
// 1. 快速點擊某個角色的「收藏」按鈕 5 次以上
// 2. 觀察 UI 的收藏狀態變化
// 3. 等待所有請求完成
// 4. 刷新頁面，檢查服務器狀態是否與 UI 一致
```

---

## 修復 3：useMatchCarousel.js - 卡片寬度測量

### 問題
組件卸載時 ref 可能為 null，導致寬度測量失敗。

### 修復步驟

**文件**: `d:\project\chat-app-all\chat-app\frontend\src\composables\match\useMatchCarousel.js`

**在 `export function useMatchCarousel` 內頂部添加**:
```javascript
export function useMatchCarousel(options = {}) {
  const { matches, onIndexChange } = options;

  // 追蹤組件掛載狀態
  let isMounted = true;

  // ... 其餘代碼 ...
```

**替換 `measureCardWidth` 函數**:
```javascript
const measureCardWidth = () => {
  if (!isMounted || !carouselContainer.value) {
    return;
  }
  const width = carouselContainer.value.offsetWidth;
  if (width > 0) {
    cardWidth.value = width;
  }
};
```

**替換 `animateTo` 函數**:
```javascript
const animateTo = (direction) => {
  if (!isMounted) return; // 檢查組件是否仍掛載

  clearAnimationTimer();
  if (!cardWidth.value || cardWidth.value <= 0) {
    measureCardWidth();
  }

  const width =
    cardWidth.value ||
    (carouselContainer.value?.offsetWidth) ||
    (typeof window !== 'undefined' ? window.innerWidth : 0) ||
    1;

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
```

**替換 `onBeforeUnmount` 鉤子**:
```javascript
// 清理資源
onBeforeUnmount(() => {
  isMounted = false; // 添加這一行
  clearAnimationTimer();
});
```

**在 MatchView.vue 中修復事件監聽器**:

**原始代碼** (第 243-247 行):
```javascript
onMounted(() => {
  carousel.measureCardWidth();
  window.addEventListener('resize', carousel.measureCardWidth);
  window.addEventListener('keydown', handleKeydown);
});
```

**修復後代碼**:
```javascript
onMounted(() => {
  carousel.measureCardWidth();

  // 使用箭頭函數綁定，確保移除時使用相同引用
  const handleResizeCarousel = () => carousel.measureCardWidth();

  window.addEventListener('resize', handleResizeCarousel);
  window.addEventListener('keydown', handleKeydown);

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResizeCarousel);
    window.removeEventListener('keydown', handleKeydown);
  });
});
```

### 驗證方法
```javascript
// 在瀏覽器控制台測試
// 1. 打開 MatchView
// 2. 快速切換視圖（進入聊天，返回 MatchView）
// 3. 調整窗口大小
// 4. 檢查輪播是否正常工作（無卡頓或錯誤寬度）
```

---

## 修復 4：MembershipView.vue - 登出競態

### 問題
用戶在加載會員資料期間登出，UI 可能顯示舊的會員等級。

### 修復步驟

**文件**: `d:\project\chat-app-all\chat-app\frontend\src\views\MembershipView.vue`

**在 `<script setup>` 塊中添加**:
```javascript
// 追蹤掛載時的用戶 ID，防止登出競態
let mountedUserId = null;
```

**替換 `onMounted` 鉤子**:
```javascript
onMounted(async () => {
  if (user.value?.id) {
    mountedUserId = user.value.id;

    try {
      await loadMembership(user.value.id, { skipGlobalLoading: true });

      // 檢查用戶是否在加載期間登出或變更
      if (user.value?.id === mountedUserId) {
        // 如果用戶已經是付費會員，預設選中對應的等級
        if (currentTier.value === "vip" || currentTier.value === "vvip") {
          activeTierId.value = currentTier.value;
        }
      } else {
        logger.log('[會員方案] 用戶在加載期間變更，忽略結果');
      }
    } catch (error) {
      logger.error('[會員方案] 載入會員資料失敗', error);
      // 載入失敗時，使用預設的免費方案顯示，不阻止頁面渲染
    }
  }
});

// 在 onBeforeUnmount 中清理
onBeforeUnmount(() => {
  mountedUserId = null;
});
```

### 驗證方法
```javascript
// 在瀏覽器控制台測試
// 1. 以付費會員身份登入
// 2. 打開會員方案頁面
// 3. 頁面加載中（未完成）時快速登出
// 4. 檢查是否回到免費方案視圖（正確行為）
```

---

## 修復 5：api.js - 緩存 TTL 保護（可選）

### 問題
API 緩存可能因長時間掛起請求而洩漏內存。

### 修復步驟

**文件**: `d:\project\chat-app-all\chat-app\frontend\src\utils\api.js`

**找到並替換 `deduplicatedJsonRequest` 函數** (約第 111-127 行):

```javascript
const deduplicatedJsonRequest = (key, fetcher) => {
  // 如果已有相同請求在進行中，返回該 Promise
  if (jsonResultCache.has(key)) {
    return jsonResultCache.get(key);
  }

  // 創建新請求
  const promise = fetcher().finally(() => {
    // 請求完成後，延遲 100ms 清理緩存
    setTimeout(() => {
      jsonResultCache.delete(key);
    }, 100);
  });

  // 添加最大生存時間（5秒），防止內存洩漏
  const ttlTimer = setTimeout(() => {
    if (jsonResultCache.has(key)) {
      logger.warn('[API Cache] 強制清理超時的緩存:', key);
      jsonResultCache.delete(key);
    }
  }, 5000);

  jsonResultCache.set(key, promise);

  // 確保 TTL 計時器隨請求完成而清除
  promise.finally(() => {
    clearTimeout(ttlTimer);
  });

  return promise;
};
```

### 驗證方法
```javascript
// 開發者工具中檢查內存
// 1. 打開 DevTools → Performance/Memory
// 2. 取快照
// 3. 進行大量 API 調用
// 4. 5 秒後再次取快照
// 5. 驗證第一次快照中的緩存已被清理
```

---

## 修復 6：useMatchGestures.js - 異常處理改進（可選）

### 問題
Pointer Capture 失敗時沒有日誌記錄，不利於調試。

### 修復步驟

**文件**: `d:\project\chat-app-all\chat-app\frontend\src\composables\match\useMatchGestures.js`

**替換 `capturePointer` 函數**:
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
    // 記錄異常以便調試（僅在開發環境）
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[Match Gestures] Pointer capture failed:',
        err.message,
        { pointerId: event.pointerId }
      );
    }
    activePointerId = null;
    activePointerTarget = null;
    return false;
  }
};
```

**替換 `onSwipeStart` 中的 capture 調用**:
```javascript
const onSwipeStart = (event) => {
  // ... 前面的檢查代碼 ...

  // 捕獲 pointer（成功/失敗都繼續）
  capturePointer(event);

  // 記錄起始位置
  const point = readPoint(event);
  swipeActive.value = true;
  swipeStartX.value = point.clientX;
  swipeStartY.value = point.clientY;

  // ... 後面的代碼 ...
};
```

### 驗證方法
```javascript
// 在瀏覽器控制台檢查開發日誌
// 1. 在開發環境打開頁面
// 2. 進行各種手勢操作
// 3. 查看控制台是否有警告信息（正常情況無警告）
```

---

## 綜合測試檢查清單

### 功能測試

- [ ] **單用戶場景**
  - [ ] 打開 MatchView，正常滑動輪播
  - [ ] 點擊「進入聊天室」，功能正常
  - [ ] 快速點擊「收藏」按鈕 10 次，UI 狀態正確
  - [ ] 返回 MatchView，收藏狀態保留

- [ ] **多用戶場景**
  - [ ] 登入用戶 A
  - [ ] 快速切換至用戶 B（數據加載中）
  - [ ] 驗證 UI 顯示用戶 B 的數據
  - [ ] 檢查收藏列表、配對等都是用戶 B 的

- [ ] **會員頁面**
  - [ ] 載入會員方案
  - [ ] 在載入中登出，驗證返回正常
  - [ ] 登入付費會員，驗證等級選擇正確

### 邊界情況測試

- [ ] **空數據**
  - [ ] 沒有配對時的行為
  - [ ] 沒有收藏時的行為
  - [ ] 遊客模式下的行為

- [ ] **網絡錯誤**
  - [ ] 網絡超時，驗證錯誤提示和回滾
  - [ ] API 返回 404，驗證正確處理
  - [ ] API 返回 500，驗證錯誤提示

- [ ] **時序邊界**
  - [ ] 快速點擊不同角色的「收藏」按鈕
  - [ ] 快速切換視圖
  - [ ] 快速調整窗口大小

### 性能測試

- [ ] **內存洩漏**
  - [ ] 使用 Chrome DevTools Memory 檢查
  - [ ] 重複打開/關閉 MatchView 5 次
  - [ ] 檢查堆大小是否持續增長

- [ ] **API 調用**
  - [ ] 使用 Network 標籤檢查重複請求
  - [ ] 驗證請求去重工作正常
  - [ ] 檢查是否有未完成的長期掛起請求

---

## 部署檢查

在部署到生產環境前，確保：

- [ ] 所有修復已應用
- [ ] 本地測試通過
- [ ] 代碼審查完成
- [ ] 沒有 console.error 或未處理的 Promise rejection
- [ ] 性能測試通過（無內存洩漏）
- [ ] 相關的 E2E 測試通過

---

## 回滾計畫

如果修復引入新問題，可按以下步驟回滾：

1. **MatchView.vue 修復**: 移除 `activeRequestId` 相關代碼，恢復原始 watch
2. **useMatchFavorites.js 修復**: 移除 `favoriteRequestQueue` 相關代碼，恢復簡單的 try-catch
3. **useMatchCarousel.js 修復**: 移除 `isMounted` 狀態，恢復簡單的寬度測量
4. **MembershipView.vue 修復**: 移除 `mountedUserId` 追蹤，恢復原始 onMounted
5. **api.js 修復**: 移除 TTL 計時器，保留原始延遲清理

---

## 相關文件和參考

- 主分析報告: `CODE_ANALYSIS_REPORT.md`
- API 工具: `frontend/src/utils/api.js`
- Firebase 認證: `frontend/src/composables/useFirebaseAuth.js`
- Logger: `frontend/src/utils/logger.js`

