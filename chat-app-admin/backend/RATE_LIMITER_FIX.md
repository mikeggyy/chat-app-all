# 速率限制器標頭問題修復報告

## 問題描述

測試腳本無法檢測到速率限制標頭，導致所有測試失敗（0/5 通過）。

## 根本原因

**draft-7 組合標頭格式誤解**

1. **express-rate-limit v7** 使用 `draft-7` **組合格式**發送標頭：
   ```
   ratelimit-policy: 200;w=900
   ratelimit: limit=200, remaining=199, reset=900
   ```

   **而不是**分開的標頭：
   ```
   ratelimit-limit: 200
   ratelimit-remaining: 199
   ratelimit-reset: 900
   ```

2. **實際響應標頭**（來自調試輸出）：
   ```json
   {
     "ratelimit-policy": "200;w=900",
     "ratelimit": "limit=200, remaining=199, reset=900"
   }
   ```

3. **測試腳本** 檢查了錯誤的標頭格式：
   - 第一版：檢查 `x-ratelimit-*`（express-rate-limit v6 的舊格式）
   - 第二版：檢查 `ratelimit-limit`, `ratelimit-remaining`, `ratelimit-reset`（分開格式）
   - **正確格式**：應該檢查 `ratelimit-policy` 和 `ratelimit`（組合格式）

## 解決方案

### 1. 後端配置（已正確）✅

**文件**: `src/middleware/rateLimiterConfig.js`

所有 5 個速率限制器都已正確配置為使用 `draft-7` 格式：

```javascript
export const strictAdminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7', // ✅ 使用新的 RateLimit-* 標頭
  legacyHeaders: false,        // ✅ 禁用舊的 X-RateLimit-* 標頭
  keyGenerator: adminKeyGenerator,
  handler: createLimitHandler('...'),
  skipFailedRequests: true,
});
```

### 2. 路由應用（已正確）✅

**文件**: `src/routes/users.routes.js`

所有 5 個端點都已正確應用速率限制器：

| 端點 | 方法 | 限制器 | 限制 |
|------|------|--------|------|
| `/:userId` | GET | `relaxedAdminRateLimiter` | 200次/15分鐘 |
| `/:userId/usage-limits` | PATCH | `standardAdminRateLimiter` | 100次/15分鐘 |
| `/:userId/potions/details` | GET | `relaxedAdminRateLimiter` | 200次/15分鐘 |
| `/:userId/potion-effects` | GET | `relaxedAdminRateLimiter` | 200次/15分鐘 |
| `/:userId/resource-limits` | GET | `relaxedAdminRateLimiter` | 200次/15分鐘 |

### 3. 測試腳本修復 🔧

**文件**: `scripts/test-rate-limiter.js`

**修復前**（錯誤）：
```javascript
// ❌ 檢查分開的標頭（draft-7 不使用這種格式）
const limit = response.headers['ratelimit-limit'];
const remaining = response.headers['ratelimit-remaining'];
const reset = response.headers['ratelimit-reset'];
```

**修復後**（正確）：
```javascript
// ✅ 檢查 draft-7 組合標頭
const rateLimitPolicy = response.headers['ratelimit-policy'];
const rateLimit = response.headers['ratelimit'];

// 解析組合值
const match = rateLimit.match(/limit=(\d+), remaining=(\d+), reset=(\d+)/);
if (match) {
  // match[1] = limit, match[2] = remaining, match[3] = reset
}
```

**修改了 2 處**：
1. **第 256-299 行**：快速測試模式 - 檢測組合標頭並解析值
2. **第 77-88 行**：完整測試模式 - 顯示組合標頭

## 驗證步驟

### 1. 確保後端正在運行

```bash
cd chat-app-admin/backend
npm run dev
```

### 2. 運行快速測試

**Windows 批處理**：
```bash
雙擊 run-quick-test.bat
```

**PowerShell**：
```bash
雙擊 run-quick-test.ps1
```

**手動運行**：
```bash
node scripts/test-rate-limiter.js quick
```

### 3. 預期結果

```
✓ GET /api/users/:userId: 已應用速率限制器
  RateLimit-Policy: 200;w=900
  RateLimit: limit=200, remaining=199, reset=900
    → Limit: 200, Remaining: 199, Reset: 900s

✓ PATCH /api/users/:userId/usage-limits: 已應用速率限制器
  RateLimit-Policy: 100;w=900
  RateLimit: limit=100, remaining=99, reset=900
    → Limit: 100, Remaining: 99, Reset: 900s

✓ GET /api/users/:userId/potions/details: 已應用速率限制器
  RateLimit-Policy: 200;w=900
  RateLimit: limit=200, remaining=199, reset=900
    → Limit: 200, Remaining: 199, Reset: 900s

✓ GET /api/users/:userId/potion-effects: 已應用速率限制器
  RateLimit-Policy: 200;w=900
  RateLimit: limit=200, remaining=199, reset=899
    → Limit: 200, Remaining: 199, Reset: 899s

✓ GET /api/users/:userId/resource-limits: 已應用速率限制器
  RateLimit-Policy: 200;w=900
  RateLimit: limit=200, remaining=199, reset=898
    → Limit: 200, Remaining: 199, Reset: 898s

快速測試結果
  通過: 5/5

✓ 所有端點都已正確應用速率限制器
```

## 技術細節

### HTTP 標頭命名規範

**RFC 標準** HTTP 標頭名稱是**不區分大小寫**的：
- `Content-Type` = `content-type` = `CONTENT-TYPE`

**axios 實現**：為了一致性，axios 將所有標頭名稱轉換為小寫存儲在 `response.headers` 對象中。

### express-rate-limit 標頭格式演變

| 版本 | standardHeaders 值 | 發送的標頭格式 |
|------|-------------------|--------------|
| v6.x | `true` | `X-RateLimit-Limit: 200`<br>`X-RateLimit-Remaining: 199` |
| v7.x | `'draft-6'` | `X-RateLimit-Limit: 200`<br>`X-RateLimit-Remaining: 199` |
| v7.x | `'draft-7'` | `RateLimit-Policy: 200;w=900`<br>`RateLimit: limit=200, remaining=199, reset=900` |

**draft-7 組合格式說明**：

1. **RateLimit-Policy**: 速率限制策略
   - 格式：`{limit};w={window_seconds}`
   - 示例：`200;w=900` = 200次請求/900秒（15分鐘）

2. **RateLimit**: 當前狀態（組合值）
   - 格式：`limit={max}, remaining={left}, reset={seconds}`
   - 示例：`limit=200, remaining=199, reset=900`
   - `limit`: 時間窗口內的最大請求數
   - `remaining`: 時間窗口內的剩餘請求數
   - `reset`: 重置前的剩餘秒數

**draft-7 優勢**：
- 符合最新 IETF 草案標準（RFC 6585 更新）
- 更簡潔的標頭名稱（無 `X-` 前綴）
- 組合格式減少 HTTP 標頭數量
- 包含完整的策略信息（`RateLimit-Policy`）

## 調試工具

測試腳本包含詳細的調試輸出（第 252-254 行）：

```javascript
console.log(`\n[DEBUG] 所有響應頭 for ${endpoint.method} ${endpoint.path}:`);
console.log(JSON.stringify(response.headers, null, 2));
```

這會顯示所有 HTTP 響應標頭，方便診斷問題。

## 修復總結

✅ **後端配置**：正確使用 `standardHeaders: 'draft-7'`（組合格式）
✅ **路由應用**：5 個端點全部添加速率限制器
✅ **測試腳本**：修正為檢查組合標頭（`ratelimit-policy` + `ratelimit`）
✅ **標頭解析**：自動解析組合值並顯示詳細信息
✅ **文檔完善**：添加 draft-7 組合格式完整說明

**關鍵發現**：
- 速率限制器**一直都在正常工作**
- 問題在於測試腳本檢查了錯誤的標頭格式
- draft-7 使用**組合標頭**，而非分開的標頭

**測試現在應該可以正常通過了！** 🎉

---

**創建時間**: 2025-01-13
**修復文件**: `scripts/test-rate-limiter.js`
**相關配置**: `src/middleware/rateLimiterConfig.js`, `src/routes/users.routes.js`
