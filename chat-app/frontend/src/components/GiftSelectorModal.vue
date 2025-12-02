<script setup lang="ts">
import { computed } from 'vue';
import { XMarkIcon, CurrencyDollarIcon } from '@heroicons/vue/24/outline';
import { getGiftList, getGiftPrice, RARITY_CONFIG } from '../config/gifts';

// 會員等級類型
// ✅ 2025-11-30 更新：新增 Lite 等級
type MembershipTier = 'free' | 'lite' | 'vip' | 'vvip';

interface Props {
  isOpen?: boolean;
  characterName?: string;
  balance?: number;
  userBalance?: number;
  membershipTier?: MembershipTier;
}

interface Gift {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: string;
}

interface PriceInfo {
  basePrice: number;
  finalPrice: number;
  saved: number;
}

interface SelectEventData {
  giftId: string;
  gift: Gift;
  priceInfo: PriceInfo;
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  characterName: '角色',
  balance: 0,
  userBalance: 0,
  membershipTier: 'free',
});

const emit = defineEmits<{
  close: [];
  select: [data: SelectEventData];
}>();

const gifts = getGiftList() as Gift[];

const getGiftPriceInfo = (giftId: string): PriceInfo => {
  const result = getGiftPrice(giftId, props.membershipTier);
  // 如果禮物不存在，返回默認值
  return result ?? { basePrice: 0, finalPrice: 0, saved: 0 };
};

const canAfford = (giftId: string): boolean => {
  const priceInfo = getGiftPriceInfo(giftId);
  const currentBalance = props.balance || props.userBalance;
  return currentBalance >= priceInfo.finalPrice;
};

const getRarityColor = (rarity: string): string => {
  const config = RARITY_CONFIG as Record<string, { color: string }>;
  return config[rarity]?.color || '#9CA3AF';
};

const handleSelect = (gift: Gift): void => {
  const priceInfo = getGiftPriceInfo(gift.id);
  if (!canAfford(gift.id)) {
    return;
  }
  emit('select', {
    giftId: gift.id,
    gift,
    priceInfo,
  });
};

const handleClose = (): void => {
  emit('close');
};

const handleOverlayClick = (event: MouseEvent): void => {
  if (event.target === event.currentTarget) {
    handleClose();
  }
};

const hasDiscount = computed(() => {
  return props.membershipTier !== 'free';
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="gift-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gift-modal-title"
        @click="handleOverlayClick"
      >
        <div class="gift-modal__content" @click.stop>
          <!-- 標題 -->
          <div class="gift-modal__header">
            <h2 id="gift-modal-title" class="gift-modal__title">
              選擇禮物送給 {{ characterName }}
            </h2>
            <button
              type="button"
              class="gift-modal__close"
              aria-label="關閉"
              @click.stop="handleClose"
            >
              <XMarkIcon class="icon" aria-hidden="true" />
            </button>
          </div>

          <!-- 金幣餘額 -->
          <div class="gift-modal__balance">
            <CurrencyDollarIcon class="icon" aria-hidden="true" />
            <span class="balance-text">金幣餘額：</span>
            <span class="balance-amount">{{ balance || userBalance }}</span>
          </div>

          <!-- 折扣提示 -->
          <!-- ✅ 2025-11-30 更新：新增 Lite 等級折扣 -->
          <div v-if="hasDiscount" class="gift-modal__discount-tip">
            <span class="discount-badge">{{ membershipTier === 'lite' ? 'Lite 95折' : membershipTier === 'vip' ? 'VIP 9折' : 'VVIP 8折' }}</span>
            優惠中！
          </div>

          <!-- 禮物列表 -->
          <div class="gift-modal__list">
            <button
              v-for="gift in gifts"
              :key="gift.id"
              type="button"
              class="gift-item"
              :class="{
                'is-affordable': canAfford(gift.id),
                'is-expensive': !canAfford(gift.id),
                [`rarity-${gift.rarity}`]: true,
              }"
              :disabled="!canAfford(gift.id)"
              :style="{ '--rarity-color': getRarityColor(gift.rarity) }"
              @click="handleSelect(gift)"
            >
              <div class="gift-item__emoji">{{ gift.emoji }}</div>
              <div class="gift-item__info">
                <div class="gift-item__name">{{ gift.name }}</div>
                <div class="gift-item__description">{{ gift.description }}</div>
                <div class="gift-item__price">
                  <template v-if="hasDiscount && getGiftPriceInfo(gift.id).saved > 0">
                    <span class="price-original">{{ getGiftPriceInfo(gift.id).basePrice }}</span>
                    <span class="price-final">{{ getGiftPriceInfo(gift.id).finalPrice }}</span>
                    <span class="price-saved">省 {{ getGiftPriceInfo(gift.id).saved }}</span>
                  </template>
                  <template v-else>
                    <span class="price-final">{{ getGiftPriceInfo(gift.id).finalPrice }}</span>
                  </template>
                  <span class="price-unit">金幣</span>
                </div>
              </div>
              <div v-if="!canAfford(gift.id)" class="gift-item__locked">
                <span class="locked-text">金幣不足</span>
              </div>
            </button>
          </div>

          <!-- 底部提示 -->
          <div class="gift-modal__footer">
            <p class="footer-text">送出禮物後，{{ characterName }} 會給你一個驚喜回應！</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gift-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.gift-modal__content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 1rem;
  padding: 1.5rem;
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.gift-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.gift-modal__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

.gift-modal__close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  color: white;
  position: relative;
  z-index: 10;
}

.gift-modal__close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.gift-modal__close .icon {
  width: 1.5rem;
  height: 1.5rem;
}

.gift-modal__balance {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.15);
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
  color: white;
}

.gift-modal__balance .icon {
  width: 1.25rem;
  height: 1.25rem;
}

.balance-text {
  font-size: 0.875rem;
}

.balance-amount {
  font-size: 1.25rem;
  font-weight: 700;
  margin-left: auto;
}

.gift-modal__discount-tip {
  background: linear-gradient(90deg, #f59e0b, #d97706);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  text-align: center;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.discount-badge {
  background: rgba(255, 255, 255, 0.3);
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  margin-right: 0.5rem;
}

.gift-modal__list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.gift-item {
  background: rgba(255, 255, 255, 0.95);
  border: 2px solid transparent;
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
  min-height: 160px;
}

.gift-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--rarity-color);
  opacity: 0.6;
}

.gift-item.is-affordable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: var(--rarity-color);
}

.gift-item.is-expensive {
  opacity: 0.5;
  cursor: not-allowed;
}

.gift-item__emoji {
  font-size: 2.5rem;
  line-height: 1;
  flex-shrink: 0;
}

.gift-item__info {
  flex: 1;
  min-width: 0;
  width: 100%;
  text-align: center;
}

.gift-item__name {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.gift-item__description {
  font-size: 0.7rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.gift-item__price {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.price-original {
  font-size: 0.875rem;
  color: #9ca3af;
  text-decoration: line-through;
}

.price-final {
  font-size: 1.125rem;
  font-weight: 700;
  color: #059669;
}

.price-saved {
  font-size: 0.75rem;
  background: #fef3c7;
  color: #d97706;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-weight: 600;
}

.price-unit {
  font-size: 0.875rem;
  color: #6b7280;
}

.gift-item__locked {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: #ef4444;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.gift-modal__footer {
  background: rgba(255, 255, 255, 0.15);
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  text-align: center;
}

.footer-text {
  margin: 0;
  font-size: 0.875rem;
  color: white;
  opacity: 0.9;
}

/* Modal 動畫 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .gift-modal__content,
.modal-leave-active .gift-modal__content {
  transition: transform 0.3s ease;
}

.modal-enter-from .gift-modal__content,
.modal-leave-to .gift-modal__content {
  transform: scale(0.9);
}

/* 響應式 */
@media (max-width: 768px) {
  .gift-modal__list {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 640px) {
  .gift-modal__content {
    padding: 1rem;
  }

  .gift-modal__title {
    font-size: 1.125rem;
  }

  .gift-modal__list {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .gift-item {
    padding: 0.75rem;
    min-height: 140px;
  }

  .gift-item__emoji {
    font-size: 2rem;
  }

  .gift-item__name {
    font-size: 0.8rem;
  }

  .gift-item__description {
    font-size: 0.65rem;
  }
}
</style>
