<script setup lang="ts">
import { computed, ref, onMounted, type Ref } from "vue";
import { useRouter } from "vue-router";
import { useUserProfile } from "../composables/useUserProfile";
import { useMembership } from "../composables/useMembership";
import { useMembershipConfig } from "../composables/useMembershipConfig";
import { useToast } from "../composables/useToast";
import { useGuestGuard } from "../composables/useGuestGuard";
import { logger } from "../utils/logger.js";
// ✅ 2025-12-03 更新：保留靜態配置作為備用，主要從 API 獲取
import {
  membershipTiers as fallbackTiers,
  comparisonFeatures as fallbackComparison,
  type Tier,
} from "../config/membership";
import MembershipHero from "../components/membership/MembershipHero.vue";
import MembershipTabs from "../components/membership/MembershipTabs.vue";
import PlanCard from "../components/membership/PlanCard.vue";
import FeaturesList from "../components/membership/FeaturesList.vue";
import ComparisonTable from "../components/membership/ComparisonTable.vue";
import UpgradeConfirmModal from "../components/membership/UpgradeConfirmModal.vue";

/**
 * MembershipView - 會員中心頁面（重構後）
 * 職責：整合所有子組件，管理會員狀態和業務邏輯
 *
 * ✅ 重構完成：從 826 行優化至 ~200 行
 * ✅ 拆分為 5 個組件：MembershipHero, MembershipTabs, PlanCard, FeaturesList, ComparisonTable
 * ✅ 改善可維護性、可測試性、可重用性
 * ✅ 2025-12-03 更新：從 API 獲取會員配置（支援後台管理）
 */

const router = useRouter();
const { user } = useUserProfile();
const { currentTier, loadMembership, upgradeMembership } = useMembership();
const {
  tiers: apiTiers,
  comparisonFeatures: apiComparisonFeatures,
  loadAllConfig,
} = useMembershipConfig();

const { success, error: showError, warning } = useToast();
const { requireLogin } = useGuestGuard();

const isUpgrading: Ref<boolean> = ref(false);

// ✅ 2025-11-30 新增：升級確認彈窗狀態
const showUpgradeModal = ref(false);
// ✅ 2025-12-03 更新：使用 any 類型以支援 API 和靜態配置的混合使用
const selectedTier = ref<any>(null);
// ✅ 2025-12-03 新增：選中的訂閱週期
const selectedCycle = ref<string>("monthly");

// ✅ 2025-12-03 更新：優先使用 API 配置，備用靜態配置
const membershipTiers = computed(() => {
  if (apiTiers.value.length > 0) {
    // 將 API 數據轉換為前端格式（添加 priceTag 和 pricePeriod）
    return apiTiers.value.map((tier) => ({
      ...tier,
      priceTag: `NT$ ${tier.prices.monthly.price}`,
      pricePeriod: "/ 月",
    }));
  }
  return fallbackTiers;
});

const comparisonFeatures = computed(() => {
  if (apiComparisonFeatures.value.length > 0) {
    return apiComparisonFeatures.value;
  }
  return fallbackComparison;
});

// 會員配置從 API 或靜態配置獲取
const activeTierId: Ref<string> = ref("lite");

const activeTier = computed(() => {
  return (
    membershipTiers.value.find((tier: any) => tier.id === activeTierId.value) ??
    membershipTiers.value[0]
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
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.push({ name: "profile" });
};

/**
 * 點擊升級按鈕 - 開啟確認彈窗
 * ✅ 2025-11-30 更新：改為顯示確認彈窗，展示補差價明細
 * ✅ 2025-12-03 更新：新增訂閱週期參數
 */
const handleUpgrade = (tier: Tier, cycle: string = "monthly"): void => {
  if (!tier || isUpgrading.value) {
    return;
  }

  if (!user.value?.id) {
    showError("請先登入");
    return;
  }

  // 檢查是否為遊客
  if (requireLogin({ feature: "升級會員" })) {
    return;
  }

  // 檢查是否已經是該等級或更高等級
  if (currentTier.value === tier.id) {
    warning("您已經是該會員等級");
    return;
  }

  // ✅ 2025-11-30 更新：檢查降級
  const tierOrder: Record<string, number> = {
    free: 0,
    lite: 1,
    vip: 2,
    vvip: 3,
  };
  if (tierOrder[tier.id] < tierOrder[currentTier.value]) {
    warning("無法降級會員等級");
    return;
  }

  // 開啟確認彈窗，保存選中的訂閱週期
  selectedTier.value = tier;
  selectedCycle.value = cycle;
  showUpgradeModal.value = true;
};

/**
 * 確認升級 - 執行升級操作
 * ✅ 2025-11-30 新增：從彈窗確認後執行
 * ✅ 2025-12-03 更新：支援訂閱週期
 */
const handleConfirmUpgrade = async (tier: Tier): Promise<void> => {
  if (!tier || !user.value?.id) {
    return;
  }

  // 關閉彈窗
  showUpgradeModal.value = false;
  isUpgrading.value = true;

  try {
    // TODO: 整合真實的支付流程
    // ✅ 2025-11-30 更新：新增 Lite 等級支援
    // ✅ 2025-12-03 更新：傳遞訂閱週期
    await upgradeMembership(
      user.value.id,
      tier.id as "free" | "lite" | "vip" | "vvip",
      {
        paymentMethod: "credit_card",
        plan: selectedCycle.value as "monthly" | "quarterly" | "yearly",
      }
    );

    // 升級成功，重新載入會員資料
    await loadMembership(user.value.id);

    // 顯示成功訊息（年訂閱顯示特殊訊息）
    const cycleText = selectedCycle.value === "yearly" ? "（年訂閱）" : "";
    success(`成功升級至 ${tier.label}${cycleText}！`, {
      title: "升級成功",
    });
  } catch (error: any) {
    const message = error?.message || "升級失敗，請稍後再試";
    showError(message);
  } finally {
    isUpgrading.value = false;
    selectedTier.value = null;
    selectedCycle.value = "monthly";
  }
};

/**
 * 關閉升級彈窗
 */
const handleCloseUpgradeModal = (): void => {
  showUpgradeModal.value = false;
  selectedTier.value = null;
};

// 初始化時載入會員資料和配置
onMounted(async () => {
  // ✅ 2025-12-03 更新：從 API 載入會員配置
  try {
    await loadAllConfig();
  } catch (error) {
    logger.warn("[會員方案] 載入 API 配置失敗，使用靜態配置", error);
    // 載入失敗時使用靜態配置，不阻止頁面渲染
  }

  if (user.value?.id) {
    try {
      await loadMembership(user.value.id, { skipGlobalLoading: true });

      // 如果用戶已經是付費會員，預設選中對應的等級
      // ✅ 2025-11-30 更新：新增 Lite 等級支援
      if (
        currentTier.value === "lite" ||
        currentTier.value === "vip" ||
        currentTier.value === "vvip"
      ) {
        activeTierId.value = currentTier.value;
      }
    } catch (error) {
      logger.error("[會員方案] 載入會員資料失敗", error);
      // 載入失敗時，使用預設的免費方案顯示，不阻止頁面渲染
    }
  }
});
</script>

<template>
  <div class="membership-screen">
    <!-- Hero Section -->
    <MembershipHero @back="handleBack" />

    <!-- ✅ 桌機版：三欄並排顯示所有方案 -->
    <section class="membership-desktop-grid">
      <PlanCard
        v-for="tier in membershipTiers"
        :key="tier.id"
        :tier="tier"
        :is-upgrading="isUpgrading && selectedTier?.id === tier.id"
        @upgrade="handleUpgrade"
      />
    </section>

    <!-- ✅ 手機版：Tabs 切換 -->
    <div class="membership-mobile">
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
      </section>
    </div>

    <!-- Comparison Table（桌機和手機都顯示） -->
    <section class="membership-comparison">
      <ComparisonTable :features="comparisonFeatures" />
    </section>

    <!-- ✅ 2025-11-30 新增：升級確認彈窗（顯示補差價明細） -->
    <!-- ✅ 2025-12-03 更新：傳遞訂閱週期 -->
    <UpgradeConfirmModal
      :is-open="showUpgradeModal"
      :tier="selectedTier"
      :user-id="user?.id || ''"
      :billing-cycle="selectedCycle"
      @close="handleCloseUpgradeModal"
      @confirm="handleConfirmUpgrade"
    />
  </div>
</template>

<style scoped lang="scss">
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
  /* ✅ 2025-12-03 修復：增加底部 padding 確保內容不被切斷 */
  padding-bottom: 4rem;
}

/* ✅ 桌機版：三欄並排 Grid（預設隱藏） */
.membership-desktop-grid {
  display: none;
}

/* ✅ 手機版：預設顯示 */
.membership-mobile {
  display: block;
}

/* Panel */
.membership-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0 1.25rem;
  /* ✅ 2025-12-03 修復：移除 overflow 和 max-height 限制 */
}

/* Comparison Table */
.membership-comparison {
  padding: 0 1.25rem;
  margin-top: 1.5rem;
}

/* ✅ 2025-12-03 新增：小螢幕手機版優化 */
@media (max-width: 640px) {
  .membership-screen {
    padding-bottom: 3rem;
    overflow-y: auto;
    max-height: 1dvh;
  }

  .membership-panel {
    gap: 1rem;
    padding: 0 1rem;
  }

  .membership-comparison {
    padding: 0 1rem;
    margin-top: 1rem;
  }
}

// ========================================
// 桌面版樣式 (≥ 1024px)
// ========================================

@media (min-width: 1024px) {
  .membership-screen {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 32px;
    padding-bottom: 48px;
    min-height: auto;
    background: transparent;
    overflow-y: auto;
  }

  /* ✅ 桌機版：顯示三欄 Grid */
  .membership-desktop-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    padding: 0;
    margin-bottom: 2rem;
  }

  /* ✅ 桌機版：隱藏手機版的 tabs 和 panel */
  .membership-mobile {
    display: none;
  }

  .membership-comparison {
    padding: 0;
    margin-top: 0;
  }

  .membership-panel {
    max-height: none;
    gap: 2rem;
    padding: 0;
  }
}

// ========================================
// 中等螢幕 (768px - 1023px)
// ========================================

@media (min-width: 768px) and (max-width: 1023px) {
  .membership-screen {
    padding: 16px 24px;
    overflow-y: auto;
    max-height: 1dvh;
  }

  .membership-panel {
    max-height: none;
  }
}
</style>
