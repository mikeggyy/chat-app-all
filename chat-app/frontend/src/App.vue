<script setup>
import { computed, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import GlobalLoadingOverlay from "./components/GlobalLoadingOverlay.vue";
import BottomNavBar from "./components/BottomNavBar.vue";
import DesktopHeader from "./components/layout/DesktopHeader.vue";
import ToastContainer from "./components/ToastContainer.vue";
import LoginRewardModal from "./components/LoginRewardModal.vue";
import { useUserProfile } from "./composables/useUserProfile";
import { useLoginReward } from "./composables/useLoginReward";
import { useBreakpoint } from "./composables/useBreakpoint";
import { isGuestUser } from "../../../shared/config/testAccounts.js";

const route = useRoute();

// 響應式斷點檢測
const { isDesktop } = useBreakpoint();

// 是否顯示底部導航（手機版 + 路由允許）
const showBottomNav = computed(() => {
  return !isDesktop.value && Boolean(route.meta?.showBottomNav);
});

// 是否可以顯示登入獎勵彈窗（排除 onboarding、login、guest-upgrade 頁面）
const canShowLoginReward = computed(() => {
  const excludedRoutes = ['login', 'onboarding', 'guest-upgrade'];
  return !excludedRoutes.includes(String(route.name || ''));
});

// 是否顯示桌面版頂部導航
const showDesktopHeader = computed(() => {
  // 登入頁和 onboarding 頁面不顯示桌面版導航
  const excludedRoutes = ['login', 'onboarding', 'guest-upgrade'];
  return isDesktop.value && !excludedRoutes.includes(String(route.name || ''));
});

// 用戶狀態
const { user } = useUserProfile();

// 登入獎勵
const {
  showRewardModal,
  canClaim,
  isClaiming,
  currentStreak,
  todayReward,
  weekRewards,
  monthRewards,
  displayMilestones,
  status,
  lastClaimResult,
  fetchStatus,
  claimReward,
  closeModal,
} = useLoginReward();

// 下一個里程碑
const nextMilestone = computed(() => {
  if (!status.value?.nextMilestone) return null;
  return status.value.nextMilestone;
});

// 監聽用戶登入狀態，已登入時獲取獎勵狀態
watch(
  () => user.value?.id,
  async (userId) => {
    if (userId && !isGuestUser(userId)) {
      await fetchStatus();
    }
  },
  { immediate: true }
);

// 處理領取獎勵
const handleClaim = async () => {
  await claimReward();
};
</script>

<template>
  <div class="app-shell" :class="{ 'is-desktop': isDesktop }">
    <GlobalLoadingOverlay />
    <ToastContainer />

    <!-- 桌面版頂部導航 -->
    <DesktopHeader v-if="showDesktopHeader" />

    <!-- 主要內容區 -->
    <main class="app-main" :class="{ 'has-desktop-header': showDesktopHeader }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- 手機版底部導航 -->
    <BottomNavBar v-if="showBottomNav" />

    <!-- 每日登入獎勵彈窗（不在 onboarding/login 頁面顯示） -->
    <LoginRewardModal
      :is-open="showRewardModal && canShowLoginReward"
      :can-claim="canClaim"
      :is-claiming="isClaiming"
      :current-streak="currentStreak"
      :today-reward="todayReward"
      :week-rewards="weekRewards"
      :month-rewards="monthRewards"
      :display-milestones="displayMilestones"
      :next-milestone="nextMilestone"
      :claim-result="lastClaimResult"
      @close="closeModal"
      @claim="handleClaim"
    />
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  min-height: 100%;
  height: 100%;
  position: relative;

  // 桌面版佈局
  &.is-desktop {
    display: flex;
    flex-direction: column;
    background: radial-gradient(circle at top right, #1e1b4b, transparent 40%),
                radial-gradient(circle at bottom left, #312e81, transparent 40%),
                var(--bg-dark);
    background-attachment: fixed;
  }
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; // 防止 flex 溢出

  // 桌面版有頂部導航時的內邊距
  &.has-desktop-header {
    padding-top: var(--desktop-header-height, 64px);
  }
}
</style>
