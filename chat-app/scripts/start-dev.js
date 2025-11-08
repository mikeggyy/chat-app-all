/**
 * 開發環境快速啟動指南
 */

console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   Chat App 開發環境啟動指南                      ║
╚════════════════════════════════════════════════════════════════╝

🚀 一鍵啟動（推薦）：

   npm run dev

   這個命令會自動：
   ✓ 啟動 Firebase Emulator
   ✓ 等待 Emulator 就緒
   ✓ 導入所有必要資料
   ✓ 啟動 Backend API
   ✓ 啟動 Frontend

   完成後可訪問：
   • Frontend:    http://localhost:5173
   • Backend API: http://localhost:4000
   • Emulator UI: http://localhost:4001

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 其他可用命令：

   npm run dev:no-import    # 啟動但不自動導入資料
   npm run import:all       # 單獨導入所有資料
   npm run import:characters # 只導入角色資料
   npm run import:configs   # 只導入系統配置
   npm run import:membership # 只導入會員方案
   npm run import:test-data # 只導入測試資料

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 快速登入測試：

   方式 1: Google 登入（使用 Emulator）
   • 點擊「使用 Google 登入」
   • 輸入任意 Email（例如：test@example.com）
   • 即可登入測試

   方式 2: 遊客登入
   • 點擊「遊客體驗」
   • 快速體驗功能

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 注意事項：

   ⚠️  Firebase Emulator 重啟後資料會清空
       下次啟動時會自動重新導入

   ⚠️  按 Ctrl+C 可停止所有服務

   💡 如果遇到 port 佔用問題：
       • Windows: netstat -ano | findstr "port"
       • 然後: taskkill /F /PID <PID>

════════════════════════════════════════════════════════════════
`);
