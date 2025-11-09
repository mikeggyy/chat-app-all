/**
 * 統一啟動腳本 - 同時啟動前後台所有服務（Production 模式）
 * 連接到真實的 Firebase 生產環境
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 顏色代碼
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const log = (color, prefix, message) => {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
};

// 主流程
const main = async () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           🚀 啟動 Love Story 完整系統（Production 模式）        ║
╚════════════════════════════════════════════════════════════════╝
`);

  try {
    const isWindows = process.platform === "win32";
    const npmCmd = isWindows ? "npm.cmd" : "npm";
    const processes = [];

    // 1. 啟動主應用 Backend
    log(colors.blue, "App Backend", "正在啟動主應用後端 API...");
    const appBackendProcess = spawn(npmCmd, ["run", "dev"], {
      cwd: join(__dirname, "chat-app", "backend"),
      stdio: "pipe",
      shell: true,
    });

    appBackendProcess.stdout.on("data", (data) => {
      process.stdout.write(`${colors.blue}[app-backend]${colors.reset} ${data}`);
    });

    appBackendProcess.stderr.on("data", (data) => {
      process.stderr.write(`${colors.blue}[app-backend]${colors.reset} ${data}`);
    });

    processes.push({ name: "App Backend", process: appBackendProcess });

    // 等待 2 秒讓後端啟動
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 2. 啟動主應用 Frontend
    log(colors.green, "App Frontend", "正在啟動主應用前端...");
    const appFrontendProcess = spawn(npmCmd, ["run", "dev"], {
      cwd: join(__dirname, "chat-app", "frontend"),
      stdio: "pipe",
      shell: true,
    });

    appFrontendProcess.stdout.on("data", (data) => {
      process.stdout.write(`${colors.green}[app-frontend]${colors.reset} ${data}`);
    });

    appFrontendProcess.stderr.on("data", (data) => {
      process.stderr.write(`${colors.green}[app-frontend]${colors.reset} ${data}`);
    });

    processes.push({ name: "App Frontend", process: appFrontendProcess });

    // 等待 1 秒
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. 啟動管理後台 Backend
    log(colors.magenta, "Admin Backend", "正在啟動管理後台 API...");
    const adminBackendProcess = spawn(npmCmd, ["run", "dev"], {
      cwd: join(__dirname, "chat-app-admin", "backend"),
      stdio: "pipe",
      shell: true,
    });

    adminBackendProcess.stdout.on("data", (data) => {
      process.stdout.write(`${colors.magenta}[admin-backend]${colors.reset} ${data}`);
    });

    adminBackendProcess.stderr.on("data", (data) => {
      process.stderr.write(`${colors.magenta}[admin-backend]${colors.reset} ${data}`);
    });

    processes.push({ name: "Admin Backend", process: adminBackendProcess });

    // 等待 2 秒讓後端啟動
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 4. 啟動管理後台 Frontend
    log(colors.cyan, "Admin Frontend", "正在啟動管理後台前端...");
    const adminFrontendProcess = spawn(npmCmd, ["run", "dev"], {
      cwd: join(__dirname, "chat-app-admin", "frontend"),
      stdio: "pipe",
      shell: true,
    });

    adminFrontendProcess.stdout.on("data", (data) => {
      process.stdout.write(`${colors.cyan}[admin-frontend]${colors.reset} ${data}`);
    });

    adminFrontendProcess.stderr.on("data", (data) => {
      process.stderr.write(`${colors.cyan}[admin-frontend]${colors.reset} ${data}`);
    });

    processes.push({ name: "Admin Frontend", process: adminFrontendProcess });

    // 等待所有服務啟動
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    ✨ 所有服務已成功啟動！                        ║
╠════════════════════════════════════════════════════════════════╣
║  📱 主應用 (Chat App)                                           ║
║     Frontend:       http://127.0.0.1:5173                      ║
║     Backend API:    http://127.0.0.1:4000                      ║
║                                                                ║
║  🔧 管理後台 (Admin Dashboard)                                  ║
║     Frontend:       http://127.0.0.1:5174                      ║
║     Backend API:    http://127.0.0.1:4001                      ║
║                                                                ║
║  🔥 Firebase (Production)                                      ║
║     Console:        https://console.firebase.google.com        ║
║     Project:        chat-app-3-8a7ee                           ║
╠════════════════════════════════════════════════════════════════╣
║  💡 按 Ctrl+C 停止所有服務                                       ║
╚════════════════════════════════════════════════════════════════╝
`);

    // 處理退出信號
    const cleanup = () => {
      log(colors.cyan, "System", "正在停止所有服務...");
      processes.forEach(({ name, process }) => {
        try {
          process.kill();
          log(colors.yellow, "System", `${name} 已停止`);
        } catch (error) {
          log(colors.red, "Error", `停止 ${name} 失敗: ${error.message}`);
        }
      });
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // 監聽子進程退出
    processes.forEach(({ name, process: childProcess }) => {
      childProcess.on("close", (code) => {
        if (code !== 0 && code !== null) {
          log(colors.red, "Error", `${name} 異常退出 (code: ${code})`);
          cleanup();
        }
      });
    });
  } catch (error) {
    log(colors.red, "Error", `啟動失敗: ${error.message}`);
    process.exit(1);
  }
};

main();
