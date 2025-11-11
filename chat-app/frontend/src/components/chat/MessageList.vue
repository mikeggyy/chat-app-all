<template>
  <main ref="messageListRef" class="chat-body" @scroll="handleScroll">
    <!-- 角色背景卡片 - 永久顯示 -->
    <article class="chat-profile">
      <span class="chat-profile__label">角色背景</span>
      <h2>{{ partnerName }}</h2>
      <p>{{ partnerBackground }}</p>
    </article>

    <!-- 加載更多舊消息指示器 -->
    <div v-if="isLoadingMore" class="loading-more-indicator">
      <div class="loading-spinner-small"></div>
      <span>載入更多訊息...</span>
    </div>

    <!-- 已加載全部消息提示 -->
    <div v-else-if="!hasMore && messages.length > initialMessageCount" class="all-loaded-indicator">
      <span>已載入全部訊息</span>
    </div>

    <!-- 消息列表 -->
    <section class="chat-thread">
      <Message
        v-for="message in visibleMessages"
        :key="message.id"
        v-memo="[message.id, message.text, message.imageUrl, message.video, playingVoiceMessageId === message.id]"
        :message="message"
        :is-playing="playingVoiceMessageId === message.id"
        @play-voice="$emit('play-voice', $event)"
        @image-click="$emit('image-click', $event)"
      />

      <!-- 打字指示器 -->
      <article
        v-if="isReplying"
        key="typing-indicator"
        class="chat-bubble chat-bubble--partner chat-bubble--typing"
        aria-live="polite"
      >
        <p class="chat-bubble__typing-text" aria-hidden="true">
          <span class="typing-dot-char">.</span>
          <span class="typing-dot-char">.</span>
          <span class="typing-dot-char">.</span>
        </p>
        <span class="visually-hidden">AI 正在輸入</span>
      </article>
    </section>
  </main>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from "vue";
import Message from "./Message.vue";
import { useChatVirtualScroll } from "../../composables/useChatVirtualScroll";

// Props
const props = defineProps({
  messages: {
    type: Array,
    required: true,
  },
  partnerName: {
    type: String,
    required: true,
  },
  partnerBackground: {
    type: String,
    default: "",
  },
  isReplying: {
    type: Boolean,
    default: false,
  },
  playingVoiceMessageId: {
    type: String,
    default: null,
  },
});

// Emits
const emit = defineEmits(["play-voice", "image-click"]);

// 虛擬滾動配置
const initialMessageCount = 50; // 初始顯示 50 條消息
const {
  displayedCount,
  isLoadingMore,
  containerRef: messageListRef,
  getVisibleMessages,
  handleScroll: handleVirtualScroll,
  hasMore: hasMoreMessages,
  reset: resetVirtualScroll,
} = useChatVirtualScroll({
  initialCount: initialMessageCount,
  incrementCount: 30,
  scrollThreshold: 300,
});

/**
 * 計算可見的消息（使用虛擬滾動）
 */
const visibleMessages = computed(() => {
  return getVisibleMessages(props.messages);
});

/**
 * 檢查是否還有更多舊消息可以加載
 */
const hasMore = computed(() => {
  return hasMoreMessages(props.messages.length);
});

/**
 * 處理滾動事件
 */
const handleScroll = (event) => {
  handleVirtualScroll(event, props.messages.length);
};

/**
 * 滾動到底部
 */
const scrollToBottom = (smooth = true) => {
  nextTick(() => {
    if (messageListRef.value) {
      const scrollOptions = {
        top: messageListRef.value.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      };
      messageListRef.value.scrollTo(scrollOptions);
    }
  });
};

/**
 * 監聽消息變化，自動滾動
 */
watch(
  () => props.messages.length,
  (newLength, oldLength) => {
    // 只有新增消息時才滾動
    if (newLength > oldLength) {
      scrollToBottom();
    }
  },
  { flush: "post" }
);

/**
 * 監聽回覆狀態
 */
watch(
  () => props.isReplying,
  (isReplying) => {
    if (isReplying) {
      scrollToBottom();
    }
  },
  { flush: "post" }
);

/**
 * 組件掛載時滾動到底部
 */
onMounted(() => {
  // 首次載入時不使用動畫
  scrollToBottom(false);
});

// 暴露方法給父組件
defineExpose({
  scrollToBottom,
  resetVirtualScroll,
});
</script>

<style scoped lang="scss">
.chat-body {
  min-height: 0;
  overflow-y: auto;
  padding: 0 1.5rem 8rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 18rem;
  /* 自定義滾動條 */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(15, 23, 42, 0.3);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.4);
    border-radius: 4px;

    &:hover {
      background: rgba(148, 163, 184, 0.6);
    }
  }
}

.chat-profile {
  margin-top: -3vw;
  border-radius: 24px;
  padding: 1.35rem 1.6rem;
  background: rgba(15, 23, 42, 0.68);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  h2 {
    margin: 0;
    font-size: 1.08rem;
    letter-spacing: 0.12em;
    color: #f8fafc;
  }

  p {
    margin: 0;
    line-height: 1.7;
    color: rgba(226, 232, 240, 0.88);
  }
}

.chat-profile__label {
  font-size: 0.72rem;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.55);
}

/* 加載更多指示器 */
.loading-more-indicator,
.all-loaded-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  margin: 0.5rem 0;
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.65);
  text-align: center;
}

.loading-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(148, 163, 184, 0.3);
  border-top-color: rgba(148, 163, 184, 0.8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.all-loaded-indicator {
  opacity: 0.5;
}

.chat-thread {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;

  /* 性能優化：使用 contain 提示瀏覽器 */
  contain: layout style paint;
}

/* 打字指示器樣式 */
.chat-bubble--typing {
  max-width: 85%;
  padding: 0.7rem 0.9rem;
  border-radius: 22px;
  font-size: 0.98rem;
  line-height: 1.6;
  position: relative;
  color: #f8fafc;
  background: rgba(148, 163, 184, 0.2);
  border: 1px solid rgba(148, 163, 184, 0.3);
  align-self: flex-start;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(8px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
}

.chat-bubble__typing-text {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.typing-dot-char {
  display: inline-block;
  animation: typing-dot-fade 1.1s ease-in-out infinite;

  &:nth-child(2) {
    animation-delay: 0.18s;
  }

  &:nth-child(3) {
    animation-delay: 0.36s;
  }
}

@keyframes typing-dot-fade {
  0%,
  80%,
  100% {
    opacity: 0.2;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

@media (max-width: 540px) {
  .chat-profile {
    margin-top: 1.25rem;
    padding: 1.15rem 1.35rem;
    gap: 0.65rem;

    h2 {
      font-size: 1.02rem;
    }
  }
}
</style>
