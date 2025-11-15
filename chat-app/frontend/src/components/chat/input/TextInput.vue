<template>
  <input
    ref="inputRef"
    v-model="inputValue"
    type="text"
    :placeholder="placeholder"
    autocomplete="off"
    :disabled="disabled"
    class="text-input"
    @keydown.enter.prevent="handleSubmit"
  />
</template>

<script setup>
import { ref, computed } from 'vue';

/**
 * TextInput - 文字輸入框組件
 * 職責：提供基本的文字輸入功能和 Enter 鍵發送
 */

// Props
const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: '輸入訊息...',
  },
});

// Emits
const emit = defineEmits(['update:modelValue', 'submit']);

// Refs
const inputRef = ref(null);

// Computed - v-model 雙向綁定
const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

/**
 * 處理提交（Enter 鍵）
 */
const handleSubmit = () => {
  if (inputValue.value && inputValue.value.trim().length > 0 && !props.disabled) {
    emit('submit');
  }
};

/**
 * 聚焦輸入框（暴露給父組件）
 */
const focus = () => {
  inputRef.value?.focus();
};

// 暴露方法給父組件
defineExpose({ focus });
</script>

<style scoped>
.text-input {
  flex: 1;
  min-width: 0;
  padding: 0.875rem 1rem;
  font-size: 1rem;
  line-height: 1.5;
  color: #ffffff;
  background-color: transparent;
  border: none;
  outline: none;
  transition: background-color 0.2s ease;
}

.text-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.text-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.text-input:focus {
  background-color: transparent;
}
</style>
