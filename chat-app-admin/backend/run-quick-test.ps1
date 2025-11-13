# 管理後台速率限制器快速測試腳本
# PowerShell 版本

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "管理後台速率限制器測試" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 設置 Admin Token
$env:ADMIN_TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MDI5MzRmZTBlZWM0NmE1ZWQwMDA2ZDE0YTFiYWIwMWUzNDUwODMiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiTWlrZSAo6LaF57Sa566h55CG5ZOhKSIsInN1cGVyX2FkbWluIjp0cnVlLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vY2hhdC1hcHAtMy04YTdlZSIsImF1ZCI6ImNoYXQtYXBwLTMtOGE3ZWUiLCJhdXRoX3RpbWUiOjE3NjI4MzcyNzAsInVzZXJfaWQiOiJ4V2JyeHl2cU9qWVNRNFYxaUhrUHZCMHM0QzAyIiwic3ViIjoieFdicnh5dnFPallTUTRWMWlIa1B2QjBzNEMwMiIsImlhdCI6MTc2Mjk5NzM5NywiZXhwIjoxNzYzMDAwOTk3LCJlbWFpbCI6Im1pa2U2NjZAYWRtaW4uY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsibWlrZTY2NkBhZG1pbi5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.Zb58x-agdYuYDPGpf-KB_96DUrHjQYOGxjLyG5KPW6IvqI-r_Y2UL84YAQq1jcGoSyXZAKQJvW3aUE0h4AdMzv_IwKK-RUYjXqjzKP8eYSaQMjIzJiO_LzvaDtyemRJ_M0-at9_O64pDfMMFdJPt5P2jUCUeCycrClQUUwzj5A4Oa6Gy2r1kyKzqeNluR1FKRj39o5w8kDmK-Reiwaq25oXY9Pn3EkBYBIqNYJzY5GvGV1glbtqWGUqIVjS6JTdjRl4EXbPxqCdICkceRCoIsOX9k6KzFrESW7A0rTBH_sEDEZLtI9TdEkDUn17MxNH3hl66ChCd5FNpwIM0Bv0N8w"

Write-Host "✓ Token 已設置" -ForegroundColor Green
Write-Host ""
Write-Host "當前目錄: $(Get-Location)" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "開始測試速率限制器..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# 運行測試
node scripts/test-rate-limiter.js quick

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "測試完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 等待用戶按鍵
Write-Host "按任意鍵繼續..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
