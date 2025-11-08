# API 錯誤處理指南

## 概述

本專案使用統一的錯誤處理系統，確保前後端錯誤格式一致，便於前端處理和用戶體驗。

## 統一錯誤格式

所有 API 錯誤響應都遵循以下格式：

```json
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "請求數據驗證失敗",
  "details": {
    "errors": [
      { "field": "email", "message": "無效的郵箱格式" }
    ]
  },
  "requestId": "req_abc123",
  "timestamp": "2025-11-08T10:30:00.000Z"
}
```

## 使用方式

### 1. 後端 - 在路由中使用

#### 方式 A：使用 `sendError()` 快速發送錯誤

```javascript
import { sendError, sendSuccess } from "../../../shared/utils/errorFormatter.js";

router.get("/users/:userId", async (req, res) => {
  try {
    const user = await getUserById(req.params.userId);

    if (!user) {
      return sendError(res, "USER_NOT_FOUND", "找不到該用戶", { userId: req.params.userId });
    }

    sendSuccess(res, user);
  } catch (error) {
    sendError(res, "INTERNAL_SERVER_ERROR");
  }
});
```

#### 方式 B：拋出 `ApiError`

```javascript
import { ApiError } from "../../../shared/utils/errorFormatter.js";

router.post("/users", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new ApiError("MISSING_REQUIRED_FIELD", "缺少必要字段", { field: "email" });
    }

    const user = await createUser(req.body);
    sendSuccess(res, user);
  } catch (error) {
    // ApiError 會自動被錯誤處理中間件捕獲
    throw error;
  }
});
```

#### 方式 C：使用全局錯誤處理中間件

```javascript
// 在 Express 應用的最後添加
import { errorHandlerMiddleware } from "../../../shared/utils/errorFormatter.js";

app.use(errorHandlerMiddleware);
```

### 2. 常見錯誤場景

#### 驗證錯誤

```javascript
import { validationErrorResponse } from "../../../shared/utils/errorFormatter.js";

const errors = [];
if (!email) errors.push({ field: "email", message: "郵箱是必填項" });
if (!password) errors.push({ field: "password", message: "密碼是必填項" });

if (errors.length > 0) {
  const errorResponse = validationErrorResponse(errors);
  return res.status(errorResponse.status).json(errorResponse);
}
```

#### 限制錯誤

```javascript
import { limitErrorResponse } from "../../../shared/utils/errorFormatter.js";

if (conversationCount >= limit) {
  const errorResponse = limitErrorResponse("conversation", {
    current: conversationCount,
    limit: limit,
    resetAt: resetTime.toISOString(),
    membershipTier: "free"
  });
  return res.status(errorResponse.status).json(errorResponse);
}
```

#### Firebase 錯誤自動映射

```javascript
import { errorFromException } from "../../../shared/utils/errorFormatter.js";

try {
  await auth.updateUser(userId, { email: newEmail });
} catch (error) {
  // Firebase 錯誤會自動映射到統一錯誤碼
  const errorResponse = errorFromException(error);
  return res.status(errorResponse.status).json(errorResponse);
}
```

### 3. 前端 - 處理錯誤

#### 方式 A：在 API 工具中統一處理

```javascript
// frontend/src/utils/api.js
export const apiJson = async (url, options) => {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    // 統一的錯誤格式
    const error = new Error(data.message);
    error.code = data.code;
    error.status = data.status;
    error.details = data.details;
    error.requestId = data.requestId;
    throw error;
  }

  return data;
};
```

#### 方式 B：在組件中處理

```javascript
try {
  const user = await apiJson(`/api/users/${userId}`, { method: "GET" });
  console.log("用戶數據:", user);
} catch (error) {
  // 根據錯誤碼顯示不同的訊息
  switch (error.code) {
    case "USER_NOT_FOUND":
      notification.error({ message: "用戶不存在" });
      break;
    case "AUTH_UNAUTHORIZED":
      notification.error({ message: "請先登入" });
      router.push("/login");
      break;
    case "CONVERSATION_LIMIT_REACHED":
      notification.warning({
        message: "對話次數已達上限",
        description: `重置時間：${error.details.resetAt}`
      });
      break;
    default:
      notification.error({ message: error.message });
  }
}
```

## 可用的錯誤碼

### 認證錯誤 (401, 403)
- `AUTH_UNAUTHORIZED` - 未授權訪問
- `AUTH_TOKEN_INVALID` - 無效的認證令牌
- `AUTH_TOKEN_EXPIRED` - 認證令牌已過期
- `AUTH_INSUFFICIENT_PERMISSIONS` - 權限不足

### 用戶錯誤 (404, 409, 403)
- `USER_NOT_FOUND` - 用戶不存在
- `USER_ALREADY_EXISTS` - 用戶已存在
- `USER_DISABLED` - 用戶帳號已被停用

### 資源錯誤 (404, 409, 429)
- `RESOURCE_NOT_FOUND` - 資源不存在
- `RESOURCE_ALREADY_EXISTS` - 資源已存在
- `RESOURCE_LIMIT_EXCEEDED` - 資源使用超過限制

### 驗證錯誤 (400)
- `VALIDATION_ERROR` - 請求數據驗證失敗
- `INVALID_REQUEST` - 無效的請求
- `MISSING_REQUIRED_FIELD` - 缺少必要字段
- `INVALID_FIELD_VALUE` - 字段值無效

### 會員系統錯誤 (403)
- `MEMBERSHIP_REQUIRED` - 需要會員資格
- `MEMBERSHIP_TIER_INSUFFICIENT` - 會員等級不足
- `MEMBERSHIP_EXPIRED` - 會員資格已過期

### 支付錯誤 (402, 400)
- `PAYMENT_FAILED` - 支付失敗
- `INSUFFICIENT_BALANCE` - 餘額不足
- `INVALID_PAYMENT_METHOD` - 無效的支付方式

### 限制錯誤 (429)
- `RATE_LIMIT_EXCEEDED` - 請求過於頻繁
- `CONVERSATION_LIMIT_REACHED` - 對話次數已達上限
- `VOICE_LIMIT_REACHED` - 語音次數已達上限
- `PHOTO_LIMIT_REACHED` - 拍照次數已達上限
- `VIDEO_LIMIT_REACHED` - 影片次數已達上限

### AI 服務錯誤 (500, 503, 504)
- `AI_SERVICE_UNAVAILABLE` - AI 服務暫時不可用
- `AI_GENERATION_FAILED` - AI 生成失敗
- `AI_TIMEOUT` - AI 服務超時

### 系統錯誤 (500, 502, 503)
- `INTERNAL_SERVER_ERROR` - 伺服器內部錯誤
- `DATABASE_ERROR` - 資料庫錯誤
- `EXTERNAL_SERVICE_ERROR` - 外部服務錯誤
- `SERVICE_UNAVAILABLE` - 服務暫時不可用

### 冪等性錯誤 (409)
- `DUPLICATE_REQUEST` - 重複的請求
- `IDEMPOTENCY_CONFLICT` - 冪等性衝突

## 最佳實踐

### 1. 使用適當的錯誤碼
選擇最具體的錯誤碼，而不是使用通用的 `INTERNAL_SERVER_ERROR`。

❌ 不好：
```javascript
sendError(res, "INTERNAL_SERVER_ERROR", "找不到用戶");
```

✅ 好：
```javascript
sendError(res, "USER_NOT_FOUND", "找不到該用戶", { userId });
```

### 2. 提供有用的詳細信息
在 `details` 字段中提供足夠的上下文信息。

```javascript
sendError(res, "VALIDATION_ERROR", null, {
  errors: [
    { field: "email", message: "必須是有效的郵箱地址" },
    { field: "password", message: "長度至少 8 個字符" }
  ]
});
```

### 3. 記錄錯誤
使用 `requestId` 追蹤錯誤，便於調試。

```javascript
console.error(`[${requestId}] Error:`, error);
```

### 4. 不洩露敏感信息
在生產環境中避免返回堆棧追蹤或內部錯誤詳情。

```javascript
// errorFormatter 已自動處理：
// 生產環境：只返回通用錯誤訊息
// 開發環境：返回詳細錯誤和堆棧追蹤
```

### 5. 一致的成功響應
使用 `sendSuccess()` 確保成功響應格式統一。

```javascript
sendSuccess(res, users, { total: 100, page: 1, limit: 20 });

// 響應格式：
// {
//   "success": true,
//   "data": [...],
//   "meta": { "total": 100, "page": 1, "limit": 20 }
// }
```

## 遷移指南

### 現有代碼遷移

#### 1. 替換舊的錯誤響應

❌ 舊代碼：
```javascript
res.status(404).json({ error: "用戶不存在" });
```

✅ 新代碼：
```javascript
sendError(res, "USER_NOT_FOUND");
```

#### 2. 統一成功響應

❌ 舊代碼：
```javascript
res.json({ data: users, total: count });
```

✅ 新代碼：
```javascript
sendSuccess(res, users, { total: count });
```

#### 3. 添加全局錯誤處理

```javascript
// 在 Express 應用的最後添加（所有路由之後）
app.use(errorHandlerMiddleware);
```

## 相關文件

- `shared/utils/errorCodes.js` - 錯誤碼定義
- `shared/utils/errorFormatter.js` - 錯誤格式化工具
- `chat-app-3/backend/src/index.js` - 主應用後端示例
- `chat-app-admin/backend/src/index.js` - 管理後台後端示例

## 問題排查

### 錯誤沒有被正確捕獲
確保路由處理器中的錯誤被拋出或傳遞給 next()：

```javascript
router.get("/users/:userId", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.userId);
    sendSuccess(res, user);
  } catch (error) {
    next(error);  // 傳遞給錯誤處理中間件
  }
});
```

### Firebase 錯誤映射不正確
檢查 `errorCodes.js` 中的 `FIREBASE_ERROR_MAPPING`，確保包含所需的映射。

### 前端無法正確解析錯誤
確保前端 API 工具正確解析錯誤響應的 JSON 格式。
