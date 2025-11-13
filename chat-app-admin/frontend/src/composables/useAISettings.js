import { ref, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../utils/api';

/**
 * AI 設定管理 Composable
 * 統一管理所有 AI 相關設定的載入、保存、重置
 */
export function useAISettings() {
  const loading = ref(false);
  const saving = ref(false);
  const saved = ref(false);

  const settings = reactive({
    chat: {
      model: "gpt-4o-mini",
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 150,
      systemPromptTemplate: "",
      description: "對話生成 AI",
    },
    tts: {
      model: "tts-1",
      defaultVoice: "nova",
      availableVoices: ["nova", "alloy", "echo", "fable", "onyx", "shimmer"],
      description: "文字轉語音 AI",
    },
    imageGeneration: {
      model: "gemini-2.5-flash-image",
      aspectRatio: "2:3",
      compressionQuality: 40,
      imagePromptTemplate: "",
      selfieScenarios: [],
      scenarioSelectionChance: 0.7,
      description: "角色自拍照片生成 AI",
    },
    videoGeneration: {
      provider: "hailuo",
      model: "minimax/hailuo-02",
      durationSeconds: 10,
      resolution: "512p",
      sampleCount: 1,
      aspectRatio: "16:9",
      compressionQuality: "optimized",
      enhancePrompt: true,
      personGeneration: "allow_adult",
      enableRetry: true,
      maxRetries: 3,
      useMockVideo: false,
      videoPromptTemplate: "",
      description: "角色影片生成 AI",
    },
    characterPersona: {
      model: "gpt-4o",
      temperature: 0.8,
      topP: 0.95,
      maxNameLength: 8,
      maxTaglineLength: 200,
      maxHiddenProfileLength: 200,
      maxPromptLength: 50,
      personaPromptTemplate: "",
      description: "角色設定生成 AI 魔術師",
    },
    characterImage: {
      model: "gpt-image-1-mini",
      size: "1024x1536",
      quality: "high",
      count: 4,
      imagePromptTemplate: "",
      maxAppearanceDescriptionLength: 60,
      description: "創建角色照片",
    },
    characterAppearance: {
      model: "gpt-4o",
      temperature: 0.7,
      topP: 0.9,
      maxAppearanceLength: 60,
      appearancePromptTemplateWithImage: "",
      appearancePromptTemplateWithoutImage: "",
      description: "形象描述生成 AI 魔術師",
    },
  });

  /**
   * 從後端加載設定
   */
  const loadSettings = async () => {
    loading.value = true;
    try {
      const response = await api.get("/api/ai-settings");
      if (response.success && response.settings) {
        // 只更新存在的設定，避免覆蓋預設值
        Object.keys(response.settings).forEach(key => {
          if (settings[key]) {
            Object.assign(settings[key], response.settings[key]);
          }
        });
        ElMessage.success("設定載入成功");
      } else {
        ElMessage.warning("設定載入失敗：無效的響應格式");
      }
    } catch (error) {
      ElMessage.error("載入設定失敗: " + (error.message || "未知錯誤"));
      console.error("載入 AI 設定失敗:", error);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 保存設定到後端
   */
  const saveSettings = async () => {
    saving.value = true;
    saved.value = false;

    try {
      const response = await api.put("/api/ai-settings", settings);
      if (response.success) {
        saved.value = true;
        ElMessage.success("設定已保存");

        // 3 秒後隱藏成功提示
        setTimeout(() => {
          saved.value = false;
        }, 3000);
      }
    } catch (error) {
      ElMessage.error("保存設定失敗: " + (error.message || "未知錯誤"));
      console.error("保存 AI 設定失敗:", error);
    } finally {
      saving.value = false;
    }
  };

  /**
   * 重置為預設值
   */
  const resetSettings = async () => {
    try {
      await ElMessageBox.confirm(
        "確定要重置所有設定為預設值嗎？此操作不可恢復。",
        "重置確認",
        {
          type: "warning",
          confirmButtonText: "確定重置",
          cancelButtonText: "取消",
        }
      );

      loading.value = true;
      const response = await api.post("/api/ai-settings/reset");
      if (response.success && response.settings) {
        // 只更新存在的設定，避免覆蓋預設值
        Object.keys(response.settings).forEach(key => {
          if (settings[key]) {
            Object.assign(settings[key], response.settings[key]);
          }
        });
        ElMessage.success("已重置為預設值");
      } else {
        ElMessage.warning("重置失敗：無效的響應格式");
      }
    } catch (error) {
      // 用戶取消
      if (error !== "cancel") {
        ElMessage.error("重置失敗: " + (error.message || "未知錯誤"));
      }
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    saving,
    saved,
    settings,
    loadSettings,
    saveSettings,
    resetSettings,
  };
}
