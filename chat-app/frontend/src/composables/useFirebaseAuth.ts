/**
 * useFirebaseAuth.ts
 * Firebase 認證管理 Composable（TypeScript 版本）
 */

import type { Auth, UserCredential } from "firebase/auth";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import { getFirebaseApp } from "../utils/firebase.js";
import { loadTestSession } from "../services/testAuthSession.js";
import { clearTokenCache } from "../utils/api.js";

// ==================== 類型定義 ====================

export interface SignInResult {
  result: UserCredential | null;
  method: "popup" | "redirect";
  redirected: boolean;
}

export interface UseFirebaseAuthReturn {
  getAuth: () => Auth;
  signInWithGoogle: () => Promise<SignInResult>;
  resolveRedirectResult: () => Promise<SignInResult | null>;
  getCurrentUserIdToken: (forceRefresh?: boolean) => Promise<string>;
  signOut: () => Promise<void>;
}

// ==================== 內部狀態 ====================

let cachedAuth: Auth | null = null;

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: "select_account",
});

// ==================== 內部函數 ====================

const getAuthInstance = (): Auth => {
  if (cachedAuth) {
    return cachedAuth;
  }
  const auth = getAuth(getFirebaseApp());
  auth.languageCode = "zh-TW";
  cachedAuth = auth;
  return auth;
};

const signInWithGoogle = async (): Promise<SignInResult> => {
  const auth = getAuthInstance();

  // 在 Emulator 模式下，直接使用 redirect 避免 "No matching frame" 錯誤
  const useEmulator = import.meta.env.VITE_USE_EMULATOR === "true";

  if (useEmulator) {
    await signInWithRedirect(auth, provider);
    return {
      result: null,
      method: "redirect",
      redirected: true,
    };
  }

  // 生產環境使用 popup，失敗時降級為 redirect
  try {
    const result = await signInWithPopup(auth, provider);
    return {
      result,
      method: "popup",
      redirected: false,
    };
  } catch (error: any) {
    if (error?.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, provider);
      return {
        result: null,
        method: "redirect",
        redirected: true,
      };
    }
    throw error;
  }
};

const resolveRedirectResult = async (): Promise<SignInResult | null> => {
  const auth = getAuthInstance();
  const result = await getRedirectResult(auth);
  if (!result) {
    return null;
  }
  return {
    result,
    method: "redirect",
    redirected: true,
  };
};

const getCurrentUserIdToken = async (forceRefresh = false): Promise<string> => {
  // 優先檢查是否有測試 session（遊客登入）
  const testSession = loadTestSession();

  if (testSession?.token) {
    return testSession.token;
  }

  // 如果沒有測試 session，則使用 Firebase token
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("尚未登入，無法取得 Firebase 權杖。");
  }
  const firebaseToken = await user.getIdToken(forceRefresh);
  return firebaseToken;
};

const signOutFromFirebase = async (): Promise<void> => {
  const auth = getAuthInstance();
  // 清除 token 緩存
  clearTokenCache();
  // 執行登出
  return signOut(auth);
};

// ==================== Composable 主函數 ====================

export const useFirebaseAuth = (): UseFirebaseAuthReturn => {
  return {
    getAuth: getAuthInstance,
    signInWithGoogle,
    resolveRedirectResult,
    getCurrentUserIdToken,
    signOut: signOutFromFirebase,
  };
};
