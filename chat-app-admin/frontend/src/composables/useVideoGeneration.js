import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../utils/api';

/**
 * 影片生成 Composable
 * 管理影片生成功能的狀態和 API 調用
 */
export function useVideoGeneration() {
  const loading = ref(false);
  const generating = ref(false);
  const providers = ref([]);
  const currentProvider = ref('hailuo');
  const history = ref([]);
  const generatedVideo = ref(null);

  // 分頁狀態
  const pagination = reactive({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // 進階參數設定
  const videoSettings = reactive({
    durationSeconds: 8,
    resolution: '720p',
    aspectRatio: '9:16',
    enhancePrompt: true,
  });

  // 可用選項
  const resolutionOptions = [
    { value: '480p', label: '480p (省流量)' },
    { value: '512p', label: '512p (標準)' },
    { value: '720p', label: '720p (高清)' },
    { value: '1080p', label: '1080p (全高清)' },
  ];

  const aspectRatioOptions = [
    { value: '9:16', label: '9:16 (直式)' },
    { value: '16:9', label: '16:9 (橫式)' },
    { value: '1:1', label: '1:1 (正方形)' },
    { value: '4:3', label: '4:3 (傳統)' },
    { value: '3:4', label: '3:4 (直式傳統)' },
  ];

  const durationOptions = [
    { value: 4, label: '4 秒' },
    { value: 6, label: '6 秒' },
    { value: 8, label: '8 秒' },
    { value: 10, label: '10 秒' },
  ];

  /**
   * 獲取可用的影片生成提供者
   */
  const loadProviders = async () => {
    try {
      const response = await api.get('/api/video-generation/providers');
      if (response.success) {
        providers.value = response.providers;
        currentProvider.value = response.currentProvider;
        // 如果有預設設定，更新 videoSettings
        if (response.defaultSettings) {
          Object.assign(videoSettings, response.defaultSettings);
        }
      }
    } catch (error) {
      console.error('獲取提供者列表失敗:', error);
    }
  };

  /**
   * 生成影片
   * @param {string} imageUrl - 圖片 URL 或 base64
   * @param {string} prompt - 可選的提示詞
   * @param {object} options - 可選的進階設定
   */
  const generateVideo = async (imageUrl, prompt = '', options = {}) => {
    if (!imageUrl) {
      ElMessage.error('請選擇圖片');
      return null;
    }

    generating.value = true;
    generatedVideo.value = null;

    try {
      const response = await api.post('/api/video-generation/generate', {
        imageUrl,
        prompt,
        provider: options.provider || currentProvider.value,
        durationSeconds: options.durationSeconds ?? videoSettings.durationSeconds,
        resolution: options.resolution || videoSettings.resolution,
        aspectRatio: options.aspectRatio || videoSettings.aspectRatio,
        enhancePrompt: options.enhancePrompt ?? videoSettings.enhancePrompt,
      });

      if (response.success) {
        generatedVideo.value = response;
        ElMessage.success('影片生成成功');
        // 刷新歷史記錄
        await loadHistory();
        return response;
      } else {
        ElMessage.error(response.error || '影片生成失敗');
        return null;
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.error || error.message || '影片生成失敗');
      return null;
    } finally {
      generating.value = false;
    }
  };

  /**
   * 獲取生成歷史（支援分頁）
   * @param {number} page - 頁碼
   */
  const loadHistory = async (page = 1) => {
    loading.value = true;
    try {
      const response = await api.get('/api/video-generation/history', {
        params: {
          page,
          limit: pagination.limit,
        },
      });
      if (response.success) {
        history.value = response.videos;
        if (response.pagination) {
          pagination.page = response.pagination.page;
          pagination.total = response.pagination.total;
          pagination.totalPages = response.pagination.totalPages;
        }
      }
    } catch (error) {
      console.error('獲取歷史記錄失敗:', error);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 切換頁碼
   * @param {number} page - 新頁碼
   */
  const changePage = async (page) => {
    await loadHistory(page);
  };

  /**
   * 刪除影片記錄
   * @param {string} id - 記錄 ID
   */
  const deleteVideo = async (id) => {
    if (!id) {
      ElMessage.error('無效的記錄 ID');
      return false;
    }

    try {
      const response = await api.delete(`/api/video-generation/history/${id}`);
      if (response.success) {
        // 如果刪除的是當前顯示的影片，清空顯示
        if (generatedVideo.value?.id === id) {
          generatedVideo.value = null;
        }
        ElMessage.success('記錄已刪除');

        // 重新載入當前頁（如果當前頁只剩一筆且不是第一頁，回到上一頁）
        const shouldGoBack = history.value.length === 1 && pagination.page > 1;
        await loadHistory(shouldGoBack ? pagination.page - 1 : pagination.page);

        return true;
      } else {
        ElMessage.error(response.error || '刪除失敗');
        return false;
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.error || error.message || '刪除失敗');
      return false;
    }
  };

  return {
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
  };
}
