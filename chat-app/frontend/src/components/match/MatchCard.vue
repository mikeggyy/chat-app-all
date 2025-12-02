<template>
  <section
    class="content"
    :class="{ 'is-active': isActive }"
  >
    <header>
      <div v-if="match?.display_name" class="header-title">
        <h1>{{ match.display_name }}</h1>
        <button
          v-if="isActive"
          type="button"
          class="btn-favorite-icon"
          :class="{ 'is-favorited': isFavorited }"
          @click="$emit('toggle-favorite')"
          :disabled="favoriteMutating"
          :aria-label="isFavorited ? '取消收藏' : '加入收藏'"
        >
          <HeartSolid
            v-if="isFavorited"
            class="icon"
            aria-hidden="true"
          />
          <HeartOutline v-else class="icon" aria-hidden="true" />
        </button>
      </div>
      <p v-if="isActive && error" class="error-banner">
        {{ error }}
      </p>
    </header>

    <section v-if="match?.background" class="bio-card">
      <div class="bio-card-header">
        <h2>角色背景</h2>
        <button
          type="button"
          class="bio-info-btn"
          aria-label="檢視完整角色背景"
          @click.stop="$emit('open-background', match.display_name, match.background)"
        >
          <InformationCircleIcon class="icon" aria-hidden="true" />
        </button>
      </div>
      <p>{{ formatBackground(match.background) }}</p>
    </section>

    <div v-if="isActive" class="actions single">
      <button
        type="button"
        class="btn primary"
        @click="$emit('enter-chat')"
        :disabled="isLoading"
      >
        <ChatBubbleBottomCenterTextIcon class="icon" aria-hidden="true" />
        <span>{{ isLoading ? '尋找配對中…' : '進入聊天室' }}</span>
      </button>
      <p v-if="favoriteError" class="action-error">
        {{ favoriteError }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
// Types

import {
  ChatBubbleBottomCenterTextIcon,
  InformationCircleIcon,
  HeartIcon as HeartOutline,
} from '@heroicons/vue/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/vue/24/solid';

/**
 * MatchCard - 配對角色卡片組件
 * 職責：顯示單個角色的信息卡片
 */

const BIO_MAX_LENGTH = 50;

// Props
defineProps({
  match: {
    type: Object,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  isFavorited: {
    type: Boolean,
    default: false,
  },
  favoriteMutating: {
    type: Boolean,
    default: false,
  },
  favoriteError: {
    type: String,
    default: null,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: null,
  },
});

// Emits
defineEmits(['toggle-favorite', 'open-background', 'enter-chat']);

/**
 * 格式化背景文字（截斷長文本）
 */
const formatBackground = (text: string | undefined | null): string => {
  if (typeof text !== 'string') return '';
  const normalized = text.trim();
  if (normalized.length <= BIO_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, BIO_MAX_LENGTH)}...`;
};
</script>

<style scoped lang="scss">
.content {
  position: relative;
  z-index: 1;
  flex: 0 0 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  opacity: 0.4;
  transition: opacity 0.22s ease;
  padding: 2rem 1.5rem 3rem;

  &.is-active {
    opacity: 1;
  }

  header {
    .header-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    h1 {
      font-size: 2.8rem;
      margin: 0;
      font-weight: 600;
    }
  }

  .error-banner {
    margin-top: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    background: rgba(248, 113, 113, 0.2);
    border: 1px solid rgba(248, 113, 113, 0.4);
    color: #fecaca;
    font-size: 0.95rem;
    max-width: 360px;
  }

  .action-error {
    grid-column: 1 / -1;
    margin: 0.35rem 0 0;
    font-size: 0.85rem;
    letter-spacing: 0.05em;
    color: #fecaca;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;

    &.single {
      grid-template-columns: 1fr;
      max-width: 360px;

      // 桌面版：置中按鈕
      @media (min-width: 1024px) {
        margin: 0 auto;
      }
    }
  }

  .bio-card {
    background: rgba(15, 23, 42, 0.65);
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 24px;
    padding: 1.5rem 1.75rem;
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.35);
    backdrop-filter: blur(20px);
    color: #e2e8f0;

    .bio-card-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 0.75rem;

      h2 {
        margin: 0;
        font-size: 1.25rem;
        letter-spacing: 0.08em;
      }
    }

    .bio-info-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.5);
      background: rgba(15, 23, 42, 0.4);
      color: #e2e8f0;
      padding: 0;
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease,
        transform 150ms ease;

      &:hover {
        background: rgba(148, 163, 184, 0.25);
        border-color: rgba(226, 232, 240, 0.7);
        transform: translateY(-1px);
      }

      .icon {
        width: 18px;
        height: 18px;
      }
    }

    p {
      margin: 0;
      line-height: 1.7;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      max-height: calc(1.7em * 2);
    }
  }

  @media (max-width: 540px) {
    gap: 1.75rem;

    header {
      .header-title {
        gap: 0.5rem;
      }

      h1 {
        font-size: 2.2rem;
      }
    }

    .actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));

      &.single {
        max-width: none;
      }
    }

    .bio-card {
      padding: 1.25rem 1.5rem;

      .bio-info-btn {
        width: 32px;
        height: 32px;
      }
    }
  }
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
  border-radius: 999px;
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
  will-change: transform;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  &:not(:disabled):hover {
    transform: translateY(-2px);
  }

  &.primary {
    background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
    color: #fff;
    box-shadow: 0 12px 28px rgba(255, 77, 143, 0.35);

    &:not(:disabled):hover {
      box-shadow: 0 16px 36px rgba(255, 77, 143, 0.45);
    }
  }

  @media (max-width: 540px) {
    font-size: 0.95rem;
  }
}

.icon {
  width: 20px;
  height: 20px;
}

.btn-favorite-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: none;
  background: rgba(248, 250, 252, 0.15);
  color: #f8fafc;
  padding: 0;
  cursor: pointer;
  transition: transform 150ms ease, background 150ms ease, color 150ms ease;
  flex-shrink: 0;

  // 已收藏狀態 - 粉紅色
  &.is-favorited {
    color: #ec4899;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  &:not(:disabled):hover {
    transform: translateY(-2px);
    background: rgba(248, 250, 252, 0.25);
  }

  .icon {
    width: 22px;
    height: 22px;
  }

  @media (max-width: 540px) {
    width: 38px;
    height: 38px;

    .icon {
      width: 20px;
      height: 20px;
    }
  }
}
</style>
