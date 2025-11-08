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

let cachedAuth = null;

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: "select_account",
});

const getAuthInstance = () => {
  if (cachedAuth) {
    return cachedAuth;
  }
  const auth = getAuth(getFirebaseApp());
  auth.languageCode = "zh-TW";
  cachedAuth = auth;
  return auth;
};

const signInWithGoogle = async () => {
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
  } catch (error) {
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

const resolveRedirectResult = async () => {
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

const getCurrentUserIdToken = async (forceRefresh = false) => {
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

const signOutFromFirebase = async () => {
  const auth = getAuthInstance();
  // 清除 token 緩存
  clearTokenCache();
  // 執行登出
  return signOut(auth);
};

export const useFirebaseAuth = () => {
  return {
    getAuth: getAuthInstance,
    signInWithGoogle,
    resolveRedirectResult,
    getCurrentUserIdToken,
    signOut: signOutFromFirebase,
  };
};
