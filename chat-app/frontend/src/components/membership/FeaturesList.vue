<template>
  <div class="features-section">
    <h3 class="features-section__title">方案優勢</h3>
    <ul class="features-list" role="list">
      <li
        v-for="feature in features"
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
</template>

<script setup lang="ts">
/**
 * FeaturesList - 會員方案功能列表組件
 * 職責：顯示當前方案的所有功能特點
 */

// Types
interface Feature {
  title: string;
  detail: string;
  icon: any; // Component type
  badge?: string | null;
  [key: string]: any;
}

interface Props {
  features: Feature[];
}

defineProps<Props>();
</script>

<style scoped>
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

/* 響應式設計 */
@media (max-width: 640px) {
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
