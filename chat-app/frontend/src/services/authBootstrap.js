import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirebaseApp } from "../utils/firebase.js";
import { apiJson } from "../utils/api.js";
import { useUserProfile } from "../composables/useUserProfile.js";
import {
  loadTestSession,
  isTestSessionValid,
  clearTestSession,
} from "./testAuthSession.js";
import { generateRandomUserName } from "../utils/randomUserName.js";

let authReadyPromise;

const buildFallbackProfile = (firebaseUser) => {
  const nowIso = new Date().toISOString();
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName ?? generateRandomUserName(),
    email: firebaseUser.email ?? "",
    photoURL: firebaseUser.photoURL ?? "/avatars/defult-01.webp",
    locale:
      firebaseUser.reloadUserInfo?.languageCode ??
      firebaseUser.languageCode ??
      "zh-TW",
    lastLoginAt: firebaseUser.metadata?.lastSignInTime ?? nowIso,
    updatedAt: firebaseUser.metadata?.lastSignInTime ?? nowIso,
    createdAt: firebaseUser.metadata?.creationTime ?? nowIso,
    conversations: [],
    favorites: [],
    notificationOptIn: false,
    signInProvider:
      firebaseUser.providerData?.[0]?.providerId ?? "firebase-auth",
    // ⚠️ 重要：不包含 hasCompletedOnboarding
    // 讓後端的 upsertUser 自動處理：
    // - 新用戶：使用預設值 false
    // - 已存在的用戶：從 Firestore 讀取並保留現有值
  };
};

const isNetworkError = (error) => {
  if (!error || typeof error !== "object") {
    return false;
  }
  if (error.isNetworkError) {
    return true;
  }
  if (typeof error.status === "number") {
    return error.status === 0;
  }
  if (error.name === "TypeError") {
    return true;
  }
  const message =
    typeof error.message === "string" ? error.message.toLowerCase() : "";
  return message.includes("failed to fetch") || message.includes("network");
};

export const ensureAuthState = () => {
  if (authReadyPromise) {
    return authReadyPromise;
  }

  const { setUserProfile, clearUserProfile, loadUserProfile } =
    useUserProfile();
  let auth;

  try {
    auth = getAuth(getFirebaseApp());
  } catch (error) {
    clearUserProfile();
    authReadyPromise = Promise.resolve();
    return authReadyPromise;
  }

  let resolved = false;

  const resolveOnce = () => {
    if (!resolved) {
      resolved = true;
      resolve();
    }
  };

  let resolve;
  authReadyPromise = new Promise((promiseResolve) => {
    resolve = promiseResolve;

    onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          // 沒有 Firebase 使用者時，嘗試使用測試登入會話恢復狀態
          const testSession = loadTestSession();

          if (isTestSessionValid(testSession)) {
            const fallbackProfile = testSession?.profile ?? null;
            if (fallbackProfile) {
              setUserProfile(fallbackProfile);
            }

            try {
              await loadUserProfile(testSession.userId, {
                force: true,
                fallback: fallbackProfile ?? undefined,
              });
            } catch (sessionError) {
              if (sessionError?.status === 404) {
                clearTestSession();
                clearUserProfile();
              } else if (fallbackProfile) {
                setUserProfile(fallbackProfile);
              } else {
                clearUserProfile();
              }
            }

            resolveOnce();
            return;
          }

          clearTestSession();
          clearUserProfile();
          resolveOnce();
          return;
        }

        const fallbackProfile = buildFallbackProfile(firebaseUser);

        const syncProfile = async () => {
          // 檢查網路狀態
          const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;

          try {
            // 嘗試從後端獲取現有用戶資料
            const existing = await apiJson(
              `/api/users/${encodeURIComponent(firebaseUser.uid)}`
            );
            // ✅ 成功獲取後端數據，使用最新的完整資料
            // ⚠️ 修復：後端返回 { success: true, data: {...} }，需要取出 data
            setUserProfile(existing.data || existing);
            return;
          } catch (error) {
            const notFound = error?.status === 404;
            const networkError = isNetworkError(error);

            // 如果不是 404 且不是網路錯誤，拋出異常
            if (!notFound && !networkError) {
              throw error;
            }

            // 網路錯誤或離線：無法確定用戶狀態，不設置錯誤的預設值
            if (networkError || isOffline) {
              // 不設置 fallbackProfile，保持未認證狀態
              return;
            }

            // 404 錯誤：用戶不存在，嘗試創建新用戶
            if (notFound) {
              try {
                const idToken = await firebaseUser.getIdToken();
                const created = await apiJson("/api/users", {
                  method: "POST",
                  body: fallbackProfile,
                  headers: {
                    Authorization: `Bearer ${idToken}`,
                  },
                });
                // ✅ 使用後端返回的新建用戶資料（包含所有正確的預設值）
                // ⚠️ 修復：後端返回 { success: true, data: {...} }，需要取出 data
                setUserProfile(created.data || created);
                return;
              } catch (createError) {
                // 創建失敗，不設置錯誤的 fallbackProfile
                return;
              }
            }
          }
        };

        await syncProfile();
        resolveOnce();
      } catch (error) {
        clearUserProfile();
        resolveOnce();
      }
    });
  });

  return authReadyPromise;
};
