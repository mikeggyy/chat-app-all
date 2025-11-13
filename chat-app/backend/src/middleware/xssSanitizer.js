/**
 * XSS 輸入清理中間件
 * 自動清理所有請求中的潛在 XSS 攻擊向量
 *
 * ✅ 安全性優化：
 * - 清理 req.body 中的所有字串
 * - 清理 req.query 參數
 * - 清理 req.params 參數
 * - 支持深層嵌套對象
 * - 保留必要的 HTML（如 base64 圖片）
 */

import xss from "xss";
import logger from "../utils/logger.js";

/**
 * XSS 清理選項
 * 根據應用需求自定義允許的標籤和屬性
 */
const xssOptions = {
  whiteList: {
    // 允許的 HTML 標籤（根據需要調整）
    // 對於 API 應用，通常不需要允許任何 HTML 標籤
  },
  stripIgnoreTag: true, // 移除不在白名單中的標籤
  stripIgnoreTagBody: ['script', 'style'], // 移除這些標籤及其內容
  css: false, // 不允許 CSS

  // 自定義處理函數
  onIgnoreTag: (tag, html, options) => {
    // 記錄被過濾的標籤（僅開發環境）
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`[XSS] 過濾標籤: ${tag}`);
    }
  },

  onIgnoreTagAttr: (tag, name, value, isWhiteAttr) => {
    // 記錄被過濾的屬性（僅開發環境）
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`[XSS] 過濾屬性: ${tag}.${name}="${value}"`);
    }
  },
};

/**
 * 清理單個值
 * @param {*} value - 要清理的值
 * @param {string} path - 值的路徑（用於日誌）
 * @returns {*} 清理後的值
 */
const sanitizeValue = (value, path = '') => {
  // null 或 undefined，直接返回
  if (value === null || value === undefined) {
    return value;
  }

  // 字串類型，進行 XSS 清理
  if (typeof value === 'string') {
    // 特殊處理：保留 data URI（如 base64 圖片）
    if (value.startsWith('data:')) {
      return value;
    }

    // 特殊處理：保留 URL
    if (value.startsWith('http://') || value.startsWith('https://')) {
      // 僅清理 URL 參數部分
      try {
        const url = new URL(value);
        // 清理查詢參數
        for (const [key, val] of url.searchParams.entries()) {
          url.searchParams.set(key, xss(val, xssOptions));
        }
        return url.toString();
      } catch (e) {
        // 如果不是有效 URL，進行常規清理
        return xss(value, xssOptions);
      }
    }

    // 常規字串清理
    const sanitized = xss(value, xssOptions);

    // 如果值被修改，記錄警告
    if (sanitized !== value && process.env.NODE_ENV !== 'production') {
      logger.warn(`[XSS] 清理了潛在的 XSS 攻擊`, {
        path,
        original: value.substring(0, 100), // 只記錄前 100 個字符
        sanitized: sanitized.substring(0, 100),
      });
    }

    return sanitized;
  }

  // 陣列類型，遞迴清理每個元素
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, `${path}[${index}]`));
  }

  // 對象類型，遞迴清理每個屬性
  if (typeof value === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val, path ? `${path}.${key}` : key);
    }
    return sanitized;
  }

  // 其他類型（數字、布林等），直接返回
  return value;
};

/**
 * XSS 清理中間件
 * 清理所有輸入數據
 */
export const xssSanitizer = (req, res, next) => {
  try {
    // 清理 req.body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body, 'body');
    }

    // 清理 req.query
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeValue(req.query, 'query');
    }

    // 清理 req.params
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeValue(req.params, 'params');
    }

    next();
  } catch (error) {
    logger.error('[XSS] 清理過程發生錯誤:', error);
    // 即使清理失敗，也繼續處理請求（但記錄錯誤）
    next();
  }
};

/**
 * 手動清理函數（供其他地方使用）
 * @param {*} input - 要清理的輸入
 * @returns {*} 清理後的輸出
 */
export const sanitize = (input) => {
  return sanitizeValue(input);
};

/**
 * 嚴格清理函數（移除所有 HTML）
 * @param {string} input - 要清理的字串
 * @returns {string} 清理後的字串
 */
export const sanitizeStrict = (input) => {
  if (typeof input !== 'string') {
    return input;
  }

  // 移除所有 HTML 標籤
  return xss(input, {
    whiteList: {}, // 不允許任何標籤
    stripIgnoreTag: true,
    stripIgnoreTagBody: true,
  });
};

/**
 * 清理 HTML 內容（允許部分安全標籤）
 * 用於富文本編輯器等場景
 * @param {string} html - HTML 內容
 * @returns {string} 清理後的 HTML
 */
export const sanitizeHTML = (html) => {
  if (typeof html !== 'string') {
    return html;
  }

  // 允許安全的 HTML 標籤
  return xss(html, {
    whiteList: {
      p: [],
      br: [],
      strong: [],
      b: [],
      em: [],
      i: [],
      u: [],
      a: ['href', 'title', 'target'],
      ul: [],
      ol: [],
      li: [],
      span: ['class'],
    },
    stripIgnoreTag: true,
    onTagAttr: (tag, name, value, isWhiteAttr) => {
      // 只允許 https 和相對 URL
      if (name === 'href') {
        if (!value.startsWith('https://') && !value.startsWith('/')) {
          return '';
        }
      }

      // 只允許 _blank target
      if (name === 'target' && value !== '_blank') {
        return '';
      }
    },
  });
};

export default {
  xssSanitizer,
  sanitize,
  sanitizeStrict,
  sanitizeHTML,
};
