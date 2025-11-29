<script setup lang="ts">
interface Period {
  id: string;
  label: string;
}

interface Props {
  periods: Period[];
  activePeriod: string;
}

defineProps<Props>();

const emit = defineEmits<{
  change: [periodId: string];
}>();

const handlePeriodChange = (periodId: string) => {
  emit("change", periodId);
};
</script>

<template>
  <div class="tab-switch">
    <button
      v-for="period in periods"
      :key="period.id"
      type="button"
      class="tab-button"
      :class="{ active: period.id === activePeriod }"
      @click="handlePeriodChange(period.id)"
    >
      {{ period.label }}
    </button>
  </div>
</template>

<style scoped>
.tab-switch {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.3rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.tab-button {
  flex: 1;
  min-width: 120px;
  padding: clamp(0.6rem, 2.4vw, 0.75rem) clamp(0.9rem, 4vw, 1.1rem);
  border-radius: 12px;
  border: none;
  font-size: clamp(0.875rem, 3.6vw, 1rem);
  font-weight: 600;
  letter-spacing: 0.03em;
  color: rgba(255, 255, 255, 0.5);
  background: transparent;
  transition: color 0.2s ease, background 0.2s ease, transform 0.15s ease;
}

.tab-button.active {
  color: #310802;
  background: linear-gradient(
    160deg,
    var(--accent-strong) 0%,
    var(--accent-strong-dark) 100%
  );
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3), 0 0 12px var(--accent-soft);
}

.tab-button:not(.active):hover {
  color: rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.08);
}

.tab-button:focus-visible {
  outline: 2px solid var(--accent-soft);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .tab-button {
    min-width: 110px;
  }
}

@media (max-width: 720px) {
  .tab-button {
    min-width: 104px;
  }
}
</style>
