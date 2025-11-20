# 角色創建流程測試腳本

## 概述

`test-character-creation-flow.js` 是一個完整的端到端測試腳本，用於測試整個角色創建流程，從開始到完成。

## 測試步驟

腳本會按照以下順序測試完整的創建流程：

1. ✅ **創建 Flow** - 初始化角色創建流程
2. ✅ **設置性別和風格** - 選擇角色性別和風格偏好
3. ✅ **生成外觀描述** - 使用 AI 魔法師生成外觀描述（可選）
4. ✅ **保存外觀描述** - 將描述保存到流程中
5. ✅ **生成角色圖片** - 生成 4 張角色圖片（30-60 秒）
6. ✅ **選擇圖片** - 從生成的圖片中選擇一張
7. ✅ **生成角色設定** - 使用 AI 魔法師生成角色名稱、設定等
8. ✅ **獲取流程數據** - 驗證 Flow 數據完整性
9. ✅ **設置語音** - 選擇角色語音
10. ✅ **完成創建** - 將角色保存到資料庫

## 使用方法

### 1. 安裝依賴

```bash
cd chat-app/backend
npm install
```

### 2. 配置環境變數

確保 `.env` 文件中有以下配置：

```env
# API Base URL（可選，預設為 http://localhost:4000）
API_BASE_URL=http://localhost:4000

# 測試用戶 ID（可選，預設為 test-user）
TEST_USER_ID=test-user

# OpenAI API Key（必須，用於 AI 生成）
OPENAI_API_KEY=sk-...

# Gemini API Key（必須，用於圖片生成）
GEMINI_API_KEY=...
```

### 3. 啟動後端服務

```bash
# 在另一個終端中
cd chat-app/backend
npm run dev
```

### 4. 運行測試

```bash
cd chat-app/backend
node scripts/test-character-creation-flow.js
```

## 測試輸出

測試腳本會輸出詳細的步驟資訊和結果：

```
============================================================
步驟 1: 創建角色創建流程
============================================================
✅ Flow 創建成功: flow-1732020378910-abc123
ℹ️  初始狀態: draft

============================================================
步驟 2: 設置性別和風格偏好
============================================================
✅ 性別和風格設置成功
ℹ️  性別: female
ℹ️  風格: modern-urban, highschool-life

...（更多步驟）...

============================================================
步驟 ✅: 測試完成總結
============================================================
✅ Flow ID: flow-1732020378910-abc123
✅ 角色 ID: match-1732020450123-xyz789
✅ 角色名稱: 清澄
✅ 生成圖片數: 4
✅ 所有步驟執行成功！

🎉 測試成功完成！
✅ 總耗時: 45.3 秒
```

## 測試驗證項目

腳本會驗證以下項目：

### API 端點測試
- ✅ POST `/api/character-creation/flows` - 創建流程
- ✅ PUT `/api/character-creation/flows/:flowId/metadata` - 更新元數據
- ✅ POST `/api/character-creation/ai-description` - AI 描述生成
- ✅ PUT `/api/character-creation/flows/:flowId/appearance` - 更新外觀
- ✅ POST `/api/character-creation/flows/:flowId/images` - 生成圖片
- ✅ POST `/api/character-creation/flows/:flowId/ai-persona` - AI 角色設定生成
- ✅ GET `/api/character-creation/flows/:flowId` - 獲取流程數據
- ✅ PUT `/api/character-creation/flows/:flowId/voice` - 更新語音
- ✅ POST `/api/match/create` - 創建角色

### 業務邏輯驗證
- ✅ Flow 狀態正確轉換
- ✅ AI 魔法師使用次數追蹤
- ✅ 圖片生成成功（4 張）
- ✅ 角色設定字數限制（200 字內）
- ✅ 智能截斷功能（句子完整性）
- ✅ 資源扣除（創建次數/創建卡）
- ✅ name/display_name 字段兼容性
- ✅ 最終角色數據完整性

### 性能測試
- ⏱️ 圖片生成時間（預期 30-60 秒）
- ⏱️ AI 生成響應時間
- ⏱️ 整體流程完成時間

## 錯誤處理

腳本包含完整的錯誤處理：

- **速率限制 (429)**：顯示警告並繼續（可選步驟）
- **超時錯誤**：圖片生成設置 2 分鐘超時
- **驗證錯誤 (400)**：顯示詳細錯誤資訊
- **清理建議**：失敗時提供 Flow ID 以便手動清理

## 常見問題

### 1. 圖片生成超時

**問題**：`圖片生成失敗 - 請求超時`

**解決方案**：
- 檢查 Gemini API Key 是否正確
- 檢查網路連接
- 增加超時時間（修改 `timeout: 120000`）

### 2. 速率限制

**問題**：`速率限制：請稍後再試`

**解決方案**：
- 等待 1 分鐘後重試
- 檢查速率限制配置（`rateLimiterConfig.js`）
- 使用不同的測試用戶

### 3. AI 生成失敗

**問題**：`AI 魔法師生成失敗`

**解決方案**：
- 檢查 OpenAI API Key 是否正確
- 檢查 API 額度是否充足
- 查看後端日誌了解詳細錯誤

### 4. name 字段驗證錯誤

**問題**：`必須提供 name 或 display_name 其中之一`

**解決方案**：
- 已修復：後端現在同時接受兩者
- 確保 Flow 的 `persona.name` 已生成
- 檢查 AI 魔法師是否成功執行

## 測試數據

測試使用的預設數據：

```javascript
{
  gender: 'female',
  styles: ['modern-urban', 'highschool-life'],
  description: '一位年輕活潑的高中女生，有著長長的黑髮和明亮的眼睛',
  voice: 'shimmer',
}
```

## 自定義測試

你可以修改 `testData` 物件來測試不同的配置：

```javascript
const testData = {
  gender: 'male',  // 改為男性
  styles: ['steampunk', 'vampire-nocturne'],  // 更換風格
  description: '自定義描述...',
  voice: 'nova',  // 更換語音
};
```

## 相關文件

- `test-all-business-logic.js` - 完整商業邏輯測試
- `test-membership-upgrade.js` - 會員升級測試
- `test-user-assets.js` - 用戶資產測試
- `test-character-unlock.js` - 角色解鎖測試

## 注意事項

⚠️ **重要提醒**：

1. **環境選擇**：預設連接生產環境，建議使用 Firebase Emulator 測試
2. **API 成本**：每次測試會調用 OpenAI 和 Gemini API（產生費用）
3. **測試用戶**：使用測試帳號避免影響真實數據
4. **手動清理**：測試失敗可能留下未完成的 Flow，需手動清理

## 更新日誌

### 2025-01-19
- ✅ 初始版本完成
- ✅ 支援完整的 10 步驟流程
- ✅ 包含所有 API 端點測試
- ✅ 詳細的錯誤處理和日誌輸出
- ✅ 驗證 name/display_name 兼容性
- ✅ 驗證智能截斷功能
- ✅ 性能監控和時間追蹤
