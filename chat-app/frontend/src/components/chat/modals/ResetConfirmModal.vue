<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline';

// Types
interface Props {
  isOpen: boolean;
  loading?: boolean;
}

interface Emits {
  (e: 'cancel'): void;
  (e: 'confirm'): void;
}

withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<Emits>();
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="chat-confirm-backdrop">
      <div class="chat-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-confirm-title">
        <header class="chat-confirm-header">
          <h2 id="reset-confirm-title">重置對話</h2>
          <button type="button" class="chat-confirm-close" aria-label="關閉" @click="emit('cancel')">
            <XMarkIcon class="icon" aria-hidden="true" />
          </button>
        </header>
        <p>這將清除與此角色的所有聊天紀錄，確認要繼續嗎？</p>
        <footer class="chat-confirm-footer">
          <button type="button" class="chat-confirm-btn" @click="emit('cancel')">取消</button>
          <button
            type="button"
            class="chat-confirm-btn is-danger"
            :disabled="loading"
            @click="emit('confirm')"
          >
            {{ loading ? '重置中…' : '確定重置' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped src="../../../styles/modals.css"></style>
