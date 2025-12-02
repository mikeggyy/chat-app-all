<template>
  <div class="comparison-section">
    <h3 class="comparison-section__title">方案對比</h3>
    <div class="comparison-table">
      <div class="comparison-table__header">
        <div class="comparison-table__cell comparison-table__cell--header">
          功能
        </div>
        <div class="comparison-table__cell comparison-table__cell--header">
          免費
        </div>
        <div
          class="comparison-table__cell comparison-table__cell--header comparison-table__cell--lite"
        >
          Lite
        </div>
        <div
          class="comparison-table__cell comparison-table__cell--header comparison-table__cell--vip"
        >
          VIP
        </div>
        <div
          class="comparison-table__cell comparison-table__cell--header comparison-table__cell--vvip"
        >
          VVIP
        </div>
      </div>

      <div
        v-for="category in features"
        :key="category.category"
        class="comparison-table__category"
      >
        <div class="comparison-table__category-title">
          {{ category.category }}
        </div>
        <div
          v-for="item in category.items"
          :key="item.name"
          class="comparison-table__row"
        >
          <div class="comparison-table__cell comparison-table__cell--name">
            {{ item.name }}
          </div>
          <div class="comparison-table__cell">{{ item.free }}</div>
          <div
            class="comparison-table__cell comparison-table__cell--highlight-lite"
          >
            {{ item.lite }}
          </div>
          <div
            class="comparison-table__cell comparison-table__cell--highlight"
          >
            {{ item.vip }}
          </div>
          <div
            class="comparison-table__cell comparison-table__cell--highlight-vvip"
          >
            {{ item.vvip }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ComparisonTable - 會員方案對比表格組件
 * 職責：顯示各會員方案的功能對比
 *
 * ✅ 2025-11-30 更新：新增 Lite 欄位
 */

// Types
interface ComparisonItem {
  name: string;
  free: string;
  lite: string;
  vip: string;
  vvip: string;
}

interface FeatureCategory {
  category: string;
  items: ComparisonItem[];
}

interface Props {
  features: FeatureCategory[];
}

defineProps<Props>();
</script>

<style scoped>
.comparison-section {
  margin-top: 1rem;
  padding: 1.5rem;
  background: rgba(15, 20, 40, 0.6);
  border-radius: 20px;
  border: 1px solid rgba(96, 165, 250, 0.2);
}

.comparison-section__title {
  margin: 0 0 1.25rem;
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(251, 191, 36, 0.9);
}

.comparison-table__header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.comparison-table__cell {
  padding: 0.75rem 0.5rem;
  font-size: 0.85rem;
  text-align: center;
  border-radius: 8px;
}

.comparison-table__cell--header {
  font-weight: 600;
  background: rgba(30, 40, 80, 0.6);
  color: rgba(217, 226, 255, 0.9);
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}

.comparison-table__cell--lite {
  background: linear-gradient(
    135deg,
    rgba(16, 185, 129, 0.2),
    rgba(20, 184, 166, 0.2)
  );
}

.comparison-table__cell--vip {
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.2),
    rgba(99, 102, 241, 0.2)
  );
}

.comparison-table__cell--vvip {
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.2),
    rgba(249, 115, 22, 0.2)
  );
}

.comparison-table__category {
  margin-bottom: 1rem;
}

.comparison-table__category-title {
  padding: 0.5rem 0.75rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: rgba(167, 243, 208, 0.9);
  background: rgba(20, 25, 50, 0.6);
  border-radius: 8px;
  margin-bottom: 0.5rem;
  letter-spacing: 0.03em;
}

.comparison-table__row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.comparison-table__cell--name {
  text-align: left;
  font-weight: 500;
  padding-left: 0.75rem;
  color: rgba(217, 226, 255, 0.85);
}

.comparison-table__cell--highlight-lite {
  background: rgba(16, 185, 129, 0.1);
  font-weight: 600;
  color: rgba(110, 231, 183, 0.95);
}

.comparison-table__cell--highlight {
  background: rgba(59, 130, 246, 0.1);
  font-weight: 600;
  color: rgba(147, 197, 253, 0.95);
}

.comparison-table__cell--highlight-vvip {
  background: rgba(251, 191, 36, 0.1);
  font-weight: 600;
  color: rgba(253, 224, 71, 0.95);
}

/* 響應式設計 */
@media (max-width: 640px) {
  .comparison-table__header,
  .comparison-table__row {
    grid-template-columns: 1.5fr 0.8fr 0.8fr 0.8fr 0.8fr;
    gap: 0.25rem;
  }

  .comparison-table__cell {
    padding: 0.5rem 0.25rem;
    font-size: 0.7rem;
  }

  .comparison-table__cell--name {
    padding-left: 0.5rem;
  }
}
</style>
