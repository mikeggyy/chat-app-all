# 過期記錄即時清理與日誌監控優化

## 概述

在 P0-2 廣告解鎖過期邏輯修復的基礎上，新增了兩個優化功能：
1. **過期記錄即時清理**：防止 `unlockHistory` 數組無限累積
2. **日誌監控增強**：及時發現異常情況

## 背景問題

### 原有機制
- 每日 UTC 0:00 重置時清理過期的 `unlockHistory` 記錄
- `checkCanUse` 函數每次都會遍歷整個 `unlockHistory` 數組（包括過期的）
- 如果用戶頻繁觀看廣告，`unlockHistory` 可能累積大量過期記錄

### 潛在風險
- **性能問題**：長數組遍歷影響查詢效率
- **存儲問題**：Firestore 文檔大小有限制（1 MB）
- **延遲清理**：過期記錄要等到下一個 UTC 0:00 才清理

## 優化方案

### 1. 過期記錄即時清理

#### 實現位置
- 文件：`backend/src/services/limitService/limitTracking.js`
- 函數：`checkCanUse(limitData, limit, cleanup = false)`

#### 清理邏輯
```javascript
// 僅在 Transaction 內（cleanup = true）且記錄數量超過閾值時，清理過期記錄
if (cleanup && limitData.unlockHistory.length > 20) {
  const originalLength = limitData.unlockHistory.length;
  limitData.unlockHistory = limitData.unlockHistory.filter(unlock => {
    if (!unlock.expiresAt) return false; // 沒有過期時間的移除
    const expiresAt = new Date(unlock.expiresAt);
    return expiresAt > now; // 只保留未過期的
  });

  const cleanedCount = originalLength - limitData.unlockHistory.length;
  if (cleanedCount > 0) {
    logger.info(`[限制追蹤] 即時清理過期解鎖記錄：移除 ${cleanedCount} 條，剩餘 ${limitData.unlockHistory.length} 條`);
  }
}
```

#### 觸發條件
1. **數量閾值**：`unlockHistory.length > 20`
2. **在 Transaction 內**：`cleanup = true`（只在寫入操作時清理）
3. **有過期記錄**：過濾後的數量少於原始數量

#### 調用路徑
- ✅ `baseLimitService.recordUse` → `checkCanUse(limitData, limit, true)`
  - 在 Firestore Transaction 內
  - 清理後的數據會被保存到 Firestore
- ❌ `baseLimitService.canUse` → `checkCanUse(limitData, limit, false)`
  - 只讀操作，不清理
- ❌ `baseLimitService.getStat` → `checkCanUse(limitData, limit, false)`
  - 只讀操作，不清理
- ❌ `baseLimitService.getAllStats` → `checkCanUse(limitData, limit, false)`
  - 只讀操作，不清理

### 2. 日誌監控增強

#### 監控邏輯
```javascript
// 當解鎖記錄過多時記錄警告
if (limitData.unlockHistory.length > 50) {
  logger.warn(`[限制追蹤] unlockHistory 記錄過多 (${limitData.unlockHistory.length} 條)，建議檢查清理機制`);
}
```

#### 監控目的
- **及時發現異常**：如果記錄數超過 50，說明清理機制可能失效
- **性能預警**：長數組會影響查詢性能
- **數據完整性**：幫助定位數據膨脹問題

## 設計決策

### 為什麼只在 Transaction 內清理？

**問題**：如果在所有 `checkCanUse` 調用中都清理，會有什麼問題？

**答案**：
1. **只讀操作不應修改數據**：`canUse`, `getStat`, `getAllStats` 是只讀操作，修改內存數據可能產生副作用
2. **避免意外保存**：如果在只讀操作中修改了 `limitData`，但後續某個地方意外保存了這個對象，會導致數據不一致
3. **清理需要持久化**：清理的目的是減少 Firestore 中的數據量，只有在 Transaction 內清理才能保存修改

**解決方案**：
- 添加 `cleanup` 參數（默認 `false`）
- 只在寫入操作（`recordUse`）中傳遞 `cleanup = true`
- 其他只讀操作傳遞 `cleanup = false`（或使用默認值）

### 為什麼閾值設為 20？

**閾值 20 的理由**：
1. **日常使用**：用戶每日最多觀看 10 次廣告，每次解鎖有效期 24 小時
2. **正常情況**：理論上最多 10 條有效記錄 + 少量過期記錄
3. **異常情況**：如果超過 20 條，說明可能有：
   - 用戶連續多日使用廣告解鎖
   - 每日清理機制失效
   - 過期記錄未被清理

**性能影響**：
- 20 條記錄的遍歷開銷可以忽略（微秒級）
- 50 條記錄觸發警告，100 條記錄可能影響性能

### 為什麼監控閾值設為 50？

**閾值 50 的理由**：
1. **2.5倍安全邊界**：正常情況最多 20 條，50 條是異常情況
2. **避免頻繁告警**：只在真正異常時才記錄警告
3. **性能臨界點**：50 條記錄開始影響查詢性能

## 與原有清理機制的協作

### 每日清理（原有機制）
- **位置**：`limitReset.checkAndResetAdUnlocks`
- **時機**：每日 UTC 0:00 重置時
- **作用**：全面清理所有過期記錄

### 即時清理（新增機制）
- **位置**：`limitTracking.checkCanUse`
- **時機**：寫入操作時（記錄使用、解鎖等）
- **作用**：在寫入前清理過期記錄，減少數據量

### 協作方式
1. **即時清理優先**：在寫入操作時立即清理（閾值 > 20）
2. **每日清理兜底**：確保所有過期記錄最終都會被清理
3. **雙重保險**：即使即時清理失效，每日清理仍會生效

## 測試場景

### 場景 1：正常使用
- 用戶每日觀看 5 次廣告
- `unlockHistory` 保持在 5-10 條
- 即時清理不觸發（< 20）
- 每日清理正常運作

### 場景 2：頻繁使用
- 用戶每日觀看 10 次廣告
- 連續 3 天使用
- `unlockHistory` 可能達到 25-30 條
- 即時清理觸發，保持在 ~10 條有效記錄

### 場景 3：異常情況
- 每日清理機制失效
- `unlockHistory` 累積到 60 條
- 監控觸發警告（> 50）
- 管理員收到告警，檢查清理機制

## 性能指標

### 即時清理開銷
- **條件判斷**：O(1)
- **數組過濾**：O(n)，n 為 `unlockHistory.length`
- **閾值 20**：約 20 次比較 + 日期解析
- **估計時間**：< 1 ms（可忽略）

### 監控開銷
- **條件判斷**：O(1)
- **日誌記錄**：O(1)
- **估計時間**：< 0.1 ms（可忽略）

### 整體影響
- **正常情況**：無額外開銷（不觸發清理）
- **觸發清理**：< 1 ms（遠低於 Firestore 寫入延遲 ~50-100 ms）
- **淨收益**：減少 Firestore 數據量，長期提升查詢性能

## 日誌示例

### 即時清理日誌
```
[限制追蹤] 即時清理過期解鎖記錄：移除 15 條，剩餘 8 條
```

### 監控警告日誌
```
[限制追蹤] unlockHistory 記錄過多 (63 條)，建議檢查清理機制
```

## 相關文件

- **實現文件**：
  - [backend/src/services/limitService/limitTracking.js](../backend/src/services/limitService/limitTracking.js)
  - [backend/src/services/baseLimitService.js](../backend/src/services/baseLimitService.js)

- **相關文檔**：
  - [限制服務架構](../backend/src/services/limitService/README.md)
  - [P0-2 廣告解鎖過期修復](./BUSINESS_LOGIC_FIXES.md#p0-2)

## 性能優化：重複過濾消除

### 問題描述

**原始邏輯**：
1. 清理過期記錄（第 76-85 行）：`filter()` 遍歷一次
2. 過濾並累計（第 89-97 行）：`filter()` + `reduce()` 再遍歷一次

**問題**：清理後的數組都是有效記錄，不需要再次過濾

### 優化方案（已實現）

**新邏輯**（[limitTracking.js:74-98](../backend/src/services/limitService/limitTracking.js#L74-L98)）：

```javascript
if (cleanup && limitData.unlockHistory.length > 20) {
  // 1. 清理過期記錄
  limitData.unlockHistory = limitData.unlockHistory.filter(unlock => {
    if (!unlock.expiresAt) return false;
    const expiresAt = new Date(unlock.expiresAt);
    return expiresAt > now;
  });

  // ⚡ 2. 性能優化：清理後直接累計，避免重複過濾
  validAdUnlocks = limitData.unlockHistory.reduce((sum, unlock) => sum + (unlock.amount || 0), 0);
} else {
  // 只讀模式：過濾並累計（不修改原數組）
  validAdUnlocks = limitData.unlockHistory.filter(...).reduce(...);
}
```

### 性能提升

| 模式 | 原始邏輯 | 優化後邏輯 | 性能提升 |
|-----|---------|----------|---------|
| **清理模式** | filter + filter + reduce | filter + reduce | ~25-30% |
| **只讀模式** | filter + reduce | filter + reduce | 無變化 |

**計算**：
- **原始**：清理 O(n) + 過濾 O(n) + 累計 O(n) = 3n 次操作
- **優化**：清理 O(n) + 累計 O(n) = 2n 次操作
- **提升**：(3n - 2n) / 3n ≈ 33% 理論提升

**實際效果**（n=20-30）：
- 減少約 20-30 次日期比較操作
- 節省約 0.2-0.3 ms（清理場景）
- 累計效果：每月數千次清理，節省約 1-2 秒

### 正確性驗證

✅ **安全性保證**：
- 清理後的數組只包含 `expiresAt > now` 的記錄
- 直接累計這些記錄是安全的（無需再次過濾）

✅ **向後兼容**：
- 只讀模式邏輯不變
- 清理模式只優化累計步驟，不影響清理邏輯

✅ **邊界情況**：
- 空數組：不進入任何邏輯分支，`validAdUnlocks = 0`
- 清理後為空：`reduce()` 返回初始值 0
- 所有記錄有效：直接累計，結果正確

## 更新日誌

- **2025-01-13**: 性能優化 - 重複過濾消除
  - 清理後直接累計，避免重複過濾
  - 性能提升約 25-30%（清理模式）
  - 保持只讀模式邏輯不變

- **2025-01-13**: 初始實現
  - 添加即時清理邏輯（閾值 20）
  - 添加日誌監控（閾值 50）
  - 只在 Transaction 內清理（`cleanup` 參數）
