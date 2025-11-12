<script setup>
import ShopItem from "./ShopItem.vue";
import { ShoppingBagIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  isPurchasing: {
    type: Boolean,
    default: false,
  },
  isPurchasingItem: {
    type: Boolean,
    default: false,
  },
  balance: {
    type: Number,
    default: 0,
  },
  membershipTier: {
    type: String,
    default: "free",
  },
  isCoinIconAvailable: {
    type: Boolean,
    default: true,
  },
  categoryDescription: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["purchase", "coinIconError"]);

const handlePurchase = (item) => {
  emit("purchase", item);
};

const handleCoinIconError = () => {
  emit("coinIconError");
};

// 判斷是否正在購買該商品
const isPurchasingItem = (item) => {
  if (item.isCoinPackage) {
    return props.isPurchasing;
  } else {
    return props.isPurchasingItem;
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
</style>
