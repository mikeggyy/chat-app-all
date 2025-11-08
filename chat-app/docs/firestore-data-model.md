# Firestore 數據模型

本文檔定義了應用程序中所有 Firestore 集合的結構。

## 集合結構概覽

```
/users/{userId}                    - 用戶基本資料
/conversations/{conversationId}    - 對話記錄
/usage_limits/{userId}             - 用戶使用限制
```

## 詳細數據結構

### 1. users 集合

**路徑**: `/users/{userId}`

**文檔結構**:
```javascript
{
  uid: string,                     // 用戶 ID（與文檔 ID 相同）
  email: string,                   // 用戶 email
  displayName: string,             // 顯示名稱

  // 會員資訊
  membershipTier: "free" | "vip" | "vvip",
  membershipStatus: "active" | "expired" | "cancelled",
  membershipStartedAt: timestamp,  // 會員開始時間
  membershipExpiresAt: timestamp,  // 會員到期時間
  membershipAutoRenew: boolean,    // 是否自動續費

  // 時間戳
  createdAt: timestamp,            // 創建時間
  updatedAt: timestamp,            // 更新時間
  lastLoginAt: timestamp,          // 最後登入時間
}
```

### 2. conversations 集合

**路徑**: `/conversations/{conversationId}`

**conversationId 格式**: `{userId}::{characterId}`

**文檔結構**:
```javascript
{
  id: string,                      // 對話 ID（格式: userId::characterId）
  userId: string,                  // 用戶 ID
  characterId: string,             // 角色 ID

  // 對話內容
  messages: [                      // 訊息陣列
    {
      role: "user" | "assistant",  // 訊息角色
      content: string,             // 訊息內容
      timestamp: timestamp,        // 訊息時間
      hasVoice: boolean,           // 是否有語音
      hasImage: boolean,           // 是否有圖片
      imageUrl: string,            // 圖片 URL（base64 或 URL）
    }
  ],

  // 元數據
  messageCount: number,            // 訊息總數
  lastMessage: string,             // 最後一條訊息
  lastMessageAt: timestamp,        // 最後訊息時間

  // 時間戳
  createdAt: timestamp,            // 創建時間
  updatedAt: timestamp,            // 更新時間
}
```

**索引**:
- `userId` (ASC) + `updatedAt` (DESC) - 用於獲取用戶的對話列表
- `userId` (ASC) + `characterId` (ASC) - 用於查找特定對話

### 3. usage_limits 集合

**路徑**: `/usage_limits/{userId}`

**文檔結構**:
```javascript
{
  userId: string,                  // 用戶 ID（與文檔 ID 相同）

  // 照片使用限制
  photos: {
    used: number,                  // 已使用數量
    cards: number,                 // 購買的照片卡數量
    lastReset: timestamp,          // 上次重置時間
    monthlyResetDate: number,      // 每月重置日期（1-31）
  },

  // 語音使用限制（按角色）
  voice: {
    [characterId]: {
      used: number,                // 已使用數量
      unlocked: number,            // 通過廣告解鎖的數量
      lastAdWatch: timestamp,      // 最後觀看廣告時間
      adWatchCount: number,        // 今日廣告觀看次數
      lastAdReset: timestamp,      // 廣告計數重置時間
    }
  },

  // 對話使用限制（按角色）
  conversation: {
    [characterId]: {
      used: number,                // 已使用訊息數
      unlocked: number,            // 通過廣告解鎖的數量
      lastAdWatch: timestamp,      // 最後觀看廣告時間
      adWatchCount: number,        // 今日廣告觀看次數
      lastAdReset: timestamp,      // 廣告計數重置時間
    }
  },

  // 時間戳
  createdAt: timestamp,            // 創建時間
  updatedAt: timestamp,            // 更新時間
}
```

## 數據訪問模式

### 1. 獲取用戶資料
```javascript
const userDoc = await db.collection('users').doc(userId).get();
const userData = userDoc.data();
```

### 2. 獲取對話列表
```javascript
const conversationsSnapshot = await db.collection('conversations')
  .where('userId', '==', userId)
  .orderBy('updatedAt', 'desc')
  .get();
```

### 3. 獲取特定對話
```javascript
const conversationId = `${userId}::${characterId}`;
const conversationDoc = await db.collection('conversations').doc(conversationId).get();
```

### 4. 添加訊息到對話
```javascript
const conversationRef = db.collection('conversations').doc(conversationId);
await conversationRef.update({
  messages: FieldValue.arrayUnion(newMessage),
  messageCount: FieldValue.increment(1),
  lastMessage: newMessage.content,
  lastMessageAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});
```

### 5. 更新使用限制
```javascript
const limitsRef = db.collection('usage_limits').doc(userId);
await limitsRef.update({
  [`photos.used`]: FieldValue.increment(1),
  updatedAt: FieldValue.serverTimestamp(),
});
```

## 遷移注意事項

1. **conversationId 格式**: 保持 `userId::characterId` 格式以兼容現有邏輯
2. **訊息陣列**: Firestore 支持陣列，可以直接使用 `arrayUnion` 添加訊息
3. **限制重置**: 使用 Cloud Functions 或定時任務重置每日/每月限制
4. **索引**: 確保在 `firestore.indexes.json` 中定義必要的複合索引
5. **時間戳**: 使用 `FieldValue.serverTimestamp()` 確保時間一致性
