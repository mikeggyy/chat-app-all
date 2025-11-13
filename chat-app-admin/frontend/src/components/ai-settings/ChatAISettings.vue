<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>對話生成 AI (OpenAI GPT)</span>
        <el-tag size="small">核心功能</el-tag>
      </div>
    </template>

    <el-form :model="localSettings.chat" label-width="150px">
      <el-form-item label="模型">
        <div>
          <el-select v-model="localSettings.chat.model" placeholder="選擇模型">
            <el-option label="gpt-4o-mini" value="gpt-4o-mini" />
            <el-option label="gpt-4o" value="gpt-4o" />
            <el-option label="gpt-4-turbo" value="gpt-4-turbo" />
            <el-option label="gpt-3.5-turbo" value="gpt-3.5-turbo" />
          </el-select>
          <div class="help-text">用於生成 AI 角色回覆的模型</div>
        </div>
      </el-form-item>

      <el-form-item label="Temperature">
        <div>
          <el-slider
            v-model="localSettings.chat.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            show-input
            :input-size="'small'"
          />
          <div class="help-text">
            控制回覆的隨機性（0 = 確定性，2 = 非常隨機）。推薦值：0.7
          </div>
        </div>
      </el-form-item>

      <el-form-item label="Top P">
        <div>
          <el-slider
            v-model="localSettings.chat.topP"
            :min="0"
            :max="1"
            :step="0.05"
            show-input
            :input-size="'small'"
          />
          <div class="help-text">核採樣參數，控制回覆的多樣性。推薦值：0.9</div>
        </div>
      </el-form-item>

      <el-form-item label="最大 Tokens">
        <div>
          <el-input-number
            v-model="localSettings.chat.maxTokens"
            :min="50"
            :max="1000"
            :step="10"
          />
          <div class="help-text">
            每次回覆的最大長度（免費會員預設值）。約 1 token = 0.75 個中文字
          </div>
        </div>
      </el-form-item>

      <el-form-item label="System Prompt 模板">
        <div>
          <div class="editor-wrapper">
            <editor-content :editor="editor" />
          </div>
          <div class="help-text">
            點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）
          </div>
          <div class="variables-container">
            <el-tag
              v-for="variable in chatVariables"
              :key="variable.name"
              size="small"
              type="info"
              effect="plain"
              class="variable-tag clickable"
              @click="handleInsertVariable(variable.name)"
            >
              {{ variable.name }}
            </el-tag>
          </div>
        </div>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { watch, onBeforeUnmount, computed } from 'vue';
import { EditorContent } from '@tiptap/vue-3';
import { ElMessage } from 'element-plus';
import { useEditorVariables } from '../../composables/useEditorVariables';

const props = defineProps({
  settings: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['update:settings']);

// 使用本地的 settings 副本，避免直接修改 props
const localSettings = computed({
  get: () => props.settings,
  set: (value) => emit('update:settings', value),
});

const {
  chatVariables,
  createEditor,
  editorToText,
  insertVariable,
  textToEditorContent,
} = useEditorVariables();

// 創建編輯器
const editor = createEditor(
  props.settings.chat.systemPromptTemplate,
  chatVariables,
  'info',
  (text) => {
    // 更新內容時觸發
    localSettings.value = {
      ...localSettings.value,
      chat: {
        ...localSettings.value.chat,
        systemPromptTemplate: text,
      },
    };
  }
);

// 插入變數處理
const handleInsertVariable = (variableName) => {
  if (editor.value) {
    insertVariable(editor.value, variableName, 'info');
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 監聽外部設定變化，更新編輯器
watch(
  () => props.settings.chat.systemPromptTemplate,
  (newValue) => {
    if (editor.value && editorToText(editor.value) !== newValue) {
      const content = textToEditorContent(newValue, chatVariables, 'info');
      editor.value.commands.setContent(content);
    }
  }
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.help-text {
  margin-top: 8px;
  font-size: 13px;
  color: #999;
  line-height: 1.5;
}

.editor-wrapper {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  min-height: 150px;
  padding: 10px;
  background: #fff;
  transition: border-color 0.2s;
}

.editor-wrapper:focus-within {
  border-color: #409eff;
}

.variables-container {
  margin-top: 12px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.variable-tag {
  font-family: "Courier New", monospace;
  font-weight: 500;
  user-select: none;
}

.variable-tag.clickable {
  cursor: pointer;
  transition: all 0.2s;
}

.variable-tag.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:deep(.tiptap-editor) {
  min-height: 150px;
  padding: 12px 15px;
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
  outline: none;
}

:deep(.tiptap-editor p) {
  margin: 0.5em 0;
}

:deep(.tiptap-editor p:first-child) {
  margin-top: 0;
}

:deep(.tiptap-editor p:last-child) {
  margin-bottom: 0;
}
</style>
