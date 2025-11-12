<script setup>
/**
 * 快速解鎖角色懸浮按鈕
 * 從 ChatView.vue 提取為獨立組件
 */
import { computed } from 'vue';

const props = defineProps({
  /** 角色是否已解鎖 */
  isCharacterUnlocked: {
    type: Boolean,
    default: false,
  },
  /** 是否擁有角色解鎖卡 */
  hasCharacterTickets: {
    type: Boolean,
    default: false,
  },
  /** 角色解鎖卡數量 */
  characterTickets: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['unlock-action']);

const buttonTitle = computed(() => {
  return props.hasCharacterTickets
    ? `使用解鎖卡（擁有 ${props.characterTickets} 張）`
    : '購買解鎖卡';
});

const handleClick = () => {
  emit('unlock-action');
};
</script>

<template>
  <!-- 只在角色未解鎖時顯示 -->
  <button
    v-if="!isCharacterUnlocked"
    type="button"
    class="unlock-fab"
    :class="{ 'has-cards': hasCharacterTickets }"
    :title="buttonTitle"
    @click="handleClick"
  >
    <span class="unlock-fab__icon">🎫</span>
    <span v-if="hasCharacterTickets" class="unlock-fab__count">{{
      characterTickets
    }}</span>
  </button>
</template>

<style scoped lang="scss">
/* ===================
   快速解鎖角色懸浮按鈕
   =================== */
.unlock-fab {
  position: fixed;
  top: 140px;
  right: 1.5rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 1000;
  overflow: visible;

  // 旋轉光環（外圈）- 預設就顯示
  &::before {
    content: "";
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      rgba(34, 197, 94, 0.6) 90deg,
      transparent 180deg,
      rgba(34, 197, 94, 0.6) 270deg,
      transparent 360deg
    );
    animation: rotate 3s linear infinite;
    opacity: 0.7;
    transition: opacity 0.3s ease;
  }

  // 發光光暈（中圈）- 預設就顯示
  &::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(34, 197, 94, 0.4) 0%,
      transparent 70%
    );
    animation: pulse-glow 2s ease-in-out infinite;
    opacity: 0.5;
    transition: opacity 0.3s ease;
  }

  // 按鈕本身也有脈動動畫
  animation: pulse-shadow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;

  // icon 預設就閃爍
  &__icon {
    font-size: 1.75rem;
    line-height: 1;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    position: relative;
    z-index: 1;
    animation: sparkle 3s ease-in-out infinite;
  }

  &:hover {
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 12px 32px rgba(34, 197, 94, 0.5);

    &::before,
    &::after {
      opacity: 1;
    }
  }

  &:active {
    transform: translateY(-2px) scale(1.02);
  }

  &__count {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 11px;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #0f1016;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    z-index: 2;
    animation: bounce-subtle 2s ease-in-out infinite;
  }

  // 有卡時增強效果
  &.has-cards {
    &::before,
    &::after {
      opacity: 1;
    }
  }
}

// 旋轉動畫
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// 脈動陰影
@keyframes pulse-shadow {
  0%,
  100% {
    box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4);
  }
  50% {
    box-shadow: 0 12px 40px rgba(34, 197, 94, 0.8),
      0 0 30px rgba(34, 197, 94, 0.5);
  }
}

// 光暈脈動
@keyframes pulse-glow {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.6;
  }
}

// 閃爍效果
@keyframes sparkle {
  0%,
  100% {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)) brightness(1);
  }
  50% {
    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))
      drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)) brightness(1.3);
  }
}

// 徽章彈跳
@keyframes bounce-subtle {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-2px) scale(1.05);
  }
}
</style>
