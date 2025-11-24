/**
 * 等級系統配置
 * 用戶對角色的貢獻等級系統
 */

// ==================== 等級配置 ====================

/**
 * 最大等級
 */
export const MAX_LEVEL = 100;

/**
 * 計算升到指定等級所需的點數
 * 公式: 30 + level×2 + level²×0.025
 *
 * @param {number} level - 目標等級
 * @returns {number} 該等級所需點數
 */
export const getPointsForLevel = (level) => {
  if (level <= 1) return 0;
  return Math.floor(30 + (level * 2) + (level * level * 0.025));
};

/**
 * 計算從等級 1 升到指定等級的累計總點數
 *
 * @param {number} level - 目標等級
 * @returns {number} 累計總點數
 */
export const getTotalPointsForLevel = (level) => {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getPointsForLevel(i);
  }
  return total;
};

/**
 * 根據累計點數計算當前等級
 *
 * @param {number} totalPoints - 累計總點數
 * @returns {object} { level, currentPoints, pointsToNextLevel, progress }
 */
export const calculateLevelFromPoints = (totalPoints) => {
  if (totalPoints <= 0) {
    return {
      level: 1,
      currentPoints: 0,
      pointsToNextLevel: getPointsForLevel(2),
      progress: 0
    };
  }

  let level = 1;
  let accumulated = 0;

  while (level < MAX_LEVEL) {
    const pointsNeeded = getPointsForLevel(level + 1);
    if (accumulated + pointsNeeded > totalPoints) {
      break;
    }
    accumulated += pointsNeeded;
    level++;
  }

  const pointsInCurrentLevel = totalPoints - accumulated;
  const pointsToNextLevel = level < MAX_LEVEL ? getPointsForLevel(level + 1) : 0;
  const progress = level < MAX_LEVEL
    ? Math.floor((pointsInCurrentLevel / pointsToNextLevel) * 100)
    : 100;

  return {
    level,
    currentPoints: pointsInCurrentLevel,
    pointsToNextLevel,
    progress: Math.min(progress, 100)
  };
};

// ==================== 好感度來源配置 ====================

/**
 * 各活動獲得的好感度點數
 */
export const POINTS_CONFIG = {
  // 送禮物：價格 × 稀有度係數
  gift: {
    rarityMultipliers: {
      common: 0.5,
      uncommon: 0.6,
      rare: 0.7,
      epic: 0.8,
      legendary: 1.0
    }
  },

  // 聊天：每則訊息
  chat: {
    pointsPerMessage: 1
  },

  // 請求自拍
  selfie: {
    points: 10
  },

  // 請求影片
  video: {
    points: 25
  },

  // 每日首次對話
  dailyFirstChat: {
    points: 5
  },

  // 連續登入（連續 N 天與同一角色對話）
  consecutiveLogin: {
    pointsPerDay: 3,
    maxDays: 7  // 最多累計 7 天，之後重置
  }
};

// ==================== 連擊配置 ====================

/**
 * 連擊系統配置
 */
export const COMBO_CONFIG = {
  // 連擊超時時間（毫秒）
  timeoutMs: 5 * 60 * 1000, // 5 分鐘

  // 連擊加成
  bonuses: {
    3: { multiplier: 1.1, effect: 'small' },    // +10%
    5: { multiplier: 1.2, effect: 'medium' },   // +20%
    10: { multiplier: 1.3, effect: 'large' },   // +30%
    20: { multiplier: 1.5, effect: 'super' },   // +50%
    50: { multiplier: 2.0, effect: 'ultimate' }, // +100%
    100: { multiplier: 2.5, effect: 'legendary' } // +150%
  }
};

/**
 * 獲取連擊加成
 *
 * @param {number} comboCount - 當前連擊數
 * @returns {object} { multiplier, effect }
 */
export const getComboBonus = (comboCount) => {
  const thresholds = Object.keys(COMBO_CONFIG.bonuses)
    .map(Number)
    .sort((a, b) => b - a);

  for (const threshold of thresholds) {
    if (comboCount >= threshold) {
      return COMBO_CONFIG.bonuses[threshold];
    }
  }

  return { multiplier: 1.0, effect: null };
};

// ==================== 等級獎勵配置 ====================

/**
 * 等級里程碑獎勵（可擴展）
 */
export const LEVEL_REWARDS = {
  10: { type: 'badge', name: '初心者', color: '#CD7F32' },      // 銅
  25: { type: 'badge', name: '支持者', color: '#C0C0C0' },      // 銀
  50: { type: 'badge', name: '忠實粉絲', color: '#FFD700' },    // 金
  75: { type: 'badge', name: '超級粉絲', color: '#B9F2FF' },    // 鑽石
  100: { type: 'badge', name: '傳說粉絲', color: '#FF6B6B' }    // 傳說
};

// ==================== 排行榜配置 ====================

/**
 * 排行榜配置
 */
export const RANKING_CONFIG = {
  // 顯示前幾名
  topCount: 50,

  // 排行榜類型
  types: {
    character: 'character',  // 單一角色的貢獻排行
    global: 'global'         // 全站總貢獻排行
  },

  // 週期類型
  periods: {
    daily: 'daily',     // 日排行
    weekly: 'weekly',   // 週排行
    monthly: 'monthly', // 月排行
    total: 'total'      // 總排行（永久累積）
  }
};

/**
 * 獲取當前週期的 key
 * @param {string} period - 週期類型
 * @returns {string} 週期 key (如 "2025-01-22", "2025-W04", "2025-01")
 */
export const getPeriodKey = (period) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  switch (period) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly': {
      // ISO 週數計算
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
      const week1 = new Date(date.getFullYear(), 0, 4);
      const weekNum = 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    }
    case 'monthly':
      return `${year}-${month}`;
    case 'total':
    default:
      return 'total';
  }
};

/**
 * 獲取週期對應的點數欄位名
 * @param {string} period - 週期類型
 * @returns {string} 欄位名
 */
export const getPeriodPointsField = (period) => {
  switch (period) {
    case 'daily':
      return 'dailyPoints';
    case 'weekly':
      return 'weeklyPoints';
    case 'monthly':
      return 'monthlyPoints';
    case 'total':
    default:
      return 'totalPoints';
  }
};

/**
 * 獲取週期對應的重置時間欄位名
 * @param {string} period - 週期類型
 * @returns {string} 欄位名
 */
export const getPeriodResetField = (period) => {
  switch (period) {
    case 'daily':
      return 'lastDailyReset';
    case 'weekly':
      return 'lastWeeklyReset';
    case 'monthly':
      return 'lastMonthlyReset';
    default:
      return null;
  }
};

// ==================== 預計算等級表（優化查詢） ====================

/**
 * 預計算前 100 級的累計點數表
 * 用於快速查詢，避免每次都計算
 */
export const LEVEL_POINTS_TABLE = (() => {
  const table = [0]; // Level 1 = 0 points
  let total = 0;
  for (let level = 2; level <= MAX_LEVEL; level++) {
    total += getPointsForLevel(level);
    table.push(total);
  }
  return table;
})();

/**
 * 使用預計算表快速計算等級
 *
 * @param {number} totalPoints - 累計總點數
 * @returns {object} { level, currentPoints, pointsToNextLevel, progress }
 */
export const calculateLevelFast = (totalPoints) => {
  if (totalPoints <= 0) {
    return {
      level: 1,
      currentPoints: 0,
      pointsToNextLevel: getPointsForLevel(2),
      progress: 0
    };
  }

  // 二分查找
  let left = 0;
  let right = LEVEL_POINTS_TABLE.length - 1;

  while (left < right) {
    const mid = Math.ceil((left + right) / 2);
    if (LEVEL_POINTS_TABLE[mid] <= totalPoints) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  const level = left + 1; // 因為 index 0 = level 1
  const pointsAtCurrentLevel = LEVEL_POINTS_TABLE[left];
  const pointsInCurrentLevel = totalPoints - pointsAtCurrentLevel;
  const pointsToNextLevel = level < MAX_LEVEL ? getPointsForLevel(level + 1) : 0;
  const progress = level < MAX_LEVEL
    ? Math.floor((pointsInCurrentLevel / pointsToNextLevel) * 100)
    : 100;

  return {
    level,
    currentPoints: pointsInCurrentLevel,
    pointsToNextLevel,
    progress: Math.min(progress, 100)
  };
};

export default {
  MAX_LEVEL,
  getPointsForLevel,
  getTotalPointsForLevel,
  calculateLevelFromPoints,
  calculateLevelFast,
  POINTS_CONFIG,
  COMBO_CONFIG,
  getComboBonus,
  LEVEL_REWARDS,
  RANKING_CONFIG,
  LEVEL_POINTS_TABLE,
  getPeriodKey,
  getPeriodPointsField,
  getPeriodResetField
};
