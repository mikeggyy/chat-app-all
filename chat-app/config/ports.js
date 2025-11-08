/**
 * 端口配置集中管理
 * 所有服務的端口配置統一在這裡定義
 */

export const PORTS = {
  // Frontend
  FRONTEND: 5173,

  // Backend
  BACKEND: 4000,

  // Firebase Emulator
  EMULATOR_UI: 4001,
  FIRESTORE_EMULATOR: 8080,  // 修復：與 firebase.json 和 .env.example 保持一致
  AUTH_EMULATOR: 9099,
  STORAGE_EMULATOR: 9299,
};

export const URLS = {
  FRONTEND: `http://localhost:${PORTS.FRONTEND}`,
  BACKEND: `http://localhost:${PORTS.BACKEND}`,
  EMULATOR_UI: `http://localhost:${PORTS.EMULATOR_UI}`,
  FIRESTORE: `http://localhost:${PORTS.FIRESTORE_EMULATOR}`,
  AUTH: `http://localhost:${PORTS.AUTH_EMULATOR}`,
  STORAGE: `http://localhost:${PORTS.STORAGE_EMULATOR}`,
};

export default {
  PORTS,
  URLS,
};
