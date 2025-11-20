# 禮物發送功能修復 (2025-01-19)

## 問題描述

用戶在聊天室送禮物時，後端返回 500 Internal Server Error：

```
POST http://192.168.1.107:4000/api/gifts/send 500 (Internal Server Error)
```

## 問題原因

在 `chat-app/backend/src/gift/gift.service.js` 的 `sendGift` 函數中，Firestore Transaction 內部使用了動態 import：

```javascript
// ❌ 錯誤：Transaction 內部使用動態 import
await db.runTransaction(async (transaction) => {
  // ...
  const { getWalletBalance, createWalletUpdate } = await import("../user/walletHelpers.js");
  // ...
  const { TRANSACTION_TYPES } = await import("../payment/coins.service.js");
  // ...
});
```

**為什麼會導致問題？**
1. 動態 import 是異步操作，可能導致 Transaction 執行時間過長
2. 在某些運行環境下，動態 import 可能會失敗或超時
3. Firestore Transaction 有時間限制，過多的異步操作可能導致超時

## 修復方案

將動態 import 改為靜態 import，在文件頂部導入所需模塊：

```javascript
// ✅ 正確：在文件頂部靜態導入
import { getWalletBalance, createWalletUpdate } from "../user/walletHelpers.js";
import { TRANSACTION_TYPES } from "../payment/coins.service.js";

// Transaction 內部直接使用
await db.runTransaction(async (transaction) => {
  // ...
  const currentBalance = getWalletBalance(userData);
  const walletUpdate = createWalletUpdate(newBalance);
  // ...
  transaction.set(transactionRef, {
    type: TRANSACTION_TYPES.SPEND,
    // ...
  });
});
```

## 修改的文件

- `chat-app/backend/src/gift/gift.service.js`
  - 第15-16行：添加靜態 import
  - 第89行：移除動態 import `getWalletBalance` 和 `createWalletUpdate`
  - 第154行：移除動態 import `TRANSACTION_TYPES`

## 測試步驟

### 1. 重啟後端服務

```bash
# 停止當前運行的後端（按 Ctrl+C）
# 然後重新啟動
cd chat-app
npm run dev:backend
```

### 2. 測試送禮功能

1. 訪問前端：http://localhost:5173
2. 登入測試帳號
3. 進入任意角色的聊天室
4. 點擊送禮物按鈕
5. 選擇一個禮物並確認

**預期結果**：
- ✅ 禮物發送成功
- ✅ 金幣餘額正確扣除
- ✅ 收到禮物感謝訊息
- ✅ 控制台沒有 500 錯誤

### 3. 驗證後端日誌

後端控制台應該顯示類似以下日誌：

```
[禮物] 用戶 {userId} 送禮物 {giftName} 給角色 {characterId}，花費 {cost} 金幣
```

## 技術細節

### Firestore Transaction 最佳實踐

1. **避免異步操作**：Transaction 內部應盡量減少異步操作
2. **預先準備數據**：在 Transaction 外部準備好所需數據
3. **快速執行**：Transaction 應快速完成，避免超時
4. **冪等性**：Transaction 可能會重試，確保操作可重複執行

### 動態 Import vs 靜態 Import

**動態 Import**（`await import(...)`）：
- ✅ 延遲加載，減少初始載入時間
- ✅ 條件性加載模塊
- ❌ 異步操作，可能影響性能
- ❌ 在 Transaction 內使用可能導致問題

**靜態 Import**（`import ... from ...`）：
- ✅ 編譯時解析，速度快
- ✅ 更好的類型檢查和 IDE 支持
- ✅ 適合在 Transaction 內使用
- ❌ 增加初始載入時間（對於大型模塊）

## 相關文件

- **禮物系統路由**: `chat-app/backend/src/gift/gift.routes.js`
- **禮物系統服務**: `chat-app/backend/src/gift/gift.service.js`
- **錢包輔助函數**: `chat-app/backend/src/user/walletHelpers.js`
- **前端送禮邏輯**: `chat-app/frontend/src/composables/chat/useChatActions.ts`

## 附加檢查

如果問題仍然存在，請檢查：

1. **後端服務是否重啟**：確保使用修復後的代碼
2. **用戶餘額**：確保用戶有足夠的金幣
3. **禮物配置**：確保禮物 ID 存在且配置正確
4. **網絡連接**：確保前端可以正常連接到後端 API

## 日誌調試

如果仍有問題，啟用詳細日誌：

```bash
# 在後端 .env 文件中設置
LOG_LEVEL=debug
```

查看詳細的錯誤堆棧：

```bash
# 後端日誌會顯示完整的錯誤訊息
# 關注包含 "禮物" 或 "gift" 的日誌
```

## 總結

- **問題**：Transaction 內動態 import 導致 500 錯誤
- **修復**：改用靜態 import
- **影響**：禮物發送功能恢復正常
- **測試**：重啟後端後測試送禮功能
