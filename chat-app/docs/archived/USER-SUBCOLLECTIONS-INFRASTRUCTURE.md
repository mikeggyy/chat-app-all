# Users 子集合基礎設施

**狀態**: 基礎設施已就緒，尚未全面啟用
**建議**: 漸進式遷移，當遇到性能瓶頸時啟用

---

## 📁 已創建的文件

### 1. [userConversations.service.js](../backend/src/user/userConversations.service.js)
**用途**: 管理 `users/{userId}/conversations` 子集合

**主要功能**:
- `getUserConversations(userId)` - 獲取用戶的所有對話列表
- `getUserConversation(userId, conversationId)` - 獲取單個對話
- `addOrUpdateConversation(userId, conversationId, metadata)` - 添加/更新對話
- `removeConversation(userId, conversationId)` - 移除對話
- `batchAddConversations(userId, conversations)` - 批量添加（用於數據遷移）
- `clearAllConversations(userId)` - 清除所有對話
- `getConversationsCount(userId)` - 獲取對話數量

**數據結構**:
```javascript
// users/{userId}/conversations/{conversationId}
{
  conversationId: string,
  characterId: string,
  character: Object,
  lastMessage: string,
  lastMessageAt: string,
  lastSpeaker: string,
  partnerLastMessage: string,
  partnerLastRepliedAt: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

---

### 2. [userAssets.service.js](../backend/src/user/userAssets.service.js)
**用途**: 管理 `users/{userId}/assets` 子集合

**主要功能**:
- `getUserAssets(userId, type)` - 獲取用戶的所有資產
- `getUserAsset(userId, assetType, itemId)` - 獲取單個資產
- `setAssetQuantity(userId, assetType, quantity, itemId)` - 設置資產數量
- `addAsset(userId, assetType, amount, itemId)` - 增加資產（原子操作）
- `deductAsset(userId, assetType, amount, itemId)` - 減少資產（原子操作）
- `getUnlockCardsBalance(userId)` - 獲取所有解鎖卡餘額
- `getGiftsBalance(userId)` - 獲取所有禮物餘額
- `batchSetAssets(userId, assets)` - 批量設置（用於數據遷移）

**資產類型** (`ASSET_TYPES`):
```javascript
{
  CHARACTER_UNLOCK_CARD: "characterUnlockCard",
  PHOTO_UNLOCK_CARD: "photoUnlockCard",
  VIDEO_UNLOCK_CARD: "videoUnlockCard",
  VOICE_UNLOCK_CARD: "voiceUnlockCard",
  CREATE_CARD: "createCard",
  GIFT: "gift",
}
```

**數據結構**:
```javascript
// users/{userId}/assets/{assetType} (解鎖卡)
{
  type: "photoUnlockCard",
  quantity: 10,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}

// users/{userId}/assets/gift_{itemId} (禮物)
{
  type: "gift",
  itemId: "rose",
  quantity: 5,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

---

### 3. [assets.service.js](../backend/src/user/assets.service.js) - 已部分更新
**用途**: 統一資產管理接口（向後兼容）

**已更新**:
- ✅ `getUserAssets(userId)` - 優先從子集合讀取，自動回退到主文檔

**未更新**:
- ⏳ `addUserAsset()` - 仍使用主文檔
- ⏳ `consumeUserAsset()` - 仍使用主文檔
- ⏳ `setUserAssets()` - 仍使用主文檔

**向後兼容策略**:
```javascript
// getUserAssets 讀取邏輯：
// 1. 優先從子集合讀取
// 2. 如果子集合沒有資料，從主文檔讀取
// 3. 確保不丟失任何數據
```

---

## 🎯 使用場景

### 何時應該使用子集合？

**應該使用的情況**:
1. 📊 用戶的對話列表超過 50 個
2. 📊 需要獨立查詢對話列表（不需要加載整個用戶文檔）
3. 📊 遇到 Firestore 1MB 文檔大小限制警告

**暫不需要的情況**:
- ✅ 對話列表較短（< 20 個）
- ✅ 開發階段
- ✅ 用戶量較少

---

## 📝 如何啟用子集合？

### 方式 1：漸進式遷移（推薦）

只針對特定功能啟用子集合，不影響其他功能。

**範例：啟用對話列表子集合**

```javascript
// 在需要的地方引入
import {
  getUserConversations,
  addOrUpdateConversation
} from '../user/userConversations.service.js';

// 讀取對話列表
const conversations = await getUserConversations(userId);

// 添加新對話
await addOrUpdateConversation(userId, conversationId, {
  characterId: 'match-001',
  character: { name: '艾米麗' },
  lastMessage: '你好！',
  lastMessageAt: new Date().toISOString(),
});
```

---

### 方式 2：完整遷移現有數據

使用批量操作將主文檔的數據遷移到子集合。

**範例：遷移對話列表**

```javascript
import { getUserById } from '../user/user.service.js';
import { batchAddConversations } from '../user/userConversations.service.js';
import { batchSetAssets } from '../user/userAssets.service.js';

// 遷移單個用戶的對話列表
async function migrateUserConversations(userId) {
  const user = await getUserById(userId);

  if (user.conversations && user.conversations.length > 0) {
    await batchAddConversations(userId, user.conversations);
    console.log(`✅ 已遷移 ${user.conversations.length} 個對話`);
  }
}

// 遷移單個用戶的資產
async function migrateUserAssets(userId) {
  const user = await getUserById(userId);

  if (user.assets) {
    await batchSetAssets(userId, user.assets);
    console.log(`✅ 已遷移資產`);
  }
}

// 批量遷移所有用戶
async function migrateAllUsers() {
  const db = getFirestoreDb();
  const snapshot = await db.collection('users').get();

  let success = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const userId = doc.id;
    try {
      await migrateUserConversations(userId);
      await migrateUserAssets(userId);
      success++;
    } catch (error) {
      console.error(`❌ 遷移失敗: ${userId}`, error.message);
      failed++;
    }
  }

  console.log(`\n遷移完成: 成功 ${success}, 失敗 ${failed}`);
}
```

---

## ✨ 優勢與權衡

### 使用子集合的優勢

✅ **性能提升**:
- 獨立查詢對話列表，不需要加載整個用戶文檔
- 避免 Firestore 1MB 文檔大小限制
- 減少併發寫入衝突

✅ **可擴展性**:
- 支持更多對話和資產
- 可以為子集合設置專門的索引
- 更靈活的查詢方式

✅ **數據組織**:
- 更清晰的數據結構
- 更容易實現分頁
- 更好的權限控制

### 權衡

⚠️ **複雜度**:
- 需要多次 Firestore 查詢
- 需要維護兩套邏輯（向後兼容）

⚠️ **成本**:
- 更多的讀取操作（子集合 + 主文檔）
- 需要時間進行數據遷移

---

## 🔄 向後兼容策略

目前的實現已經支持向後兼容：

```javascript
// getUserAssets 會自動：
// 1. 先從子集合讀取
// 2. 如果子集合沒有，從主文檔讀取
// 3. 返回合併後的結果

const assets = await getUserAssets(userId);
// ✅ 無論數據在哪裡，都能正確讀取
```

這意味著：
- ✅ 可以逐步遷移用戶數據
- ✅ 新用戶可以直接使用子集合
- ✅ 舊用戶仍然正常工作
- ✅ 不會丟失任何數據

---

## 🚀 未來計劃

當您決定全面啟用子集合時，還需要：

1. **更新 user.service.js**
   - 移除 `addConversationForUser`
   - 移除 `removeConversationForUser`
   - 使用 `userConversations.service` 替代

2. **更新 assets.service.js**
   - `addUserAsset` → 使用 `userAssets.service`
   - `consumeUserAsset` → 使用 `userAssets.service`
   - `setUserAssets` → 使用 `userAssets.service`

3. **更新依賴服務**
   - `conversation.service.js` - 對話創建時自動更新子集合
   - `gift.service.js` - 禮物操作使用子集合
   - `unlockTickets.service.js` - 解鎖卡使用子集合

4. **創建遷移腳本**
   - 批量遷移現有用戶數據
   - 驗證數據完整性
   - 清理主文檔中的冗餘數據

5. **更新文檔**
   - 更新 `firestore-collections.md`
   - 更新 API 文檔

---

## 📊 性能對比

### 目前的架構（主文檔）

```javascript
// 讀取對話列表
const user = await getUserById(userId);  // 1 次讀取，加載整個用戶文檔
const conversations = user.conversations; // 從內存中提取

// 優點：單次讀取
// 缺點：加載不需要的數據
```

### 使用子集合後

```javascript
// 讀取對話列表
const conversations = await getUserConversations(userId); // 1 次讀取，只加載對話列表

// 優點：只加載需要的數據
// 缺點：需要額外的查詢
```

**建議**：
- 對話列表 > 20 個時，子集合更快
- 對話列表 < 10 個時，主文檔更簡單

---

## 🎯 總結

### 目前狀態

- ✅ 子集合基礎設施已就緒
- ✅ 向後兼容已實現（`getUserAssets`）
- ⏳ 完整遷移尚未完成
- ⏳ 數據仍在主文檔中

### 下一步（當需要時）

1. 遇到性能問題時
2. 運行遷移腳本
3. 更新服務使用子集合
4. 逐步清理主文檔

### 快速啟用指南

```bash
# 1. 遷移特定用戶的數據
node -e "
import('./backend/src/user/userConversations.service.js').then(async (m) => {
  const userId = 'your-user-id';
  const user = await getUserById(userId);
  await m.batchAddConversations(userId, user.conversations);
  console.log('遷移完成');
});
"

# 2. 在代碼中使用子集合
import { getUserConversations } from './user/userConversations.service.js';
const conversations = await getUserConversations(userId);
```

---

## 📞 支持

遇到問題時：
1. 查看 [DATABASE-OPTIMIZATION-SUMMARY.md](./DATABASE-OPTIMIZATION-SUMMARY.md)
2. 查看 [firestore-collections.md](./firestore-collections.md)
3. 檢查 Firestore Emulator UI: http://localhost:4001/firestore

---

**記住**: 這些基礎設施隨時可用，但不強制啟用。當遇到性能瓶頸時再考慮完整遷移！
