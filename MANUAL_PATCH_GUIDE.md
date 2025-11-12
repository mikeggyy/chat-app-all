# 手動應用補丁指引

自動部署已完成！現在需要手動應用 2 個補丁文件。

---

## 📝 補丁 1：baseLimitService.js（5-10 分鐘）

### 目標文件
`chat-app/backend/src/services/baseLimitService.js`

### 修改步驟

#### 步驟 1.1：修改導入語句（第 1-10 行附近）

**尋找：**
```javascript
import { checkAndReset, RESET_PERIOD } from './limitReset.js';
```

**替換為：**
```javascript
import {
  checkAndResetAll,
  checkAndResetAdUnlocks,
  RESET_PERIOD,
} from "./limitReset.js";
```

#### 步驟 1.2：更新 canUse() 函數（約第 200-250 行）

**尋找：**
```javascript
export const canUse = async (userId, characterId = null) => {
  const limitData = await initUserLimit(userId, characterId);

  // 檢查並重置
  const wasReset = checkAndReset(limitData, resetPeriod);
```

**替換為：**
```javascript
export const canUse = async (userId, characterId = null) => {
  const limitData = await initUserLimit(userId, characterId);

  // ✅ 修復：使用 checkAndResetAll() 同時檢查兩種重置
  const wasReset = checkAndResetAll(limitData, resetPeriod);
```

#### 步驟 1.3：重寫 recordUse() 函數（約第 230-280 行）

**尋找整個 recordUse 函數，替換為：**

```javascript
export const recordUse = async (userId, characterId = null, metadata = {}) => {
  const db = getFirestoreDb();
  const userLimitRef = getUserLimitRef(userId);

  let result = null;

  // ✅ 修復：所有操作在 Transaction 內完成
  await db.runTransaction(async (transaction) => {
    // 1. 在 Transaction 內讀取限制數據
    const doc = await transaction.get(userLimitRef);

    let userData = doc.exists ? doc.data() : { userId };

    // 2. 初始化限制數據
    let limitData;
    if (perCharacter) {
      if (!userData[fieldName]) userData[fieldName] = {};
      if (!userData[fieldName][characterId]) {
        const { createLimitData } = await import('./limitReset.js');
        userData[fieldName][characterId] = createLimitData(resetPeriod);
      }
      limitData = userData[fieldName][characterId];
    } else {
      if (!userData[fieldName]) {
        const { createLimitData } = await import('./limitReset.js');
        userData[fieldName] = createLimitData(resetPeriod);
      }
      limitData = userData[fieldName];
    }

    // 3. 在 Transaction 內檢查並重置
    checkAndResetAll(limitData, resetPeriod);

    // 4. 檢查是否允許使用（在 Transaction 內）
    const configData = await getLimitConfig(userId, characterId);
    const totalAllowed =
      configData.limit === -1
        ? -1
        : configData.limit + limitData.unlocked;

    if (
      totalAllowed !== -1 &&
      limitData.count >= totalAllowed &&
      !limitData.permanentUnlock &&
      !limitData.temporaryUnlockUntil
    ) {
      throw new Error(
        `${serviceName}次數已用完（${limitData.count}/${totalAllowed}）`
      );
    }

    // 5. 記錄使用
    limitData.count += 1;
    limitData.lastUsedAt = new Date().toISOString();

    // 添加使用記錄（可選）
    if (metadata && Object.keys(metadata).length > 0) {
      if (!limitData.usageHistory) {
        limitData.usageHistory = [];
      }
      limitData.usageHistory.push({
        timestamp: new Date().toISOString(),
        ...metadata,
      });

      // 只保留最近 100 條記錄
      if (limitData.usageHistory.length > 100) {
        limitData.usageHistory = limitData.usageHistory.slice(-100);
      }
    }

    // 6. 在 Transaction 內更新數據
    if (perCharacter) {
      userData[fieldName][characterId] = limitData;
    } else {
      userData[fieldName] = limitData;
    }

    const { FieldValue } = await import('firebase-admin/firestore');
    userData.updatedAt = FieldValue.serverTimestamp();

    transaction.set(userLimitRef, userData, { merge: true });

    // 7. 設置返回結果
    result = {
      success: true,
      count: limitData.count,
      limit: configData.limit,
      unlocked: limitData.unlocked,
      totalAllowed,
      remaining:
        totalAllowed === -1 ? -1 : Math.max(0, totalAllowed - limitData.count),
    };
  });

  return result;
};
```

#### 步驟 1.4：檢查語法

```bash
cd chat-app/backend/src/services
node -c baseLimitService.js
```

如果沒有輸出，表示語法正確！

---

## 📝 補丁 2：coins.routes.js（5-10 分鐘）

### 目標文件
`chat-app/backend/src/payment/coins.routes.js`

### 修改步驟

#### 步驟 2.1：添加導入（文件開頭）

**在其他 import 語句後添加：**
```javascript
import { validateDevModeBypass } from "../utils/devModeHelper.js";
```

#### 步驟 2.2：修改購買金幣套餐端點（約第 300-365 行）

**尋找：**
```javascript
const isDevBypassEnabled = process.env.ENABLE_DEV_PURCHASE_BYPASS === "true";

if (isDevBypassEnabled) {
  logger.warn(
    `[開發模式] 繞過支付購買金幣套餐：userId=${userId}, packageId=${packageId}`
  );
```

**在 `if (isDevBypassEnabled) {` 後面立即添加：**
```javascript
if (isDevBypassEnabled) {
  // ✅ 修復：添加安全驗證
  try {
    validateDevModeBypass(userId, {
      featureName: "金幣套餐購買",
      requireTestAccount: true,
    });

    logger.warn(
      `[開發模式] 繞過支付購買金幣套餐：userId=${userId}, packageId=${packageId}`
    );

    // ... 繼續原有邏輯
```

**並在 try 區塊結束後添加 catch：**
```javascript
  } catch (error) {
    // 驗證失敗，拒絕請求
    logger.error(`[安全] 開發模式繞過驗證失敗: ${error.message}`);
    return sendError(res, "FORBIDDEN", error.message);
  }
}
```

#### 步驟 2.3：修改測試充值端點（約第 374-428 行）

**尋找：**
```javascript
router.post(
  "/api/coins/recharge",
  requireFirebaseAuth,
  requireParams(["amount"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { amount } = req.body;
```

**將整個函數內容替換為：**
```javascript
router.post(
  "/api/coins/recharge",
  requireFirebaseAuth,
  requireParams(["amount"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { amount } = req.body;

    // ✅ 修復：限制僅測試帳號可用
    try {
      validateDevModeBypass(userId, {
        featureName: "測試充值",
        requireTestAccount: true,
      });

      logger.warn(`[測試充值] userId=${userId}, amount=${amount}`);

      const result = await addCoins(userId, amount, "測試充值", {
        type: "test_recharge",
      });

      sendSuccess(res, {
        message: "測試充值成功",
        ...result,
      });
    } catch (error) {
      logger.error(`[安全] 測試充值權限驗證失敗: ${error.message}`);
      return sendError(res, "FORBIDDEN", error.message);
    }
  })
);
```

#### 步驟 2.4：檢查語法

```bash
cd chat-app/backend/src/payment
node -c coins.routes.js
```

如果沒有輸出，表示語法正確！

---

## ✅ 完成檢查清單

完成所有修改後，請確認：

- [ ] baseLimitService.js 已修改
  - [ ] 導入語句已更新
  - [ ] canUse() 使用 checkAndResetAll
  - [ ] recordUse() 使用 Transaction
  - [ ] 語法檢查通過

- [ ] coins.routes.js 已修改
  - [ ] 已添加 validateDevModeBypass 導入
  - [ ] 購買套餐端點已加安全驗證
  - [ ] 測試充值端點已限制權限
  - [ ] 語法檢查通過

---

## 🧪 下一步：測試驗證

修改完成後，啟動開發環境測試：

```bash
cd chat-app

# 設置環境變數
export NODE_ENV=development
export ENABLE_DEV_PURCHASE_BYPASS=false
export USE_FIREBASE_EMULATOR=true

# 啟動 Emulator
npm run dev:with-emulator
```

測試項目參考 `QUICK_START.md` 的測試清單。

---

## 🚨 如果遇到問題

### 語法錯誤
- 仔細檢查大括號、括號是否匹配
- 檢查逗號、分號是否正確
- 使用 VS Code 的語法高亮檢查

### 找不到對應代碼
- 搜索關鍵字（如 `checkAndReset`、`ENABLE_DEV_PURCHASE_BYPASS`）
- 行號可能略有差異，以實際代碼為準

### 不確定如何修改
- 打開補丁文件（`.PATCH.js`）查看完整示例
- 參考備份文件（`.BACKUP.js`）對比差異

---

## 📞 需要幫助？

如果在應用補丁時遇到困難，請告訴我：
1. 哪個文件
2. 哪個步驟
3. 遇到什麼問題

我會提供更詳細的指引！
