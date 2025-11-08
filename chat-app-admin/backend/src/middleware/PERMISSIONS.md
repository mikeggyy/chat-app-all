# 管理員權限系統使用指南

## 角色層級

1. **super_admin** (最高權限)
   - 完整的系統控制權
   - 可以刪除用戶
   - 可以修改所有配置
   - 可以賦予其他用戶管理員權限

2. **admin** (中等權限)
   - 可以查看和修改用戶資料
   - 可以修改資產和會員等級
   - 可以查看統計數據
   - 不能刪除用戶
   - 不能修改權限

3. **moderator** (基本權限)
   - 可以查看對話記錄
   - 可以進行內容審核
   - 不能修改用戶資料
   - 不能修改系統配置

## 使用方式

### 1. 導入權限檢查中間件

```javascript
import { requireRole, requireMinRole } from "../middleware/admin.middleware.js";
```

### 2. 使用 `requireRole()` - 指定允許的角色

適用場景：某個操作只允許特定角色執行

```javascript
// 僅 super_admin 可以刪除用戶
router.delete("/:userId", requireRole("super_admin"), async (req, res) => {
  // 刪除用戶邏輯
});

// super_admin 和 admin 都可以修改用戶資料
router.put("/:userId", requireRole("super_admin", "admin"), async (req, res) => {
  // 修改用戶資料
});

// 所有管理員角色都可以查看對話
router.get("/conversations", requireRole("super_admin", "admin", "moderator"), async (req, res) => {
  // 查看對話
});
```

### 3. 使用 `requireMinRole()` - 要求最低權限等級

適用場景：需要一定等級以上的管理員才能執行

```javascript
// 至少需要 admin 權限（admin 和 super_admin 都可以）
router.put("/config", requireMinRole("admin"), async (req, res) => {
  // 修改配置
});

// 至少需要 moderator 權限（所有管理員都可以）
router.get("/reports", requireMinRole("moderator"), async (req, res) => {
  // 查看報告
});
```

## 權限建議

### 危險操作（僅 super_admin）

- ❌ 刪除用戶
- ❌ 刪除對話記錄
- ❌ 修改權限設置
- ❌ 修改系統配置
- ❌ 批量操作

```javascript
router.delete("/:userId", requireRole("super_admin"), deleteUser);
router.post("/bulk-delete", requireRole("super_admin"), bulkDelete);
```

### 高風險操作（super_admin + admin）

- ⚠️ 修改用戶資產
- ⚠️ 修改會員等級
- ⚠️ 手動添加金幣/禮物
- ⚠️ 修改用戶資料

```javascript
router.put("/:userId/assets", requireMinRole("admin"), updateAssets);
router.put("/:userId/membership", requireMinRole("admin"), updateMembership);
```

### 一般操作（所有管理員）

- ✅ 查看用戶列表
- ✅ 查看對話記錄
- ✅ 查看統計數據
- ✅ 內容審核

```javascript
router.get("/users", requireMinRole("moderator"), getUsers);
router.get("/conversations", requireMinRole("moderator"), getConversations);
```

## 錯誤響應

當用戶權限不足時，API 會返回：

```json
{
  "error": "權限不足",
  "message": "此操作需要以下角色之一: super_admin",
  "currentRole": "admin",
  "requiredRoles": ["super_admin"]
}
```

## 在現有路由中應用

### 步驟 1：導入中間件

```javascript
import { requireRole, requireMinRole } from "../middleware/admin.middleware.js";
```

### 步驟 2：為每個端點添加權限檢查

```javascript
// 之前（無權限檢查）
router.delete("/:userId", async (req, res) => { ... });

// 之後（添加權限檢查）
router.delete("/:userId", requireRole("super_admin"), async (req, res) => { ... });
```

### 步驟 3：在註釋中標註權限要求

```javascript
/**
 * DELETE /api/users/:userId
 * 刪除用戶（同時刪除 Auth 和 Firestore 數據）
 * 🔒 權限：僅限 super_admin
 */
router.delete("/:userId", requireRole("super_admin"), async (req, res) => {
  // ...
});
```

## 測試權限

### 設置測試管理員

使用 Firebase Admin SDK 設置自定義聲明：

```javascript
// 設置為 super_admin
await admin.auth().setCustomUserClaims(userId, {
  super_admin: true
});

// 設置為 admin
await admin.auth().setCustomUserClaims(userId, {
  admin: true
});

// 設置為 moderator
await admin.auth().setCustomUserClaims(userId, {
  moderator: true
});
```

### 測試權限檢查

1. 使用不同角色的帳號登入
2. 嘗試訪問受保護的端點
3. 驗證是否正確返回 403 錯誤

## 待辦事項

以下是需要添加權限檢查的路由（優先級排序）：

### 高優先級（已完成）

- [x] `DELETE /api/users/:userId` - requireRole("super_admin")

### 中優先級（建議完成）

- [ ] `PUT /api/users/:userId/membership` - requireMinRole("admin")
- [ ] `PUT /api/users/:userId/assets` - requireMinRole("admin")
- [ ] `POST /api/users/:userId/potions` - requireMinRole("admin")
- [ ] `POST /api/characters` - requireMinRole("admin")
- [ ] `DELETE /api/characters/:id` - requireRole("super_admin")

### 低優先級（可選）

- [ ] `GET /api/users` - requireMinRole("moderator")
- [ ] `GET /api/conversations` - requireMinRole("moderator")
- [ ] `GET /api/stats` - requireMinRole("moderator")

## 前端集成

前端應該根據用戶的角色顯示或隱藏對應的操作按鈕：

```javascript
// 在 Pinia store 中
const adminStore = useAdminStore();
const canDeleteUser = computed(() => adminStore.adminRole === 'super_admin');
const canEditUser = computed(() => ['super_admin', 'admin'].includes(adminStore.adminRole));
const canView = computed(() => ['super_admin', 'admin', 'moderator'].includes(adminStore.adminRole));

// 在模板中
<el-button
  v-if="canDeleteUser"
  type="danger"
  @click="deleteUser"
>
  刪除用戶
</el-button>
```

## 審計日誌（建議實施）

對於敏感操作，建議添加審計日誌：

```javascript
router.delete("/:userId", requireRole("super_admin"), async (req, res) => {
  const { userId } = req.params;
  const adminId = req.user.uid;
  const adminRole = req.adminRole;

  // 記錄審計日誌
  await db.collection("admin_logs").add({
    action: "delete_user",
    targetUserId: userId,
    adminId,
    adminRole,
    timestamp: new Date().toISOString(),
    ip: req.ip,
  });

  // 執行刪除操作
  // ...
});
```
