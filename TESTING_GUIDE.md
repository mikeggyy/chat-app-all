# loveStory 專案測試指南

**版本**: v1.0
**日期**: 2025-11-05
**目的**: 驗證所有安全修復和功能改進

---

## 🎯 測試目標

驗證以下修復是否正常工作：
- ✅ 環境變數驗證系統
- ✅ API 身份驗證
- ✅ 金幣盜竊漏洞修復
- ✅ 管理員權限系統
- ✅ Firebase Emulator 連接

---

## 🚀 快速開始

### 前置準備

1. **確保 Firebase Emulator 正在運行**
   ```bash
   cd d:/project/loveStory/chat-app
   firebase emulators:start
   ```
   保持此終端開啟。

2. **確認環境變數已設置**
   ```bash
   # 檢查主應用前端
   cat chat-app/frontend/.env

   # 檢查主應用後端
   cat chat-app/backend/.env
   ```

   如果不存在，從 `.env.example` 複製並填入真實配置。

---

## 📋 測試清單

### 階段 1：環境變數驗證（預計 5 分鐘）

#### 測試 1.1：正常啟動（所有環境變數正確）

```bash
cd d:/project/loveStory/chat-app/backend
npm run dev
```

**期望輸出**:
```
🔍 驗證環境變數配置...
環境: 開發環境
Firebase Emulator: 啟用
✅ 環境變數驗證通過

📋 環境變數配置摘要:
   NODE_ENV: development
   PORT: 4000
   USE_FIREBASE_EMULATOR: true
   FIREBASE_ADMIN_PROJECT_ID: chat-app-3-8a7ee
   OPENAI_API_KEY: sk-...
   GOOGLE_AI_API_KEY: AIza...

Server listening on port 4000
```

**驗證**:
- [ ] 看到 ✅ 環境變數驗證通過
- [ ] 伺服器成功啟動在 4000 端口
- [ ] 沒有錯誤訊息

---

#### 測試 1.2：缺少環境變數（測試驗證功能）

**步驟**:
1. 備份當前 `.env` 文件
   ```bash
   cp chat-app/backend/.env chat-app/backend/.env.backup
   ```

2. 移除 OPENAI_API_KEY
   ```bash
   # 在 .env 中註釋掉 OPENAI_API_KEY
   # OPENAI_API_KEY=sk-...
   ```

3. 重新啟動
   ```bash
   npm run dev
   ```

**期望輸出**:
```
🔍 驗證環境變數配置...
❌ 缺少必要的環境變數: OPENAI_API_KEY
❌ 環境變數驗證失敗
應用程式無法啟動，請修正環境變數配置
```

**驗證**:
- [ ] 應用拒絕啟動
- [ ] 清楚地指出缺少哪個變數
- [ ] 提供修復建議

**恢復**:
```bash
mv chat-app/backend/.env.backup chat-app/backend/.env
```

---

### 階段 2：API 身份驗證測試（預計 10 分鐘）

#### 測試 2.1：未授權訪問被阻擋

**測試用戶 API**:
```bash
# 嘗試不帶 token 訪問用戶列表
curl http://localhost:4000/api/users

# 期望: 401 Unauthorized
```

**期望響應**:
```json
{
  "message": "缺少 Authorization Bearer 權杖"
}
```

**驗證**:
- [ ] 返回 401 狀態碼
- [ ] 明確的錯誤訊息

---

**測試對話 API**:
```bash
# 嘗試不帶 token 訪問對話記錄
curl http://localhost:4000/api/conversations/test-user/char-001

# 期望: 401 Unauthorized
```

**驗證**:
- [ ] 返回 401 狀態碼
- [ ] 無法訪問對話記錄

---

#### 測試 2.2：生產環境測試帳號被禁用

**步驟**:
1. 設置為生產環境
   ```bash
   # 在 .env 中添加
   NODE_ENV=production
   ```

2. 嘗試使用測試 token
   ```bash
   curl -H "Authorization: Bearer test-token" \
        http://localhost:4000/api/users
   ```

**期望響應**:
```json
{
  "message": "測試帳號在生產環境已停用",
  "code": "auth/test-disabled-in-production"
}
```

**驗證**:
- [ ] 測試帳號被拒絕
- [ ] 返回適當的錯誤代碼

**恢復**:
```bash
# 在 .env 中移除或註釋
# NODE_ENV=development
```

---

### 階段 3：金幣盜竊漏洞修復驗證（預計 5 分鐘）

#### 測試 3.1：無法偽造 userId

**舊版本行為（已修復）**:
```bash
# ❌ 舊版本允許這樣做（已修復）
curl -X POST http://localhost:4000/api/gifts/send \
  -H "Authorization: Bearer valid-token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "other-user-id",
    "characterId": "char-001",
    "giftId": "rose"
  }'
```

**新版本行為**:
```bash
# ✅ 新版本自動從 token 獲取 userId
curl -X POST http://localhost:4000/api/gifts/send \
  -H "Authorization: Bearer valid-token" \
  -H "Content-Type: application/json" \
  -d '{
    "characterId": "char-001",
    "giftId": "rose"
  }'
```

**驗證**:
- [ ] userId 不再從請求體讀取
- [ ] 自動使用認證用戶的 ID
- [ ] 無法送禮給其他用戶消耗他們的金幣

**檢查代碼**:
```javascript
// 查看 gift.routes.js
// 應該看到：
const userId = req.firebaseUser.uid;
```

---

### 階段 4：管理後臺權限系統測試（預計 15 分鐘）

#### 準備：啟動管理後臺

```bash
cd d:/project/loveStory/chat-app-admin/backend
npm run dev
```

**期望**: 成功啟動在 4001 端口

---

#### 測試 4.1：moderator 權限限制

**測試刪除用戶（應被拒絕）**:
```bash
# 假設你有一個 moderator 的 token
curl -X DELETE http://localhost:4001/api/users/test-user-id \
  -H "Authorization: Bearer moderator-token"
```

**期望響應**:
```json
{
  "error": "權限不足",
  "message": "此操作需要以下角色之一: super_admin",
  "currentRole": "moderator",
  "requiredRoles": ["super_admin"]
}
```

**驗證**:
- [ ] 返回 403 Forbidden
- [ ] 清楚說明所需權限
- [ ] moderator 無法刪除用戶

---

#### 測試 4.2：admin 可以修改資料

**測試修改用戶資料（應成功）**:
```bash
# 假設你有一個 admin 的 token
curl -X PATCH http://localhost:4001/api/users/test-user-id \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "測試用戶",
    "coins": 1000
  }'
```

**期望**: 200 OK，成功更新

**驗證**:
- [ ] admin 可以修改用戶資料
- [ ] 返回更新後的用戶數據

---

#### 測試 4.3：所有管理員可以查看角色

**測試查看角色列表**:
```bash
# moderator, admin, super_admin 都應該可以
curl http://localhost:4001/api/characters \
  -H "Authorization: Bearer any-admin-token"
```

**期望**: 200 OK，返回角色列表

**驗證**:
- [ ] 所有管理員角色都可以訪問
- [ ] 返回完整的角色列表

---

#### 測試 4.4：admin 可以修改角色

**測試修改角色資訊**:
```bash
curl -X PATCH http://localhost:4001/api/characters/char-001 \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "更新的角色名稱",
    "status": "active"
  }'
```

**期望**: 200 OK，成功更新

**驗證**:
- [ ] admin 可以修改角色
- [ ] moderator 無法修改（返回 403）

---

### 階段 5：Firebase Emulator 連接測試（預計 5 分鐘）

#### 測試 5.1：Firestore 端口正確

**檢查配置一致性**:
```bash
# 檢查 config/ports.js
grep FIRESTORE_EMULATOR d:/project/loveStory/chat-app/config/ports.js

# 應該顯示: FIRESTORE_EMULATOR: 8080
```

**檢查 Firebase Emulator**:
訪問 http://localhost:4001（Emulator UI）

**驗證**:
- [ ] Firestore Emulator 在 8080 端口
- [ ] 配置文件一致（ports.js, firebase.json, .env.example）
- [ ] Emulator UI 可以訪問

---

#### 測試 5.2：應用正確連接 Emulator

**啟動主應用前端**:
```bash
cd d:/project/loveStory/chat-app/frontend
npm run dev
```

**在瀏覽器中**:
1. 訪問 http://localhost:5173
2. 打開開發者工具 Console
3. 檢查是否有 Emulator 連接訊息

**期望看到**:
```
Connected to Firestore Emulator at localhost:8080
Connected to Auth Emulator at localhost:9099
```

**驗證**:
- [ ] 前端連接到 Emulator
- [ ] 沒有連接到生產環境 Firebase
- [ ] 資料讀寫正常

---

### 階段 6：Firestore Rules 驗證（預計 5 分鐘）

#### 測試 6.1：檢查 Rules 已更新

**查看 firestore.rules**:
```bash
cat d:/project/loveStory/chat-app/firestore.rules | grep -A 5 "document=\*\*"
```

**期望**:
```javascript
// match /{document=**} {
//   allow read, write: if request.time < timestamp.date(2099, 1, 1);
// }
```

**驗證**:
- [ ] 寬鬆規則已被註釋
- [ ] 有警告說明

---

#### 測試 6.2：部署 Rules（生產環境前必做）

```bash
cd d:/project/loveStory/chat-app
firebase deploy --only firestore:rules --project chat-app-3-8a7ee
```

**期望**: 成功部署

**驗證**:
- [ ] Rules 部署成功
- [ ] Firebase Console 顯示更新的 Rules

---

## ✅ 測試完成檢查表

### 環境驗證
- [ ] 環境變數驗證通過
- [ ] 缺少變數時正確拒絕啟動

### 安全性
- [ ] 未授權訪問被阻擋
- [ ] 生產環境測試帳號被禁用
- [ ] 金幣盜竊漏洞已修復
- [ ] Firestore Rules 已更新

### 權限系統
- [ ] moderator 權限正確限制
- [ ] admin 可以執行授權操作
- [ ] super_admin 有完整權限
- [ ] 權限錯誤訊息清楚明確

### 配置
- [ ] Firebase Emulator 端口一致（8080）
- [ ] 應用正確連接 Emulator
- [ ] 所有配置文件同步

### 依賴
- [ ] Express 4.x 安裝成功
- [ ] Firebase SDK 版本統一
- [ ] 所有依賴正常運行

---

## 🐛 常見問題

### 問題 1：npm install 失敗

**解決方案**:
```bash
# 清除緩存
npm cache clean --force

# 刪除 node_modules
rm -rf node_modules package-lock.json

# 重新安裝
npm install
```

---

### 問題 2：Emulator 無法連接

**檢查**:
1. Firebase Emulator 是否正在運行
2. 端口是否被佔用
3. `.env` 中 `USE_FIREBASE_EMULATOR=true`

**解決方案**:
```bash
# 檢查端口佔用
netstat -ano | findstr :8080
netstat -ano | findstr :9099

# 重啟 Emulator
firebase emulators:start
```

---

### 問題 3：環境變數驗證失敗

**檢查**:
```bash
# 確保 .env 文件存在
ls -la chat-app/backend/.env

# 檢查內容
cat chat-app/backend/.env
```

**解決方案**:
```bash
# 從範例複製
cp chat-app/backend/.env.example chat-app/backend/.env

# 填入真實配置
nano chat-app/backend/.env
```

---

### 問題 4：權限測試需要真實 token

**獲取管理員 token**:
```bash
# 使用 create-admin-user 腳本
cd chat-app-admin/backend
npm run create-admin

# 或使用 Firebase Admin SDK
# 參考 scripts/create-admin-user.js
```

---

## 📊 測試報告模板

完成所有測試後，填寫此報告：

```
# 測試報告

日期: [填入日期]
測試人員: [你的名字]

## 測試結果摘要

✅ 通過: __/24
❌ 失敗: __/24
⏸️ 跳過: __/24

## 詳細結果

### 環境驗證
- [ ] 測試 1.1: 正常啟動
- [ ] 測試 1.2: 缺少環境變數

### API 身份驗證
- [ ] 測試 2.1: 未授權訪問被阻擋
- [ ] 測試 2.2: 生產環境測試帳號被禁用

### 金幣系統
- [ ] 測試 3.1: 無法偽造 userId

### 管理後臺
- [ ] 測試 4.1: moderator 權限限制
- [ ] 測試 4.2: admin 可以修改資料
- [ ] 測試 4.3: 所有管理員可以查看角色
- [ ] 測試 4.4: admin 可以修改角色

### Emulator
- [ ] 測試 5.1: Firestore 端口正確
- [ ] 測試 5.2: 應用正確連接 Emulator

### Firestore Rules
- [ ] 測試 6.1: Rules 已更新
- [ ] 測試 6.2: Rules 部署成功

## 問題記錄

[記錄測試中發現的任何問題]

## 建議

[記錄改進建議]
```

---

## 🎯 下一步行動

測試完成後：

1. **修復發現的問題**
2. **更新文檔**（如有需要）
3. **通知團隊**測試結果
4. **計劃部署**到生產環境

---

**祝測試順利！** 🚀

如有問題，請參考：
- [FIXES_COMPLETED.md](FIXES_COMPLETED.md) - 修復詳情
- [PERMISSIONS.md](chat-app-admin/backend/src/middleware/PERMISSIONS.md) - 權限系統指南
