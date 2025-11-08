# 管理後臺腳本

此目錄包含管理後臺的輔助腳本。

## 創建管理員帳號

### 使用方式

1. **確保 Firebase Emulator 正在運行**：
   ```bash
   # 在另一個終端
   cd ../../chat-app-3
   firebase emulators:start --project demo-project
   ```

2. **運行腳本創建管理員**：
   ```bash
   npm run create-admin
   ```

### 默認管理員帳號

腳本會創建以下測試帳號：

| 角色 | Email | 密碼 | 權限 |
|------|-------|------|------|
| 超級管理員 | mike666@admin.com | 12345678 | super_admin（完整權限） |
| 一般管理員 | admin@test.com | admin123 | admin（部分權限） |
| 內容審核員 | moderator@test.com | mod123 | moderator（僅審核權限） |

### 登入方式

1. 訪問管理後臺：http://localhost:5174
2. 點擊「使用 Google 登入」
3. 在 Firebase Auth Emulator 彈出視窗中：
   - 選擇「Sign in with email」
   - 輸入上述郵箱和密碼
   - 點擊「Sign in」

### 注意事項

- ⚠️ 此腳本僅用於開發環境（Firebase Emulator）
- ⚠️ 每次重啟 Emulator 後需要重新運行此腳本
- ⚠️ 生產環境請使用 Firebase Console 手動設置管理員權限

## 權限說明

### super_admin（超級管理員）
- ✅ 用戶管理
- ✅ 角色管理
- ✅ 對話監控
- ✅ 交易管理
- ✅ 系統設置
- ✅ 所有功能

### admin（一般管理員）
- ✅ 用戶管理
- ✅ 角色管理
- ✅ 對話監控
- ❌ 系統設置（部分功能受限）

### moderator（內容審核員）
- ❌ 用戶管理
- ❌ 角色管理
- ✅ 對話監控（僅查看和審核）
- ❌ 交易管理
- ❌ 系統設置
