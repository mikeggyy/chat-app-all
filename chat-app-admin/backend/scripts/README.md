# 管理後臺腳本工具

此目錄包含管理後臺的維護和管理腳本。

## 管理員權限管理

### 設置超級管理員權限

為用戶添加 `super_admin` 權限（完整管理權限，包括刪除用戶）。

```bash
cd chat-app-admin/backend
node scripts/set-super-admin.js <email或UID>
```

**示例**：
```bash
# 使用 Email 設置
node scripts/set-super-admin.js mike465@admin.com

# 使用 UID 設置
node scripts/set-super-admin.js 6FXftJp96WeXYqAO4vRYs52EFXN2
```

**重要提示**：
- 用戶需要重新登入才能獲取新的權限
- 或等待 Firebase Token 自動刷新（約 1 小時）
- 管理後臺請刷新頁面或重新登入

### 列出所有管理員

查看系統中所有具有管理員權限的用戶。

```bash
cd chat-app-admin/backend
node scripts/list-admins.js
```

## 權限說明

### 三種管理員角色

| 角色 | 權限等級 | 說明 | 可執行操作 |
|------|---------|------|-----------|
| **super_admin** | 最高 | 超級管理員 | 所有操作（包括刪除用戶、修改配置等） |
| **admin** | 中等 | 一般管理員 | 大部分管理操作（不包括刪除用戶） |
| **moderator** | 基礎 | 內容審核員 | 僅內容審核相關操作 |

## 常見問題

### 1. 刪除用戶時顯示 "403 權限不足"

**原因**：用戶沒有 `super_admin` 權限。

**解決方案**：
```bash
# 檢查當前管理員列表
node scripts/list-admins.js

# 為你的帳號設置 super_admin 權限
node scripts/set-super-admin.js your-email@example.com

# 重新登入管理後臺
```

### 2. CSRF Token 無效錯誤

**原因**：前端沒有正確處理 CSRF Token。

**解決方案**：
- 已在 `frontend/src/utils/api.js` 中修復
- 刷新頁面即可自動獲取新的 CSRF Token

## 用戶數據清理

### 清理遺留的用戶數據

當刪除用戶後發現 Firestore 中仍有遺留數據時使用。

```bash
cd chat-app-admin/backend
node scripts/cleanup-user-data.js <用戶UID>
```

**示例**：
```bash
# 清理單個用戶的遺留數據
node scripts/cleanup-user-data.js PS7LYFSstdgyr7b9sCOKFgt3QVB3
```

**會清理的集合**：
- users（用戶基本資料）
- conversations（對話記錄）
- user_photos（用戶照片 + 子集合）
- user_potions（用戶藥水 + 子集合）⚠️ 常見遺漏
- usage_limits（使用限制）
- transactions（交易記錄）⚠️ 常見遺漏
- orders（訂單記錄）
- generatedVideos（生成的影片）⚠️ 常見遺漏
- character_creation_flows（角色創建流程）
- idempotency_keys（冪等性鍵）

**詳細指南**: 請參閱 [CLEANUP_GUIDE.md](./CLEANUP_GUIDE.md)

### 3. CSRF Token 無效錯誤（已修復）

**原因**：前端沒有正確處理 CSRF Token。

**解決方案**：
- 已在 `frontend/src/utils/api.js` 中修復
- 刷新頁面即可自動獲取新的 CSRF Token
