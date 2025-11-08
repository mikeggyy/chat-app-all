# 對話歷史架構遷移指南 (V1 → V2)

## 📋 概覽

本指南說明如何將對話歷史從 V1 架構（單文檔陣列）遷移到 V2 架構（子集合）。

### 架構對比

**V1 架構（舊）**：
```
conversations/{userId}::{characterId}
  ├─ userId: string
  ├─ characterId: string
  ├─ messages: [array of all messages]  ⚠️ 限制：最多 ~10,000 則（1MB 限制）
  ├─ messageCount: number
  ├─ lastMessage: string
  └─ updatedAt: timestamp
```

**V2 架構（新）**：
```
conversations/{userId}::{characterId}
  ├─ userId: string
  ├─ characterId: string
  ├─ messageCount: number
  ├─ lastMessage: string
  ├─ lastMessageAt: timestamp
  ├─ createdAt: timestamp
  ├─ updatedAt: timestamp
  └─ messages (subcollection)  ✅ 無限制
      └─ {messageId}
          ├─ id: string
          ├─ role: "user" | "partner"
          ├─ text: string
          ├─ imageUrl?: string
          └─ createdAt: string
```

## 🎯 遷移優點

1. **突破文檔大小限制**：不再受 1MB 限制，支援無限對話歷史
2. **提升查詢效率**：分頁載入訊息，只讀取需要的部分
3. **減少寫入成本**：添加訊息時不需要讀取整個歷史
4. **更好的索引支援**：可針對訊息建立特定索引（如：包含圖片的訊息）

## 📦 遷移步驟

### 步驟 1: 部署新索引

首先，部署新的 Firestore 索引：

```bash
cd chat-app-3
firebase deploy --only firestore:indexes
```

等待索引建立完成（可能需要幾分鐘到幾小時，取決於數據量）。

### 步驟 2: 執行遷移腳本（DRY RUN）

先執行 dry run 測試，不會實際修改數據：

```bash
cd backend
node scripts/migrate-conversations-to-v2.js --dry-run
```

這會顯示：
- 找到多少個對話
- 每個對話有多少則訊息
- 預計遷移的數據量

### 步驟 3: 限制數量測試

建議先測試少量數據：

```bash
# 只遷移前 5 個對話
node scripts/migrate-conversations-to-v2.js --limit=5
```

驗證遷移結果是否正確。

### 步驟 4: 完整遷移

確認測試無誤後，執行完整遷移：

```bash
# 遷移所有對話
node scripts/migrate-conversations-to-v2.js
```

### 步驟 5: 驗證遷移結果

遷移完成後，腳本會自動驗證前 5 個對話的遷移結果。

手動驗證：
```bash
# 進入 Firebase Console
# 檢查 conversations 集合
# 確認：
# 1. messages 陣列已被移除
# 2. messageCount 欄位正確
# 3. messages 子集合存在且有數據
```

## 🔄 使用新架構

### 更新程式碼

**舊版（V1）**：
```javascript
import * as conversationService from "./conversation/conversation.service.js";

// 獲取歷史（一次讀取所有）
const history = await conversationService.getConversationHistory(userId, characterId);

// 添加訊息（需要讀取整個歷史）
await conversationService.appendConversationMessage(userId, characterId, message);
```

**新版（V2）**：
```javascript
import * as conversationServiceV2 from "./conversation/conversationV2.service.js";

// 獲取最近的 50 則訊息（最常用場景）
const messages = await conversationServiceV2.getRecentMessages(userId, characterId, 50);

// 分頁獲取歷史
const { messages, lastDoc, hasMore } = await conversationServiceV2.getConversationHistory(
  userId,
  characterId,
  { limit: 100, orderDirection: "asc" }
);

// 添加訊息（不需要讀取歷史）
await conversationServiceV2.appendConversationMessage(userId, characterId, message);

// 查詢包含圖片的訊息
const photos = await conversationServiceV2.getConversationPhotos(userId, characterId, 20);
```

### API 對比

| 功能 | V1 | V2 | 差異 |
|------|----|----|------|
| 獲取歷史 | `getConversationHistory()` | `getRecentMessages()` | V2 支援分頁，更高效 |
| 添加訊息 | `appendConversationMessage()` | `appendConversationMessage()` | V2 不需讀取歷史 |
| 清空歷史 | `clearConversationHistory()` | `clearConversationHistory()` | 相同 API |
| 查詢照片 | `getConversationPhotos()` | `getConversationPhotos()` | V2 使用索引查詢 |
| 刪除訊息 | `deleteConversationMessages()` | `deleteConversationMessages()` | V2 更高效 |

## ⚠️ 注意事項

### 遷移期間

1. **建議在低峰時段執行**：避免影響用戶體驗
2. **先備份數據**：使用 Firebase 匯出功能備份 conversations 集合
3. **監控錯誤**：檢查遷移腳本的日誌，確保沒有失敗的對話

### 遷移後

1. **V1 和 V2 不相容**：遷移後必須使用 V2 API
2. **無法回滾**：遷移後建議保留備份一段時間
3. **更新所有引用**：確保所有使用對話服務的程式碼都已更新

## 🔧 故障排除

### 問題：索引建立失敗

**症狀**：Firebase Console 顯示索引建立錯誤

**解決方案**：
1. 檢查 `firestore.indexes.json` 語法是否正確
2. 手動在 Firebase Console 建立索引
3. 確認沒有衝突的索引

### 問題：遷移中斷

**症狀**：遷移腳本執行到一半中斷

**解決方案**：
1. 重新執行遷移腳本（會自動跳過已遷移的對話）
2. 使用 `--limit` 參數分批遷移
3. 檢查 Firestore 配額是否超限

### 問題：部分對話遺失訊息

**症狀**：遷移後某些對話的訊息數量不符

**解決方案**：
1. 檢查遷移腳本日誌，找出失敗的對話
2. 從備份中恢復該對話
3. 針對該對話重新執行遷移

## 📊 效能對比

| 操作 | V1 時間 | V2 時間 | 改善 |
|------|---------|---------|------|
| 讀取 100 則訊息 | ~200ms | ~50ms | 4x |
| 添加 1 則訊息 | ~150ms | ~30ms | 5x |
| 查詢 20 張照片 | ~300ms | ~80ms | 3.7x |

*註：實際效能取決於對話歷史長度和網路環境*

## 🎓 相關資源

- [conversationV2.service.js](../backend/src/conversation/conversationV2.service.js) - V2 服務實現
- [conversation.service.js](../backend/src/conversation/conversation.service.js) - V1 服務（保留作為參考）
- [migrate-conversations-to-v2.js](../backend/scripts/migrate-conversations-to-v2.js) - 遷移腳本
- [firestore.indexes.json](../firestore.indexes.json) - Firestore 索引配置

## 📝 遷移檢查清單

- [ ] 備份 conversations 集合數據
- [ ] 部署新的 Firestore 索引
- [ ] 等待索引建立完成
- [ ] 執行遷移 dry run 測試
- [ ] 小規模測試遷移（--limit=5）
- [ ] 驗證測試結果
- [ ] 執行完整遷移
- [ ] 驗證所有對話已正確遷移
- [ ] 更新程式碼使用 V2 API
- [ ] 部署新版程式碼
- [ ] 監控應用運行狀況
- [ ] 清理舊備份（30 天後）

## 🔄 回滾計畫（緊急情況）

如果遷移後發現重大問題：

1. **停止應用**：防止新數據寫入
2. **從備份恢復**：使用 Firebase 匯入功能恢復 conversations 集合
3. **回滾程式碼**：部署使用 V1 API 的版本
4. **調查問題**：分析遷移失敗原因
5. **修復並重試**：修復問題後重新執行遷移

---

**最後更新**: 2025-01-08
**版本**: 1.0
