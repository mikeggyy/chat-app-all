/**
 * 統一日誌系統（共享）
 * 使用 Winston 提供結構化日誌記錄
 * ✅ 包含自動脫敏功能，保護敏感信息
 * 供主應用和管理後台共同使用
 */

import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";
import { sanitizeLogArgs } from "./sanitizer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 日誌級別定義
// error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 根據環境決定日誌級別
const level = () => {
  const env = process.env.NODE_ENV || "development";
  const isDevelopment = env === "development";
  return isDevelopment ? "debug" : "info";
};

// 日誌顏色配置
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

winston.addColors(colors);

/**
 * ✅ 自定義格式：脫敏敏感信息
 * 在所有日誌輸出前自動過濾敏感數據
 */
const sanitizeFormat = winston.format((info) => {
  // 脫敏 message
  if (typeof info.message === 'string') {
    // 字符串消息保持不變（通常是簡單的日誌消息）
    info.message = info.message;
  } else if (typeof info.message === 'object') {
    // 對象消息進行脫敏
    const [sanitized] = sanitizeLogArgs(info.message);
    info.message = sanitized;
  }

  // 脫敏額外的 metadata（除了 Winston 內建字段）
  const reservedFields = ['level', 'message', 'timestamp', 'stack', 'label', 'splat'];
  for (const key of Object.keys(info)) {
    if (!reservedFields.includes(key) && info[key] !== undefined) {
      const [sanitized] = sanitizeLogArgs(info[key]);
      info[key] = sanitized;
    }
  }

  return info;
});

// 日誌格式：開發環境使用彩色輸出，生產環境使用 JSON
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  sanitizeFormat(), // ✅ 添加脫敏格式
  process.env.NODE_ENV === "production"
    ? winston.format.json()
    : winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(
          (info) =>
            `${info.timestamp} [${info.level}]: ${info.message}${
              info.stack ? `\n${info.stack}` : ""
            }`
        )
      )
);

/**
 * 獲取日誌目錄路徑（根據應用類型）
 * @returns {string} 日誌目錄路徑
 */
const getLogsDirectory = () => {
  // 從環境變數讀取日誌目錄，或使用默認路徑
  if (process.env.LOGS_DIRECTORY) {
    return process.env.LOGS_DIRECTORY;
  }

  // 默認：shared/backend-utils 的上兩級目錄下的 logs 文件夾
  return path.join(__dirname, "../../logs");
};

const logsDir = getLogsDirectory();

// 日誌傳輸方式
const transports = [
  // 控制台輸出
  new winston.transports.Console(),

  // 錯誤日誌檔案
  new winston.transports.File({
    filename: path.join(logsDir, "error.log"),
    level: "error",
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // 組合日誌檔案
  new winston.transports.File({
    filename: path.join(logsDir, "combined.log"),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// 創建 logger 實例
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  // 處理未捕獲的異常
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "exceptions.log"),
    }),
  ],
  // 處理未處理的 Promise rejection
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, "rejections.log"),
    }),
  ],
});

/**
 * 創建子 logger，帶有特定模組標籤
 * @param {string} module - 模組名稱
 * @returns {Object} 子 logger
 */
export const createModuleLogger = (module) => {
  return {
    error: (message, ...meta) => logger.error(`[${module}] ${message}`, ...meta),
    warn: (message, ...meta) => logger.warn(`[${module}] ${message}`, ...meta),
    info: (message, ...meta) => logger.info(`[${module}] ${message}`, ...meta),
    http: (message, ...meta) => logger.http(`[${module}] ${message}`, ...meta),
    debug: (message, ...meta) => logger.debug(`[${module}] ${message}`, ...meta),
  };
};

/**
 * HTTP 請求日誌中間件
 * ✅ 自動脫敏請求中的敏感信息
 */
export const httpLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const method = req.method;
    const url = req.originalUrl;
    const status = res.statusCode;

    // 基本日誌消息
    const message = `${method} ${url} ${status} - ${duration}ms`;

    // ✅ 構建脫敏後的詳細信息（僅在需要時記錄）
    const details = {
      method,
      url,
      status,
      duration: `${duration}ms`,
      // 脫敏後的請求頭（僅記錄關鍵頭部）
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        // Authorization 會被脫敏處理
        authorization: req.headers['authorization'],
      },
      // IP 地址
      ip: req.ip || req.connection?.remoteAddress,
    };

    // ✅ 使用脫敏函數處理詳細信息
    const [sanitizedDetails] = sanitizeLogArgs(details);

    if (status >= 500) {
      logger.error(message, sanitizedDetails);
    } else if (status >= 400) {
      logger.warn(message, sanitizedDetails);
    } else {
      // 正常請求只記錄基本信息（不記錄詳細信息以減少日誌量）
      logger.http(message);
    }
  });

  next();
};

// 導出預設 logger
export default logger;
