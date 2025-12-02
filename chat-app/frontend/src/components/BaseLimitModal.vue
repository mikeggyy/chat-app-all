<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { useRouter, type Router } from 'vue-router';
import {
  XMarkIcon,
  BoltIcon,
  FilmIcon,
  TicketIcon,
  ShoppingCartIcon,
} from '@heroicons/vue/24/outline';
import { logger } from '../utils/logger';
import LimitOptionCard from './limit/LimitOptionCard.vue';
import { useLimitModalConfig } from '../composables/limit/useLimitModalConfig';

type LimitType = 'conversation' | 'voice' | 'photo' | 'video';

interface Props {
  type: LimitType;
  isOpen: boolean;
  characterName?: string;
  // 對話限制相關
  remainingMessages?: number;
  // 語音限制相關
  usedVoices?: number;
  totalVoices?: number;
  // 照片/影片限制相關
  used?: number;
  remaining?: number;
  total?: number;
  standardTotal?: number | null;
  isTestAccount?: boolean;
  cards?: number;
  tier?: string;
  resetPeriod?: string;
  // 廣告相關
  dailyAdLimit?: number;
  adsWatchedToday?: number;
  // 解鎖卡相關
  characterUnlockCards?: number;
  voiceUnlockCards?: number;
  photoUnlockCards?: number;
  videoUnlockCards?: number;
  // 對話限制專用
  isUnlocked?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  characterName: '角色',
  remainingMessages: 0,
  usedVoices: 0,
  totalVoices: 10,
  used: 0,
  remaining: 0,
  total: 0,
  standardTotal: null,
  isTestAccount: false,
  cards: 0,
  tier: 'free',
  resetPeriod: 'lifetime',
  dailyAdLimit: 10,
  adsWatchedToday: 0,
  characterUnlockCards: 0,
  voiceUnlockCards: 0,
  photoUnlockCards: 0,
  videoUnlockCards: 0,
  isUnlocked: false,
});

interface Emits {
  (e: 'close'): void;
  (e: 'watchAd'): void;
  (e: 'upgrade'): void;
  (e: 'buyUnlockCard'): void;
  (e: 'useUnlockCard'): void;
  (e: 'purchase-cards'): void;
  (e: 'upgrade-membership'): void;
}

const emit = defineEmits<Emits>();

const router: Router = useRouter();
const isWatchingAd = ref<boolean>(false);

// ✅ 修復：追蹤定時器以便清理
let watchAdTimerId: ReturnType<typeof setTimeout> | null = null;

// 使用配置 composable
const {
  config,
  remainingAds,
  canWatchAd,
  unlockCards,
  hasUnlockCards,
  displayTotal,
  photoVipConfig,
  message,
} = useLimitModalConfig(props);

// 事件處理
const handleClose = (): void => {
  if (isWatchingAd.value) return;
  emit('close');
};

const handleWatchAd = async (): Promise<void> => {
  if (!canWatchAd.value || isWatchingAd.value) return;

  isWatchingAd.value = true;

  // ✅ 修復：清理之前的定時器（如果有）
  if (watchAdTimerId !== null) {
    clearTimeout(watchAdTimerId);
  }

  try {
    emit('watchAd');
  } finally {
    watchAdTimerId = setTimeout(() => {
      isWatchingAd.value = false;
      watchAdTimerId = null;
    }, 1000);
  }
};

const handleUpgrade = (): void => {
  if (props.type === 'photo') {
    emit('upgrade-membership');
  } else {
    emit('upgrade');
  }
  router.push({ name: 'membership' });
};

const handleBuyUnlockCard = (): void => {
  emit('buyUnlockCard');
  router.push({ path: '/shop', query: { category: config.value.shopCategory } });
};

const handleUseUnlockCard = (): void => {
  emit('useUnlockCard');
};

const handleOverlayClick = (event: MouseEvent): void => {
  if (event.target === event.currentTarget) {
    handleClose();
  }
};

// 記錄限制信息
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      if (props.type === 'conversation') {
        logger.log(
          `[對話限制] 角色: ${props.characterName}, 剩餘次數: ${props.remainingMessages} / 10`
        );
      } else if (props.type === 'voice') {
        logger.log(
          `[語音限制] 角色: ${props.characterName}, 已使用: ${props.usedVoices} / ${props.totalVoices}`
        );
      } else if (props.type === 'photo') {
        logger.log(
          `[拍照限制] 已使用: ${props.used} / ${displayTotal.value}, 會員等級: ${props.tier}, 照片解鎖卡: ${props.cards} 張`
        );
      } else if (props.type === 'video') {
        logger.log(
          `[影片限制] 已使用: ${props.used} 次, 影片卡: ${props.cards} 張, 會員等級: ${props.tier}`
        );
      }
    }
  }
);

// ✅ 修復：組件卸載時清理定時器
onBeforeUnmount(() => {
  if (watchAdTimerId !== null) {
    clearTimeout(watchAdTimerId);
    watchAdTimerId = null;
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        :class="`${type}-limit-modal`"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${type}-limit-modal-title`"
        @click="handleOverlayClick"
      >
        <div class="modal-backdrop"></div>
        <div class="modal-container">
          <div class="modal-content">
            <!-- Header -->
            <header class="modal-header">
              <div class="modal-title-section">
                <component
                  :is="config.icon"
                  class="warning-icon"
                  :style="{ color: config.iconColor }"
                  aria-hidden="true"
                />
                <h2 :id="`${type}-limit-modal-title`" class="modal-title">
                  {{ config.title }}
                </h2>
              </div>
              <button
                type="button"
                class="close-button"
                aria-label="關閉"
                :disabled="isWatchingAd"
                @click="handleClose"
              >
                <XMarkIcon class="icon" aria-hidden="true" />
              </button>
            </header>

            <!-- Body -->
            <div class="modal-body">
              <p class="message" :style="{ '--highlight-color': config.highlightColor }">
                {{ message }}
              </p>

              <div class="options-section">
                <!-- 觀看廣告選項 (conversation & voice only) -->
                <template v-if="type === 'conversation' || type === 'voice'">
                  <LimitOptionCard
                    v-if="canWatchAd"
                    variant="ad"
                    :icon="FilmIcon"
                    title="觀看廣告解鎖"
                    :description="config.adDescription ?? '觀看廣告以繼續使用'"
                    :info="`今日剩餘次數：<strong>${remainingAds}</strong> / ${dailyAdLimit}`"
                    :button-text="isWatchingAd ? '載入中...' : '觀看廣告'"
                    :disabled="isWatchingAd"
                    @click="handleWatchAd"
                  />

                  <LimitOptionCard
                    v-else
                    variant="disabled"
                    :icon="FilmIcon"
                    title="觀看廣告解鎖"
                    description="今日的廣告觀看次數已用完"
                    :info="`明天將重置為 ${dailyAdLimit} 次`"
                  />
                </template>

                <!-- 解鎖卡選項 -->
                <LimitOptionCard
                  variant="unlock"
                  :icon="TicketIcon"
                  :title="hasUnlockCards ? '使用解鎖卡' : '購買解鎖卡'"
                  :description="
                    hasUnlockCards ? config.unlockUseDescription : config.unlockBuyDescription
                  "
                  :info="hasUnlockCards ? `當前擁有：<strong>${unlockCards}</strong> 張` : ''"
                  :button-text="
                    hasUnlockCards
                      ? type === 'conversation'
                        ? '暢聊 7 天'
                        : '使用解鎖卡'
                      : '前往購買'
                  "
                  :button-icon="hasUnlockCards ? undefined : ShoppingCartIcon"
                  @click="hasUnlockCards ? handleUseUnlockCard() : handleBuyUnlockCard()"
                />

                <!-- 升級會員選項 -->
                <LimitOptionCard
                  v-if="type !== 'photo' || photoVipConfig"
                  variant="vip"
                  :icon="BoltIcon"
                  :title="type === 'photo' && photoVipConfig ? photoVipConfig.title : (config.vipTitle ?? '升級會員')"
                  :description="
                    type === 'photo' && photoVipConfig ? photoVipConfig.description : (config.vipDescription ?? '享受更多功能')
                  "
                  :benefits="
                    type === 'photo' && photoVipConfig ? photoVipConfig.benefits : (config.vipBenefits ?? [])
                  "
                  :button-text="
                    type === 'photo' && photoVipConfig ? photoVipConfig.buttonText : '立即升級'
                  "
                  @click="handleUpgrade"
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
.conversation-limit-modal,
.voice-limit-modal,
.photo-limit-modal,
.video-limit-modal {
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
  max-width: 560px;
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
  align-items: flex-start;
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

.warning-icon {
  width: 28px;
  height: 28px;
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

.close-button:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.2);
  border-color: rgba(148, 163, 184, 0.45);
}

.close-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-button .icon {
  width: 20px;
  height: 20px;
}

/* Body */
.modal-body {
  padding: 1.5rem;
}

.message {
  margin: 0 0 1.5rem;
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(226, 232, 240, 0.9);
}

.message strong {
  color: var(--highlight-color, #60a5fa);
  font-weight: 600;
}

.options-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 250ms ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 250ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.9);
  opacity: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .modal-container {
    max-width: calc(100% - 2rem);
  }

  .modal-header {
    padding: 1.25rem 1.25rem 0.875rem;
  }

  .modal-body {
    padding: 1.25rem;
  }

  .modal-title {
    font-size: 1.125rem;
  }

  .message {
    font-size: 0.9375rem;
  }
}
</style>
