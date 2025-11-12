import { ref, computed } from 'vue';
import { fetchAllVoices } from '../../services/voices.service.js';
import { logger } from '../../utils/logger.js';

/**
 * 語音列表加載管理
 * 負責從 API 載入語音列表，並提供備用語音列表
 */
export function useVoiceLoading() {
  // 從 API 動態載入的語音列表
  const voicePresetsFromAPI = ref([]);
  const isLoadingVoices = ref(false);
  const voicesLoadError = ref(null);

  // 備用的 OpenAI 語音列表（當 API 調用失敗時使用）
  const fallbackVoicePresets = [
    {
      id: 'alloy',
      label: '沉穩中性',
      description: '沉穩偏中性的聲音，語調俐落，適合可靠型角色或系統語音。',
      gender: 'MALE',
      ageGroup: 'adult',
      locale: 'multi',
      previewUrl: '/voices/alloy.mp3',
    },
    {
      id: 'ash',
      label: '理性沉著',
      description: '冷靜溫和的男聲，語速平穩，給人理性、沉著的感受。',
      gender: 'MALE',
      ageGroup: 'adult',
      locale: 'multi',
      previewUrl: '/voices/ash.mp3',
    },
    {
      id: 'ballad',
      label: '柔和抒情',
      description: '柔和抒情的男聲，語氣帶有故事感，適合敘事或情感場景。',
      gender: 'MALE',
      ageGroup: 'adult',
      locale: 'multi',
      previewUrl: '/voices/ballad.mp3',
    },
    {
      id: 'coral',
      label: '活力清爽',
      description: '充滿活力的女聲，語氣清爽有精神，能營造親切友善氛圍。',
      gender: 'FEMALE',
      ageGroup: 'teen',
      locale: 'multi',
      previewUrl: '/voices/coral.mp3',
    },
    {
      id: 'echo',
      label: '低沉磁性',
      description: '低沈厚實的男聲，聲線帶有磁性，適合作為敘述者或權威角色。',
      gender: 'MALE',
      ageGroup: 'mature',
      locale: 'multi',
      previewUrl: '/voices/echo.mp3',
    },
    {
      id: 'fable',
      label: '溫暖柔和',
      description: '溫暖的男聲，語調自然柔和，帶有陪伴與照顧的感受。',
      gender: 'MALE',
      ageGroup: 'adult',
      locale: 'multi',
      previewUrl: '/voices/fable.mp3',
    },
    {
      id: 'onyx',
      label: '堅定專業',
      description: '堅定有力的男聲，語氣清晰，適合專業與指令型角色。',
      gender: 'MALE',
      ageGroup: 'adult',
      locale: 'multi',
      previewUrl: '/voices/onyx.mp3',
    },
    {
      id: 'nova',
      label: '輕快親切',
      description: '輕快親切的女聲，語氣充滿好奇心，適合歡迎或導覽場景。',
      gender: 'FEMALE',
      ageGroup: 'teen',
      locale: 'multi',
      previewUrl: '/voices/nova.mp3',
    },
    {
      id: 'sage',
      label: '成熟知性',
      description: '穩重睿智的女聲，語調柔和而有深度，帶來安心感。',
      gender: 'FEMALE',
      ageGroup: 'mature',
      locale: 'multi',
      previewUrl: '/voices/sage.mp3',
    },
    {
      id: 'shimmer',
      label: '明亮靈動',
      description: '明亮靈動的女聲，節奏輕盈，適合活潑或創意型角色。',
      gender: 'FEMALE',
      ageGroup: 'teen',
      locale: 'multi',
      previewUrl: '/voices/shimmer.mp3',
    },
    {
      id: 'verse',
      label: '詩意感性',
      description: '帶有詩意的男聲，語調富有層次，適合敘事與感性表達。',
      gender: 'MALE',
      ageGroup: 'adult',
      locale: 'multi',
      previewUrl: '/voices/verse.mp3',
    },
  ];

  /**
   * 實際使用的語音列表（優先使用從 API 載入的）
   */
  const voicePresets = computed(() =>
    voicePresetsFromAPI.value.length > 0
      ? voicePresetsFromAPI.value
      : fallbackVoicePresets
  );

  /**
   * 從後端 API 載入語音列表
   */
  const loadVoicesFromAPI = async () => {
    isLoadingVoices.value = true;
    voicesLoadError.value = null;

    try {
      const response = await fetchAllVoices();

      if (response?.voices && Array.isArray(response.voices)) {
        // 轉換 API 返回的語音格式
        voicePresetsFromAPI.value = response.voices.map((voice) => ({
          id: voice.id,
          label: voice.name || voice.id,
          description: voice.description || '',
          gender: voice.gender || 'NEUTRAL',
          ageGroup: voice.ageGroup || 'adult',
          locale: voice.locale || 'multi',
          quality: voice.quality || 'Standard',
          recommended: voice.recommended || false,
          previewUrl: voice.previewUrl || `/voices/${voice.id}.mp3`,
        }));

        logger.log(
          `[Voices] 成功載入 ${voicePresetsFromAPI.value.length} 種語音`
        );
      } else {
        logger.warn('[Voices] API 返回格式異常，使用備用語音列表');
      }
    } catch (error) {
      logger.error('[Voices] 載入語音失敗，使用備用語音列表:', error);
      voicesLoadError.value = error.message || '載入語音失敗';
    } finally {
      isLoadingVoices.value = false;
    }
  };

  /**
   * 解析預覽 URL
   */
  const resolvePreviewUrl = (voiceId) => {
    if (!voiceId) {
      return '';
    }
    const preset = voicePresets.value.find((item) => item.id === voiceId);
    return preset?.previewUrl ?? '';
  };

  return {
    voicePresets,
    voicePresetsFromAPI,
    fallbackVoicePresets,
    isLoadingVoices,
    voicesLoadError,
    loadVoicesFromAPI,
    resolvePreviewUrl,
  };
}
