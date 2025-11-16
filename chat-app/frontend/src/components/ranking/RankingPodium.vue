<script setup lang="ts">
// Types

import PodiumCard from "./PodiumCard.vue";

defineProps({
  podiumByRank: {
    type: Object,
    required: true,
  },
  formatScore: {
    type: Function,
    required: true,
  },
  isReady: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["navigate"]);

const handleNavigate = (entry) => {
  emit("navigate", entry);
};
</script>

<template>
  <section v-if="isReady" class="podium-section">
    <PodiumCard
      v-if="podiumByRank.second"
      :rank="2"
      :entry="podiumByRank.second"
      :format-score="formatScore"
      @navigate="handleNavigate(podiumByRank.second)"
    />

    <PodiumCard
      v-if="podiumByRank.first"
      :rank="1"
      :entry="podiumByRank.first"
      :format-score="formatScore"
      @navigate="handleNavigate(podiumByRank.first)"
    />

    <PodiumCard
      v-if="podiumByRank.third"
      :rank="3"
      :entry="podiumByRank.third"
      :format-score="formatScore"
      @navigate="handleNavigate(podiumByRank.third)"
    />
  </section>

  <section v-else class="podium-placeholder" aria-hidden="true">
    <div class="placeholder-card"></div>
    <div class="placeholder-card primary"></div>
    <div class="placeholder-card"></div>
  </section>
</template>

<style scoped>
.podium-section,
.podium-placeholder {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: clamp(0.7rem, 3vw, 1.1rem);
  min-height: 240px;
}

.podium-placeholder {
  gap: 0.9rem;
}

.placeholder-card {
  flex: 1;
  max-width: 180px;
  height: 190px;
  border-radius: 20px;
  background: linear-gradient(
    170deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.03) 100%
  );
  animation: pulse 2s ease-in-out infinite;
}

.placeholder-card.primary {
  height: 240px;
  background: linear-gradient(
    170deg,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.05) 100%
  );
  animation-delay: 0.2s;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 900px) {
  .podium-section,
  .podium-placeholder {
    gap: 0.9rem;
  }
}
</style>
