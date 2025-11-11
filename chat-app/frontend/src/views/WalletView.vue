<script setup>
import { computed, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeftIcon, DocumentTextIcon } from "@heroicons/vue/24/outline";
import { ChatBubbleBottomCenterIcon } from "@heroicons/vue/24/solid";
import { useUserProfile } from "../composables/useUserProfile";
import { useCoins } from "../composables/useCoins";
import { useToast } from "../composables/useToast";
import { useGuestGuard } from "../composables/useGuestGuard";
import LoadingSpinner from "../components/LoadingSpinner.vue";

const router = useRouter();
const { user } = useUserProfile();
const {
  balance,
  packages,
  formattedBalance: coinsFormattedBalance,
  loadBalance,
  loadPackages,
  purchasePackage,
  isLoading: isCoinsLoading
} = useCoins();

const { success, error: showError } = useToast();
const { requireLogin } = useGuestGuard();

const COIN_ICON_PATH = "/icons/wallet-coin.png";
const isCoinIconAvailable = ref(true);
const isPurchasing = ref(false);

// 使用 composable 提供的餘額，如果沒有則使用 0
const walletBalance = computed(() => balance.value);
const formattedBalance = computed(() => coinsFormattedBalance.value);

// 將後端的套餐格式轉換為前端需要的格式
const walletPackages = computed(() => {
  if (!packages.value || packages.value.length === 0) {
    // 備用資料
    return [
      { id: "small", coins: 100, totalCoins: 100, price: 50, bonus: 0 },
      { id: "medium", coins: 500, totalCoins: 550, price: 200, bonus: 50 },
      { id: "large", coins: 1000, totalCoins: 1150, price: 350, bonus: 150, popular: true },
      { id: "xlarge", coins: 3000, totalCoins: 3500, price: 1000, bonus: 500, bestValue: true },
    ];
  }

  return packages.value.map(pkg => ({
    id: pkg.id,
    coins: pkg.totalCoins || pkg.coins,
    totalCoins: pkg.totalCoins,
    price: pkg.price,
    bonus: pkg.bonus,
    popular: pkg.popular,
    bestValue: pkg.bestValue,
  }));
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

const handlePurchase = async (pkg) => {
  if (!pkg || isPurchasing.value) {
    return;
  }

  if (!user.value?.id) {
    showError("請先登入");
    return;
  }

  // 檢查是否為遊客
  if (requireLogin({ feature: "購買金幣" })) {
    return;
  }

  isPurchasing.value = true;

  try {
    // TODO: 整合真實的支付流程
    // 這裡應該先調用支付 API 取得 paymentId，再調用 purchasePackage
    await purchasePackage(user.value.id, pkg.id, {
      paymentMethod: "credit_card",
      // paymentId: "payment-id-from-payment-gateway",
    });

    // 購買成功，重新載入餘額
    await loadBalance(user.value.id);

    // 顯示成功訊息
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

const handleCoinIconError = () => {
  if (isCoinIconAvailable.value) {
    isCoinIconAvailable.value = false;
  }
};

// 初始化時載入金幣資料
onMounted(async () => {
  if (user.value?.id) {
    try {
      await Promise.all([
        loadBalance(user.value.id, { skipGlobalLoading: true }),
        loadPackages({ skipGlobalLoading: true }),
      ]);
    } catch (err) {
      const message = err?.message || "載入金幣資料失敗";
      showError(message);

    }
  }
});
</script>

<template>
  <div class="wallet-screen">
    <section class="wallet-hero">
      <header class="wallet-header" aria-label="錢包導覽">
        <button
          type="button"
          class="wallet-header__button wallet-header__button--back"
          aria-label="返回上一頁"
          @click="handleBack"
        >
          <ArrowLeftIcon class="icon" aria-hidden="true" />
        </button>
        <h1 class="wallet-header__title">錢包</h1>
        <button
          type="button"
          class="wallet-header__button wallet-header__button--history"
          aria-label="查看購買紀錄"
          @click="handleHistory"
        >
          <DocumentTextIcon class="icon" aria-hidden="true" />
        </button>
      </header>

      <div class="wallet-badge" aria-hidden="true">
        <span class="wallet-badge__icon">
          <img
            v-if="coinIconPath"
            :src="coinIconPath"
            alt=""
            class="wallet-badge__icon-image"
            decoding="async"
            @error="handleCoinIconError"
          />
          <ChatBubbleBottomCenterIcon
            v-else
            class="wallet-badge__icon-fallback"
          />
        </span>
      </div>

      <p class="wallet-balance">{{ formattedBalance }}</p>
      <p class="wallet-balance__label">餘額</p>
    </section>

    <section class="wallet-content" aria-labelledby="wallet-products-heading">
      <h2 id="wallet-products-heading" class="wallet-section-title">金幣</h2>
      <ul class="wallet-packages" role="list">
        <li v-for="pkg in walletPackages" :key="pkg.id" class="wallet-package">
          <div class="wallet-package__info">
            <span class="wallet-package__icon" aria-hidden="true">
              <img
                v-if="coinIconPath"
                :src="coinIconPath"
                alt=""
                class="wallet-package__icon-image"
                decoding="async"
                @error="handleCoinIconError"
              />
              <ChatBubbleBottomCenterIcon
                v-else
                class="wallet-package__icon-fallback"
              />
            </span>
            <span class="wallet-package__coins">{{
              formatCoins(pkg.coins)
            }}</span>
          </div>
          <button
            type="button"
            class="wallet-package__action"
            :class="{ 'wallet-package__action--loading': isPurchasing }"
            :disabled="isPurchasing"
            :aria-label="`購買 ${formatCoins(
              pkg.coins
            )} 金幣，價格 ${formatPrice(pkg.price)}`"
            @click="handlePurchase(pkg)"
          >
            <LoadingSpinner v-if="isPurchasing" size="sm" />
            <span v-else>{{ formatPrice(pkg.price) }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.wallet-screen {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(
    circle at 50% -10%,
    #b04a8e 0%,
    #2d0220 55%,
    #14020d 100%
  );
  color: #faf1ff;
}

.wallet-hero {
  position: relative;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: linear-gradient(
    180deg,
    rgba(214, 88, 162, 0.95) 0%,
    rgba(49, 6, 31, 0.92) 70%
  );
  border-bottom-left-radius: 42px;
  border-bottom-right-radius: 42px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

.wallet-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.wallet-header__title {
  margin: 0;
  font-size: clamp(1.2rem, 4vw, 1.4rem);
  letter-spacing: 0.08em;
}

.wallet-header__button {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.16);
  color: #fefcff;
  backdrop-filter: blur(6px);
  transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.wallet-header__button:hover,
.wallet-header__button:focus-visible {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.24);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
}

.wallet-header__button:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: 3px;
}

.wallet-header__button .icon {
  width: 24px;
  height: 24px;
}

.wallet-badge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wallet-badge__icon {
  position: relative;
  width: 10rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(88, 23, 6, 0.9);
  z-index: 1;
}

.wallet-badge__icon-image {
  width: clamp(70%, 14vw, 80%);
  height: clamp(70%, 14vw, 80%);
  object-fit: contain;
}

.wallet-badge__icon-fallback {
  width: inherit;
  height: inherit;
}

.wallet-balance {
  margin: 0;
  font-size: clamp(2rem, 10vw, 2.8rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-shadow: 0 10px 28px rgba(0, 0, 0, 0.65);
}

.wallet-balance__label {
  margin: 0.4rem 0 0;
  font-size: 1rem;
  color: rgba(255, 235, 255, 0.75);
}

.wallet-content {
  flex: 1;
  padding: clamp(1.5rem, 5vw, 2rem) clamp(1rem, 5vw, 1.8rem)
    clamp(2.5rem, 8vw, 3.6rem);
  display: flex;
  flex-direction: column;
  gap: clamp(1.3rem, 4vw, 1.8rem);
}

.wallet-section-title {
  margin: 0;
  font-size: clamp(1.05rem, 3.5vw, 1.2rem);
  letter-spacing: 0.08em;
  color: rgba(255, 231, 255, 0.8);
  text-transform: uppercase;
}

.wallet-packages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: clamp(0.8rem, 3vw, 1rem);
}

.wallet-package {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: clamp(0.95rem, 3vw, 1.2rem) clamp(1.1rem, 4vw, 1.6rem);
  border-radius: 20px;
  background: linear-gradient(
    140deg,
    rgba(52, 9, 29, 0.92),
    rgba(20, 3, 17, 0.96)
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.35);
  gap: 1rem;
}

.wallet-package__info {
  display: flex;
  align-items: center;
  gap: clamp(0.75rem, 2.8vw, 1rem);
  font-weight: 700;
  font-size: clamp(1.1rem, 4vw, 1.3rem);
  color: #ffeef5;
}

.wallet-package__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(44px, 11vw, 54px);
  height: clamp(44px, 11vw, 54px);
  color: rgba(88, 23, 6, 0.92);
}

.wallet-package__icon-image {
  width: 3rem;
  object-fit: contain;
}

.wallet-package__icon-fallback {
  width: clamp(60%, 8vw, 68%);
  height: clamp(60%, 8vw, 68%);
}

.wallet-package__icon svg {
  width: clamp(26px, 7vw, 32px);
  height: clamp(26px, 7vw, 32px);
}

.wallet-package__coins {
  letter-spacing: 0.04em;
  font-size: 1.5rem;
}

.wallet-package__action {
  border-radius: 999px;
  padding: clamp(0.45rem, 2vw, 0.55rem) clamp(1.6rem, 5vw, 2.6rem);
  border: none;
  font-weight: 700;
  font-size: 1.2rem;
  background: linear-gradient(160deg, #ff64af 0%, #ff3888 100%);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.4), 0 0 24px rgba(255, 102, 168, 0.45);
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
  width: 9rem;
}

.wallet-package__action:hover,
.wallet-package__action:focus-visible {
  transform: translateY(-2px);
  filter: brightness(1.05);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.48), 0 0 28px rgba(255, 138, 190, 0.6);
}

.wallet-package__action:focus-visible {
  outline: 2px solid rgba(255, 245, 255, 0.8);
  outline-offset: 3px;
}

.wallet-package__action:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.wallet-package__action--loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 420px) {
  .wallet-header__button {
    width: 36px;
    height: 36px;
  }

  .wallet-package {
    padding: 0.9rem 1.1rem;
  }

  .wallet-package__action {
    padding: 0.4rem 1.4rem;
  }
}
</style>
