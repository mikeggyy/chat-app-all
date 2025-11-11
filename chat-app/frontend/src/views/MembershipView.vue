<script setup>
import { computed, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  ArrowLeftIcon,
  StarIcon,
  SparklesIcon,
  ChatBubbleLeftIcon,
  SpeakerWaveIcon,
  UserGroupIcon,
  CpuChipIcon,
  GiftIcon,
} from "@heroicons/vue/24/outline";
import { ArrowRightIcon } from "@heroicons/vue/24/solid";
import { useUserProfile } from "../composables/useUserProfile";
import { useMembership } from "../composables/useMembership";
import { useToast } from "../composables/useToast";
import { useGuestGuard } from "../composables/useGuestGuard";
import LoadingSpinner from "../components/LoadingSpinner.vue";

const router = useRouter();
const { user } = useUserProfile();
const {
  tier: currentTier,
  features: currentFeatures,
  loadMembership,
  upgradeMembership,
  isLoading: isMembershipLoading,
} = useMembership();

const { success, error: showError, warning } = useToast();
const { requireLogin } = useGuestGuard();

const isUpgrading = ref(false);

// 會員方案配置（根據最新的會員機制說明）
const membershipTiers = [
  {
    id: "vip",
    label: "VIP",
    headline: "VIP 尊榮體驗",
    description: "大幅提升對話額度，享受更好的 AI 體驗，開通立即獲得豐富獎勵。",
    priceTag: "NT$ 399",
    pricePeriod: "/ 月",
    highlight: "人氣首選",
    highlightColor: "from-blue-500 to-indigo-600",
    cardGradient: "from-blue-600/20 via-indigo-600/20 to-purple-600/20",
    features: [
      {
        icon: SpeakerWaveIcon,
        title: "無限語音播放",
        detail: "無限次使用 TTS 語音功能",
        badge: "無限制",
      },
      {
        icon: UserGroupIcon,
        title: "30 次配對/日",
        detail: "每日 30 次角色配對，看廣告可 +5 次",
        badge: "6倍提升",
      },
      {
        icon: CpuChipIcon,
        title: "提升 AI 回覆",
        detail: "更長的 AI 回覆，更高的記憶容量",
        badge: null,
      },
      {
        icon: GiftIcon,
        title: "開通豪禮",
        detail: "立即送 600 金幣 + 10 張解鎖票 + 20 張拍照卡 + 10 張創建卡",
        badge: "立即獲得",
      },
      {
        icon: StarIcon,
        title: "金幣 9 折優惠",
        detail: "購買金幣享 9 折優惠",
        badge: null,
      },
    ],
  },
  {
    id: "vvip",
    label: "VVIP",
    headline: "VVIP 黑卡禮遇",
    description: "頂級 GPT-4o 模型，極致對話體驗，超值豪華禮包，無限配對次數。",
    priceTag: "NT$ 999",
    pricePeriod: "/ 月",
    highlight: "限量尊榮",
    highlightColor: "from-amber-500 via-orange-500 to-pink-600",
    cardGradient: "from-amber-600/20 via-orange-600/20 to-pink-600/20",
    features: [
      {
        icon: SparklesIcon,
        title: "使用頂級模型",
        detail: "專屬使用頂級生成式模型，對話品質最佳",
        badge: "獨家",
      },
      {
        icon: SpeakerWaveIcon,
        title: "無限語音播放",
        detail: "無限次使用 TTS 語音功能",
        badge: "無限制",
      },
      {
        icon: UserGroupIcon,
        title: "無限配對",
        detail: "每日無限次角色配對，不需要看廣告",
        badge: "無限制",
      },
      {
        icon: CpuChipIcon,
        title: "AI 可回覆數最多",
        detail: "最長的 AI 回覆，最高的記憶容量",
        badge: null,
      },
      {
        icon: GiftIcon,
        title: "超值豪華禮包",
        detail: "立即送 2000 金幣 + 30 張解鎖票 + 60 張拍照卡 + 30 張創建卡",
        badge: "價值最高",
      },
      {
        icon: StarIcon,
        title: "金幣 8 折優惠",
        detail: "購買金幣享 8 折優惠",
        badge: null,
      },
    ],
  },
];

// 對比表格數據
const comparisonFeatures = [
  {
    category: "語音功能",
    items: [
      {
        name: "語音播放",
        free: "10 次/角色",
        vip: "無限制",
        vvip: "無限制",
      },
    ],
  },
  {
    category: "配對功能",
    items: [
      {
        name: "每日配對次數",
        free: "5 次",
        vip: "30 次",
        vvip: "無限制",
      },
    ],
  },
  {
    category: "AI 品質",
    items: [
      {
        name: "AI 模型",
        free: "一般模型",
        vip: "高階模型",
        vvip: "最高階模型",
      },
      {
        name: "回覆長度",
        free: "短",
        vip: "中",
        vvip: "高",
      },
    ],
  },
  {
    category: "開通獎勵",
    items: [
      {
        name: "金幣",
        free: "-",
        vip: "送 600",
        vvip: "送 2000",
      },
      {
        name: "解鎖票",
        free: "-",
        vip: "送 10 張",
        vvip: "送 30 張",
      },
      {
        name: "拍照卡",
        free: "-",
        vip: "送 20 張",
        vvip: "送 60 張",
      },
    ],
  },
];

const activeTierId = ref(membershipTiers[0].id);

const activeTier = computed(() => {
  return (
    membershipTiers.find((tier) => tier.id === activeTierId.value) ??
    membershipTiers[0]
  );
});

const selectTier = (tierId) => {
  if (!tierId || activeTierId.value === tierId) {
    return;
  }
  activeTierId.value = tierId;
};

const handleBack = () => {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.push({ name: "profile" });
};

const handleUpgrade = async (tier) => {
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

  if (currentTier.value === "vvip" && tier.id === "vip") {
    warning("無法從 VVIP 降級至 VIP");
    return;
  }

  isUpgrading.value = true;

  try {
    // TODO: 整合真實的支付流程
    await upgradeMembership(user.value.id, tier.id, {
      paymentMethod: "credit_card",
    });

    // 升級成功，重新載入會員資料
    await loadMembership(user.value.id);

    // 顯示成功訊息
    success(`成功升級至 ${tier.label}！`, {
      title: "升級成功",
    });
  } catch (error) {
    const message = error?.message || "升級失敗，請稍後再試";
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
      if (currentTier.value === "vip" || currentTier.value === "vvip") {
        activeTierId.value = currentTier.value;
      }
    } catch (error) {}
  }
});
</script>

<template>
  <div class="membership-screen">
    <!-- Hero Section -->
    <section class="membership-hero">
      <header class="membership-header" aria-label="會員導覽">
        <button
          type="button"
          class="membership-header__button"
          aria-label="返回上一頁"
          @click="handleBack"
        >
          <ArrowLeftIcon class="icon" aria-hidden="true" />
        </button>
        <h1 class="membership-header__title">會員中心</h1>
        <span class="membership-header__placeholder" aria-hidden="true" />
      </header>

      <div class="membership-hero__content">
        <h2 class="membership-hero__headline">解鎖專屬體驗</h2>
        <p class="membership-hero__subtitle">
          選擇最適合的升級方案，享受更豐富的 AI 互動體驗
        </p>
      </div>
    </section>

    <!-- Tier Tabs -->
    <nav class="membership-tabs" role="tablist" aria-label="會員方案切換">
      <button
        v-for="tier in membershipTiers"
        :key="tier.id"
        type="button"
        class="membership-tabs__item"
        :class="{
          'membership-tabs__item--active': tier.id === activeTierId,
        }"
        role="tab"
        :aria-selected="tier.id === activeTierId"
        @click="selectTier(tier.id)"
      >
        <span class="membership-tabs__label">{{ tier.label }}</span>
      </button>
    </nav>

    <!-- Active Tier Panel -->
    <section
      v-if="activeTier"
      class="membership-panel"
      role="tabpanel"
      :aria-label="`${activeTier.label} 方案內容`"
    >
      <!-- Plan Header -->
      <div class="plan-card" :class="`plan-card--${activeTier.id}`">
        <div
          class="plan-card__badge"
          :class="`bg-gradient-to-r ${activeTier.highlightColor}`"
        >
          {{ activeTier.highlight }}
        </div>
        <h2 class="plan-card__headline">{{ activeTier.headline }}</h2>
        <p class="plan-card__description">
          {{ activeTier.description }}
        </p>

        <div class="plan-card__pricing">
          <div class="plan-card__price-wrapper">
            <span class="plan-card__price">{{ activeTier.priceTag }}</span>
            <span class="plan-card__price-period">{{
              activeTier.pricePeriod
            }}</span>
          </div>
          <button
            type="button"
            class="plan-card__cta"
            :class="{ 'plan-card__cta--loading': isUpgrading }"
            :disabled="isUpgrading"
            :aria-label="`升級為 ${activeTier.label}`"
            @click="handleUpgrade(activeTier)"
          >
            <LoadingSpinner v-if="isUpgrading" size="sm" />
            <template v-else>
              立即升級
              <ArrowRightIcon class="plan-card__cta-icon" aria-hidden="true" />
            </template>
          </button>
        </div>
      </div>

      <!-- Features List -->
      <div class="features-section">
        <h3 class="features-section__title">方案優勢</h3>
        <ul class="features-list" role="list">
          <li
            v-for="feature in activeTier.features"
            :key="feature.title"
            class="features-list__item"
          >
            <span class="features-list__icon" aria-hidden="true">
              <component :is="feature.icon" class="icon" />
            </span>
            <div class="features-list__content">
              <div class="features-list__header">
                <p class="features-list__title">{{ feature.title }}</p>
                <span v-if="feature.badge" class="features-list__badge">{{
                  feature.badge
                }}</span>
              </div>
              <p class="features-list__detail">{{ feature.detail }}</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- Comparison Table -->
      <div class="comparison-section">
        <h3 class="comparison-section__title">方案對比</h3>
        <div class="comparison-table">
          <div class="comparison-table__header">
            <div class="comparison-table__cell comparison-table__cell--header">
              功能
            </div>
            <div class="comparison-table__cell comparison-table__cell--header">
              免費
            </div>
            <div
              class="comparison-table__cell comparison-table__cell--header comparison-table__cell--vip"
            >
              VIP
            </div>
            <div
              class="comparison-table__cell comparison-table__cell--header comparison-table__cell--vvip"
            >
              VVIP
            </div>
          </div>

          <div
            v-for="category in comparisonFeatures"
            :key="category.category"
            class="comparison-table__category"
          >
            <div class="comparison-table__category-title">
              {{ category.category }}
            </div>
            <div
              v-for="item in category.items"
              :key="item.name"
              class="comparison-table__row"
            >
              <div class="comparison-table__cell comparison-table__cell--name">
                {{ item.name }}
              </div>
              <div class="comparison-table__cell">{{ item.free }}</div>
              <div
                class="comparison-table__cell comparison-table__cell--highlight"
              >
                {{ item.vip }}
              </div>
              <div
                class="comparison-table__cell comparison-table__cell--highlight-vvip"
              >
                {{ item.vvip }}
              </div>
            </div>
          </div>
        </div>
      </div>
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

/* Hero Section */
.membership-hero {
  padding: 1rem 1.25rem 2rem;
  background: linear-gradient(
    180deg,
    rgba(30, 41, 82, 0.95) 0%,
    rgba(13, 17, 35, 0.85) 100%
  );
  border-bottom-left-radius: 32px;
  border-bottom-right-radius: 32px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.membership-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.membership-header__title {
  margin: 0;
  font-size: clamp(1.25rem, 4vw, 1.5rem);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.membership-header__button {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 20, 40, 0.6);
  color: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
}

.membership-header__button:hover {
  transform: translateY(-2px);
  background: rgba(59, 130, 246, 0.2);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
}

.membership-header__button .icon {
  width: 20px;
  height: 20px;
}

.membership-header__placeholder {
  width: 40px;
  height: 40px;
}

.membership-hero__content {
  text-align: center;
}

.membership-hero__headline {
  margin: 0 0 0.5rem;
  font-size: clamp(1.75rem, 5vw, 2.25rem);
  font-weight: 700;
  background: linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.02em;
}

.membership-hero__subtitle {
  margin: 0;
  color: rgba(217, 226, 255, 0.8);
  font-size: 0.95rem;
  line-height: 1.6;
  letter-spacing: 0.03em;
}

/* Tier Tabs */
.membership-tabs {
  margin: -1rem 1.25rem 1.5rem;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  background: rgba(20, 25, 50, 0.9);
  border-radius: 20px;
  border: 1px solid rgba(96, 165, 250, 0.2);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.membership-tabs__item {
  position: relative;
  border: none;
  border-radius: 16px;
  padding: 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(217, 226, 255, 0.7);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.membership-tabs__item--active {
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.2),
    rgba(139, 92, 246, 0.25)
  );
  color: #f8faff;
}

.membership-tabs__label {
  font-size: 1.1rem;
  letter-spacing: 0.05em;
}

.membership-tabs__badge {
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(217, 226, 255, 0.6);
}

.membership-tabs__item--active .membership-tabs__badge {
  color: rgba(167, 243, 208, 0.9);
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

/* Plan Card */
.plan-card {
  padding: 1.5rem;
  border-radius: 24px;
  background: linear-gradient(
    135deg,
    rgba(30, 40, 80, 0.9),
    rgba(20, 25, 50, 0.95)
  );
  border: 1px solid rgba(99, 179, 237, 0.3);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  position: relative;
  height: 22rem;
}

.plan-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    circle at 20% 20%,
    rgba(59, 130, 246, 0.1),
    transparent 50%
  );
  pointer-events: none;
}

.plan-card--vvip::before {
  background: radial-gradient(
    circle at 20% 20%,
    rgba(251, 191, 36, 0.15),
    transparent 50%
  );
}

.plan-card__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: white;
  margin-bottom: 1rem;
  text-transform: uppercase;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.plan-card__headline {
  margin: 0 0 0.75rem;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.plan-card__description {
  margin: 0 0 1.5rem;
  color: rgba(207, 217, 255, 0.85);
  line-height: 1.6;
  font-size: 0.95rem;
}

.plan-card__pricing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.plan-card__price-wrapper {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.plan-card__price {
  font-size: 1.75rem;
  font-weight: 700;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.plan-card__price-period {
  font-size: 0.9rem;
  color: rgba(207, 217, 255, 0.7);
}

.plan-card__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
  transition: all 0.2s ease;
  letter-spacing: 0.05em;
}

.plan-card__cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 35px rgba(99, 102, 241, 0.5);
}

.plan-card__cta:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.plan-card__cta-icon {
  width: 18px;
  height: 18px;
}

/* Features Section */
.features-section {
  margin-top: 0.5rem;
}

.features-section__title {
  margin: 0 0 1rem;
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(167, 243, 208, 0.9);
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.features-list__item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(15, 20, 40, 0.6);
  border-radius: 16px;
  border: 1px solid rgba(96, 165, 250, 0.15);
  transition: all 0.2s ease;
}

.features-list__item:hover {
  background: rgba(20, 25, 50, 0.8);
  border-color: rgba(96, 165, 250, 0.3);
  transform: translateX(4px);
}

.features-list__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.2),
    rgba(139, 92, 246, 0.2)
  );
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(147, 197, 253, 0.9);
  flex-shrink: 0;
}

.features-list__icon .icon {
  width: 24px;
  height: 24px;
}

.features-list__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.features-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.features-list__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.features-list__badge {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.2),
    rgba(16, 185, 129, 0.25)
  );
  color: rgba(167, 243, 208, 0.95);
  border: 1px solid rgba(34, 197, 94, 0.3);
  white-space: nowrap;
}

.features-list__detail {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(196, 208, 255, 0.75);
  line-height: 1.5;
}

/* Comparison Section */
.comparison-section {
  margin-top: 1rem;
  padding: 1.5rem;
  background: rgba(15, 20, 40, 0.6);
  border-radius: 20px;
  border: 1px solid rgba(96, 165, 250, 0.2);
}

.comparison-section__title {
  margin: 0 0 1.25rem;
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(251, 191, 36, 0.9);
}

.comparison-table__header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.comparison-table__cell {
  padding: 0.75rem 0.5rem;
  font-size: 0.85rem;
  text-align: center;
  border-radius: 8px;
}

.comparison-table__cell--header {
  font-weight: 600;
  background: rgba(30, 40, 80, 0.6);
  color: rgba(217, 226, 255, 0.9);
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}

.comparison-table__cell--vip {
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.2),
    rgba(99, 102, 241, 0.2)
  );
}

.comparison-table__cell--vvip {
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.2),
    rgba(249, 115, 22, 0.2)
  );
}

.comparison-table__category {
  margin-bottom: 1rem;
}

.comparison-table__category-title {
  padding: 0.5rem 0.75rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: rgba(167, 243, 208, 0.9);
  background: rgba(20, 25, 50, 0.6);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  letter-spacing: 0.03em;
}

.comparison-table__row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.comparison-table__cell--name {
  text-align: left;
  font-weight: 500;
  padding-left: 0.75rem;
  color: rgba(217, 226, 255, 0.85);
}

.comparison-table__cell--highlight {
  background: rgba(59, 130, 246, 0.1);
  font-weight: 600;
  color: rgba(147, 197, 253, 0.95);
}

.comparison-table__cell--highlight-vvip {
  background: rgba(251, 191, 36, 0.1);
  font-weight: 600;
  color: rgba(253, 224, 71, 0.95);
}

/* Responsive */
@media (max-width: 640px) {
  .membership-hero {
    padding: 1rem 1rem 1.5rem;
  }

  .plan-card__pricing {
    flex-direction: column;
    align-items: stretch;
  }

  .plan-card__cta {
    width: 100%;
    justify-content: center;
  }

  .comparison-table__header,
  .comparison-table__row {
    grid-template-columns: 1.5fr 1fr 1fr 1fr;
    gap: 0.25rem;
  }

  .comparison-table__cell {
    padding: 0.5rem 0.25rem;
    font-size: 0.75rem;
  }

  .comparison-table__cell--name {
    padding-left: 0.5rem;
  }

  .features-list__item {
    gap: 0.75rem;
    padding: 0.85rem;
  }

  .features-list__icon {
    width: 40px;
    height: 40px;
  }

  .features-list__icon .icon {
    width: 22px;
    height: 22px;
  }
}
</style>
