# 🚨 緊急部署方案 - 明天 Demo 用

## ⏰ 預計時間：1 分鐘

---

## 步驟 1：訪問 Cloud Run 控制台

直接點擊：https://console.cloud.google.com/run/detail/asia-east1/chat-backend/revisions?project=chat-app-3-8a7ee

## 步驟 2：部署新版本

1. 點擊頂部的 **「EDIT & DEPLOY NEW REVISION」**（編輯並部署新版本）

2. 向下滾動到 **「VARIABLES & SECRETS」**（變數和密鑰）

3. 點擊 **「+ ADD VARIABLE」**（添加變數）

4. 添加以下環境變數：
   ```
   Name:  DISABLE_CSRF
   Value: true
   ```

5. 檢查 **CORS_ORIGIN** 是否已設置：
   ```
   Name:  CORS_ORIGIN
   Value: https://chat-app-all.pages.dev
   ```

   如果沒有，也添加這個。

6. 點擊底部的 **「DEPLOY」**（部署）

7. 等待 1-2 分鐘部署完成

## 步驟 3：驗證

1. 訪問你的前端：https://chat-app-all.pages.dev

2. 清除瀏覽器緩存：按 `Ctrl + Shift + Delete`，勾選「Cookies」和「快取」

3. 重新整理頁面，登入並發送測試訊息

**預期結果**：
- ✅ 消息成功發送
- ✅ 收到 AI 回覆
- ✅ 沒有 403 錯誤

---

## ⚠️ 重要提醒

這是**臨時方案**，僅用於緊急情況（明天 demo）。

Demo 後請儘快部署正式修復版本（參考 `DEPLOY_PRODUCTION.md`）。

---

## 🔧 如果仍然失敗

檢查後端日誌：

1. Cloud Run 控制台 → **LOGS** 標籤
2. 查找錯誤訊息
3. 截圖發給我，我立即幫你解決

---

**現在立即開始！** 🚀
