<script setup>
import { computed, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import GlobalLoadingOverlay from "./components/GlobalLoadingOverlay.vue";
import BottomNavBar from "./components/BottomNavBar.vue";
import ToastContainer from "./components/ToastContainer.vue";
import LoginRewardModal from "./components/LoginRewardModal.vue";
import { useUserProfile } from "./composables/useUserProfile";
import { useLoginReward } from "./composables/useLoginReward";
import { isGuestUser } from "../../../shared/config/testAccounts.js";

const route = useRoute();
const showBottomNav = computed(() => Boolean(route.meta?.showBottomNav));

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
  <div class="app-shell">
    <GlobalLoadingOverlay />
    <ToastContainer />
    <router-view />
    <BottomNavBar v-if="showBottomNav" />

    <!-- 每日登入獎勵彈窗 -->
    <LoginRewardModal
      :is-open="showRewardModal"
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

<style scoped>
.app-shell {
  min-height: 100%;
  height: 100%;
  position: relative;
}
</style>
