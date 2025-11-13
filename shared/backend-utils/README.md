# Backend Utils（後端共享工具）

統一的後端工具庫，供主應用和管理後台共同使用。

## 📦 包含的工具

### 1. Firebase 初始化 (`firebase.js`)

統一的 Firebase Admin SDK 初始化邏輯。

**使用方式：**
```javascript
import { getFirestoreDb, getFirebaseAdminAuth, FieldValue } from '../../shared/backend-utils/firebase.js';

const db = getFirestoreDb();
const auth = getFirebaseAdminAuth();

// 使用 FieldValue
await db.collection('users').doc(userId).update({
  coins: FieldValue.increment(100)
});
```

**環境變數需求：**
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`（可選）

---

### 2. 日誌系統 (`logger.js`)

使用 Winston 的結構化日誌系統，內建自動脫敏功能。

**使用方式：**
```javascript
import logger, { createModuleLogger, httpLogger } from '../../shared/backend-utils/logger.js';

// 基本使用
logger.info('用戶登入成功', { userId: 'user123' });
logger.error('操作失敗', { error: err.message });

// 創建模組 logger
const authLogger = createModuleLogger('AUTH');
authLogger.info('Token 驗證成功');

// HTTP 中間件
app.use(httpLogger);
```

**特性：**
- ✅ 自動脫敏敏感信息（密碼、Token、Email 等）
- ✅ 多級別日誌（error, warn, info, http, debug）
- ✅ 文件輪轉（最多 5 個文件，每個 5MB）
- ✅ 生產環境 JSON 格式，開發環境彩色輸出

**日誌文件位置：**
- `logs/error.log` - 錯誤日誌
- `logs/combined.log` - 所有日誌
- `logs/exceptions.log` - 未捕獲的異常
- `logs/rejections.log` - 未處理的 Promise rejection

**配置日誌目錄：**
```bash
# .env
LOGS_DIRECTORY=./logs
```

---

### 3. 脫敏工具 (`sanitizer.js`)

自動識別和過濾敏感信息的工具。

**使用方式：**
```javascript
import { sanitize, sanitizeLogArgs, containsSensitiveData } from '../../shared/backend-utils/sanitizer.js';

// 脫敏單個對象
const user = {
  email: 'user@example.com',
  password: 'secret123',
  token: 'eyJhbGciOiJIUzI1...'
};

const sanitized = sanitize(user);
// {
//   email: 'us***@example.com',
//   password: '[REDACTED]',
//   token: 'eyJh...I1Ni'
// }

// 檢查字符串是否包含敏感信息
containsSensitiveData('my password is secret'); // true
```

**支援的敏感信息類型：**
- 密碼（password, secret, passphrase）
- Token（JWT, Bearer Token, API Key）
- 個人資訊（Email 部分隱藏、手機號部分隱藏）
- 支付信息（信用卡號、CVV）
- Firebase 和 OpenAI API Key

**脫敏規則：**
- **完全隱藏**：密碼、Token → `[REDACTED]`
- **部分隱藏**：Email → `us***@example.com`
- **部分隱藏**：手機號 → `09****5678`
- **Token 縮短**：JWT → `eyJh...I1Ni`

---

## 🚀 如何在應用中使用

### 主應用（chat-app）

```javascript
// chat-app/backend/src/firebase/index.js
// ❌ 刪除原有的初始化代碼

// ✅ 改為導出共享工具
export * from '../../../shared/backend-utils/firebase.js';
```

```javascript
// chat-app/backend/src/utils/logger.js
// ❌ 刪除原有的 logger 代碼

// ✅ 改為導出共享工具
export * from '../../../shared/backend-utils/logger.js';
export { default } from '../../../shared/backend-utils/logger.js';
```

### 管理後台（chat-app-admin）

```javascript
// chat-app-admin/backend/src/firebase/index.js
// ❌ 刪除原有的初始化代碼

// ✅ 改為導出共享工具
export * from '../../../shared/backend-utils/firebase.js';
```

```javascript
// chat-app-admin/backend/src/utils/logger.js
// ❌ 刪除原有的簡單 logger

// ✅ 改為導出共享工具
export * from '../../../shared/backend-utils/logger.js';
export { default } from '../../../shared/backend-utils/logger.js';
```

---

## ✅ 優點

1. **消除重複代碼**：~600 行重複代碼減少到 0
2. **統一安全性**：管理後台也獲得日誌脫敏功能
3. **降低維護成本**：Bug 修復只需一次
4. **提升一致性**：兩個應用使用相同的工具和配置

---

## 📋 依賴

這些工具需要以下依賴（已在主應用和管理後台安裝）：

```json
{
  "firebase-admin": "^12.0.0",
  "winston": "^3.11.0"
}
```

---

## 🔄 遷移檢查清單

- [x] 創建 `shared/backend-utils/` 目錄
- [x] 複製 `firebase.js`、`logger.js`、`sanitizer.js`
- [ ] 更新主應用的導入路徑
- [ ] 更新管理後台的導入路徑
- [ ] 刪除原有的重複文件
- [ ] 測試兩個應用功能正常
- [ ] 驗證日誌脫敏功能運作
- [ ] 提交代碼並更新文檔

---

## 🎯 未來擴展

可以考慮添加到此共享庫的其他工具：

- `config.js` - 統一配置管理（消除 167 處 `process.env` 直接訪問）
- `firestoreCache.js` - Firestore 緩存工具
- `r2Storage.js` - R2 存儲服務
- `validateEnv.js` - 環境變數驗證

---

**最後更新：** 2025-01-13
