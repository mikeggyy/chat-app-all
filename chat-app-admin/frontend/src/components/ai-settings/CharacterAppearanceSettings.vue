<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>形象描述生成 AI 魔術師</span>
        <el-tag size="small" type="info">角色創建</el-tag>
      </div>
    </template>

    <el-form :model="localSettings.characterAppearance" label-width="250px">
      <el-form-item label="模型">
        <div>
          <el-select
            v-model="localSettings.characterAppearance.model"
            placeholder="選擇模型"
          >
            <el-option label="gpt-4o-mini" value="gpt-4o-mini" />
            <el-option label="gpt-4o" value="gpt-4o" />
            <el-option label="gpt-4-turbo" value="gpt-4-turbo" />
          </el-select>
          <div class="help-text">
            生成形象描述的模型。<strong>注意：</strong>當用戶上傳照片時，系統會自動使用
            gpt-4o（Vision API）分析照片；無照片時使用 gpt-4o-mini 純文字生成
          </div>
        </div>
      </el-form-item>

      <el-form-item label="Temperature">
        <div>
          <el-slider
            v-model="localSettings.characterAppearance.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            show-input
            :input-size="'small'"
          />
          <div class="help-text">控制描述的創造性（推薦 0.7）</div>
        </div>
      </el-form-item>

      <el-form-item label="Top P">
        <div>
          <el-slider
            v-model="localSettings.characterAppearance.topP"
            :min="0"
            :max="1"
            :step="0.05"
            show-input
            :input-size="'small'"
          />
          <div class="help-text">核採樣參數（推薦 0.9）</div>
        </div>
      </el-form-item>

      <el-form-item label="形象描述長度">
        <div>
          <el-input-number
            v-model="localSettings.characterAppearance.maxAppearanceLength"
            :min="30"
            :max="200"
            :step="10"
          />
          <div class="help-text">最大字數限制</div>
        </div>
      </el-form-item>

      <el-divider />

      <el-form-item label="形象描述提示詞模板（有照片）">
        <div>
          <div class="editor-wrapper">
            <editor-content :editor="editorWithImage" />
          </div>
          <div class="help-text">
            當用戶上傳參考照片時使用此模板（使用 GPT-4o Vision API 分析照片）。
            <br />
            點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）。
            <br />
            <strong>注意：</strong>此模板使用英文撰寫，但會要求 AI 以繁體中文輸出結果
          </div>
          <div class="variables-container">
            <el-tag
              v-for="variable in appearanceVariables"
              :key="variable.name"
              size="small"
              type="success"
              effect="plain"
              class="variable-tag clickable"
              @click="handleInsertVariableWithImage(variable.name)"
            >
              {{ variable.name }}
            </el-tag>
          </div>
        </div>
      </el-form-item>

      <el-divider />

      <el-form-item label="形象描述提示詞模板（無照片）">
        <div>
          <div class="editor-wrapper">
            <editor-content :editor="editorWithoutImage" />
          </div>
          <div class="help-text">
            當用戶未上傳參考照片時使用此模板（純文字模式，使用 GPT-4o-mini）。
            <br />
            點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）。
            <br />
            <strong>注意：</strong>此模板使用繁體中文撰寫
          </div>
          <div class="variables-container">
            <el-tag
              v-for="variable in appearanceVariables"
              :key="variable.name"
              size="small"
              type="warning"
              effect="plain"
              class="variable-tag clickable"
              @click="handleInsertVariableWithoutImage(variable.name)"
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
  appearanceVariables,
  createEditor,
  editorToText,
  insertVariable,
  textToEditorContent,
} = useEditorVariables();

// 創建「有照片」編輯器
const editorWithImage = createEditor(
  props.settings.characterAppearance.appearancePromptTemplateWithImage,
  appearanceVariables,
  'success',
  (text) => {
    localSettings.value = {
      ...localSettings.value,
      characterAppearance: {
        ...localSettings.value.characterAppearance,
        appearancePromptTemplateWithImage: text,
      },
    };
  }
);

// 創建「無照片」編輯器
const editorWithoutImage = createEditor(
  props.settings.characterAppearance.appearancePromptTemplateWithoutImage,
  appearanceVariables,
  'warning',
  (text) => {
    localSettings.value = {
      ...localSettings.value,
      characterAppearance: {
        ...localSettings.value.characterAppearance,
        appearancePromptTemplateWithoutImage: text,
      },
    };
  }
);

// 插入變數處理（有照片）
const handleInsertVariableWithImage = (variableName) => {
  if (editorWithImage.value) {
    insertVariable(editorWithImage.value, variableName, 'success');
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 插入變數處理（無照片）
const handleInsertVariableWithoutImage = (variableName) => {
  if (editorWithoutImage.value) {
    insertVariable(editorWithoutImage.value, variableName, 'warning');
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 監聽外部設定變化（有照片）
watch(
  () => props.settings.characterAppearance.appearancePromptTemplateWithImage,
  (newValue) => {
    if (editorWithImage.value && editorToText(editorWithImage.value) !== newValue) {
      const content = textToEditorContent(newValue, appearanceVariables, 'success');
      editorWithImage.value.commands.setContent(content);
    }
  }
);

// 監聽外部設定變化（無照片）
watch(
  () => props.settings.characterAppearance.appearancePromptTemplateWithoutImage,
  (newValue) => {
    if (editorWithoutImage.value && editorToText(editorWithoutImage.value) !== newValue) {
      const content = textToEditorContent(newValue, appearanceVariables, 'warning');
      editorWithoutImage.value.commands.setContent(content);
    }
  }
);

onBeforeUnmount(() => {
  editorWithImage.value?.destroy();
  editorWithoutImage.value?.destroy();
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
