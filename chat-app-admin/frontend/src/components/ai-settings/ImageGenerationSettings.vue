<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>角色自拍生成 AI (Gemini 2.5 Flash Image)</span>
        <el-tag size="small" type="warning">圖片</el-tag>
      </div>
    </template>

    <el-form :model="localSettings.imageGeneration" label-width="150px">
      <el-form-item label="模型">
        <div>
          <el-input v-model="localSettings.imageGeneration.model" disabled />
          <div class="help-text">使用 Google Gemini 2.5 Flash Image 模型</div>
        </div>
      </el-form-item>

      <el-form-item label="圖片比例">
        <div>
          <el-select
            v-model="localSettings.imageGeneration.aspectRatio"
            placeholder="選擇比例"
          >
            <el-option label="1:1 (正方形)" value="1:1" />
            <el-option label="2:3 (直向)" value="2:3" />
            <el-option label="3:2 (橫向)" value="3:2" />
            <el-option label="9:16 (手機直向)" value="9:16" />
            <el-option label="16:9 (手機橫向)" value="16:9" />
          </el-select>
          <div class="help-text">生成圖片的寬高比</div>
        </div>
      </el-form-item>

      <el-form-item label="壓縮質量">
        <div>
          <el-slider
            v-model="localSettings.imageGeneration.compressionQuality"
            :min="10"
            :max="100"
            :step="5"
            show-input
            :input-size="'small'"
          />
          <div class="help-text">
            WebP 壓縮質量（10-100），較低值可節省儲存空間。推薦值：40
          </div>
        </div>
      </el-form-item>

      <el-divider>場景設定</el-divider>

      <el-form-item label="場景選擇機率">
        <div>
          <el-slider
            v-model="localSettings.imageGeneration.scenarioSelectionChance"
            :min="0"
            :max="1"
            :step="0.05"
            :format-tooltip="(val) => `${(val * 100).toFixed(0)}%`"
            show-input
            :input-size="'small'"
          />
          <div class="help-text">
            生成自拍時使用隨機場景的機率（0-100%）。推薦值：70%
          </div>
        </div>
      </el-form-item>

      <el-form-item label="自拍場景列表">
        <div>
          <div class="scenarios-container">
            <el-tag
              v-for="(scenario, index) in localSettings.imageGeneration.selfieScenarios"
              :key="index"
              closable
              type="success"
              size="default"
              @close="removeScenario(index)"
              style="margin: 4px"
            >
              {{ scenario }}
            </el-tag>
          </div>
          <div style="margin-top: 10px; display: flex; gap: 10px">
            <el-input
              v-model="newScenario"
              placeholder="輸入新場景（英文），例如: at a coffee shop, reading a book"
              @keyup.enter="addScenario"
            />
            <el-button type="primary" @click="addScenario">新增場景</el-button>
          </div>
          <div class="help-text">
            自拍照片的隨機場景列表（英文描述）。每次生成時會隨機選擇一個場景。目前共 {{ localSettings.imageGeneration.selfieScenarios?.length || 0 }} 個場景。
          </div>
        </div>
      </el-form-item>

      <el-divider>提示詞模板</el-divider>

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
              v-for="variable in videoVariables"
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
import { ref, computed, watch, onBeforeUnmount } from 'vue';
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

const newScenario = ref('');

const {
  videoVariables,
  createEditor,
  editorToText,
  insertVariable,
  textToEditorContent,
} = useEditorVariables();

// 創建編輯器
const editor = createEditor(
  props.settings.imageGeneration.imagePromptTemplate,
  videoVariables,
  'success',
  (text) => {
    localSettings.value = {
      ...localSettings.value,
      imageGeneration: {
        ...localSettings.value.imageGeneration,
        imagePromptTemplate: text,
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

// 添加新場景
const addScenario = () => {
  if (newScenario.value.trim()) {
    if (!localSettings.value.imageGeneration.selfieScenarios) {
      localSettings.value.imageGeneration.selfieScenarios = [];
    }
    const updated = {
      ...localSettings.value,
      imageGeneration: {
        ...localSettings.value.imageGeneration,
        selfieScenarios: [
          ...localSettings.value.imageGeneration.selfieScenarios,
          newScenario.value.trim(),
        ],
      },
    };
    localSettings.value = updated;
    newScenario.value = '';
    ElMessage.success('場景已新增');
  } else {
    ElMessage.warning('請輸入場景描述');
  }
};

// 移除場景
const removeScenario = (index) => {
  const scenarios = [...localSettings.value.imageGeneration.selfieScenarios];
  scenarios.splice(index, 1);
  localSettings.value = {
    ...localSettings.value,
    imageGeneration: {
      ...localSettings.value.imageGeneration,
      selfieScenarios: scenarios,
    },
  };
  ElMessage.success('場景已移除');
};

// 監聽外部設定變化
watch(
  () => props.settings.imageGeneration.imagePromptTemplate,
  (newValue) => {
    if (editor.value && editorToText(editor.value) !== newValue) {
      const content = textToEditorContent(newValue, videoVariables, 'success');
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

.scenarios-container {
  padding: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  min-height: 100px;
  background-color: #f5f7fa;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
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
