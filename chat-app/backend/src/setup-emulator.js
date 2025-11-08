/**
 * Firebase Emulator 環境變數設置
 *
 * ⚠️ 重要：此文件必須在任何使用 Firebase Admin 的模組之前導入！
 * 因為 Firebase Admin SDK 會在初始化時檢查這些環境變數。
 *
 * ⚠️ 注意：在導入此文件前，請先確保已載入環境變數（dotenv）
 *
 * 使用方式：
 * import "dotenv/config";  // 先載入 dotenv
 * import "./setup-emulator.js";
 */

if (process.env.USE_FIREBASE_EMULATOR === "true") {
  const emulatorHost = process.env.FIREBASE_EMULATOR_HOST || "localhost";

  // Auth Emulator
  const authPort = process.env.FIREBASE_EMULATOR_AUTH_PORT || "9099";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `${emulatorHost}:${authPort}`;
  console.log(`🔧 Firebase Auth Emulator: ${emulatorHost}:${authPort}`);

  // Firestore Emulator
  const firestorePort = process.env.FIREBASE_EMULATOR_FIRESTORE_PORT || "8080";
  process.env.FIRESTORE_EMULATOR_HOST = `${emulatorHost}:${firestorePort}`;
  console.log(`🔧 Firebase Firestore Emulator: ${emulatorHost}:${firestorePort}`);

  // Storage Emulator
  const storagePort = process.env.FIREBASE_STORAGE_EMULATOR_PORT || "9299";
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = `${emulatorHost}:${storagePort}`;
  console.log(`🔧 Firebase Storage Emulator: ${emulatorHost}:${storagePort}`);
}
