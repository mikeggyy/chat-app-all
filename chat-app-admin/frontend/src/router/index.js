import { createRouter, createWebHashHistory } from "vue-router";
import { useAdminStore } from "../stores/admin";

const routes = [
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/Login.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/",
    component: () => import("../views/Layout.vue"),
    redirect: "/dashboard",
    meta: { requiresAuth: true },
    children: [
      {
        path: "dashboard",
        name: "Dashboard",
        component: () => import("../views/Dashboard.vue"),
        meta: { title: "儀表板", icon: "DataAnalysis" },
      },
      {
        path: "users",
        name: "Users",
        component: () => import("../views/Users.vue"),
        meta: { title: "用戶管理", icon: "User" },
      },
      {
        path: "user-resources",
        name: "UserResources",
        component: () => import("../views/UserResources.vue"),
        meta: { title: "角色資源管理", icon: "Box" },
      },
      {
        path: "characters",
        name: "Characters",
        component: () => import("../views/Characters.vue"),
        meta: { title: "角色管理", icon: "Avatar" },
      },
      {
        path: "conversations",
        name: "Conversations",
        component: () => import("../views/Conversations.vue"),
        meta: { title: "對話監控", icon: "ChatDotRound" },
      },
      {
        path: "transactions",
        name: "Transactions",
        component: () => import("../views/Transactions.vue"),
        meta: { title: "交易記錄", icon: "Coin" },
      },
      {
        path: "membership-tiers",
        name: "MembershipTiers",
        component: () => import("../views/MembershipTiers.vue"),
        meta: { title: "會員等級配置", icon: "Medal" },
      },
      {
        path: "products",
        name: "Products",
        component: () => import("../views/Products.vue"),
        meta: { title: "商品管理", icon: "ShoppingCart" },
      },
      {
        path: "ai-settings",
        name: "AISettings",
        component: () => import("../views/AISettings.vue"),
        meta: { title: "AI 參數設定", icon: "MagicStick" },
      },
      {
        path: "rewards",
        name: "Rewards",
        component: () => import("../views/Rewards.vue"),
        meta: { title: "獎勵配置", icon: "Present" },
      },
      {
        path: "flash-sales",
        name: "FlashSales",
        component: () => import("../views/FlashSales.vue"),
        meta: { title: "限時閃購", icon: "Lightning" },
      },
      {
        path: "notifications",
        name: "Notifications",
        component: () => import("../views/Notifications.vue"),
        meta: { title: "通知管理", icon: "Bell" },
      },
      {
        path: "video-generation",
        name: "VideoGeneration",
        component: () => import("../views/VideoGeneration.vue"),
        meta: { title: "影片生成", icon: "VideoCamera" },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 路由守衛
router.beforeEach(async (to, from, next) => {
  const adminStore = useAdminStore();
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);

  // 等待認證初始化完成
  if (adminStore.loading) {
    // 使用 Promise 等待 loading 變為 false
    await new Promise((resolve) => {
      const unwatch = adminStore.$subscribe((mutation, state) => {
        if (!state.loading) {
          unwatch();
          resolve();
        }
      });
      // 如果已經不是 loading 狀態，立即 resolve
      if (!adminStore.loading) {
        unwatch();
        resolve();
      }
    });
  }

  if (requiresAuth && !adminStore.isAuthenticated) {
    next("/login");
  } else if (to.path === "/login" && adminStore.isAuthenticated) {
    next("/");
  } else {
    next();
  }
});

export default router;
