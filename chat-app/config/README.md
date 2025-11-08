# 端口配置管理

## 概述

所有服務的端口配置統一在 [`config/ports.js`](./ports.js) 中定義，避免在多個文件中重複修改。

## 配置結構

```javascript
export const PORTS = {
  FRONTEND: 5173,              // Vite 前端開發服務器
  BACKEND: 4000,               // Express 後端 API
  EMULATOR_UI: 4001,           // Firebase Emulator 管理介面
  FIRESTORE_EMULATOR: 8180,    // Firestore Emulator
  AUTH_EMULATOR: 9099,         // Auth Emulator
  STORAGE_EMULATOR: 9299,      // Storage Emulator
};
```

## 使用方式

### 在 Node.js 腳本中使用

```javascript
import { PORTS, URLS } from '../config/ports.js';

console.log(`Frontend 運行在: ${URLS.FRONTEND}`);
const port = PORTS.BACKEND;
```

### 在服務代碼中使用

```javascript
// backend/src/firebase/storage.service.js
import { PORTS } from '../../../config/ports.js';

const storageUrl = `http://localhost:${PORTS.STORAGE_EMULATOR}`;
```

## 修改端口

### 步驟 1: 修改集中配置

編輯 [`config/ports.js`](./ports.js)，修改對應的端口值：

```javascript
export const PORTS = {
  STORAGE_EMULATOR: 9299,  // 修改這裡
};
```

### 步驟 2: 同步到其他配置文件

**必須手動同步**到以下文件（因為它們不能直接導入 JS 模組）：

#### 1. `firebase.json`
```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8180 },
    "storage": { "port": 9299 },
    "ui": { "port": 4001 }
  }
}
```

#### 2. `frontend/.env`
```env
VITE_EMULATOR_AUTH_PORT=9099
VITE_EMULATOR_FIRESTORE_PORT=8180
```

### 步驟 3: 驗證配置

運行驗證腳本確保所有配置一致：

```bash
npm run verify-config
```

輸出範例：
```
✓ Auth Emulator: 9099
✓ Firestore Emulator: 8180
✓ Storage Emulator: 9299
✓ Emulator UI: 4001
✓ VITE_EMULATOR_AUTH_PORT: 9099
✓ VITE_EMULATOR_FIRESTORE_PORT: 8180

✅ 所有配置一致！
```

## 自動使用集中配置的文件

以下文件已經自動從 `config/ports.js` 讀取配置：

- ✅ `scripts/dev-with-import.js` - 啟動腳本
- ✅ `backend/src/firebase/storage.service.js` - Storage 服務

## 需要手動同步的文件

以下文件需要手動修改（無法自動讀取 JS 配置）：

- ⚠️ `firebase.json` - Firebase Emulator 配置
- ⚠️ `frontend/.env` - 前端環境變數

**重要**：修改端口後，務必運行 `npm run verify-config` 檢查一致性！

## 故障排除

### 端口衝突

如果某個端口被佔用，可以：

1. 檢查哪個進程佔用端口：
   ```bash
   # Windows
   netstat -ano | findstr "端口號"

   # 終止進程
   taskkill /F /PID <PID>
   ```

2. 或者修改 `config/ports.js` 使用其他端口

### 配置不一致錯誤

如果 `npm run verify-config` 報錯：

```
✗ Auth Emulator: 9199 (應為 9099)
```

請手動修改對應的配置文件，使其與 `config/ports.js` 一致。
