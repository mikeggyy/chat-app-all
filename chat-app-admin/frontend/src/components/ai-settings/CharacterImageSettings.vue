<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>創建角色照片</span>
        <el-tag size="small" type="info">角色創建</el-tag>
      </div>
    </template>

    <el-form :model="localSettings.characterImage" label-width="200px">
      <el-form-item label="模型">
        <div>
          <el-input v-model="localSettings.characterImage.model" disabled />
          <div class="help-text">使用 OpenAI gpt-image-1-mini 模型</div>
        </div>
      </el-form-item>

      <el-form-item label="圖片尺寸">
        <div>
          <el-select
            v-model="localSettings.characterImage.size"
            placeholder="選擇尺寸"
            style="width: 240px"
          >
            <el-option label="1024x1024 (正方形)" value="1024x1024" />
            <el-option label="1024x1536 (2:3 直向)" value="1024x1536" />
            <el-option label="1536x1024 (3:2 橫向)" value="1536x1024" />
          </el-select>
          <div class="help-text">生成圖片的尺寸</div>
        </div>
      </el-form-item>

      <el-form-item label="圖片質量">
        <div>
          <el-select
            v-model="localSettings.characterImage.quality"
            placeholder="選擇質量"
            style="width: 200px"
          >
            <el-option label="Low (低)" value="low" />
            <el-option label="Medium (中)" value="medium" />
            <el-option label="High (高)" value="high" />
          </el-select>
          <div class="help-text">圖片生成質量</div>
        </div>
      </el-form-item>

      <el-form-item label="生成數量">
        <div>
          <el-input-number
            v-model="localSettings.characterImage.count"
            :min="1"
            :max="10"
            :step="1"
          />
          <div class="help-text">每次生成的圖片數量</div>
        </div>
      </el-form-item>

      <el-form-item label="外觀描述長度">
        <div>
          <el-input-number
            v-model="localSettings.characterImage.maxAppearanceDescriptionLength"
            :min="30"
            :max="200"
            :step="10"
          />
          <div class="help-text">角色外觀描述的最大字數</div>
        </div>
      </el-form-item>

      <el-divider />

      <el-form-item label="圖片生成提示詞模板">
        <div>
          <div class="editor-wrapper">
            <editor-content :editor="editor" />
          </div>
          <div class="help-text">
            點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）（注意：此模板使用英文撰寫）
          </div>
          <div class="variables-container">
            <el-tag
              v-for="variable in imageVariables"
              :key="variable.name"
              size="small"
              type="warning"
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
  imageVariables,
  createEditor,
  editorToText,
  insertVariable,
  textToEditorContent,
} = useEditorVariables();

// 創建編輯器
const editor = createEditor(
  props.settings.characterImage.imagePromptTemplate,
  imageVariables,
  'warning',
  (text) => {
    localSettings.value = {
      ...localSettings.value,
      characterImage: {
        ...localSettings.value.characterImage,
        imagePromptTemplate: text,
      },
    };
  }
);

// 插入變數處理
const handleInsertVariable = (variableName) => {
  if (editor.value) {
    insertVariable(editor.value, variableName, 'warning');
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 監聽外部設定變化
watch(
  () => props.settings.characterImage.imagePromptTemplate,
  (newValue) => {
    if (editor.value && editorToText(editor.value) !== newValue) {
      const content = textToEditorContent(newValue, imageVariables, 'warning');
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
