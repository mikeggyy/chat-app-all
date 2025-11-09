import { apiJson } from "../utils/api.js";

const BASE_PATH = "/api/voices";

/**
 * 獲取所有可用語音列表
 * @returns {Promise<{service: string, count: number, voices: Array}>}
 */
export const fetchAllVoices = async () => {
  try {
    const response = await apiJson(BASE_PATH);
    return response;
  } catch (error) {
    console.error('[Voices Service] 獲取語音列表失敗:', error);
    throw error;
  }
};

/**
 * 獲取推薦的語音列表（台灣語音優先）
 * @returns {Promise<{service: string, count: number, voices: Array}>}
 */
export const fetchRecommendedVoices = async () => {
  try {
    const response = await apiJson(`${BASE_PATH}/recommended`);
    return response;
  } catch (error) {
    console.error('[Voices Service] 獲取推薦語音失敗:', error);
    throw error;
  }
};

/**
 * 按語言分組獲取語音
 * @returns {Promise<{service: string, locales: Array, voices: Object}>}
 */
export const fetchVoicesByLocale = async () => {
  try {
    const response = await apiJson(`${BASE_PATH}/by-locale`);
    return response;
  } catch (error) {
    console.error('[Voices Service] 獲取分組語音失敗:', error);
    throw error;
  }
};

/**
 * 獲取當前使用的 TTS 服務資訊
 * @returns {Promise<{service: string, name: string, features: Object}>}
 */
export const fetchTTSServiceInfo = async () => {
  try {
    const response = await apiJson(`${BASE_PATH}/service`);
    return response;
  } catch (error) {
    console.error('[Voices Service] 獲取 TTS 服務資訊失敗:', error);
    throw error;
  }
};

/**
 * 獲取語音映射表（OpenAI → Google）
 * @returns {Promise<{mapping: Object, description: string}>}
 */
export const fetchVoiceMapping = async () => {
  try {
    const response = await apiJson(`${BASE_PATH}/mapping`);
    return response;
  } catch (error) {
    console.error('[Voices Service] 獲取語音映射失敗:', error);
    throw error;
  }
};

/**
 * 語言代碼映射（用於 UI 顯示）
 */
export const LOCALE_NAMES = {
  'cmn-TW': '繁體中文（台灣）',
  'cmn-CN': '簡體中文（中國）',
  'yue-HK': '粵語（香港）',
  'ja-JP': '日語',
  'ko-KR': '韓語',
  'en-US': '英語（美國）',
  'multi': '多語言',
};

/**
 * 性別映射（用於 UI 顯示）
 */
export const GENDER_NAMES = {
  'FEMALE': '女性',
  'MALE': '男性',
  'NEUTRAL': '中性',
};

/**
 * 品質等級映射（用於 UI 顯示）
 */
export const QUALITY_NAMES = {
  'Wavenet': 'Wavenet（最高品質）',
  'Neural2': 'Neural2（高品質）',
  'Standard': '標準品質',
};
