/**
 * Character Creation Helper Functions
 * 角色創建輔助函數
 */

/**
 * 獲取當前時間的 ISO 字串
 * @returns {string} ISO 格式的時間字串
 */
export const isoNow = () => new Date().toISOString();

/**
 * 修剪字串（如果值為字串類型）
 * @param {*} value - 要修剪的值
 * @returns {string} 修剪後的字串，如果不是字串則返回空字串
 */
export const trimString = (value) =>
  typeof value === "string" ? value.trim() : "";
