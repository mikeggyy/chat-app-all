# Firestore 索引配置指南

本文檔說明 `firestore.indexes.json` 中各索引的用途和重要性。

## 📚 索引概述

Firestore 需要複合索引來支援包含多個 where 子句或排序的查詢。未配置索引會導致查詢失敗或性能低下。

---

## 🔍 各集合索引說明

### 1. conversations 集合

#### 索引 1: `(userId, updatedAt DESC)`
```json
{
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 獲取用戶的對話列表，按更新時間排序

**使用場景**:
- 聊天列表頁面
- 顯示用戶最近的對話

**代碼位置**: `conversation.service.js` - `getUserConversations()`

---

#### 索引 2: `(userId, characterId)`
```json
{
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "characterId", "order": "ASCENDING" }
  ]
}
```

**用途**: 查詢用戶與特定角色的對話

**使用場景**:
- 打開與特定角色的聊天室
- 檢查是否已有對話

**代碼位置**: `conversation.service.js` - `getConversation()`

---

#### 索引 3: `(characterId, updatedAt DESC)`
```json
{
  "fields": [
    { "fieldPath": "characterId", "order": "ASCENDING" },
    { "fieldPath": "updatedAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 獲取角色的所有對話，按更新時間排序

**使用場景**:
- 管理後台查看角色的對話統計
- 角色熱度分析

**代碼位置**: `conversation.service.js` - `getCharacterConversations()`

---

### 2. messages 集合

#### 索引: `(imageUrl, createdAt DESC)`
```json
{
  "fields": [
    { "fieldPath": "imageUrl", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 查詢包含圖片的消息

**使用場景**:
- 相冊功能
- 圖片消息統計

---

### 3. characters 集合

#### 索引 1: `(status, isPublic, createdAt DESC)`
```json
{
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "isPublic", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 獲取活躍且公開的角色列表

**使用場景**:
- 角色列表頁面
- 推薦角色

**代碼位置**:
- ~~`match.service.js` - `listMatchesForUser()`~~ (已優化為使用緩存)
- 管理後台角色管理

---

#### 索引 2: `(status, isPublic, totalChatUsers DESC)`
```json
{
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "isPublic", "order": "ASCENDING" },
    { "fieldPath": "totalChatUsers", "order": "DESCENDING" }
  ]
}
```

**用途**: 按聊天人數排序的角色列表（熱門排行）

**使用場景**:
- 熱門角色排行榜
- 推薦系統

---

### 4. transactions 集合 💰

#### 索引 1: `(userId, createdAt DESC)`
```json
{
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 獲取用戶的交易記錄

**使用場景**:
- 錢包頁面 - 交易歷史
- 用戶交易統計

**代碼位置**: `transaction.service.js` - `getUserTransactions()`

**重要性**: ⚠️ 高 - 財務相關查詢，必須高效

---

#### 索引 2: `(userId, status, createdAt DESC)`
```json
{
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 按狀態過濾用戶交易記錄

**使用場景**:
- 僅顯示成功/失敗的交易
- 交易對帳

**代碼位置**: `transaction.service.js` - `getUserTransactions({ status })`

**重要性**: ⚠️ 高 - 財務相關查詢，必須高效

---

#### 索引 3: `(userId, type, createdAt DESC)`
```json
{
  "fields": [
    { "fieldPath": "userId", "order": "ASCENDING" },
    { "fieldPath": "type", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 按類型過濾用戶交易記錄

**使用場景**:
- 僅顯示充值/消費/禮物等特定類型
- 交易分類統計

**代碼位置**: `transaction.service.js` - `getUserTransactions({ type })`

**重要性**: ⚠️ 高 - 財務相關查詢，必須高效

---

#### 索引 4: `(type, status, createdAt DESC)`
```json
{
  "fields": [
    { "fieldPath": "type", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 管理後台查詢特定類型和狀態的交易

**使用場景**:
- 管理後台 - 交易統計
- 異常交易監控

**重要性**: ⚠️ 中 - 管理功能

---

#### 索引 5: `(status, createdAt DESC)` 和 `(type, createdAt DESC)`
```json
{
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 管理後台查詢所有用戶的交易

**使用場景**:
- 交易總覽
- 系統統計

---

### 5. orders 集合

#### 索引 1-4: 類似 transactions 集合
- `(userId, createdAt DESC)` - 用戶訂單列表
- `(userId, type, createdAt DESC)` - 按類型過濾訂單
- `(userId, status, createdAt DESC)` - 按狀態過濾訂單
- `(status, createdAt DESC)` - 管理後台訂單查詢

**用途**: 支援會員訂閱、商品購買等訂單查詢

---

### 6. photos 集合

#### 索引: `(characterId, createdAt DESC)`
```json
{
  "fields": [
    { "fieldPath": "characterId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**用途**: 獲取角色的照片列表

**使用場景**:
- 角色相冊
- 照片統計

---

### 7. character_styles 集合

#### 索引: `(status, order)`
```json
{
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "order", "order": "ASCENDING" }
  ]
}
```

**用途**: 獲取啟用的角色風格，按順序排列

**使用場景**:
- 角色創建頁面 - 風格選擇器

---

## 🚀 性能優化建議

### 已優化 ✅

1. **角色查詢使用緩存** (2025-11-12)
   - `match.service.js` 的 `listMatchesForUser()` 已改為從內存緩存讀取
   - 預期減少 80-90% 的 Firestore 讀取
   - 索引仍保留以供管理後台使用

### 監控重點 👀

1. **高頻查詢**:
   - `getUserTransactions()` - 每次打開錢包頁面
   - `getUserConversations()` - 每次打開聊天列表

2. **成本監控**:
   - 交易查詢（財務敏感）
   - 對話查詢（高頻）

---

## 📋 維護檢查清單

### 添加新查詢時

1. ✅ 檢查是否需要複合索引
2. ✅ 添加索引到 `firestore.indexes.json`
3. ✅ 運行 `firebase deploy --only firestore:indexes`
4. ✅ 在本文檔中記錄索引用途

### 索引部署

```bash
# 部署索引配置
cd chat-app
firebase deploy --only firestore:indexes

# 查看索引狀態
firebase firestore:indexes
```

### 索引優化建議

1. **避免過多索引**
   - 每個索引都會增加寫入成本
   - 定期檢查未使用的索引

2. **使用索引豁免**
   - 小型集合（< 200 文檔）可能不需要索引
   - 考慮使用 `orderBy` 而非索引

3. **監控索引使用率**
   - 使用 Firebase Console 查看查詢性能
   - 刪除未使用的索引

---

## 🔗 相關文檔

- [Firestore 索引官方文檔](https://firebase.google.com/docs/firestore/query-data/indexing)
- [chat-app/docs/firestore-collections.md](docs/firestore-collections.md) - 集合結構說明
- [CLAUDE.md](CLAUDE.md) - 專案開發指南

---

**最後更新**: 2025-11-12
**維護者**: Claude Code
**狀態**: ✅ 所有必要索引已配置
