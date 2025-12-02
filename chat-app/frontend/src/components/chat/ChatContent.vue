<script setup lang="ts">
import { ref, defineExpose } from 'vue';
import MessageList from './MessageList.vue';
import MessageInput from './MessageInput.vue';
import UnlockFab from './UnlockFab.vue';

// Types
interface Props {
  // MessageList props
  messages: any[];
  partnerName: string;
  partnerBackground?: string;
  isReplying?: boolean;
  playingVoiceMessageId?: string;

  // MessageInput props
  draft?: string;
  disabled?: boolean;
  suggestions?: any[];
  isLoadingSuggestions?: boolean;
  suggestionError?: string;
  isSendingGift?: boolean;
  isRequestingSelfie?: boolean;
  isRequestingVideo?: boolean;
  photoRemaining?: number;

  // UnlockFab props
  isCharacterUnlocked?: boolean;
  hasCharacterTickets?: boolean;
  characterTickets?: number;
}

// Props
withDefaults(defineProps<Props>(), {
  partnerBackground: '',
  isReplying: false,
  playingVoiceMessageId: undefined,
  draft: '',
  disabled: false,
  suggestions: () => [],
  isLoadingSuggestions: false,
  suggestionError: undefined,
  isSendingGift: false,
  isRequestingSelfie: false,
  isRequestingVideo: false,
  photoRemaining: 0,
  isCharacterUnlocked: false,
  hasCharacterTickets: false,
  characterTickets: 0,
});

// Emits
interface Emits {
  (e: 'play-voice', message: any): void;
  (e: 'image-click', message: any): void;
  (e: 'update:draft', value: string): void;
  (e: 'send', value: string): void;
  (e: 'suggestion-click', suggestion: string): void;
  (e: 'request-suggestions'): void;
  (e: 'gift-click'): void;
  (e: 'selfie-click'): void;
  (e: 'video-click'): void;
  (e: 'unlock-action'): void;
}

const emit = defineEmits<Emits>();

// Refs
const messageListRef = ref<{ messageListRef?: any } | null>(null);
const messageInputRef = ref<any>(null);

// Expose refs for parent access
defineExpose({
  messageListRef,
  messageInputRef,
});
</script>

<template>
  <div class="chat-content">
    <!-- Message List -->
    <MessageList
      ref="messageListRef"
      :messages="messages"
      :partner-name="partnerName"
      :partner-background="partnerBackground"
      :is-replying="isReplying"
      :playing-voice-message-id="playingVoiceMessageId"
      @play-voice="emit('play-voice', $event)"
      @image-click="emit('image-click', $event)"
    />

    <!-- Message Input -->
    <MessageInput
      ref="messageInputRef"
      :model-value="draft"
      :disabled="disabled"
      :suggestions="suggestions"
      :is-loading-suggestions="isLoadingSuggestions"
      :suggestion-error="suggestionError"
      :is-sending-gift="isSendingGift"
      :is-requesting-selfie="isRequestingSelfie"
      :is-requesting-video="isRequestingVideo"
      :photo-remaining="photoRemaining"
      @update:model-value="emit('update:draft', $event)"
      @send="emit('send', $event)"
      @suggestion-click="emit('suggestion-click', $event)"
      @request-suggestions="emit('request-suggestions')"
      @gift-click="emit('gift-click')"
      @selfie-click="emit('selfie-click')"
      @video-click="emit('video-click')"
    />

    <!-- 快速解鎖角色懸浮按鈕 -->
    <UnlockFab
      :is-character-unlocked="isCharacterUnlocked"
      :has-character-tickets="hasCharacterTickets"
      :character-tickets="characterTickets"
      @unlock-action="emit('unlock-action')"
    />
  </div>
</template>

<style scoped lang="scss">
.chat-content {
  display: contents;

  // 桌面版：改用 flex 佈局確保輸入框在底部
  @media (min-width: 1024px) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
}
</style>
