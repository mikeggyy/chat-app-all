# IPv6 快速修復腳本（需要管理員權限）
# 用於解決本地開發環境 Cloudflare R2 連接問題

Write-Host "🔧 IPv6 連接問題修復工具" -ForegroundColor Cyan
Write-Host ""

# 檢查管理員權限
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 需要管理員權限！" -ForegroundColor Red
    Write-Host "請右鍵點擊 PowerShell，選擇「以系統管理員身分執行」" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按 Enter 鍵退出"
    exit 1
}

Write-Host "✅ 管理員權限確認" -ForegroundColor Green
Write-Host ""

# 獲取所有網絡適配器
$adapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" }

Write-Host "📡 找到的活動網絡適配器:" -ForegroundColor Cyan
foreach ($adapter in $adapters) {
    Write-Host "  - $($adapter.Name) ($($adapter.InterfaceDescription))"
}
Write-Host ""

# 詢問用戶
Write-Host "⚠️  這將禁用所有活動網絡適配器的 IPv6" -ForegroundColor Yellow
Write-Host "這是臨時解決方案，用於測試 Cloudflare R2 連接問題" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "確定要繼續嗎？(Y/N)"

if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "已取消" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🔧 正在禁用 IPv6..." -ForegroundColor Cyan

try {
    # 禁用所有活動適配器的 IPv6
    foreach ($adapter in $adapters) {
        Set-NetAdapterBinding -Name $adapter.Name -ComponentID ms_tcpip6 -Enabled $false
        Write-Host "  ✅ 已禁用: $($adapter.Name)" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "🔄 清除 DNS 快取..." -ForegroundColor Cyan
    ipconfig /flushdns | Out-Null
    Write-Host "  ✅ DNS 快取已清除" -ForegroundColor Green

    Write-Host ""
    Write-Host "✅ 完成！" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 後續步驟:" -ForegroundColor Cyan
    Write-Host "  1. 重啟瀏覽器（完全關閉後重新開啟）"
    Write-Host "  2. 清除瀏覽器快取（Ctrl+Shift+Delete）"
    Write-Host "  3. 訪問應用並測試影片播放"
    Write-Host ""
    Write-Host "🔄 恢復 IPv6（測試完成後）:" -ForegroundColor Yellow
    Write-Host "   .\restore-ipv6.ps1"
    Write-Host ""

    # 創建恢復腳本
    $restoreScript = @"
# IPv6 恢復腳本
Write-Host "🔧 恢復 IPv6..." -ForegroundColor Cyan

`$adapters = Get-NetAdapter | Where-Object { `$_.Status -eq "Up" }
foreach (`$adapter in `$adapters) {
    Set-NetAdapterBinding -Name `$adapter.Name -ComponentID ms_tcpip6 -Enabled `$true
    Write-Host "  ✅ 已啟用: `$(`$adapter.Name)" -ForegroundColor Green
}

ipconfig /flushdns | Out-Null
Write-Host ""
Write-Host "✅ IPv6 已恢復！" -ForegroundColor Green
"@

    $restoreScript | Out-File -FilePath ".\restore-ipv6.ps1" -Encoding UTF8
    Write-Host "✅ 已創建恢復腳本: restore-ipv6.ps1" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "❌ 錯誤: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "可能原因:" -ForegroundColor Yellow
    Write-Host "  1. 沒有管理員權限"
    Write-Host "  2. 網絡適配器不支援此操作"
    Write-Host ""
}

Write-Host ""
Read-Host "按 Enter 鍵退出"
