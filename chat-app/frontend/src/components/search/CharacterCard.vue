<script setup lang="ts">
import { HeartIcon, ChatBubbleLeftRightIcon } from "@heroicons/vue/24/solid";
import LazyImage from '@/components/common/LazyImage.vue';

interface CharacterProfile {
  id: string;
  name: string;
  image: string;
  favoritesCountFormatted?: string;
  messageCountFormatted?: string;
  author?: string;
  description?: string;
}

interface Props {
  profile: CharacterProfile;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  click: [profile: CharacterProfile];
}>();

const handleClick = () => {
  emit("click", props.profile);
};

const handleKeyup = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    handleClick();
  }
};
</script>

<template>
  <article
    class="recent-card"
    role="button"
    tabindex="0"
    :aria-label="`與 ${profile.name} 開啟對話`"
    @click="handleClick"
    @keyup.enter="handleKeyup"
  >
    <LazyImage
      :src="profile.image"
      :alt="profile.name"
      root-margin="150px"
      image-class="character-card-image"
    />
    <div class="recent-body">
      <h3>{{ profile.name }}</h3>
      <div class="recent-stats">
        <span class="stat-item">
          <HeartIcon class="stat-icon" aria-hidden="true" />
          {{ profile.favoritesCountFormatted }}
        </span>
        <span class="stat-item">
          <ChatBubbleLeftRightIcon class="stat-icon" aria-hidden="true" />
          {{ profile.messageCountFormatted }}
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.recent-card {
  flex: 0 0 140px;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  scroll-snap-align: start;
  background: rgba(2, 6, 23, 0.16);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  padding: 0.75rem;
  transition: transform 160ms ease, border-color 160ms ease,
    box-shadow 160ms ease;
  cursor: pointer;
  outline: none;

  &:hover {
    transform: translateY(-3px);
    border-color: rgba(59, 130, 246, 0.4);
  }

  &:focus-visible {
    border-color: rgba(236, 72, 153, 0.5);
    box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.25);
    transform: translateY(-2px);
  }

  // ✅ P1 優化（2025-01）：LazyImage 支援
  :deep(.lazy-image) {
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: 10px;
  }

  .character-card-image {
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    border-radius: 10px;
  }

  .recent-body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    h3 {
      margin: 0;
      font-size: 0.95rem;
      color: #f8fafc;
    }

    .recent-stats {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 0;

      .stat-item {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8rem;
        color: rgba(226, 232, 240, 0.7);

        .stat-icon {
          width: 13px;
          height: 13px;
          opacity: 0.65;
          flex-shrink: 0;
        }
      }
    }
  }

  /* ========================================
     桌面版樣式 (≥ 1024px)
     ======================================== */
  @media (min-width: 1024px) {
    flex: 0 0 160px;
    padding: 0.875rem;
    border-radius: 16px;

    &:hover {
      transform: translateY(-5px);
      box-shadow: 0 12px 28px rgba(59, 130, 246, 0.25);
    }

    :deep(.lazy-image) {
      border-radius: 12px;
    }

    .character-card-image {
      border-radius: 12px;
    }

    .recent-body {
      gap: 0.35rem;

      h3 {
        font-size: 1rem;
      }

      .recent-stats {
        gap: 0.85rem;

        .stat-item {
          font-size: 0.85rem;

          .stat-icon {
            width: 14px;
            height: 14px;
          }
        }
      }
    }
  }

  @media (min-width: 1440px) {
    flex: 0 0 180px;
    padding: 1rem;

    .recent-body h3 {
      font-size: 1.05rem;
    }
  }
}
</style>
