<script setup>
import { computed, ref } from "vue";
import {
  XMarkIcon,
  BoltIcon,
  ShoppingCartIcon,
} from "@heroicons/vue/24/outline";
import { SparklesIcon } from "@heroicons/vue/24/solid";
import {
  getAssetCardsList,
  getPotionsList,
  getIconColor,
  COIN_ICON_PATH,
} from "../config/assets";

// 金幣圖標
const isCoinIconAvailable = ref(true);

const handleCoinIconError = () => {
  if (isCoinIconAvailable.value) {
    isCoinIconAvailable.value = false;
  }
};

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
  return cards.map((card) => ({
    ...card,
    count: props[card.assetKey] || 0,
    // 檢查是否有上限限制
    hasLimitCheck:
      card.hasLimit &&
      card.assetKey === "photoUnlockCards" &&
      isPhotoLimitReached.value,
    hasCreateLimitCheck:
      card.hasLimit &&
      card.assetKey === "createCards" &&
      isCharacterCreationLimitReached.value,
    limitText:
      card.assetKey === "photoUnlockCards"
        ? `已達上限 (${props.currentPhotoUsage}/${photoLimit.value})`
        : card.assetKey === "createCards"
        ? `已達上限 (${props.currentCharacterCreations}/${characterCreationLimit.value})`
        : "",
  }));
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
            <header class="modal-header">
              <div class="modal-title-section">
                <BoltIcon class="title-icon" aria-hidden="true" />
                <h2 id="stats-modal-title" class="modal-title">我的資產</h2>
              </div>
              <button
                type="button"
                class="close-button"
                aria-label="關閉"
                @click="handleClose"
              >
                <XMarkIcon class="icon" aria-hidden="true" />
              </button>
            </header>

            <!-- Body -->
            <div class="modal-body">
              <!-- Member Tier Badge -->
              <div class="tier-badge" :class="`tier-badge--${tier}`">
                <SparklesIcon class="tier-icon" aria-hidden="true" />
                <div class="tier-info">
                  <span class="tier-name">{{ tierName }}</span>
                  <span
                    v-if="isPaidMember && formattedExpiryDate"
                    class="tier-expiry"
                  >
                    {{ isExpiringSoon ? "即將到期：" : "到期日："
                    }}{{ formattedExpiryDate }}
                    <span v-if="daysUntilExpiry !== null" class="expiry-days"
                      >(剩 {{ daysUntilExpiry }} 天)</span
                    >
                  </span>
                </div>
              </div>

              <!-- Stats Grid -->
              <div class="stats-grid">
                <!-- 金幣 -->
                <div class="stat-card stat-card--coins">
                  <div class="stat-card__header">
                    <div
                      class="stat-card__icon-wrapper stat-card__icon-wrapper--coins"
                    >
                      <img
                        v-if="isCoinIconAvailable"
                        :src="COIN_ICON_PATH"
                        alt=""
                        class="stat-card__icon stat-card__icon-image"
                        decoding="async"
                        @error="handleCoinIconError"
                      />
                      <BoltIcon
                        v-else
                        class="stat-card__icon stat-card__icon-fallback"
                        aria-hidden="true"
                      />
                    </div>
                    <span class="stat-card__label">金幣</span>
                  </div>
                  <div class="stat-card__value">{{ formattedBalance }}</div>
                </div>

                <!-- 資產卡片（動態渲染） -->
                <div
                  v-for="card in assetCardsList"
                  :key="card.id"
                  class="stat-card"
                  :class="{
                    'stat-card--limited':
                      card.hasLimitCheck || card.hasCreateLimitCheck,
                  }"
                >
                  <div class="stat-card__header">
                    <div
                      class="stat-card__icon-wrapper"
                      :class="`stat-card__icon-wrapper--${card.iconColor}`"
                    >
                      <component
                        :is="card.icon"
                        class="stat-card__icon"
                        aria-hidden="true"
                      />
                    </div>
                    <span class="stat-card__label">{{ card.name }}</span>
                  </div>
                  <div class="stat-card__value">
                    {{ card.count }} {{ card.unit }}
                  </div>

                  <!-- 達到上限時顯示按鈕 -->
                  <div
                    v-if="card.hasLimitCheck || card.hasCreateLimitCheck"
                    class="stat-card__action"
                  >
                    <span class="stat-card__limit-text">{{
                      card.limitText
                    }}</span>
                    <button
                      v-if="card.count > 0"
                      type="button"
                      class="stat-card__button stat-card__button--use"
                      @click="handleUseUnlockCard(card.id)"
                    >
                      使用{{
                        card.assetKey === "createCards" ? "創建卡" : "解鎖卡"
                      }}
                    </button>
                    <button
                      v-else
                      type="button"
                      class="stat-card__button stat-card__button--buy"
                      @click="handleBuyUnlockCard(card.id)"
                    >
                      <ShoppingCartIcon
                        class="button-icon"
                        aria-hidden="true"
                      />
                      購買{{
                        card.assetKey === "createCards" ? "創建卡" : "解鎖卡"
                      }}
                    </button>
                  </div>
                </div>

                <!-- 道具（動態渲染） -->
                <div
                  v-for="potion in potionsList"
                  :key="potion.id"
                  class="stat-card"
                >
                  <div class="stat-card__header">
                    <div
                      class="stat-card__icon-wrapper"
                      :class="`stat-card__icon-wrapper--${potion.iconColor}`"
                    >
                      <component
                        :is="potion.icon"
                        class="stat-card__icon"
                        aria-hidden="true"
                      />
                    </div>
                    <span class="stat-card__label">{{ potion.name }}</span>
                  </div>
                  <div class="stat-card__value">
                    {{ potion.count }} {{ potion.unit }}
                  </div>
                </div>
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

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.modal-title-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title-icon {
  width: 28px;
  height: 28px;
  color: #fbbf24;
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #f8f9ff;
}

.close-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(15, 17, 28, 0.5);
  color: rgba(226, 232, 240, 0.85);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms ease, border-color 150ms ease;
  flex-shrink: 0;
}

.close-button:hover {
  background: rgba(148, 163, 184, 0.2);
  border-color: rgba(148, 163, 184, 0.45);
}

.close-button .icon {
  width: 20px;
  height: 20px;
}

/* Body */
.modal-body {
  padding: 1.5rem;
}

/* Tier Badge */
.tier-badge {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-radius: 16px;
  margin-bottom: 1.5rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(255, 255, 255, 0.05);
}

.tier-badge--vip {
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.2),
    rgba(245, 158, 11, 0.1)
  );
  border-color: rgba(251, 191, 36, 0.4);
}

.tier-badge--vvip {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.2),
    rgba(124, 58, 237, 0.1)
  );
  border-color: rgba(139, 92, 246, 0.4);
}

.tier-icon {
  width: 24px;
  height: 24px;
  color: #94a3b8;
  flex-shrink: 0;
}

.tier-badge--vip .tier-icon {
  color: #fbbf24;
}

.tier-badge--vvip .tier-icon {
  color: #a78bfa;
}

.tier-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.tier-name {
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #f8f9ff;
}

.tier-expiry {
  font-size: 0.8rem;
  color: rgba(203, 213, 225, 0.8);
  letter-spacing: 0.03em;
}

.expiry-days {
  margin-left: 0.25rem;
  color: rgba(251, 191, 36, 0.9);
  font-weight: 500;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.85rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  padding: 1rem 1.1rem;
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.04)
  );
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  border-color: rgba(255, 255, 255, 0.25);
}

.stat-card:hover::before {
  opacity: 1;
}

.stat-card--limited {
  border-color: rgba(251, 191, 36, 0.3);
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.12),
    rgba(245, 158, 11, 0.06)
  );
}

.stat-card__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.6rem;
}

.stat-card__icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__icon-wrapper--coins {
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.25),
    rgba(245, 158, 11, 0.15)
  );
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.stat-card__icon-wrapper--character {
  background: linear-gradient(
    135deg,
    rgba(167, 139, 250, 0.25),
    rgba(139, 92, 246, 0.15)
  );
  border: 1px solid rgba(167, 139, 250, 0.3);
}

.stat-card__icon-wrapper--photo {
  background: linear-gradient(
    135deg,
    rgba(96, 165, 250, 0.25),
    rgba(59, 130, 246, 0.15)
  );
  border: 1px solid rgba(96, 165, 250, 0.3);
}

.stat-card__icon-wrapper--voice {
  background: linear-gradient(
    135deg,
    rgba(244, 114, 182, 0.25),
    rgba(236, 72, 153, 0.15)
  );
  border: 1px solid rgba(244, 114, 182, 0.3);
}

.stat-card__icon-wrapper--video {
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.25),
    rgba(217, 119, 6, 0.15)
  );
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.stat-card__icon-wrapper--create {
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.25),
    rgba(22, 163, 74, 0.15)
  );
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.stat-card__icon-wrapper--memory {
  background: linear-gradient(
    135deg,
    rgba(139, 92, 246, 0.25),
    rgba(124, 58, 237, 0.15)
  );
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.stat-card__icon-wrapper--brain {
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.25),
    rgba(245, 158, 11, 0.15)
  );
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.stat-card__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.stat-card__icon-image {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.stat-card__icon-fallback {
  width: 18px;
  height: 18px;
}

.stat-card__icon-wrapper--coins .stat-card__icon {
  color: #fbbf24;
}

.stat-card__icon-wrapper--character .stat-card__icon {
  color: #a78bfa;
}

.stat-card__icon-wrapper--photo .stat-card__icon {
  color: #60a5fa;
}

.stat-card__icon-wrapper--voice .stat-card__icon {
  color: #f472b6;
}

.stat-card__icon-wrapper--video .stat-card__icon {
  color: #f59e0b;
}

.stat-card__icon-wrapper--create .stat-card__icon {
  color: #22c55e;
}

.stat-card__icon-wrapper--memory .stat-card__icon {
  color: #a78bfa;
}

.stat-card__icon-wrapper--brain .stat-card__icon {
  color: #fbbf24;
}

.stat-card__label {
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: rgba(248, 250, 252, 0.75);
}

.stat-card__value {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.stat-card__action {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-card__limit-text {
  font-size: 0.75rem;
  color: rgba(251, 191, 36, 0.9);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.stat-card__button {
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
}

.stat-card__button--use {
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.8),
    rgba(22, 163, 74, 0.7)
  );
  color: #fff;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.stat-card__button--use:hover {
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.9),
    rgba(22, 163, 74, 0.8)
  );
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(34, 197, 94, 0.4);
}

.stat-card__button--buy {
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.8),
    rgba(37, 99, 235, 0.7)
  );
  color: #fff;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.stat-card__button--buy:hover {
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.9),
    rgba(37, 99, 235, 0.8)
  );
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.stat-card__button .button-icon {
  width: 14px;
  height: 14px;
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

  .modal-header {
    padding: 1.25rem 1.25rem 0.75rem;
  }

  .modal-body {
    padding: 1.25rem;
  }

  .modal-title {
    font-size: 1.1rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .stat-card {
    padding: 1rem;
  }

  .stat-card__value {
    font-size: 1.25rem;
  }
}
</style>
