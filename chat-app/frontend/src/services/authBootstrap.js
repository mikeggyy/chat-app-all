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
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            setUserProfile(fallbackProfile);
            return;
          }

          try {
            const existing = await apiJson(
              `/api/users/${encodeURIComponent(firebaseUser.uid)}`
            );
            setUserProfile(existing);
            return;
          } catch (error) {
            const notFound = error?.status === 404;
            if (!notFound && !isNetworkError(error)) {
              throw error;
            }
            if (isNetworkError(error)) {
              setUserProfile(fallbackProfile);
              return;
            }
          }

          try {
            const idToken = await firebaseUser.getIdToken();
            const created = await apiJson("/api/users", {
              method: "POST",
              body: fallbackProfile,
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            });
            setUserProfile(created);
          } catch (createError) {
            setUserProfile(fallbackProfile);
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
