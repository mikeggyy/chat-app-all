/**
 * API 響應優化工具
 * 用於移除不必要的字段，減少響應體積
 */

import logger from './logger.js';

/**
 * 敏感字段列表（永遠不應該返回給客戶端）
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'salt',
  'secret',
  'privateKey',
  'apiKey',
  'token',
  'refreshToken',
  'sessionId',
  '__v', // Mongoose version key
];

/**
 * 常見的冗餘字段（可以選擇性移除）
 */
const REDUNDANT_FIELDS = [
  'updatedAt', // 除非需要，否則可以省略
  '_id', // 如果已有 id 字段
];

/**
 * 字段選擇器配置
 */
const FIELD_SELECTORS = {
  // 用戶資料 - 公開版本（用於顯示給其他用戶）
  userPublic: {
    include: ['id', 'displayName', 'photoURL', 'membershipTier'],
    exclude: ['email', 'favorites', 'conversations', 'assets', 'createdAt'],
  },

  // 用戶資料 - 完整版本（用於當前用戶）
  userFull: {
    exclude: ['password', 'passwordHash', 'salt'],
  },

  // 角色資料 - 列表版本（用於列表顯示）
  // ✅ 效能優化：移除不必要的字段，減少響應大小
  characterList: {
    include: [
      'id',
      'display_name',
      'gender',
      'portraitUrl',
      'tags',
      'totalChatUsers',
      'totalFavorites',
      'background',
      // 移除 'first_message' - 對話時才需要
      // 移除 'voice' - 對話時才需要
    ],
    exclude: ['secret_background', 'creatorUid', 'updatedAt'],
  },

  // 角色資料 - 詳細版本（用於對話頁面）
  characterDetail: {
    exclude: ['secret_background', 'creatorUid', 'updatedAt'],
  },

  // 消息資料
  message: {
    include: ['id', 'role', 'text', 'imageUrl', 'videoUrl', 'createdAt'],
    exclude: ['userId', 'characterId', 'metadata'],
  },

  // 對話歷史 - 簡化版本（用於對話列表）
  conversationHistory: {
    include: [
      'id',
      'characterId',
      'character', // 保留角色信息（會進一步優化）
      'lastMessage',
      'lastMessageAt',
      'partnerLastMessage',
      'partnerLastRepliedAt',
      'unreadCount',
      'updatedAt', // 用於排序
    ],
    // ✅ 移除 exclude：白名單模式（include）已經只保留指定字段，exclude 是冗餘的
    // ✅ 嵌套字段自動優化：character 字段自動應用 characterList 選擇器
    nested: {
      character: 'characterList', // 自動優化嵌套的 character 對象
    },
  },
};

/**
 * 移除敏感字段
 * @param {Object} data - 數據對象
 * @param {Array<string>} additionalFields - 額外要移除的字段
 * @returns {Object} 清理後的數據
 */
export function removeSensitiveFields(data, additionalFields = []) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const fieldsToRemove = [...SENSITIVE_FIELDS, ...additionalFields];
  const cleaned = Array.isArray(data) ? [] : {};

  if (Array.isArray(data)) {
    return data.map((item) => removeSensitiveFields(item, additionalFields));
  }

  Object.keys(data).forEach((key) => {
    if (fieldsToRemove.includes(key)) {
      return; // 跳過敏感字段
    }

    const value = data[key];

    // 遞歸處理嵌套對象
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = removeSensitiveFields(value, additionalFields);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item) =>
        typeof item === 'object' ? removeSensitiveFields(item, additionalFields) : item
      );
    } else {
      cleaned[key] = value;
    }
  });

  return cleaned;
}

/**
 * 選擇指定的字段
 * @param {Object} data - 數據對象
 * @param {Array<string>} fields - 要保留的字段列表
 * @returns {Object} 篩選後的數據
 */
export function pick(data, fields) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  const result = {};

  fields.forEach((field) => {
    // 支持嵌套字段（例如：'user.name'）
    if (field.includes('.')) {
      const parts = field.split('.');
      const firstKey = parts[0];

      if (data[firstKey] !== undefined) {
        result[firstKey] = result[firstKey] || {};
        let current = data[firstKey];
        let target = result[firstKey];

        for (let i = 1; i < parts.length - 1; i++) {
          const key = parts[i];
          target[key] = target[key] || {};
          current = current[key];
          target = target[key];
        }

        const lastKey = parts[parts.length - 1];
        if (current && current[lastKey] !== undefined) {
          target[lastKey] = current[lastKey];
        }
      }
    } else if (data[field] !== undefined) {
      result[field] = data[field];
    }
  });

  return result;
}

/**
 * 排除指定的字段
 * @param {Object} data - 數據對象
 * @param {Array<string>} fields - 要排除的字段列表
 * @returns {Object} 篩選後的數據
 */
export function omit(data, fields) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  const result = { ...data };

  fields.forEach((field) => {
    delete result[field];
  });

  return result;
}

/**
 * 使用預定義的字段選擇器
 * @param {Object|Array} data - 數據對象或數組
 * @param {string} selectorName - 選擇器名稱
 * @returns {Object|Array} 優化後的數據
 */
export function applySelector(data, selectorName) {
  const selector = FIELD_SELECTORS[selectorName];

  if (!selector) {
    logger.warn(`[Response Optimizer] 找不到選擇器: ${selectorName}`);
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => applySelector(item, selectorName));
  }

  let result = data;

  // 先應用 include（如果有）
  if (selector.include && Array.isArray(selector.include)) {
    result = pick(result, selector.include);
  }

  // 再應用 exclude（如果有）
  if (selector.exclude && Array.isArray(selector.exclude)) {
    result = omit(result, selector.exclude);
  }

  // ✅ 自動處理嵌套字段優化
  if (selector.nested && typeof selector.nested === 'object') {
    Object.keys(selector.nested).forEach((fieldName) => {
      const nestedSelector = selector.nested[fieldName];

      // 如果該字段存在，應用嵌套選擇器
      if (result[fieldName]) {
        result[fieldName] = applySelector(result[fieldName], nestedSelector);
      }
    });
  }

  return result;
}

/**
 * 創建優化的響應
 * @param {Object} data - 響應數據
 * @param {Object} options - 選項
 * @param {string} options.selector - 字段選擇器名稱
 * @param {Array<string>} options.include - 要包含的字段
 * @param {Array<string>} options.exclude - 要排除的字段
 * @param {boolean} options.removeSensitive - 是否移除敏感字段（默認 true）
 * @returns {Object} 優化後的響應
 */
export function optimizeResponse(data, options = {}) {
  const {
    selector = null,
    include = null,
    exclude = null,
    removeSensitive = true,
  } = options;

  let result = data;

  // 1. 移除敏感字段
  if (removeSensitive) {
    result = removeSensitiveFields(result);
  }

  // 2. 應用字段選擇器
  if (selector) {
    result = applySelector(result, selector);
  }

  // 3. 應用自定義 include
  if (include && Array.isArray(include)) {
    result = pick(result, include);
  }

  // 4. 應用自定義 exclude
  if (exclude && Array.isArray(exclude)) {
    result = omit(result, exclude);
  }

  return result;
}

/**
 * Express 中間件：自動優化響應
 * @param {string} selectorName - 選擇器名稱
 * @returns {Function} Express 中間件
 */
export function optimizeMiddleware(selectorName) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      const optimizedData = applySelector(data, selectorName);
      return originalJson(optimizedData);
    };

    next();
  };
}

/**
 * 計算響應大小（估算）
 * @param {*} data - 數據
 * @returns {number} 大小（字節）
 */
export function estimateSize(data) {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch (error) {
    // Node.js 環境中沒有 Blob，使用 Buffer
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }
}

/**
 * 比較優化前後的大小
 * @param {*} original - 原始數據
 * @param {*} optimized - 優化後的數據
 * @returns {Object} 比較結果
 */
export function compareSize(original, optimized) {
  const originalSize = estimateSize(original);
  const optimizedSize = estimateSize(optimized);
  const saved = originalSize - optimizedSize;
  const percentage = ((saved / originalSize) * 100).toFixed(2);

  return {
    originalSize,
    optimizedSize,
    saved,
    percentage: parseFloat(percentage),
  };
}

/**
 * 分頁響應優化
 * @param {Array} items - 項目列表
 * @param {Object} pagination - 分頁信息
 * @param {string} selector - 字段選擇器
 * @returns {Object} 優化的分頁響應
 */
export function optimizePaginatedResponse(items, pagination, selector = null) {
  const optimizedItems = selector ? applySelector(items, selector) : items;

  return {
    items: optimizedItems,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || items.length,
      total: pagination.total || items.length,
      hasMore: pagination.hasMore || false,
    },
  };
}

export default {
  removeSensitiveFields,
  pick,
  omit,
  applySelector,
  optimizeResponse,
  optimizeMiddleware,
  estimateSize,
  compareSize,
  optimizePaginatedResponse,
  FIELD_SELECTORS,
};
