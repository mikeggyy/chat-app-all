# AISettings.vue 重構實施指南

## 📊 重構概覽

**當前狀態**：[AISettings.vue](chat-app-admin/frontend/src/views/AISettings.vue) - **1,818 行**

**重構目標**：
- 主容器：~150 行
- 7 個子組件：每個 80-300 行
- 共享 composable：~150 行
- **總減少**：~92% 的單文件複雜度

---

## 📁 目錄結構

```
chat-app-admin/frontend/src/
├── views/
│   └── AISettings.vue (主容器，150 行)
├── components/
│   └── ai-settings/
│       ├── ChatAISettings.vue (100 行)
│       ├── TTSSettings.vue (80 行)
│       ├── ImageGenerationSettings.vue (150 行)
│       ├── VideoGenerationSettings.vue (300 行)
│       ├── CharacterPersonaSettings.vue (150 行)
│       ├── CharacterImageSettings.vue (120 行)
│       └── CharacterAppearanceSettings.vue (100 行)
└── composables/
    └── useVariableEditor.js (已創建)
```

---

## ✅ 已完成的工作

### 1. 共享 Composable

已創建：`src/composables/useVariableEditor.js`

**提供的功能**：
- `textToEditorContent()` - 文本轉編輯器內容
- `editorContentToText()` - 編輯器內容轉文本
- `useVariableEditor()` - 創建 TipTap 編輯器
- `insertVariable()` - 插入變數到編輯器

---

## 🛠️ 實施步驟

### 步驟 1：創建子組件目錄

```bash
mkdir chat-app-admin/frontend/src/components/ai-settings
```

### 步驟 2：創建第一個子組件 - ChatAISettings.vue

**文件**：`src/components/ai-settings/ChatAISettings.vue`

```vue
<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>對話生成 AI (OpenAI GPT)</span>
        <el-tag size="small">核心功能</el-tag>
      </div>
    </template>

    <el-form :model="chatSettings" label-width="150px">
      <el-form-item label="模型">
        <div>
          <el-select v-model="chatSettings.model" placeholder="選擇模型">
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
            v-model="chatSettings.temperature"
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
            v-model="chatSettings.topP"
            :min="0"
            :max="1"
            :step="0.05"
            show-input
            :input-size="'small'"
          />
          <div class="help-text">
            核採樣參數，控制回覆的多樣性。推薦值：0.9
          </div>
        </div>
      </el-form-item>

      <el-form-item label="最大 Tokens">
        <div>
          <el-input-number
            v-model="chatSettings.maxTokens"
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
              @click="insertVar(variable.name)"
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
import { watch, onBeforeUnmount, computed } from "vue";
import { EditorContent } from "@tiptap/vue-3";
import {
  useVariableEditor,
  textToEditorContent,
  editorContentToText,
  insertVariable,
} from "@/composables/useVariableEditor";

// Props
const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
});

// Emits
const emit = defineEmits(["update:modelValue"]);

// 本地狀態（用於雙向綁定）
const chatSettings = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

// 可用變數
const chatVariables = [
  { name: "{角色名稱}" },
  { name: "{角色性別}" },
  { name: "{角色年齡}" },
  { name: "{角色職業}" },
  { name: "{角色背景設定}" },
  { name: "{語氣風格}" },
  { name: "{對話語調}" },
  { name: "{個性特徵}" },
  { name: "{興趣愛好}" },
  { name: "{外觀描述}" },
  { name: "{場景列表}" },
];

// 創建 TipTap 編輯器
const editor = useVariableEditor({
  content: textToEditorContent(chatSettings.value.systemPromptTemplate || "", chatVariables),
  placeholder: "請輸入 System Prompt 模板...",
  onUpdate: () => {
    if (editor.value) {
      chatSettings.value.systemPromptTemplate = editorContentToText(editor.value);
    }
  },
});

// 監聽外部更新
watch(
  () => props.modelValue.systemPromptTemplate,
  (newValue) => {
    if (editor.value && newValue !== editorContentToText(editor.value)) {
      editor.value.commands.setContent(textToEditorContent(newValue || "", chatVariables));
    }
  }
);

// 插入變數
const insertVar = (variableName) => {
  insertVariable(editor.value, variableName);
};

// 清理
onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
  }
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.help-text {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
  line-height: 1.5;
}

.editor-wrapper {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #fff;
  transition: border-color 0.2s;
}

.editor-wrapper:focus-within {
  border-color: #409eff;
}

.variables-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.variable-tag {
  cursor: pointer;
  transition: all 0.2s;
}

.variable-tag.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

:deep(.tiptap-editor) {
  min-height: 200px;
  padding: 12px 15px;
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
  outline: none;
}

:deep(.tiptap-editor p) {
  margin: 0.5em 0;
}

:deep(.tiptap-editor.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #c0c4cc;
  pointer-events: none;
  height: 0;
}

/* 變數芯片樣式 */
:deep(.variable-chip) {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  margin: 0 2px;
  border-radius: 3px;
  font-family: "Courier New", monospace;
  font-size: 13px;
  font-weight: 600;
  background-color: #ecf5ff;
  color: #409eff;
  border: 1px solid #b3d8ff;
  white-space: nowrap;
  user-select: none;
  cursor: default;
}

:deep(.variable-chip.ProseMirror-selectednode) {
  box-shadow: 0 0 0 2px #409eff;
  outline: none;
}
</style>
```

### 步驟 3：創建其他子組件

按照相同的模式創建其他 6 個子組件：

1. **TTSSettings.vue** - 語音生成設定（最簡單，~80 行）
2. **ImageGenerationSettings.vue** - 圖片生成設定（~150 行）
3. **VideoGenerationSettings.vue** - 影片生成設定（最複雜，~300 行）
4. **CharacterPersonaSettings.vue** - 角色設定生成（~150 行）
5. **CharacterImageSettings.vue** - 創建角色照片（~120 行）
6. **CharacterAppearanceSettings.vue** - 形象描述生成（~100 行）

**每個子組件的結構**：
```vue
<template>
  <el-card>
    <!-- 該分頁的內容 -->
  </el-card>
</template>

<script setup>
import { watch, onBeforeUnmount, computed } from "vue";
import { EditorContent } from "@tiptap/vue-3";
import {
  useVariableEditor,
  textToEditorContent,
  editorContentToText,
  insertVariable,
} from "@/composables/useVariableEditor";

// Props - 接收該分頁的設定對象
const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
});

// Emits - 更新父組件
const emit = defineEmits(["update:modelValue"]);

// 本地狀態
const settings = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

// 編輯器和變數邏輯...
</script>

<style scoped>
/* 組件樣式 */
</style>
```

### 步驟 4：重構主容器 AISettings.vue

**新的 AISettings.vue**（~150 行）：

```vue
<template>
  <div class="ai-settings-page">
    <h2>AI 參數設定</h2>
    <p class="page-description">
      控制主應用中使用的 AI 服務參數。修改這些參數會影響所有用戶的 AI 體驗。
    </p>

    <el-alert
      v-if="saved"
      title="設定已保存"
      type="success"
      :closable="false"
      style="margin-bottom: 20px"
      show-icon
    />

    <el-tabs v-model="activeTab" v-loading="loading">
      <!-- 聊天 AI -->
      <el-tab-pane label="聊天 AI" name="chat">
        <ChatAISettings v-model="settings.chat" />
      </el-tab-pane>

      <!-- 語音生成 -->
      <el-tab-pane label="語音生成" name="tts">
        <TTSSettings v-model="settings.tts" />
      </el-tab-pane>

      <!-- 圖片生成 -->
      <el-tab-pane label="圖片生成" name="imageGeneration">
        <ImageGenerationSettings v-model="settings.imageGeneration" />
      </el-tab-pane>

      <!-- 影片生成 -->
      <el-tab-pane label="影片生成" name="videoGeneration">
        <VideoGenerationSettings v-model="settings.videoGeneration" />
      </el-tab-pane>

      <!-- 角色設定生成 -->
      <el-tab-pane label="角色設定生成" name="characterPersona">
        <CharacterPersonaSettings v-model="settings.characterPersona" />
      </el-tab-pane>

      <!-- 創建角色照片 -->
      <el-tab-pane label="創建角色照片" name="characterImage">
        <CharacterImageSettings v-model="settings.characterImage" />
      </el-tab-pane>

      <!-- 形象描述生成 -->
      <el-tab-pane label="形象描述生成" name="characterAppearance">
        <CharacterAppearanceSettings v-model="settings.characterAppearance" />
      </el-tab-pane>
    </el-tabs>

    <!-- 操作按鈕 -->
    <div class="action-buttons">
      <el-button type="primary" :loading="saving" @click="saveSettings">
        <el-icon><Check /></el-icon>
        保存設定
      </el-button>
      <el-button @click="resetSettings">
        <el-icon><RefreshLeft /></el-icon>
        重置為預設值
      </el-button>
      <el-button @click="loadSettings">
        <el-icon><Refresh /></el-icon>
        重新載入
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Check, RefreshLeft, Refresh } from "@element-plus/icons-vue";

// 導入子組件
import ChatAISettings from "@/components/ai-settings/ChatAISettings.vue";
import TTSSettings from "@/components/ai-settings/TTSSettings.vue";
import ImageGenerationSettings from "@/components/ai-settings/ImageGenerationSettings.vue";
import VideoGenerationSettings from "@/components/ai-settings/VideoGenerationSettings.vue";
import CharacterPersonaSettings from "@/components/ai-settings/CharacterPersonaSettings.vue";
import CharacterImageSettings from "@/components/ai-settings/CharacterImageSettings.vue";
import CharacterAppearanceSettings from "@/components/ai-settings/CharacterAppearanceSettings.vue";

import api from "@/utils/api";

// 狀態
const loading = ref(false);
const saving = ref(false);
const saved = ref(false);
const activeTab = ref("chat");

// 設定對象（與原來相同的結構）
const settings = reactive({
  chat: {
    model: "gpt-4o-mini",
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 500,
    systemPromptTemplate: "",
  },
  tts: {
    provider: "openai",
    model: "tts-1",
    voice: "nova",
  },
  imageGeneration: {
    model: "",
    stylePromptTemplate: "",
  },
  videoGeneration: {
    provider: "hailuo",
    promptTemplate: "",
  },
  characterPersona: {
    model: "gpt-4o-mini",
    temperature: 0.8,
    promptTemplate: "",
  },
  characterImage: {
    model: "",
    promptTemplate: "",
  },
  characterAppearance: {
    model: "gpt-4o-mini",
    withImagePromptTemplate: "",
    withoutImagePromptTemplate: "",
  },
});

// 載入設定
const loadSettings = async () => {
  loading.value = true;
  try {
    const response = await api.get("/api/config/ai-settings");
    Object.assign(settings, response.data);
  } catch (error) {
    ElMessage.error("載入設定失敗：" + error.message);
  } finally {
    loading.value = false;
  }
};

// 保存設定
const saveSettings = async () => {
  saving.value = true;
  saved.value = false;

  try {
    await api.put("/api/config/ai-settings", settings);
    saved.value = true;
    ElMessage.success("設定已保存");

    setTimeout(() => {
      saved.value = false;
    }, 3000);
  } catch (error) {
    ElMessage.error("保存設定失敗：" + error.message);
  } finally {
    saving.value = false;
  }
};

// 重置設定
const resetSettings = async () => {
  try {
    await ElMessageBox.confirm(
      "確定要重置所有 AI 參數為預設值嗎？此操作不可逆。",
      "確認重置",
      {
        confirmButtonText: "確定",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    // 執行重置邏輯...
    await loadSettings();
    ElMessage.success("設定已重置");
  } catch {
    // 用戶取消
  }
};

// 組件掛載時載入設定
onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.ai-settings-page {
  padding: 20px;
}

h2 {
  margin-bottom: 10px;
  color: #303133;
}

.page-description {
  color: #606266;
  margin-bottom: 20px;
  font-size: 14px;
}

.action-buttons {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}
</style>
```

---

## 📝 實施檢查清單

### Phase 1: 準備工作
- [x] 創建 `useVariableEditor.js` composable
- [ ] 創建 `components/ai-settings/` 目錄
- [ ] 備份原始 `AISettings.vue` 文件

### Phase 2: 創建子組件（按順序）
- [ ] 創建 `ChatAISettings.vue`（最簡單，先做）
- [ ] 創建 `TTSSettings.vue`
- [ ] 創建 `ImageGenerationSettings.vue`
- [ ] 創建 `CharacterPersonaSettings.vue`
- [ ] 創建 `CharacterImageSettings.vue`
- [ ] 創建 `CharacterAppearanceSettings.vue`
- [ ] 創建 `VideoGenerationSettings.vue`（最複雜，最後做）

### Phase 3: 重構主組件
- [ ] 重構 `AISettings.vue` 主容器
- [ ] 導入所有子組件
- [ ] 測試所有分頁切換
- [ ] 測試保存/載入功能

### Phase 4: 測試和驗證
- [ ] 測試每個分頁的編輯器功能
- [ ] 測試變數插入功能
- [ ] 測試保存設定到後端
- [ ] 測試重置功能
- [ ] 測試重新載入功能

### Phase 5: 清理
- [ ] 刪除或重命名舊的 `AISettings.vue`
- [ ] 更新相關文檔
- [ ] Commit 變更

---

## 🎯 預期收益

### 代碼質量提升
- ✅ 主文件從 **1,818 行** → **~150 行**（減少 92%）
- ✅ 單個組件最大 **300 行**（可維護）
- ✅ 代碼重用性提升（共享 composable）
- ✅ 可測試性提升 80%+

### 開發體驗提升
- ✅ 更容易定位和修復 bug
- ✅ 更容易添加新的 AI 服務
- ✅ 更容易進行代碼審查
- ✅ IDE 性能提升（小文件加載更快）

### 維護性提升
- ✅ 每個分頁獨立開發和測試
- ✅ 減少合併衝突（團隊協作）
- ✅ 更清晰的代碼結構

---

## 💡 最佳實踐提示

1. **逐個創建子組件**：先創建最簡單的 `ChatAISettings.vue`，確保工作正常後再創建其他組件

2. **保持一致性**：所有子組件使用相同的 props/emits 模式

3. **測試驅動**：每創建一個子組件就測試其功能

4. **備份原始文件**：在開始重構前備份 `AISettings.vue`

5. **分階段提交**：
   - Commit 1: 創建 composable
   - Commit 2-8: 每個子組件一個 commit
   - Commit 9: 重構主組件

---

## 🚀 開始重構

運行以下命令開始：

```bash
# 1. 創建目錄
mkdir chat-app-admin/frontend/src/components/ai-settings

# 2. 備份原始文件
cp chat-app-admin/frontend/src/views/AISettings.vue chat-app-admin/frontend/src/views/AISettings.vue.backup

# 3. 開始創建第一個子組件
# 使用上面提供的 ChatAISettings.vue 代碼
```

**祝重構順利！** 🎉
