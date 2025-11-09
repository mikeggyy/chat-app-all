# 創建卡系統安全審核 - 競態條件漏洞

> **審核日期**: 2025-11-09
> **嚴重程度**: 🔴 **極高危**（可導致資產憑空消失或無限制使用）

---

## 🚨 漏洞 #1: 資產扣除的競態條件（CRITICAL）

### 嚴重程度
🔴 **極高危** - 可能導致：
- 用戶創建卡被多次扣除（資金損失）
- 用戶可以無限制使用創建卡（資源耗盡攻擊）
- 資產數量變成負數

### 漏洞位置
- **檔案**: [`chat-app/backend/src/user/assets.service.js:138-197`](chat-app/backend/src/user/assets.service.js#L138-L197)
- **函數**: `consumeUserAsset()`

### 問題描述

資產扣除使用了經典的「讀取-檢查-寫入」（Read-Check-Write）模式，但**沒有使用 Firestore Transaction**，導致嚴重的競態條件。

**漏洞代碼**:

```javascript
export const consumeUserAsset = async (userId, assetType, amount = 1, reason = '', metadata = {}) => {
  // ❌ 步驟 1: 讀取用戶資料（無鎖定）
  const user = await getUserById(userId);

  const currentAssets = user.assets || {...};
  const previousQuantity = currentAssets[assetType] || 0;

  // ❌ 步驟 2: 檢查餘額（無原子性保證）
  if (previousQuantity < numAmount) {
    throw new Error(`${assetType} 數量不足`);
  }

  newAssets[assetType] = previousQuantity - numAmount;

  // ❌ 步驟 3: 寫入更新（可能覆蓋其他請求的更新）
  const updatedUser = await upsertUser({
    ...user,
    assets: newAssets,
    updatedAt: new Date().toISOString(),
  });
  // ...
};
```

而 `upsertUser()` 也**沒有使用 Transaction**:

```javascript
// user.service.js:184-195
export const upsertUser = async (payload = {}) => {
  const user = normalizeUser(payload);
  const db = getFirestoreDb();
  const userRef = db.collection(USERS_COLLECTION).doc(user.id);

  // ❌ 使用 set() 而非 Transaction，無法防止並發衝突
  await userRef.set(user, { merge: true });
  return user;
};
```

### 攻擊場景

#### 場景 1: 雙重扣除攻擊

**時間線**:
```
T0: 用戶有 1 張創建卡

T1: 請求 A 讀取用戶資料 → balance = 1
T2: 請求 B 讀取用戶資料 → balance = 1  (還沒看到 A 的更新)
T3: 請求 A 檢查餘額 → 1 >= 1 ✓ 通過
T4: 請求 B 檢查餘額 → 1 >= 1 ✓ 通過
T5: 請求 A 寫入 → balance = 0
T6: 請求 B 寫入 → balance = 0  (覆蓋了 A 的更新!)

結果: 用戶有 1 張卡，但成功創建了 2 個角色！
```

#### 場景 2: 資產憑空消失

**時間線**:
```
T0: 用戶有 5 張創建卡

T1: 請求 A 讀取 → balance = 5
T2: 請求 B 讀取 → balance = 5
T3: 請求 A 扣除 1 張 → balance = 4
T4: 請求 B 扣除 1 張 → balance = 4  (覆蓋了 A 的更新)
T5: 請求 A 寫入 → balance = 4
T6: 請求 B 寫入 → balance = 4

結果: 用戶扣除了 2 次，但餘額只減少了 1！
反之，如果順序相反，餘額會變成 3（正確應該是 3，但用戶可能只成功了 1 次創建）
```

#### 場景 3: 惡意並發攻擊

攻擊者可以：
1. 購買 1 張創建卡
2. 同時發送 100 個創建請求
3. 由於競態條件，可能有 10-20 個請求通過餘額檢查
4. 用 1 張卡創建了多個角色

### 修復方案

**必須使用 Firestore Transaction** 來確保原子性：

```javascript
// ✅ 修復後的代碼
export const consumeUserAsset = async (userId, assetType, amount = 1, reason = '', metadata = {}) => {
  if (!userId) {
    throw new Error('需要提供用戶 ID');
  }

  if (!assetType) {
    throw new Error('需要提供資產類型');
  }

  const validAssetTypes = ['characterUnlockCards', 'photoUnlockCards', 'videoUnlockCards', 'voiceUnlockCards', 'createCards'];
  if (!validAssetTypes.includes(assetType)) {
    throw new Error(`無效的資產類型: ${assetType}`);
  }

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount < 0) {
    throw new Error('數量必須是非負數');
  }

  const db = getFirestoreDb();
  const userRef = db.collection('users').doc(userId);

  // ✅ 使用 Firestore Transaction 確保原子性
  const result = await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error('找不到指定的使用者');
    }

    const user = userDoc.data();
    const currentAssets = user.assets || {
      characterUnlockCards: 0,
      photoUnlockCards: 0,
      videoUnlockCards: 0,
      voiceUnlockCards: 0,
      createCards: 0,
    };

    const previousQuantity = currentAssets[assetType] || 0;

    // ✅ 在 Transaction 內檢查餘額
    if (previousQuantity < numAmount) {
      throw new Error(`${assetType} 數量不足`);
    }

    const newAssets = {
      ...currentAssets,
      [assetType]: previousQuantity - numAmount,
    };

    // ✅ 在 Transaction 內更新
    transaction.update(userRef, {
      assets: newAssets,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      previousQuantity,
      newQuantity: newAssets[assetType],
    };
  });

  // 記錄資產變更（Transaction 外，不阻塞主流程）
  logAssetChange({
    userId,
    assetType,
    action: 'consume',
    amount: numAmount,
    previousQuantity: result.previousQuantity,
    newQuantity: result.newQuantity,
    reason,
    metadata,
  }).catch(err => logger.error('[資產審計] 記錄失敗:', err));

  return result;
};
```

**關鍵改進**:
1. ✅ 使用 `db.runTransaction()` 確保原子性
2. ✅ 讀取-檢查-寫入在同一個 Transaction 內完成
3. ✅ Firestore 會自動處理並發衝突（重試機制）
4. ✅ 審計日誌在 Transaction 外異步執行，不阻塞主流程

---

## 🚨 漏洞 #2: 圖片生成端點的樂觀鎖定不完整

### 嚴重程度
🟠 **高危** - 可能導致：
- 並發請求時標記狀態不一致
- 回滾邏輯錯誤覆蓋正確的標記

### 漏洞位置
- **檔案**: [`chat-app/backend/src/characterCreation/characterCreation.routes.js:562-598`](chat-app/backend/src/characterCreation/characterCreation.routes.js#L562-L598)
- **端點**: `POST /generate-images`

### 問題描述

樂觀鎖定策略在並發請求時可能導致標記狀態不一致。

**漏洞代碼**:

```javascript
// 步驟 1: 設置標記（樂觀鎖定）
const latestFlow = await getCreationFlow(flowId);
if (latestFlow && latestFlow.metadata) {
  await mergeCreationFlow(flowId, {
    metadata: {
      ...latestFlow.metadata,
      deductedOnImageGeneration: needsCreateCard,  // ⚠️ 設置為 true
    },
  });
}

// 步驟 2: 扣除創建卡
try {
  if (needsCreateCard) {
    await consumeUserAsset(userId, "createCards", 1);
  }
} catch (error) {
  // 步驟 3: 回滾標記
  await mergeCreationFlow(flowId, {
    metadata: {
      ...latestFlow.metadata,
      deductedOnImageGeneration: false,  // ⚠️ 設置為 false
    },
  });
  throw new Error("創建卡扣除失敗，請重試");
}
```

### 攻擊場景

**並發請求導致標記錯誤**:

```
T0: 用戶觸發兩次圖片生成（網路抖動或惡意重複點擊）

請求 A:
T1: 設置 deductedOnImageGeneration = true
T2: 扣除創建卡 → 成功

請求 B (並發):
T3: 設置 deductedOnImageGeneration = true
T4: 扣除創建卡 → 失敗（餘額不足）
T5: 回滾標記 → deductedOnImageGeneration = false  ⚠️

結果:
- 請求 A 扣除成功，但標記被請求 B 回滾為 false
- 用戶繼續創建角色時，會再次扣除創建卡！
```

### 修復方案

**使用冪等性密鑰或版本號防止並發衝突**:

```javascript
// ✅ 方案 1: 使用冪等性密鑰（推薦）
// 在 handleIdempotentRequest 中已經有冪等性保護
// 確保同一個 flowId 只能成功執行一次圖片生成

// ✅ 方案 2: 使用版本號進行樂觀鎖定
const latestFlow = await getCreationFlow(flowId);
const version = (latestFlow.metadata?.version || 0) + 1;

await mergeCreationFlow(flowId, {
  metadata: {
    ...latestFlow.metadata,
    version,
    deductedOnImageGeneration: needsCreateCard,
  },
});

try {
  if (needsCreateCard) {
    await consumeUserAsset(userId, "createCards", 1);
  }
} catch (error) {
  // 只有當版本號匹配時才回滾
  const currentFlow = await getCreationFlow(flowId);
  if (currentFlow.metadata?.version === version) {
    await mergeCreationFlow(flowId, {
      metadata: {
        ...currentFlow.metadata,
        deductedOnImageGeneration: false,
      },
    });
  }
  throw new Error("創建卡扣除失敗，請重試");
}
```

**或更好的方案：使用 Firestore Transaction**:

```javascript
// ✅ 方案 3: 整個流程在 Transaction 內完成
const db = getFirestoreDb();
await db.runTransaction(async (transaction) => {
  // 1. 讀取 flow
  const flowRef = db.collection('character_creation_flows').doc(flowId);
  const flowDoc = await transaction.get(flowRef);
  const flow = flowDoc.data();

  // 2. 檢查是否已扣除
  if (flow.metadata?.deductedOnImageGeneration) {
    throw new Error('此流程已經扣除過創建卡');
  }

  // 3. 扣除創建卡（也在 Transaction 內）
  if (needsCreateCard) {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);
    const user = userDoc.data();
    const createCards = user.assets?.createCards || 0;

    if (createCards < 1) {
      throw new Error('創建卡數量不足');
    }

    transaction.update(userRef, {
      'assets.createCards': createCards - 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // 4. 設置標記
  transaction.update(flowRef, {
    'metadata.deductedOnImageGeneration': needsCreateCard,
    updatedAt: FieldValue.serverTimestamp(),
  });
});
```

---

## 🚨 漏洞 #3: 回滾機制的不完整錯誤處理

### 嚴重程度
🟡 **中危** - 可能導致：
- 用戶損失創建次數但未能創建角色
- 審計日誌不準確

### 漏洞位置
- **檔案**: [`chat-app/backend/src/match/match.routes.js:183-196`](chat-app/backend/src/match/match.routes.js#L183-L196)
- **端點**: `POST /match/create`

### 問題描述

回滾失敗時，錯誤被吞掉，用戶損失創建次數且無法恢復。

**漏洞代碼**:

```javascript
try {
  match = await createMatch(req.body);
  logger.info(`[角色創建] 角色創建成功: ${match.id}`);
} catch (createError) {
  logger.error("[角色創建] 創建角色失敗，回滾計數:", createError);

  if (userId && tempCharacterId) {
    try {
      const { decrementCreation } = await import("../characterCreation/characterCreationLimit.service.js");
      await decrementCreation(userId, {
        reason: 'character_creation_failed',
        error: createError.message,
        tempCharacterId,
      });
      logger.info(`[角色創建] 用戶 ${userId} 創建失敗，已回滾計數`);
    } catch (rollbackError) {
      // ❌ 回滾失敗，錯誤被吞掉
      logger.error("[角色創建] 回滾計數失敗:", rollbackError);
      // ⚠️ 沒有通知用戶或記錄到審計日誌
    }
  }

  throw createError;
}
```

### 攻擊場景

**用戶損失創建次數**:

```
1. 用戶有 3 次免費創建次數
2. 記錄創建次數 → 剩餘 2 次
3. 創建角色失敗（Firestore 網路錯誤）
4. 嘗試回滾計數 → 回滾也失敗（Firestore 仍然無法連接）
5. 錯誤被吞掉，只記錄在日誌中
6. 用戶看到「創建失敗」，但創建次數已經扣除
7. 用戶實際剩餘次數: 2（應該是 3）
```

### 修復方案

**記錄回滾失敗並通知用戶**:

```javascript
// ✅ 修復後的代碼
try {
  match = await createMatch(req.body);
  logger.info(`[角色創建] 角色創建成功: ${match.id}`);
} catch (createError) {
  logger.error("[角色創建] 創建角色失敗，回滾計數:", createError);

  if (userId && tempCharacterId) {
    try {
      const { decrementCreation } = await import("../characterCreation/characterCreationLimit.service.js");
      await decrementCreation(userId, {
        reason: 'character_creation_failed',
        error: createError.message,
        tempCharacterId,
      });
      logger.info(`[角色創建] 用戶 ${userId} 創建失敗，已回滾計數`);
    } catch (rollbackError) {
      // ✅ 記錄到審計日誌
      logger.error("[角色創建] ⚠️ 回滾計數失敗，用戶可能損失創建次數:", rollbackError);

      // ✅ 發送告警通知（如果有告警系統）
      // await sendAlert({
      //   type: 'rollback_failed',
      //   userId,
      //   tempCharacterId,
      //   error: rollbackError.message,
      // });

      // ✅ 在響應中包含警告信息
      return res.status(500).json({
        error: "創建失敗",
        message: createError.message,
        warning: "系統發生錯誤，您的創建次數可能未正確回滾。如遇問題請聯繫客服。",
        supportInfo: {
          tempCharacterId,
          timestamp: new Date().toISOString(),
        }
      });
    }
  }

  throw createError;
}
```

---

## 🚨 漏洞 #4: 無冪等性保護的回滾操作

### 嚴重程度
🟡 **中危** - 可能導致：
- 創建次數被多次回滾
- 用戶獲得不應得的免費次數

### 漏洞位置
- **檔案**: [`chat-app/backend/src/services/limitService/limitTracking.js:156-184`](chat-app/backend/src/services/limitService/limitTracking.js#L156-L184)
- **函數**: `decrementUse()`

### 問題描述

回滾操作沒有冪等性保護，可以被多次調用。

**漏洞代碼**:

```javascript
export const decrementUse = (limitData, metadata = {}) => {
  const previousCount = limitData.count;

  // ❌ 無條件減少計數，沒有檢查是否已回滾過
  limitData.count = Math.max(0, limitData.count - 1);

  // 記錄回滾歷史
  if (Array.isArray(limitData.history)) {
    limitData.history.push({
      timestamp: new Date().toISOString(),
      action: 'rollback',
      previousCount,
      newCount: limitData.count,
      ...metadata,
    });
  }

  return {
    success: true,
    previousCount,
    newCount: limitData.count,
    decremented: previousCount - limitData.count,
  };
};
```

### 攻擊場景

**重複回滾攻擊**:

```
1. 用戶有 0 次免費創建次數
2. 用戶購買 1 張創建卡
3. 記錄創建次數 → count = 1（免費次數計數器）
4. 創建角色失敗
5. 回滾計數 → count = 0
6. 攻擊者重複調用回滾 API（如果有暴露）
7. count 已經是 0，但 Math.max(0, -1) = 0，所以不會變負數
8. 但如果是在免費次數仍有剩餘時重複回滾，會給用戶額外的次數
```

**實際漏洞場景**:

```
1. 用戶有 5 次免費創建次數
2. 記錄創建 → count = 1
3. 創建失敗
4. 回滾 → count = 0（正確）
5. 攻擊者重播請求（或網路重試）
6. 再次回滾 → count = -1（然後被 Math.max 截斷為 0）
7. 用戶下次創建時，檢查 remaining = limit - count = 5 - 0 = 5
8. 用戶沒有損失創建次數（應該是 4 次剩餘）
```

### 修復方案

**使用回滾 ID 實現冪等性**:

```javascript
// ✅ 修復後的代碼
export const decrementUse = (limitData, metadata = {}) => {
  const previousCount = limitData.count;

  // ✅ 檢查是否已經回滾過（使用 tempCharacterId 作為冪等性密鑰）
  const rollbackId = metadata.tempCharacterId || metadata.rollbackId;
  if (rollbackId && Array.isArray(limitData.history)) {
    const alreadyRolledBack = limitData.history.some(
      entry => entry.action === 'rollback' && entry.tempCharacterId === rollbackId
    );

    if (alreadyRolledBack) {
      logger.warn(`[回滾] 檢測到重複回滾請求: ${rollbackId}`);
      return {
        success: true,
        alreadyRolledBack: true,
        previousCount,
        newCount: limitData.count,
        decremented: 0,
      };
    }
  }

  // 減少計數
  limitData.count = Math.max(0, limitData.count - 1);

  // 記錄回滾歷史（包含冪等性密鑰）
  if (Array.isArray(limitData.history)) {
    limitData.history.push({
      timestamp: new Date().toISOString(),
      action: 'rollback',
      previousCount,
      newCount: limitData.count,
      tempCharacterId: rollbackId,
      ...metadata,
    });

    // 限制歷史記錄數量
    if (limitData.history.length > 100) {
      limitData.history.shift();
    }
  }

  return {
    success: true,
    alreadyRolledBack: false,
    previousCount,
    newCount: limitData.count,
    decremented: previousCount - limitData.count,
  };
};
```

---

## 修復優先級

### 🔴 緊急修復（立即處理）

1. **漏洞 #1: 資產扣除競態條件**
   - **影響**: 可能導致資金損失或資源耗盡攻擊
   - **修復時間**: 1-2 小時
   - **修復方法**: 將 `consumeUserAsset()` 改為使用 Firestore Transaction

### 🟠 高優先級（本週內處理）

2. **漏洞 #2: 圖片生成樂觀鎖定不完整**
   - **影響**: 並發請求可能導致雙重扣除
   - **修復時間**: 2-3 小時
   - **修復方法**: 使用版本號或將整個流程改為 Transaction

### 🟡 中優先級（兩週內處理）

3. **漏洞 #3: 回滾機制錯誤處理不完整**
   - **影響**: 用戶可能損失創建次數
   - **修復時間**: 1 小時
   - **修復方法**: 添加審計日誌和用戶通知

4. **漏洞 #4: 回滾操作無冪等性保護**
   - **影響**: 用戶可能獲得額外的免費次數
   - **修復時間**: 1-2 小時
   - **修復方法**: 使用 tempCharacterId 實現冪等性

---

## 建議的測試方案

### 並發測試

```javascript
// 測試資產扣除的競態條件
async function testConcurrentDeduction() {
  const userId = 'test-user';

  // 給用戶 1 張創建卡
  await setUserAssets(userId, { createCards: 1 });

  // 同時發送 10 個扣除請求
  const promises = Array(10).fill(null).map(() =>
    consumeUserAsset(userId, 'createCards', 1)
  );

  try {
    await Promise.all(promises);
    console.error('❌ 測試失敗：10 個請求都成功了（應該只有 1 個成功）');
  } catch (error) {
    // 檢查最終餘額
    const assets = await getUserAssets(userId);
    if (assets.createCards === 0) {
      console.log('✅ 測試通過：只有 1 個請求成功');
    } else if (assets.createCards < 0) {
      console.error('❌ 測試失敗：餘額變成負數');
    } else {
      console.error(`❌ 測試失敗：餘額是 ${assets.createCards}（應該是 0）`);
    }
  }
}
```

---

## 總結

### 發現的漏洞

| # | 漏洞名稱 | 嚴重程度 | 影響 | 狀態 |
|---|---------|---------|------|------|
| 1 | 資產扣除競態條件 | 🔴 極高危 | 資金損失、資源耗盡 | ⚠️ 待修復 |
| 2 | 樂觀鎖定不完整 | 🟠 高危 | 雙重扣除 | ⚠️ 待修復 |
| 3 | 回滾錯誤處理不完整 | 🟡 中危 | 用戶損失次數 | ⚠️ 待修復 |
| 4 | 回滾無冪等性保護 | 🟡 中危 | 免費次數濫用 | ⚠️ 待修復 |

### 修復時間估算

- **緊急修復**: 1-2 小時（漏洞 #1）
- **高優先級**: 2-3 小時（漏洞 #2）
- **中優先級**: 2-3 小時（漏洞 #3, #4）
- **測試驗證**: 2-3 小時
- **總計**: 約 8-12 小時

### 建議的後續工作

1. **立即修復漏洞 #1**（使用 Firestore Transaction）
2. **添加並發測試**（確保修復有效）
3. **實施監控和告警**（檢測異常的資產變動）
4. **審計現有數據**（檢查是否已發生資產異常）
5. **文檔更新**（記錄所有修復和最佳實踐）

---

**審核完成日期**: 2025-11-09
**審核人員**: Claude Code
**下次審核**: 修復完成後進行回歸測試
