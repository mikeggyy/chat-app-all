import { ref, onMounted } from "vue";
import type { Ref } from "vue";
import { apiJson } from "../../utils/api.js";

const STYLE_THUMBNAIL_BASE = "/character-create/styles";
const STYLE_VERSION = "v2";

/**
 * 角色風格選項介面
 */
export interface StyleOption {
  id: string;
  label: string;
  era: string;
  thumbnail: string;
}

/**
 * API 回應中的風格資料
 */
interface ApiStyleData {
  id: string;
  label: string;
  era: string;
  thumbnail: string;
}

/**
 * API 回應介面
 */
interface StylesApiResponse {
  styles: ApiStyleData[];
}

/**
 * useStyleSelection 返回類型
 */
export interface UseStyleSelectionReturn {
  styleOptions: Ref<StyleOption[]>;
  isLoadingStyles: Ref<boolean>;
  loadCharacterStyles: () => Promise<void>;
  validateStyles: (selectedStyles: string[]) => string[];
  checkStyleVersion: () => boolean;
}

/**
 * 角色創建風格選擇 Composable
 *
 * 提供角色創建流程中的風格選項管理功能：
 * - 從 API 載入可用風格選項
 * - 驗證已選風格的有效性
 * - 檢查風格版本是否需要更新
 */
export function useStyleSelection(): UseStyleSelectionReturn {
  const styleOptions = ref<StyleOption[]>([]);
  const isLoadingStyles = ref<boolean>(false);

  const loadCharacterStyles = async (): Promise<void> => {
    isLoadingStyles.value = true;
    try {
      const response = await apiJson("/api/character-styles", {
        skipGlobalLoading: true,
      }) as StylesApiResponse;

      if (response?.styles && Array.isArray(response.styles)) {
        styleOptions.value = response.styles.map((style: ApiStyleData) => ({
          id: style.id,
          label: style.label,
          era: style.era,
          thumbnail: `${STYLE_THUMBNAIL_BASE}/${style.thumbnail}`,
        }));
      }
    } catch (error) {
      styleOptions.value = [];
    } finally {
      isLoadingStyles.value = false;
    }
  };

  const validateStyles = (selectedStyles: string[]): string[] => {
    if (selectedStyles.length === 0) {
      return selectedStyles;
    }

    const validStyles = selectedStyles.filter((styleId: string) =>
      styleOptions.value.some((option: StyleOption) => option.id === styleId)
    );

    return validStyles;
  };

  const checkStyleVersion = (): boolean => {
    if (typeof window === "undefined") {
      return false;
    }

    const storedVersion = window.sessionStorage?.getItem(
      "characterCreation.styleVersion"
    );

    if (storedVersion !== STYLE_VERSION) {
      try {
        window.sessionStorage.setItem(
          "characterCreation.styleVersion",
          STYLE_VERSION
        );
      } catch (error) {
        // Ignore storage errors
      }
      return false; // Version mismatch, need to clear
    }

    return true; // Version matches
  };

  onMounted(async () => {
    await loadCharacterStyles();
  });

  return {
    styleOptions,
    isLoadingStyles,
    loadCharacterStyles,
    validateStyles,
    checkStyleVersion,
  };
}
