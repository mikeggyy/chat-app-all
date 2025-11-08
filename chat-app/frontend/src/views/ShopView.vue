<script setup>
import { computed, ref, onMounted, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  ArrowLeftIcon,
  ShoppingBagIcon,
  TicketIcon,
  PhotoIcon,
} from "@heroicons/vue/24/outline";
import {
  SparklesIcon,
  ChatBubbleBottomCenterIcon,
} from "@heroicons/vue/24/solid";
import { useUserProfile } from "../composables/useUserProfile";
import { useCoins } from "../composables/useCoins";
import { useMembership } from "../composables/useMembership";
import { useGuestGuard } from "../composables/useGuestGuard";
import { useToast } from "../composables/useToast";
import { usePurchaseConfirm } from "../composables/usePurchaseConfirm";
import LoadingSpinner from "../components/LoadingSpinner.vue";
import PurchaseConfirmDialog from "../components/PurchaseConfirmDialog.vue";
import { apiJson } from "../utils/api";
import {
  getPotionsList,
  getAssetCardsList,
  COIN_ICON_PATH,
} from "../config/assets";

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
  isLoading: isCoinsLoading,
} = useCoins();
const { membership, loadMembership } = useMembership();
const { requireLogin } = useGuestGuard();
const { success, error: showError } = useToast();
const { dialogState, showConfirm, handleConfirm, handleCancel } = usePurchaseConfirm();

const isCoinIconAvailable = ref(true);
const isPurchasing = ref(false);
const isPurchasingItem = ref(false);
const assetPackages = ref([]);
const potionPackages = ref([]);
const isLoadingPackages = ref(false);

// 分類
const categories = ref([
  { id: "coins", label: "金幣", description: "購買金幣，用於商城內的各種消費" },
  { id: "potions", label: "道具", description: "購買增強道具，提升對話體驗" },
  {
    id: "character-unlock",
    label: "角色解鎖票",
    description: "永久解鎖與特定角色的無限對話（300金幣/張）",
  },
  {
    id: "photo-unlock",
    label: "拍照卡",
    description: "用於生成角色AI照片（50金幣/張）",
  },
  {
    id: "video-unlock",
    label: "影片卡",
    description: "用於生成角色AI短影片（200金幣/支）",
  },
  {
    id: "voice-unlock",
    label: "語音解鎖卡",
    description: "解鎖角色語音播放功能（免費/VIP用戶適用）",
  },
  { id: "create", label: "創建角色卡", description: "獲得創建專屬角色的機會" },
]);

const activeCategory = ref("coins");

const activeCategoryInfo = computed(() => {
  return categories.value.find((cat) => cat.id === activeCategory.value);
});

// 金幣套餐轉為商品格式
const coinItems = computed(() => {
  const pkgs =
    packages.value && packages.value.length > 0
      ? packages.value
      : [
          { id: "small", coins: 100, totalCoins: 100, price: 50, bonus: 0 },
          { id: "medium", coins: 500, totalCoins: 550, price: 200, bonus: 50 },
          {
            id: "large",
            coins: 1000,
            totalCoins: 1150,
            price: 350,
            bonus: 150,
            popular: true,
          },
          {
            id: "xlarge",
            coins: 3000,
            totalCoins: 3500,
            price: 1000,
            bonus: 500,
            bestValue: true,
          },
        ];

  return pkgs.map((pkg) => ({
    id: `coin-${pkg.id}`,
    category: "coins",
    name: `${pkg.totalCoins || pkg.coins} 金幣`,
    icon: null, // 金幣使用圖片而非 icon 組件
    iconColor: "coins",
    price: pkg.unitPrice || pkg.price, // 支援統一欄位 unitPrice 和舊欄位 price
    isCoinPackage: true,
    coinData: pkg,
    popular: pkg.popular || false,
    badge: pkg.bestValue ? "超值" : pkg.popular ? "熱門" : null,
    bonusText: pkg.bonus > 0 ? `+${pkg.bonus} 贈送` : null,
    useCoinImage: true, // 標記使用金幣圖片
  }));
});

// Icon 映射表（根據 category 轉換為正確的 iconColor）
const ICON_MAPPING = {
  "character_unlock": { iconColor: "character" },
  "photo_unlock": { iconColor: "photo" },
  "video_unlock": { iconColor: "video" },
  "voice_unlock": { iconColor: "voice" },
  "create_character": { iconColor: "create" },
};

// 資產卡片商品（從 API 加載）
const assetCardItems = computed(() => {
  return assetPackages.value.map((pkg) => {
    // 從 category 或 baseId 中提取 iconColor
    const mapping = ICON_MAPPING[pkg.category] || ICON_MAPPING[pkg.baseId] || {};

    // 判斷 icon 是否為 emoji（簡單判斷：如果只有1-2個字符且不是英文，可能是 emoji）
    const iconValue = pkg.icon || null;
    const isEmoji = iconValue && iconValue.length <= 2 && !/^[a-zA-Z]/.test(iconValue);

    return {
      id: pkg.id || pkg.sku,
      category: pkg.category,
      name: pkg.displayName || pkg.name,
      emoji: isEmoji ? iconValue : null,  // emoji 放到 emoji 屬性
      icon: isEmoji ? null : iconValue,    // 組件名放到 icon 屬性
      iconColor: mapping.iconColor || pkg.iconColor || "character",
      price: pkg.unitPrice || pkg.finalPrice,
      quantity: pkg.quantity || 1,
      popular: pkg.popular || false,
      badge: pkg.badge || null,
      originalPrice: pkg.originalPrice || null,
    };
  });
});

// 藥水Icon映射表
const POTION_ICON_MAPPING = {
  "memory_boost": { iconColor: "memory" },
  "brain_boost": { iconColor: "brain" },
};

// 道具商品（從 API 加載）
const potionItems = computed(() => {
  return potionPackages.value.map((potion) => {
    const mapping = POTION_ICON_MAPPING[potion.baseId] || {};

    // 判斷 icon 是否為 emoji
    const iconValue = potion.icon || null;
    const isEmoji = iconValue && iconValue.length <= 2 && !/^[a-zA-Z]/.test(iconValue);

    return {
      id: potion.id,
      category: "potions",
      name: potion.displayName || potion.name,
      description: potion.description,
      effect: potion.effect?.displayText || potion.effect,
      emoji: isEmoji ? iconValue : null,  // emoji 放到 emoji 屬性
      icon: isEmoji ? null : iconValue,    // 組件名放到 icon 屬性
      iconColor: mapping.iconColor || potion.iconColor || "memory",
      price: potion.unitPrice,
      quantity: potion.quantity || 1,
      popular: potion.popular || false,
      badge: potion.badge || null,
      requiresCharacter: false,
      originalPrice: potion.originalPrice || null,
    };
  });
});

// 合併所有商品
const allItems = computed(() => {
  return [
    ...coinItems.value,
    ...assetCardItems.value,
    ...potionItems.value,
  ];
});

// 過濾商品
const filteredItems = computed(() => {
  return allItems.value.filter(
    (item) => item.category === activeCategory.value
  );
});

const coinsFormatter = new Intl.NumberFormat("zh-TW");
const priceFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  minimumFractionDigits: 0,
});

const coinIconPath = computed(() =>
  isCoinIconAvailable.value ? COIN_ICON_PATH : ""
);

const formatCoins = (value) => coinsFormatter.format(value);
const formatPrice = (value) => priceFormatter.format(value);

const handleBack = () => {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.push({ name: "profile" });
};

const handleHistory = () => {
  // TODO: 導航到交易記錄頁面
};

const handleCategoryChange = (categoryId) => {
  activeCategory.value = categoryId;
  scrollToActiveCategory();
};

// 滾動到當前選中的分類 tab
const scrollToActiveCategory = () => {
  nextTick(() => {
    const activeTab = document.querySelector(".category-tab--active");
    if (activeTab) {
      activeTab.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  });
};

// 購買金幣
const handlePurchaseCoin = async (pkg) => {
  if (!pkg || isPurchasing.value) {
    return;
  }

  if (!user.value?.id) {
    showError("請先登入");
    return;
  }

  if (requireLogin({ feature: "購買金幣" })) {
    return;
  }

  // 確認購買
  const confirmMessage = `確定要購買 ${pkg.totalCoins || pkg.coins} 金幣嗎？\n價格：${pkg.unitPrice || pkg.price} 元${pkg.bonus > 0 ? `\n贈送：${pkg.bonus} 金幣` : ''}`;
  const confirmed = await showConfirm(confirmMessage, {
    title: '確認購買金幣',
    confirmText: '立即購買',
  });

  if (!confirmed) {
    return;
  }

  isPurchasing.value = true;

  try {
    await purchasePackage(user.value.id, pkg.id, {
      paymentMethod: "credit_card",
    });

    await loadBalance(user.value.id, { skipGlobalLoading: true });

    success(`成功購買 ${pkg.totalCoins || pkg.coins} 金幣！`, {
      title: "購買成功",
    });
  } catch (err) {
    const message = err?.message || "購買失敗，請稍後再試";
    showError(message);

  } finally {
    isPurchasing.value = false;
  }
};

// 購買道具
const handlePurchaseItem = async (item) => {
  if (!item || isPurchasingItem.value) {
    return;
  }

  if (!user.value?.id) {
    showError("請先登入");
    return;
  }

  if (requireLogin({ feature: "購買商品" })) {
    return;
  }

  if (balance.value < item.price) {
    showError("金幣不足，請先儲值");
    // 切換到金幣分類
    activeCategory.value = "coins";
    return;
  }

  // 如果是道具類別，需要特殊處理
  if (item.category === "potions") {
    return handlePurchasePotion(item);
  }

  // 確認購買
  const itemName = item.fullName || item.name;
  const confirmMessage = `確定要購買 ${itemName} 嗎？\n價格：${item.price} 金幣${item.originalPrice ? `\n原價：${item.originalPrice} 金幣 (${item.badge})` : ''}`;
  const confirmed = await showConfirm(confirmMessage, {
    title: '確認購買',
    confirmText: '立即購買',
  });

  if (!confirmed) {
    return;
  }

  isPurchasingItem.value = true;

  try {
    // 構建 SKU
    // 資產卡：構建為 category-quantity（例如 character-unlock-5）
    const sku = `${item.category}-${item.quantity || 1}`;

    console.log('[購買資產] item:', item);
    console.log('[購買資產] sku:', sku);
    console.log('[購買資產] price:', item.price);

    // 呼叫資產購買 API（使用新版 SKU）
    const result = await apiJson("/api/assets/purchase", {
      method: "POST",
      body: {
        sku: sku,
      },
    });

    if (result.success) {
      // 更新金幣餘額（跳過全域loading避免閃爍）
      await loadBalance(user.value.id, { skipGlobalLoading: true });

      success(`成功購買 ${item.name}！`);
    } else {
      throw new Error(result.message || "購買失敗");
    }
  } catch (error) {
    showError(error?.message || "購買失敗，請稍後再試");
  } finally {
    isPurchasingItem.value = false;
  }
};

// 購買藥水道具（使用統一的 SKU 格式）
const handlePurchasePotion = async (item) => {
  if (isPurchasingItem.value) {
    return;
  }

  // 檢查是否是腦力激盪藥水且用戶是VVIP
  if (
    item.id.includes("brain_boost") &&
    membership.value?.membershipTier === "vvip"
  ) {
    showError("您的模型已經是最高級了");
    return;
  }

  // 確認購買
  const confirmMessage = `確定要購買 ${item.name} 嗎？\n價格：${item.price} 金幣${item.originalPrice ? `\n原價：${item.originalPrice} 金幣 (${item.badge})` : ''}\n效果：${item.effect}`;
  const confirmed = await showConfirm(confirmMessage, {
    title: '確認購買道具',
    confirmText: '立即購買',
  });

  if (!confirmed) {
    return;
  }

  isPurchasingItem.value = true;

  try {
    // 使用統一的資產購買 API（SKU 格式）
    const result = await apiJson("/api/assets/purchase", {
      method: "POST",
      body: {
        sku: item.id, // 藥水的 SKU (例如：memory_boost_1, brain_boost_5)
      },
    });

    if (result.success) {
      // 更新金幣餘額（跳過全域loading避免閃爍）
      await loadBalance(user.value.id, { skipGlobalLoading: true });

      success(`成功購買 ${item.name}！已加入庫存`);
    } else {
      throw new Error(result.message || "購買失敗");
    }
  } catch (error) {
    showError(error?.message || "購買失敗，請稍後再試");
  } finally {
    isPurchasingItem.value = false;
  }
};

// 處理購買
const handlePurchase = async (item) => {
  if (item.isCoinPackage) {
    await handlePurchaseCoin(item.coinData);
  } else {
    await handlePurchaseItem(item);
  }
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
    console.error("加載解鎖卡套餐失敗:", error);
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
    console.error("加載藥水商品失敗:", error);
  }
};

// 初始化時載入金幣資料
onMounted(async () => {
  // 檢查 URL query 參數並設置初始分類
  if (route.query.category) {
    const requestedCategory = route.query.category;
    const validCategories = categories.value.map((c) => c.id);
    if (validCategories.includes(requestedCategory)) {
      activeCategory.value = requestedCategory;
      // 滾動到對應的分類 tab
      scrollToActiveCategory();
    }
  }

  // 加載所有商品數據
  isLoadingPackages.value = true;
  try {
    await Promise.all([
      loadAssetPackages(),
      loadPotionPackages(),
    ]);
  } catch (err) {
    console.error("加載商品失敗:", err);
  } finally {
    isLoadingPackages.value = false;
  }

  if (user.value?.id) {
    try {
      await Promise.all([
        loadBalance(user.value.id, { skipGlobalLoading: true }),
        loadPackages({ skipGlobalLoading: true }),
        loadMembership(user.value.id, { skipGlobalLoading: true }),
      ]);
    } catch (err) {
      const message = err?.message || "載入資料失敗";
      showError(message);

    }
  }
});
</script>

<template>
  <main class="shop-view">
    <!-- 頂部餘額區域 -->
    <section class="shop-hero">
      <header class="shop-header">
        <button
          type="button"
          class="shop-header__button"
          aria-label="返回"
          @click="handleBack"
        >
          <ArrowLeftIcon class="icon" aria-hidden="true" />
        </button>
        <h1 class="shop-header__title">商城</h1>
      </header>

      <div class="shop-badge" aria-hidden="true">
        <span class="shop-badge__icon">
          <img
            v-if="coinIconPath"
            :src="coinIconPath"
            alt=""
            class="shop-badge__icon-image"
            decoding="async"
            @error="handleCoinIconError"
          />
          <ChatBubbleBottomCenterIcon
            v-else
            class="shop-badge__icon-fallback"
          />
        </span>
      </div>

      <p class="shop-balance">{{ formattedBalance }}</p>
      <p class="shop-balance__label">金幣餘額</p>
    </section>

    <!-- 分類標籤 -->
    <nav class="shop-categories" aria-label="商城分類">
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        class="category-tab"
        :class="{ 'category-tab--active': activeCategory === category.id }"
        @click="handleCategoryChange(category.id)"
      >
        {{ category.label }}
      </button>
    </nav>

    <!-- 商品列表 -->
    <section class="shop-content">
      <!-- 分類描述 -->
      <div v-if="activeCategoryInfo?.description" class="category-description">
        <p>{{ activeCategoryInfo.description }}</p>
      </div>

      <div class="shop-items">
        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="shop-item"
          :class="{ 'shop-item--popular': item.popular }"
        >
          <div v-if="item.badge" class="shop-item__badge">
            <SparklesIcon class="badge-icon" aria-hidden="true" />
            {{ item.badge }}
          </div>

          <div
            class="shop-item__icon-wrapper"
            :class="{
              'has-emoji': item.emoji,
              [`shop-item__icon-wrapper--${item.iconColor}`]: item.iconColor,
            }"
          >
            <span v-if="item.emoji" class="shop-item__emoji">{{
              item.emoji
            }}</span>
            <img
              v-else-if="item.useCoinImage && isCoinIconAvailable"
              :src="COIN_ICON_PATH"
              alt=""
              class="shop-item__icon shop-item__icon-image"
              decoding="async"
              @error="handleCoinIconError"
            />
            <component
              v-else-if="item.icon"
              :is="item.icon"
              class="shop-item__icon"
              aria-hidden="true"
            />
          </div>

          <div class="shop-item__content">
            <h3 class="shop-item__name">{{ item.name }}</h3>
            <p v-if="item.bonusText" class="shop-item__bonus">
              {{ item.bonusText }}
            </p>
            <p v-if="item.description" class="shop-item__description">
              {{ item.description }}
            </p>
            <p v-if="item.effect" class="shop-item__effect">
              {{ item.effect }}
            </p>

            <button
              type="button"
              class="shop-item__buy-button"
              :disabled="
                (isPurchasing && item.isCoinPackage) ||
                (isPurchasingItem && !item.isCoinPackage) ||
                (!item.isCoinPackage && balance < item.price) ||
                (item.id === 'potion-brain-boost' &&
                  membership?.membershipTier === 'vvip')
              "
              :title="
                item.id === 'potion-brain-boost' &&
                membership?.membershipTier === 'vvip'
                  ? '您的模型已經是最高級了'
                  : ''
              "
              @click="handlePurchase(item)"
            >
              <LoadingSpinner
                v-if="
                  (isPurchasing && item.isCoinPackage) ||
                  (isPurchasingItem && !item.isCoinPackage)
                "
                size="sm"
              />
              <div v-else class="button-content">
                <span class="button-price">
                  {{
                    item.isCoinPackage
                      ? formatPrice(item.price)
                      : formatCoins(item.price)
                  }}
                </span>
                <span v-if="!item.isCoinPackage" class="button-label"
                  >金幣</span
                >
              </div>
            </button>
          </div>
        </div>

        <div v-if="filteredItems.length === 0" class="shop-empty">
          <ShoppingBagIcon class="empty-icon" aria-hidden="true" />
          <p class="empty-text">此分類暫無商品</p>
        </div>
      </div>
    </section>

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
}

.shop-hero {
  position: relative;
  padding: clamp(1.25rem, 4vw, 1.75rem) clamp(1rem, 4vw, 1.5rem)
    clamp(1rem, 3vw, 1.5rem);
  padding-bottom: clamp(1.5rem, 4vw, 2rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: rgba(15, 23, 42, 0.68);
  backdrop-filter: blur(18px);
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-top: none;
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.45);
}

.shop-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  position: relative;
  z-index: 1;

  &__title {
    margin: 0;
    font-size: clamp(1.3rem, 4vw, 1.6rem);
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #f8fafc;
    text-align: center;
  }

  &__button {
    position: absolute;
    left: 0;
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.24);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.4);
    color: rgba(226, 232, 240, 0.85);
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;

    .icon {
      width: 19px;
      height: 19px;
    }

    &:hover,
    &:focus-visible {
      transform: translateY(-1px);
      background: rgba(30, 41, 59, 0.6);
      border-color: rgba(148, 163, 184, 0.45);
    }

    &:active {
      transform: translateY(0);
    }

    &:focus-visible {
      outline: 2px solid rgba(59, 130, 246, 0.6);
      outline-offset: 2px;
    }
  }
}

.shop-badge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.5rem 0 0.75rem;

  &__icon {
    position: relative;
    width: 7rem;
    height: 7rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(
      circle,
      rgba(236, 72, 153, 0.2) 0%,
      transparent 70%
    );
    border-radius: 50%;
    z-index: 1;

    &::before {
      content: "";
      position: absolute;
      inset: -12px;
      background: radial-gradient(
        circle,
        rgba(30, 64, 175, 0.15) 0%,
        transparent 60%
      );
      border-radius: 50%;
      animation: pulse 3s ease-in-out infinite;
    }
  }

  &__icon-image {
    width: 65%;
    height: 65%;
    object-fit: contain;
    filter: drop-shadow(0 6px 16px rgba(236, 72, 153, 0.4));
  }

  &__icon-fallback {
    width: 55%;
    height: 55%;
    color: #ec4899;
    filter: drop-shadow(0 4px 12px rgba(236, 72, 153, 0.5));
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.7;
  }
}

.shop-balance {
  margin: 0;
  font-size: clamp(1.85rem, 8vw, 2.4rem);
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #f8fafc;
  position: relative;
  z-index: 1;

  &__label {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: rgba(226, 232, 240, 0.7);
    font-weight: 400;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
}

.shop-categories {
  display: flex;
  gap: 0.65rem;
  padding: 1rem 1.25rem 0.75rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  position: relative;
  z-index: 1;

  &::-webkit-scrollbar {
    display: none;
  }
}

.category-tab {
  flex-shrink: 0;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(15, 23, 42, 0.4);
  color: rgba(226, 232, 240, 0.85);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  transition: all 0.16s ease;
  backdrop-filter: blur(10px);
  white-space: nowrap;

  &--active {
    background: linear-gradient(
      135deg,
      rgba(236, 72, 153, 0.65),
      rgba(30, 64, 175, 0.5)
    );
    border-color: rgba(236, 72, 153, 0.55);
    color: #fff;
    box-shadow: 0 8px 20px rgba(236, 72, 153, 0.3);
  }
}

.shop-content {
  padding: 0.5rem 1.5rem 1.5rem;
  position: relative;
  z-index: 1;
  overflow-y: auto;
  height: 137vw;
}

.category-description {
  margin-bottom: 1rem;
  padding: 0.85rem 1.1rem;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 12px;
  backdrop-filter: blur(10px);

  p {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.5;
    color: rgba(226, 232, 240, 0.75);
    text-align: center;
  }
}

.shop-items {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.shop-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.68);
  backdrop-filter: blur(18px);
  box-shadow: 0 16px 32px rgba(2, 6, 23, 0.4);
  transition: all 0.18s ease;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(236, 72, 153, 0.35);
    box-shadow: 0 12px 28px rgba(236, 72, 153, 0.25);

    .shop-item__icon-wrapper {
      transform: scale(1.05);
      box-shadow: 0 4px 16px rgba(236, 72, 153, 0.35);
    }
  }

  &--popular {
    border-color: rgba(236, 72, 153, 0.25);
    background: rgba(236, 72, 153, 0.05);
  }

  &__badge {
    position: absolute;
    top: 0.65rem;
    right: 0.65rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    background: linear-gradient(
      135deg,
      rgba(236, 72, 153, 0.9),
      rgba(30, 64, 175, 0.8)
    );
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
    z-index: 2;
  }

  .badge-icon {
    width: 10px;
    height: 10px;
    animation: sparkle 2s ease-in-out infinite;
  }

  @keyframes sparkle {
    0%,
    100% {
      transform: scale(1) rotate(0deg);
    }
    50% {
      transform: scale(1.2) rotate(180deg);
    }
  }

  &__icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(
      135deg,
      rgba(236, 72, 153, 0.2) 0%,
      rgba(30, 64, 175, 0.15) 100%
    );
    border: 1px solid rgba(236, 72, 153, 0.3);
    box-shadow: 0 4px 12px rgba(236, 72, 153, 0.2);
    transition: all 0.3s ease;

    &--coins {
      background: linear-gradient(
        135deg,
        rgba(251, 191, 36, 0.25),
        rgba(245, 158, 11, 0.15)
      );
      border: 1px solid rgba(251, 191, 36, 0.3);
      box-shadow: 0 4px 12px rgba(251, 191, 36, 0.2);

      .shop-item__icon {
        color: #fbbf24;
        filter: drop-shadow(0 2px 6px rgba(251, 191, 36, 0.3));
      }
    }

    &--character {
      background: linear-gradient(
        135deg,
        rgba(167, 139, 250, 0.25),
        rgba(139, 92, 246, 0.15)
      );
      border: 1px solid rgba(167, 139, 250, 0.3);
      box-shadow: 0 4px 12px rgba(167, 139, 250, 0.2);

      .shop-item__icon {
        color: #a78bfa;
        filter: drop-shadow(0 2px 6px rgba(167, 139, 250, 0.3));
      }
    }

    &--photo {
      background: linear-gradient(
        135deg,
        rgba(96, 165, 250, 0.25),
        rgba(59, 130, 246, 0.15)
      );
      border: 1px solid rgba(96, 165, 250, 0.3);
      box-shadow: 0 4px 12px rgba(96, 165, 250, 0.2);

      .shop-item__icon {
        color: #60a5fa;
        filter: drop-shadow(0 2px 6px rgba(96, 165, 250, 0.3));
      }
    }

    &--voice {
      background: linear-gradient(
        135deg,
        rgba(244, 114, 182, 0.25),
        rgba(236, 72, 153, 0.15)
      );
      border: 1px solid rgba(244, 114, 182, 0.3);
      box-shadow: 0 4px 12px rgba(244, 114, 182, 0.2);

      .shop-item__icon {
        color: #f472b6;
        filter: drop-shadow(0 2px 6px rgba(244, 114, 182, 0.3));
      }
    }

    &--video {
      background: linear-gradient(
        135deg,
        rgba(245, 158, 11, 0.25),
        rgba(217, 119, 6, 0.15)
      );
      border: 1px solid rgba(245, 158, 11, 0.3);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);

      .shop-item__icon {
        color: #f59e0b;
        filter: drop-shadow(0 2px 6px rgba(245, 158, 11, 0.3));
      }
    }

    &--create {
      background: linear-gradient(
        135deg,
        rgba(34, 197, 94, 0.25),
        rgba(22, 163, 74, 0.15)
      );
      border: 1px solid rgba(34, 197, 94, 0.3);
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.2);

      .shop-item__icon {
        color: #22c55e;
        filter: drop-shadow(0 2px 6px rgba(34, 197, 94, 0.3));
      }
    }

    &--memory {
      background: linear-gradient(
        135deg,
        rgba(139, 92, 246, 0.25),
        rgba(124, 58, 237, 0.15)
      );
      border: 1px solid rgba(139, 92, 246, 0.3);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);

      .shop-item__icon {
        color: #a78bfa;
        filter: drop-shadow(0 2px 6px rgba(139, 92, 246, 0.3));
      }
    }

    &--brain {
      background: linear-gradient(
        135deg,
        rgba(251, 191, 36, 0.25),
        rgba(245, 158, 11, 0.15)
      );
      border: 1px solid rgba(251, 191, 36, 0.3);
      box-shadow: 0 4px 12px rgba(251, 191, 36, 0.2);

      .shop-item__icon {
        color: #fbbf24;
        filter: drop-shadow(0 2px 6px rgba(251, 191, 36, 0.3));
      }
    }
  }

  &__icon {
    width: 26px;
    height: 26px;
    color: #ec4899;
    filter: drop-shadow(0 2px 6px rgba(236, 72, 153, 0.3));
  }

  &__icon-image {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  &__emoji {
    font-size: 2rem;
    line-height: 1;
  }

  &__icon-wrapper.has-emoji {
    background: transparent;
    border: none;
    box-shadow: none;
  }

  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    flex: 1;
    width: 100%;
    position: relative;
    z-index: 1;
  }

  &__name {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    color: #f8fafc;
    line-height: 1.2;
    text-align: center;
  }

  &__bonus {
    margin: 0;
    font-size: 0.72rem;
    color: rgba(236, 72, 153, 0.9);
    text-align: center;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  &__description {
    margin: 0.25rem 0 0;
    font-size: 0.7rem;
    color: rgba(226, 232, 240, 0.65);
    text-align: center;
    line-height: 1.4;
  }

  &__effect {
    margin: 0.25rem 0 0;
    font-size: 0.68rem;
    color: rgba(147, 197, 253, 0.85);
    text-align: center;
    line-height: 1.3;
    font-weight: 500;
  }

  &__buy-button {
    padding: 0.85rem 1.25rem;
    border-radius: 12px;
    border: none;
    background: linear-gradient(
      135deg,
      rgba(236, 72, 153, 0.85),
      rgba(30, 64, 175, 0.75)
    );
    color: #fff;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    box-shadow: 0 6px 16px rgba(236, 72, 153, 0.35);
    transition: all 0.2s ease;
    width: 100%;
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 24px rgba(236, 72, 153, 0.45);
      background: linear-gradient(
        135deg,
        rgba(236, 72, 153, 0.95),
        rgba(30, 64, 175, 0.85)
      );
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .button-content {
      display: flex;
      align-items: baseline;
      gap: 0.35rem;
    }

    .button-price {
      font-size: 1.15rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.01em;
      line-height: 1;
    }

    .button-label {
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.85);
      font-weight: 600;
      letter-spacing: 0.03em;
    }
  }
}

.shop-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  color: rgba(226, 232, 240, 0.5);
}

.empty-icon {
  width: 64px;
  height: 64px;
  opacity: 0.4;
  color: rgba(148, 163, 184, 0.5);
}

.empty-text {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.02em;
  font-weight: 400;
  color: rgba(226, 232, 240, 0.65);
}

@media (min-width: 769px) {
  .shop-items {
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .shop-item {
    padding: 1.15rem;
  }

  .shop-item__name {
    font-size: 1.1rem;
  }

  .shop-item__icon-wrapper {
    width: 56px;
    height: 56px;
  }

  .shop-item__icon {
    width: 30px;
    height: 30px;
  }

  .shop-item__buy-button {
    padding: 0.95rem 1.35rem;

    .button-price {
      font-size: 1.3rem;
    }

    .button-label {
      font-size: 0.85rem;
    }
  }
}

@media (max-width: 640px) {
  .shop-hero {
    padding: clamp(1rem, 4vw, 1.5rem) clamp(0.85rem, 3.5vw, 1.25rem)
      clamp(0.85rem, 2.5vw, 1.25rem);
  }

  .shop-header {
    margin-bottom: 0.65rem;
  }

  .shop-badge {
    margin: 0.35rem 0 0.5rem;
  }

  .shop-badge__icon {
    width: 6rem;
    height: 6rem;
  }

  .shop-balance {
    font-size: clamp(1.65rem, 7vw, 2rem);
  }

  .shop-balance__label {
    font-size: 0.75rem;
    margin-top: 0.3rem;
  }

  .shop-categories {
    padding: 0.75rem 1rem 0.65rem;
  }
}

@media (max-width: 420px) {
  .shop-header__button {
    width: 36px;
    height: 36px;

    .icon {
      width: 18px;
      height: 18px;
    }
  }

  .shop-header__title {
    font-size: clamp(1.2rem, 4vw, 1.4rem);
  }

  .category-tab {
    padding: 0.45rem 0.9rem;
    font-size: 0.76rem;
  }

  .shop-item {
    padding: 0.85rem;
    gap: 0.6rem;
  }

  .shop-item__icon-wrapper {
    width: 44px;
    height: 44px;
  }

  .shop-item__icon {
    width: 24px;
    height: 24px;
  }

  .shop-item__name {
    font-size: 0.95rem;
  }

  .shop-item__buy-button {
    padding: 0.75rem 1.1rem;

    .button-price {
      font-size: 1.05rem;
    }

    .button-label {
      font-size: 0.75rem;
    }
  }

  .category-description {
    padding: 0.75rem 0.9rem;

    p {
      font-size: 0.78rem;
    }
  }
}
</style>
