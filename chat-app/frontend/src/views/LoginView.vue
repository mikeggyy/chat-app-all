<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { apiJson } from "../utils/api";
import { useUserProfile } from "../composables/useUserProfile";
import { useFirebaseAuth } from "../composables/useFirebaseAuth";
import { useGuestGuard } from "../composables/useGuestGuard";
import {
  saveTestSession,
  clearTestSession,
} from "../services/testAuthSession";

// Types
type StatusType = "idle" | "loading" | "success" | "error" | "info";

interface FirebaseError extends Error {
  code?: string;
}

interface TestAuthResponse {
  user: {
    id: string;
    displayName: string;
    email?: string;
  };
  token: string;
  expiresIn: string | number;
}

interface TestUserProfile {
  id: string;
  displayName: string;
  email: string;
  locale: string;
  photoURL: string;
  defaultPrompt: string;
  notificationOptIn: boolean;
  signInProvider: string;
  isGuest: boolean;
  hasCompletedOnboarding: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  conversations: string[];
  favorites: string[];
}

const router = useRouter();
const { user, setUserProfile } = useUserProfile();
const { signInWithGoogle, resolveRedirectResult } = useFirebaseAuth();
const { resetGuestMessageCount } = useGuestGuard();

const statusMessage = ref<string>("");
const statusType = ref<StatusType>("idle");
const isLoading = ref<boolean>(false);
const waitingForNavigation = ref<boolean>(false);

const setStatus = (type: StatusType, message: string): void => {
  statusType.value = type;
  statusMessage.value = message;
};

// ⚠️ 方案 A：LoginView 只負責 Firebase Auth，不再處理用戶創建和狀態同步
// 所有用戶狀態同步由 authBootstrap.js 統一處理，避免重複請求和競態條件

const mapFirebaseErrorMessage = (error: FirebaseError | Error | unknown): string => {
  const code = (error as FirebaseError)?.code ?? "";
  switch (code) {
    case "auth/network-request-failed":
      return "網路連線異常，請稍後再試。";
    case "auth/unauthorized-domain":
      return "Firebase 授權網域未正確設定，請確認 Firebase 主控台的允許網域。";
    case "auth/invalid-api-key":
    case "auth/configuration-not-found":
      return "Firebase 組態似乎不完整，請確認環境變數檔案設定。";
    case "auth/redirect-cancelled-by-user":
      return "您已取消 Google 登入流程。";
    case "auth/popup-blocked":
      return "瀏覽器阻擋了登入彈窗。請在瀏覽器地址欄右側點擊彈窗圖示，允許此網站彈出視窗後再試一次。";
    case "auth/popup-closed-by-user":
      return "您關閉了登入彈窗。請重新點擊登入按鈕。";
    case "auth/cancelled-popup-request":
      return "已有登入彈窗正在處理中，請稍候。";
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return "Google 登入失敗，請稍後再試一次。";
  }
};

const handleFirebaseAuthError = (error: FirebaseError | Error | unknown): void => {
  if (!error) return;

  if ((error as FirebaseError)?.code === "auth/redirect-cancelled-by-user") {
    setStatus("idle", "您已取消 Google 登入流程。");
    return;
  }

  if (
    error instanceof Error &&
    error.message.includes("Missing Firebase environment variables")
  ) {
    setStatus(
      "error",
      "尚未設定 Firebase 必要環境變數，請參考 frontend/.env.example 填寫後再試。"
    );
    return;
  }

  setStatus("error", mapFirebaseErrorMessage(error));
};

// ✅ 簡化的 Google 登入處理：只負責 Firebase Auth
const handleGoogleLogin = async (): Promise<void> => {
  if (isLoading.value) {
    return;
  }

  isLoading.value = true;
  setStatus("loading", "正在連線至 Google 登入服務...");

  let redirecting = false;
  try {
    const outcome = await signInWithGoogle();

    if (outcome.redirected) {
      console.log('[LoginView] 🟡 使用 redirect 登入方式');
      redirecting = true;
      setStatus("loading", "即將重新導向至 Google 登入頁面，請稍候...");
      return;
    }

    if (!outcome.result) {
      console.log('[LoginView] ❌ 登入未取得有效結果');
      throw new Error("Google 登入未取得有效結果，請重新操作。");
    }

    console.log('[LoginView] 🟢 Popup 登入成功！準備處理後續流程');
    // ✅ 登入成功！authBootstrap 會自動處理：
    // 1. onAuthStateChanged 偵測到登入
    // 2. GET /api/users/:id (或 POST 創建新用戶)
    // 3. setUserProfile(用戶資料)
    // 4. watch(user) 監聽到變化後自動導航
    clearTestSession();
    resetGuestMessageCount();
    console.log('[LoginView] 🟢 設置狀態訊息：登入成功！正在載入您的資料...');
    setStatus("success", "登入成功！正在載入您的資料...");

    // ✅ 2025-11-25 修復：設置等待導航標記，讓 watch(user) 在資料載入完成後自動導航
    // 移除固定時間的 setTimeout，避免 authBootstrap 尚未完成時就嘗試導航
    console.log('[LoginView] 🔵 設置 waitingForNavigation = true，等待 authBootstrap 完成');
    waitingForNavigation.value = true;
  } catch (err) {
    console.error('[LoginView] ❌ handleGoogleLogin 錯誤:', err);
    handleFirebaseAuthError(err);
    isLoading.value = false; // ❌ 只在錯誤時才清除 loading
  } finally {
    if (redirecting) {
      console.log('[LoginView] 🔵 保持 loading 狀態 (redirect 模式)');
      // redirect 時保持 loading 狀態
      // 不設置 isLoading = false
    }
  }
};

// ✅ 測試/遊客登入：不使用 Firebase Auth，需要手動處理
const handleTestLogin = async (): Promise<void> => {
  if (isLoading.value) return;
  isLoading.value = true;
  setStatus("loading", "正在以遊客身份登入...");

  try {
    const data = await apiJson<TestAuthResponse>("/auth/test", {
      method: "POST",
    });

    const nowIso = new Date().toISOString();
    const testUser: TestUserProfile = {
      id: data.user.id,
      displayName: data.user.displayName,
      email: data.user.email ?? "",
      locale: "zh-TW",
      photoURL: "/avatars/defult-01.webp",
      defaultPrompt: "我是測試帳號，請協助我快速驗證 AI 劇情與對話流程。",
      notificationOptIn: false,
      signInProvider: "guest",
      isGuest: true,
      hasCompletedOnboarding: true, // 遊客跳過 onboarding
      createdAt: nowIso,
      updatedAt: nowIso,
      lastLoginAt: nowIso,
      conversations: [],
      favorites: [],
    };

    const expiresInSeconds = Number(data.expiresIn);
    const expiresAt =
      Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
        ? Date.now() + expiresInSeconds * 1000
        : 0;

    saveTestSession({
      token: data.token,
      userId: data.user.id,
      profile: testUser,
      expiresAt,
    });

    // 遊客直接設定 profile，不從後端載入（避免覆蓋 isGuest 標記）
    setUserProfile(testUser);
    setStatus("success", `歡迎，${testUser.displayName}！`);
    await router.push({ name: "match" });
  } catch (err) {
    setStatus(
      "error",
      err instanceof Error ? err.message : "遊客登入過程發生錯誤"
    );
  } finally {
    isLoading.value = false;
  }
};

// ✅ 2025-11-25 修復：監聽用戶資料變化，自動導航
// 解決新用戶首次登入時 authBootstrap 尚未完成導致卡在登入頁的問題
watch(
  user,
  async (newUser) => {
    // 只在等待導航且用戶資料已載入時執行
    if (!waitingForNavigation.value || !newUser) {
      return;
    }

    console.log('[LoginView] 🟢 用戶資料已載入，準備導航', {
      userId: newUser.id,
      displayName: newUser.displayName,
    });

    // 清除等待標記，避免重複導航
    waitingForNavigation.value = false;

    try {
      const { isGuestUser } = await import("../../../../shared/config/testAccounts.js");
      const isGuest = isGuestUser(newUser.id || '');
      const hasCompletedOnboarding = newUser.hasCompletedOnboarding !== false;

      console.log('[LoginView] 🟡 導航決策:', {
        isGuest,
        hasCompletedOnboarding,
        userId: newUser.id
      });

      if (isGuest) {
        console.log('[LoginView] 🟢 導航至 match (遊客)');
        await router.push({ name: "match" });
      } else if (hasCompletedOnboarding) {
        console.log('[LoginView] 🟢 導航至 match (已完成 onboarding)');
        await router.push({ name: "match" });
      } else {
        console.log('[LoginView] 🟢 導航至 onboarding (新用戶)');
        await router.push({ name: "onboarding" });
      }
    } catch (error) {
      console.error('[LoginView] ❌ 導航錯誤:', error);
      setStatus("error", "導航失敗，請重新整理頁面");
      isLoading.value = false;
    }
  },
  { immediate: false } // 不立即執行，只在值變化時執行
);

// ✅ 處理 Google 登入重定向結果
onMounted(async () => {
  console.log('[LoginView] 🔵 onMounted 執行');
  try {
    console.log('[LoginView] 🔵 檢查 redirect 登入結果');
    const redirectOutcome = await resolveRedirectResult();
    console.log('[LoginView] 🟢 resolveRedirectResult 完成', redirectOutcome);

    if (redirectOutcome?.result) {
      console.log('[LoginView] 🟢 Redirect 登入成功！處理後續流程');
      // ✅ Google 登入重定向成功！
      // authBootstrap 會自動處理後續流程：
      // 1. onAuthStateChanged 偵測到登入
      // 2. GET /api/users/:id (或 POST 創建新用戶)
      // 3. setUserProfile(用戶資料)
      // 4. watch(user) 監聽到變化後自動導航
      isLoading.value = true;
      setStatus("loading", "登入成功！正在載入您的資料...");
      clearTestSession();
      resetGuestMessageCount();

      // ✅ 2025-11-25 修復：設置等待導航標記，讓 watch(user) 在資料載入完成後自動導航
      console.log('[LoginView] 🔵 設置 waitingForNavigation = true (redirect 模式)');
      waitingForNavigation.value = true;
    } else {
      console.log('[LoginView] 🟡 沒有 redirect 登入結果（正常頁面載入）');
    }
  } catch (error) {
    console.error('[LoginView] ❌ onMounted 錯誤:', error);
    handleFirebaseAuthError(error);
  } finally {
    // 注意：不在這裡設置 isLoading = false，讓它保持 loading 狀態
    // 直到 authBootstrap 完成並導航到目標頁面
    console.log('[LoginView] 🔵 onMounted 完成');
  }
});

</script>

<template>
  <main class="login-page">
    <div class="background">
      <img src="/login-background.webp" alt="應用程式背景" />
      <div class="overlay"></div>
    </div>

    <section class="login-card">
      <div class="logo-mark">
        <img
          src="/branding/app-logo.png"
          alt="Love Story 品牌識別"
          class="logo-icon"
        />
      </div>

      <h1 class="title">Love Story</h1>
      <p class="subtitle">與 AI 暢聊</p>
      <p class="hint">登入後，即刻開始體驗。</p>

      <div class="actions">
        <button
          type="button"
          class="btn google"
          @click="handleGoogleLogin()"
          :disabled="isLoading"
        >
          <span class="btn-icon">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
          </span>
          <span>使用 Google 登入</span>
        </button>

        <button
          type="button"
          class="btn secondary"
          @click="handleTestLogin"
          :disabled="isLoading"
        >
          <span class="btn-icon test">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path d="M12 4v1m6 2-1 1m3 4h-1m-1 6 1 1m-6 3v-1m-6-2 1-1M4 12h1m2-6 1 1" />
            </svg>
          </span>
          <span>遊客體驗</span>
        </button>
      </div>

      <p v-if="statusMessage" class="status" :class="statusType">
        {{ statusMessage }}
      </p>

      <p class="terms">
        登入即代表同意
        <a href="#">使用者協議</a>
        與
        <a href="#">隱私政策</a>
      </p>
    </section>
  </main>
</template>

<style scoped lang="scss">
.login-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem 1.5rem;
  overflow: hidden;
  color: #f8fafc;

  .background {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: brightness(0.45);
      transform: scale(1.05);
    }

    .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        160deg,
        transparent 0%,
        rgba(148, 33, 146, 0.35) 100%
      );
    }
  }

  .login-card {
    position: relative;
    z-index: 1;
    width: min(420px, 100%);
    border-radius: 32px;
    padding: 3.5rem 2.75rem;
    text-align: center;

    .logo-mark {
      margin: 0 auto 1.5rem;
      border-radius: 40px;
      display: grid;
      place-items: center;

      .logo-icon {
        width: 80px;
        height: 80px;
      }
    }

    .title {
      font-size: 2.75rem;
      font-weight: 600;
      margin: 0;
      letter-spacing: 0.04em;
    }

    .subtitle {
      font-size: 1.2rem;
      margin: 0.5rem 0 1.25rem;
      color: #f1f5f9;
      letter-spacing: 0.4em;
    }

    .hint {
      margin-bottom: 2.5rem;
      color: rgba(248, 250, 252, 0.78);
    }

    .actions {
      display: grid;
      gap: 1rem;

      .btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        border: none;
        border-radius: 999px;
        padding: 0.9rem 1.5rem;
        font-size: 1.05rem;
        font-weight: 600;
        cursor: pointer;
        transition: transform 160ms ease, box-shadow 160ms ease,
          background 160ms ease;
        will-change: transform;

        &:disabled {
          cursor: not-allowed;
          opacity: 0.7;
          box-shadow: none;
          transform: none;
        }

        &:not(:disabled):hover {
          transform: translateY(-2px);
        }

        .btn-icon {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;

          svg {
            width: 22px;
            height: 22px;
          }
        }

        &.primary {
          background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
          color: #fff;
          box-shadow: 0 12px 24px rgba(255, 77, 143, 0.35);

          &:not(:disabled):hover {
            box-shadow: 0 16px 32px rgba(255, 77, 143, 0.45);
          }
        }

        &.google {
          background: #fff;
          color: #3c4043;
          border: 1px solid #dadce0;
          font-weight: 500;
          font-size: 0.95rem;
          letter-spacing: 0.0125em;
          min-height: 48px;
          border-radius: 24px;
          padding: 0 1.5rem;
          box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3),
            0 1px 3px 1px rgba(60, 64, 67, 0.15);
          transform: none;

          &:not(:disabled):hover {
            background: #f6f9fe;
            box-shadow: 0 1px 3px rgba(60, 64, 67, 0.3),
              0 2px 6px rgba(60, 64, 67, 0.2);
            transform: none;
          }

          &:not(:disabled):active {
            background: #e8eaed;
            box-shadow: inset 0 1px 0 rgba(60, 64, 67, 0.1),
              0 1px 3px rgba(60, 64, 67, 0.2);
            transform: none;
          }

          .btn-icon {
            width: 18px;
            height: 18px;

            svg {
              width: 18px;
              height: 18px;
            }
          }

          span:last-child {
            font-family: "Roboto", "Noto Sans TC", sans-serif;
          }
        }

        &.secondary {
          background: linear-gradient(
            160deg,
            #000 0%,
            rgba(148, 33, 146, 0.35) 100%
          );
          color: #f8fafc;
          border: 1px solid rgba(248, 250, 252, 0.35);

          &:not(:disabled):hover {
            background: rgba(248, 250, 252, 0.12);
          }
        }
      }
    }

    .status {
      margin: 1.75rem 0 0;
      padding: 0.75rem 1rem;
      border-radius: 16px;
      font-size: 0.95rem;
      background: rgba(15, 23, 42, 0.55);
      border: 1px solid transparent;

      &.loading,
      &.info {
        border-color: rgba(148, 163, 184, 0.35);
        color: #e2e8f0;
      }

      &.success {
        border-color: rgba(16, 185, 129, 0.5);
        color: #bbf7d0;
        background: rgba(22, 101, 52, 0.35);
      }

      &.error {
        border-color: rgba(248, 113, 113, 0.5);
        color: #fecaca;
        background: rgba(185, 28, 28, 0.35);
      }
    }

    .terms {
      margin-top: 2.25rem;
      font-size: 0.85rem;
      color: rgba(226, 232, 240, 0.7);

      a {
        color: #fdf4ff;
        text-decoration: underline;
      }
    }

    @media (max-width: 480px) {
      padding: 2.75rem 2rem;
      border-radius: 24px;

      .title {
        font-size: 2.2rem;
      }

      .subtitle {
        font-size: 1rem;
        letter-spacing: 0.3em;
      }
    }
  }
}
</style>
