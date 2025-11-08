import { createRouter, createWebHashHistory } from "vue-router";
import { effectScope, watch, onScopeDispose } from "vue";
import { getAuth } from "firebase/auth";
import LoginView from "../views/LoginView.vue";
import OnboardingView from "../views/OnboardingView.vue";
import MatchView from "../views/MatchView.vue";
import ProfileView from "../views/ProfileView.vue";
import ChatListView from "../views/ChatListView.vue";
import ChatView from "../views/ChatView.vue";
import SearchView from "../views/SearchView.vue";
import RankingView from "../views/RankingView.vue";
import FavoritesView from "../views/FavoritesView.vue";
import WalletView from "../views/WalletView.vue";
import MembershipView from "../views/MembershipView.vue";
import ShopView from "../views/ShopView.vue";
import NotificationsView from "../views/NotificationsView.vue";
import NotificationDetailView from "../views/NotificationDetailView.vue";
import CharacterCreateGenderView from "../views/CharacterCreateGenderView.vue";
import CharacterCreateAppearanceView from "../views/CharacterCreateAppearanceView.vue";
import CharacterCreateGeneratingView from "../views/CharacterCreateGeneratingView.vue";
import CharacterCreateVoiceView from "../views/CharacterCreateVoiceView.vue";
import GuestUpgradeView from "../views/GuestUpgradeView.vue";
import CharacterPhotoGalleryView from "../views/CharacterPhotoGalleryView.vue";
import MyCharactersView from "../views/MyCharactersView.vue";
import CharacterDetailView from "../views/CharacterDetailView.vue";
import { useUserProfile } from "../composables/useUserProfile.js";
import { getFirebaseApp } from "../utils/firebase.js";
import {
  clearTestSession,
  hasValidTestSession,
} from "../services/testAuthSession.js";
import { isGuestUser } from "../../../../shared/config/testAccounts.js";

const routes = [
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

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const { user, isAuthenticated, clearUserProfile } = useUserProfile();

const hasActiveFirebaseUser = () => {
  try {
    const auth = getAuth(getFirebaseApp());
    return Boolean(auth.currentUser);
  } catch (error) {
    return false;
  }
};

const hasValidAuthToken = () => {
  if (hasActiveFirebaseUser()) {
    return true;
  }

  return hasValidTestSession();
};

const ensureAuthTokenOrReset = () => {
  const hasToken = hasValidAuthToken();
  if (!hasToken) {
    clearTestSession();
    clearUserProfile();
  }
  return hasToken;
};

router.beforeEach((to, from, next) => {
  const authenticated = isAuthenticated.value;
  const hasToken = hasValidAuthToken();

  // 允許訪問登入頁、onboarding 頁和遊客升級頁
  const publicPages = ["login", "onboarding", "guest-upgrade"];
  if (!publicPages.includes(to.name) && (!authenticated || !hasToken)) {
    if (authenticated) {
      clearUserProfile();
    }
    next({ name: "login" });
    return;
  }

  // 如果用戶已登入，檢查是否完成 onboarding
  if (authenticated && hasToken) {
    const currentUser = user.value;
    const hasCompletedOnboarding = currentUser?.hasCompletedOnboarding ?? false;
    const isGuest = isGuestUser(currentUser?.id);

    // 遊客用戶跳過 onboarding 檢查
    if (!isGuest) {
      // 如果未完成 onboarding 且不在 onboarding 頁面，重定向到 onboarding
      if (!hasCompletedOnboarding && to.name !== "onboarding" && to.name !== "login") {
        next({ name: "onboarding" });
        return;
      }

      // 如果已完成 onboarding 且在 onboarding 頁面，重定向到 match
      if (hasCompletedOnboarding && to.name === "onboarding") {
        next({ name: "match" });
        return;
      }

      // 如果在登入頁面且已登入，重定向
      if (to.name === "login") {
        // 如果未完成 onboarding，去 onboarding 頁
        if (!hasCompletedOnboarding) {
          next({ name: "onboarding" });
        } else {
          // 已完成，去 match 頁
          next({ name: "match" });
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

const routingScope = effectScope();

routingScope.run(() => {
  let tokenMonitorId = null;

  const stopTokenMonitor = () => {
    if (tokenMonitorId != null && typeof window !== "undefined") {
      window.clearInterval(tokenMonitorId);
      tokenMonitorId = null;
    }
  };

  const checkTokenAndRedirect = async () => {
    const hasToken = hasValidAuthToken();
    if (hasToken) {
      return;
    }

    ensureAuthTokenOrReset();

    try {
      await router.isReady();
    } catch (error) {
      if (import.meta.env.DEV) {

      }
    }

    const current = router.currentRoute.value;
    if (current?.name !== "login") {
      try {
        await router.replace({ name: "login" });
      } catch (error) {
        if (import.meta.env.DEV) {

        }
      }
    }
  };

  const startTokenMonitor = () => {
    if (typeof window === "undefined") {
      return;
    }
    stopTokenMonitor();
    tokenMonitorId = window.setInterval(() => {
      checkTokenAndRedirect().catch((error) => {
        if (import.meta.env.DEV) {

        }
      });
    }, 15000);
  };

  startTokenMonitor();
  checkTokenAndRedirect().catch((error) => {
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
          const isGuest = isGuestUser(currentUser?.id);

          // 遊客用戶直接導向 match，非遊客用戶根據 onboarding 狀態導向
          const targetRoute = isGuest ? "match" : (hasCompletedOnboarding ? "match" : "onboarding");

          try {
            await router.replace({ name: targetRoute });
          } catch (error) {
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
    },
    { immediate: true }
  );

  onScopeDispose(() => {
    stopTokenMonitor();
  });
});

export default router;
