# IPv6 連接問題診斷與解決方案

## 🔍 問題現象

您可能遇到以下情況：
- ✅ **生產環境**: 影片和圖片正常顯示
- ❌ **本地開發**: 影片無法播放，錯誤 `ERR_CONNECTION_RESET`
- ❌ **禮物照片**: 生成失敗，錯誤 `DOWNLOAD_FAILED: fetch failed`

**關鍵觀察**:
- 之前本地開發是正常的
- 突然開始失敗
- 生產環境一直正常

## 🎯 問題根源

**IPv6 連接不穩定**

Cloudflare R2 同時支援 IPv4 和 IPv6：
- `2606:4700:3113::6812:362d` (IPv6)
- `104.18.54.45` (IPv4)

瀏覽器和 Node.js 的 `fetch` 預設**優先使用 IPv6**。

在某些網絡環境下（特別是台灣的某些 ISP），IPv6 連接可能：
- ✅ DNS 解析成功
- ✅ Ping 成功
- ❌ HTTP/HTTPS 連接被重置 (`Connection reset`)

## 🧪 診斷步驟

### 步驟 1: 運行診斷工具

```bash
cd chat-app
node scripts/diagnose-network.js
```

**典型輸出（IPv6 問題）**:
```
🧪 測試 IPv4 和 IPv6 連接性...

📊 測試結果:

IPv6 (默認):
  - 狀態: ❌ 失敗
  - 錯誤: fetch failed

IPv4 (強制):
  - 狀態: ✅ 成功
  - 響應時間: 250ms

💡 建議:
  ⚠️  您的網絡環境 IPv6 連接不穩定
  ✅ 後端已自動使用 IPv4 連接（智能 fetch）
```

### 步驟 2: 手動驗證

**測試 IPv6（默認）**:
```bash
curl -I https://pub-5187f353f7054fb9822594d3416854ea.r2.dev
```

**預期錯誤**:
```
curl: (35) Recv failure: Connection was reset
```

**測試 IPv4（強制）**:
```bash
curl -I -4 https://pub-5187f353f7054fb9822594d3416854ea.r2.dev
```

**預期成功**:
```
HTTP/1.1 404 Not Found
Date: ...
Server: cloudflare
```

## ✅ 解決方案

### 方案 1: 後端自動修復（已實現）✅

**位置**: `backend/src/utils/networkFetch.js`

**功能**: 智能 Fetch
- 第一次嘗試：使用默認方式（可能是 IPv6）
- 如果失敗且錯誤包含 "reset"：自動重試 IPv4
- 透明處理，無需修改現有代碼

**已應用到**:
- ✅ 禮物照片下載 (`giftResponse.service.js`)
- 🔄 未來可擴展到其他服務

**測試**:
```bash
# 重啟後端
cd chat-app/backend
npm run dev

# 測試送禮物
# 應該能成功下載角色照片並生成禮物照片
```

---

### 方案 2: 前端影片播放問題

前端影片播放由**瀏覽器**直接處理，無法在代碼層面強制使用 IPv4。

#### **選項 2A: 使用代理（推薦用於開發）**

在後端添加影片代理端點：

**實現**: 創建 `backend/src/routes/proxy.routes.js`
```javascript
import express from 'express';
import { smartFetch } from '../utils/networkFetch.js';

const router = express.Router();

// 代理 R2 影片請求
router.get('/proxy/video/*', async (req, res) => {
  const videoPath = req.params[0];
  const r2Url = `${process.env.R2_PUBLIC_URL}/${videoPath}`;

  try {
    const response = await smartFetch(r2Url);

    // 複製 headers
    res.set('Content-Type', response.headers.get('content-type'));
    res.set('Content-Length', response.headers.get('content-length'));
    res.set('Cache-Control', 'public, max-age=31536000');

    // 串流影片
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: '影片代理失敗' });
  }
});

export default router;
```

**前端修改**: 影片 URL 改為通過後端代理
```javascript
// 原始 URL: https://pub-xxx.r2.dev/videos/...
// 代理 URL: http://localhost:4000/api/proxy/video/videos/...
```

**優點**: 完全解決 IPv6 問題
**缺點**: 增加後端負載，不適合大量用戶

#### **選項 2B: 修改本地網絡設置**

**Windows 10/11**:

1. **禁用 IPv6**（臨時測試）:
   ```powershell
   # 以管理員身份運行 PowerShell
   Set-NetAdapterBinding -Name "乙太網路" -ComponentID ms_tcpip6 -Enabled $false

   # 或通過網絡設置 GUI:
   # 控制台 → 網路和網際網路 → 網路連線 → 右鍵乙太網路 → 內容
   # 取消勾選「Internet Protocol Version 6 (TCP/IPv6)」
   ```

2. **清除 DNS 快取**:
   ```powershell
   ipconfig /flushdns
   ```

3. **重啟瀏覽器**

4. **測試**: 影片應該能正常播放了

5. **恢復 IPv6**（測試完成後）:
   ```powershell
   Set-NetAdapterBinding -Name "乙太網路" -ComponentID ms_tcpip6 -Enabled $true
   ```

#### **選項 2C: 使用 VPN 或行動網絡**

**臨時解決方案**:
- 使用手機熱點（4G/5G）
- 使用 VPN 改變網絡路由
- 切換到其他網絡環境

#### **選項 2D: 設置 Cloudflare Workers 代理（生產環境）**

如果問題影響真實用戶，可以使用 Cloudflare Workers 作為代理。

---

### 方案 3: ISP 層面解決（長期）

**聯繫您的 ISP**（中華電信、台灣大哥大等）:
1. 說明 IPv6 連接 Cloudflare 服務時出現 `Connection Reset`
2. 請求檢查 IPv6 路由設置
3. 或請求暫時停用 IPv6

**常見 ISP IPv6 問題**:
- HiNet（中華電信）: 某些地區 IPv6 不穩定
- 台灣大哥大: IPv6 尚未完全普及
- 遠傳: IPv6 支援有限

---

## 🧪 驗證修復

### 後端驗證

```bash
# 1. 重啟後端
cd chat-app/backend
npm run dev

# 2. 測試送禮物（帶照片）
# 前端操作：選擇角色 → 送禮物 → 選擇有照片的禮物
# 查看後端日誌，應該看到：
# [網絡請求] 檢測到連接重置，嘗試使用 IPv4: ...
# [禮物回應] ✅ 成功下載角色肖像
```

### 前端驗證

```bash
# 選項 1: 禁用 IPv6 後測試
# （見方案 2B）

# 選項 2: 使用行動網絡
# 手機開熱點 → 電腦連接 → 測試影片播放
```

---

## 📊 影響範圍

| 功能 | IPv6 影響 | 解決狀態 |
|-----|----------|---------|
| **後端下載角色照片** | ❌ 失敗 | ✅ 已修復（智能 fetch） |
| **前端影片播放** | ❌ 失敗 | ⚠️ 需要額外處理（見方案 2） |
| **前端圖片顯示** | ❌ 可能失敗 | ⚠️ 同上 |
| **生產環境** | ✅ 正常 | ✅ 用戶網絡通常支援 IPv6 |

---

## 🎯 推薦方案總結

**開發環境（您現在的情況）**:

1. ✅ **後端**: 已自動修復（使用智能 fetch）
2. ⚠️ **前端影片**:
   - **快速方案**: 暫時禁用 Windows IPv6（方案 2B）
   - **長期方案**: 實現後端代理（方案 2A）

**生產環境**:
- ✅ 通常無需特殊處理
- ✅ 用戶網絡環境多樣，IPv6 問題影響面小
- 🔄 如果用戶回報類似問題，考慮實現 Cloudflare Workers 代理（方案 2D）

---

## 🔧 快速修復腳本

創建 `scripts/fix-ipv6.ps1` (PowerShell):

```powershell
# 禁用 IPv6（需要管理員權限）
Write-Host "禁用 IPv6..."
Set-NetAdapterBinding -Name "*" -ComponentID ms_tcpip6 -Enabled $false

# 清除 DNS 快取
Write-Host "清除 DNS 快取..."
ipconfig /flushdns

Write-Host "完成！請重啟瀏覽器並測試"
Write-Host "恢復 IPv6: Set-NetAdapterBinding -Name '*' -ComponentID ms_tcpip6 -Enabled `$true"
```

**使用**:
```powershell
# 以管理員身份運行 PowerShell
cd chat-app\scripts
.\fix-ipv6.ps1
```

---

## 📚 相關資源

- [Cloudflare IPv6 文檔](https://developers.cloudflare.com/fundamentals/get-started/concepts/ipv6/)
- [Node.js net.Agent 文檔](https://nodejs.org/api/net.html#net_class_net_socket)
- [Windows IPv6 設置](https://support.microsoft.com/zh-tw/windows/enable-or-disable-ipv6-in-windows-bedd5106-5e24-4413-9bc1-87b5f9b0e1df)

---

## 🆘 仍然無法解決？

如果上述方案都無效，請提供：

1. **診斷工具輸出**:
   ```bash
   node scripts/diagnose-network.js > network-report.txt
   ```

2. **網絡環境資訊**:
   - ISP 名稱（中華電信、台灣大哥大等）
   - 連接方式（光纖、Cable、4G/5G）
   - 是否使用路由器

3. **瀏覽器 DevTools 截圖**:
   - F12 → Network 標籤
   - 失敗的影片請求詳情

我會幫您進一步診斷！
