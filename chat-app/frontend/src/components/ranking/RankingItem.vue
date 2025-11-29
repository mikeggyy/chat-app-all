<script setup lang="ts">
import { ChatBubbleLeftRightIcon } from "@heroicons/vue/24/solid";
import LazyImage from "../common/LazyImage.vue";

interface RankingEntry {
  id: string;
  name: string;
  avatar: string;
  score: number;
  rank: number;
  subtitle?: string;
  handle?: string;
  title?: string;
}

interface Props {
  entry: RankingEntry;
  formatScore: (score: number) => string;
}

defineProps<Props>();

const emit = defineEmits<{
  navigate: [];
}>();

const handleNavigate = () => {
  emit("navigate");
};

const handleActionClick = (event: MouseEvent) => {
  event.stopPropagation();
  emit("navigate");
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("navigate");
  }
};
</script>

<template>
  <li
    class="ranking-item"
    role="button"
    tabindex="0"
    :aria-label="`查看 ${entry?.name || '角色'} 的聊天室`"
    @click="handleNavigate"
    @keydown="handleKeydown"
  >
    <div class="rank-badge">
      <span>{{ entry.rank }}</span>
    </div>
    <div class="item-avatar">
      <LazyImage
        :src="entry.avatar"
        :alt="`${entry.name} 頭像`"
        :root-margin="'50px'"
        :threshold="0"
        image-class="ranking-avatar"
      />
    </div>
    <div class="item-body">
      <p class="item-name">{{ entry.name }}</p>
      <p class="item-handle">
        {{ entry.subtitle || entry.handle || entry.title }}
      </p>
    </div>
    <div class="item-score">{{ formatScore(entry.score) }}</div>
    <button
      class="item-action"
      type="button"
      :aria-label="`前往與 ${entry?.name || '角色'} 的對話`"
      @click="handleActionClick"
    >
      <ChatBubbleLeftRightIcon aria-hidden="true" />
    </button>
  </li>
</template>

<style scoped>
.ranking-item {
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  align-items: center;
  gap: clamp(0.7rem, 3vw, 1rem);
  padding: clamp(0.9rem, 3vw, 1.1rem) clamp(0.9rem, 4vw, 1.3rem);
  border-radius: 16px;
  background: linear-gradient(
    170deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.03) 100%
  );
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.ranking-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
}

.ranking-item:focus-visible {
  outline: 2px solid var(--accent-soft);
  outline-offset: 2px;
}

.rank-badge {
  grid-column: 1;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

.item-avatar {
  grid-column: 2;
  width: clamp(54px, 16vw, 62px);
  height: clamp(54px, 16vw, 62px);
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4);
}

.item-avatar :deep(.ranking-avatar) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.item-body {
  grid-column: 3;
  min-width: 0;
}

.item-name {
  font-size: clamp(0.92rem, 3.6vw, 1.05rem);
  font-weight: 700;
  color: var(--text-primary);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  margin: 0 0 0.2rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-handle {
  font-size: 0.72rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-score {
  grid-column: 4;
  justify-self: end;
  font-weight: 700;
  font-size: clamp(1rem, 3vw, 1.2rem);
  color: var(--accent-strong);
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.6);
}

.item-action {
  grid-column: -1;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #310802;
  background: linear-gradient(
    160deg,
    var(--accent-strong) 0%,
    var(--accent-strong-dark) 100%
  );
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4), 0 0 16px var(--accent-soft);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.item-action:hover,
.item-action:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.5), 0 0 20px var(--accent-soft);
  outline: none;
}

.item-action svg {
  width: 22px;
  height: 22px;
}

@media (max-width: 520px) {
  .rank-badge {
    font-size: 1.3rem;
  }

  .item-avatar {
    width: clamp(50px, 22vw, 56px);
  }
}
</style>
