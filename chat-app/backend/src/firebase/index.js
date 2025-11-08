/**
 * Firebase Admin SDK 初始化（主應用）
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const requiredEnv = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
];

const readEnv = (key) => {
  const value = process.env[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
};

const buildAdminConfig = () => {
  const missing = requiredEnv.filter((key) => !readEnv(key));
  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase Admin environment variables: ${missing.join(", ")}`
    );
  }

  const projectId = readEnv("FIREBASE_ADMIN_PROJECT_ID");
  const clientEmail = readEnv("FIREBASE_ADMIN_CLIENT_EMAIL");
  const privateKeyRaw = readEnv("FIREBASE_ADMIN_PRIVATE_KEY");
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const storageBucket = readEnv("FIREBASE_STORAGE_BUCKET") || `${projectId}.appspot.com`;

  return {
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
    storageBucket,
  };
};

let cachedAuth = null;
let cachedFirestore = null;

const ensureApp = () => {
  if (getApps().length > 0) {
    return;
  }

  initializeApp(buildAdminConfig());
};

export const getFirebaseAdminAuth = () => {
  if (cachedAuth) {
    return cachedAuth;
  }
  ensureApp();
  cachedAuth = getAuth();
  return cachedAuth;
};

export const getFirestoreDb = () => {
  if (cachedFirestore) {
    return cachedFirestore;
  }
  ensureApp();
  cachedFirestore = getFirestore();
  return cachedFirestore;
};

// 為了向後兼容，也導出 db 和 auth
export const db = getFirestoreDb();
export const auth = getFirebaseAdminAuth();

// 導出 FieldValue 用於 Firestore 操作
export { FieldValue };
