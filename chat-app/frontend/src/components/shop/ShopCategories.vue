<script setup lang="ts">
// Types
interface Category {
  id: string;
  label: string;
  [key: string]: any;
}

interface Props {
  categories: Category[];
  activeCategory: string;
}

interface Emits {
  (e: "change", categoryId: string): void;
}

defineProps<Props>();

const emit = defineEmits<Emits>();

const handleCategoryChange = (categoryId: string): void => {
  emit("change", categoryId);
};
</script>

<template>
  <nav class="shop-categories" aria-label="商城分類">
    <button
      v-for="category in categories"
      :key="category.id"
      type="button"
      class="category-tab"
      :class="{ 'category-tab--active': activeCategory === category.id }"
      @click="handleCategoryChange(category.id)"
    >
      {{ category.label }}
    </button>
  </nav>
</template>

<style scoped lang="scss">
.shop-categories {
  display: flex;
  gap: 0.65rem;
  padding: 1rem 1.25rem 0.75rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  position: relative;
  z-index: 1;

  &::-webkit-scrollbar {
    display: none;
  }
}

.category-tab {
  flex-shrink: 0;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(15, 23, 42, 0.4);
  color: rgba(226, 232, 240, 0.85);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  transition: all 0.16s ease;
  backdrop-filter: blur(10px);
  white-space: nowrap;

  &--active {
    background: linear-gradient(
      135deg,
      rgba(236, 72, 153, 0.65),
      rgba(30, 64, 175, 0.5)
    );
    border-color: rgba(236, 72, 153, 0.55);
    color: #fff;
    box-shadow: 0 8px 20px rgba(236, 72, 153, 0.3);
  }
}

@media (max-width: 640px) {
  .shop-categories {
    padding: 0.75rem 1rem 0.65rem;
  }
}

@media (max-width: 420px) {
  .category-tab {
    padding: 0.45rem 0.9rem;
    font-size: 0.76rem;
  }
}
</style>
