# 限制系統運作原理說明

## 📌 角色創建功能限制判斷流程

以 **FREE 用戶創建角色次數為 3 次** 為例，說明系統如何判斷用戶還可不可以繼續使用這個功能。

---

## 🔄 完整流程圖

```
用戶請求創建角色
    ↓
1. 檢查是否為遊客
    ↓ (非遊客)
2. 從 Firestore 獲取用戶限制數據
    ↓
3. 檢查是否需要重置（每月重置）
    ↓
4. 從 Firestore 獲取會員等級配置
    ↓
5. 計算總可用次數
    ↓
6. 判斷是否可以使用
    ↓
7. 記錄使用並更新 Firestore
```

---

## 📊 數據結構

### 1. 會員等級配置（存儲在 Firestore `membership_tiers` 集合）

```javascript
// 文檔 ID: "free"
{
  id: "free",
  name: "免費會員",
  features: {
    maxCreatedCharacters: 3,  // ← FREE 用戶每月可創建 3 個角色
    // ... 其他功能限制
  }
}

// 文檔 ID: "vip"
{
  id: "vip",
  name: "VIP",
  features: {
    maxCreatedCharacters: 3,  // VIP 也是 3 個（主要使用送的解鎖票）
    characterCreationCards: 5, // 開通時送 5 張創建卡
    // ... 其他功能
  }
}
```

### 2. 用戶使用限制數據（存儲在 Firestore `usage_limits` 集合）

```javascript
// 文檔 ID: 用戶的 userId
{
  userId: "user123",

  // 角色創建使用的字段名 (fieldName 由服務配置決定)
  character_creation: {
    count: 2,                    // 本月已創建 2 個角色
    lifetimeCount: 15,           // 終生創建過 15 個角色
    unlocked: 0,                 // 透過廣告解鎖的額外次數
    cards: 0,                    // 購買的創建卡數量
    permanentUnlock: false,      // 是否永久解鎖
    lastResetDate: "2025-11",    // 上次重置日期（月份格式）
    adsWatchedToday: 0,          // 今天看過的廣告數
    lastAdTime: null,            // 上次看廣告時間
    history: [...]               // 使用歷史記錄
  },

  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-11-04T12:34:56.000Z"
}
```

---

## 🎯 判斷邏輯詳解

### 步驟 1: 檢查遊客權限
```javascript
// 在 baseLimitService.js 的 canUse() 函數中
if (!allowGuest && isGuestUser(userId)) {
  return {
    canUse: false,
    reason: "guest_not_allowed",
    message: "遊客無法使用角色創建功能，請先登入"
  };
}
```
**角色創建不允許遊客使用**（`allowGuest: false`）

---

### 步驟 2: 初始化/獲取限制數據
```javascript
// 從 Firestore 讀取用戶的 usage_limits 文檔
const limitData = await initUserLimit(userId);
```

如果用戶是第一次創建角色，會自動初始化：
```javascript
{
  count: 0,
  lifetimeCount: 0,
  unlocked: 0,
  cards: 0,
  permanentUnlock: false,
  lastResetDate: "2025-11",
  adsWatchedToday: 0,
  lastAdTime: null,
  history: []
}
```

---

### 步驟 3: 檢查是否需要重置
```javascript
// 在 limitReset.js 中
const wasReset = checkAndReset(limitData, RESET_PERIOD.MONTHLY);
```

**重置規則（每月重置）**：
- 比較 `limitData.lastResetDate` 和當前月份
- 如果不同月份，重置 `count` 為 0，但保留 `lifetimeCount`
- 更新 `lastResetDate` 為當前月份

```javascript
// 例如：從 "2025-10" 進入 "2025-11"
if (limitData.lastResetDate !== "2025-11") {
  limitData.count = 0;  // 本月使用次數重置為 0
  limitData.unlocked = 0;  // 廣告解鎖次數也重置
  limitData.adsWatchedToday = 0;
  limitData.lastResetDate = "2025-11";
}
```

---

### 步驟 4: 獲取會員等級限制
```javascript
// 在 limitConfig.js 中
const configData = await getLimitConfig(
  userId,
  getMembershipLimit,  // 回調函數：取得會員等級的限制值
  testAccountLimitKey,
  serviceName
);
```

**流程**：
1. 從 `users` 集合獲取用戶的 `membershipTier`（例如 "free"）
2. 從 Firestore `membership_tiers` 集合讀取配置
3. 調用 `getMembershipLimit` 回調函數提取限制值：
   ```javascript
   // 在 characterCreationLimit.service.js 中定義
   getMembershipLimit: (membershipConfig, tier) => {
     return membershipConfig.features.maxCreatedCharacters; // 返回 3
   }
   ```

**結果**：
```javascript
configData = {
  tier: "free",
  limit: 3,              // FREE 用戶的基礎限制
  standardLimit: 3,
  isTestAccount: false,
  membershipConfig: {...}
}
```

---

### 步驟 5: 計算總可用次數
```javascript
// 在 limitTracking.js 的 checkCanUse() 中
const totalAllowed = limit + limitData.unlocked + limitData.cards;
const used = limitData.count;
const remaining = totalAllowed - used;
```

**計算公式**：
```
總可用次數 = 基礎限制 + 廣告解鎖次數 + 購買的卡片數量
剩餘次數 = 總可用次數 - 已使用次數
```

**範例**：
```javascript
// 假設用戶本月已創建 2 個角色
limit = 3              // 基礎限制（來自會員等級配置）
limitData.unlocked = 0 // 沒有看廣告解鎖
limitData.cards = 0    // 沒有購買卡片
limitData.count = 2    // 本月已創建 2 個

totalAllowed = 3 + 0 + 0 = 3
used = 2
remaining = 3 - 2 = 1  // 還可以創建 1 個角色
```

---

### 步驟 6: 判斷是否可以使用
```javascript
// 在 limitTracking.js 中
if (limit === -1) {
  // 無限制（VIP/VVIP 某些功能可能是 -1）
  return { allowed: true, reason: "unlimited" };
}

if (limitData.permanentUnlock) {
  // 永久解鎖
  return { allowed: true, reason: "permanent_unlock" };
}

if (remaining > 0) {
  // 還有剩餘次數
  return {
    allowed: true,
    remaining: 1,
    used: 2,
    total: 3
  };
}

// 超過限制
return {
  allowed: false,
  reason: "limit_exceeded",
  used: 2,
  limit: 3,
  remaining: 0
};
```

---

### 步驟 7: 記錄使用
```javascript
// 當用戶成功創建角色後
await recordCreation(userId, characterId);
```

**更新 Firestore**：
```javascript
limitData.count += 1;           // 2 → 3
limitData.lifetimeCount += 1;   // 15 → 16
limitData.history.push({
  timestamp: "2025-11-04T12:34:56.000Z",
  characterId: "char-123"
});

// 寫入 Firestore
await updateLimitData(userId, null, limitData);
```

---

## 🔍 實際場景示例

### 場景 1: FREE 用戶首次使用
```
1. 用戶登入（membershipTier: "free"）
2. 點擊「創建角色」按鈕
3. 系統檢查：
   - 從 Firestore 讀取 usage_limits → 沒有記錄，自動初始化
   - count = 0, limit = 3
   - remaining = 3 - 0 = 3
4. 結果：✅ 可以使用（還有 3 次）
5. 創建成功後，count = 1
```

### 場景 2: FREE 用戶本月第 3 次使用
```
1. 用戶狀態：count = 2, limit = 3
2. 系統檢查：
   - remaining = 3 - 2 = 1
3. 結果：✅ 可以使用（最後 1 次）
4. 創建成功後，count = 3
```

### 場景 3: FREE 用戶本月用完 3 次
```
1. 用戶狀態：count = 3, limit = 3
2. 系統檢查：
   - remaining = 3 - 3 = 0
3. 結果：❌ 不可使用
4. 提示訊息：「本月創建次數已用完，請升級會員或等待下月重置」
```

### 場景 4: 跨月份重置
```
1. 用戶狀態（2025-10）：count = 3, lastResetDate = "2025-10"
2. 進入 2025-11 月
3. 系統檢查：
   - lastResetDate ("2025-10") ≠ 當前月份 ("2025-11")
   - 觸發重置：count = 0, lastResetDate = "2025-11"
   - remaining = 3 - 0 = 3
4. 結果：✅ 可以使用（重置後又有 3 次）
```

### 場景 5: VIP 用戶（有創建卡）
```
1. 用戶狀態：
   - membershipTier = "vip"
   - count = 3 (本月已用完基礎額度)
   - cards = 5 (開通時贈送的 5 張創建卡)
   - limit = 3
2. 系統檢查：
   - totalAllowed = 3 + 0 + 5 = 8
   - remaining = 8 - 3 = 5
3. 結果：✅ 可以使用（還有 5 次，來自創建卡）
```

---

## 📝 總結

**FREE 用戶創建角色的判斷邏輯**：

1. **基礎限制**: 3 次/月（來自 `membership_tiers.free.features.maxCreatedCharacters`）
2. **數據追蹤**: 存儲在 `usage_limits.{userId}.character_creation`
3. **重置機制**: 每月自動重置 `count` 為 0
4. **擴展機制**: 可透過廣告解鎖、購買卡片增加次數
5. **判斷公式**: `剩餘次數 = (基礎限制 + 解鎖 + 卡片) - 已使用`

---

## 🛠️ 如何為角色添加新設定

如果您想為角色添加新的限制功能，可以參考這個模式：

### 1. 在會員配置中添加新功能
```javascript
// 在 membership_tiers 集合中
features: {
  maxCreatedCharacters: 3,
  maxCharacterPhotos: 10,  // ← 新功能：每個角色最多生成 10 張照片
  // ...
}
```

### 2. 創建新的限制服務
```javascript
// 新建 characterPhotoLimit.service.js
const characterPhotoLimitService = createLimitService({
  serviceName: "角色照片限制",
  limitType: "角色照片生成",
  getMembershipLimit: (membershipConfig, tier) => {
    return membershipConfig.features.maxCharacterPhotos;
  },
  testAccountLimitKey: "CHARACTER_PHOTOS",
  resetPeriod: RESET_PERIOD.MONTHLY,
  perCharacter: true,  // ← 按角色追蹤
  allowGuest: false,
  fieldName: "character_photos"  // ← Firestore 字段名
});
```

### 3. Firestore 數據結構
```javascript
// usage_limits/{userId}
{
  character_photos: {
    "char-001": { count: 5, limit: 10, ... },
    "char-002": { count: 2, limit: 10, ... }
  }
}
```

這樣就能實現「每個角色單獨計算照片生成次數」的功能！

---

## 📚 相關文件

- 限制服務基礎模組: `chat-app/backend/src/services/baseLimitService.js`
- 角色創建限制: `chat-app/backend/src/characterCreation/characterCreationLimit.service.js`
- 限制配置管理: `chat-app/backend/src/services/limitService/limitConfig.js`
- 限制追蹤邏輯: `chat-app/backend/src/services/limitService/limitTracking.js`
- 會員配置: `chat-app/backend/src/membership/membership.config.js`
- Firestore 數據結構: `chat-app/docs/firestore-collections.md`
