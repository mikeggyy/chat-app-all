<template>
  <div class="stat-card stat-card--coins">
    <div class="stat-card__header">
      <div class="stat-card__icon-wrapper stat-card__icon-wrapper--coins">
        <img
          v-if="isCoinIconAvailable"
          :src="coinIconPath"
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
</template>

<script setup lang="ts">
// Types

import { ref } from "vue";
import { BoltIcon } from "@heroicons/vue/24/outline";
import { COIN_ICON_PATH } from "../../config/assets";

defineProps({
  formattedBalance: {
    type: String,
    default: "0",
  },
});

const coinIconPath = COIN_ICON_PATH;
const isCoinIconAvailable = ref(true);

const handleCoinIconError = () => {
  if (isCoinIconAvailable.value) {
    isCoinIconAvailable.value = false;
  }
};
</script>

<style scoped>
.stat-card {
  padding: 1rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(148, 163, 184, 0.15);
  transition: background 200ms ease, border-color 200ms ease;
}

.stat-card--coins {
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.12),
    rgba(245, 158, 11, 0.06)
  );
  border-color: rgba(251, 191, 36, 0.3);
}

.stat-card__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.stat-card__icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__icon {
  width: 18px;
  height: 18px;
  color: #1e293b;
}

.stat-card__icon-image {
  width: 20px;
  height: 20px;
}

.stat-card__icon-fallback {
  color: #1e293b;
}

/* 🔥 修復：emoji 樣式 */
.stat-card__icon-emoji {
  font-size: 1.25rem;
  line-height: 1;
}

.stat-card__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(226, 232, 240, 0.85);
}

.stat-card__value {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #fbbf24;
}
</style>
