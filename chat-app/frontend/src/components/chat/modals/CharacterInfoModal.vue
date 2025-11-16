<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline';

// Types
interface Props {
  isOpen: boolean;
  characterName?: string;
  background?: string;
}

interface Emits {
  (e: 'close'): void;
}

withDefaults(defineProps<Props>(), {
  characterName: '',
  background: '',
});

const emit = defineEmits<Emits>();
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="chat-confirm-backdrop">
      <div class="chat-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="character-info-title">
        <header class="chat-confirm-header">
          <h2 id="character-info-title">角色資訊</h2>
          <button type="button" class="chat-confirm-close" aria-label="關閉" @click="emit('close')">
            <XMarkIcon class="icon" aria-hidden="true" />
          </button>
        </header>
        <p>{{ background }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped src="../../../styles/modals.css"></style>
