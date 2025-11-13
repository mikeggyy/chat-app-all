<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>
          角色影片生成 AI
          <el-tag v-if="localSettings.videoGeneration.provider === 'hailuo'" size="small" type="warning" style="margin-left: 8px">Hailuo 02</el-tag>
          <el-tag v-else-if="localSettings.videoGeneration.provider === 'veo'" size="small" type="primary" style="margin-left: 8px">Veo 3.0</el-tag>
          <el-tag v-else-if="localSettings.videoGeneration.provider === 'replicate'" size="small" type="info" style="margin-left: 8px">SVD</el-tag>
        </span>
        <el-tag size="small" type="danger">影片</el-tag>
      </div>
    </template>

    <el-form :model="localSettings.videoGeneration" label-width="150px">
      <!-- 提供者選擇 -->
      <el-form-item label="影片提供者">
        <div>
          <el-select
            v-model="localSettings.videoGeneration.provider"
            placeholder="選擇提供者"
            @change="onProviderChange"
          >
            <el-option label="Hailuo 02 (Minimax)" value="hailuo" />
            <el-option label="Veo 3.0 Fast (Google)" value="veo" />
            <el-option label="Stable Video Diffusion (Replicate)" value="replicate" />
          </el-select>
          <div class="help-text">選擇影片生成的 AI 提供者</div>
        </div>
      </el-form-item>

      <el-form-item label="模型">
        <div>
          <el-input v-model="localSettings.videoGeneration.model" disabled />
          <div class="help-text">
            <span v-if="localSettings.videoGeneration.provider === 'hailuo'">Minimax Hailuo 02 模型</span>
            <span v-else-if="localSettings.videoGeneration.provider === 'veo'">Google Veo 3.0 Fast 模型</span>
            <span v-else-if="localSettings.videoGeneration.provider === 'replicate'">Stability AI SVD 模型</span>
          </div>
        </div>
      </el-form-item>

      <!-- Hailuo 02 參數 -->
      <template v-if="localSettings.videoGeneration.provider === 'hailuo'">
        <el-form-item label="影片長度">
          <div>
            <div>
              <el-input-number
                v-model="localSettings.videoGeneration.durationSeconds"
                :min="2"
                :max="10"
                :step="1"
              />
              <span style="margin-left: 10px">秒</span>
            </div>
            <div class="help-text">影片時長（Hailuo 02 支援 2-10 秒）</div>
          </div>
        </el-form-item>

        <el-form-item label="解析度">
          <div>
            <el-select
              v-model="localSettings.videoGeneration.resolution"
              placeholder="選擇解析度"
            >
              <el-option label="512p" value="512p" />
              <el-option label="720p" value="720p" />
            </el-select>
            <div class="help-text">影片解析度（Hailuo 02 推薦 512p）</div>
          </div>
        </el-form-item>

        <el-form-item label="強化提示詞">
          <div>
            <el-switch v-model="localSettings.videoGeneration.enhancePrompt" />
            <div class="help-text">使用 Hailuo 內建的 prompt_optimizer</div>
          </div>
        </el-form-item>
      </template>

      <!-- Veo 3.0 參數 -->
      <template v-if="localSettings.videoGeneration.provider === 'veo'">
        <el-form-item label="影片長度">
          <div>
            <div>
              <el-input-number
                v-model="localSettings.videoGeneration.durationSeconds"
                :min="2"
                :max="8"
                :step="1"
              />
              <span style="margin-left: 10px">秒</span>
            </div>
            <div class="help-text">影片時長（使用參考圖片時必須為 8 秒）</div>
          </div>
        </el-form-item>

        <el-form-item label="解析度">
          <div>
            <el-select
              v-model="localSettings.videoGeneration.resolution"
              placeholder="選擇解析度"
            >
              <el-option label="720p" value="720p" />
              <el-option label="1080p" value="1080p" />
            </el-select>
            <div class="help-text">影片解析度</div>
          </div>
        </el-form-item>

        <el-form-item label="影片比例">
          <div>
            <el-select
              v-model="localSettings.videoGeneration.aspectRatio"
              placeholder="選擇比例"
            >
              <el-option label="9:16 (垂直)" value="9:16" />
              <el-option label="16:9 (水平)" value="16:9" />
              <el-option label="1:1 (正方形)" value="1:1" />
            </el-select>
            <div class="help-text">影片寬高比（推薦 9:16 適合手機）</div>
          </div>
        </el-form-item>

        <el-form-item label="生成數量">
          <div>
            <el-input-number
              v-model="localSettings.videoGeneration.sampleCount"
              :min="1"
              :max="4"
              :step="1"
            />
            <div class="help-text">每次生成的影片數量（1-4）</div>
          </div>
        </el-form-item>

        <el-form-item label="壓縮質量">
          <div>
            <el-select
              v-model="localSettings.videoGeneration.compressionQuality"
            >
              <el-option label="優化 (推薦)" value="optimized" />
              <el-option label="無損" value="lossless" />
            </el-select>
            <div class="help-text">影片壓縮質量</div>
          </div>
        </el-form-item>

        <el-form-item label="強化提示詞">
          <div>
            <el-switch v-model="localSettings.videoGeneration.enhancePrompt" />
            <div class="help-text">使用 Gemini 自動優化提示詞</div>
          </div>
        </el-form-item>

        <el-form-item label="人物生成">
          <div>
            <el-select v-model="localSettings.videoGeneration.personGeneration">
              <el-option label="允許成人人物" value="allow_adult" />
              <el-option label="不生成人物" value="dont_allow" />
            </el-select>
            <div class="help-text">人物生成策略</div>
          </div>
        </el-form-item>
      </template>

      <!-- Replicate SVD 無額外參數 -->
      <template v-if="localSettings.videoGeneration.provider === 'replicate'">
        <el-alert
          type="info"
          :closable="false"
          style="margin-bottom: 20px"
        >
          <template #title>
            Stable Video Diffusion 不使用文字提示詞，僅基於參考圖片生成約 4 秒的影片。
          </template>
        </el-alert>
      </template>

      <!-- 通用參數 -->
      <el-divider>通用設定</el-divider>

      <el-form-item label="啟用重試">
        <div>
          <el-switch v-model="localSettings.videoGeneration.enableRetry" />
          <div class="help-text">API 失敗時自動重試</div>
        </div>
      </el-form-item>

      <el-form-item
        label="最大重試次數"
        v-if="localSettings.videoGeneration.enableRetry"
      >
        <div>
          <el-input-number
            v-model="localSettings.videoGeneration.maxRetries"
            :min="1"
            :max="5"
            :step="1"
          />
          <div class="help-text">API 失敗時的最大重試次數</div>
        </div>
      </el-form-item>

      <el-form-item label="使用測試影片">
        <div>
          <el-switch v-model="localSettings.videoGeneration.useMockVideo" />
          <div class="help-text">啟用後不調用 API，返回模擬影片（節省配額）</div>
        </div>
      </el-form-item>

      <!-- 提示詞模板（僅 Hailuo 和 Veo 需要） -->
      <template v-if="localSettings.videoGeneration.provider !== 'replicate'">
        <el-divider>提示詞模板</el-divider>

        <el-form-item label="Video Prompt 模板">
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
                type="danger"
                effect="plain"
                class="variable-tag clickable"
                @click="handleInsertVariable(variable.name)"
              >
                {{ variable.name }}
              </el-tag>
            </div>
          </div>
        </el-form-item>
      </template>
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
  videoVariables,
  createEditor,
  editorToText,
  insertVariable,
  textToEditorContent,
} = useEditorVariables();

// 創建編輯器
const editor = createEditor(
  props.settings.videoGeneration.videoPromptTemplate,
  videoVariables,
  'danger',
  (text) => {
    localSettings.value = {
      ...localSettings.value,
      videoGeneration: {
        ...localSettings.value.videoGeneration,
        videoPromptTemplate: text,
      },
    };
  }
);

// 插入變數處理
const handleInsertVariable = (variableName) => {
  if (editor.value) {
    insertVariable(editor.value, variableName, 'danger');
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 切換影片提供者時更新相關設定
const onProviderChange = (provider) => {
  const updates = { ...localSettings.value.videoGeneration };

  if (provider === 'hailuo') {
    updates.model = 'minimax/hailuo-02';
    updates.durationSeconds = 10;
    updates.resolution = '512p';
    updates.aspectRatio = '16:9';
    ElMessage.success('已切換至 Hailuo 02 (Minimax)');
  } else if (provider === 'veo') {
    updates.model = 'veo-3.0-fast-generate-001';
    updates.durationSeconds = 8;
    updates.resolution = '720p';
    updates.aspectRatio = '9:16';
    updates.sampleCount = 1;
    updates.compressionQuality = 'optimized';
    updates.personGeneration = 'allow_adult';
    ElMessage.success('已切換至 Veo 3.0 Fast (Google)');
  } else if (provider === 'replicate') {
    updates.model = 'stability-ai/stable-video-diffusion';
    updates.durationSeconds = 4;
    updates.resolution = '576x1024';
    updates.aspectRatio = '9:16';
    ElMessage.success('已切換至 Stable Video Diffusion (Replicate)');
  }

  localSettings.value = {
    ...localSettings.value,
    videoGeneration: updates,
  };
};

// 監聽外部設定變化
watch(
  () => props.settings.videoGeneration.videoPromptTemplate,
  (newValue) => {
    if (editor.value && editorToText(editor.value) !== newValue) {
      const content = textToEditorContent(newValue, videoVariables, 'danger');
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
