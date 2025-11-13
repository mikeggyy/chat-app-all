# 快速測試指南

## 🚀 快速開始（最簡單的方式）

### 方法 1：雙擊運行批處理文件

1. **確保後端服務正在運行**
   - 打開一個終端運行：`npm run dev`

2. **雙擊運行測試腳本**
   - Windows 批處理版：雙擊 `run-quick-test.bat`
   - PowerShell 版：右鍵 `run-quick-test.ps1` → "使用 PowerShell 運行"

3. **查看測試結果**
   - 測試會自動執行並顯示結果

---

### 方法 2：手動運行（如需自定義）

```bash
# 1. 設置 Token（在 PowerShell 中）
$env:ADMIN_TOKEN="your-token-here"

# 2. 運行測試
node scripts/test-rate-limiter.js quick
```

---

## 📊 預期結果

成功的測試結果應該顯示：

```
✓ GET /api/users/:userId: 已應用速率限制器
  X-RateLimit-Limit: 200
  X-RateLimit-Remaining: 199

✓ PATCH /api/users/:userId/usage-limits: 已應用速率限制器
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 99

✓ GET /api/users/:userId/potions/details: 已應用速率限制器
  X-RateLimit-Limit: 200
  X-RateLimit-Remaining: 199

✓ GET /api/users/:userId/potion-effects: 已應用速率限制器
  X-RateLimit-Limit: 200
  X-RateLimit-Remaining: 199

✓ GET /api/users/:userId/resource-limits: 已應用速率限制器
  X-RateLimit-Limit: 200
  X-RateLimit-Remaining: 199

快速測試結果
  通過: 5/5

✓ 所有端點都已正確應用速率限制器
```

---

## 🔧 故障排除

### 問題：Token 過期

如果看到 401 錯誤，說明 Token 已過期（1小時有效期）。

**解決方法**：
1. 訪問管理後台：http://localhost:5174
2. 登入管理員帳號
3. F12 → Network 標籤
4. 刷新頁面
5. 找到任意 API 請求，複製新的 Token
6. 更新 `run-quick-test.bat` 或 `run-quick-test.ps1` 中的 Token

### 問題：後端服務未運行

**錯誤信息**：Connection refused 或 ECONNREFUSED

**解決方法**：
```bash
# 在另一個終端啟動後端
cd chat-app-admin/backend
npm run dev
```

### 問題：端口被占用

**錯誤信息**：Port 4001 is already in use

**解決方法**：
```powershell
# 查找占用端口的進程
netstat -ano | findstr :4001

# 終止進程
taskkill /F /PID <PID>
```

---

## 📝 測試文件說明

- **`run-quick-test.bat`** - Windows 批處理版本（雙擊即可運行）
- **`run-quick-test.ps1`** - PowerShell 版本（更好的顏色輸出）
- **`scripts/test-rate-limiter.js`** - 完整測試腳本
- **`TEST_README.md`** - 本文件（測試指南）

---

## 🎯 其他測試選項

### 完整測試（會觸發速率限制）

```bash
node scripts/test-rate-limiter.js full
```

這會發送大量請求直到觸發速率限制，用於驗證限制是否真的有效。

⚠️ 警告：會消耗速率限制配額，觸發後需等待 15 分鐘重置。

---

## 📖 更多信息

詳細的測試指南請參閱：
- **[TESTING_GUIDE.md](../TESTING_GUIDE.md)** - 完整測試指南
- **[TEST_VERIFICATION_SUMMARY.md](../TEST_VERIFICATION_SUMMARY.md)** - 測試資源摘要

---

**最後更新**：2025-01-13
