<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  HomeIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  UserIcon,
} from "@heroicons/vue/24/outline";

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});

const router = useRouter();
const route = useRoute();

const defaultItems = [
  {
    key: "match",
    label: "配對",
    to: { name: "match" },
    icon: HomeIcon,
  },
  {
    key: "search",
    label: "探索",
    icon: MagnifyingGlassIcon,
    to: { name: "search" },
  },
  {
    key: "workspace",
    label: "創作",
    icon: SparklesIcon,
    to: { name: "character-create-gender" },
  },
  {
    key: "messages",
    label: "訊息",
    icon: ChatBubbleOvalLeftEllipsisIcon,
    to: { name: "chat-list" },
  },
  {
    key: "profile",
    label: "我",
    icon: UserIcon,
    to: { name: "profile" },
  },
];

const navItems = computed(() => {
  if (props.items.length) {
    return props.items.map((item, index) => ({
      ...item,
      key: item.key ?? `nav-${index}`,
    }));
  }
  return defaultItems;
});

const isActive = (item) => {
  if (!item || !item.to) return false;
  if (item.to.name && item.to.name === route.name) return true;
  if (item.to.path && item.to.path === route.path) return true;
  return false;
};

const handleSelect = (item) => {
  if (!item || item.disabled || !item.to) return;
  if (isActive(item)) return;
  router.push(item.to);
};
</script>

<template>
  <nav class="bottom-nav" role="navigation" aria-label="主選單">
    <ul class="bottom-nav-list">
      <li v-for="item in navItems" :key="item.key" class="bottom-nav-entry">
        <button
          type="button"
          class="bottom-nav-item"
          :class="{ active: isActive(item), disabled: item.disabled }"
          :aria-label="item.label"
          :aria-current="isActive(item) ? 'page' : undefined"
          :disabled="item.disabled"
          @click="handleSelect(item)"
        >
          <component :is="item.icon" class="icon" aria-hidden="true" />
          <span class="sr-only">{{ item.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
  <div class="bottom-nav-guard" aria-hidden="true" />
</template>

<style scoped lang="scss">
:global(:root) {
  --bottom-nav-offset: calc(
    clamp(40px, 10vw, 40px) + 1.3rem + env(safe-area-inset-bottom, 0px)
  );
}

:global(body.hide-bottom-nav) {
  --bottom-nav-offset: 0px;
}

:global(body.hide-bottom-nav .bottom-nav) {
  display: none;
}

:global(body.hide-bottom-nav .bottom-nav-guard) {
  height: 0;
}

.bottom-nav {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  padding: 0.65rem clamp(1rem, 5vw, 2rem);
  padding-bottom: calc(0.65rem + env(safe-area-inset-bottom));
  background: rgba(17, 18, 24, 0.92);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  z-index: 1500;
  display: flex;
  justify-content: center;
}

@media (min-width: 768px) {
  .bottom-nav {
    inset-inline: auto;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 430px;
    padding-inline: clamp(1rem, 5vw, 2rem);
  }

  .bottom-nav-list {
    width: 100%;
  }
}

.bottom-nav-list {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(0.5rem, 5vw, 1.5rem);
  width: min(520px, 100%);
  margin: 0 auto;
  padding: 0;
  list-style: none;
}

.bottom-nav-entry {
  flex: 1;
  display: flex;
  justify-content: center;
}

.bottom-nav-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(40px, 10vw, 40px);
  height: clamp(40px, 10vw, 40px);
  border-radius: 999px;
  color: #94a3b8;
  border: 1px solid transparent;
  transition: color 150ms ease, transform 150ms ease, border-color 150ms ease;
}

.bottom-nav-item::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  box-shadow: 0 12px 28px rgba(255, 77, 143, 0.35);
  opacity: 0;
  transform: scale(0.65);
  transition: opacity 180ms ease, transform 180ms ease;
  z-index: -1;
}

.bottom-nav-item:hover:not(.disabled) {
  color: #e2e8f0;
  transform: translateY(-4px);
}

.bottom-nav-item.active {
  color: #fff;
}

.bottom-nav-item.active::before {
  opacity: 1;
  transform: scale(1);
}

.bottom-nav-item.disabled {
  cursor: not-allowed;
  color: rgba(148, 163, 184, 0.55);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  border: 0;
  white-space: nowrap;
}

.bottom-nav-guard {
  height: var(--bottom-nav-offset, 0px);
}
</style>
