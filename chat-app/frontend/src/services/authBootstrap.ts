// @ts-nocheck
import { getAuth, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirebaseApp } from '../utils/firebase.js';
import { apiJson } from '../utils/api.js';
import { useUserProfile } from '../composables/useUserProfile.js';
import {
  loadTestSession,
  isTestSessionValid,
  clearTestSession,
} from './testAuthSession.js';
import { generateRandomUserName } from '../utils/randomUserName.js';

interface UserProfile {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  locale: string;
  lastLoginAt: string;
  updatedAt: string;
  createdAt: string;
  conversations: any[];
  favorites: any[];
  notificationOptIn: boolean;
  signInProvider: string;
}

interface TestSession {
  userId: string;
  profile?: UserProfile;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  status?: number;
  [key: string]: any;
}

let authReadyPromise: Promise<void> | null = null;

const buildFallbackProfile = (firebaseUser: FirebaseUser): UserProfile => {
  const nowIso = new Date().toISOString();
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName ?? generateRandomUserName(),
    email: firebaseUser.email ?? '',
    photoURL: firebaseUser.photoURL ?? '/avatars/defult-01.webp',
    locale:
      (firebaseUser as any).reloadUserInfo?.languageCode ??
      (firebaseUser as any).languageCode ??
      'zh-TW',
    lastLoginAt: firebaseUser.metadata?.lastSignInTime ?? nowIso,
    updatedAt: firebaseUser.metadata?.lastSignInTime ?? nowIso,
    createdAt: firebaseUser.metadata?.creationTime ?? nowIso,
    conversations: [],
    favorites: [],
    notificationOptIn: false,
    signInProvider:
      firebaseUser.providerData?.[0]?.providerId ?? 'firebase-auth',
  };
};

const isNetworkError = (error: any): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  if (error.isNetworkError) {
    return true;
  }
  if (typeof error.status === 'number') {
    return error.status === 0;
  }
  if (error.name === 'TypeError') {
    return true;
  }
  const message =
    typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('failed to fetch') || message.includes('network');
};

export const ensureAuthState = (): Promise<void> => {
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
  let resolve: (() => void) | null = null;

  const resolveOnce = (): void => {
    if (!resolved) {
      resolved = true;
      resolve!();
    }
  };
  authReadyPromise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;

    onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (!firebaseUser) {
          // 沒有 Firebase 使用者時，嘗試使用測試登入會話恢復狀態
          const testSession = loadTestSession() as TestSession | null;

          if (isTestSessionValid(testSession)) {
            const fallbackProfile = testSession?.profile ?? null;

            // ✅ 修復：訪客用戶直接使用 fallbackProfile，不調用後端 API
            // 因為訪客的 test-token 在後端是無效的，會導致 401 錯誤
            // 訪客用戶的資料完全在本地管理
            if (fallbackProfile) {
              setUserProfile(fallbackProfile);
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

        const syncProfile = async (): Promise<void> => {
          // 檢查網路狀態
          const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

          // ✅ 2025-11-25：添加超時機制，避免手機上無限等待
          const timeoutMs = 15000; // 15 秒超時
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            // 嘗試從後端獲取現有用戶資料
            const existing = await apiJson(
              `/api/users/${encodeURIComponent(firebaseUser.uid)}`,
              { signal: controller.signal }
            ) as ApiResponse<UserProfile>;

            clearTimeout(timeoutId);
            // 成功獲取後端數據，使用最新的完整資料
            setUserProfile(existing.data || existing as unknown as UserProfile);
            return;
          } catch (error: any) {
            clearTimeout(timeoutId);
            const notFound = error?.status === 404;
            const networkError = isNetworkError(error);
            const isTimeout = error?.name === 'AbortError';

            // 如果不是 404 且不是網路錯誤且不是超時，拋出異常
            if (!notFound && !networkError && !isTimeout) {
              throw error;
            }

            // ✅ 2025-11-25 修復：網路錯誤、離線或超時時，使用 fallback profile 而非卡住
            if (networkError || isOffline || isTimeout) {
              console.warn('[AuthBootstrap] 網路問題或超時，使用本地 fallback profile');
              setUserProfile(fallbackProfile);
              return;
            }

            // 404 錯誤：用戶不存在，嘗試創建新用戶
            if (notFound) {
              // ✅ 2025-11-25：新用戶創建也需要超時機制
              const createController = new AbortController();
              const createTimeoutId = setTimeout(() => createController.abort(), timeoutMs);

              try {
                const idToken = await firebaseUser.getIdToken();
                const created = await apiJson('/api/users', {
                  method: 'POST',
                  body: fallbackProfile,
                  headers: {
                    Authorization: `Bearer ${idToken}`,
                  },
                  signal: createController.signal,
                }) as ApiResponse<UserProfile>;

                clearTimeout(createTimeoutId);
                // 使用後端返回的新建用戶資料（包含所有正確的預設值）
                setUserProfile(created.data || created as unknown as UserProfile);
                return;
              } catch (createError: any) {
                clearTimeout(createTimeoutId);
                // ✅ 2025-11-25 修復：創建失敗或超時時也使用 fallback profile
                const isCreateTimeout = createError?.name === 'AbortError';
                console.warn('[AuthBootstrap] 創建用戶失敗或超時，使用本地 fallback profile', {
                  isTimeout: isCreateTimeout,
                  error: createError?.message,
                });
                setUserProfile(fallbackProfile);
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
