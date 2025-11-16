import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

interface FirebaseConfigKeys {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface OptionalFirebaseConfigKeys {
  measurementId?: string;
  databaseURL?: string;
  vapidKey?: string;
}

type FirebaseConfig = FirebaseConfigKeys & OptionalFirebaseConfigKeys;

const requiredKeys: Record<keyof FirebaseConfigKeys, string> = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
};

const optionalKeys: Record<string, string> = {
  measurementId: "VITE_FIREBASE_MEASUREMENT_ID",
  databaseURL: "VITE_FIREBASE_DATABASE_URL",
  vapidKey: "VITE_FIREBASE_VAPID_KEY",
};

let cachedApp: FirebaseApp | null = null;

const readEnvValue = (key: string): string | undefined => {
  const value = import.meta.env[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
};

const buildFirebaseConfig = (): FirebaseConfig => {
  const config: Partial<FirebaseConfig> = {};
  const missingKeys: string[] = [];

  Object.entries(requiredKeys).forEach(([configKey, envKey]) => {
    const value = readEnvValue(envKey);
    if (!value) {
      missingKeys.push(envKey);
      return;
    }
    config[configKey as keyof FirebaseConfigKeys] = value;
  });

  if (missingKeys.length > 0) {
    const hint = missingKeys.join(", ");
    throw new Error(`Missing Firebase environment variables: ${hint}`);
  }

  Object.entries(optionalKeys).forEach(([configKey, envKey]) => {
    const value = readEnvValue(envKey);
    if (!value) return;
    config[configKey as keyof OptionalFirebaseConfigKeys] = value;
  });

  return config as FirebaseConfig;
};

export const getFirebaseApp = (): FirebaseApp => {
  if (cachedApp) {
    return cachedApp;
  }

  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const app = initializeApp(buildFirebaseConfig());
  cachedApp = app;
  return cachedApp;
};

// 導出 Firestore 實例
export const getFirestoreDb = (): Firestore => {
  const app = getFirebaseApp();
  return getFirestore(app);
};
