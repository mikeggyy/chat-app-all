<script setup>
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { logger } from '@/utils/logger';
import {
  XMarkIcon,
  BoltIcon,
  TicketIcon,
  ShoppingCartIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  usedCreations: {
    type: Number,
    default: 0,
  },
  totalLimit: {
    type: Number,
    default: 3,
  },
  standardTotal: {
    type: Number,
    default: null,
  },
  isTestAccount: {
    type: Boolean,
    default: false,
  },
  membershipTier: {
    type: String,
    default: 'free',
  },
  createCards: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['close', 'upgrade', 'buyUnlockCard', 'useUnlockCard']);

// 用於顯示的限制數量（測試帳號使用標準限制）
const displayTotal = computed(() => {
  return props.standardTotal !== null ? props.standardTotal : props.totalLimit;
});

const hasUnlockCards = computed(() => {
  return props.createCards > 0;
});

const router = useRouter();

const handleClose = () => {
  emit('close');
};

const handleUpgrade = () => {
  emit('upgrade');
  router.push({ name: 'membership' });
};

const handleBuyUnlockCard = () => {
  emit('buyUnlockCard');
  router.push({ path: '/shop', query: { category: 'create' } });
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

// 📊 Console Log: 記錄角色創建次數限制信息（方便調試）
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    logger.log(`[角色創建限制] 已使用: ${props.usedCreations} / ${displayTotal.value}, 創建卡: ${props.createCards} 張, 測試帳號: ${props.isTestAccount ? '是' : '否'}`);
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="character-creation-limit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="limit-modal-title"
        @click="handleOverlayClick"
      >
        <div class="modal-backdrop"></div>
        <div class="modal-container">
          <div class="modal-content">
            <!-- Header -->
            <header class="modal-header">
              <div class="modal-title-section">
                <ExclamationTriangleIcon class="warning-icon" aria-hidden="true" />
                <h2 id="limit-modal-title" class="modal-title">
                  角色創建次數已達上限
                </h2>
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
              <p class="message">
                您的角色創建次數已達到本月上限。
                <span v-if="isTestAccount" style="color: rgba(248, 250, 252, 0.5); font-size: 0.85rem; display: block; margin-top: 0.5rem;">(測試帳號)</span>
              </p>

              <div class="options-section">
                <!-- 創建角色解鎖卡選項 -->
                <div class="option-card option-card--unlock">
                  <div class="option-header">
                    <TicketIcon class="option-icon" aria-hidden="true" />
                    <h3 class="option-title">{{ hasUnlockCards ? '使用解鎖卡' : '購買解鎖卡' }}</h3>
                  </div>
                  <p class="option-description">
                    {{ hasUnlockCards ? '使用創建角色解鎖卡立即創建角色' : '購買創建角色解鎖卡，隨時補充創建次數' }}
                  </p>
                  <p v-if="hasUnlockCards" class="option-info">
                    當前擁有：<strong>{{ createCards }}</strong> 張
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
                <div class="option-card option-card--vip">
                  <div class="option-header">
                    <BoltIcon class="option-icon" aria-hidden="true" />
                    <h3 class="option-title">升級 VIP 會員</h3>
                  </div>
                  <p class="option-description">
                    成為 VIP 會員，享受更多創建次數和專屬權益
                  </p>
                  <ul class="vip-benefits">
                    <li>✓ VIP：每月創建 3 個角色</li>
                    <li>✓ VVIP：每月創建 3 個角色 + 贈送 30 張創建角色卡</li>
                    <li>✓ 解鎖所有進階功能</li>
                    <li>✓ 專屬客服支援</li>
                  </ul>
                  <button
                    type="button"
                    class="option-button option-button--vip"
                    @click="handleUpgrade"
                  >
                    立即升級
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
.character-creation-limit-modal {
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

.close-button:hover:not(:disabled) {
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

.message {
  margin: 0 0 1.5rem;
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(226, 232, 240, 0.9);
  letter-spacing: 0.02em;
}

.message strong {
  color: #60a5fa;
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

.option-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
}

.option-card--unlock {
  border-color: rgba(167, 139, 250, 0.3);
  background: rgba(139, 92, 246, 0.08);
}

.option-card--vip {
  border-color: rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.08);
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

.option-card--unlock .option-icon {
  color: #a78bfa;
}

.option-card--vip .option-icon {
  color: #fbbf24;
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
  color: #a78bfa;
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
