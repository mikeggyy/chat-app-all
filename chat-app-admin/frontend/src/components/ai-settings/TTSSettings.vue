<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>文字轉語音 AI (OpenAI TTS)</span>
        <el-tag size="small" type="success">語音</el-tag>
      </div>
    </template>

    <el-form :model="localSettings.tts" label-width="150px">
      <el-form-item label="模型">
        <div>
          <el-select v-model="localSettings.tts.model" placeholder="選擇模型">
            <el-option label="tts-1 (標準)" value="tts-1" />
            <el-option label="tts-1-hd (高清)" value="tts-1-hd" />
          </el-select>
          <div class="help-text">TTS 模型版本</div>
        </div>
      </el-form-item>

      <el-form-item label="預設語音">
        <div>
          <el-select
            v-model="localSettings.tts.defaultVoice"
            placeholder="選擇預設語音"
          >
            <el-option
              v-for="voice in localSettings.tts.availableVoices"
              :key="voice"
              :label="voice"
              :value="voice"
            />
          </el-select>
          <div class="help-text">角色未指定語音時使用的預設語音</div>
        </div>
      </el-form-item>

      <el-form-item label="可用語音">
        <div>
          <el-select
            v-model="localSettings.tts.availableVoices"
            multiple
            placeholder="選擇可用語音"
          >
            <el-option label="nova (女性)" value="nova" />
            <el-option label="alloy (中性)" value="alloy" />
            <el-option label="echo (男性)" value="echo" />
            <el-option label="fable (英式男性)" value="fable" />
            <el-option label="onyx (男性)" value="onyx" />
            <el-option label="shimmer (女性)" value="shimmer" />
          </el-select>
          <div class="help-text">用戶可選擇的語音列表</div>
        </div>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { computed } from 'vue';

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
</style>
