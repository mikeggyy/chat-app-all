# 快速參考指南

## 一頁紙總結

### 發現的問題

| # | 文件 | 問題 | 嚴重度 | 修復時間 |
|---|------|------|--------|---------|
| 1 | MatchView.vue | Watch 競態條件 | 🔴 中 | 15-20min |
| 2 | useMatchFavorites.js | 並發請求不同步 | 🔴 中 | 20-30min |
| 3 | useMatchCarousel.js | 卡片寬度 null | 🟡 中 | 10-15min |
| 4 | MembershipView.vue | 登出競態 | 🟢 低 | 10min |
| 5 | useMatchGestures.js | Pointer 異常 | 🟢 低 | 5min |
| 6 | api.js | 緩存無 TTL | 🟢 低 | 5min |
| 7 | MatchView.vue | 事件監聽器引用 | 🟢 低 | 5min |

### 快速修復清單

```bash
# 修復 1: MatchView.vue (最重要)
- 添加 activeRequestId 追蹤
- 檢查 currentRequestId 防止過期數據

# 修復 2: useMatchFavorites.js (最重要)
- 添加 favoriteRequestQueue
- 確保請求順序執行

# 修復 3: useMatchCarousel.js
- 添加 isMounted 狀態
- 檢查掛載狀態後才操作 DOM

# 修復 4-7: 其他小修復
- 添加 mountedUserId 檢查 (MembershipView)
- 改進異常日誌 (useMatchGestures)
- 添加 TTL 計時器 (api.js)
- 使用函數引用 (MatchView 事件監聽)
```

---

## 最常見的場景

### 場景 1: 多賬號用戶快速切換

**症狀**: 登出後以新賬號登入時看到舊賬號的數據

**原因**: MatchView.vue Watch 沒有檢查請求完成時的用戶身份

**修復**: 添加 `currentRequestId` 檢查

**優先級**: 🔴 P1 (立即修復)

---

### 場景 2: 連續點擊收藏按鈕

**症狀**: 快速點擊「收藏」和「取消收藏」時，UI 顯示與伺服器不同步

**原因**: useMatchFavorites.js 允許並發請求

**修復**: 添加請求隊列

**優先級**: 🔴 P1 (立即修復)

---

### 場景 3: 快速切換視圖後輪播崩潰

**症狀**: 快速返回 MatchView 時輪播不工作或寬度異常

**原因**: useMatchCarousel.js 在組件卸載後仍執行 DOM 操作

**修復**: 添加 `isMounted` 檢查

**優先級**: 🟡 P2 (下週修復)

---

## 測試檢查清單

### 基本功能
- [ ] 單用戶正常滑動輪播
- [ ] 點擊「進入聊天室」正常
- [ ] 點擊「收藏」正常
- [ ] 返回時收藏狀態保留

### 邊界情況
- [ ] 沒有配對時不崩潰
- [ ] 遊客模式下不崩潰
- [ ] 網絡超時時提示錯誤
- [ ] 登出期間頁面不崩潰

### 進階場景
- [ ] 快速切換賬號，UI 顯示新賬號數據
- [ ] 快速點擊收藏按鈕，最終狀態正確
- [ ] 快速切換視圖，輪播正常
- [ ] 調整窗口大小，輪播寬度正確

### 性能檢查
- [ ] 內存使用不持續增長
- [ ] 沒有未完成的 API 請求
- [ ] 沒有 console 錯誤
- [ ] 沒有未清理的事件監聽器

---

## 代碼片段速查

### ✅ 正確的競態條件防護

```javascript
const currentRequestId = nextId;
await Promise.allSettled([...requests...]);

// 檢查用戶是否在請求期間變更
if (user.value?.id !== currentRequestId) {
  return; // 忽略舊請求
}
```

### ✅ 正確的請求隊列

```javascript
let queue = Promise.resolve();

const execute = async (fn) => {
  queue = queue.then(fn).catch(console.error);
  return queue;
};

await execute(async () => {
  // 順序執行
});
```

### ✅ 正確的掛載狀態追蹤

```javascript
let isMounted = true;

onBeforeUnmount(() => {
  isMounted = false;
});

// 執行前檢查
if (!isMounted) return;
```

### ✅ 正確的事件監聽器清理

```javascript
const handler = () => carousel.measureCardWidth();

onMounted(() => {
  window.addEventListener('resize', handler);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handler); // ✓ 可靠
});
```

---

## 常見問題解答

### Q: 這些問題會導致數據丟失嗎?
**A**: 不會。主要問題是 UI 與伺服器不同步或特定時序的功能異常。

### Q: 用戶會經常遇到這些問題嗎?
**A**: 取決於使用模式：
- **多賬號用戶**: 經常遇到問題 1
- **快速操作用戶**: 經常遇到問題 2
- **移動設備用戶**: 偶爾遇到問題 3

### Q: 修復會破壞現有功能嗎?
**A**: 不會。所有修復都是防守性的，不改變核心邏輯。

### Q: 可以部分修復嗎?
**A**: 可以。優先修復 P1 (問題 1-2)，其他可逐步修復。

### Q: 需要重寫嗎?
**A**: 不需要。所有修復都是小的、局部的改動。

---

## 文件映射

| 分析報告 | 內容 | 用途 |
|---------|------|------|
| CODE_ANALYSIS_REPORT.md | 詳細技術分析 | 深入了解每個問題 |
| FIX_GUIDE.md | 逐步修復指南 | 實施修復時參考 |
| ANALYSIS_SUMMARY.md | 執行摘要 | 給管理層的報告 |
| QUICK_REFERENCE.md | 本文件 | 快速查閱 |

---

## 優先級執行計畫

### 第 1 週 (P1 修復) - 1-2 小時
```
1. 修復 MatchView.vue Watch 競態 (15-20 min)
2. 修復 useMatchFavorites.js 並發 (20-30 min)
3. 集成測試 (20 min)
4. 部署到生產 (15 min)
```

### 第 2 週 (P2 修復) - 30-45 分鐘
```
1. 修復 useMatchCarousel.js (10-15 min)
2. 修復 MembershipView.vue (10 min)
3. 測試 (15 min)
4. 部署 (10 min)
```

### 第 3 週 (P3 修復) - 20-30 分鐘
```
1. 修復 useMatchGestures.js (5 min)
2. 修復 api.js (5 min)
3. 修復 MatchView.vue 事件監聽 (5 min)
4. 測試和部署 (10 min)
```

---

## 關鍵代碼位置

### MatchView.vue
```javascript
第 173-231 行: watch(() => user.value?.id, ...)
第 243-252 行: onMounted 事件監聽器
```

### useMatchFavorites.js
```javascript
第 170-254 行: toggleFavorite 函數
```

### useMatchCarousel.js
```javascript
第 106-108 行: measureCardWidth 函數
第 169-194 行: animateTo 函數
```

### MembershipView.vue
```javascript
第 104-118 行: onMounted 鉤子
```

### api.js
```javascript
第 111-127 行: deduplicatedJsonRequest 函數
```

---

## 命令速查

```bash
# 快速測試多賬號切換
# 1. 登入用戶 A
# 2. 立即登出，以用戶 B 身份登入
# 3. 檢查 UI 是否顯示用戶 B 的數據

# 快速測試收藏按鈕
# 使用開發者工具控制台:
// 快速點擊 5 次
document.querySelector('[aria-label*="加入收藏"]')?.click()
document.querySelector('[aria-label*="加入收藏"]')?.click()
document.querySelector('[aria-label*="加入收藏"]')?.click()
// 檢查最終狀態

# 快速測試視圖切換
# 1. 打開 MatchView
# 2. 快速切換到 ChatView
# 3. 立即返回 MatchView
# 4. 檢查輪播是否正常工作

# 檢查內存洩漏
# 使用 Chrome DevTools:
# 1. Performance → Memory
# 2. 重複打開/關閉 MatchView 5 次
# 3. 檢查堆大小是否穩定
```

---

## 成功標誌

修復成功的標誌：

- ✅ 多賬號快速切換時，UI 總是顯示當前用戶的數據
- ✅ 快速點擊收藏按鈕，最終狀態與伺服器一致
- ✅ 快速切換視圖後，輪播仍然正常工作
- ✅ 內存使用穩定，無持續增長
- ✅ 瀏覽器控制台無紅色錯誤
- ✅ 所有相關的 API 調用已完成

---

## 聯絡清單

如遇到問題，請檢查以下順序：

1. **詳細技術問題** → 查看 CODE_ANALYSIS_REPORT.md
2. **如何實施修復** → 查看 FIX_GUIDE.md
3. **快速問題查找** → 查看本文件 (QUICK_REFERENCE.md)
4. **給管理層報告** → 查看 ANALYSIS_SUMMARY.md

---

**最後更新**: 2025-11-12
**報告狀態**: ✅ 完成
**建議行動**: 🔴 立即實施 P1 修復

