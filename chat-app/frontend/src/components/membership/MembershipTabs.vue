<template>
  <nav class="membership-tabs" role="tablist" aria-label="會員方案切換">
    <button
      v-for="tier in tiers"
      :key="tier.id"
      type="button"
      class="membership-tabs__item"
      :class="{
        'membership-tabs__item--active': tier.id === activeTierId,
      }"
      role="tab"
      :aria-selected="tier.id === activeTierId"
      @click="$emit('select', tier.id)"
    >
      <span class="membership-tabs__label">{{ tier.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
/**
 * MembershipTabs - 會員方案切換標籤組件
 * 職責：顯示會員方案選項並處理切換
 *
 * ✅ 2025-11-30 更新：支援 3 個方案 (Lite, VIP, VVIP)
 */

// Types
interface Tier {
  id: string;
  label: string;
  [key: string]: any;
}

interface Props {
  tiers: Tier[];
  activeTierId: string;
}

interface Emits {
  (e: 'select', tierId: string): void;
}

defineProps<Props>();

defineEmits<Emits>();
</script>

<style scoped>
.membership-tabs {
  margin: -1rem 1.25rem 1.5rem;
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* ✅ 更新：3 欄支援 Lite, VIP, VVIP */
  gap: 0.5rem;
  padding: 0.5rem;
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
</style>
