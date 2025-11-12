<script setup>
import { computed } from "vue";
import { getAssetCardsList, getPotionsList } from "../config/assets";

// 子組件
import StatsModalHeader from "./stats/StatsModalHeader.vue";
import TierBadge from "./stats/TierBadge.vue";
import CoinCard from "./stats/CoinCard.vue";
import AssetCard from "./stats/AssetCard.vue";

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  balance: {
    type: Number,
    default: 0,
  },
  formattedBalance: {
    type: String,
    default: "0",
  },
  // 各種解鎖卡
  characterUnlockCards: {
    type: Number,
    default: 0,
  },
  photoUnlockCards: {
    type: Number,
    default: 0,
  },
  videoUnlockCards: {
    type: Number,
    default: 0,
  },
  voiceUnlockCards: {
    type: Number,
    default: 0,
  },
  createCards: {
    type: Number,
    default: 0,
  },
  // 藥水
  potions: {
    type: Object,
    default: () => ({
      memoryBoost: 0, // 記憶增強藥水
      brainBoost: 0, // 腦力激盪藥水
    }),
  },
  // VIP 資訊
  tier: {
    type: String,
    default: "free",
  },
  tierName: {
    type: String,
    default: "免費會員",
  },
  isPaidMember: {
    type: Boolean,
    default: false,
  },
  formattedExpiryDate: {
    type: String,
    default: null,
  },
  daysUntilExpiry: {
    type: Number,
    default: null,
  },
  isExpiringSoon: {
    type: Boolean,
    default: false,
  },
  // 當前使用量
  currentPhotoUsage: {
    type: Number,
    default: 0,
  },
  currentCharacterCreations: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(["close", "buy-unlock-card", "use-unlock-card", "use-potion"]);

const handleClose = () => {
  emit("close");
};

const handleOverlayClick = (event) => {
  if (event.target === event.currentTarget) {
    handleClose();
  }
};

// 限制配置
const LIMITS = {
  PHOTO: {
    free: 3,
    vip: 10,
    vvip: 50,
  },
  CHARACTER_CREATION: {
    free: 3,
    vip: 3,
    vvip: 3,
  },
};

// 計算當前上限
const photoLimit = computed(() => {
  return LIMITS.PHOTO[props.tier] || LIMITS.PHOTO.free;
});

const characterCreationLimit = computed(() => {
  return (
    LIMITS.CHARACTER_CREATION[props.tier] || LIMITS.CHARACTER_CREATION.free
  );
});

// 檢查是否達到上限
const isPhotoLimitReached = computed(() => {
  return props.currentPhotoUsage >= photoLimit.value;
});

const isCharacterCreationLimitReached = computed(() => {
  return props.currentCharacterCreations >= characterCreationLimit.value;
});

// 處理購買解鎖卡
const handleBuyUnlockCard = (cardType) => {
  emit("buy-unlock-card", cardType);
  handleClose();
};

// 處理使用解鎖卡
const handleUseUnlockCard = (cardType) => {
  emit("use-unlock-card", cardType);
};

// 處理使用藥水
const handleUsePotion = (potionType) => {
  emit("use-potion", potionType);
};

// 獲取所有資產卡片（從共用配置動態生成）
const assetCardsList = computed(() => {
  const cards = getAssetCardsList();
  return cards.map((card) => {
    const count = props[card.assetKey] || 0;
    // 檢查是否有上限限制（必須同時滿足：1. 配置中有hasLimit 2. 達到上限）
    const hasLimit =
      (card.hasLimit && card.assetKey === "photoUnlockCards" && isPhotoLimitReached.value) ||
      (card.hasLimit && card.assetKey === "createCards" && isCharacterCreationLimitReached.value);

    return {
      ...card,
      count,
      hasLimit,
      limitText: hasLimit ? "已達上限" : "",
      buttonLabel: card.assetKey === "createCards" ? "創建卡" : "解鎖卡",
    };
  });
});

// 獲取所有道具（從共用配置動態生成）
const potionsList = computed(() => {
  const potions = getPotionsList();
  return potions.map((potion) => ({
    ...potion,
    count: props.potions?.[potion.assetKey] || 0,
  }));
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="stats-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-modal-title"
        @click="handleOverlayClick"
      >
        <div class="modal-backdrop"></div>
        <div class="modal-container">
          <div class="modal-content">
            <!-- Header -->
            <StatsModalHeader @close="handleClose" />

            <!-- Body -->
            <div class="modal-body">
              <!-- Member Tier Badge -->
              <TierBadge
                :tier="tier"
                :tier-name="tierName"
                :is-paid-member="isPaidMember"
                :formatted-expiry-date="formattedExpiryDate"
                :days-until-expiry="daysUntilExpiry"
                :is-expiring-soon="isExpiringSoon"
              />

              <!-- Stats Grid -->
              <div class="stats-grid">
                <!-- 金幣 -->
                <CoinCard :formatted-balance="formattedBalance" />

                <!-- 資產卡片（動態渲染） -->
                <AssetCard
                  v-for="card in assetCardsList"
                  :key="card.id"
                  :card-type="card.id"
                  :name="card.name"
                  :icon="card.icon"
                  :icon-color="card.iconColor"
                  :count="card.count"
                  :unit="card.unit"
                  :has-limit="card.hasLimit"
                  :limit-text="card.limitText"
                  :button-label="card.buttonLabel"
                  @use="handleUseUnlockCard"
                  @buy="handleBuyUnlockCard"
                />

                <!-- 道具（動態渲染） -->
                <AssetCard
                  v-for="potion in potionsList"
                  :key="potion.id"
                  :card-type="potion.id"
                  :name="potion.name"
                  :icon="potion.icon"
                  :icon-color="potion.iconColor"
                  :count="potion.count"
                  :unit="potion.unit"
                  :has-limit="false"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.stats-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
}

.modal-container {
  position: relative;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content {
  background: linear-gradient(160deg, #1a1a2e 0%, #16172a 100%);
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

/* Body */
.modal-body {
  padding: 1.5rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.85rem;
  margin-bottom: 1.5rem;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 200ms ease, opacity 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95) translateY(-20px);
  opacity: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .modal-container {
    max-height: 95vh;
  }

  .modal-body {
    padding: 1.25rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
}
</style>
