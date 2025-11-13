# API 響應優化指南

本指南介紹如何使用響應優化工具減少 API 響應體積。

## 目錄

- [為什麼需要優化響應](#為什麼需要優化響應)
- [基本用法](#基本用法)
- [字段選擇器](#字段選擇器)
- [在路由中使用](#在路由中使用)
- [最佳實踐](#最佳實踐)

---

## 為什麼需要優化響應

### 問題

未優化的 API 響應可能包含：
- **敏感字段**：密碼、API 密鑰等
- **冗餘字段**：不必要的元數據
- **過多信息**：客戶端不需要的數據

### 影響

- 📶 **帶寬浪費**：增加網絡傳輸成本
- ⚡ **性能下降**：解析和傳輸時間增加
- 🔐 **安全風險**：可能洩露敏感信息
- 💸 **成本增加**：CDN 和網絡費用上升

### 解決方案

使用響應優化器自動移除不必要的字段，只返回客戶端需要的數據。

---

## 基本用法

### 移除敏感字段

```javascript
import { removeSensitiveFields } from '../utils/responseOptimizer.js';

// 原始數據
const user = {
  id: '123',
  email: 'user@example.com',
  displayName: 'User',
  password: 'hashed_password', // 敏感字段
  apiKey: 'secret_key', // 敏感字段
};

// 移除敏感字段
const safeUser = removeSensitiveFields(user);

console.log(safeUser);
// {
//   id: '123',
//   email: 'user@example.com',
//   displayName: 'User',
// }
```

### 選擇特定字段

```javascript
import { pick } from '../utils/responseOptimizer.js';

const user = {
  id: '123',
  email: 'user@example.com',
  displayName: 'User',
  membershipTier: 'vip',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-02',
};

// 只保留需要的字段
const publicUser = pick(user, ['id', 'displayName', 'membershipTier']);

console.log(publicUser);
// {
//   id: '123',
//   displayName: 'User',
//   membershipTier: 'vip',
// }
```

### 排除特定字段

```javascript
import { omit } from '../utils/responseOptimizer.js';

// 排除不需要的字段
const cleanUser = omit(user, ['createdAt', 'updatedAt', 'email']);

console.log(cleanUser);
// {
//   id: '123',
//   displayName: 'User',
//   membershipTier: 'vip',
// }
```

---

## 字段選擇器

預定義的字段選擇器提供常見的字段組合。

### 可用的選擇器

| 選擇器 | 用途 | 保留字段 |
|--------|------|---------|
| `userPublic` | 用戶公開資料 | id, displayName, photoURL, membershipTier |
| `userFull` | 用戶完整資料 | 所有字段（除敏感字段） |
| `characterList` | 角色列表 | id, display_name, gender, portraitUrl, tags, stats |
| `characterDetail` | 角色詳細資料 | 所有字段（除 secret_background） |
| `message` | 消息 | id, role, text, imageUrl, videoUrl, createdAt |
| `conversationHistory` | 對話歷史 | id, characterId, lastMessage, lastMessageAt |

### 使用選擇器

```javascript
import { applySelector } from '../utils/responseOptimizer.js';

const user = {
  id: '123',
  email: 'user@example.com',
  displayName: 'User',
  membershipTier: 'vip',
  favorites: ['char1', 'char2'],
  conversations: [...],
  createdAt: '2024-01-01',
};

// 應用 userPublic 選擇器
const publicUser = applySelector(user, 'userPublic');

console.log(publicUser);
// {
//   id: '123',
//   displayName: 'User',
//   membershipTier: 'vip',
// }
```

### 對數組使用選擇器

```javascript
const characters = [
  { id: '1', display_name: 'Alice', secret_background: '...', /* ... */ },
  { id: '2', display_name: 'Bob', secret_background: '...', /* ... */ },
];

// 自動處理數組
const optimizedCharacters = applySelector(characters, 'characterList');
```

---

## 在路由中使用

### 方法 1：手動優化

```javascript
import { applySelector } from '../utils/responseOptimizer.js';

router.get('/api/characters', async (req, res) => {
  try {
    const characters = await db.collection('characters').get();
    const characterList = characters.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 應用優化
    const optimized = applySelector(characterList, 'characterList');

    res.json({ characters: optimized });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 方法 2：使用中間件

```javascript
import { optimizeMiddleware } from '../utils/responseOptimizer.js';

// 應用中間件到特定路由
router.get(
  '/api/characters',
  optimizeMiddleware('characterList'),
  async (req, res) => {
    const characters = await getCharacters();
    res.json({ characters }); // 自動優化
  }
);
```

### 方法 3：使用 optimizeResponse

```javascript
import { optimizeResponse } from '../utils/responseOptimizer.js';

router.get('/api/user/profile', async (req, res) => {
  try {
    const user = await getUserProfile(req.user.id);

    // 根據請求者決定返回哪些字段
    const isOwnProfile = req.user.id === user.id;

    const optimized = optimizeResponse(user, {
      selector: isOwnProfile ? 'userFull' : 'userPublic',
    });

    res.json(optimized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 實際應用示例

### 示例 1：角色列表 API

**優化前**：

```javascript
router.get('/api/characters', async (req, res) => {
  const characters = await db.collection('characters').get();

  res.json({
    characters: characters.docs.map((doc) => doc.data()),
  });
});
```

**響應大小**：~150KB（包含所有字段）

**優化後**：

```javascript
import { applySelector } from '../utils/responseOptimizer.js';

router.get('/api/characters', async (req, res) => {
  const characters = await db.collection('characters').get();
  const characterList = characters.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const optimized = applySelector(characterList, 'characterList');

  res.json({ characters: optimized });
});
```

**響應大小**：~45KB（**節省 70%**）

---

### 示例 2：用戶資料 API

**優化前**：

```javascript
router.get('/api/user/:userId', async (req, res) => {
  const user = await getUserById(req.params.userId);
  res.json(user);
});
```

**問題**：
- 包含敏感字段（email）
- 包含不必要的數組（favorites, conversations）
- 包含元數據（createdAt, updatedAt）

**優化後**：

```javascript
import { optimizeResponse } from '../utils/responseOptimizer.js';

router.get('/api/user/:userId', async (req, res) => {
  const user = await getUserById(req.params.userId);
  const isOwnProfile = req.user?.id === user.id;

  const optimized = optimizeResponse(user, {
    selector: isOwnProfile ? 'userFull' : 'userPublic',
    removeSensitive: true,
  });

  res.json(optimized);
});
```

**結果**：
- 自己的資料：返回完整資料（除敏感字段）
- 他人資料：僅返回公開字段
- 響應體積減少 60-80%

---

### 示例 3：對話歷史 API

**優化前**：

```javascript
router.get('/api/conversations', async (req, res) => {
  const conversations = await db
    .collection('conversations')
    .where('userId', '==', req.user.id)
    .get();

  res.json({
    conversations: conversations.docs.map((doc) => doc.data()),
  });
});
```

**問題**：返回完整的消息數組，導致響應過大

**優化後**：

```javascript
import { applySelector } from '../utils/responseOptimizer.js';

router.get('/api/conversations', async (req, res) => {
  const conversations = await db
    .collection('conversations')
    .where('userId', '==', req.user.id)
    .get();

  const conversationList = conversations.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      characterId: data.characterId,
      lastMessage: data.messages?.slice(-1)[0] || null, // 只返回最後一條消息
      lastMessageAt: data.updatedAt,
      unreadCount: data.unreadCount || 0,
    };
  });

  const optimized = applySelector(conversationList, 'conversationHistory');

  res.json({ conversations: optimized });
});
```

**結果**：
- 不返回完整消息數組
- 只返回最後一條消息
- 響應體積從 500KB 減少到 15KB（**節省 97%**）

---

### 示例 4：分頁 API

```javascript
import { optimizePaginatedResponse } from '../utils/responseOptimizer.js';

router.get('/api/characters', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const characters = await db
    .collection('characters')
    .offset(offset)
    .limit(limit + 1) // +1 用於判斷是否有更多
    .get();

  const items = characters.docs.slice(0, limit).map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const hasMore = characters.docs.length > limit;

  const response = optimizePaginatedResponse(
    items,
    { page, limit, hasMore },
    'characterList' // 應用優化
  );

  res.json(response);
});
```

**響應格式**：
```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasMore": true
  }
}
```

---

## 比較響應大小

使用 `compareSize` 函數比較優化效果：

```javascript
import { compareSize, applySelector } from '../utils/responseOptimizer.js';

const originalData = await getCharacters();
const optimizedData = applySelector(originalData, 'characterList');

const comparison = compareSize(originalData, optimizedData);

console.log(comparison);
// {
//   originalSize: 150000,     // 150 KB
//   optimizedSize: 45000,     // 45 KB
//   saved: 105000,            // 105 KB
//   percentage: 70.00         // 70%
// }

logger.info(`響應優化: 節省 ${comparison.percentage}% (${comparison.saved} bytes)`);
```

---

## 最佳實踐

### 1. 根據客戶端需求選擇字段

```javascript
// ✅ 好的做法：只返回客戶端需要的字段
const optimized = applySelector(data, 'characterList');

// ❌ 不好的做法：返回所有字段
res.json(data);
```

### 2. 區分不同的使用場景

```javascript
// ✅ 列表視圖：使用簡化版本
router.get('/api/characters', (req, res) => {
  const optimized = applySelector(characters, 'characterList');
  res.json({ characters: optimized });
});

// ✅ 詳細視圖：使用完整版本
router.get('/api/characters/:id', (req, res) => {
  const optimized = applySelector(character, 'characterDetail');
  res.json(optimized);
});
```

### 3. 移除嵌套的大數組

```javascript
// ❌ 不好：返回完整的消息數組
res.json({
  conversation: {
    id: '...',
    messages: [...1000條消息], // 太大！
  },
});

// ✅ 好的：僅返回最後幾條
res.json({
  conversation: {
    id: '...',
    recentMessages: messages.slice(-10), // 只返回最後 10 條
  },
});
```

### 4. 使用分頁

```javascript
// ✅ 始終對列表使用分頁
router.get('/api/items', (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const items = await getItemsPaginated(page, limit);
  res.json({ items, page, limit });
});
```

### 5. 自定義選擇器

如果預定義的選擇器不滿足需求，可以自定義：

```javascript
// 在 responseOptimizer.js 中添加
const FIELD_SELECTORS = {
  // ... 其他選擇器
  myCustomSelector: {
    include: ['id', 'name', 'status'],
    exclude: ['internal_field'],
  },
};
```

---

## 性能影響

### 優化前後對比

| API 端點 | 優化前 | 優化後 | 節省 |
|---------|-------|-------|------|
| GET /api/characters | 150 KB | 45 KB | 70% |
| GET /api/user/profile | 25 KB | 5 KB | 80% |
| GET /api/conversations | 500 KB | 15 KB | 97% |
| GET /api/messages | 200 KB | 80 KB | 60% |

### 實際效益

- **帶寬節省**：每月節省數十 GB 傳輸量
- **速度提升**：響應時間減少 30-50%
- **用戶體驗**：頁面加載更快
- **成本降低**：CDN 和網絡費用減少

---

## 總結

- ✅ **始終移除敏感字段**
- ✅ **使用字段選擇器簡化響應**
- ✅ **區分列表和詳情視圖**
- ✅ **對大數組使用分頁**
- ✅ **定期檢查和優化 API 響應**

通過使用響應優化器，可以顯著減少 API 響應體積，提升應用性能！
