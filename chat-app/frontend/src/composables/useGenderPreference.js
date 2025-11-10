import { ref } from "vue";

const GENDER_STORAGE_KEY = "characterCreation.gender";
const ALLOWED_GENDERS = new Set(["male", "female", "non-binary"]);

/**
 * Gender Preference Composable
 * 管理角色創建過程中的性別偏好設置
 */
export function useGenderPreference() {
  const genderPreference = ref("");

  /**
   * 標準化性別值
   * @param {string} value - 待標準化的性別值
   * @returns {string} 標準化後的性別值，無效則返回空字串
   */
  const normalizeGenderPreference = (value) => {
    if (typeof value !== "string") {
      return "";
    }
    const trimmed = value.trim();
    return ALLOWED_GENDERS.has(trimmed) ? trimmed : "";
  };

  /**
   * 從 sessionStorage 讀取已儲存的性別偏好
   * @returns {string} 儲存的性別值，失敗則返回空字串
   */
  const readStoredGenderPreference = () => {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return "";
    }
    try {
      return window.sessionStorage.getItem(GENDER_STORAGE_KEY) ?? "";
    } catch (error) {
      return "";
    }
  };

  /**
   * 確保性別偏好已設置（優先使用參數值，其次使用儲存值）
   * @param {string} value - 候選性別值
   * @returns {string} 最終確定的性別值
   */
  const ensureGenderPreference = (value) => {
    const normalized = normalizeGenderPreference(value);
    if (normalized) {
      genderPreference.value = normalized;
      return normalized;
    }
    const stored = normalizeGenderPreference(readStoredGenderPreference());
    if (stored) {
      genderPreference.value = stored;
      return stored;
    }
    genderPreference.value = "";
    return "";
  };

  return {
    genderPreference,
    normalizeGenderPreference,
    readStoredGenderPreference,
    ensureGenderPreference,
  };
}
