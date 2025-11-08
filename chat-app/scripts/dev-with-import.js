/**
 * 開發環境智能啟動腳本
 * 會自動檢查並導入資料，然後啟動所有服務
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import http from "http";
import { PORTS, URLS } from "../config/ports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// 顏色代碼
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

const log = (color, prefix, message) => {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
};

// 檢查 port 是否可用
const checkPort = (port) => {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, () => {
      resolve(true);
    });
    req.on("error", () => {
      resolve(false);
    });
    req.end();
  });
};

// 等待 port 就緒
const waitForPort = async (port, maxRetries = 30, interval = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    const isReady = await checkPort(port);
    if (isReady) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return false;
};

// 執行命令
const runCommand = (command, args, options = {}) => {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const child = spawn(command, args, {
      cwd: options.cwd || rootDir,
      stdio: options.stdio || "inherit",
      shell: isWindows ? "cmd.exe" : true,
      ...options,
    });

    child.on("close", (code) => {
      if (code === 0 || options.background) {
        resolve(child);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });

    // 如果需要返回 child process（用於後台運行）
    if (options.background) {
      resolve(child);
    }
  });
};

// 主流程
const main = async () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           🚀 啟動 Chat App 開發環境（自動導入模式）              ║
╚════════════════════════════════════════════════════════════════╝
`);

  try {
    // 步驟 1: 啟動 Firebase Emulator（後台運行）
    log(colors.yellow, "Firebase", "正在啟動 Firebase Emulator...");
    const isWindows = process.platform === "win32";
    const firebaseProcess = await runCommand(
      isWindows ? "firebase.cmd" : "firebase",
      ["emulators:start"],
      {
        background: true,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    // 監聽 Firebase 輸出並等待就緒
    let emulatorReady = false;
    const emulatorReadyPromise = new Promise((resolve) => {
      firebaseProcess.stdout.on("data", (data) => {
        const output = data.toString();
        // 轉發輸出
        process.stdout.write(`${colors.yellow}[firebase]${colors.reset} ${output}`);

        if (output.includes("All emulators ready")) {
          emulatorReady = true;
          resolve();
        }
      });

      firebaseProcess.stderr.on("data", (data) => {
        process.stderr.write(`${colors.yellow}[firebase]${colors.reset} ${data}`);
      });

      // 超時保護（60秒）
      setTimeout(() => {
        if (!emulatorReady) {
          resolve(); // 即使超時也繼續，因為可能已經啟動成功
        }
      }, 60000);
    });

    // 步驟 2: 等待 Firebase Emulator 就緒
    log(colors.cyan, "System", "等待 Firebase Emulator 就緒...");
    await emulatorReadyPromise;

    // 額外等待 2 秒確保完全就緒
    await new Promise((resolve) => setTimeout(resolve, 2000));

    log(colors.green, "System", "✓ Firebase Emulator 已就緒");

    // 步驟 3: 導入資料
    log(colors.cyan, "Import", "正在導入 Firestore 資料...");
    const npmCmd = isWindows ? "npm.cmd" : "npm";
    await runCommand(npmCmd, ["run", "import:all"], {
      stdio: "inherit",
    });
    log(colors.green, "Import", "✓ 資料導入完成");

    // 步驟 4: 啟動 Backend
    log(colors.blue, "Backend", "正在啟動 Backend API...");
    const backendProcess = spawn(npmCmd, ["run", "dev:backend"], {
      cwd: rootDir,
      stdio: "pipe",
      shell: isWindows ? "cmd.exe" : true,
    });

    backendProcess.stdout.on("data", (data) => {
      process.stdout.write(`${colors.blue}[backend]${colors.reset} ${data}`);
    });

    backendProcess.stderr.on("data", (data) => {
      process.stderr.write(`${colors.blue}[backend]${colors.reset} ${data}`);
    });

    // 等待 Backend 就緒
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const backendReady = await waitForPort(PORTS.BACKEND, 10, 1000);
    if (backendReady) {
      log(colors.green, "Backend", "✓ Backend API 已就緒");
    }

    // 步驟 5: 啟動 Frontend
    log(colors.green, "Frontend", "正在啟動 Frontend...");
    const frontendProcess = spawn(npmCmd, ["run", "dev:frontend"], {
      cwd: rootDir,
      stdio: "pipe",
      shell: isWindows ? "cmd.exe" : true,
    });

    frontendProcess.stdout.on("data", (data) => {
      process.stdout.write(`${colors.green}[frontend]${colors.reset} ${data}`);
    });

    frontendProcess.stderr.on("data", (data) => {
      process.stderr.write(`${colors.green}[frontend]${colors.reset} ${data}`);
    });

    // 等待 Frontend 就緒
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const frontendReady = await waitForPort(PORTS.FRONTEND, 10, 1000);
    if (frontendReady) {
      log(colors.green, "Frontend", "✓ Frontend 已就緒");
    }

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    ✨ 所有服務已成功啟動！                        ║
╠════════════════════════════════════════════════════════════════╣
║  📍 Frontend:       ${URLS.FRONTEND.padEnd(43)}║
║  📍 Backend API:    ${URLS.BACKEND.padEnd(43)}║
║  📍 Emulator UI:    ${URLS.EMULATOR_UI.padEnd(43)}║
║  📍 Firestore:      ${URLS.FIRESTORE.padEnd(43)}║
║  📍 Auth:           ${URLS.AUTH.padEnd(43)}║
║  📍 Storage:        ${URLS.STORAGE.padEnd(43)}║
╠════════════════════════════════════════════════════════════════╣
║  💡 按 Ctrl+C 停止所有服務                                       ║
╚════════════════════════════════════════════════════════════════╝
`);

    // 處理退出信號
    const cleanup = () => {
      log(colors.cyan, "System", "正在停止所有服務...");
      firebaseProcess.kill();
      backendProcess.kill();
      frontendProcess.kill();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // 監聽子進程退出
    const handleProcessExit = (name, code) => {
      log(colors.red, "Error", `${name} 異常退出 (code: ${code})`);
      cleanup();
    };

    firebaseProcess.on("close", (code) => handleProcessExit("Firebase", code));
    backendProcess.on("close", (code) => handleProcessExit("Backend", code));
    frontendProcess.on("close", (code) => handleProcessExit("Frontend", code));
  } catch (error) {
    log(colors.red, "Error", `啟動失敗: ${error.message}`);
    process.exit(1);
  }
};

main();
