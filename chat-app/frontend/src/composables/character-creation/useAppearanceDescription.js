import { ref, watch, computed } from "vue";
import { CHARACTER_CREATION_LIMITS } from "../../config/characterCreation.js";

// ✅ 使用集中化配置
const DESCRIPTION_MAX_LENGTH = CHARACTER_CREATION_LIMITS.MAX_APPEARANCE_PREVIEW_LENGTH;

const sanitizeText = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/[&<>"'`]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      case "`":
        return "&#96;";
      default:
        return char;
    }
  });
};

const desanitizeText = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#96;/g, "`")
    .replace(/&amp;/g, "&");
};

export function useAppearanceDescription(saveStateCallback) {
  const description = ref("");

  const descriptionCharCount = computed(() => {
    return description.value.length;
  });

  // 自動保存描述到 sessionStorage
  watch(
    () => description.value,
    (value) => {
      const source = typeof value === "string" ? value : "";
      let normalized = source;
      if (source.length > DESCRIPTION_MAX_LENGTH) {
        normalized = source.slice(0, DESCRIPTION_MAX_LENGTH);
      }
      if (normalized !== description.value) {
        description.value = normalized;
        return;
      }
      const sanitized = sanitizeText(normalized);
      if (saveStateCallback) {
        saveStateCallback({ description: sanitized });
      }
    }
  );

  const loadDescriptionFromStorage = (storedData) => {
    if (typeof storedData.description === "string") {
      description.value = desanitizeText(storedData.description).slice(
        0,
        DESCRIPTION_MAX_LENGTH
      );
    }
  };

  const updateDescription = (newValue) => {
    description.value = newValue;
  };

  return {
    description,
    descriptionCharCount,
    maxLength: DESCRIPTION_MAX_LENGTH,
    loadDescriptionFromStorage,
    updateDescription,
    sanitizeText,
    desanitizeText,
  };
}
