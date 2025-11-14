# 用戶數據清理指南

## 問題背景

當使用管理後臺刪除用戶時，後端的刪除邏輯可能遺漏某些 Firestore 集合的清理，導致用戶刪除後仍有遺留數據。

### 已知遺漏的集合

| 集合名稱 | 說明 | 數據結構 |
|---------|------|---------|
| **user_potions** | 用戶藥水數據 | `user_potions/{userId}/potions/{potionId}` |
| **transactions** | 交易記錄 | `transactions/{transactionId}` (通過 `userId` 字段查詢) |
| **generatedVideos** | AI 生成的影片 | `generatedVideos/{videoId}` (通過 `userId` 字段查詢) |
| **orders** | 訂單記錄 | `orders/{orderId}` (通過 `userId` 字段查詢) |
| **character_creation_flows** | 角色創建流程 | `character_creation_flows/{flowId}` (通過 `userId` 字段查詢) |
| **idempotency_keys** | 冪等性鍵 | `idempotency_keys/{userId}:{key}` |

## 解決方案

### 方案 1：使用清理腳本（推薦）

針對已刪除但有遺留數據的用戶，使用專門的清理腳本：

```bash
cd chat-app-admin/backend
node scripts/cleanup-user-data.js <用戶UID>
```

**示例**：
```bash
node scripts/cleanup-user-data.js PS7LYFSstdgyr7b9sCOKFgt3QVB3
```

### 方案 2：批量清理（計劃中）

創建批量清理腳本，掃描所有已刪除用戶的遺留數據並清理。

## 使用場景

### 場景 1：清理單個用戶遺留數據

當發現某個用戶刪除後仍有遺留數據：

```bash
# 1. 在 Firestore Console 中確認遺留數據
# 2. 記錄用戶 UID
# 3. 執行清理腳本
node scripts/cleanup-user-data.js <用戶UID>
```

### 場景 2：驗證刪除操作

在管理後臺刪除用戶後，驗證是否有遺留數據：

```bash
# 1. 通過管理後臺刪除用戶
# 2. 在 Firestore Console 中搜索該用戶的 UID
# 3. 如果發現遺留數據，執行清理腳本
node scripts/cleanup-user-data.js <用戶UID>
```

## 清理腳本說明

### cleanup-user-data.js

**功能**: 清理指定用戶在 Firestore 中的所有數據（不包括 Firebase Auth）

**檢查的集合**:
1. users（用戶基本資料）
2. conversations（對話記錄）
3. user_photos（用戶照片 + 子集合）
4. user_potions（用戶藥水 + 子集合）
5. usage_limits（使用限制）
6. transactions（交易記錄）
7. orders（訂單記錄）
8. generatedVideos（生成的影片）
9. character_creation_flows（角色創建流程）
10. idempotency_keys（冪等性鍵）

**輸出示例**:
```
========================================
開始清理用戶數據: PS7LYFSstdgyr7b9sCOKFgt3QVB3
========================================

1️⃣  檢查 users 集合...
   ⚠️  users/PS7LYFSstdgyr7b9sCOKFgt3QVB3 不存在

2️⃣  檢查 conversations 集合...
   ℹ️  沒有對話記錄

3️⃣  檢查 user_photos 集合...
   ℹ️  沒有照片記錄

4️⃣  檢查 user_potions 集合...
   ✅ 已刪除 2 個藥水記錄

...

刪除統計:
  - users: 0
  - conversations: 0
  - user_photos: 0
  - user_potions: 2
  - usage_limits: 0
  - transactions: 137
  - orders: 0
  - generatedVideos: 6
  - character_creation_flows: 0
  - idempotency_keys: 0

  📊 總計刪除: 145 筆記錄
```

## 預防措施

### 更新後端刪除邏輯

後端刪除路由應該包含所有集合的清理邏輯（計劃中）：

```javascript
// chat-app-admin/backend/src/routes/users.routes.js
// DELETE /api/users/:userId

// ✅ 應該包含以下清理邏輯：
// 1. conversations
// 2. user_photos
// 3. user_potions ⚠️ 新增
// 4. usage_limits
// 5. transactions ⚠️ 新增
// 6. orders ⚠️ 新增
// 7. generatedVideos ⚠️ 新增
// 8. character_creation_flows ⚠️ 新增
// 9. idempotency_keys ⚠️ 新增
// 10. users
// 11. Firebase Auth
```

### 定期檢查

建議定期檢查是否有遺留數據：

```bash
# 列出所有 Firebase Auth 中不存在但 Firestore 中存在的用戶（計劃中）
node scripts/find-orphaned-data.js
```

## 常見問題

### Q1: 為什麼會有遺留數據？

**原因**: 後端刪除邏輯不完整，遺漏了某些 Firestore 集合的清理。

**解決**: 使用清理腳本手動清理，並計劃更新後端邏輯。

### Q2: 清理腳本會刪除 Firebase Auth 用戶嗎？

**不會**。清理腳本只清理 Firestore 數據，不會刪除 Firebase Auth 用戶。

### Q3: 清理腳本是否安全？

**安全性**:
- ✅ 只刪除 Firestore 數據，不影響 Firebase Auth
- ✅ 刪除前會檢查數據是否存在
- ✅ 每個集合單獨處理，失敗不會中斷整個流程
- ⚠️ 刪除操作不可逆，請確認用戶 UID 正確

### Q4: 可以批量清理多個用戶嗎？

**目前不支援**。但可以編寫循環腳本：

```bash
# 創建用戶列表文件 users.txt
# 每行一個 UID

# 批量清理（Bash）
while read userId; do
  node scripts/cleanup-user-data.js "$userId"
done < users.txt
```

### Q5: 如何確認清理是否成功？

在 Firestore Console 中搜索用戶 UID：
1. 打開 [Firebase Console](https://console.firebase.google.com)
2. 選擇專案 `chat-app-3-8a7ee`
3. 進入 Firestore Database
4. 使用搜索功能搜索用戶 UID
5. 確認沒有任何結果

## 相關腳本

- **cleanup-user-data.js** - 清理單個用戶的所有 Firestore 數據
- **set-super-admin.js** - 設置超級管理員權限
- **list-admins.js** - 列出所有管理員

## 相關文檔

- [管理後臺完整文檔](../../README.md)
- [Firestore 集合結構](../../../../chat-app/docs/firestore-collections.md)
- [腳本工具說明](./README.md)
