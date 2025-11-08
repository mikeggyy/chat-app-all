/**
 * 統一日誌系統
 * 使用 Winston 提供結構化日誌記錄
 */

import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

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

// 日誌格式：開發環境使用彩色輸出，生產環境使用 JSON
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
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

// 日誌傳輸方式
const transports = [
  // 控制台輸出
  new winston.transports.Console(),

  // 錯誤日誌檔案
  new winston.transports.File({
    filename: path.join(__dirname, "../../logs/error.log"),
    level: "error",
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // 組合日誌檔案
  new winston.transports.File({
    filename: path.join(__dirname, "../../logs/combined.log"),
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
      filename: path.join(__dirname, "../../logs/exceptions.log"),
    }),
  ],
  // 處理未處理的 Promise rejection
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/rejections.log"),
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
 */
export const httpLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.http(message);
    }
  });

  next();
};

// 導出預設 logger
export default logger;
