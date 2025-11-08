<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  XMarkIcon,
  BoltIcon,
  FilmIcon,
  ExclamationTriangleIcon,
  SpeakerWaveIcon,
  CameraIcon,
  TicketIcon,
  ShoppingCartIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
  // 通用 Props
  type: {
    type: String,
    required: true,
    validator: (value) => ['conversation', 'voice', 'photo', 'video'].includes(value),
  },
  isOpen: {
    type: Boolean,
    required: true,
  },
  characterName: {
    type: String,
    default: '角色',
  },

  // 對話限制相關
  remainingMessages: {
    type: Number,
    default: 0,
  },

  // 語音限制相關
  usedVoices: {
    type: Number,
    default: 0,
  },
  totalVoices: {
    type: Number,
    default: 10,
  },

  // 照片限制相關
  used: {
    type: Number,
    default: 0,
  },
  remaining: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    default: 0,
  },
  standardTotal: {
    type: Number,
    default: null,
  },
  isTestAccount: {
    type: Boolean,
    default: false,
  },
  cards: {
    type: Number,
    default: 0,
  },
  tier: {
    type: String,
    default: 'free',
  },
  resetPeriod: {
    type: String,
    default: 'lifetime',
  },

  // 廣告相關（conversation 和 voice 共用）
  dailyAdLimit: {
    type: Number,
    default: 10,
  },
  adsWatchedToday: {
    type: Number,
    default: 0,
  },

  // 解鎖卡相關
  characterUnlockCards: {
    type: Number,
    default: 0,
  },
  voiceUnlockCards: {
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

  // 對話限制專用
  isUnlocked: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'watchAd', 'upgrade', 'buyUnlockCard', 'useUnlockCard', 'purchase-cards', 'upgrade-membership']);

const router = useRouter();
const isWatchingAd = ref(false);

// 類型配置
const typeConfig = {
  conversation: {
    title: '對話次數已達上限',
    icon: ExclamationTriangleIcon,
    iconColor: '#fbbf24',
    highlightColor: '#60a5fa',
    shopCategory: 'character-unlock',
    unlockCardsKey: 'characterUnlockCards',
    adDescription: '觀看一則廣告即可繼續對話',
    unlockUseDescription: '使用角色解鎖卡立即繼續對話',
    unlockBuyDescription: '購買角色解鎖卡解除對話限制',
    vipTitle: '升級 VIP 會員',
    vipDescription: '享受無限對話，解鎖所有功能',
    vipBenefits: [
      '✓ 與所有角色無限次對話',
      '✓ AI 回覆更長、記憶更多',
      '✓ 獲得解鎖券和金幣獎勵',
    ],
  },
  voice: {
    title: '語音播放次數已達上限',
    icon: SpeakerWaveIcon,
    iconColor: '#a78bfa',
    highlightColor: '#a78bfa',
    shopCategory: 'voice-unlock',
    unlockCardsKey: 'voiceUnlockCards',
    adDescription: '觀看一則廣告即可額外獲得 5 次語音播放',
    unlockUseDescription: '使用語音解鎖卡立即繼續播放',
    unlockBuyDescription: '購買語音解鎖卡解除播放限制',
    vipTitle: '升級 VIP / VVIP',
    vipDescription: '享受無限語音播放，解鎖所有功能',
    vipBenefits: [
      '✓ 無限次語音播放',
      '✓ 與所有角色無限次對話',
      '✓ AI 回覆更長、記憶更多',
      '✓ 獲得解鎖券和金幣獎勵',
    ],
  },
  photo: {
    title: '拍照次數已達上限',
    icon: ExclamationTriangleIcon,
    iconColor: '#fbbf24',
    highlightColor: '#ec4899',
    shopCategory: 'photo-unlock',
    unlockCardsKey: 'photoUnlockCards',
    unlockUseDescription: '使用照片解鎖卡立即生成照片',
    unlockBuyDescription: '購買照片解鎖卡，隨時補充拍照次數',
    hasAd: false,
  },
  video: {
    title: '影片生成需要影片卡',
    icon: FilmIcon,
    iconColor: '#f59e0b',
    highlightColor: '#8b5cf6',
    shopCategory: 'video-unlock',
    unlockCardsKey: 'videoUnlockCards',
    unlockUseDescription: '使用影片解鎖卡立即生成影片',
    unlockBuyDescription: '購買影片解鎖卡，隨時補充生成次數',
    hasAd: false,
    vipTitle: '升級會員獲取影片卡',
    vipDescription: '升級會員即可獲得影片卡，開通時一次性贈送',
    vipBenefits: [
      '✓ VIP 會員開通時贈送 1 張影片卡',
      '✓ VVIP 會員開通時贈送 5 張影片卡',
      '✓ 影片卡永久有效，用完為止',
      '✓ 同時享受無限對話和語音播放',
    ],
  },
};

// 當前配置
const config = computed(() => typeConfig[props.type]);

// 計算剩餘的廣告次數
const remainingAds = computed(() => {
  return Math.max(0, props.dailyAdLimit - props.adsWatchedToday);
});

// 是否還有廣告可以觀看
const canWatchAd = computed(() => {
  return remainingAds.value > 0 && config.value.hasAd !== false;
});

// 解鎖卡數量
const unlockCards = computed(() => {
  return props[config.value.unlockCardsKey] || 0;
});

// 是否有解鎖卡
const hasUnlockCards = computed(() => {
  return unlockCards.value > 0;
});

// 用於顯示的限制數量（照片專用，測試帳號使用標準限制）
const displayTotal = computed(() => {
  if (props.type === 'photo') {
    return props.standardTotal !== null ? props.standardTotal : props.total;
  }
  return props.total;
});

// 提示訊息
const message = computed(() => {
  if (props.type === 'conversation') {
    return `您與「${props.characterName}」的對話次數已達到免費用戶上限（${props.remainingMessages} / 10）。`;
  } else if (props.type === 'voice') {
    return `您與「${props.characterName}」的語音播放次數已達到免費用戶上限（${props.usedVoices} / ${props.totalVoices}）。`;
  } else if (props.type === 'photo') {
    let msg = `您已使用 ${props.used} / ${displayTotal.value} 次 AI 自拍額度`;
    if (props.tier === 'free') {
      msg += '（免費用戶終生限制）';
    } else if (props.tier === 'vip') {
      msg += '（VIP 月度限制）';
    } else if (props.tier === 'vvip') {
      msg += '（VVIP 月度限制）';
    }
    if (props.cards > 0) {
      msg += `，另有 ${props.cards} 張拍照卡可用。`;
    }
    return msg;
  } else if (props.type === 'video') {
    if (props.tier === 'free') {
      return props.cards > 0
        ? `您目前有 ${props.cards} 張影片卡可用。`
        : '免費用戶需要升級會員才能獲得影片卡。升級 VIP 可獲得 1 張影片卡，升級 VVIP 可獲得 5 張影片卡。';
    } else {
      const tierName = props.tier === 'vip' ? 'VIP' : 'VVIP';
      if (props.cards > 0) {
        return `您已使用 ${props.used} 次影片生成，目前還有 ${props.cards} 張影片卡可用。`;
      } else {
        return `您已使用完所有影片卡（共使用 ${props.used} 次）。${tierName} 會員開通時贈送的影片卡已用完。`;
      }
    }
  }
  return '';
});

// 會員升級選項配置（照片專用）
const photoVipConfig = computed(() => {
  if (props.type !== 'photo') return null;

  if (props.tier === 'vvip') {
    return null; // VVIP 用戶不顯示升級選項
  }

  return {
    title: props.tier === 'free' ? '升級會員' : '升級到 VVIP',
    description: props.tier === 'free'
      ? 'VIP 每月 10 次 / VVIP 每月 50 次' + (props.resetPeriod === 'monthly' ? '，下個月自動重置' : '')
      : '升級到 VVIP 享受每月 50 次拍照額度' + (props.resetPeriod === 'monthly' ? '，下個月自動重置' : ''),
    benefits: [
      props.tier === 'free' ? '✓ VIP 每月 10 次 / VVIP 每月 50 次拍照' : '✓ VVIP 每月 50 次拍照',
      '✓ 無限對話和語音播放',
      '✓ 獲得解鎖券和金幣獎勵',
    ],
    buttonText: props.tier === 'free' ? '查看方案' : '升級 VVIP',
  };
});

const handleClose = () => {
  if (isWatchingAd.value) return;
  emit('close');
};

const handleWatchAd = async () => {
  if (!canWatchAd.value || isWatchingAd.value) return;

  isWatchingAd.value = true;
  try {
    emit('watchAd');
  } finally {
    // 注意：實際的 isWatchingAd 狀態應該由父組件控制
    // 這裡只是防止重複點擊
    setTimeout(() => {
      isWatchingAd.value = false;
    }, 1000);
  }
};

const handleUpgrade = () => {
  if (props.type === 'photo') {
    emit('upgrade-membership');
  } else {
    emit('upgrade');
  }
  router.push({ name: 'membership' });
};

const handleBuyUnlockCard = () => {
  emit('buyUnlockCard');
  router.push({ path: '/shop', query: { category: config.value.shopCategory } });
};

const handleUseUnlockCard = () => {
  emit('useUnlockCard');
};

const handleOverlayClick = (event) => {
  // 只有點擊背景時才關閉
  if (event.target === event.currentTarget) {
    handleClose();
  }
};
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
                <component :is="config.icon" class="warning-icon" :style="{ color: config.iconColor }" aria-hidden="true" />
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
                <template v-if="type === 'conversation'">
                  您與「<strong>{{ characterName }}</strong>」的對話次數已達到免費用戶上限（{{ remainingMessages }} / 10）。
                </template>
                <template v-else-if="type === 'voice'">
                  您與「<strong>{{ characterName }}</strong>」的語音播放次數已達到免費用戶上限（{{ usedVoices }} / {{ totalVoices }}）。
                </template>
                <template v-else-if="type === 'photo'">
                  您已使用 <strong>{{ used }} / {{ displayTotal }}</strong> 次 AI 自拍額度<template v-if="tier === 'free'">（免費用戶終生限制）</template><template v-else-if="tier === 'vip'">（VIP 月度限制）</template><template v-else-if="tier === 'vvip'">（VVIP 月度限制）</template><template v-if="cards > 0">，另有 <strong>{{ cards }}</strong> 張拍照卡可用。</template>
                </template>
                <template v-else-if="type === 'video'">
                  <template v-if="tier === 'free'">
                    <template v-if="cards > 0">
                      您目前有 <strong>{{ cards }}</strong> 張影片卡可用。
                    </template>
                    <template v-else>
                      免費用戶需要升級會員才能獲得影片卡。升級 <strong>VIP</strong> 可獲得 <strong>1 張影片卡</strong>，升級 <strong>VVIP</strong> 可獲得 <strong>5 張影片卡</strong>。
                    </template>
                  </template>
                  <template v-else>
                    <template v-if="cards > 0">
                      您已使用 <strong>{{ used }}</strong> 次影片生成，目前還有 <strong>{{ cards }}</strong> 張影片卡可用。
                    </template>
                    <template v-else>
                      您已使用完所有影片卡（共使用 <strong>{{ used }}</strong> 次）。<strong>{{ tier === 'vip' ? 'VIP' : 'VVIP' }}</strong> 會員開通時贈送的影片卡已用完。
                    </template>
                  </template>
                </template>
              </p>

              <div class="options-section">
                <!-- 觀看廣告選項 (conversation & voice only) -->
                <template v-if="type === 'conversation' || type === 'voice'">
                  <div v-if="canWatchAd" class="option-card option-card--ad">
                    <div class="option-header">
                      <FilmIcon class="option-icon" aria-hidden="true" />
                      <h3 class="option-title">觀看廣告解鎖</h3>
                    </div>
                    <p class="option-description">
                      {{ config.adDescription }}
                    </p>
                    <p class="option-info">
                      今日剩餘次數：<strong>{{ remainingAds }}</strong> / {{ dailyAdLimit }}
                    </p>
                    <button
                      type="button"
                      class="option-button option-button--ad"
                      :disabled="isWatchingAd"
                      @click="handleWatchAd"
                    >
                      {{ isWatchingAd ? '載入中...' : '觀看廣告' }}
                    </button>
                  </div>

                  <!-- 廣告次數已用完提示 -->
                  <div v-else class="option-card option-card--disabled">
                    <div class="option-header">
                      <FilmIcon class="option-icon" aria-hidden="true" />
                      <h3 class="option-title">觀看廣告解鎖</h3>
                    </div>
                    <p class="option-description">
                      今日的廣告觀看次數已用完
                    </p>
                    <p class="option-info">
                      明天將重置為 {{ dailyAdLimit }} 次
                    </p>
                  </div>
                </template>

                <!-- 解鎖卡選項 -->
                <div class="option-card option-card--unlock">
                  <div class="option-header">
                    <TicketIcon class="option-icon" aria-hidden="true" />
                    <h3 class="option-title">{{ hasUnlockCards ? '使用解鎖卡' : '購買解鎖卡' }}</h3>
                  </div>
                  <p class="option-description">
                    {{ hasUnlockCards ? config.unlockUseDescription : config.unlockBuyDescription }}
                  </p>
                  <p v-if="hasUnlockCards" class="option-info">
                    當前擁有：<strong>{{ unlockCards }}</strong> 張
                  </p>
                  <button
                    v-if="hasUnlockCards"
                    type="button"
                    class="option-button option-button--unlock-use"
                    @click="handleUseUnlockCard"
                  >
                    使用解鎖卡
                  </button>
                  <button
                    v-else
                    type="button"
                    class="option-button option-button--unlock-buy"
                    @click="handleBuyUnlockCard"
                  >
                    <ShoppingCartIcon class="button-icon" aria-hidden="true" />
                    前往購買
                  </button>
                </div>

                <!-- 升級會員選項 -->
                <div v-if="type !== 'photo' || photoVipConfig" class="option-card option-card--vip">
                  <div class="option-header">
                    <BoltIcon class="option-icon" aria-hidden="true" />
                    <h3 class="option-title">
                      <template v-if="type === 'photo'">{{ photoVipConfig.title }}</template>
                      <template v-else>{{ config.vipTitle }}</template>
                    </h3>
                  </div>
                  <p class="option-description">
                    <template v-if="type === 'photo'">{{ photoVipConfig.description }}</template>
                    <template v-else>{{ config.vipDescription }}</template>
                  </p>
                  <ul class="vip-benefits">
                    <li v-for="(benefit, index) in (type === 'photo' ? photoVipConfig.benefits : config.vipBenefits)" :key="index">
                      {{ benefit }}
                    </li>
                  </ul>
                  <button
                    type="button"
                    class="option-button option-button--vip"
                    @click="handleUpgrade"
                  >
                    <template v-if="type === 'photo'">{{ photoVipConfig.buttonText }}</template>
                    <template v-else>立即升級</template>
                  </button>
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
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(226, 232, 240, 0.9);
  letter-spacing: 0.02em;
}

.message strong {
  color: var(--highlight-color, #60a5fa);
  font-weight: 600;
}

/* Options Section */
.options-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.option-card {
  padding: 1.25rem;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 17, 28, 0.6);
  transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
}

.option-card:not(.option-card--disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
}

.option-card--ad {
  border-color: rgba(96, 165, 250, 0.3);
  background: rgba(59, 130, 246, 0.08);
}

.option-card--unlock {
  border-color: rgba(167, 139, 250, 0.3);
  background: rgba(139, 92, 246, 0.08);
}

.option-card--vip {
  border-color: rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.08);
}

.option-card--disabled {
  opacity: 0.6;
}

.option-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.option-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.option-card--ad .option-icon {
  color: #60a5fa;
}

.option-card--unlock .option-icon {
  color: #a78bfa;
}

.option-card--vip .option-icon {
  color: #fbbf24;
}

.option-card--disabled .option-icon {
  color: rgba(148, 163, 184, 0.5);
}

.option-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #f8f9ff;
}

.option-description {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  line-height: 1.5;
  color: rgba(203, 213, 225, 0.85);
}

.option-info {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: rgba(203, 213, 225, 0.7);
}

.option-info strong {
  color: #60a5fa;
  font-weight: 600;
}

/* VIP Benefits */
.vip-benefits {
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.vip-benefits li {
  font-size: 0.9rem;
  color: rgba(226, 232, 240, 0.9);
  padding-left: 0.25rem;
}

/* Buttons */
.option-button {
  width: 100%;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  border: none;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  transition: transform 150ms ease, box-shadow 150ms ease, filter 150ms ease;
  cursor: pointer;
}

.option-button:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

.option-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.option-button--ad {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  color: #fff;
  box-shadow: 0 8px 16px rgba(59, 130, 246, 0.35);
}

.option-button--ad:hover:not(:disabled) {
  box-shadow: 0 12px 24px rgba(59, 130, 246, 0.45);
}

.option-button--unlock-use {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff;
  box-shadow: 0 8px 16px rgba(34, 197, 94, 0.35);
}

.option-button--unlock-use:hover:not(:disabled) {
  box-shadow: 0 12px 24px rgba(34, 197, 94, 0.45);
}

.option-button--unlock-buy {
  background: linear-gradient(135deg, #8b5cf6, #a78bfa);
  color: #fff;
  box-shadow: 0 8px 16px rgba(139, 92, 246, 0.35);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.option-button--unlock-buy:hover:not(:disabled) {
  box-shadow: 0 12px 24px rgba(139, 92, 246, 0.45);
}

.option-button--unlock-buy .button-icon {
  width: 18px;
  height: 18px;
}

.option-button--vip {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  color: #1a1a2e;
  box-shadow: 0 8px 16px rgba(251, 191, 36, 0.35);
}

.option-button--vip:hover:not(:disabled) {
  box-shadow: 0 12px 24px rgba(251, 191, 36, 0.45);
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

  .warning-icon {
    width: 24px;
    height: 24px;
  }
}
</style>
