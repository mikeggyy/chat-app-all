/**
 * 環境模式輔助函數
 * 統一判斷當前環境是否應該使用測試模式（Mock Mode）
 *
 * 支援多種判斷方式：
 * 1. 環境變數優先 (USE_MOCK_IMAGE_GENERATION, USE_MOCK_VIDEO)
 * 2. NODE_ENV 判斷 (development = 測試模式, production = 正式模式)
 * 3. Git 分支判斷 (dev = 測試模式, main/prod = 正式模式)
 * 4. 域名/主機名判斷 (localhost/127.0.0.1 = 測試模式)
 */

import { execSync } from 'child_process';
import logger from './logger.js';

/**
 * 獲取當前 Git 分支名稱
 * @returns {string|null} - Git 分支名稱，如果不在 Git repo 中則返回 null
 */
const getCurrentGitBranch = () => {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'] // 忽略 stderr
    }).trim();
    return branch;
  } catch (error) {
    // 不在 Git repo 中或 Git 未安裝
    return null;
  }
};

/**
 * 檢查主機名是否為本地開發環境
 * @returns {boolean}
 */
const isLocalHost = () => {
  const hostname = process.env.HOSTNAME ||
                   process.env.HOST ||
                   process.env.COMPUTERNAME ||
                   'unknown';

  const localPatterns = [
    'localhost',
    '127.0.0.1',
    '::1',
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
  ];

  return localPatterns.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(hostname);
    }
    return hostname.includes(pattern);
  });
};

/**
 * 判斷是否應該使用 Mock 模式
 *
 * 判斷優先順序：
 * 1. 環境變數明確設定 (USE_MOCK_IMAGE_GENERATION / USE_MOCK_VIDEO)
 * 2. NODE_ENV = 'production' 強制禁用 mock
 * 3. NODE_ENV = 'development' 預設啟用 mock
 * 4. Git 分支判斷 (dev/develop/development 啟用 mock)
 * 5. 主機名判斷 (localhost/內網 IP 啟用 mock)
 *
 * @param {string} feature - 功能名稱 ('image' 或 'video')
 * @param {object} options - 選項
 * @param {boolean} options.checkEnvVar - 是否檢查環境變數（默認 true）
 * @param {boolean} options.checkNodeEnv - 是否檢查 NODE_ENV（默認 true）
 * @param {boolean} options.checkGitBranch - 是否檢查 Git 分支（默認 true）
 * @param {boolean} options.checkHostname - 是否檢查主機名（默認 true）
 * @returns {boolean} - true = 使用 mock 模式, false = 使用正式模式
 */
export const shouldUseMockMode = (feature, options = {}) => {
  const {
    checkEnvVar = true,
    checkNodeEnv = true,
    checkGitBranch = true,
    checkHostname = true,
  } = options;

  const featureName = feature === 'image' ? '圖片生成' : '影片生成';
  const envVarName = feature === 'image' ? 'USE_MOCK_IMAGE_GENERATION' : 'USE_MOCK_VIDEO';

  // ✅ 1. 優先檢查環境變數（明確設定）
  if (checkEnvVar && process.env[envVarName] !== undefined) {
    const useMock = process.env[envVarName] === 'true';
    logger.debug(`[環境檢測] ${featureName} Mock 模式: ${useMock} (來源: 環境變數 ${envVarName})`);
    return useMock;
  }

  // ✅ 2. 檢查 NODE_ENV（強制規則）
  if (checkNodeEnv) {
    const nodeEnv = process.env.NODE_ENV || 'development';

    // 生產環境強制禁用 mock
    if (nodeEnv === 'production') {
      logger.debug(`[環境檢測] ${featureName} Mock 模式: false (來源: NODE_ENV=production)`);
      return false;
    }

    // 開發環境預設啟用 mock
    if (nodeEnv === 'development') {
      logger.debug(`[環境檢測] ${featureName} Mock 模式: true (來源: NODE_ENV=development)`);
      return true;
    }
  }

  // ✅ 3. 檢查 Git 分支（次要判斷）
  if (checkGitBranch) {
    const branch = getCurrentGitBranch();

    if (branch) {
      const devBranches = ['dev', 'develop', 'development', 'feature'];
      const prodBranches = ['main', 'master', 'prod', 'production'];

      if (devBranches.some(b => branch.includes(b))) {
        logger.debug(`[環境檢測] ${featureName} Mock 模式: true (來源: Git 分支 ${branch})`);
        return true;
      }

      if (prodBranches.some(b => branch.includes(b))) {
        logger.debug(`[環境檢測] ${featureName} Mock 模式: false (來源: Git 分支 ${branch})`);
        return false;
      }
    }
  }

  // ✅ 4. 檢查主機名（最後判斷）
  if (checkHostname) {
    const isLocal = isLocalHost();
    logger.debug(`[環境檢測] ${featureName} Mock 模式: ${isLocal} (來源: 主機名檢測)`);
    return isLocal;
  }

  // ✅ 5. 預設值（保守起見，使用正式模式）
  logger.warn(`[環境檢測] ${featureName} Mock 模式: false (來源: 預設值)`);
  return false;
};

/**
 * 獲取當前環境信息（用於調試和日誌）
 * @returns {object} - 環境信息
 */
export const getEnvironmentInfo = () => {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    gitBranch: getCurrentGitBranch(),
    hostname: process.env.HOSTNAME || process.env.HOST || 'unknown',
    isLocal: isLocalHost(),
    mockImage: shouldUseMockMode('image'),
    mockVideo: shouldUseMockMode('video'),
  };
};

/**
 * 記錄當前環境配置（啟動時調用）
 */
export const logEnvironmentInfo = () => {
  const info = getEnvironmentInfo();

  logger.info('\n🌍 環境配置:');
  logger.info(`   NODE_ENV: ${info.nodeEnv}`);
  logger.info(`   Git 分支: ${info.gitBranch || '未檢測到'}`);
  logger.info(`   主機名: ${info.hostname}`);
  logger.info(`   本地環境: ${info.isLocal ? '是' : '否'}`);
  logger.info(`   圖片生成 Mock 模式: ${info.mockImage ? '✅ 啟用' : '❌ 禁用'}`);
  logger.info(`   影片生成 Mock 模式: ${info.mockVideo ? '✅ 啟用' : '❌ 禁用'}`);
};

export default {
  shouldUseMockMode,
  getEnvironmentInfo,
  logEnvironmentInfo,
};
