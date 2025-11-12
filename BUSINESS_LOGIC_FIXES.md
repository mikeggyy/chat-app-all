# 商業邏輯安全修復記錄

本文檔記錄了在商業邏輯安全審計後進行的所有修復。

## 修復日期
2025-01-XX

## 修復分支
`fix/business-logic-security-improvements`

---

## 🔴 高危問題修復

### 1. ✅ 冪等性系統改用 Firestore 存儲

**問題**: 原本使用內存 Map 存儲冪等性記錄，在多服務器環境下無法防止重複扣款

**修復**:
- 文件: `chat-app/backend/src/utils/idempotency.js`
- 改用 Firestore 存儲冪等性記錄
- 使用 Firestore Transaction 確保原子性
- 保留本地鎖處理單服務器並發
- 添加兩層緩存: L1 本地緩存 (5分鐘) + L2 Firestore (24小時)
- 自動清理過期記錄（每小時）

**影響範圍**: 所有使用 `handleIdempotentRequest` 的操作（購買、扣款、送禮等）

**測試方法**:
```bash
# 使用 Firebase Emulator 測試
cd chat-app
npm run dev:with-emulator

# 模擬重複請求
curl -X POST http://localhost:4000/api/coins/purchase \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-123" \
  -d '{"packageId": "coins_100"}'

# 再次發送相同請求，應返回緩存結果
```

**Commit**: `7e69f82` - fix(idempotency): 將冪等性系統改用 Firestore 存儲

---

### 2. ✅ 會員升級獎勵發放改為原子性操作

**問題**: 會員升級、發放解鎖票、金幣等操作分開執行，可能部分失敗導致用戶損失

**修復**:
- 文件: `chat-app/backend/src/membership/membership.service.js`
- 將所有操作合併到一個 Firestore Transaction 中
- 在 Transaction 內直接更新用戶文檔（會員狀態、解鎖票、資產、金幣）
- 在 Transaction 內創建交易記錄和會員變更歷史
- 確保所有操作原子性：要麼全部成功，要麼全部失敗

**影響範圍**: `upgradeMembership` 函數

**測試方法**:
```javascript
// 測試免費 → VIP 升級
const result = await upgradeMembership('user-123', 'vip');

// 驗證:
// 1. 用戶會員等級已更新
// 2. 解鎖票已到賬
// 3. 金幣已到賬
// 4. 交易記錄已創建
// 5. 會員變更歷史已記錄
```

**Commit**: `1a7c8db` - fix(membership): 會員升級獎勵發放改為原子性操作

---

### 3. ✅ 藥水購買會員檢查移到 Transaction 內

**問題**: 會員等級檢查在 Transaction 外執行，可能在檢查和購買之間會員等級改變

**修復**: 已完成
- 文件: `chat-app/backend/src/payment/potion.service.js`
- 將 `purchaseMemoryBoost` 和 `purchaseBrainBoost` 的會員等級檢查移到 Transaction 內部
- 在 Transaction 內使用最新的用戶資料進行檢查，防止 TOCTOU（Time-of-Check to Time-of-Use）問題
- 確保會員等級驗證的原子性

**實現**:
```javascript
// payment/potion.service.js
export const purchaseMemoryBoost = async (userId, options = {}) => {
  const potion = POTION_CONFIG.MEMORY_BOOST;
  const quantity = options.quantity || 1;
  const unitPrice = options.unitPrice || potion.price;

  const userRef = db.collection("users").doc(userId);
  const userLimitRef = getUserLimitRef(userId);

  await db.runTransaction(async (transaction) => {
    // 1. 在事務內讀取用戶資料
    const userDoc = await transaction.get(userRef);
    const user = userDoc.data();

    // 2. ✅ 在事務內檢查會員等級（使用最新數據，防止並發修改）
    const userTier = user.membershipTier || "free";
    if (potion.restrictedTiers && potion.restrictedTiers.includes(userTier)) {
      throw new Error(potion.restrictedMessage || "您的會員等級不能購買此道具");
    }

    // 3. 檢查金幣餘額
    const currentBalance = user.walletBalance || 0;
    if (currentBalance < unitPrice) {
      throw new Error(`金幣不足，當前餘額：${currentBalance}，需要：${unitPrice}`);
    }

    // 4. 讀取當前庫存
    const limitDoc = await transaction.get(userLimitRef);
    const limitData = limitDoc.exists ? limitDoc.data() : {};
    const currentInventory = limitData.potionInventory?.memoryBoost || 0;

    // 5. 計算新值並更新
    const newBalance = currentBalance - unitPrice;
    const newInventoryCount = currentInventory + quantity;

    transaction.update(userRef, {
      walletBalance: newBalance,
      // ... 其他更新
    });

    transaction.set(userLimitRef, {
      potionInventory: {
        memoryBoost: FieldValue.increment(quantity),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  // ... 返回結果
};

// purchaseBrainBoost 同樣實現
```

**影響範圍**: 防止並發購買時的會員等級檢查繞過，確保數據一致性

---

### 4. 🔄 前端金幣餘額並發更新保護

**問題**: 多個購買操作並發時，餘額更新可能被錯誤覆蓋

**狀態**: 待修復

**修復方案**:

**方案 1: 使用增量更新**
```javascript
// chat-app/frontend/src/composables/useCoins.js
// 更新本地餘額 - 使用增量而非絕對值
if (data.coinsChanged !== undefined) {
  coinsState.value.balance += data.coinsChanged; // 使用 += 而非 =
} else if (data.newBalance !== undefined) {
  coinsState.value.balance = data.newBalance;
}
```

**方案 2: 請求隊列**
```javascript
// utils/requestQueue.js
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  async enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const { fn, resolve, reject } = this.queue.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.processing = false;
      this.process();
    }
  }
}

export const purchaseQueue = new RequestQueue();
```

---

### 5. 🔄 測試 Token 緩存時間縮短

**問題**: 測試 token 緩存 24 小時，安全風險高

**狀態**: 待修復

**修復**:
```javascript
// chat-app/frontend/src/utils/api.js
const isTestEnv = import.meta.env.DEV;
const isTestToken = token === 'test-token';

if (isTestToken && !isTestEnv) {
  console.error('❌ 測試 token 不應在生產環境使用');
  throw new Error('Invalid token in production');
}

tokenExpiry = isTestToken
  ? now + 5 * 60 * 1000  // 改為 5 分鐘
  : now + 50 * 60 * 1000; // Firebase token 緩存 50 分鐘
```

---

## 🟡 中危問題修復

### 6. ✅ 訂單狀態機驗證

**問題**: 訂單狀態可能非法回退（如 `completed` → `pending`）

**修復**: 已完成
- 文件: `chat-app/backend/src/payment/order.service.js`
- 定義 `ORDER_STATE_TRANSITIONS` 狀態機規則
- 在 Transaction 內檢查狀態轉換合法性
- 記錄狀態轉換歷史到 metadata.statusHistory
- 確保原子性，防止並發衝突

**實現**:
```javascript
// payment/order.service.js
export const ORDER_STATE_TRANSITIONS = {
  pending: ['processing', 'cancelled', 'failed'],     // 待支付 → 處理中/已取消/失敗
  processing: ['completed', 'failed', 'cancelled'],   // 處理中 → 已完成/失敗/已取消
  completed: ['refunded'],                            // 已完成 → 已退款（不可逆）
  failed: ['pending'],                                // 失敗 → 待支付（允許重試）
  refunded: [],                                       // 已退款 → 終態
  cancelled: []                                       // 已取消 → 終態
};

export const updateOrderStatus = async (orderId, status, metadata = {}) => {
  const db = getFirestoreDb();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);

  return await db.runTransaction(async (transaction) => {
    const orderDoc = await transaction.get(orderRef);
    const currentOrder = orderDoc.data();
    const currentStatus = currentOrder.status;

    // 驗證狀態轉換是否合法
    const allowedTransitions = ORDER_STATE_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(status)) {
      throw new Error(
        `無效的訂單狀態轉換：${currentStatus} → ${status}。` +
        `允許的轉換：${allowedTransitions?.join(', ') || '無'}`
      );
    }

    // 冪等性檢查
    if (currentStatus === status) {
      return currentOrder;
    }

    // 構建更新數據（包含狀態轉換歷史）
    const updateData = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
      metadata: {
        ...(currentOrder.metadata || {}),
        ...metadata,
        statusHistory: [
          ...((currentOrder.metadata?.statusHistory) || []),
          {
            from: currentStatus,
            to: status,
            timestamp: new Date().toISOString()
          }
        ]
      }
    };

    transaction.update(orderRef, updateData);
    return { ...currentOrder, ...updateData };
  });
};
```

---

### 7. ✅ 藥水使用 Transaction 保護

**問題**: 藥水使用時庫存檢查和扣除不在同一Transaction，可能導致庫存變負

**修復**: 已完成（Commit: `e3fafcb`）
- 文件: `chat-app/backend/src/payment/potion.service.js`
- 將 `useMemoryBoost` 和 `useBrainBoost` 改用 Transaction
- 在 Transaction 內完成：庫存檢查 → 效果檢查 → 庫存扣除 → 效果激活
- 確保原子性，防止並發問題

**修復計畫**（已實現）:
```javascript
// payment/potion.service.js - useMemoryBoost / useBrainBoost
export const useMemoryBoost = async (userId, characterId) => {
  const db = getFirestoreDb();
  const userLimitRef = getUserLimitRef(userId);

  return await db.runTransaction(async (transaction) => {
    // 1. 在事務內讀取
    const doc = await transaction.get(userLimitRef);
    const data = doc.data() || {};
    const inventory = data.potionInventory || { memoryBoost: 0 };

    // 2. 在事務內檢查庫存
    if (inventory.memoryBoost < 1) {
      throw new Error("記憶增強藥水庫存不足");
    }

    // 3. 在事務內扣除並激活
    const effectId = `memory_boost_${characterId}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    transaction.update(userLimitRef, {
      'potionInventory.memoryBoost': FieldValue.increment(-1),
      [`activePotionEffects.${effectId}`]: {
        characterId,
        potionType: 'memory_boost',
        activatedAt: FieldValue.serverTimestamp(),
        expiresAt
      }
    });

    return { success: true, effectId, expiresAt };
  });
};
```

---

### 8. ✅ 資產購買原子性

**問題**: 扣款和增加資產是兩個獨立操作，可能扣款成功但增加資產失敗

**修復**: 已完成
- 文件: `chat-app/backend/src/user/assetPurchase.service.js`
- 重構 `purchaseAssetPackage` 和 `purchaseAssetBundle` 函數
- 使用單個 Transaction 完成：餘額檢查 → 扣款 → 增加資產 → 創建交易記錄
- Transaction 成功後異步記錄審計日誌（失敗不影響主流程）
- 確保原子性，防止部分失敗

**實現**:
```javascript
// user/assetPurchase.service.js
export const purchaseAssetPackage = async (userId, sku) => {
  const packageConfig = await getPackageBySku(sku);
  const db = getFirestoreDb();
  const userRef = db.collection('users').doc(userId);

  const result = await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料
    const userDoc = await transaction.get(userRef);
    const user = userDoc.data();
    const currentBalance = getWalletBalance(user);

    // 2. 檢查餘額
    if (currentBalance < price) {
      throw new Error(`金幣不足，需要 ${price} 金幣，當前餘額 ${currentBalance} 金幣`);
    }

    // 3. 計算新餘額和新資產數量
    const currentAssets = user.assets || {};
    const previousAssetQuantity = currentAssets[assetType] || 0;
    const newAssetQuantity = previousAssetQuantity + quantity;
    const newBalance = currentBalance - price;

    // 4. 在同一 Transaction 內：扣款 + 增加資產
    transaction.update(userRef, {
      ...createWalletUpdate(newBalance),
      [`assets.${assetType}`]: newAssetQuantity,
      updatedAt: FieldValue.serverTimestamp()
    });

    // 5. 在同一 Transaction 內創建交易記錄
    createTransactionInTx(transaction, {
      userId, type: TRANSACTION_TYPES.SPEND, amount: -price,
      description: `購買 ${name}`, balanceBefore: currentBalance,
      balanceAfter: newBalance
    });

    return { success: true, newBalance, assetQuantity: newAssetQuantity };
  });

  // Transaction 成功後，異步記錄審計日誌
  try {
    await logAssetChange({ userId, assetType, action: "add", amount: quantity });
  } catch (error) {
    logger.warn(`審計日誌記錄失敗（不影響購買）: ${error.message}`);
  }

  return result;
};
```

---

### 9. ✅ 前端消息發送重試機制

**問題**: 消息發送失敗後沒有重試，永遠停留在"發送中"狀態

**修復**: 已完成
- 文件: `chat-app/frontend/src/composables/chat/useChatMessages.js`
- 添加自動重試機制（最多 3 次）
- 重試延遲遞增：2秒 → 5秒 → 10秒
- 消息狀態管理：pending → retrying → failed
- 添加 `retryFailedMessage` 方法支援手動重試
- 記錄重試次數和錯誤信息

**實現**:
```javascript
// chat-app/frontend/src/composables/chat/useChatMessages.js
const syncMessageAndGetReply = async (userId, charId, text, userMessageId, retryCount = 0) => {
  const MAX_RETRIES = 3; // 最多重試 3 次
  const RETRY_DELAYS = [2000, 5000, 10000]; // 重試延遲：2秒、5秒、10秒

  try {
    // ... 發送消息邏輯
    const result = await appendConversationMessages(userId, charId, [{ role: 'user', text }], { token });

    // 成功：更新狀態為 sent
    messages.value[userMsgIndex] = {
      ...messages.value[userMsgIndex],
      state: 'sent',
      retryCount: undefined,
    };

  } catch (error) {
    console.error(`消息發送失敗 (嘗試 ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);

    const shouldRetry = retryCount < MAX_RETRIES;

    // 更新消息狀態
    messages.value[userMsgIndex] = {
      ...messages.value[userMsgIndex],
      state: shouldRetry ? 'retrying' : 'failed',
      retryCount: retryCount + 1,
      error: error instanceof Error ? error.message : '發送失敗',
    };

    // 自動重試
    if (shouldRetry) {
      const delay = RETRY_DELAYS[retryCount] || 10000;
      setTimeout(() => {
        syncMessageAndGetReply(userId, charId, text, userMessageId, retryCount + 1);
      }, delay);
    }
  }
};

// 手動重試方法
const retryFailedMessage = async (messageId) => {
  const failedMsg = messages.value.find(m => m.id === messageId);
  if (failedMsg && failedMsg.state === 'failed') {
    // 重置狀態並重新發送
    failedMsg.state = 'pending';
    failedMsg.retryCount = 0;
    failedMsg.error = undefined;

    await syncMessageAndGetReply(userId, charId, failedMsg.text, messageId, 0);
  }
};
```

---

### 10. ✅ 前端用戶資料緩存 TTL

**問題**: 用戶資料緩存沒有過期時間，一旦緩存就永久保存，可能導致顯示過時資料

**修復**: 已完成
- 文件: `chat-app/frontend/src/composables/useUserProfile.js`
- 添加 2 分鐘的 TTL（Time-To-Live）
- 修改緩存存儲格式為 `{ data: userData, timestamp: Date.now() }`
- 在 `loadUserProfile` 中檢查緩存年齡，超過 2 分鐘自動刪除並重新獲取
- 添加調試日誌方便排查

**實現**:
```javascript
// frontend/src/composables/useUserProfile.js
const profileCache = new Map(); // 存儲格式: { data, timestamp }
const CACHE_TTL = 2 * 60 * 1000; // 2 分鐘

const loadUserProfile = async (id, options = {}) => {
  if (!force && profileCache.has(id)) {
    const cacheEntry = profileCache.get(id);
    const now = Date.now();
    const age = now - cacheEntry.timestamp;

    // 檢查緩存是否過期
    if (age < CACHE_TTL) {
      const cached = cacheEntry.data;
      baseState.user = cached;
      console.debug(`[useUserProfile] 使用緩存資料: ${id}, 年齡: ${Math.round(age / 1000)}秒`);
      return cached;
    } else {
      // 緩存已過期，刪除並重新獲取
      profileCache.delete(id);
      console.debug(`[useUserProfile] 緩存已過期並刪除: ${id}`);
    }
  }

  // 從 API 獲取新資料
  const data = await apiJson(`/api/users/${id}`);
  return cacheUserProfile(data);
};

const cacheUserProfile = (payload) => {
  const profile = normalizeUser(payload);
  if (profile.id) {
    profileCache.set(profile.id, {
      data: profile,
      timestamp: Date.now() // 記錄緩存時間
    });
  }
  return profile;
};
```

---

### 11. ✅ 購買確認防抖

**問題**: 購買確認對話框沒有防抖保護，用戶快速點擊可能觸發多次購買

**修復**: 已完成
- 文件: `chat-app/frontend/src/composables/usePurchaseConfirm.js`
- 添加 `isProcessing` 狀態追蹤處理中狀態
- 在 `handleConfirm` 中檢查是否正在處理，防止重複點擊
- 添加 1 秒冷卻時間，延遲重置處理狀態
- 取消按鈕也檢查處理狀態，處理中無法取消

**實現**:
```javascript
// frontend/src/composables/usePurchaseConfirm.js
const dialogState = ref({
  // ... 其他狀態
  isProcessing: false, // 防止重複點擊
});

const handleConfirm = () => {
  // 防抖檢查
  if (dialogState.value.isProcessing) {
    console.warn('[usePurchaseConfirm] 正在處理中，忽略重複點擊');
    return;
  }

  // 設置為處理中
  dialogState.value.isProcessing = true;

  // 執行確認邏輯
  if (dialogState.value.resolve) {
    dialogState.value.resolve(true);
  }
  dialogState.value.isOpen = false;

  // 1 秒後重置狀態
  setTimeout(() => {
    dialogState.value.isProcessing = false;
  }, 1000);
};
```

---

### 12-13. 🔄 其他中危問題

**12. localStorage 錯誤處理**: 更激進的清理策略

---

## 📈 性能優化

### 14. 🔄 添加 Firestore 複合索引

**文件**: `chat-app/firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "gift_transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "characterId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "idempotency_keys",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "expiresAt", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**部署**:
```bash
firebase deploy --only firestore:indexes
```

---

### 15. 🔄 添加速率限制中間件

**文件**: `chat-app/backend/src/middleware/rateLimiter.js`

```javascript
import rateLimit from 'express-rate-limit';

// 財務操作速率限制
export const financialRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分鐘
  max: 10, // 最多 10 次
  message: '操作過於頻繁，請稍後再試',
  keyGenerator: (req) => req.firebaseUser?.uid || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

// 送禮速率限制
export const giftRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: '送禮過於頻繁，請稍後再試',
  keyGenerator: (req) => req.firebaseUser?.uid || req.ip,
});

// 對話速率限制
export const conversationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: '發送消息過於頻繁，請稍後再試',
  keyGenerator: (req) => req.firebaseUser?.uid || req.ip,
});
```

**使用方式**:
```javascript
// gift/gift.routes.js
import { giftRateLimiter } from '../middleware/rateLimiter.js';

router.post('/send',
  requireFirebaseAuth,
  giftRateLimiter,  // ✅ 添加速率限制
  asyncHandler(sendGiftHandler)
);
```

---

## 🔒 安全加固

### 16. ✅ 加強輸入驗證

**問題**: 缺少統一的輸入驗證 schemas，部分路由使用手動驗證，容易遺漏或不一致

**修復**: 已完成
- 文件: `chat-app/backend/src/middleware/validation.middleware.js`
- 添加 `giftSchemas` - 禮物相關驗證（禮物 ID 格式、送禮、獲取記錄等）
- 添加 `membershipSchemas` - 會員相關驗證（升級、取消）
- 添加 `assetSchemas` - 資產相關驗證（SKU 格式、購買套餐、使用解鎖券）
- 添加 `extraValidations` - 補充驗證（年齡 0-150、大金額 1-1M、字串長度）
- 在 `userSchemas.updateProfile` 中添加年齡驗證
- 所有驗證統一使用 Zod，提供清晰的錯誤訊息

**實現**:
```javascript
// middleware/validation.middleware.js

// 禮物相關驗證
export const giftSchemas = {
  // 禮物 ID 格式（只允許字母、數字、底線、連字號）
  giftId: z.string()
    .min(1, "禮物 ID 不得為空")
    .regex(/^[a-z0-9_-]+$/i, "禮物 ID 只能包含字母、數字、底線、連字號")
    .trim(),

  // 送禮物
  sendGift: {
    body: z.object({
      characterId: commonSchemas.characterId,
      giftId: z.string()
        .min(1, "禮物 ID 不得為空")
        .regex(/^[a-z0-9_-]+$/i, "禮物 ID 只能包含字母、數字、底線、連字號")
        .trim(),
      requestId: z.string().min(1, "請提供請求ID以防止重複扣款").trim(),
    }),
  },
  // ... 其他 schemas
};

// 會員相關驗證
export const membershipSchemas = {
  tier: z.enum(["free", "vip", "vvip"]),
  upgradeMembership: {
    body: z.object({
      tier: z.enum(["vip", "vvip"]),
      paymentInfo: z.record(z.any()).optional(),
      idempotencyKey: z.string().min(1, "請提供冪等性鍵以防止重複購買").trim(),
    }),
  },
};

// 資產相關驗證
export const assetSchemas = {
  sku: z.string()
    .min(1, "SKU 不得為空")
    .regex(/^[a-z0-9_-]+$/i, "SKU 只能包含字母、數字、底線、連字號")
    .trim(),
  purchasePackage: {
    body: z.object({
      sku: assetSchemas.sku,
      idempotencyKey: z.string().min(1, "請提供冪等性鍵以防止重複購買").trim(),
    }),
  },
};

// 補充驗證
export const extraValidations = {
  age: z.coerce.number()
    .int("年齡必須為整數")
    .min(0, "年齡不得小於 0")
    .max(150, "年齡不得超過 150")
    .optional(),
  largeAmount: z.coerce.number()
    .int("金額必須為整數")
    .positive("金額必須為正數")
    .max(1000000, "金額不得超過 1,000,000"),
};

// 用戶資料更新（包含年齡驗證）
export const userSchemas = {
  updateProfile: {
    body: z.object({
      displayName: commonSchemas.displayName.optional(),
      gender: z.enum(["male", "female", "other"]).optional(),
      age: z.coerce.number()
        .int("年齡必須為整數")
        .min(0, "年齡不得小於 0")
        .max(150, "年齡不得超過 150")
        .optional(),
      defaultPrompt: z.string().max(200).optional(),
    }),
  },
};
```

**使用方式**:
```javascript
// gift/gift.routes.js（可選：將手動驗證替換為中間件）
import { validateRequest, giftSchemas } from '../middleware/validation.middleware.js';

router.post('/send',
  requireFirebaseAuth,
  validateRequest(giftSchemas.sendGift), // ✅ 統一驗證
  asyncHandler(sendGiftHandler)
);

// user/user.routes.js
router.patch('/:userId/profile',
  requireFirebaseAuth,
  validateRequest(userSchemas.updateProfile), // ✅ 包含年齡驗證
  asyncHandler(updateProfileHandler)
);
```

**影響範圍**: 提供統一的驗證標準，減少安全漏洞和數據錯誤

---

### 17. 🔄 AI 服務重試機制

**文件**: `chat-app/backend/src/ai/ai.service.js`

首先創建重試工具：

**文件**: `chat-app/backend/src/utils/retryWithBackoff.js`

```javascript
/**
 * 帶退避的重試機制
 */
export const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = () => true,
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 檢查是否應該重試
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // 等待後重試
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
};
```

然後修改 AI 服務：

```javascript
// ai/ai.service.js
import { retryWithBackoff } from '../utils/retryWithBackoff.js';
import conversationLimitService from '../services/limitService/conversationLimit.service.js';

const requestOpenAIReply = async (character, history, latestUserMessage, userId, characterId, user = null) => {
  const client = getOpenAIClient();
  const messages = await mapHistoryToChatMessages(history, latestUserMessage, userId, characterId);

  try {
    // ✅ 添加重試機制 (最多 3 次)
    const completion = await retryWithBackoff(
      async () => await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500,
        temperature: 0.9,
      }),
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        shouldRetry: (error) => {
          // 只重試臨時錯誤
          return error.status >= 500 || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET';
        }
      }
    );

    return completion?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    logger.error(`OpenAI 請求失敗（已重試 3 次）:`, error);

    // ✅ 補償機制：返還對話次數
    try {
      await conversationLimitService.decrementUse(userId, characterId, {
        reason: 'ai_request_failed',
        error: error.message,
        idempotencyKey: `rollback_${userId}_${characterId}_${Date.now()}`
      });
      logger.info(`已返還用戶 ${userId} 的對話次數`);
    } catch (rollbackError) {
      logger.error('返還對話次數失敗:', rollbackError);
    }

    throw error;
  }
};
```

---

## 📝 測試指南

### 單元測試

```bash
cd chat-app/backend
npm test
```

### 集成測試（使用 Firebase Emulator）

```bash
cd chat-app
npm run dev:with-emulator
```

### 手動測試場景

**1. 測試冪等性**
```bash
# 發送兩次相同的購買請求
curl -X POST http://localhost:4000/api/coins/purchase \
  -H "Idempotency-Key: test-key-123" \
  -d '{"packageId": "coins_100"}'

# 第二次應返回緩存結果，不會重複扣款
```

**2. 測試會員升級原子性**
```javascript
// 1. 升級會員
const result = await upgradeMembership('user-123', 'vip');

// 2. 驗證所有數據已更新
const user = await getUserById('user-123');
console.assert(user.membershipTier === 'vip');
console.assert(user.unlockTickets.characterUnlockCards > 0);
console.assert(user.coins.balance > 0);

// 3. 驗證交易記錄
const transactions = await getTransactions('user-123');
console.assert(transactions.some(t => t.type === 'reward'));
```

**3. 測試並發安全**
```javascript
// 同時發起 10 個購買請求（應該只成功一次）
const promises = Array(10).fill(0).map(() =>
  purchaseAssetPackage('user-123', 'photo_cards_10')
);

const results = await Promise.allSettled(promises);
const successful = results.filter(r => r.status === 'fulfilled');
console.assert(successful.length === 1); // 只有一個成功
```

---

## 🚀 部署步驟

### 1. 後端部署

```bash
cd chat-app/backend

# 測試
npm run test:env

# 部署到 Cloud Run
./deploy-cloudrun.sh  # Linux/Mac
# 或
deploy-cloudrun.bat   # Windows
```

### 2. 前端部署

```bash
cd chat-app

# 構建
npm run build:frontend

# 部署
firebase deploy --only hosting
```

### 3. Firestore 索引部署

```bash
firebase deploy --only firestore:indexes
```

### 4. 驗證部署

```bash
# 檢查後端健康狀態
curl https://your-backend-url.run.app/health

# 檢查冪等性系統狀態
curl https://your-backend-url.run.app/api/system/idempotency/stats
```

---

## 📊 修復統計

| 類別 | 已完成 | 待完成 | 總計 |
|------|--------|--------|------|
| 🔴 高危 | 5 | 0 | 5 |
| 🟡 中危 | 6 | 2 | 8 |
| 🟢 低危 | 1 | 4 | 5 |
| 📈 優化 | 2 | 1 | 3 |
| **總計** | **14** | **7** | **21** |

**完成度**: 66.7%

### 已完成的修復

**高危問題**:
1. ✅ 冪等性改用 Firestore（Commit: `7e69f82`）
2. ✅ 會員升級獎勵原子性（Commit: `1a7c8db`）
3. ✅ 藥水購買會員檢查移到 Transaction 內（本次提交）
4. ✅ 測試 Token 緩存時間縮短（Commit: `c28c549`）
5. ✅ 前端金幣餘額並發保護（Commit: `52f4a0c`）

**中危問題**:
6. ✅ 藥水使用 Transaction 保護（Commit: `e3fafcb`）
7. ✅ 訂單狀態機驗證（Commit: `735e665`）
8. ✅ 資產購買原子性（Commit: `738a914`）
9. ✅ 前端用戶資料緩存 TTL（Commit: `83c66cf`）
10. ✅ 購買確認防抖（Commit: `563a6bd`）
11. ✅ 前端消息發送重試機制（Commit: `62ee425`）

**低危問題**:
12. ✅ 加強輸入驗證（Commit: `eae1d72`）

**性能優化**:
13. ✅ 添加 Firestore 索引（Commit: `c28c549`）
14. ✅ 創建修復文檔（Commit: `da49a75`）

---

## 📅 後續計畫

### 第 1 週（緊急）
- [ ] 完成剩餘 3 個高危問題
- [ ] 添加 Firestore 索引
- [ ] 添加速率限制

### 第 2-3 週（重要）
- [ ] 完成所有中危問題
- [ ] 添加輸入驗證
- [ ] AI 服務重試機制

### 第 4-6 週（改進）
- [ ] 完成低危問題和性能優化
- [ ] 添加監控和告警
- [ ] 建立自動化測試

---

## 🔍 監控和告警

### 需要監控的指標

1. **冪等性系統**
   - Firestore 冪等性記錄數量
   - 本地緩存命中率
   - 重複請求攔截次數

2. **會員系統**
   - 升級失敗率
   - 獎勵發放失敗次數
   - Transaction 回滾次數

3. **財務操作**
   - 異常購買行為（單個用戶頻繁購買）
   - 餘額異常變動
   - 退款率

4. **AI 服務**
   - OpenAI API 失敗率
   - 重試次數
   - 對話次數返還次數

### 告警設置

```javascript
// 示例：Firestore 觸發器監控異常交易
exports.monitorAbnormalTransactions = functions.firestore
  .document('transactions/{transactionId}')
  .onCreate(async (snap, context) => {
    const transaction = snap.data();

    // 檢查異常金額
    if (transaction.amount > 10000) {
      await sendAlert({
        type: 'HIGH_AMOUNT_TRANSACTION',
        userId: transaction.userId,
        amount: transaction.amount,
      });
    }

    // 檢查頻繁交易
    const recentTransactions = await getRecentTransactions(
      transaction.userId,
      60 * 1000 // 1 分鐘內
    );

    if (recentTransactions.length > 10) {
      await sendAlert({
        type: 'FREQUENT_TRANSACTIONS',
        userId: transaction.userId,
        count: recentTransactions.length,
      });
    }
  });
```

---

## 📚 參考資料

- [CLAUDE.md](CLAUDE.md) - 專案完整文檔
- [LIMIT_SYSTEM_EXPLAINED.md](LIMIT_SYSTEM_EXPLAINED.md) - 限制系統說明
- [SECURITY_AUDIT_FIXES.md](SECURITY_AUDIT_FIXES.md) - 安全審計記錄
- [Firestore Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) - Firebase 官方文檔

---

## 💬 問題反饋

如果在測試或部署過程中遇到問題，請：

1. 檢查日誌：`chat-app/backend/logs/`
2. 查看 Firestore Console 是否有錯誤
3. 在 GitHub Issues 提交問題報告

---

**最後更新**: 2025-01-XX
**維護者**: Development Team
