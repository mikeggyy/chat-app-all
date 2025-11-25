# 禮物系統錯誤訊息改進總結

**日期**: 2025-11-25
**目標**: 改善送禮物失敗時的錯誤訊息，讓用戶和管理員能清楚了解失敗原因

---

## 📋 問題描述

**原始問題**:
- 送禮物時偶爾會失敗
- 錯誤訊息不夠詳細：「禮物回應生成失敗，已退款 800 金幣」
- 用戶不知道具體失敗原因
- 管理員難以排查問題
- API 沒有報錯（因為這是預期的業務邏輯處理，不是 HTTP 錯誤）

---

## ✅ 實施的改進

### 1. 後端錯誤分類（giftResponse.service.js）

新增了 **5 種詳細的錯誤類型**：

| 錯誤類型 | 錯誤代碼 | 用戶友好訊息 | 可能原因 |
|---------|---------|------------|---------|
| 下載超時 | `DOWNLOAD_TIMEOUT` | 下載角色照片超時，網絡可能不穩定，請稍後再試 | 網絡延遲、圖片伺服器慢 |
| 下載失敗 | `DOWNLOAD_FAILED` | 無法載入角色照片，請稍後再試 | 圖片 URL 無效、網絡錯誤 |
| AI 生成失敗 | `GEMINI_API_FAILED` | AI 圖片生成服務暫時不可用，請稍後再試 | Gemini API 配額用完、API 錯誤 |
| 上傳失敗 | `STORAGE_UPLOAD_FAILED` | 圖片上傳失敗，儲存空間可能已滿或網絡不穩定 | Firebase Storage 配額、網絡問題 |
| 保存失敗 | `SAVE_MESSAGE_FAILED` / `SAVE_PHOTO_FAILED` | 訊息保存失敗，資料庫連接可能有問題 | Firestore 寫入錯誤 |
| 嚴重錯誤 | `CRITICAL_ERROR` | 系統處理禮物回應時發生未預期的錯誤，請聯繫客服 | 未知錯誤 |

### 2. 增強的錯誤信息結構

**後端返回結構**:
```javascript
{
  success: false,
  error: "GEMINI_API_FAILED",              // 錯誤代碼（供開發者/日誌使用）
  errorMessage: "AI 圖片生成服務暫時不可用...", // 用戶友好訊息
  technicalDetails: "原始錯誤信息...",      // 技術細節（供排查使用）
  needsRefund: true,
  gift: { ... }
}
```

### 3. 改善的前端錯誤處理

**變更內容**:
- ✅ 使用後端返回的詳細錯誤訊息
- ✅ 在控制台記錄技術細節（`technicalDetails`）
- ✅ 向用戶顯示友好的錯誤提示
- ✅ 錯誤訊息包含具體的退款金額

**示例**:
```
原來：禮物回應生成失敗，已退款 800 金幣
現在：AI 圖片生成服務暫時不可用，請稍後再試，已退款 800 金幣
```

### 4. 增強的日誌記錄

**後端日誌改進**:
- ✅ 每個錯誤類型都有明確的 `errorType` 標記
- ✅ 記錄 `technicalDetails` 供排查
- ✅ 關鍵步驟都有詳細日誌

**示例日誌**:
```
[禮物回應] ❌ 照片生成失敗: userId=xxx, characterId=yyy, errorType=GEMINI_API_FAILED
[禮物回應] ❌ Gemini API 調用失敗: Error: ...
```

---

## 🧪 測試指南

### 測試方法

1. **正常情況測試**（應該成功）:
   ```
   送禮物 → 生成感謝訊息 → 生成照片 → 顯示成功
   ```

2. **模擬失敗情況**（開發環境）:

   **方法 A: 臨時修改環境變數**
   ```bash
   # 在 chat-app/backend/.env 中臨時註釋掉
   # GOOGLE_AI_API_KEY=...

   # 重啟後端
   npm run dev:backend

   # 預期結果：「AI 圖片生成服務暫時不可用，請稍後再試」
   ```

   **方法 B: 使用無效的角色肖像 URL**
   - 在 Firestore 中修改某個角色的 `portraitUrl` 為無效 URL
   - 預期結果：「無法載入角色照片，請稍後再試」

   **方法 C: 監控生產環境日誌**
   - 查看後端日誌，找到最近的失敗記錄
   - 檢查 `errorType` 欄位，判斷失敗原因

### 預期行為

**成功情況**:
1. ✅ 扣款成功
2. ✅ 顯示感謝訊息
3. ✅ 顯示禮物照片
4. ✅ 保存到對話歷史

**失敗情況**:
1. ❌ 生成失敗時，顯示詳細錯誤訊息
2. ✅ 自動退款（金額正確）
3. ✅ 移除失敗的禮物訊息
4. ✅ 後端日誌記錄 `errorType` 和技術細節

---

## 📊 排查問題的步驟

如果用戶報告送禮物失敗：

### 1. 查看前端控制台

用戶可以按 F12 打開開發者工具，查看 Console 標籤：

```javascript
// 查找類似這樣的日誌
[禮物] 禮物回應生成失敗，正在處理退款: {
  error: "GEMINI_API_FAILED",
  message: "AI 圖片生成服務暫時不可用，請稍後再試",
  technical: "Quota exceeded for quota metric..."
}
```

### 2. 查看後端日誌

管理員在後端日誌中搜索：

```bash
# Windows PowerShell
cd d:\project\chat-app-all\chat-app\backend
npm run dev:backend

# 查找日誌中的錯誤
# 搜索：[禮物回應] ❌
```

**日誌中會包含**:
- `errorType`: 錯誤類型
- `userId`, `characterId`: 相關 ID
- 詳細的錯誤堆棧

### 3. 根據錯誤類型採取行動

| 錯誤類型 | 解決方法 |
|---------|---------|
| `DOWNLOAD_TIMEOUT` | 檢查圖片伺服器是否可訪問，考慮增加超時時間 |
| `GEMINI_API_FAILED` | 檢查 Gemini API 配額、API Key 是否有效 |
| `STORAGE_UPLOAD_FAILED` | 檢查 Firebase Storage 配額、權限設置 |
| `SAVE_MESSAGE_FAILED` | 檢查 Firestore 連接、權限規則 |

---

## 🔄 後續優化建議（方案 B & C）

### 方案 B - 提高可靠性（尚未實施）:
- ⏳ 增加重試機制（API 失敗時自動重試 1-2 次）
- ⏳ 增加下載超時時間（從 10 秒增加到 15-20 秒）
- ⏳ 降級策略（照片生成失敗時只發送感謝訊息，不退款）

### 方案 C - 監控和預警（尚未實施）:
- ⏳ 記錄失敗率到 Firestore
- ⏳ 當失敗率超過 10% 時發送警報
- ⏳ 創建失敗統計儀表板

---

## 📝 修改的文件

### 後端:
1. **[chat-app/backend/src/gift/giftResponse.service.js](chat-app/backend/src/gift/giftResponse.service.js)**
   - ✅ 添加 `errorType` 分類
   - ✅ 改善錯誤訊息生成
   - ✅ 增加技術細節記錄

### 前端:
2. **[chat-app/frontend/src/composables/chat/useChatActions.ts](chat-app/frontend/src/composables/chat/useChatActions.ts)**
   - ✅ 使用詳細的錯誤訊息
   - ✅ 記錄技術細節到控制台
   - ✅ 改善用戶提示

---

## ✨ 預期效果

**改進前**:
```
❌ 錯誤提示：禮物回應生成失敗，已退款 800 金幣
❌ 不知道具體原因
❌ 難以排查問題
```

**改進後**:
```
✅ 詳細錯誤：AI 圖片生成服務暫時不可用，請稍後再試，已退款 800 金幣
✅ 控制台顯示技術細節：error: "GEMINI_API_FAILED", technical: "..."
✅ 後端日誌記錄完整錯誤信息
✅ 管理員可以快速定位問題根源
```

---

## 🚀 部署檢查清單

- [x] 後端代碼已修改並測試
- [x] 前端代碼已修改並測試
- [ ] 重啟後端服務（如果已在運行）
- [ ] 清除前端緩存並重新構建
- [ ] 進行一次完整的送禮物測試（成功情況）
- [ ] 查看後端日誌確認改進生效
- [ ] 監控前幾次失敗的錯誤訊息是否詳細

---

## 💡 給用戶的建議

如果您遇到送禮物失敗：

1. **查看錯誤提示** - 新的錯誤訊息會告訴您具體原因
2. **檢查網絡連接** - 大部分失敗與網絡有關
3. **等待幾分鐘後重試** - 臨時性問題通常會自動恢復
4. **聯繫客服** - 如果持續失敗，提供錯誤訊息給客服

**好消息**：無論失敗原因如何，系統都會**自動退款**，您不會損失金幣！💰

---

## 📞 技術支援

如有問題，請查看：
- 後端日誌：`chat-app/backend/` 運行時的控制台輸出
- Firestore 錯誤：Firebase Console → Firestore → 查看寫入錯誤
- API 配額：Google Cloud Console → APIs & Services → Quotas

---

**文檔版本**: 1.0
**最後更新**: 2025-11-25
