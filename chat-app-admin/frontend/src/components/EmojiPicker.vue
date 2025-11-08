<template>
  <div class="emoji-picker-wrapper">
    <el-popover
      :visible="visible"
      :width="320"
      placement="bottom-start"
      trigger="click"
      popper-class="emoji-picker-popover"
      @update:visible="handleVisibleChange"
    >
      <template #reference>
        <el-button
          :type="buttonType"
          :size="buttonSize"
          :icon="currentEmoji ? undefined : Plus"
          class="emoji-picker-button"
        >
          <span v-if="currentEmoji" class="emoji-display">{{ currentEmoji }}</span>
          <span v-else>{{ buttonText }}</span>
        </el-button>
      </template>

      <div class="emoji-picker-container">
        <div ref="pickerContainer" class="picker-mount"></div>

        <div v-if="showClearButton && currentEmoji" class="picker-actions">
          <el-button size="small" @click="handleClear">清除</el-button>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import 'emoji-picker-element';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  buttonType: {
    type: String,
    default: 'default',
  },
  buttonSize: {
    type: String,
    default: 'default',
  },
  buttonText: {
    type: String,
    default: '選擇 Emoji',
  },
  showClearButton: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['update:modelValue', 'change']);

const visible = ref(false);
const pickerContainer = ref(null);
const currentEmoji = ref(props.modelValue);
let pickerInstance = null;

const handleVisibleChange = (val) => {
  visible.value = val;
};

const handleEmojiClick = (event) => {
  const emoji = event.detail.unicode;
  currentEmoji.value = emoji;
  emit('update:modelValue', emoji);
  emit('change', emoji);
  visible.value = false;
};

const handleClear = () => {
  currentEmoji.value = '';
  emit('update:modelValue', '');
  emit('change', '');
  visible.value = false;
};

onMounted(() => {
  if (pickerContainer.value) {
    // 創建 emoji-picker 元素
    pickerInstance = document.createElement('emoji-picker');
    pickerInstance.className = 'light'; // 使用淺色主題

    // 監聽 emoji 選擇事件
    pickerInstance.addEventListener('emoji-click', handleEmojiClick);

    // 掛載到容器
    pickerContainer.value.appendChild(pickerInstance);
  }
});

onBeforeUnmount(() => {
  if (pickerInstance) {
    pickerInstance.removeEventListener('emoji-click', handleEmojiClick);
  }
});

watch(() => props.modelValue, (newVal) => {
  currentEmoji.value = newVal;
});
</script>

<style scoped>
.emoji-picker-wrapper {
  display: inline-block;
}

.emoji-picker-button {
  min-width: 100px;
}

.emoji-display {
  font-size: 20px;
  display: inline-block;
  vertical-align: middle;
}

.emoji-picker-container {
  padding: 0;
}

.picker-mount {
  width: 100%;
  max-height: 400px;
  overflow: hidden;
}

.picker-actions {
  padding: 8px;
  border-top: 1px solid #e4e7ed;
  text-align: right;
}

/* 自定義 emoji-picker 樣式 */
:deep(emoji-picker) {
  width: 100%;
  height: 350px;
  border: none;
  --background: #fff;
  --border-color: #e4e7ed;
  --indicator-color: #409eff;
  --input-border-color: #dcdfe6;
  --input-font-color: #606266;
  --input-placeholder-color: #c0c4cc;
  --outline-color: #409eff;
  --category-font-color: #303133;
  --button-active-background: #ecf5ff;
  --button-hover-background: #f5f7fa;
}
</style>

<style>
/* 全局樣式：調整 popover 樣式 */
.emoji-picker-popover {
  padding: 0 !important;
}

.emoji-picker-popover .el-popover__title {
  padding: 12px;
}
</style>
