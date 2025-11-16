<script setup lang="ts">
import { QUICK_ACTIONS } from "../../config/profile";
import type { QuickAction } from "../../config/profile";

interface Props {
  hasUnreadNotifications?: boolean;
}

withDefaults(defineProps<Props>(), {
  hasUnreadNotifications: false,
});

const emit = defineEmits<{
  "action-select": [action: QuickAction];
}>();

const handleActionClick = (action: QuickAction) => {
  emit("action-select", action);
};
</script>

<template>
  <section class="quick-actions" aria-label="��w�">
    <ul>
      <li
        v-for="action in QUICK_ACTIONS"
        :key="action.key"
        class="quick-action"
      >
        <button
          type="button"
          class="quick-action__button"
          @click="handleActionClick(action)"
        >
          <span class="quick-action__icon">
            <component :is="action.icon" class="icon" aria-hidden="true" />
            <span
              v-if="action.key === 'notifications' && hasUnreadNotifications"
              class="quick-action__badge"
              aria-hidden="true"
            ></span>
          </span>
          <span class="quick-action__label">{{ action.label }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.quick-actions {
  margin-top: -3.5rem;
  position: relative;
  ul {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    margin: 0;
    padding: 0.75rem 0.75rem;
    list-style: none;
    background: linear-gradient(160deg, #181828, #141420);
    border-radius: 30px;
    border: 1px solid rgba(148, 163, 184, 0.12);
    box-shadow: 0 18px 38px rgba(8, 10, 24, 0.35);
    gap: 0.75rem;
  }
}

.quick-action {
  display: flex;
  justify-content: center;

  &__button {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0.5rem;
    border-radius: 18px;
    border: none;
    background: transparent;
    color: #f1f5f9;
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    transition: background 150ms ease, transform 150ms ease;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-2px);
    }
  }

  &__icon {
    position: relative;
    width: 48px;
    height: 48px;
    border-radius: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.16), transparent);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);

    .icon {
      width: 22px;
      height: 22px;
    }
  }

  &__badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow: 0 0 0 2px rgba(14, 18, 34, 0.9), 0 0 8px rgba(239, 68, 68, 0.4);
    animation: badge-pulse 2s ease-in-out infinite;
  }

  @keyframes badge-pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.1);
    }
  }

  &__label {
    color: rgba(241, 245, 249, 0.92);
  }
}

@media (max-width: 640px) {
  .quick-actions ul {
    gap: 0.5rem;
  }
}
</style>
