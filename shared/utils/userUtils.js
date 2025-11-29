/**
 * 共享用戶工具函數
 * 供前後端共用，避免代碼重複
 */

/**
 * 正規化性別值
 * @param {any} value - 輸入的性別值
 * @returns {string|null} 標準化的性別值 ("male", "female", "other") 或 null
 */
export const normalizeGender = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }
  const normalized = trimmed.toLowerCase();
  if (["male", "m", "男", "男性"].includes(normalized)) {
    return "male";
  }
  if (["female", "f", "女", "女性"].includes(normalized)) {
    return "female";
  }
  if (["other", "others", "nonbinary", "nb", "其他", "非二元"].includes(normalized)) {
    return "other";
  }
  return trimmed;
};

/**
 * 生成用戶 UID
 * 基於輸入 ID 生成可讀的唯一標識符
 * 格式：6位英文字母數字 + 4位中文字符
 *
 * @param {string} id - 輸入的 ID
 * @returns {string} 生成的 UID (例如: "aB3dEf晨霧星語")
 */
export const generateUid = (id) => {
  const enAlphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const zhAlphabet = ["晨", "霧", "星", "珊", "語", "曦", "嵐", "禾", "晴", "雲"];

  const createSeed = (source = "") => {
    if (!source) return Math.floor(Math.random() * 0xffffffff);
    let seed = 0;
    for (let i = 0; i < source.length; i += 1) {
      seed = (seed * 31 + source.charCodeAt(i)) & 0xffffffff;
    }
    return seed >>> 0;
  };

  const nextSeed = (seed) => {
    return (seed * 1664525 + 1013904223) & 0xffffffff;
  };

  let seed = createSeed(id);
  let englishPart = "";
  for (let i = 0; i < 6; i += 1) {
    seed = nextSeed(seed);
    const index = seed % enAlphabet.length;
    englishPart += enAlphabet.charAt(index);
  }

  let chinesePart = "";
  for (let i = 0; i < 4; i += 1) {
    seed = nextSeed(seed);
    const index = seed % zhAlphabet.length;
    chinesePart += zhAlphabet[index];
  }

  return `${englishPart}${chinesePart}`;
};

/**
 * 正規化陣列值
 * @param {any} value - 輸入值
 * @returns {Array} 標準化的陣列
 */
export const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  return [];
};

/**
 * 修剪字串
 * @param {any} value - 輸入值
 * @returns {string} 修剪後的字串，如果為空則返回空字串
 */
export const trimString = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
};

export default {
  normalizeGender,
  generateUid,
  normalizeArray,
  trimString,
};
