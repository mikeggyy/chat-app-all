<script setup lang="ts">
import { ref, onMounted, watch, type Ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { logger } from "@/utils/logger";
import { useUserProfile } from "../composables/useUserProfile";
import { useCoins } from "../composables/useCoins";
import { useMembership } from "../composables/useMembership";
import { useToast } from "../composables/useToast";
import { usePurchaseConfirm } from "../composables/usePurchaseConfirm";
import { isGuestUser } from "../../../../shared/config/testAccounts.js";
import PurchaseConfirmDialog from "../components/PurchaseConfirmDialog.vue";
import ShopHeader from "../components/shop/ShopHeader.vue";
import ShopCategories from "../components/shop/ShopCategories.vue";
import ShopItemsList from "../components/shop/ShopItemsList.vue";
import { apiJson } from "../utils/api";
import { useShopCategories } from "../composables/shop/useShopCategories";
import { useShopItems } from "../composables/shop/useShopItems";
import { useShopPurchase } from "../composables/shop/useShopPurchase";

// Types
interface AssetPackage {
  [key: string]: any;
}

interface PotionPackage {
  [key: string]: any;
}

const router = useRouter();
const route = useRoute();
const { user } = useUserProfile();
const {
  balance,
  packages,
  formattedBalance,
  loadBalance,
  loadPackages,
  purchasePackage,
  resetCoins,
  isLoading: _isCoinsLoading,
} = useCoins();
const { membershipInfo, loadMembership } = useMembership();
const { error: showError } = useToast();
const { dialogState, handleConfirm, handleCancel } = usePurchaseConfirm();

const isCoinIconAvailable: Ref<boolean> = ref(true);
const assetPackages: Ref<AssetPackage[]> = ref([]);
const potionPackages: Ref<PotionPackage[]> = ref([]);
const isLoadingPackages: Ref<boolean> = ref(false);

// 使用分類管理 Composable
const {
  categories,
  activeCategory,
  activeCategoryInfo,
  handleCategoryChange,
  initializeCategoryFromQuery,
  updateCategoryFromRoute,
} = useShopCategories();

// 使用商品管理 Composable
const { filteredItems, COIN_ICON_PATH: _COIN_ICON_PATH } = useShopItems(
  packages as any,
  assetPackages as any,
  potionPackages as any,
  activeCategory
);

// 使用購買邏輯 Composable
const { isPurchasing, isPurchasingItem, handlePurchase } = useShopPurchase({
  user,
  balance,
  membership: membershipInfo,
  activeCategory,
  loadBalance,
  purchasePackage,
});

const handleBack = () => {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.push({ name: "profile" });
};

const handleCoinIconError = () => {
  if (isCoinIconAvailable.value) {
    isCoinIconAvailable.value = false;
  }
};

// 從 API 加載解鎖卡套餐
const loadAssetPackages = async () => {
  try {
    const response = await apiJson("/api/assets/packages");
    if (response.success) {
      assetPackages.value = response.packages || [];
    }
  } catch (error) {
    logger.error("加載解鎖卡套餐失敗:", error);
  }
};

// 從 API 加載藥水商品
const loadPotionPackages = async () => {
  try {
    const response = await apiJson("/api/potions/packages");
    if (response.success) {
      potionPackages.value = response.potions || [];
    }
  } catch (error) {
    logger.error("加載藥水商品失敗:", error);
  }
};

// 監聽路由變化，更新分類（當用戶在商城頁面內導航時）
watch(
  () => route.query.category,
  (newCategory) => {
    updateCategoryFromRoute(newCategory as string | undefined);
  }
);

// 初始化時載入金幣資料
onMounted(async () => {
  // 檢查 URL query 參數並設置初始分類
  if (route.query.category) {
    initializeCategoryFromQuery(route.query.category as string);
  }

  // 加載所有商品數據（公開 API，不需要認證）
  isLoadingPackages.value = true;
  try {
    await Promise.all([loadAssetPackages(), loadPotionPackages()]);
  } catch (err) {
    logger.error("加載商品失敗:", err);
  } finally {
    isLoadingPackages.value = false;
  }

  // ✅ 修復：訪客用戶不調用需要認證的 API
  const userId = user.value?.id;
  const isGuest = userId ? isGuestUser(userId) : true;

  if (isGuest) {
    // 訪客用戶：重置金幣狀態，只載入公開的套餐資料
    resetCoins();
    try {
      await loadPackages({ skipGlobalLoading: true });
    } catch (err) {
      logger.warn("訪客載入套餐失敗:", err);
    }
  } else if (userId) {
    // 已登入用戶：載入完整的用戶資料
    try {
      await Promise.all([
        loadBalance(userId, { skipGlobalLoading: true }),
        loadPackages({ skipGlobalLoading: true }),
        loadMembership(userId, { skipGlobalLoading: true }),
      ]);
    } catch (err: unknown) {
      const message = (err as Error)?.message || "載入資料失敗";
      showError(message);
    }
  }
});
</script>

<template>
  <main class="shop-view">
    <!-- 頂部餘額區域 -->
    <ShopHeader
      :formatted-balance="formattedBalance"
      :is-coin-icon-available="isCoinIconAvailable"
      @back="handleBack"
      @coin-icon-error="handleCoinIconError"
    />

    <!-- 分類標籤 -->
    <ShopCategories
      :categories="categories"
      :active-category="activeCategory"
      @change="handleCategoryChange"
    />

    <!-- 商品列表 -->
    <ShopItemsList
      :items="filteredItems"
      :is-purchasing="isPurchasing"
      :is-purchasing-item="isPurchasingItem"
      :balance="balance"
      :membership-tier="membershipInfo?.tier || 'free'"
      :is-coin-icon-available="isCoinIconAvailable"
      :category-description="activeCategoryInfo?.description"
      @purchase="(handlePurchase as any)"
      @coin-icon-error="handleCoinIconError"
    />

    <!-- 購買確認彈窗 -->
    <PurchaseConfirmDialog
      v-if="dialogState.isOpen"
      :title="dialogState.title"
      :message="dialogState.message"
      :confirm-text="dialogState.confirmText"
      :cancel-text="dialogState.cancelText"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
  </main>
</template>

<style scoped lang="scss">
.shop-view {
  min-height: 100vh;
  min-height: 100dvh;
  background: radial-gradient(
      circle at top,
      rgba(30, 64, 175, 0.35),
      transparent
    ),
    radial-gradient(circle at bottom, rgba(236, 72, 153, 0.18), transparent),
    #020617;
  color: #e2e8f0;
  padding-bottom: calc(var(--bottom-nav-offset, 90px) + 1.5rem);
  position: relative;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}
</style>
