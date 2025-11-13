<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>角色設定生成 AI 魔術師</span>
        <el-tag size="small" type="info">角色創建</el-tag>
      </div>
    </template>

    <el-form :model="localSettings.characterPersona" label-width="180px">
      <el-form-item label="模型">
        <div>
          <el-select
            v-model="localSettings.characterPersona.model"
            placeholder="選擇模型"
          >
            <el-option label="gpt-4o-mini" value="gpt-4o-mini" />
            <el-option label="gpt-4o" value="gpt-4o" />
            <el-option label="gpt-4-turbo" value="gpt-4-turbo" />
          </el-select>
          <div class="help-text">用於生成角色人格設定的模型</div>
        </div>
      </el-form-item>

      <el-form-item label="Temperature">
        <div>
          <el-slider
            v-model="localSettings.characterPersona.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            show-input
            :input-size="'small'"
          />
          <div class="help-text">控制角色設定的創造性（推薦 0.8）</div>
        </div>
      </el-form-item>

      <el-form-item label="Top P">
        <div>
          <el-slider
            v-model="localSettings.characterPersona.topP"
            :min="0"
            :max="1"
            :step="0.05"
            show-input
            :input-size="'small'"
          />
          <div class="help-text">核採樣參數（推薦 0.95）</div>
        </div>
      </el-form-item>

      <el-form-item label="名稱長度">
        <div>
          <el-input-number
            v-model="localSettings.characterPersona.maxNameLength"
            :min="4"
            :max="20"
            :step="1"
          />
          <div class="help-text">角色名稱的最大字數限制</div>
        </div>
      </el-form-item>

      <el-form-item label="公開背景長度">
        <div>
          <el-input-number
            v-model="localSettings.characterPersona.maxTaglineLength"
            :min="50"
            :max="500"
            :step="10"
          />
          <div class="help-text">公開背景（角色設定）的最大字數限制</div>
        </div>
      </el-form-item>

      <el-form-item label="隱藏背景長度">
        <div>
          <el-input-number
            v-model="localSettings.characterPersona.maxHiddenProfileLength"
            :min="50"
            :max="500"
            :step="10"
          />
          <div class="help-text">隱藏背景（內心設定）的最大字數限制</div>
        </div>
      </el-form-item>

      <el-form-item label="開場白長度">
        <div>
          <el-input-number
            v-model="localSettings.characterPersona.maxPromptLength"
            :min="20"
            :max="100"
            :step="5"
          />
          <div class="help-text">最大字數限制</div>
        </div>
      </el-form-item>

      <el-divider />

      <el-form-item label="角色設定提示詞模板">
        <div>
          <div class="editor-wrapper">
            <editor-content :editor="editor" />
          </div>
          <div class="help-text">
            使用 GPT-4o Vision API 分析選定的角色照片並生成角色設定。
            <br />
            點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）。
            <br />
            <strong>注意：</strong>此模板使用英文撰寫，但會要求 AI 以繁體中文輸出結果
          </div>
          <div class="variables-container">
            <el-tag
              v-for="variable in personaVariables"
              :key="variable.name"
              size="small"
              type="success"
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
import { computed, watch, onBeforeUnmount } from 'vue';
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

const localSettings = computed({
  get: () => props.settings,
  set: (value) => emit('update:settings', value),
});

const {
  personaVariables,
  createEditor,
  editorToText,
  insertVariable,
  textToEditorContent,
} = useEditorVariables();

// 創建編輯器
const editor = createEditor(
  props.settings.characterPersona.personaPromptTemplate,
  personaVariables,
  'success',
  (text) => {
    localSettings.value = {
      ...localSettings.value,
      characterPersona: {
        ...localSettings.value.characterPersona,
        personaPromptTemplate: text,
      },
    };
  }
);

// 插入變數處理
const handleInsertVariable = (variableName) => {
  if (editor.value) {
    insertVariable(editor.value, variableName, 'success');
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 監聽外部設定變化
watch(
  () => props.settings.characterPersona.personaPromptTemplate,
  (newValue) => {
    if (editor.value && editorToText(editor.value) !== newValue) {
      const content = textToEditorContent(newValue, personaVariables, 'success');
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
