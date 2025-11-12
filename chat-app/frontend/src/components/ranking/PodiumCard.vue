<script setup>
import LazyImage from "../common/LazyImage.vue";

defineProps({
  rank: {
    type: Number,
    required: true,
    validator: (value) => [1, 2, 3].includes(value),
  },
  entry: {
    type: Object,
    required: true,
  },
  formatScore: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["navigate"]);

const handleClick = () => {
  emit("navigate");
};

const handleKeydown = (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("navigate");
  }
};
</script>

<template>
  <article
    class="podium-card"
    :class="{
      'podium-first': rank === 1,
      'podium-second': rank === 2,
      'podium-third': rank === 3,
    }"
    role="button"
    tabindex="0"
    :aria-label="`查看 ${entry?.name || '角色'} 的聊天室`"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <div class="podium-rank">{{ rank }}</div>
    <div class="avatar-wrap">
      <LazyImage
        :src="entry.avatar"
        :alt="`${entry.name} 頭像`"
        :root-margin="'200px'"
        :threshold="0"
        image-class="podium-avatar"
      />
    </div>
    <p class="podium-name">{{ entry.name }}</p>
    <p class="podium-handle">
      {{ entry.subtitle || entry.handle || entry.title }}
    </p>
    <p class="podium-score">
      {{ formatScore(entry.score) }}
    </p>
  </article>
</template>

<style scoped>
.podium-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: clamp(1.2rem, 5vw, 1.6rem) clamp(0.8rem, 3vw, 1.1rem)
    clamp(1rem, 4vw, 1.3rem);
  border-radius: 20px;
  background: linear-gradient(
    170deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.04) 100%
  );
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 255, 255, 0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  cursor: pointer;
}

.podium-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 28px rgba(255, 255, 255, 0.12);
}

.podium-card:focus-visible {
  outline: 3px solid var(--accent-soft);
  outline-offset: 3px;
}

.podium-first {
  order: 2;
  min-height: 240px;
  background: linear-gradient(
    170deg,
    rgba(255, 215, 0, 0.25) 0%,
    rgba(255, 215, 0, 0.06) 100%
  );
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.5), 0 0 28px rgba(255, 215, 0, 0.3);
}

.podium-first:hover {
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6), 0 0 36px rgba(255, 215, 0, 0.4);
}

.podium-second {
  order: 1;
  min-height: 210px;
}

.podium-third {
  order: 3;
  min-height: 190px;
}

.podium-rank {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 800;
  color: #310802;
  background: linear-gradient(
    160deg,
    var(--accent-strong) 0%,
    var(--accent-strong-dark) 100%
  );
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4), 0 0 14px var(--accent-soft);
}

.avatar-wrap {
  width: clamp(72px, 22vw, 90px);
  height: clamp(72px, 22vw, 90px);
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4), 0 0 14px var(--accent-soft);
  margin-bottom: 0.8rem;
}

.avatar-wrap :deep(.podium-avatar) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.podium-name {
  font-size: clamp(0.95rem, 3.6vw, 1.15rem);
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  text-shadow: 0 3px 10px rgba(0, 0, 0, 0.6);
  margin: 0 0 0.25rem;
}

.podium-handle {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
  margin: 0 0 0.6rem;
}

.podium-score {
  font-size: clamp(1rem, 4vw, 1.2rem);
  font-weight: 800;
  color: var(--accent-strong);
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.6);
  margin: 0;
}
</style>
