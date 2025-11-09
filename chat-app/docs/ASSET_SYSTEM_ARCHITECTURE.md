# 資產系統架構 (Asset System Architecture)

> 最後更新：2025-11-09
> 版本：2.0（重構後）

## 概述

本文檔說明重構後的資產管理系統架構，解決了之前多重資料來源導致的數據不一致問題。

## 設計原則

### 單一真實來源 (Single Source of Truth)

**卡片類資產**：主文檔 `users/{userId}/assets` 為唯一真實來源
**禮物類資產**：子集合 `users/{userId}/assets/gift_*` 為真實來源
**藥水**：獨立的 potions 系統

### 為什麼這樣設計？

1. **卡片種類少**：只有 5 種卡片（createCards, characterUnlockCards, photoUnlockCards, videoUnlockCards, voiceUnlockCards）
2. **禮物種類多**：有 20+ 種禮物，使用子集合更靈活
3. **查詢效率**：主文檔查詢比子集合查詢快
4. **數據一致性**：避免主文檔和子集合不同步

---

## 資料存儲架構

### 1. 主文檔 (Main Document)

**路徑**: `users/{userId}`

**卡片資產字段** (`assets` 對象):
```javascript
{
  assets: {
    characterUnlockCards: 1,    // 角色解鎖卡
    photoUnlockCards: 0,         // 照片解鎖卡
    videoUnlockCards: 0,         // 影片解鎖卡
    voiceUnlockCards: 0,         // 語音解鎖卡
    createCards: 11,             // 創建角色卡
  }
}
```

### 2. 子集合 (Subcollection)

**路徑**: `users/{userId}/assets/{assetId}`

**僅用於禮物**:
```javascript
// 文檔 ID: gift_rose
{
  type: "gift",
  itemId: "rose",
  quantity: 60,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**⚠️ 重要**: 子集合中的卡片文檔（createCards、characterUnlockCard 等）**僅用於向後兼容**，不再主動更新。

### 3. 舊系統（已廢棄）

**路徑**: `user_assets/{userId}`

**狀態**: 已廢棄，僅用於數據遷移參考

---

## API 架構

### 讀取 API

#### `/api/users/:userId/assets` (前台使用)

**實現**: `chat-app/backend/src/user/assets.service.js` → `getUserAssets()`

**讀取邏輯**:
```javascript
// 1. 卡片：只從主文檔讀取
const createCards = user.assets?.createCards || 0;

// 2. 禮物：從子集合讀取（未來實現）

// 3. 藥水：從 potions 系統讀取
const memoryBoost = await getPotionInventory(userId);
```

**返回格式**:
```javascript
{
  characterUnlockCards: 1,
  photoUnlockCards: 0,
  videoUnlockCards: 0,
  voiceUnlockCards: 0,
  createCards: 11,
  potions: {
    memoryBoost: 0,
    brainBoost: 0
  },
  walletBalance: 5
}
```

---

#### `/api/users/:userId` (後台使用)

**實現**: `chat-app/backend/src/user/user.service.js` → `getUserById()`

**讀取邏輯**: 直接返回主文檔的 `assets` 字段

---

### 寫入 API

#### 增加資產: `addUserAsset(userId, assetType, amount)`

**路徑**: `chat-app/backend/src/user/assets.service.js`

**支持的 assetType**:
- `createCards`
- `characterUnlockCards`
- `photoUnlockCards`
- `videoUnlockCards`
- `voiceUnlockCards`

**實現**:
```javascript
// 1. 讀取當前 assets
const currentAssets = user.assets || { ... };

// 2. 更新數量
newAssets[assetType] = currentAssets[assetType] + amount;

// 3. 寫回主文檔
await upsertUser({
  ...user,
  assets: newAssets,
  updatedAt: new Date().toISOString()
});
```

**使用範例**:
```javascript
// 增加 5 張創建卡
await addUserAsset('userId123', 'createCards', 5);
```

---

#### 消耗資產: `consumeUserAsset(userId, assetType, amount)`

**路徑**: `chat-app/backend/src/user/assets.service.js`

**實現**: 與 `addUserAsset` 類似，但會先檢查數量是否足夠

**使用範例**:
```javascript
// 消耗 1 張創建卡
await consumeUserAsset('userId123', 'createCards', 1);
```

---

#### 購買資產: `purchaseAssetPackage(userId, sku)`

**路徑**: `chat-app/backend/src/user/assetPurchase.service.js`

**流程**:
```
1. 獲取套餐配置（從 Firestore）
2. 檢查金幣餘額
3. 扣除金幣
4. 調用 addUserAsset() 增加資產  ← 統一使用主文檔
```

**使用範例**:
```javascript
// 購買 5 張創建卡套餐
await purchaseAssetPackage('userId123', 'create-card-5');
```

---

## 重構前後對比

### 之前的問題 ❌

**三個資料來源**:
1. 主文檔 `users/{userId}/assets.createCards: 11`
2. 子集合 `users/{userId}/assets/createCards: {quantity: 1}`
3. 獨立集合 `user_assets/{userId}/createCards: 3`

**問題**:
- 前台讀取子集合 → 顯示 1
- 後台讀取主文檔 → 顯示 11
- 數據不一致！

### 重構後 ✅

**唯一資料來源**:
- 主文檔 `users/{userId}/assets.createCards: 11`

**結果**:
- 前台讀取主文檔 → 顯示 11 ✅
- 後台讀取主文檔 → 顯示 11 ✅
- 數據一致！

---

## 遷移指南

### 同步現有用戶數據

如果發現主文檔和子集合的卡片數據不一致，使用同步腳本：

```bash
# 測試模式（不修改數據）
cd chat-app/backend
node scripts/syncUserAssets.js --dry-run

# 實際同步
node scripts/syncUserAssets.js

# 限制數量（測試用）
node scripts/syncUserAssets.js --limit=10
```

**同步邏輯**:
- 以**主文檔**為準（唯一真實來源）
- 將主文檔的卡片數量同步到子集合
- 確保前後台讀取一致

### 清理子集合卡片數據（可選）

由於卡片資產已統一到主文檔，子集合中的卡片文檔不再需要。可以使用清理腳本刪除這些冗余數據（保留禮物文檔）：

```bash
# 測試模式（不刪除數據）
cd chat-app/backend
node scripts/cleanupCardSubcollections.js --dry-run

# 實際清理（⚠️ 不可逆操作）
node scripts/cleanupCardSubcollections.js

# 限制數量
node scripts/cleanupCardSubcollections.js --limit=10
```

**⚠️ 重要**:
- 此操作會**永久刪除**子集合中的卡片文檔
- **不會刪除**禮物文檔（`gift_*`）
- 建議先運行 `--dry-run` 模式檢查
- 建議先備份數據

---

## 資產審計日誌

系統會自動記錄所有資產變更操作，用於審計和數據分析。

### 自動記錄

每次調用以下函數時，系統會自動記錄到 `asset_audit_logs` 集合：
- `addUserAsset()` - 記錄增加操作
- `consumeUserAsset()` - 記錄消耗操作
- `purchaseAssetPackage()` - 記錄購買操作（通過 addUserAsset）

**記錄內容**:
```javascript
{
  userId: "PS7LYFSstdgyr7b9sCOKFgt3QVB3",
  assetType: "createCards",
  action: "add",           // 'add' | 'consume' | 'set'
  amount: 5,
  previousQuantity: 6,
  newQuantity: 11,
  reason: "購買 創建角色卡 5 張",
  metadata: {
    sku: "create-card-5",
    packageName: "創建角色卡 5 張",
    price: 100
  },
  createdAt: Timestamp
}
```

### 查詢審計日誌

```bash
# 查看用戶的所有資產變更記錄
node scripts/viewAssetAuditLog.js <userId>

# 篩選特定資產類型
node scripts/viewAssetAuditLog.js <userId> --asset-type createCards

# 限制返回數量
node scripts/viewAssetAuditLog.js <userId> --limit 20

# 顯示統計數據
node scripts/viewAssetAuditLog.js <userId> --asset-type createCards --stats
```

**範例輸出**:
```
📋 找到 15 條記錄：

1. ➕ 增加 createCards
   數量: 5
   變更: 6 → 11
   原因: 購買 創建角色卡 5 張
   元數據: {
     "sku": "create-card-5",
     "packageName": "創建角色卡 5 張",
     "price": 100
   }
   時間: 2025-11-09 13:45:30

2. ➖ 消耗 createCards
   數量: 1
   變更: 11 → 10
   原因: 創建角色
   時間: 2025-11-09 14:20:15
```

### 代碼中使用

```javascript
// 增加資產時附帶原因和元數據
import { addUserAsset } from './user/assets.service.js';
await addUserAsset(
  userId,
  'createCards',
  5,
  '活動獎勵',                    // reason
  { eventId: 'spring-2025' }    // metadata
);

// 消耗資產時附帶原因
import { consumeUserAsset } from './user/assets.service.js';
await consumeUserAsset(
  userId,
  'createCards',
  1,
  '創建角色',                    // reason
  { characterId: 'char_123' }   // metadata
);

// 查詢用戶歷史
import { getUserAssetHistory } from './user/assetAuditLog.service.js';
const history = await getUserAssetHistory(userId, {
  assetType: 'createCards',
  limit: 50
});

// 獲取統計數據
import { getAssetChangeStats } from './user/assetAuditLog.service.js';
const stats = await getAssetChangeStats(userId, 'createCards');
console.log(`總增加: ${stats.totalAdded}, 總消耗: ${stats.totalConsumed}`);
```

---

## 代碼使用指南

### ✅ 正確做法

```javascript
// 讀取資產
import { getUserAssets } from './user/assets.service.js';
const assets = await getUserAssets(userId);
console.log(assets.createCards); // 11

// 增加資產
import { addUserAsset } from './user/assets.service.js';
await addUserAsset(userId, 'createCards', 5);

// 消耗資產
import { consumeUserAsset } from './user/assets.service.js';
await consumeUserAsset(userId, 'createCards', 1);

// 購買資產
import { purchaseAssetPackage } from './user/assetPurchase.service.js';
await purchaseAssetPackage(userId, 'create-card-5');
```

### ❌ 錯誤做法

```javascript
// ❌ 不要直接操作子集合的卡片
import { addAsset } from './user/userAssets.service.js';
await addAsset(userId, 'createCards', 5); // 會同時更新子集合和主文檔，造成冗余

// ❌ 不要直接修改 Firestore
await db.collection('users').doc(userId).update({
  'assets.createCards': 11
}); // 繞過業務邏輯，可能導致不一致
```

---

## 疑難排解

### 前後台數據不一致

**症狀**: 前台顯示的卡片數量與後台不同

**原因**: 子集合的卡片數據未同步

**解決方案**:
```bash
# 運行同步腳本
node scripts/syncUserAssets.js

# 或手動修復單個用戶
node scripts/checkUserAssets.js <userId>
# 查看輸出，確認主文檔和子集合的差異
# 然後手動更新
```

---

### 購買後資產未增加

**檢查清單**:
1. 檢查 `assetPurchase.service.js` 是否使用 `addUserAsset`
2. 檢查主文檔的 `assets` 字段是否有更新
3. 檢查是否有錯誤日誌

**調試**:
```javascript
// 查看購買日誌
logger.info('[資產購買] 購買成功: ...');

// 檢查用戶資產
const assets = await getUserAssets(userId);
console.log('當前資產:', assets);
```

---

## 未來計劃

### 短期 (已完成 ✅)
- [x] 統一卡片資產到主文檔
- [x] 修改購買 API 使用主文檔
- [x] 創建同步腳本
- [x] 添加資產變更日誌（audit log）
- [x] 創建清理子集合腳本
- [x] 移除所有舊代碼引用

### 中期
- [ ] 執行子集合卡片清理（可選）
- [ ] 移除 `user_assets` 舊集合
- [ ] 添加資產統計分析儀表板

### 長期
- [ ] 實現禮物系統（使用子集合）
- [ ] 優化查詢性能（使用緩存）
- [ ] 添加資產異常檢測

---

## 相關文件

### 文檔
- [PORTS.md](../../PORTS.md) - 端口配置
- [LIMIT_SYSTEM_EXPLAINED.md](../../LIMIT_SYSTEM_EXPLAINED.md) - 限制系統

### 服務代碼
- [assets.service.js](../backend/src/user/assets.service.js) - 資產管理服務
- [assetPurchase.service.js](../backend/src/user/assetPurchase.service.js) - 資產購買服務
- [assetAuditLog.service.js](../backend/src/user/assetAuditLog.service.js) - 資產審計日誌服務

### 腳本工具
- [syncUserAssets.js](../backend/scripts/syncUserAssets.js) - 同步主文檔和子集合
- [checkUserAssets.js](../backend/scripts/checkUserAssets.js) - 檢查用戶資產
- [cleanupCardSubcollections.js](../backend/scripts/cleanupCardSubcollections.js) - 清理子集合卡片文檔
- [viewAssetAuditLog.js](../backend/scripts/viewAssetAuditLog.js) - 查看審計日誌

---

## 變更記錄

### v2.1 (2025-11-09) - 審計日誌 & 清理工具
- ✅ 添加資產變更審計日誌系統
- ✅ 創建清理子集合卡片文檔的腳本
- ✅ 創建審計日誌查詢腳本
- ✅ 移除所有舊代碼引用（userAssets.service.js、user_assets 集合）
- ✅ 購買操作自動記錄審計日誌

### v2.0 (2025-11-09) - 統一架構
- ✅ 重構資產系統，統一卡片資產到主文檔
- ✅ 移除對子集合卡片的依賴
- ✅ 修改購買 API 使用主文檔
- ✅ 創建同步腳本
- ✅ 修復前後台數據不一致問題

### v1.0 (之前) - 舊系統
- ❌ 多重資料來源（主文檔、子集合、獨立集合）
- ❌ 數據不一致問題
