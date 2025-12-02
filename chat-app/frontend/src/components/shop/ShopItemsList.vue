<script setup lang="ts">
import ShopItem from "./ShopItem.vue";
import { ShoppingBagIcon } from "@heroicons/vue/24/outline";

// Types
interface ShopItemType {
  id: string;
  name: string;
  price: number;
  isCoinPackage?: boolean;
  [key: string]: any;
}

interface Props {
  items?: ShopItemType[];
  isPurchasing?: boolean;
  isPurchasingItem?: boolean;
  balance?: number;
  membershipTier?: string;
  isCoinIconAvailable?: boolean;
  categoryDescription?: string;
}

interface Emits {
  (e: "purchase", item: ShopItemType): void;
  (e: "coinIconError"): void;
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  isPurchasing: false,
  isPurchasingItem: false,
  balance: 0,
  membershipTier: "free",
  isCoinIconAvailable: true,
  categoryDescription: "",
});

const emit = defineEmits<Emits>();

const handlePurchase = (item: ShopItemType): void => {
  emit("purchase", item);
};

const handleCoinIconError = (): void => {
  emit("coinIconError");
};

// 判斷是否正在購買該商品
const isPurchasingItem = (item: ShopItemType): boolean => {
  if (item.isCoinPackage) {
    return props.isPurchasing ?? false;
  } else {
    return props.isPurchasingItem ?? false;
  }
};
</script>

<template>
  <section class="shop-content">
    <!-- 分類描述 -->
    <div v-if="categoryDescription" class="category-description">
      <p>{{ categoryDescription }}</p>
    </div>

    <div class="shop-items">
      <ShopItem
        v-for="item in items"
        :key="item.id"
        :item="item"
        :is-purchasing="isPurchasingItem(item)"
        :balance="balance"
        :membership-tier="membershipTier"
        :is-coin-icon-available="isCoinIconAvailable"
        @purchase="handlePurchase"
        @coin-icon-error="handleCoinIconError"
      />

      <div v-if="items.length === 0" class="shop-empty">
        <ShoppingBagIcon class="empty-icon" aria-hidden="true" />
        <p class="empty-text">此分類暫無商品</p>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.shop-content {
  padding: 0.5rem 1.5rem 1.5rem;
  position: relative;
  z-index: 1;
  overflow-y: auto;
  flex: 1;
  max-height: calc(85dvh - 200px);
}

.category-description {
  margin-bottom: 1rem;
  padding: 0.85rem 1.1rem;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 12px;
  backdrop-filter: blur(10px);

  p {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.5;
    color: rgba(226, 232, 240, 0.75);
    text-align: center;
  }
}

.shop-items {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.shop-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  color: rgba(226, 232, 240, 0.5);
}

.empty-icon {
  width: 64px;
  height: 64px;
  opacity: 0.4;
  color: rgba(148, 163, 184, 0.5);
}

.empty-text {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.02em;
  font-weight: 400;
  color: rgba(226, 232, 240, 0.65);
}

@media (min-width: 769px) {
  .shop-items {
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 420px) {
  .category-description {
    padding: 0.75rem 0.9rem;

    p {
      font-size: 0.78rem;
    }
  }
}

// ========================================
// 桌面版樣式 (≥ 1024px)
// ========================================

@media (min-width: 1024px) {
  .shop-content {
    padding: 0;
    max-height: none;
    overflow-y: visible;
  }

  .category-description {
    max-width: 600px;
    margin: 0 auto 1.5rem;
    padding: 1rem 1.5rem;
    border-radius: 14px;
    background: linear-gradient(165deg, rgba(30, 33, 48, 0.95) 0%, rgba(22, 25, 43, 0.9) 100%);
    border: 1px solid rgba(148, 163, 184, 0.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);

    p {
      font-size: 0.9rem;
    }
  }

  .shop-items {
    grid-template-columns: repeat(4, 1fr);
    gap: 1.25rem;
  }

  .shop-empty {
    padding: 6rem 3rem;
  }

  .empty-icon {
    width: 80px;
    height: 80px;
  }

  .empty-text {
    font-size: 1.125rem;
  }
}

// 寬螢幕優化
@media (min-width: 1440px) {
  .category-description {
    margin-bottom: 2rem;
    padding: 1.25rem 2rem;

    p {
      font-size: 0.9375rem;
    }
  }

  .shop-items {
    gap: 1.5rem;
  }
}

// 超寬螢幕
@media (min-width: 1920px) {
  .shop-items {
    grid-template-columns: repeat(5, 1fr);
  }
}
</style>
