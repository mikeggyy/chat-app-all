# 管理後台測試驗證指南

本指南說明如何測試最近的優化修復（速率限制器、useVariableEditor 邊界情況處理）。

---

## 📋 測試內容概覽

### ✅ 已修復的內容

1. **速率限制器覆蓋完整性**
   - 為 5 個缺少的端點添加了速率限制器
   - 現在 18/18 個端點都已受保護

2. **useVariableEditor 邊界情況處理**
   - 添加了 null/undefined 檢查
   - 添加了錯誤處理和 try-catch
   - 修復了段落換行邏輯

3. **skipFailedRequests 配置文檔化**
   - 添加了詳細的設計說明
   - 解釋了安全考慮

---

## 🧪 測試 1：速率限制器驗證

### 方法 A：快速測試（推薦）

快速檢查速率限制器是否已應用到端點。

#### 步驟：

1. **啟動後端服務**
   ```bash
   cd chat-app-admin/backend
   npm run dev
   ```

2. **獲取管理員 Token**

   有兩種方法：

   **方法 1：使用 Firebase Console**
   - 訪問 https://console.firebase.google.com
   - 選擇專案 `chat-app-3-8a7ee`
   - 進入 Authentication
   - 找到管理員帳號，點擊查看詳情
   - 使用開發者工具或 Firebase SDK 獲取 ID Token

   **方法 2：使用前端登入**
   - 訪問管理後台前端：http://localhost:5174
   - 登入管理員帳號
   - 打開瀏覽器開發者工具 → Console
   - 運行：
     ```javascript
     import('firebase/auth').then(m => {
       firebase.auth().currentUser.getIdToken().then(token => {
         console.log('Token:', token);
       });
     });
     ```

3. **設置環境變數**
   ```bash
   # Linux/Mac
   export ADMIN_TOKEN="your-firebase-auth-token"

   # Windows (PowerShell)
   $env:ADMIN_TOKEN="your-firebase-auth-token"

   # 或者在 backend/.env 中添加
   echo "ADMIN_TOKEN=your-firebase-auth-token" >> .env
   ```

4. **運行快速測試**
   ```bash
   cd chat-app-admin/backend
   node scripts/test-rate-limiter.js quick
   ```

#### 預期結果：

```
═══════════════════════════════════════
快速測試：驗證速率限制器已應用
═══════════════════════════════════════

✓ GET /api/users/test-user-id: 已應用速率限制器
  X-RateLimit-Limit: 200
  X-RateLimit-Remaining: 199

✓ PATCH /api/users/test-user-id/usage-limits: 已應用速率限制器
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 99

✓ GET /api/users/test-user-id/potions/details: 已應用速率限制器
  X-RateLimit-Limit: 200
  X-RateLimit-Remaining: 199

✓ GET /api/users/test-user-id/potion-effects: 已應用速率限制器
  X-RateLimit-Limit: 200
  X-RateLimit-Remaining: 199

✓ GET /api/users/test-user-id/resource-limits: 已應用速率限制器
  X-RateLimit-Limit: 200
  X-RateLimit-Remaining: 199

快速測試結果
  通過: 5/5

✓ 所有端點都已正確應用速率限制器
```

---

### 方法 B：完整測試（可選）

完整測試會發送大量請求直到觸發速率限制，用於驗證限制是否真的有效。

⚠️ **警告**：這會消耗速率限制配額，觸發後需要等待 15 分鐘重置。

#### 步驟：

```bash
cd chat-app-admin/backend
node scripts/test-rate-limiter.js full
```

#### 預期結果：

每個端點都會顯示：
- 成功的請求數量
- 觸發速率限制的狀態（429 錯誤）
- 速率限制頭信息

---

### 方法 C：手動測試（使用 Postman/curl）

1. **獲取 Token**（同上）

2. **使用 curl 測試**
   ```bash
   # 測試 GET /api/users/:userId
   curl -X GET \
     http://localhost:4001/api/users/test-user-id \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -v

   # 查看響應頭
   # X-RateLimit-Limit: 200
   # X-RateLimit-Remaining: 199
   ```

3. **快速重複請求（觸發限制）**
   ```bash
   # 循環發送請求
   for i in {1..201}; do
     curl -X GET \
       http://localhost:4001/api/users/test-user-id \
       -H "Authorization: Bearer YOUR_TOKEN" \
       -w "\n%{http_code}\n" \
       -s
     sleep 0.1
   done
   ```

   預期結果：前 200 個請求成功（200），第 201 個請求被限制（429）

---

## 🧪 測試 2：useVariableEditor 邊界情況

### 方法 A：自動測試（推薦）

#### 步驟：

1. **在 Node.js 中運行測試**
   ```bash
   cd chat-app-admin/frontend
   node src/composables/useVariableEditor.test.js
   ```

#### 預期結果：

```
╔═══════════════════════════════════════════════╗
║  useVariableEditor 邊界情況測試套件          ║
╚═══════════════════════════════════════════════╝

=== 測試 textToEditorContent 邊界情況 ===

✓ 空文本應返回空段落
✓ null 文本應返回空段落
✓ undefined 文本應返回空段落
✓ variables 為 null 時應將變數視為普通文本
✓ variables 為 undefined 時應將變數視為普通文本
✓ variables 數組中的 null/undefined 應被過濾
✓ 缺少 name 的對象應被過濾
✓ 有效變數應正確解析
✓ 不在列表中的變數應視為普通文本
✓ 多個變數應正確解析

=== 測試 editorContentToText 邊界情況 ===

✓ null editor 應返回空字符串
✓ undefined editor 應返回空字符串
✓ getJSON() 拋出異常時應返回空字符串
✓ 正常內容應正確轉換
✓ 缺少 attrs 的 variable 應返回空字符串
✓ attrs 為 null 的 variable 應返回空字符串
✓ 缺少 text 屬性的 text 節點應返回空字符串
✓ 多段落應正確添加換行符
✓ 空段落應返回空字符串
✓ 嵌套內容應正確處理

╔═══════════════════════════════════════════════╗
║              測試報告                         ║
╚═══════════════════════════════════════════════╝

總測試數: 20
✓ 通過: 20
✗ 失敗: 0
通過率: 100%

✓ 所有測試通過！邊界情況處理正確。
```

---

### 方法 B：手動測試（瀏覽器）

#### 步驟：

1. **啟動前端開發服務器**
   ```bash
   cd chat-app-admin/frontend
   npm run dev
   ```

2. **訪問任意頁面**
   - 打開 http://localhost:5174

3. **打開瀏覽器控制台**
   - 按 F12 或右鍵 → 檢查

4. **導入測試文件**
   ```javascript
   // 在控制台中執行
   import('/src/composables/useVariableEditor.test.js')
     .then(module => {
       module.runAllTests();
     });
   ```

   或者直接訪問測試文件 URL：
   ```
   http://localhost:5174/src/composables/useVariableEditor.test.js
   ```

---

### 方法 C：實際使用測試（推薦）

測試實際使用場景中的邊界情況：

#### 步驟：

1. **訪問 AI Settings 頁面**
   - http://localhost:5174/ai-settings

2. **測試以下場景**：

   **場景 1：空輸入**
   - 清空所有編輯器內容
   - 保存
   - ✅ 應該成功保存，不會崩潰

   **場景 2：無效變數**
   - 輸入：`Hello {invalid_variable}`
   - 保存
   - ✅ 應該作為普通文本保存

   **場景 3：混合內容**
   - 輸入：`Hello {userName}, you have {coins} coins`
   - 點擊變數按鈕插入有效變數
   - ✅ 應該正確插入變數節點

   **場景 4：多段落**
   - 輸入多行內容（按 Enter 鍵創建新段落）
   - 保存並重新加載頁面
   - ✅ 應該保留換行符

3. **檢查控制台**
   - ✅ 應該沒有錯誤
   - ✅ 如果有錯誤，應該有 `[useVariableEditor]` 前綴的錯誤日誌

---

## 🧪 測試 3：前端 429 錯誤處理

驗證前端是否正確處理速率限制錯誤。

### 步驟：

1. **觸發速率限制**

   使用上面的「方法 B：完整測試」或「方法 C：手動測試」觸發速率限制

2. **檢查前端反應**

   **方法 1：在管理後台中觸發**
   - 訪問 http://localhost:5174/users
   - 快速點擊「刷新」按鈕超過 200 次（可以寫個腳本）
   - ✅ 應該顯示錯誤提示：「查詢操作過於頻繁，請稍後再試」

   **方法 2：使用瀏覽器開發者工具**
   ```javascript
   // 在控制台中執行
   const token = 'YOUR_ADMIN_TOKEN';

   // 快速發送 201 個請求
   for (let i = 0; i < 201; i++) {
     fetch('http://localhost:4001/api/users/test-user-id', {
       headers: {
         'Authorization': `Bearer ${token}`,
       },
     })
     .then(res => {
       if (res.status === 429) {
         return res.json().then(data => {
           console.log('✓ 速率限制觸發：', data);
           // 應該看到 Element Plus 的錯誤提示
         });
       }
     });
   }
   ```

3. **驗證錯誤消息**
   - ✅ 應該顯示 Element Plus 的錯誤提示（紅色通知）
   - ✅ 錯誤消息應該是中文且易於理解
   - ✅ 不應該導致頁面崩潰或白屏

---

## 📊 測試結果記錄

### 測試檢查清單

- [ ] **速率限制器測試**
  - [ ] 快速測試通過（5/5 端點）
  - [ ] 速率限制頭正確顯示
  - [ ] 429 錯誤正確返回
  - [ ] 錯誤消息為中文

- [ ] **useVariableEditor 測試**
  - [ ] 自動測試通過（20/20 測試）
  - [ ] null/undefined 不會導致崩潰
  - [ ] 錯誤處理正確工作
  - [ ] 實際使用場景正常

- [ ] **前端錯誤處理測試**
  - [ ] 429 錯誤被正確捕獲
  - [ ] Element Plus 錯誤提示正確顯示
  - [ ] 錯誤消息清晰易懂
  - [ ] 不影響其他功能

---

## 🐛 故障排除

### 問題 1：測試腳本無法運行

**症狀**：`node scripts/test-rate-limiter.js` 報錯

**解決方案**：
```bash
# 確保已安裝依賴
npm install

# 確保 .env 文件存在
cp .env.example .env

# 確保後端服務正在運行
npm run dev
```

---

### 問題 2：獲取不到 Admin Token

**症狀**：無法獲取管理員的 Firebase Auth Token

**解決方案**：
1. 使用 `scripts/create-admin-user.js` 創建管理員
2. 或者使用 Firebase Console 手動設置 Custom Claims
3. 使用前端登入後從開發者工具獲取

---

### 問題 3：所有請求都返回 401

**症狀**：測試腳本顯示所有請求都是 401 Unauthorized

**解決方案**：
1. 確認 Token 是否正確
2. 確認 Token 沒有過期（Firebase Token 有效期 1 小時）
3. 確認用戶有管理員權限（Custom Claims）
4. 重新獲取 Token

---

### 問題 4：測試無法觸發速率限制

**症狀**：發送超過限制次數的請求仍然成功

**可能原因**：
1. 速率限制器使用的是管理員 UID，不同 Token 有不同的配額
2. 速率限制窗口已經過期並重置
3. 中間件順序錯誤（雖然已修復）

**驗證方法**：
```bash
# 檢查響應頭
curl -X GET http://localhost:4001/api/users/test-user-id \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -v | grep -i ratelimit

# 應該看到：
# X-RateLimit-Limit: 200
# X-RateLimit-Remaining: 199
```

---

## 📝 測試報告模板

測試完成後，請填寫以下報告：

```
=== 測試報告 ===

日期：__________
測試人員：__________
環境：[ ] 開發環境  [ ] 測試環境

--- 速率限制器測試 ---
[ ] 快速測試：通過 __/5
[ ] 完整測試：通過 __/5
[ ] 手動測試：[ ] 通過  [ ] 失敗
問題描述：__________

--- useVariableEditor 測試 ---
[ ] 自動測試：通過 __/20
[ ] 實際使用：[ ] 通過  [ ] 失敗
問題描述：__________

--- 前端錯誤處理測試 ---
[ ] 429 錯誤顯示：[ ] 正確  [ ] 錯誤
[ ] 錯誤消息質量：[ ] 好  [ ] 需改進
問題描述：__________

--- 總結 ---
整體評估：[ ] 通過  [ ] 部分通過  [ ] 失敗
建議：__________
```

---

## 🎯 下一步

測試通過後：

1. ✅ **提交代碼**
   ```bash
   git add .
   git commit -m "test: 驗證速率限制器和 useVariableEditor 修復"
   ```

2. ✅ **更新文檔**
   - 在 CHANGELOG.md 中記錄測試結果
   - 更新 OPTIMIZATION_SUMMARY 文件

3. ✅ **部署到測試環境**
   - 如果有測試環境，部署並進行相同測試

4. ✅ **監控生產環境**
   - 部署後監控速率限制觸發情況
   - 檢查是否有異常錯誤

---

## 📞 需要幫助？

如果測試過程中遇到問題：

1. 檢查 [故障排除](#故障排除) 部分
2. 查看 backend 日誌：`npm run dev`（會顯示詳細日誌）
3. 查看瀏覽器控制台（F12）
4. 檢查 Firebase Console 的用戶權限

---

**最後更新**：2025-01-13
**版本**：1.0.0
