# 🚨 立即部署修復 - 使用 Cloud Shell

## 步驟 1：打開 Cloud Shell

1. 訪問：https://console.cloud.google.com/?project=chat-app-3-8a7ee
2. 點擊右上角的 **Cloud Shell** 圖標（`>_`）
3. 等待 Cloud Shell 啟動（約 10 秒）

## 步驟 2：上傳修改的文件

在 Cloud Shell 中，點擊右上角的 **「⋮」** → **「Upload」**

依次上傳這兩個文件：

### 文件 1：
```
d:\project\chat-app-all\chat-app\backend\src\index.js
```

### 文件 2：
```
d:\project\chat-app-all\shared\backend-utils\csrfProtection.js
```

上傳後，文件會在 `~` 目錄（主目錄）。

## 步驟 3：創建部署目錄並移動文件

在 Cloud Shell 中執行以下命令（複製貼上）：

```bash
# 創建目錄結構
mkdir -p ~/backend-deploy/src
mkdir -p ~/backend-deploy/shared/backend-utils

# 移動文件到正確位置
mv ~/index.js ~/backend-deploy/src/
mv ~/csrfProtection.js ~/backend-deploy/shared/backend-utils/

# 進入目錄
cd ~/backend-deploy
```

## 步驟 4：創建 Dockerfile

執行以下命令（複製整段貼上）：

```bash
cat > Dockerfile << 'EOF'
FROM gcr.io/chat-app-3-8a7ee/chat-backend:latest

# 複製修改的文件
COPY src/index.js /app/src/index.js
COPY shared/backend-utils/csrfProtection.js /app/shared/backend-utils/csrfProtection.js

# 重啟應用
CMD ["node", "/app/src/index.js"]
EOF
```

## 步驟 5：構建並部署

執行以下命令（複製貼上，會需要 2-3 分鐘）：

```bash
# 構建新映像
gcloud builds submit --tag gcr.io/chat-app-3-8a7ee/chat-backend .

# 部署到 Cloud Run
gcloud run deploy chat-backend \
  --image gcr.io/chat-app-3-8a7ee/chat-backend \
  --region asia-east1 \
  --project chat-app-3-8a7ee \
  --platform managed
```

看到 `Service [chat-backend] revision [chat-backend-xxxxx] has been deployed` 就成功了！

## 步驟 6：測試

1. 訪問：https://chat-app-all.pages.dev
2. 按 `Ctrl + Shift + R`（強制刷新）
3. 發送測試消息

應該就正常了！✅

---

## 如果還有問題

檢查 Cloud Run 日誌：

```bash
gcloud run logs read chat-backend --region asia-east1 --limit 50
```

查找是否有這行：
```
[CSRF] ⚠️ CSRF 保護已禁用（DISABLE_CSRF=true）
```

如果看到這行，說明環境變數生效了。

---

**現在立即執行！** 🚀
