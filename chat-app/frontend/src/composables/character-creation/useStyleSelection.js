import { ref, onMounted } from "vue";
import { apiJson } from "../../utils/api.js";

const STYLE_THUMBNAIL_BASE = "/character-create/styles";
const STYLE_VERSION = "v2";

export function useStyleSelection() {
  const styleOptions = ref([]);
  const isLoadingStyles = ref(false);

  const loadCharacterStyles = async () => {
    isLoadingStyles.value = true;
    try {
      const response = await apiJson("/api/character-styles", {
        skipGlobalLoading: true,
      });

      if (response?.styles && Array.isArray(response.styles)) {
        styleOptions.value = response.styles.map((style) => ({
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

  const validateStyles = (selectedStyles) => {
    if (selectedStyles.length === 0) {
      return selectedStyles;
    }

    const validStyles = selectedStyles.filter((styleId) =>
      styleOptions.value.some((option) => option.id === styleId)
    );

    return validStyles;
  };

  const checkStyleVersion = () => {
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
