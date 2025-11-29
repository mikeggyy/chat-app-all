<script setup lang="ts">
import { computed, ref, onMounted, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserProfile } from '../composables/useUserProfile';
import { useMembership } from '../composables/useMembership';
import { useToast } from '../composables/useToast';
import { useGuestGuard } from '../composables/useGuestGuard';
import { logger } from '../utils/logger.js';
import { membershipTiers, comparisonFeatures, type Tier } from '../config/membership';
import MembershipHero from '../components/membership/MembershipHero.vue';
import MembershipTabs from '../components/membership/MembershipTabs.vue';
import PlanCard from '../components/membership/PlanCard.vue';
import FeaturesList from '../components/membership/FeaturesList.vue';
import ComparisonTable from '../components/membership/ComparisonTable.vue';

/**
 * MembershipView - 會員中心頁面（重構後）
 * 職責：整合所有子組件，管理會員狀態和業務邏輯
 *
 * ✅ 重構完成：從 826 行優化至 ~200 行
 * ✅ 拆分為 5 個組件：MembershipHero, MembershipTabs, PlanCard, FeaturesList, ComparisonTable
 * ✅ 改善可維護性、可測試性、可重用性
 */

const router = useRouter();
const { user } = useUserProfile();
const {
  currentTier,
  loadMembership,
  upgradeMembership,
} = useMembership();

const { success, error: showError, warning } = useToast();
const { requireLogin } = useGuestGuard();

const isUpgrading: Ref<boolean> = ref(false);

// 會員配置從 config/membership.js 導入
const activeTierId: Ref<string> = ref(membershipTiers[0].id);

const activeTier = computed(() => {
  return (
    membershipTiers.find((tier) => tier.id === activeTierId.value) ??
    membershipTiers[0]
  );
});

/**
 * 切換會員方案
 */
const selectTier = (tierId: string): void => {
  if (!tierId || activeTierId.value === tierId) {
    return;
  }
  activeTierId.value = tierId;
};

/**
 * 返回上一頁
 */
const handleBack = (): void => {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
    return;
  }
  router.push({ name: 'profile' });
};

/**
 * 升級會員
 */
const handleUpgrade = async (tier: Tier): Promise<void> => {
  if (!tier || isUpgrading.value) {
    return;
  }

  if (!user.value?.id) {
    showError('請先登入');
    return;
  }

  // 檢查是否為遊客
  if (requireLogin({ feature: '升級會員' })) {
    return;
  }

  // 檢查是否已經是該等級或更高等級
  if (currentTier.value === tier.id) {
    warning('您已經是該會員等級');
    return;
  }

  if (currentTier.value === 'vvip' && tier.id === 'vip') {
    warning('無法從 VVIP 降級至 VIP');
    return;
  }

  isUpgrading.value = true;

  try {
    // TODO: 整合真實的支付流程
    await upgradeMembership(user.value.id, tier.id as 'free' | 'vip' | 'vvip', {
      paymentMethod: 'credit_card',
    });

    // 升級成功，重新載入會員資料
    await loadMembership(user.value.id);

    // 顯示成功訊息
    success(`成功升級至 ${tier.label}！`, {
      title: '升級成功',
    });
  } catch (error: any) {
    const message = error?.message || '升級失敗，請稍後再試';
    showError(message);
  } finally {
    isUpgrading.value = false;
  }
};

// 初始化時載入會員資料
onMounted(async () => {
  if (user.value?.id) {
    try {
      await loadMembership(user.value.id, { skipGlobalLoading: true });

      // 如果用戶已經是付費會員，預設選中對應的等級
      if (currentTier.value === 'vip' || currentTier.value === 'vvip') {
        activeTierId.value = currentTier.value;
      }
    } catch (error) {
      logger.error('[會員方案] 載入會員資料失敗', error);
      // 載入失敗時，使用預設的免費方案顯示，不阻止頁面渲染
    }
  }
});
</script>

<template>
  <div class="membership-screen">
    <!-- Hero Section -->
    <MembershipHero @back="handleBack" />

    <!-- Tier Tabs -->
    <MembershipTabs
      :tiers="membershipTiers"
      :active-tier-id="activeTierId"
      @select="selectTier"
    />

    <!-- Active Tier Panel -->
    <section
      v-if="activeTier"
      class="membership-panel"
      role="tabpanel"
      :aria-label="`${activeTier.label} 方案內容`"
    >
      <!-- Plan Card -->
      <PlanCard
        :tier="activeTier"
        :is-upgrading="isUpgrading"
        @upgrade="handleUpgrade"
      />

      <!-- Features List -->
      <FeaturesList :features="activeTier.features" />

      <!-- Comparison Table -->
      <ComparisonTable :features="comparisonFeatures" />
    </section>
  </div>
</template>

<style scoped>
.membership-screen {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    135deg,
    #0a0e27 0%,
    #1a1f3a 25%,
    #0f1629 50%,
    #1e2642 75%,
    #0d1123 100%
  );
  color: #f4f6ff;
  padding-bottom: 2rem;
}

/* Panel */
.membership-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0 1.25rem;
  overflow-y: auto;
  /* 使用 flex-1 讓它自動填充剩餘空間 */
  flex: 1;
  /* 或使用動態視口單位，減去 hero section 的高度 */
  max-height: calc(100dvh - 280px);
}
</style>
