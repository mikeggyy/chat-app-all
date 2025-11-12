<template>
  <article
    class="chat-thread"
    :class="{
      'chat-thread--active': swipeOffset < 0,
      'chat-thread--dragging': isDragging,
    }"
    role="listitem"
    @pointerdown="onSwipeStart"
    @pointermove="onSwipeMove"
    @pointerup="onSwipeEnd"
    @pointercancel="onSwipeCancel"
    @click="handleClick"
  >
    <!-- 對話內容 -->
    <div
      class="chat-thread__content"
      :style="{
        '--chat-thread-offset': `${swipeOffset}px`,
      }"
    >
      <div class="chat-thread__avatar">
        <img :src="thread.portrait" :alt="`${thread.displayName} 的頭像`" />
      </div>
      <div class="chat-thread__body">
        <header class="chat-thread__header">
          <h2>{{ thread.displayName }}</h2>
          <time :dateTime="thread.timeLabel">{{ thread.timeLabel }}</time>
        </header>
        <p class="chat-thread__preview">
          {{ truncatedPreview }}
        </p>
      </div>
    </div>

    <!-- 滑動操作按鈕 -->
    <div
      class="chat-thread__actions"
      :style="{
        transform: `translate3d(${SWIPE_ACTION_WIDTH + swipeOffset}px, 0, 0)`,
      }"
      aria-hidden="true"
    >
      <div class="chat-thread__actions-inner">
        <!-- 收藏按鈕 -->
        <button
          type="button"
          :class="[
            'chat-thread__action',
            'chat-thread__action--favorite',
            { 'is-active': thread.isFavorite },
          ]"
          aria-label="收藏對話"
          :aria-pressed="thread.isFavorite ? 'true' : 'false'"
          :aria-busy="isFavoriting || isDeleting ? 'true' : 'false'"
          :disabled="isFavoriting || isDeleting"
          @pointerdown.stop
          @click.stop="$emit('favorite', thread)"
        >
          <svg
            class="chat-thread__icon"
            viewBox="0 0 24 24"
            focusable="false"
            aria-hidden="true"
          >
            <path
              v-if="thread.isFavorite"
              d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"
              fill="currentColor"
            />
            <path
              v-else
              d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
        </button>

        <!-- 刪除按鈕（僅在非收藏標籤頁顯示） -->
        <button
          v-if="!isFavoriteTab"
          type="button"
          class="chat-thread__action chat-thread__action--delete"
          aria-label="隱藏對話"
          :aria-busy="isDeleting ? 'true' : 'false'"
          :disabled="isDeleting || isFavoriting"
          @pointerdown.stop
          @click.stop="$emit('delete', thread)"
        >
          <svg
            class="chat-thread__icon"
            viewBox="0 0 24 24"
            focusable="false"
            aria-hidden="true"
          >
            <path
              d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zm3.46-6.88a.75.75 0 0 1 1.06.02L12 13.59l1.48-1.45a.75.75 0 0 1 1.04 1.08L13.09 14.5l1.43 1.47a.75.75 0 0 1-1.08 1.04L12 15.56l-1.44 1.45a.75.75 0 0 1-1.07-1.05l1.44-1.47-1.39-1.35a.75.75 0 0 1-.02-1.02zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"
            />
          </svg>
        </button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  thread: {
    type: Object,
    required: true,
  },
  isFavoriteTab: {
    type: Boolean,
    default: false,
  },
  isFavoriting: {
    type: Boolean,
    default: false,
  },
  isDeleting: {
    type: Boolean,
    default: false,
  },
  shouldBlockClick: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['select', 'favorite', 'delete', 'swipe-start', 'swipe-move', 'swipe-end', 'swipe-cancel']);

// 滑動相關常量
const SWIPE_ACTION_WIDTH = 140;
const SWIPE_TRIGGER_THRESHOLD = 48;
const SWIPE_MAX_RIGHT_OFFSET = 22;

// 滑動狀態
const swipeOffset = ref(0);
const isDragging = ref(false);
const swipeStartX = ref(0);
const pointerId = ref(null);

// 截斷預覽文字
const truncatedPreview = computed(() => {
  const text = props.thread.lastMessage || '';
  const maxLength = 15;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
});

// 滑動手勢處理
const onSwipeStart = (event) => {
  isDragging.value = true;
  swipeStartX.value = event.clientX;
  pointerId.value = event.pointerId;

  if (event.currentTarget && typeof event.currentTarget.setPointerCapture === 'function') {
    event.currentTarget.setPointerCapture(pointerId.value);
  }

  emit('swipe-start', props.thread.id);
};

const onSwipeMove = (event) => {
  if (!isDragging.value) return;

  const delta = event.clientX - swipeStartX.value;
  const clampedOffset = Math.min(Math.max(delta, -SWIPE_ACTION_WIDTH), SWIPE_MAX_RIGHT_OFFSET);
  swipeOffset.value = clampedOffset;

  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  emit('swipe-move', props.thread.id, clampedOffset);
};

const onSwipeEnd = (event) => {
  if (!isDragging.value) return;

  const delta = event.clientX - swipeStartX.value;
  const shouldOpen = delta < -SWIPE_TRIGGER_THRESHOLD || swipeOffset.value <= -SWIPE_TRIGGER_THRESHOLD;
  swipeOffset.value = shouldOpen ? -SWIPE_ACTION_WIDTH : 0;

  if (event.currentTarget && typeof event.currentTarget.releasePointerCapture === 'function' && pointerId.value !== null) {
    event.currentTarget.releasePointerCapture(pointerId.value);
  }

  isDragging.value = false;
  pointerId.value = null;

  emit('swipe-end', props.thread.id, shouldOpen);
};

const onSwipeCancel = (event) => {
  swipeOffset.value = 0;
  isDragging.value = false;

  if (event.currentTarget && typeof event.currentTarget.releasePointerCapture === 'function' && pointerId.value !== null) {
    event.currentTarget.releasePointerCapture(pointerId.value);
  }

  pointerId.value = null;
  emit('swipe-cancel', props.thread.id);
};

const handleClick = () => {
  if (props.shouldBlockClick || Math.abs(swipeOffset.value) > 6) {
    return;
  }
  emit('select', props.thread);
};

// 暴露方法供父組件調用
defineExpose({
  closeSwipe: () => {
    swipeOffset.value = 0;
    isDragging.value = false;
  },
});
</script>

<style scoped>
.chat-thread {
  position: relative;
  display: flex;
  align-items: stretch;
  background: var(--bg-primary, #ffffff);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  cursor: pointer;
  user-select: none;
  touch-action: pan-y;
  transition: background-color 0.2s ease;
}

.chat-thread:hover {
  background: var(--bg-hover, #f9fafb);
}

.chat-thread--dragging {
  transition: none;
}

.chat-thread--active {
  background: var(--bg-hover, #f9fafb);
}

.chat-thread__content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  padding: 1rem;
  transform: translate3d(var(--chat-thread-offset, 0), 0, 0);
  transition: transform 0.3s ease-out;
  will-change: transform;
}

.chat-thread--dragging .chat-thread__content {
  transition: none;
}

.chat-thread__avatar {
  flex-shrink: 0;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-secondary, #f3f4f6);
}

.chat-thread__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-thread__body {
  flex: 1;
  min-width: 0;
}

.chat-thread__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.chat-thread__header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-thread__header time {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--text-tertiary, #9ca3af);
}

.chat-thread__preview {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-thread__actions {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 140px;
  pointer-events: none;
  will-change: transform;
}

.chat-thread__actions-inner {
  display: flex;
  height: 100%;
  pointer-events: auto;
}

.chat-thread__action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.chat-thread__action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-thread__action--favorite {
  background: var(--favorite-bg, #fef3c7);
  color: var(--favorite-color, #d97706);
}

.chat-thread__action--favorite.is-active {
  background: var(--favorite-active-bg, #fbbf24);
  color: var(--favorite-active-color, #ffffff);
}

.chat-thread__action--delete {
  background: var(--delete-bg, #fee2e2);
  color: var(--delete-color, #dc2626);
}

.chat-thread__icon {
  width: 1.5rem;
  height: 1.5rem;
}
</style>
