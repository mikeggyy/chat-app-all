<script setup lang="ts">
// Types

import { ArrowRightIcon, HeartIcon } from "@heroicons/vue/24/solid";
import CharacterCard from "./CharacterCard.vue";

const props = defineProps({
  conversations: {
    type: Array,
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  showEmpty: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["open-panel", "character-click"]);

const handleViewRecords = () => {
  emit("open-panel", "reconnect");
};

const handleCharacterClick = (profile) => {
  emit("character-click", profile);
};
</script>

<template>
  <section class="recent-section">
    <header class="section-header compact">
      <div class="section-title">
        <div class="section-icon accent-rose">
          <HeartIcon aria-hidden="true" />
        </div>
        <div>
          <p class="section-kicker">最近互動</p>
          <h2>重新連線</h2>
        </div>
      </div>
      <button
        type="button"
        class="section-action"
        @click="handleViewRecords"
        aria-haspopup="dialog"
      >
        <span>查看記錄</span>
        <ArrowRightIcon class="icon" aria-hidden="true" />
      </button>
    </header>

    <!-- 加載中狀態 -->
    <div v-if="isLoading" class="recent-empty">
      <p>載入中...</p>
    </div>

    <!-- 空狀態提示 -->
    <div v-else-if="showEmpty" class="recent-empty">
      <p>目前無對話紀錄</p>
      <p class="recent-empty-hint">開始與角色聊天,這裡會顯示你的對話記錄</p>
    </div>

    <!-- 對話列表 -->
    <div v-else class="recent-scroll">
      <CharacterCard
        v-for="profile in conversations"
        :key="profile.id"
        :profile="profile"
        @click="handleCharacterClick"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.recent-section {
  background: rgba(15, 23, 42, 0.7);
  border-radius: 18px;
  padding: clamp(1.3rem, 4vw, 1.65rem);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.45);
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .recent-empty {
    padding: 2rem 1rem;
    text-align: center;
    color: rgba(226, 232, 240, 0.6);

    p {
      margin: 0 0 0.5rem;
      font-size: 0.95rem;
      color: rgba(226, 232, 240, 0.75);
    }

    .recent-empty-hint {
      font-size: 0.85rem;
      color: rgba(148, 163, 184, 0.6);
    }
  }

  .recent-scroll {
    display: flex;
    gap: 1rem;
    overflow-x: auto;
    padding-bottom: 0.4rem;
    margin: 0 -0.5rem 0 -0.5rem;
    padding-inline: 0.5rem;
    scroll-snap-type: x mandatory;
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.85rem;

  h2 {
    margin: 0;
    font-size: 1.3rem;
    color: #f8fafc;
    letter-spacing: 0.03em;
  }

  .section-kicker {
    margin: 0;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(226, 232, 240, 0.6);
  }
}

.section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(226, 232, 240, 0.08);

  svg {
    width: 20px;
    height: 20px;
  }

  &.accent-rose {
    background: linear-gradient(
      135deg,
      rgba(244, 114, 182, 0.3),
      rgba(236, 72, 153, 0.22)
    );
    border-color: rgba(244, 114, 182, 0.5);
    color: #fff1f2;
  }
}

.section-action {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(15, 23, 42, 0.4);
  color: rgba(226, 232, 240, 0.85);
  font-size: 0.82rem;
  font-weight: 600;
  transition: border-color 160ms ease, transform 160ms ease;

  .icon {
    width: 18px;
    height: 18px;
  }

  &:hover {
    border-color: rgba(148, 163, 184, 0.45);
    transform: translateX(2px);
  }
}

@media (max-width: 640px) {
  .section-action {
    align-self: flex-start;
  }
}
</style>
