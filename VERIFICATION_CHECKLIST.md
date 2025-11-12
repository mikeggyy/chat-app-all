# 修復驗證檢查清單

本清單用於驗證所有修復已正確實施並通過測試。

---

## 修復 1: MatchView.vue - Watch 競態條件

### 代碼驗證
- [ ] 文件 `d:\project\chat-app-all\chat-app\frontend\src\views\MatchView.vue` 第 171 行附近
- [ ] 添加了 `let activeRequestId = null;`
- [ ] watch 回調中添加了 `const currentRequestId = nextId;`
- [ ] 在 Promise.allSettled 後添加了用戶檢查：
  ```javascript
  if (user.value?.id !== currentRequestId) {
    logger.log('[MatchView] 用戶在加載期間變更，忽略舊請求結果');
    return;
  }
  ```
- [ ] 再次檢查確保用戶未變更：
  ```javascript
  if (user.value?.id !== currentRequestId) {
    return;
  }
  ```

### 功能測試
- [ ] 測試用例 1: 單用戶正常流程
  - [ ] 登入用戶 A
  - [ ] MatchView 加載正常
  - [ ] 配對、收藏功能正常
  - [ ] 預期: ✅ 所有功能正常

- [ ] 測試用例 2: 用戶快速切換
  - [ ] 登入用戶 A
  - [ ] MatchView 開始加載配對列表 (注意加載指示器)
  - [ ] 在加載中快速登出
  - [ ] 以用戶 B 身份快速登入
  - [ ] 預期: ✅ UI 顯示用戶 B 的數據，不混合用戶 A 的數據

- [ ] 測試用例 3: 多次快速切換
  - [ ] 登入用戶 A
  - [ ] 加載中切換到用戶 B
  - [ ] 加載中切換到用戶 C
  - [ ] 加載中切換回用戶 A
  - [ ] 預期: ✅ 最終 UI 顯示用戶 A 的正確數據

### 控制台檢查
- [ ] 打開瀏覽器開發者工具
- [ ] Network 標籤中檢查 API 調用
  - [ ] `/api/users/{userId}/favorites` 僅返回最後一次請求的結果
  - [ ] `/match/all` 僅返回最後一次請求的結果
- [ ] Console 標籤中檢查
  - [ ] 快速切換時能看到 `[MatchView] 用戶在加載期間變更...` 日誌
  - [ ] 無 JavaScript 錯誤

### 回滾計畫
```javascript
// 若需回滾，移除以下代碼:
let activeRequestId = null; // 移除
const currentRequestId = nextId; // 移除
if (user.value?.id !== currentRequestId) { // 移除整個塊
  logger.log('[MatchView] 用戶在加載期間變更，忽略舊請求結果');
  return;
}
```

---

## 修復 2: useMatchFavorites.js - 並發請求

### 代碼驗證
- [ ] 文件 `d:\project\chat-app-all\chat-app\frontend\src\composables\match\useMatchFavorites.js`
- [ ] 文件頂部導入中已有: `import { ref, reactive, computed } from 'vue';`
- [ ] 在 `export function useMatchFavorites` 中添加:
  ```javascript
  const favoriteRequestQueue = new Map(); // 按 matchId 存儲待處理請求
  ```
- [ ] `toggleFavorite` 函數中：
  - [ ] 移除了簡單的 try-catch
  - [ ] 添加了請求隊列邏輯
  - [ ] 使用 `.then()` 鏈接確保順序執行
  - [ ] 完成後從隊列中移除: `favoriteRequestQueue.delete(matchId);`

### 功能測試
- [ ] 測試用例 1: 正常收藏流程
  - [ ] 點擊「收藏」按鈕
  - [ ] 等待請求完成
  - [ ] 刷新頁面
  - [ ] 預期: ✅ 收藏狀態保持

- [ ] 測試用例 2: 快速點擊同一按鈕
  - [ ] 快速連續點擊「收藏」按鈕 5-10 次
  - [ ] 觀察 UI 狀態變化
  - [ ] 等待所有請求完成
  - [ ] 刷新頁面
  - [ ] 預期: ✅ 最終狀態正確，與伺服器一致

- [ ] 測試用例 3: 快速切換多個角色的收藏
  - [ ] 快速點擊 3 個不同角色的「收藏」按鈕
  - [ ] 不等待請求完成，繼續切換
  - [ ] 等待所有請求完成
  - [ ] 刷新頁面
  - [ ] 預期: ✅ 每個角色的收藏狀態都正確

- [ ] 測試用例 4: 網絡超時情況
  - [ ] 打開開發者工具 Network 標籤
  - [ ] 設置網絡為「Slow 3G」或「Offline」
  - [ ] 快速點擊「收藏」
  - [ ] 預期: ✅ UI 回滾，顯示錯誤提示

### Network 檢查
- [ ] 打開 Network 標籤
- [ ] 快速點擊「收藏」3 次
- [ ] 檢查：
  - [ ] 每個 matchId 只有一個活躍請求
  - [ ] 請求按點擊順序完成 (可能因網絡而異)
  - [ ] 無重複請求

### 性能檢查
- [ ] 打開 Performance 標籤
- [ ] 記錄快速點擊「收藏」10 次的過程
- [ ] 檢查：
  - [ ] 無長時間的主線程阻塞
  - [ ] UI 響應流暢

### 回滾計畫
```javascript
// 若需回滾，恢復簡單的 try-catch:
const toggleFavorite = async (matchId) => {
  // ... 前面的檢查 ...
  try {
    const response = await apiJson(endpoint, { ... });
    // ... 更新 UI ...
    return true;
  } catch (requestError) {
    favoriteIds.value = previousSet;
    // ... 錯誤處理 ...
    return false;
  } finally {
    favoriteMutating.value = false;
  }
};
```

---

## 修復 3: useMatchCarousel.js - 卡片寬度測量

### 代碼驗證
- [ ] 文件 `d:\project\chat-app-all\chat-app\frontend\src\composables\match\useMatchCarousel.js`
- [ ] 在 `export function useMatchCarousel` 開始添加:
  ```javascript
  let isMounted = true;
  ```
- [ ] `measureCardWidth` 函數已修改為:
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
- [ ] `animateTo` 函數開始添加: `if (!isMounted) return;`
- [ ] `animateTo` 內的 `setTimeout` 回調中添加: `if (!isMounted) return;`
- [ ] `onBeforeUnmount` 中設置: `isMounted = false;`

- [ ] MatchView.vue 中修復事件監聽器:
  ```javascript
  onMounted(() => {
    carousel.measureCardWidth();
    const handleResizeCarousel = () => carousel.measureCardWidth();
    window.addEventListener('resize', handleResizeCarousel);

    onBeforeUnmount(() => {
      window.removeEventListener('resize', handleResizeCarousel);
    });
  });
  ```

### 功能測試
- [ ] 測試用例 1: 正常輪播
  - [ ] 打開 MatchView
  - [ ] 滑動輪播
  - [ ] 預期: ✅ 輪播正常工作，動畫流暢

- [ ] 測試用例 2: 快速視圖切換
  - [ ] 打開 MatchView
  - [ ] 快速點擊「進入聊天室」進入 ChatView
  - [ ] 立即返回 MatchView (在返回動畫中)
  - [ ] 嘗試滑動輪播
  - [ ] 預期: ✅ 輪播正常工作，無錯誤

- [ ] 測試用例 3: 快速切換 + 調整窗口大小
  - [ ] 打開 MatchView
  - [ ] 調整瀏覽器窗口大小
  - [ ] 同時快速切換視圖
  - [ ] 返回 MatchView
  - [ ] 預期: ✅ 輪播寬度正確，無異常

- [ ] 測試用例 4: 單個卡片顯示
  - [ ] 確保只有一個配對角色可用的情況
  - [ ] 打開 MatchView
  - [ ] 預期: ✅ 顯示單個卡片，無錯誤

### 調整大小檢查
- [ ] 打開 DevTools 元素檢查器
- [ ] 選擇 `.content-wrapper` 元素
- [ ] 調整窗口大小
- [ ] 檢查元素的 `offsetWidth`
  - [ ] 應隨窗口大小變化
  - [ ] `cardWidth` 應自動更新

### 回滾計畫
```javascript
// 若需回滾，移除掛載檢查:
const measureCardWidth = () => {
  cardWidth.value = carouselContainer.value?.offsetWidth ?? 0;
};

const animateTo = (direction) => {
  clearAnimationTimer();
  if (!cardWidth.value) {
    measureCardWidth();
  }
  // ... 其餘代碼
};

onBeforeUnmount(() => {
  clearAnimationTimer();
  // 移除 isMounted = false;
});
```

---

## 修復 4: MembershipView.vue - 登出競態

### 代碼驗證
- [ ] 文件 `d:\project\chat-app-all\chat-app\frontend\src\views\MembershipView.vue`
- [ ] 在 `<script setup>` 中添加:
  ```javascript
  let mountedUserId = null;
  ```
- [ ] `onMounted` 中保存 userId:
  ```javascript
  mountedUserId = user.value.id;
  ```
- [ ] 加載後檢查:
  ```javascript
  if (user.value?.id === mountedUserId) {
    // 更新 activeTierId
  }
  ```
- [ ] 添加 `onBeforeUnmount`:
  ```javascript
  onBeforeUnmount(() => {
    mountedUserId = null;
  });
  ```

### 功能測試
- [ ] 測試用例 1: 正常流程
  - [ ] 登入用戶
  - [ ] 打開會員方案頁面
  - [ ] 等待加載完成
  - [ ] 預期: ✅ 頁面正常顯示，等級選擇正確

- [ ] 測試用例 2: 加載中登出
  - [ ] 登入用戶
  - [ ] 打開會員方案頁面
  - [ ] 在加載指示器顯示時立即登出
  - [ ] 預期: ✅ 返回登入頁面，無錯誤

- [ ] 測試用例 3: 加載中切換用戶
  - [ ] 登入用戶 A
  - [ ] 打開會員方案頁面
  - [ ] 在加載中切換到用戶 B (登出 + 登入)
  - [ ] 預期: ✅ 頁面顯示用戶 B 的資訊或返回登入

### 回滾計畫
```javascript
// 若需回滾，移除用戶追蹤:
onMounted(async () => {
  if (user.value?.id) {
    try {
      await loadMembership(user.value.id, { skipGlobalLoading: true });
      if (currentTier.value === "vip" || currentTier.value === "vvip") {
        activeTierId.value = currentTier.value;
      }
    } catch (error) {
      logger.error('[會員方案] 載入會員資料失敗', error);
    }
  }
});
```

---

## 修復 5-7: 次要修復

### 修復 5: useMatchGestures.js - Pointer Capture

**代碼驗證**:
- [ ] `capturePointer` 函數中添加返回值: `return true;` / `return false;`
- [ ] 異常捕獲中添加日誌 (開發環境)
- [ ] `onSwipeStart` 中使用返回值 (可選)

**測試**:
- [ ] 進行各種滑動手勢
- [ ] 在開發模式檢查控制台無警告

---

### 修復 6: api.js - 緩存 TTL

**代碼驗證**:
- [ ] `deduplicatedJsonRequest` 函數中添加 TTL 計時器:
  ```javascript
  const ttlTimer = setTimeout(() => {
    if (jsonResultCache.has(key)) {
      logger.warn('[API Cache] 強制清理超時的緩存:', key);
      jsonResultCache.delete(key);
    }
  }, 5000);
  ```
- [ ] 在 Promise.finally 中清除 TTL 計時器

**測試**:
- [ ] 發送長時間掛起的請求
- [ ] 檢查 5 秒後緩存被清理

---

### 修復 7: MatchView.vue - 事件監聽器引用

**代碼驗證**:
- [ ] `onMounted` 中使用函數引用:
  ```javascript
  const handleResizeCarousel = () => carousel.measureCardWidth();
  window.addEventListener('resize', handleResizeCarousel);
  ```
- [ ] `onBeforeUnmount` 中移除相同引用

**測試**:
- [ ] 多次掛載/卸載 MatchView
- [ ] 檢查無內存洩漏

---

## 綜合系統測試

### 完整使用流程測試

**場景 A: 新用戶**
- [ ] 登入 → MatchView 加載 → 滑動輪播 → 收藏角色 → 進入聊天室
- [ ] 預期: ✅ 所有步驟正常

**場景 B: 多賬號用戶**
- [ ] 登入用戶 A → 返回 MatchView → 快速登出 → 登入用戶 B
- [ ] 預期: ✅ UI 顯示用戶 B 的數據

**場景 C: 快速操作**
- [ ] 快速滑動輪播 → 快速點擊收藏 → 快速進入聊天
- [ ] 預期: ✅ 所有操作正常執行

**場景 D: 網絡不良**
- [ ] 打開 DevTools Network 限流為 Slow 3G
- [ ] 打開 MatchView → 快速操作 → 等待請求完成
- [ ] 預期: ✅ 錯誤處理正確，UI 可恢復

---

## 性能測試

### 內存洩漏檢查

```
步驟:
1. 打開 Chrome DevTools → Memory 標籤
2. 拍攝初始堆快照 (Snapshot 1)
3. 打開 MatchView
4. 快速滑動輪播 20 次
5. 點擊進入聊天室
6. 返回 MatchView
7. 重複步驟 3-6 共 5 次
8. 拍攝最終堆快照 (Snapshot 2)
9. 對比兩個快照，檢查內存增長

預期結果:
- [ ] 堆大小穩定，無持續增長
- [ ] 無分離的 DOM 節點
- [ ] 無未清理的事件監聽器
```

### API 調用檢查

```
步驟:
1. 打開 Chrome DevTools → Network 標籤
2. 打開 MatchView
3. 快速點擊「收藏」3 次
4. 切換不同的角色

預期結果:
- [ ] 無重複的 API 請求
- [ ] 每個 matchId 只有一個活躍請求
- [ ] 所有請求都正確完成
```

### 幀率檢查

```
步驟:
1. 打開 Chrome DevTools → Performance 標籤
2. 開始記錄
3. 進行快速滑動和點擊
4. 停止記錄

預期結果:
- [ ] 平均幀率 ≥ 60 FPS
- [ ] 無長時間的主線程阻塞
- [ ] 動畫流暢
```

---

## 最終簽字確認

### 開發人員確認
- [ ] 所有代碼修復已實施
- [ ] 所有功能測試已通過
- [ ] 所有邊界情況已驗證
- [ ] 代碼審查已完成

**簽字**: _________________ **日期**: _________

### QA 確認
- [ ] 所有測試場景已執行
- [ ] 無新的 bug 引入
- [ ] 性能指標達標
- [ ] 用戶體驗改善

**簽字**: _________________ **日期**: _________

### 產品確認
- [ ] 功能符合需求
- [ ] 用戶體驗改善
- [ ] 可部署到生產

**簽字**: _________________ **日期**: _________

---

## 部署前檢查清單

在部署到生產環境前，確認：

- [ ] 所有修復均已合併到主分支
- [ ] CI/CD 流程全部通過
- [ ] 性能基準測試無回退
- [ ] 安全審計通過
- [ ] 文檔已更新
- [ ] 團隊成員已知曉變更
- [ ] 回滾計畫已準備
- [ ] 監控告警已配置

---

## 部署後檢查清單

部署 24 小時內：

- [ ] 生產環境無報錯日誌
- [ ] 用戶反饋無異常
- [ ] 性能指標正常
- [ ] API 調用成功率 > 99%
- [ ] 無內存洩漏告警

---

**檢查清單版本**: 1.0
**最後更新**: 2025-11-12
**狀態**: ✅ 準備就緒

