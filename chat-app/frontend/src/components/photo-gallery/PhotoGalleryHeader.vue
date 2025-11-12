<template>
  <header class="photo-gallery-header">
    <button type="button" class="header-btn" aria-label="關閉" @click="$emit('close')">
      <XMarkIcon class="icon" />
    </button>
    <div class="header-title">
      <h1>{{ characterName }}</h1>
      <p class="subtitle">{{ photoCount }} 張照片</p>
    </div>
    <button
      v-if="!isEditMode && photoCount > 1"
      type="button"
      class="header-btn"
      aria-label="編輯"
      @click="$emit('enter-edit-mode')"
    >
      <PencilIcon class="icon" />
    </button>
    <button
      v-else-if="isEditMode"
      type="button"
      class="header-btn header-btn--cancel"
      aria-label="取消"
      @click="$emit('cancel-edit-mode')"
    >
      取消
    </button>
    <span v-else class="header-spacer" aria-hidden="true"></span>
  </header>
</template>

<script setup>
import { XMarkIcon, PencilIcon } from '@heroicons/vue/24/outline';

defineProps({
  characterName: {
    type: String,
    required: true,
  },
  photoCount: {
    type: Number,
    required: true,
  },
  isEditMode: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['close', 'enter-edit-mode', 'cancel-edit-mode']);
</script>

<style scoped>
.photo-gallery-header {
  display: flex;
  align-items: center;
  padding: 1rem 1.25rem;
  gap: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  height: 2.75rem;
  padding: 0 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(6, 2, 15, 0.45);
  color: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.header-btn .icon {
  width: 1.35rem;
  height: 1.35rem;
}

.header-btn:active {
  transform: scale(0.94);
}

.header-btn--cancel {
  background: rgba(255, 255, 255, 0.12);
}

.header-spacer {
  min-width: 2.75rem;
}

.header-title {
  flex: 1;
  text-align: center;
}

.header-title h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: rgba(250, 241, 255, 0.7);
}
</style>
