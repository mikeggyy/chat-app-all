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
import {
  useShopItems,
  type AssetPackageData,
  type PotionPackageData,
  type BundlePackageData,
} from "../composables/shop/useShopItems";
import { useShopPurchase, type ShopItem } from "../composables/shop/useShopPurchase";

// Type for component event (compatible with ShopItem)
interface ShopItemEvent {
  id: string;
  name: string;
  price: number;
  category?: string;
  isCoinPackage?: boolean;
  [key: string]: unknown;
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
const assetPackages: Ref<AssetPackageData[]> = ref([]);
const potionPackages: Ref<PotionPackageData[]> = ref([]);
const bundlePackages: Ref<BundlePackageData[]> = ref([]);
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
  packages,
  assetPackages,
  potionPackages,
  bundlePackages,
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

// Wrapper function to handle component event type conversion
// ShopItemEvent and ShopItem have slightly different required properties
// but the runtime data always includes category from the shop items
const onPurchase = (item: ShopItemEvent): void => {
  handlePurchase(item as unknown as ShopItem);
};

// 從 API 加載解鎖卡套餐
const loadAssetPackages = async () => {
  try {
    const response = await apiJson("/api/assets/packages");
    if (response.success) {
      // ✅ 修復：API 響應數據在 data 屬性中
      assetPackages.value = response.data?.packages || response.packages || [];
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
      // ✅ 修復：API 響應數據在 data 屬性中
      potionPackages.value = response.data?.potions || response.potions || [];
    }
  } catch (error) {
    logger.error("加載藥水商品失敗:", error);
  }
};

// 從 API 加載組合禮包
const loadBundlePackages = async () => {
  try {
    // 如果已登入，使用帶狀態的端點
    const userId = user.value?.id;
    const isGuest = userId ? isGuestUser(userId) : true;

    if (!isGuest && userId) {
      // 已登入用戶：獲取含購買狀態的禮包列表
      const response = await apiJson("/api/bundles/me");
      if (response.success) {
        // ✅ 修復：API 響應數據在 data 屬性中
        bundlePackages.value = response.data?.packages || response.packages || [];
      }
    } else {
      // 訪客用戶：獲取公開禮包列表
      const response = await apiJson("/api/bundles");
      if (response.success) {
        // ✅ 修復：API 響應數據在 data 屬性中
        bundlePackages.value = response.data?.packages || response.packages || [];
      }
    }
  } catch (error) {
    logger.error("加載組合禮包失敗:", error);
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
    await Promise.all([loadAssetPackages(), loadPotionPackages(), loadBundlePackages()]);
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
      @purchase="onPurchase"
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

// ========================================
// 桌面版樣式 (≥ 1024px)
// ========================================

@media (min-width: 1024px) {
  .shop-view {
    max-width: 1400px;
    margin: 0 auto;
    padding: 32px 48px 48px;
    min-height: calc(100vh - var(--desktop-header-height, 64px));
    background: transparent;
    gap: 24px;
  }
}

// 寬螢幕優化
@media (min-width: 1440px) {
  .shop-view {
    max-width: 1600px;
    padding: 40px 64px 64px;
    gap: 32px;
  }
}

// 超寬螢幕
@media (min-width: 1920px) {
  .shop-view {
    max-width: 1800px;
  }
}
</style>
