<script setup>
import { ref, defineExpose } from 'vue';
import MessageList from './MessageList.vue';
import MessageInput from './MessageInput.vue';
import UnlockFab from './UnlockFab.vue';

// Props
const props = defineProps({
  // MessageList props
  messages: { type: Array, required: true },
  partnerName: { type: String, required: true },
  partnerBackground: { type: String, default: '' },
  isReplying: { type: Boolean, default: false },
  playingVoiceMessageId: { type: String, default: null },

  // MessageInput props
  draft: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  suggestions: { type: Array, default: () => [] },
  isLoadingSuggestions: { type: Boolean, default: false },
  suggestionError: { type: String, default: null },
  isSendingGift: { type: Boolean, default: false },
  isRequestingSelfie: { type: Boolean, default: false },
  isRequestingVideo: { type: Boolean, default: false },
  photoRemaining: { type: Number, default: 0 },

  // UnlockFab props
  isCharacterUnlocked: { type: Boolean, default: false },
  hasCharacterTickets: { type: Boolean, default: false },
  characterTickets: { type: Number, default: 0 },
});

// Emits
const emit = defineEmits([
  // MessageList events
  'play-voice',
  'image-click',

  // MessageInput events
  'update:draft',
  'send',
  'suggestion-click',
  'request-suggestions',
  'gift-click',
  'selfie-click',
  'video-click',

  // UnlockFab events
  'unlock-action',
]);

// Refs
const messageListRef = ref(null);
const messageInputRef = ref(null);

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
}
</style>
