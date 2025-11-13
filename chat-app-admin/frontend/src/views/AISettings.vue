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
      <el-tab-pane label="聊天 AI" name="chat">
        <ChatAISettings :settings="settings" @update:settings="updateSettings" />
      </el-tab-pane>

      <el-tab-pane label="語音生成" name="tts">
        <TTSSettings :settings="settings" @update:settings="updateSettings" />
      </el-tab-pane>

      <el-tab-pane label="圖片生成" name="imageGeneration">
        <ImageGenerationSettings
          :settings="settings"
          @update:settings="updateSettings"
        />
      </el-tab-pane>

      <el-tab-pane label="影片生成" name="videoGeneration">
        <VideoGenerationSettings
          :settings="settings"
          @update:settings="updateSettings"
        />
      </el-tab-pane>

      <el-tab-pane label="角色設定生成" name="characterPersona">
        <CharacterPersonaSettings
          :settings="settings"
          @update:settings="updateSettings"
        />
      </el-tab-pane>

      <el-tab-pane label="創建角色照片" name="characterImage">
        <CharacterImageSettings
          :settings="settings"
          @update:settings="updateSettings"
        />
      </el-tab-pane>

      <el-tab-pane label="形象描述生成" name="characterAppearance">
        <CharacterAppearanceSettings
          :settings="settings"
          @update:settings="updateSettings"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 操作按鈕 -->
    <div class="action-buttons">
      <el-button
        type="primary"
        size="large"
        :loading="saving"
        @click="saveSettings"
      >
        <el-icon><Check /></el-icon> 保存設定
      </el-button>
      <el-button size="large" @click="resetSettings">
        <el-icon><RefreshLeft /></el-icon> 重置為預設值
      </el-button>
      <el-button size="large" @click="loadSettings">
        <el-icon><Refresh /></el-icon> 重新載入
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Check, RefreshLeft, Refresh } from '@element-plus/icons-vue';
import { useAISettings } from '../composables/useAISettings';
import ChatAISettings from '../components/ai-settings/ChatAISettings.vue';
import TTSSettings from '../components/ai-settings/TTSSettings.vue';
import ImageGenerationSettings from '../components/ai-settings/ImageGenerationSettings.vue';
import VideoGenerationSettings from '../components/ai-settings/VideoGenerationSettings.vue';
import CharacterPersonaSettings from '../components/ai-settings/CharacterPersonaSettings.vue';
import CharacterImageSettings from '../components/ai-settings/CharacterImageSettings.vue';
import CharacterAppearanceSettings from '../components/ai-settings/CharacterAppearanceSettings.vue';

const activeTab = ref('chat');

const {
  loading,
  saving,
  saved,
  settings,
  loadSettings,
  saveSettings,
  resetSettings,
} = useAISettings();

const updateSettings = (newSettings) => {
  Object.assign(settings, newSettings);
};

onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.ai-settings-page {
  padding: 20px;
}

h2 {
  font-size: 24px;
  margin-bottom: 10px;
}

.page-description {
  color: #666;
  margin-bottom: 20px;
}

.action-buttons {
  margin-top: 30px;
  display: flex;
  gap: 12px;
}
</style>
