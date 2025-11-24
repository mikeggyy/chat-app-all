/**
 * 前端日誌工具
 * 開發環境：輸出所有日誌到控制台
 * 生產環境：僅記錄錯誤（方便未來集成錯誤追蹤服務如 Sentry）
 */

const isDev: boolean = import.meta.env.DEV;

/**
 * 生產環境錯誤處理
 * 未來可集成到 Sentry、LogRocket 等錯誤追蹤服務
 */
const handleProductionError = (...args: any[]): void => {
  // 在生產環境靜默記錄，避免洩露敏感信息
  // TODO: 集成第三方錯誤追蹤服務
  // 例如: Sentry.captureException(args[0]);

  // 暫時保留 console.error 但僅在生產環境輸出簡化信息
  if (!isDev && args[0] instanceof Error) {
    console.error('[Error]', args[0].message);
  }
};

interface Logger {
  /**
   * 一般日誌 - 僅開發環境
   */
  log: (...args: any[]) => void;

  /**
   * 資訊日誌 - 僅開發環境
   */
  info: (...args: any[]) => void;

  /**
   * 錯誤日誌 - 開發和生產環境都記錄
   * 生產環境可集成到錯誤追蹤服務
   */
  error: (...args: any[]) => void;

  /**
   * 警告日誌 - 僅開發環境
   */
  warn: (...args: any[]) => void;

  /**
   * 調試日誌 - 僅開發環境
   */
  debug: (...args: any[]) => void;
}

const logger: Logger = {
  /**
   * 一般日誌 - 僅開發環境
   */
  log: (...args: any[]): void => {
    if (isDev) console.log(...args);
  },

  /**
   * 資訊日誌 - 僅開發環境
   */
  info: (...args: any[]): void => {
    if (isDev) console.info(...args);
  },

  /**
   * 錯誤日誌 - 開發和生產環境都記錄
   * 生產環境可集成到錯誤追蹤服務
   */
  error: (...args: any[]): void => {
    if (isDev) {
      console.error(...args);
    } else {
      handleProductionError(...args);
    }
  },

  /**
   * 警告日誌 - 僅開發環境
   */
  warn: (...args: any[]): void => {
    if (isDev) console.warn(...args);
  },

  /**
   * 調試日誌 - 僅開發環境
   */
  debug: (...args: any[]): void => {
    if (isDev) console.debug(...args);
  },
};

// 同時提供命名導出和默認導出
export { logger };
export default logger;
