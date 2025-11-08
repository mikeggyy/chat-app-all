/**
 * 配置驗證腳本
 * 檢查 firebase.json 和 .env 是否與 config/ports.js 一致
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { PORTS } from "../config/ports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

let hasErrors = false;

const log = (color, message) => {
  console.log(`${color}${message}${colors.reset}`);
};

console.log(`
╔════════════════════════════════════════════════════════════════╗
║                      🔍 端口配置驗證                            ║
╚════════════════════════════════════════════════════════════════╝
`);

// 驗證 firebase.json
try {
  const firebaseConfigPath = join(rootDir, "firebase.json");
  const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, "utf-8"));

  log(colors.cyan, "\n📄 檢查 firebase.json...");

  const checks = [
    {
      name: "Auth Emulator",
      actual: firebaseConfig.emulators?.auth?.port,
      expected: PORTS.AUTH_EMULATOR,
    },
    {
      name: "Firestore Emulator",
      actual: firebaseConfig.emulators?.firestore?.port,
      expected: PORTS.FIRESTORE_EMULATOR,
    },
    {
      name: "Storage Emulator",
      actual: firebaseConfig.emulators?.storage?.port,
      expected: PORTS.STORAGE_EMULATOR,
    },
    {
      name: "Emulator UI",
      actual: firebaseConfig.emulators?.ui?.port,
      expected: PORTS.EMULATOR_UI,
    },
  ];

  checks.forEach(({ name, actual, expected }) => {
    if (actual === expected) {
      log(colors.green, `  ✓ ${name}: ${actual}`);
    } else {
      log(
        colors.red,
        `  ✗ ${name}: ${actual} (應為 ${expected})`
      );
      hasErrors = true;
    }
  });
} catch (error) {
  log(colors.red, `  ✗ 讀取 firebase.json 失敗: ${error.message}`);
  hasErrors = true;
}

// 驗證 frontend/.env
try {
  const frontendEnvPath = join(rootDir, "frontend", ".env");
  const frontendEnv = readFileSync(frontendEnvPath, "utf-8");

  log(colors.cyan, "\n📄 檢查 frontend/.env...");

  const authPortMatch = frontendEnv.match(/VITE_EMULATOR_AUTH_PORT=(\d+)/);
  const firestorePortMatch = frontendEnv.match(
    /VITE_EMULATOR_FIRESTORE_PORT=(\d+)/
  );

  const authPort = authPortMatch ? parseInt(authPortMatch[1]) : null;
  const firestorePort = firestorePortMatch
    ? parseInt(firestorePortMatch[1])
    : null;

  if (authPort === PORTS.AUTH_EMULATOR) {
    log(colors.green, `  ✓ VITE_EMULATOR_AUTH_PORT: ${authPort}`);
  } else {
    log(
      colors.red,
      `  ✗ VITE_EMULATOR_AUTH_PORT: ${authPort} (應為 ${PORTS.AUTH_EMULATOR})`
    );
    hasErrors = true;
  }

  if (firestorePort === PORTS.FIRESTORE_EMULATOR) {
    log(colors.green, `  ✓ VITE_EMULATOR_FIRESTORE_PORT: ${firestorePort}`);
  } else {
    log(
      colors.red,
      `  ✗ VITE_EMULATOR_FIRESTORE_PORT: ${firestorePort} (應為 ${PORTS.FIRESTORE_EMULATOR})`
    );
    hasErrors = true;
  }
} catch (error) {
  log(colors.red, `  ✗ 讀取 frontend/.env 失敗: ${error.message}`);
  hasErrors = true;
}

// 驗證 backend/.env
try {
  const backendEnvPath = join(rootDir, "backend", ".env");
  const backendEnv = readFileSync(backendEnvPath, "utf-8");

  log(colors.cyan, "\n📄 檢查 backend/.env...");

  const authPortMatch = backendEnv.match(/FIREBASE_EMULATOR_AUTH_PORT=(\d+)/);
  const firestorePortMatch = backendEnv.match(/FIREBASE_EMULATOR_FIRESTORE_PORT=(\d+)/);
  const storagePortMatch = backendEnv.match(/FIREBASE_STORAGE_EMULATOR_PORT=(\d+)/);

  const authPort = authPortMatch ? parseInt(authPortMatch[1]) : null;
  const firestorePort = firestorePortMatch ? parseInt(firestorePortMatch[1]) : null;
  const storagePort = storagePortMatch ? parseInt(storagePortMatch[1]) : null;

  if (authPort === PORTS.AUTH_EMULATOR) {
    log(colors.green, `  ✓ FIREBASE_EMULATOR_AUTH_PORT: ${authPort}`);
  } else {
    log(
      colors.red,
      `  ✗ FIREBASE_EMULATOR_AUTH_PORT: ${authPort} (應為 ${PORTS.AUTH_EMULATOR})`
    );
    hasErrors = true;
  }

  if (firestorePort === PORTS.FIRESTORE_EMULATOR) {
    log(colors.green, `  ✓ FIREBASE_EMULATOR_FIRESTORE_PORT: ${firestorePort}`);
  } else {
    log(
      colors.red,
      `  ✗ FIREBASE_EMULATOR_FIRESTORE_PORT: ${firestorePort} (應為 ${PORTS.FIRESTORE_EMULATOR})`
    );
    hasErrors = true;
  }

  if (storagePort === PORTS.STORAGE_EMULATOR) {
    log(colors.green, `  ✓ FIREBASE_STORAGE_EMULATOR_PORT: ${storagePort}`);
  } else {
    log(
      colors.red,
      `  ✗ FIREBASE_STORAGE_EMULATOR_PORT: ${storagePort} (應為 ${PORTS.STORAGE_EMULATOR})`
    );
    hasErrors = true;
  }
} catch (error) {
  log(colors.red, `  ✗ 讀取 backend/.env 失敗: ${error.message}`);
  hasErrors = true;
}

// 總結
console.log("\n" + "═".repeat(64));
if (hasErrors) {
  log(
    colors.red,
    "\n❌ 發現配置不一致！請手動更新 firebase.json 或 .env 文件。"
  );
  log(
    colors.yellow,
    "\n💡 參考 config/ports.js 中的正確配置值。\n"
  );
  process.exit(1);
} else {
  log(colors.green, "\n✅ 所有配置一致！\n");
  process.exit(0);
}
