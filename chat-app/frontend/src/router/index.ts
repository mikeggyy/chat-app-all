import { createRouter, createWebHashHistory, Router, RouteRecordRaw } from "vue-router";
import { effectScope, watch, onScopeDispose, EffectScope } from "vue";
import { getAuth, Auth } from "firebase/auth";
import { useUserProfile } from "../composables/useUserProfile.js";
import { getFirebaseApp } from "../utils/firebase.js";
import {
  clearTestSession,
  hasValidTestSession,
} from "../services/testAuthSession.js";
import { ensureAuthState } from "../services/authBootstrap.js";
import { isGuestUser } from "../../../../shared/config/testAccounts.js";

// 使用動態導入實現路由懶加載
const LoginView = () => import("../views/LoginView.vue");
const OnboardingView = () => import("../views/OnboardingView.vue");
const MatchView = () => import("../views/MatchView.vue");
const ProfileView = () => import("../views/ProfileView.vue");
const ChatListView = () => import("../views/ChatListView.vue");
const ChatView = () => import("../views/ChatView.vue");
const SearchView = () => import("../views/SearchView.vue");
const RankingView = () => import("../views/RankingView.vue");
const FavoritesView = () => import("../views/FavoritesView.vue");
const MembershipView = () => import("../views/MembershipView.vue");
const ShopView = () => import("../views/ShopView.vue");
const NotificationsView = () => import("../views/NotificationsView.vue");
const NotificationDetailView = () => import("../views/NotificationDetailView.vue");
const CharacterCreateGenderView = () => import("../views/CharacterCreateGenderView.vue");
const CharacterCreateAppearanceView = () => import("../views/CharacterCreateAppearanceView.vue");
const CharacterCreateGeneratingView = () => import("../views/CharacterCreateGeneratingView.vue");
const CharacterCreateVoiceView = () => import("../views/CharacterCreateVoiceView.vue");
const GuestUpgradeView = () => import("../views/GuestUpgradeView.vue");
const CharacterPhotoGalleryView = () => import("../views/CharacterPhotoGalleryView.vue");
const MyCharactersView = () => import("../views/MyCharactersView.vue");
const CharacterDetailView = () => import("../views/CharacterDetailView.vue");

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'login',
    component: LoginView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: OnboardingView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/guest-upgrade',
    name: 'guest-upgrade',
    component: GuestUpgradeView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/match',
    name: 'match',
    component: MatchView,
    meta: {
      showBottomNav: true,
    },
  },
  {
    path: '/search',
    name: 'search',
    component: SearchView,
    meta: {
      showBottomNav: true,
    },
  },
  {
    path: '/ranking',
    name: 'ranking',
    component: RankingView,
    meta: {
      showBottomNav: true,
    },
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: FavoritesView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/character/:characterId/photos',
    name: 'character-photos',
    component: CharacterPhotoGalleryView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: {
      showBottomNav: true,
    },
  },
  {
    path: '/my-characters',
    name: 'my-characters',
    component: MyCharactersView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/character/:id',
    name: 'character-detail',
    component: CharacterDetailView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/wallet',
    name: 'wallet',
    component: ShopView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/shop',
    name: 'shop',
    component: ShopView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/membership',
    name: 'membership',
    component: MembershipView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: NotificationsView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/notifications/:id',
    name: 'notification-detail',
    component: NotificationDetailView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/create-character/gender',
    name: 'character-create-gender',
    component: CharacterCreateGenderView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/create-character/appearance',
    name: 'character-create-appearance',
    component: CharacterCreateAppearanceView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/create-character/generating',
    name: 'character-create-generating',
    component: CharacterCreateGeneratingView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/create-character/voice',
    name: 'character-create-voice',
    component: CharacterCreateVoiceView,
    meta: {
      showBottomNav: false,
    },
  },
  {
    path: '/chat',
    name: 'chat-list',
    component: ChatListView,
    meta: {
      showBottomNav: true,
    },
  },
  {
    path: '/chat/:id',
    name: 'chat',
    component: ChatView,
    meta: {
      showBottomNav: false,
    },
  },
];

const router: Router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const { user, isAuthenticated, clearUserProfile } = useUserProfile();

const hasActiveFirebaseUser = (): boolean => {
  try {
    const auth: Auth = getAuth(getFirebaseApp());
    return Boolean(auth.currentUser);
  } catch (error) {
    return false;
  }
};

const hasValidAuthToken = (): boolean => {
  if (hasActiveFirebaseUser()) {
    return true;
  }

  return hasValidTestSession();
};

const ensureAuthTokenOrReset = (): boolean => {
  const hasToken = hasValidAuthToken();
  if (!hasToken) {
    clearTestSession();
    clearUserProfile();
  }
  return hasToken;
};

router.beforeEach(async (to, _from, next) => {
  // 🔒 修復競態條件：等待認證狀態完全初始化
  // 這確保在檢查 hasCompletedOnboarding 之前，用戶資料已經完全載入
  await ensureAuthState();

  const authenticated = isAuthenticated.value;
  const hasToken = hasValidAuthToken();

  // 允許訪問登入頁、onboarding 頁和遊客升級頁
  const publicPages = ["login", "onboarding", "guest-upgrade"];

  // ⚠️ 關鍵修復：只有在「沒有 token」時才導向 login
  if (!publicPages.includes(to.name as string) && !hasToken) {
    next({ name: "login" });
    return;
  }

  // 🔥 認證狀態已完全初始化，可以安全檢查用戶資料
  if (authenticated && hasToken) {
    const currentUser = user.value;
    // 🔒 修復：認證已完成，hasCompletedOnboarding 應該已經有明確的值
    const hasCompletedOnboarding = currentUser?.hasCompletedOnboarding;
    const isGuest = isGuestUser(currentUser?.id || '');

    // 遊客用戶跳過 onboarding 檢查
    if (!isGuest) {
      // ⚠️ 只在以下情況才重定向到 onboarding：
      // 1. 用戶明確未完成 onboarding（=== false，不包括 undefined）
      // 2. 嘗試訪問的不是 login 或 onboarding 頁面
      // 🔥 修復：使用嚴格相等判斷，避免 undefined 被誤判為 false
      if (hasCompletedOnboarding === false && to.name !== "onboarding" && to.name !== "login") {
        next({ name: "onboarding" });
        return;
      }

      // 如果已完成 onboarding 且在 onboarding 頁面，重定向到 match
      if (hasCompletedOnboarding === true && to.name === "onboarding") {
        next({ name: "match" });
        return;
      }

      // 如果在登入頁面且已登入，重定向
      if (to.name === "login") {
        // 🔒 修復：認證已完成，可以安全判斷 onboarding 狀態
        if (hasCompletedOnboarding === false) {
          next({ name: "onboarding" });
        } else if (hasCompletedOnboarding === true) {
          next({ name: "match" });
        } else {
          // 如果仍為 undefined（罕見情況），允許訪問以避免阻塞
          next();
        }
        return;
      }
    } else {
      // 遊客用戶：如果在登入頁或 onboarding 頁面，直接導向 match
      if (to.name === "login" || to.name === "onboarding") {
        next({ name: "match" });
        return;
      }
    }
  }

  if (to.name === "login" && authenticated && !hasToken) {
    ensureAuthTokenOrReset();
  }

  next();
});

const routingScope: EffectScope = effectScope();

routingScope.run(() => {
  let tokenMonitorId: number | null = null;

  const stopTokenMonitor = (): void => {
    if (tokenMonitorId != null && typeof window !== "undefined") {
      window.clearInterval(tokenMonitorId);
      tokenMonitorId = null;
    }
  };

  const checkTokenAndRedirect = async (): Promise<void> => {
    const hasToken = hasValidAuthToken();
    if (hasToken) {
      return;
    }

    ensureAuthTokenOrReset();

    try {
      await router.isReady();
    } catch (_error) {
      if (import.meta.env.DEV) {

      }
    }

    const current = router.currentRoute.value;
    if (current?.name !== "login") {
      try {
        await router.replace({ name: "login" });
      } catch (_error) {
        if (import.meta.env.DEV) {

        }
      }
    }
  };

  const startTokenMonitor = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    stopTokenMonitor();
    tokenMonitorId = window.setInterval(() => {
      checkTokenAndRedirect().catch((_error) => {
        if (import.meta.env.DEV) {

        }
      });
    }, 15000);
  };

  startTokenMonitor();
  checkTokenAndRedirect().catch((_error) => {
    if (import.meta.env.DEV) {

    }
  });

  watch(
    () => isAuthenticated.value,
    async (authenticated) => {
      const hasToken = hasValidAuthToken();
      if (authenticated && !hasToken) {
        ensureAuthTokenOrReset();
      }

      try {
        await router.isReady();
      } catch (error) {
        if (import.meta.env.DEV) {

        }
      }

      const current = router.currentRoute.value;
      if (authenticated && hasToken) {
        if (current?.name === "login") {
          const currentUser = user.value;
          const hasCompletedOnboarding = currentUser?.hasCompletedOnboarding ?? false;
          const isGuest = isGuestUser(currentUser?.id || '');

          // 遊客用戶直接導向 match，非遊客用戶根據 onboarding 狀態導向
          const targetRoute = isGuest ? "match" : (hasCompletedOnboarding ? "match" : "onboarding");

          try {
            await router.replace({ name: targetRoute });
          } catch (_error) {
            if (import.meta.env.DEV) {

            }
          }
        }
      } else if (!hasToken || (current && current.name !== "login")) {
        ensureAuthTokenOrReset();
        try {
          await router.replace({ name: "login" });
        } catch (error) {
          if (import.meta.env.DEV) {

          }
        }
      }
    }
    // ⚠️ 移除 immediate: true - 避免在認證狀態確定前執行錯誤的導向邏輯
    // 原因：immediate: true 會在 watch 註冊時立即執行，此時 isAuthenticated 還是 false
    // 導致在 authBootstrap.js 的 onAuthStateChanged 完成前就執行了錯誤的導向
  );

  onScopeDispose(() => {
    stopTokenMonitor();
  });
});

export default router;
