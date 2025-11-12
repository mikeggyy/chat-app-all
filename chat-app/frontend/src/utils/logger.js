/**
 * 前端日誌工具
 * 開發環境：輸出所有日誌到控制台
 * 生產環境：僅記錄錯誤（方便未來集成錯誤追蹤服務如 Sentry）
 */

const isDev = import.meta.env.DEV;

/**
 * 生產環境錯誤處理
 * 未來可集成到 Sentry、LogRocket 等錯誤追蹤服務
 */
const handleProductionError = (...args) => {
  // 在生產環境靜默記錄，避免洩露敏感信息
  // TODO: 集成第三方錯誤追蹤服務
  // 例如: Sentry.captureException(args[0]);

  // 暫時保留 console.error 但僅在生產環境輸出簡化信息
  if (!isDev && args[0] instanceof Error) {
    console.error('[Error]', args[0].message);
  }
};

export const logger = {
  /**
   * 一般日誌 - 僅開發環境
   */
  log: (...args) => {
    if (isDev) console.log(...args);
  },

  /**
   * 錯誤日誌 - 開發和生產環境都記錄
   * 生產環境可集成到錯誤追蹤服務
   */
  error: (...args) => {
    if (isDev) {
      console.error(...args);
    } else {
      handleProductionError(...args);
    }
  },

  /**
   * 警告日誌 - 僅開發環境
   */
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },

  /**
   * 調試日誌 - 僅開發環境
   */
  debug: (...args) => {
    if (isDev) console.debug(...args);
  },
};
