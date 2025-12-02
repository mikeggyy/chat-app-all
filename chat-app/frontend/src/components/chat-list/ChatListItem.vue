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
        <LazyImage
          :src="thread.portrait"
          :alt="`${thread.displayName} 的頭像`"
          :root-margin="'100px'"
          :threshold="0"
          image-class="chat-avatar"
        />
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
          :tabindex="swipeOffset < 0 ? 0 : -1"
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
          :tabindex="swipeOffset < 0 ? 0 : -1"
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
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, computed, type ComputedRef, type Ref } from "vue";
import LazyImage from "../common/LazyImage.vue";

// Types
interface Thread {
  id: string;
  displayName: string;
  portrait: string;
  timeLabel: string;
  lastMessage?: string;
  isFavorite: boolean;
  [key: string]: any;
}

interface Props {
  thread: Thread;
  isFavoriteTab?: boolean;
  isFavoriting?: boolean;
  isDeleting?: boolean;
  shouldBlockClick?: boolean;
}

interface Emits {
  (e: "select", thread: Thread): void;
  (e: "favorite", thread: Thread): void;
  (e: "delete", thread: Thread): void;
  (e: "swipe-start", threadId: string): void;
  (e: "swipe-move", threadId: string, offset: number): void;
  (e: "swipe-end", threadId: string, shouldOpen: boolean): void;
  (e: "swipe-cancel", threadId: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  isFavoriteTab: false,
  isFavoriting: false,
  isDeleting: false,
  shouldBlockClick: false,
});

const emit = defineEmits<Emits>();

// 滑動相關常量
const SWIPE_ACTION_WIDTH: number = 140;
const SWIPE_TRIGGER_THRESHOLD: number = 48;
const SWIPE_MAX_RIGHT_OFFSET: number = 22;

// 滑動狀態
const swipeOffset: Ref<number> = ref(0);
const isDragging: Ref<boolean> = ref(false);
const swipeStartX: Ref<number> = ref(0);
const pointerId: Ref<number | null> = ref(null);

// 截斷預覽文字
const truncatedPreview: ComputedRef<string> = computed(() => {
  const text = props.thread.lastMessage || "";
  const maxLength = 15;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
});

// 滑動手勢處理
const onSwipeStart = (event: PointerEvent): void => {
  isDragging.value = true;
  swipeStartX.value = event.clientX;
  pointerId.value = event.pointerId;

  const target = event.currentTarget as Element | null;
  if (target && typeof target.setPointerCapture === "function") {
    target.setPointerCapture(pointerId.value);
  }

  emit("swipe-start", props.thread.id);
};

const onSwipeMove = (event: PointerEvent): void => {
  if (!isDragging.value) return;

  const delta = event.clientX - swipeStartX.value;
  const clampedOffset = Math.min(
    Math.max(delta, -SWIPE_ACTION_WIDTH),
    SWIPE_MAX_RIGHT_OFFSET
  );
  swipeOffset.value = clampedOffset;

  if (typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  emit("swipe-move", props.thread.id, clampedOffset);
};

const onSwipeEnd = (event: PointerEvent): void => {
  if (!isDragging.value) return;

  const delta = event.clientX - swipeStartX.value;
  const shouldOpen =
    delta < -SWIPE_TRIGGER_THRESHOLD ||
    swipeOffset.value <= -SWIPE_TRIGGER_THRESHOLD;
  swipeOffset.value = shouldOpen ? -SWIPE_ACTION_WIDTH : 0;

  const target = event.currentTarget as HTMLElement | null;
  if (
    target &&
    typeof target.releasePointerCapture === "function" &&
    pointerId.value !== null
  ) {
    target.releasePointerCapture(pointerId.value);
  }

  isDragging.value = false;
  pointerId.value = null;

  emit("swipe-end", props.thread.id, shouldOpen);
};

const onSwipeCancel = (event: PointerEvent): void => {
  swipeOffset.value = 0;
  isDragging.value = false;

  const target = event.currentTarget as HTMLElement | null;
  if (
    target &&
    typeof target.releasePointerCapture === "function" &&
    pointerId.value !== null
  ) {
    target.releasePointerCapture(pointerId.value);
  }

  pointerId.value = null;
  emit("swipe-cancel", props.thread.id);
};

const handleClick = (): void => {
  if (props.shouldBlockClick || Math.abs(swipeOffset.value) > 6) {
    return;
  }
  emit("select", props.thread);
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
  background: rgba(15, 23, 42, 0.5);
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  cursor: pointer;
  user-select: none;
  touch-action: pan-y;
  transition: background-color 0.2s ease;
}

.chat-thread:hover {
  background: rgba(30, 41, 59, 0.6);
}

.chat-thread--dragging {
  transition: none;
}

.chat-thread--active {
  background: rgba(30, 41, 59, 0.6);
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
  background: rgba(51, 65, 85, 0.5);
}

.chat-thread__avatar .lazy-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.chat-thread__avatar img,
.chat-thread__avatar .chat-avatar {
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
  color: #f8fafc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-thread__header time {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.7);
}

.chat-thread__preview {
  margin: 0;
  font-size: 0.875rem;
  color: rgba(226, 232, 240, 0.7);
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
  background: rgba(15, 23, 42, 0.5);
  color: #f8fafc;
}

.chat-thread__action--favorite.is-active {
  background: rgba(15, 23, 42, 0.5);
  color: #ec4899;
}

.chat-thread__action--delete {
  background: rgba(15, 23, 42, 0.5);
  color: #ef4444;
}

.chat-thread__icon {
  width: 1.5rem;
  height: 1.5rem;
}

/* 桌面版樣式優化 - 大膽設計 */
@media (min-width: 1024px) {
  .chat-thread {
    display: flex;
    align-items: center;
    background: transparent;
    border-bottom: 1px solid rgba(148, 163, 184, 0.06);
    border-radius: 0;
    transition: all 0.25s ease;
  }

  .chat-thread:first-child {
    border-radius: 20px 20px 0 0;
  }

  .chat-thread:last-child {
    border-radius: 0 0 20px 20px;
    border-bottom: none;
  }

  .chat-thread:only-child {
    border-radius: 20px;
  }

  .chat-thread:hover {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.08));
  }

  .chat-thread__content {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 1.25rem 1.5rem;
    gap: 1.25rem;
    transform: none !important;
  }

  .chat-thread__avatar {
    flex-shrink: 0;
    width: 4rem;
    height: 4rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .chat-thread__body {
    flex: 1;
    min-width: 0;
  }

  .chat-thread__header {
    margin-bottom: 0.25rem;
  }

  .chat-thread__header h2 {
    font-size: 1.0625rem;
    font-weight: 600;
  }

  .chat-thread__header time {
    font-size: 0.8125rem;
    color: rgba(148, 163, 184, 0.8);
  }

  .chat-thread__preview {
    font-size: 0.9375rem;
    color: rgba(226, 232, 240, 0.65);
    line-height: 1.4;
  }

  /* 桌面版：直接顯示操作按鈕，與內容對齊 */
  .chat-thread__actions {
    position: static;
    flex-shrink: 0;
    width: auto;
    height: auto;
    display: flex;
    align-items: center;
    padding: 0 1.5rem 0 0.5rem;
    transform: none !important;
  }

  .chat-thread__actions-inner {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .chat-thread__action {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border-radius: 10px;
    background: rgba(51, 65, 85, 0.4);
    transition: all 0.2s ease;
  }

  .chat-thread__action:hover:not(:disabled) {
    transform: scale(1.05);
    background: rgba(71, 85, 105, 0.6);
  }

  .chat-thread__action--favorite {
    color: rgba(226, 232, 240, 0.6);
  }

  .chat-thread__action--favorite:hover:not(:disabled) {
    background: rgba(236, 72, 153, 0.2);
    color: #f472b6;
  }

  .chat-thread__action--favorite.is-active {
    background: rgba(236, 72, 153, 0.25);
    color: #f472b6;
  }

  .chat-thread__action--delete {
    color: rgba(226, 232, 240, 0.6);
  }

  .chat-thread__action--delete:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .chat-thread__icon {
    width: 1.25rem;
    height: 1.25rem;
  }
}

/* 寬螢幕進一步放大 */
@media (min-width: 1440px) {
  .chat-thread__content {
    padding: 1.5rem 2rem;
    gap: 1.5rem;
  }

  .chat-thread__avatar {
    width: 4.5rem;
    height: 4.5rem;
  }

  .chat-thread__header h2 {
    font-size: 1.125rem;
  }

  .chat-thread__preview {
    font-size: 1rem;
  }

  .chat-thread__actions {
    padding: 0 2rem 0 1rem;
    gap: 0.75rem;
  }

  .chat-thread__action {
    width: 44px;
    height: 44px;
  }
}
</style>
