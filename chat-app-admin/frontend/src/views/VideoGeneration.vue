<template>
  <div class="video-generation-page">
    <h2>影片生成工具</h2>
    <p class="page-description">
      上傳圖片生成影片，使用與主應用相同的 AI 影片生成服務。
    </p>

    <el-row :gutter="24">
      <!-- 左側：生成區域 -->
      <el-col :span="14">
        <el-card class="generate-card">
          <template #header>
            <div class="card-header">
              <span>生成新影片</span>
              <el-tag :type="currentProvider === 'hailuo' ? 'success' : 'primary'">
                {{ currentProvider === 'hailuo' ? 'Hailuo 02' : 'Stable Video Diffusion' }}
              </el-tag>
            </div>
          </template>

          <!-- 圖片上傳區域 -->
          <div class="upload-section">
            <el-upload
              ref="uploadRef"
              class="image-uploader"
              :show-file-list="false"
              :auto-upload="false"
              :on-change="handleImageChange"
              accept="image/*"
              drag
            >
              <div v-if="imagePreview" class="preview-container">
                <img :src="imagePreview" class="preview-image" />
                <div class="preview-overlay">
                  <el-button type="primary" size="small" @click.stop="clearImage">
                    更換圖片
                  </el-button>
                </div>
              </div>
              <div v-else class="upload-placeholder">
                <el-icon class="upload-icon"><Upload /></el-icon>
                <div class="upload-text">點擊或拖放圖片到此處</div>
                <div class="upload-hint">支援 JPG、PNG、WebP 格式</div>
              </div>
            </el-upload>
          </div>

          <!-- 提供者選擇 -->
          <div class="provider-section">
            <el-form-item label="影片生成提供者">
              <el-radio-group v-model="currentProvider">
                <el-radio-button
                  v-for="provider in providers"
                  :key="provider.id"
                  :value="provider.id"
                >
                  {{ provider.name }}
                  <el-tooltip :content="provider.description" placement="top">
                    <el-icon class="info-icon"><InfoFilled /></el-icon>
                  </el-tooltip>
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
          </div>

          <!-- 進階設定（僅 Hailuo 支援） -->
          <div v-if="currentProvider === 'hailuo'" class="advanced-settings">
            <!-- 提示詞 -->
            <el-form-item label="提示詞（可選）">
              <el-input
                v-model="prompt"
                type="textarea"
                :rows="3"
                placeholder="描述影片的動作或場景，例如：微笑著看向鏡頭，輕輕揮手"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 進階參數區塊 -->
            <el-collapse v-model="showAdvanced" class="settings-collapse">
              <el-collapse-item title="進階參數設定" name="advanced">
                <el-row :gutter="16">
                  <!-- 影片秒數 -->
                  <el-col :span="12">
                    <el-form-item label="影片長度">
                      <el-select v-model="videoSettings.durationSeconds" style="width: 100%">
                        <el-option
                          v-for="opt in durationOptions"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                      </el-select>
                    </el-form-item>
                  </el-col>

                  <!-- 解析度 -->
                  <el-col :span="12">
                    <el-form-item label="解析度">
                      <el-select v-model="videoSettings.resolution" style="width: 100%">
                        <el-option
                          v-for="opt in resolutionOptions"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                      </el-select>
                    </el-form-item>
                  </el-col>

                  <!-- 寬高比 -->
                  <el-col :span="12">
                    <el-form-item label="寬高比">
                      <el-select v-model="videoSettings.aspectRatio" style="width: 100%">
                        <el-option
                          v-for="opt in aspectRatioOptions"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                      </el-select>
                    </el-form-item>
                  </el-col>

                  <!-- 優化提示詞 -->
                  <el-col :span="12">
                    <el-form-item label="優化提示詞">
                      <el-switch
                        v-model="videoSettings.enhancePrompt"
                        active-text="開啟"
                        inactive-text="關閉"
                      />
                      <el-tooltip content="讓 AI 自動優化你的提示詞，產生更好的影片效果" placement="top">
                        <el-icon class="info-icon"><InfoFilled /></el-icon>
                      </el-tooltip>
                    </el-form-item>
                  </el-col>
                </el-row>
              </el-collapse-item>
            </el-collapse>
          </div>

          <!-- 生成按鈕 -->
          <div class="action-section">
            <el-button
              type="primary"
              size="large"
              :loading="generating"
              :disabled="!imagePreview"
              @click="handleGenerate"
            >
              <el-icon v-if="!generating"><VideoCamera /></el-icon>
              {{ generating ? '生成中...' : '生成影片' }}
            </el-button>
            <div v-if="generating" class="generating-hint">
              影片生成需要 30-60 秒，請耐心等待...
            </div>
          </div>

          <!-- 生成結果 -->
          <div v-if="generatedVideo" class="result-section">
            <el-divider>生成結果</el-divider>
            <div class="video-result">
              <video
                :src="generatedVideo.videoUrl"
                controls
                autoplay
                loop
                class="result-video"
              />
              <div class="video-info">
                <el-descriptions :column="2" size="small" border>
                  <el-descriptions-item label="時長">
                    {{ generatedVideo.duration }}
                  </el-descriptions-item>
                  <el-descriptions-item label="解析度">
                    {{ generatedVideo.resolution }}
                  </el-descriptions-item>
                  <el-descriptions-item label="寬高比">
                    {{ generatedVideo.aspectRatio || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="大小">
                    {{ formatSize(generatedVideo.size) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="提供者">
                    {{ generatedVideo.provider }}
                  </el-descriptions-item>
                </el-descriptions>
                <div class="video-actions">
                  <el-button type="primary" @click="downloadVideo">
                    <el-icon><Download /></el-icon> 下載影片
                  </el-button>
                  <el-button @click="copyVideoUrl">
                    <el-icon><CopyDocument /></el-icon> 複製連結
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右側：歷史記錄 -->
      <el-col :span="10">
        <el-card class="history-card">
          <template #header>
            <div class="card-header">
              <span>生成歷史</span>
              <el-button text @click="loadHistory">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </div>
          </template>

          <div v-loading="loading" class="history-list">
            <div
              v-for="video in history"
              :key="video.id"
              class="history-item"
            >
              <video
                :src="video.videoUrl"
                class="history-thumbnail"
                muted
                @click="selectHistoryVideo(video)"
                @mouseenter="$event.target.play()"
                @mouseleave="$event.target.pause()"
              />
              <div class="history-info" @click="selectHistoryVideo(video)">
                <div class="history-date">
                  {{ formatDate(video.createdAt) }}
                </div>
                <div class="history-meta">
                  {{ video.provider }} · {{ video.duration }}
                </div>
              </div>
              <div class="history-actions">
                <el-popconfirm
                  title="確定要刪除這個影片記錄嗎？"
                  confirm-button-text="刪除"
                  cancel-button-text="取消"
                  confirm-button-type="danger"
                  @confirm="handleDeleteVideo(video.id)"
                >
                  <template #reference>
                    <el-button
                      type="danger"
                      size="small"
                      :icon="Delete"
                      circle
                      plain
                    />
                  </template>
                </el-popconfirm>
              </div>
            </div>

            <el-empty v-if="!loading && history.length === 0" description="暫無生成記錄" />
          </div>

          <!-- 分頁 -->
          <div v-if="pagination.total > pagination.limit" class="history-pagination">
            <el-pagination
              v-model:current-page="pagination.page"
              :page-size="pagination.limit"
              :total="pagination.total"
              layout="prev, pager, next"
              small
              @current-change="changePage"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Upload,
  VideoCamera,
  Download,
  CopyDocument,
  Refresh,
  InfoFilled,
  Delete,
} from '@element-plus/icons-vue';
import { useVideoGeneration } from '../composables/useVideoGeneration';

const {
  loading,
  generating,
  providers,
  currentProvider,
  history,
  generatedVideo,
  videoSettings,
  pagination,
  resolutionOptions,
  aspectRatioOptions,
  durationOptions,
  loadProviders,
  generateVideo,
  loadHistory,
  changePage,
  deleteVideo,
} = useVideoGeneration();

const uploadRef = ref(null);
const imagePreview = ref(null);
const imageBase64 = ref(null);
const prompt = ref('');
const showAdvanced = ref(['advanced']); // 預設展開進階設定

// 初始化
onMounted(async () => {
  await loadProviders();
  await loadHistory();
});

// 處理圖片選擇
const handleImageChange = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.value = e.target.result;
    imageBase64.value = e.target.result;
  };
  reader.readAsDataURL(file.raw);
};

// 清除圖片
const clearImage = () => {
  imagePreview.value = null;
  imageBase64.value = null;
  if (uploadRef.value) {
    uploadRef.value.clearFiles();
  }
};

// 生成影片
const handleGenerate = async () => {
  if (!imageBase64.value) {
    ElMessage.error('請先選擇圖片');
    return;
  }

  await generateVideo(imageBase64.value, prompt.value, {
    provider: currentProvider.value,
    durationSeconds: videoSettings.durationSeconds,
    resolution: videoSettings.resolution,
    aspectRatio: videoSettings.aspectRatio,
    enhancePrompt: videoSettings.enhancePrompt,
  });
};

// 選擇歷史記錄中的影片
const selectHistoryVideo = (video) => {
  generatedVideo.value = video;
};

// 刪除影片記錄
const handleDeleteVideo = async (id) => {
  await deleteVideo(id);
};

// 下載影片
const downloadVideo = () => {
  if (!generatedVideo.value?.videoUrl) return;

  const link = document.createElement('a');
  link.href = generatedVideo.value.videoUrl;
  link.download = `video-${Date.now()}.mp4`;
  link.target = '_blank';
  link.click();
};

// 複製影片連結
const copyVideoUrl = async () => {
  if (!generatedVideo.value?.videoUrl) return;

  try {
    await navigator.clipboard.writeText(generatedVideo.value.videoUrl);
    ElMessage.success('連結已複製');
  } catch {
    ElMessage.error('複製失敗');
  }
};

// 格式化檔案大小
const formatSize = (bytes) => {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<style scoped>
.video-generation-page {
  padding: 20px;
}

.page-description {
  color: #909399;
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.generate-card,
.history-card {
  height: 100%;
}

/* 上傳區域 */
.upload-section {
  margin-bottom: 24px;
}

.image-uploader {
  width: 100%;
}

.image-uploader :deep(.el-upload) {
  width: 100%;
}

.image-uploader :deep(.el-upload-dragger) {
  width: 100%;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-placeholder {
  text-align: center;
}

.upload-icon {
  font-size: 48px;
  color: #c0c4cc;
  margin-bottom: 16px;
}

.upload-text {
  font-size: 16px;
  color: #606266;
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 12px;
  color: #909399;
}

.preview-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.preview-image {
  max-width: 100%;
  max-height: 280px;
  object-fit: contain;
}

.preview-overlay {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.3s;
}

.preview-container:hover .preview-overlay {
  opacity: 1;
}

/* 提供者選擇 */
.provider-section {
  margin-bottom: 16px;
}

.info-icon {
  margin-left: 4px;
  color: #909399;
}

/* 進階設定 */
.advanced-settings {
  margin-bottom: 16px;
}

.settings-collapse {
  margin-top: 16px;
  border: none;
}

.settings-collapse :deep(.el-collapse-item__header) {
  background: #f5f7fa;
  padding: 0 12px;
  border-radius: 4px;
  font-size: 14px;
  color: #606266;
}

.settings-collapse :deep(.el-collapse-item__content) {
  padding: 16px 0 0 0;
}

.settings-collapse :deep(.el-form-item) {
  margin-bottom: 12px;
}

.settings-collapse :deep(.el-form-item__label) {
  font-size: 13px;
  color: #606266;
}

/* 生成按鈕 */
.action-section {
  text-align: center;
  margin-bottom: 24px;
}

.generating-hint {
  margin-top: 12px;
  color: #909399;
  font-size: 14px;
}

/* 生成結果 */
.result-section {
  margin-top: 24px;
}

.video-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-video {
  width: 100%;
  max-height: 400px;
  background: #000;
  border-radius: 8px;
}

.video-actions {
  margin-top: 12px;
  display: flex;
  gap: 12px;
}

/* 歷史記錄 */
.history-list {
  max-height: 600px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
}

.history-item:hover {
  background: #f5f7fa;
}

.history-thumbnail {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  background: #000;
}

.history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.history-date {
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
}

.history-meta {
  font-size: 12px;
  color: #909399;
}

.history-actions {
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.history-item:hover .history-actions {
  opacity: 1;
}

.history-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}
</style>
