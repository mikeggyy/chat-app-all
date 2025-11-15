import { ref, watch, computed, type Ref, type ComputedRef } from "vue";
import { CHARACTER_CREATION_LIMITS } from "../../config/characterCreation.js";

// ✅ 使用集中化配置
const DESCRIPTION_MAX_LENGTH = CHARACTER_CREATION_LIMITS.MAX_APPEARANCE_PREVIEW_LENGTH;

/**
 * Sanitizes text by escaping HTML special characters
 * @param value - The text to sanitize
 * @returns Sanitized text
 */
const sanitizeText = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/[&<>"'`]/g, (char: string): string => {
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

/**
 * Desanitizes text by unescaping HTML special characters
 * @param value - The text to desanitize
 * @returns Desanitized text
 */
const desanitizeText = (value: unknown): string => {
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

/**
 * Stored state data structure
 */
interface StoredStateData {
  description?: string;
}

/**
 * Save state callback function type
 */
type SaveStateCallback = (data: StoredStateData) => void;

/**
 * Return type for useAppearanceDescription composable
 */
interface UseAppearanceDescriptionReturn {
  description: Ref<string>;
  descriptionCharCount: ComputedRef<number>;
  maxLength: number;
  loadDescriptionFromStorage: (storedData: StoredStateData) => void;
  updateDescription: (newValue: string) => void;
  sanitizeText: (value: unknown) => string;
  desanitizeText: (value: unknown) => string;
}

/**
 * Composable for managing appearance description in character creation flow
 *
 * Provides reactive description state with:
 * - Automatic sanitization for storage
 * - Character count tracking
 * - Length validation and truncation
 * - Auto-save to session storage via callback
 *
 * @param saveStateCallback - Optional callback to save state changes
 * @returns Object containing description state and utility functions
 */
export function useAppearanceDescription(
  saveStateCallback?: SaveStateCallback
): UseAppearanceDescriptionReturn {
  const description = ref<string>("");

  const descriptionCharCount = computed(() => {
    return description.value.length;
  });

  // 自動保存描述到 sessionStorage
  watch(
    () => description.value,
    (value: string) => {
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

  const loadDescriptionFromStorage = (storedData: StoredStateData): void => {
    if (typeof storedData.description === "string") {
      description.value = desanitizeText(storedData.description).slice(
        0,
        DESCRIPTION_MAX_LENGTH
      );
    }
  };

  const updateDescription = (newValue: string): void => {
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
