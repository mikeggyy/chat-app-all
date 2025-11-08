/**
 * LRU (Least Recently Used) 緩存實現
 * 用於緩存圖片、API 響應等資源
 */

import logger from "./logger.js";

/**
 * LRU 緩存類
 */
export class LRUCache {
  /**
   * 創建 LRU 緩存
   * @param {number} maxSize - 最大緩存項目數
   */
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * 獲取緩存項
   * @param {string} key - 緩存鍵
   * @returns {*} 緩存值，如果不存在則返回 undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // 移動到最前面（最近使用）
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * 設置緩存項
   * @param {string} key - 緩存鍵
   * @param {*} value - 緩存值
   */
  set(key, value) {
    // 如果已存在，先刪除（會在後面重新添加到最前面）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 如果超過最大容量，刪除最舊的項目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, value);
  }

  /**
   * 檢查緩存中是否存在某個鍵
   * @param {string} key - 緩存鍵
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * 刪除緩存項
   * @param {string} key - 緩存鍵
   * @returns {boolean} 是否成功刪除
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * 清空緩存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 獲取緩存大小
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * 獲取緩存統計資訊
   * @returns {Object}
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      usage: (this.cache.size / this.maxSize) * 100,
    };
  }
}

/**
 * 創建圖片緩存實例
 * 用於緩存角色圖片、生成的圖片等
 */
export const imageCache = new LRUCache(200);

/**
 * 預載入角色圖片
 * @param {Array<string>} characterIds - 角色 ID 列表
 * @param {Function} loadImage - 載入圖片的函數
 */
export async function preloadCharacterImages(characterIds, loadImage) {
  logger.info(`開始預載入 ${characterIds.length} 個角色圖片...`);

  let successCount = 0;
  let failCount = 0;

  for (const characterId of characterIds) {
    try {
      const cacheKey = `character:${characterId}`;

      // 檢查是否已緩存
      if (imageCache.has(cacheKey)) {
        continue;
      }

      // 載入並緩存圖片
      const imageData = await loadImage(characterId);
      imageCache.set(cacheKey, imageData);
      successCount++;
    } catch (error) {
      logger.warn(`預載入角色圖片失敗: ${characterId}`, error);
      failCount++;
    }
  }

  logger.info(
    `角色圖片預載入完成: 成功 ${successCount} 個, 失敗 ${failCount} 個`
  );

  return {
    success: successCount,
    failed: failCount,
    total: characterIds.length,
    cacheStats: imageCache.getStats(),
  };
}

export default {
  LRUCache,
  imageCache,
  preloadCharacterImages,
};
