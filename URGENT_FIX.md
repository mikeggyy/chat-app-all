# 🚨 緊急修復 - 立即執行（1 分鐘）

## 直接點擊這個鏈接：

👉 https://console.cloud.google.com/run/deploy/asia-east1/chat-backend?project=chat-app-3-8a7ee

## 設置步驟（照著做）：

### 1️⃣ 找到「Container」區塊

向下滾動，找到 **「Container」** 區塊

### 2️⃣ 點擊「VARIABLES & SECRETS」

展開「VARIABLES & SECRETS」→「Environment variables」

### 3️⃣ 添加變數

點擊「+ ADD VARIABLE」，添加：

```
Name:  DISABLE_CSRF
Value: true
```

### 4️⃣ 檢查 CORS_ORIGIN

確認是否已有這個變數：

```
Name:  CORS_ORIGIN
Value: https://chat-app-all.pages.dev
```

如果沒有，也添加這個。

### 5️⃣ 部署

點擊底部藍色按鈕「DEPLOY」

等待 1-2 分鐘，看到綠色勾勾 ✅

### 6️⃣ 測試

1. 回到你的應用：https://chat-app-all.pages.dev
2. 按 `Ctrl + Shift + R`（強制刷新）
3. 發送消息測試

---

## 如果還是不行

截圖給我看：
1. Cloud Run 的環境變數頁面
2. 瀏覽器的錯誤信息

---

**現在立即執行！** 🚀
