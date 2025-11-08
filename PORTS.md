# 端口配置說明

## 啟用的服務（4 個）

| 服務名稱 | 端口 | 說明 | 訪問地址 |
|---------|------|------|---------|
| 前台前端 | 5173 | Chat App 用戶界面 | http://localhost:5173 |
| 前台後端 | 4000 | Chat App API 服務 | http://localhost:4000 |
| 後台前端 | 5174 | 管理後臺界面 | http://localhost:5174 |
| 後台後端 | 4001 | 管理後臺 API 服務 | http://localhost:4001 |

## 已禁用的服務

以下服務已被移除，不再使用：

| 服務名稱 | 端口 | 狀態 |
|---------|------|------|
| Firebase Emulator UI | 4000 | ❌ 已禁用 (firebase.json) |
| Firebase Auth Emulator | 9099 | ❌ 不啟動 |
| Firebase Firestore Emulator | 8080 | ❌ 不啟動 |
| Firebase Storage Emulator | 9299 | ❌ 不啟動 |

## 啟動指令

### 前台應用 (chat-app-3)
```bash
cd chat-app-3
npm run dev
```
這會啟動：
- 前台後端 (4000)
- 前台前端 (5173)

### 後台管理 (chat-app-admin)
```bash
cd chat-app-admin
npm run dev
```
這會啟動：
- 後台後端 (4001)
- 後台前端 (5174)

## 配置文件

### chat-app-3/package.json
- `dev`: 只啟動前後端（不含 Emulator）
- `dev:with-emulator`: 啟動 Emulator + 前後端 + 自動導入數據

### chat-app-3/backend/.env
- `PORT=4000`
- 沒有設置 `USE_FIREBASE_EMULATOR`（默認使用雲端 Firebase）

### chat-app-admin/backend/.env
- `PORT=4001`
- 沒有設置 `USE_FIREBASE_EMULATOR`（默認使用雲端 Firebase）

### firebase.json
- Firebase Emulator UI 已禁用：`"enabled": false`

## 故障排除

### 端口被佔用
```bash
# Windows 查看端口佔用
netstat -ano | findstr :4000
netstat -ano | findstr :4001
netstat -ano | findstr :5173
netstat -ano | findstr :5174

# 終止進程
taskkill //F //PID <PID>
```

### 清理端口（chat-app-3）
```bash
cd chat-app-3
npm run cleanup-ports
```

## 注意事項

1. **不要同時運行多個 dev 腳本**：確保在啟動新服務前停止舊服務
2. **使用雲端 Firebase**：所有服務都連接到雲端 Firebase，不使用本地 Emulator
3. **保持端口獨立**：前台和後台使用不同端口，避免衝突
