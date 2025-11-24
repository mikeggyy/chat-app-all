/**
 * 等級系統服務
 * 管理用戶對角色的貢獻等級
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import {
  calculateLevelFast,
  getPointsForLevel,
  POINTS_CONFIG,
  COMBO_CONFIG,
  getComboBonus,
  LEVEL_REWARDS,
  MAX_LEVEL,
  getPeriodKey,
  getPeriodPointsField,
  getPeriodResetField
} from "../config/level.config.js";
import logger from "../utils/logger.js";

// ==================== 核心函數 ====================

/**
 * 獲取用戶對角色的等級數據
 *
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @returns {Promise<object>} 等級數據
 */
export const getUserCharacterLevel = async (userId, characterId) => {
  const db = getFirestoreDb();
  const docRef = db.collection('users').doc(userId)
    .collection('character_levels').doc(characterId);

  const doc = await docRef.get();

  if (!doc.exists) {
    // 返回預設值（等級 1）
    return {
      userId,
      characterId,
      level: 1,
      totalPoints: 0,
      currentPoints: 0,
      pointsToNextLevel: getPointsForLevel(2),
      progress: 0,
      totalSpent: 0,
      totalGifts: 0,
      totalMessages: 0,
      totalSelfies: 0,
      totalVideos: 0,
      currentCombo: 0,
      maxCombo: 0,
      consecutiveDays: 0,
      lastActivityAt: null,
      isNew: true
    };
  }

  const data = doc.data();
  const levelInfo = calculateLevelFast(data.totalPoints || 0);

  // 檢查連擊是否過期
  let currentCombo = data.currentCombo || 0;
  if (data.comboExpiresAt && data.comboExpiresAt.toDate() < new Date()) {
    currentCombo = 0;
  }

  return {
    userId,
    characterId,
    level: levelInfo.level,
    totalPoints: data.totalPoints || 0,
    currentPoints: levelInfo.currentPoints,
    pointsToNextLevel: levelInfo.pointsToNextLevel,
    progress: levelInfo.progress,
    totalSpent: data.totalSpent || 0,
    totalGifts: data.totalGifts || 0,
    totalMessages: data.totalMessages || 0,
    totalSelfies: data.totalSelfies || 0,
    totalVideos: data.totalVideos || 0,
    currentCombo,
    maxCombo: data.maxCombo || 0,
    consecutiveDays: data.consecutiveDays || 0,
    lastActivityAt: data.lastActivityAt?.toDate()?.toISOString(),
    isNew: false
  };
};

/**
 * 增加好感度點數（通用函數）
 *
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {object} options - 選項
 * @param {string} options.source - 來源（gift, chat, selfie, video, dailyFirst, consecutive）
 * @param {number} options.basePoints - 基礎點數
 * @param {number} options.amount - 花費金額（僅送禮用）
 * @param {boolean} options.updateCombo - 是否更新連擊（僅送禮用）
 * @returns {Promise<object>} 更新結果
 */
export const addPoints = async (userId, characterId, options = {}) => {
  const {
    source = 'other',
    basePoints = 0,
    amount = 0,
    updateCombo = false
  } = options;

  const db = getFirestoreDb();
  const levelRef = db.collection('users').doc(userId)
    .collection('character_levels').doc(characterId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(levelRef);
    const now = new Date();

    // 獲取當前數據或初始化
    let data = doc.exists ? doc.data() : {
      totalPoints: 0,
      totalSpent: 0,
      totalGifts: 0,
      totalMessages: 0,
      totalSelfies: 0,
      totalVideos: 0,
      currentCombo: 0,
      maxCombo: 0,
      consecutiveDays: 0,
      lastActivityAt: null,
      comboExpiresAt: null,
      lastDailyBonusDate: null,
      createdAt: FieldValue.serverTimestamp()
    };

    // 計算連擊
    let newCombo = data.currentCombo || 0;
    let comboBonus = { multiplier: 1.0, effect: null };

    if (updateCombo) {
      // 檢查連擊是否有效
      if (data.comboExpiresAt && data.comboExpiresAt.toDate() > now) {
        newCombo = (data.currentCombo || 0) + 1;
      } else {
        newCombo = 1;
      }
      comboBonus = getComboBonus(newCombo);
    }

    // 計算最終點數（含連擊加成）
    const finalPoints = Math.floor(basePoints * comboBonus.multiplier);
    const bonusPoints = finalPoints - basePoints;

    // 計算升級前後的等級
    const oldLevelInfo = calculateLevelFast(data.totalPoints || 0);
    const newTotalPoints = (data.totalPoints || 0) + finalPoints;
    const newLevelInfo = calculateLevelFast(newTotalPoints);
    const leveledUp = newLevelInfo.level > oldLevelInfo.level;

    // 檢查是否獲得里程碑獎勵
    const newRewards = [];
    if (leveledUp) {
      for (let lvl = oldLevelInfo.level + 1; lvl <= newLevelInfo.level; lvl++) {
        if (LEVEL_REWARDS[lvl]) {
          newRewards.push({
            level: lvl,
            ...LEVEL_REWARDS[lvl]
          });
        }
      }
    }

    // 獲取當前週期 keys
    const dailyKey = getPeriodKey('daily');
    const weeklyKey = getPeriodKey('weekly');
    const monthlyKey = getPeriodKey('monthly');

    // 檢查並重置週期點數
    let dailyPoints = data.dailyPoints || 0;
    let weeklyPoints = data.weeklyPoints || 0;
    let monthlyPoints = data.monthlyPoints || 0;

    if (data.lastDailyReset !== dailyKey) {
      dailyPoints = 0;
    }
    if (data.lastWeeklyReset !== weeklyKey) {
      weeklyPoints = 0;
    }
    if (data.lastMonthlyReset !== monthlyKey) {
      monthlyPoints = 0;
    }

    // 更新統計數據
    const updateData = {
      totalPoints: newTotalPoints,
      dailyPoints: dailyPoints + finalPoints,
      weeklyPoints: weeklyPoints + finalPoints,
      monthlyPoints: monthlyPoints + finalPoints,
      lastDailyReset: dailyKey,
      lastWeeklyReset: weeklyKey,
      lastMonthlyReset: monthlyKey,
      updatedAt: FieldValue.serverTimestamp()
    };

    // 根據來源更新對應統計
    switch (source) {
      case 'gift':
        updateData.totalGifts = (data.totalGifts || 0) + 1;
        updateData.totalSpent = (data.totalSpent || 0) + amount;
        break;
      case 'chat':
        updateData.totalMessages = (data.totalMessages || 0) + 1;
        break;
      case 'selfie':
        updateData.totalSelfies = (data.totalSelfies || 0) + 1;
        updateData.totalSpent = (data.totalSpent || 0) + amount;
        break;
      case 'video':
        updateData.totalVideos = (data.totalVideos || 0) + 1;
        updateData.totalSpent = (data.totalSpent || 0) + amount;
        break;
    }

    // 更新連擊數據
    if (updateCombo) {
      updateData.currentCombo = newCombo;
      updateData.maxCombo = Math.max(data.maxCombo || 0, newCombo);
      updateData.comboExpiresAt = new Date(now.getTime() + COMBO_CONFIG.timeoutMs);
    }

    updateData.lastActivityAt = FieldValue.serverTimestamp();

    if (!doc.exists) {
      updateData.createdAt = FieldValue.serverTimestamp();
    }

    transaction.set(levelRef, updateData, { merge: true });

    // 準備返回結果
    result = {
      // 等級資訊
      level: {
        current: newLevelInfo.level,
        previous: oldLevelInfo.level,
        totalPoints: newTotalPoints,
        currentPoints: newLevelInfo.currentPoints,
        pointsToNextLevel: newLevelInfo.pointsToNextLevel,
        progress: newLevelInfo.progress
      },

      // 點數詳情
      points: {
        base: basePoints,
        bonus: bonusPoints,
        total: finalPoints,
        source
      },

      // 連擊資訊（如果有）
      combo: updateCombo ? {
        current: newCombo,
        max: Math.max(data.maxCombo || 0, newCombo),
        multiplier: comboBonus.multiplier,
        effect: comboBonus.effect,
        isNewRecord: newCombo > (data.maxCombo || 0)
      } : null,

      // 升級資訊（如果有）
      levelUp: leveledUp ? {
        oldLevel: oldLevelInfo.level,
        newLevel: newLevelInfo.level,
        levelsGained: newLevelInfo.level - oldLevelInfo.level
      } : null,

      // 新獲得的獎勵（如果有）
      newRewards: newRewards.length > 0 ? newRewards : null
    };
  });

  logger.info(`[等級] 用戶 ${userId} 對角色 ${characterId} +${result.points.total} 點 (${source})，等級 ${result.level.current}`);

  return result;
};

/**
 * 送禮物時增加好感度
 *
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {number} giftPrice - 禮物價格
 * @param {string} rarity - 禮物稀有度
 * @returns {Promise<object>} 更新結果
 */
export const addPointsFromGift = async (userId, characterId, giftPrice, rarity = 'common') => {
  const multiplier = POINTS_CONFIG.gift.rarityMultipliers[rarity] || 0.5;
  const basePoints = Math.floor(giftPrice * multiplier);

  return addPoints(userId, characterId, {
    source: 'gift',
    basePoints,
    amount: giftPrice,
    updateCombo: true  // 送禮更新連擊
  });
};

/**
 * 聊天時增加好感度
 *
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @returns {Promise<object>} 更新結果
 */
export const addPointsFromChat = async (userId, characterId) => {
  return addPoints(userId, characterId, {
    source: 'chat',
    basePoints: POINTS_CONFIG.chat.pointsPerMessage,
    updateCombo: false
  });
};

/**
 * 請求自拍時增加好感度
 *
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {number} cost - 花費金幣
 * @returns {Promise<object>} 更新結果
 */
export const addPointsFromSelfie = async (userId, characterId, cost = 50) => {
  logger.info(`[等級] addPointsFromSelfie 被呼叫: userId=${userId}, characterId=${characterId}`);
  const result = await addPoints(userId, characterId, {
    source: 'selfie',
    basePoints: POINTS_CONFIG.selfie.points,
    amount: cost,
    updateCombo: false
  });
  logger.info(`[等級] addPointsFromSelfie 結果:`, result);
  return result;
};

/**
 * 請求影片時增加好感度
 *
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {number} cost - 花費金幣
 * @returns {Promise<object>} 更新結果
 */
export const addPointsFromVideo = async (userId, characterId, cost = 200) => {
  return addPoints(userId, characterId, {
    source: 'video',
    basePoints: POINTS_CONFIG.video.points,
    amount: cost,
    updateCombo: false
  });
};

/**
 * 每日首次對話獎勵
 *
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @returns {Promise<object|null>} 更新結果，如果已領取則返回 null
 */
export const addDailyFirstChatBonus = async (userId, characterId) => {
  const db = getFirestoreDb();
  const levelRef = db.collection('users').doc(userId)
    .collection('character_levels').doc(characterId);

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  let result = null;

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(levelRef);
    const data = doc.exists ? doc.data() : {};

    // 檢查今天是否已領取
    if (data.lastDailyBonusDate === today) {
      result = null;
      return;
    }

    // 計算連續登入天數
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let consecutiveDays = 1;
    if (data.lastDailyBonusDate === yesterdayStr) {
      consecutiveDays = Math.min((data.consecutiveDays || 0) + 1, POINTS_CONFIG.consecutiveLogin.maxDays);
    }

    // 計算總獎勵點數
    const dailyBonusPoints = POINTS_CONFIG.dailyFirstChat.points;
    const consecutivePoints = POINTS_CONFIG.consecutiveLogin.pointsPerDay * consecutiveDays;
    const bonusPoints = dailyBonusPoints + consecutivePoints;

    // 更新數據
    const oldLevelInfo = calculateLevelFast(data.totalPoints || 0);
    const newTotalPoints = (data.totalPoints || 0) + bonusPoints;
    const newLevelInfo = calculateLevelFast(newTotalPoints);

    // 獲取當前週期 keys（修復：同步更新週期點數）
    const dailyKey = getPeriodKey('daily');
    const weeklyKey = getPeriodKey('weekly');
    const monthlyKey = getPeriodKey('monthly');

    // 檢查並重置週期點數
    let dailyPoints = data.dailyPoints || 0;
    let weeklyPoints = data.weeklyPoints || 0;
    let monthlyPoints = data.monthlyPoints || 0;

    if (data.lastDailyReset !== dailyKey) {
      dailyPoints = 0;
    }
    if (data.lastWeeklyReset !== weeklyKey) {
      weeklyPoints = 0;
    }
    if (data.lastMonthlyReset !== monthlyKey) {
      monthlyPoints = 0;
    }

    transaction.set(levelRef, {
      totalPoints: newTotalPoints,
      // 同步更新週期點數
      dailyPoints: dailyPoints + bonusPoints,
      weeklyPoints: weeklyPoints + bonusPoints,
      monthlyPoints: monthlyPoints + bonusPoints,
      lastDailyReset: dailyKey,
      lastWeeklyReset: weeklyKey,
      lastMonthlyReset: monthlyKey,
      lastDailyBonusDate: today,
      consecutiveDays,
      lastActivityAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    result = {
      level: {
        current: newLevelInfo.level,
        totalPoints: newTotalPoints
      },
      points: {
        daily: dailyBonusPoints,
        consecutive: consecutivePoints,
        total: bonusPoints
      },
      consecutiveDays,
      levelUp: newLevelInfo.level > oldLevelInfo.level ? {
        oldLevel: oldLevelInfo.level,
        newLevel: newLevelInfo.level
      } : null
    };
  });

  if (result) {
    logger.info(`[等級] 用戶 ${userId} 對角色 ${characterId} 領取每日獎勵 +${result.points.total} 點，連續 ${result.consecutiveDays} 天`);
  }

  return result;
};

/**
 * 獲取用戶所有角色的等級列表
 *
 * @param {string} userId - 用戶 ID
 * @param {object} options - 選項
 * @returns {Promise<object>} 等級列表
 */
export const getUserLevelList = async (userId, options = {}) => {
  const { limit = 20, orderBy = 'totalPoints', order = 'desc' } = options;

  const db = getFirestoreDb();
  const snapshot = await db.collection('users').doc(userId)
    .collection('character_levels')
    .orderBy(orderBy, order)
    .limit(limit)
    .get();

  const list = snapshot.docs.map(doc => {
    const data = doc.data();
    const levelInfo = calculateLevelFast(data.totalPoints || 0);

    return {
      characterId: doc.id,
      level: levelInfo.level,
      totalPoints: data.totalPoints || 0,
      progress: levelInfo.progress,
      totalSpent: data.totalSpent || 0,
      totalGifts: data.totalGifts || 0,
      maxCombo: data.maxCombo || 0,
      lastActivityAt: data.lastActivityAt?.toDate()?.toISOString()
    };
  });

  return { userId, list, count: list.length };
};

/**
 * 獲取角色的貢獻排行榜
 *
 * @param {string} characterId - 角色 ID
 * @param {object} options - 選項
 * @param {number} options.limit - 返回數量
 * @param {string} options.period - 週期類型 (daily/weekly/monthly/total)
 * @returns {Promise<object>} 排行榜數據
 */
export const getCharacterRanking = async (characterId, options = {}) => {
  const { limit = 50, period = 'total' } = options;

  const db = getFirestoreDb();
  const pointsField = getPeriodPointsField(period);
  const resetField = getPeriodResetField(period);
  const currentPeriodKey = period !== 'total' ? getPeriodKey(period) : null;

  // 使用 collectionGroup 查詢所有 character_levels
  const snapshot = await db.collectionGroup('character_levels')
    .where('totalPoints', '>', 0)
    .get();

  // 過濾出特定角色的數據並排序
  const rankings = [];

  for (const doc of snapshot.docs) {
    // 檢查是否是目標角色（doc.id 是 characterId）
    if (doc.id === characterId) {
      const data = doc.data();
      const userId = doc.ref.parent.parent.id;
      const levelInfo = calculateLevelFast(data.totalPoints || 0);

      // 計算週期點數
      let periodPoints = data[pointsField] || 0;

      // 如果週期 key 不匹配，說明數據已過期，點數為 0
      if (resetField && data[resetField] !== currentPeriodKey) {
        periodPoints = 0;
      }

      // 只有週期內有貢獻的才加入排行
      if (periodPoints > 0 || period === 'total') {
        rankings.push({
          userId,
          level: levelInfo.level,
          totalPoints: data.totalPoints || 0,
          periodPoints,
          totalSpent: data.totalSpent || 0,
          totalGifts: data.totalGifts || 0
        });
      }
    }
  }

  // 按週期點數排序
  const sortField = period === 'total' ? 'totalPoints' : 'periodPoints';
  rankings.sort((a, b) => b[sortField] - a[sortField]);

  // 取前 N 名
  const topRankings = rankings.slice(0, limit);

  // 批次查詢用戶名稱
  const userIds = topRankings.map(r => r.userId);
  const userNames = {};

  if (userIds.length > 0) {
    for (const userId of userIds) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userNames[userId] = userData.displayName || userData.name || '匿名用戶';
        }
      } catch (err) {
        logger.warn(`[等級] 無法獲取用戶 ${userId} 名稱:`, err);
      }
    }
  }

  // 添加排名和用戶名稱
  const rankedList = topRankings.map((item, index) => ({
    rank: index + 1,
    ...item,
    displayName: userNames[item.userId] || '匿名用戶',
    // 顯示的點數根據週期類型
    displayPoints: period === 'total' ? item.totalPoints : item.periodPoints
  }));

  return {
    characterId,
    period,
    periodKey: currentPeriodKey,
    ranking: rankedList,
    totalContributors: rankings.length
  };
};

/**
 * 獲取貢獻最多的角色排名（全站）
 *
 * @param {object} options - 選項
 * @param {number} options.limit - 返回數量
 * @returns {Promise<object>} 角色貢獻排名
 */
export const getTopContributedCharacters = async (options = {}) => {
  const { limit = 10 } = options;

  const db = getFirestoreDb();

  // 使用 collectionGroup 查詢所有 character_levels
  logger.info('[等級] 開始查詢 top-characters...');
  const snapshot = await db.collectionGroup('character_levels')
    .where('totalPoints', '>', 0)
    .get();

  logger.info(`[等級] 查詢到 ${snapshot.size} 筆 character_levels 記錄`);

  // 按角色聚合，同時追蹤前3名貢獻者
  const characterStats = {};

  for (const doc of snapshot.docs) {
    const characterId = doc.id;
    const data = doc.data();
    const points = data.totalPoints || 0;
    const spent = data.totalSpent || 0;

    // 從路徑中提取 userId: users/{userId}/character_levels/{characterId}
    const pathParts = doc.ref.path.split('/');
    const userId = pathParts[1];

    if (!characterStats[characterId]) {
      characterStats[characterId] = {
        characterId,
        totalPoints: 0,
        totalSpent: 0,
        contributorCount: 0,
        allContributors: []  // 暫存所有貢獻者
      };
    }

    characterStats[characterId].totalPoints += points;
    characterStats[characterId].totalSpent += spent;
    characterStats[characterId].contributorCount += 1;
    characterStats[characterId].allContributors.push({ userId, points });
  }

  // 對每個角色的貢獻者排序並取前3
  for (const characterId of Object.keys(characterStats)) {
    const stats = characterStats[characterId];
    stats.topContributors = stats.allContributors
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
    delete stats.allContributors;  // 移除暫存數據
  }

  // 轉為陣列並排序
  let sortedCharacters = Object.values(characterStats)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, limit);

  // 收集所有需要查詢名稱的用戶ID
  const allContributorIds = [...new Set(
    sortedCharacters
      .flatMap(c => c.topContributors?.map(tc => tc.userId) || [])
  )];

  const userNames = {};
  if (allContributorIds.length > 0) {
    // 批次查詢用戶名稱
    for (const userId of allContributorIds) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userNames[userId] = userData.displayName || userData.name || '匿名用戶';
        }
      } catch (err) {
        logger.warn(`[等級] 無法獲取用戶 ${userId} 名稱:`, err);
      }
    }
  }

  // 加入排名和貢獻者名稱
  sortedCharacters = sortedCharacters.map((item, index) => ({
    rank: index + 1,
    characterId: item.characterId,
    totalPoints: item.totalPoints,
    totalSpent: item.totalSpent,
    contributorCount: item.contributorCount,
    topContributors: (item.topContributors || []).map((tc, idx) => ({
      rank: idx + 1,
      userId: tc.userId,
      points: tc.points,
      displayName: userNames[tc.userId] || '匿名用戶'
    }))
  }));

  return {
    characters: sortedCharacters,
    totalCharacters: Object.keys(characterStats).length
  };
};

/**
 * 獲取用戶在角色排行榜中的排名
 *
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {object} options - 選項
 * @param {string} options.period - 週期類型 (daily/weekly/monthly/total)
 * @returns {Promise<object>} 用戶排名資訊
 */
export const getUserRankInCharacter = async (userId, characterId, options = {}) => {
  const { period = 'total' } = options;

  const db = getFirestoreDb();
  const pointsField = getPeriodPointsField(period);
  const resetField = getPeriodResetField(period);
  const currentPeriodKey = period !== 'total' ? getPeriodKey(period) : null;

  // 獲取用戶數據
  const userDoc = await db.collection('users').doc(userId)
    .collection('character_levels').doc(characterId).get();

  if (!userDoc.exists) {
    return {
      userId,
      characterId,
      period,
      rank: null,
      level: 1,
      totalPoints: 0,
      periodPoints: 0,
      message: '尚未對此角色有貢獻'
    };
  }

  const userData = userDoc.data();
  const totalPoints = userData.totalPoints || 0;
  const levelInfo = calculateLevelFast(totalPoints);

  // 計算用戶的週期點數
  let userPeriodPoints = userData[pointsField] || 0;
  if (resetField && userData[resetField] !== currentPeriodKey) {
    userPeriodPoints = 0;
  }

  const comparePoints = period === 'total' ? totalPoints : userPeriodPoints;

  // 如果用戶在該週期沒有貢獻
  if (comparePoints === 0 && period !== 'total') {
    return {
      userId,
      characterId,
      period,
      rank: null,
      level: levelInfo.level,
      totalPoints,
      periodPoints: 0,
      message: '本週期尚未有貢獻'
    };
  }

  // 計算有多少人點數比用戶高
  const allSnapshot = await db.collectionGroup('character_levels')
    .where('totalPoints', '>', 0)
    .get();

  let higherCount = 0;
  let totalParticipants = 0;

  for (const doc of allSnapshot.docs) {
    if (doc.id === characterId) {
      const data = doc.data();

      // 計算該用戶的週期點數
      let otherPoints = data[pointsField] || 0;
      if (resetField && data[resetField] !== currentPeriodKey) {
        otherPoints = 0;
      }

      const compareOtherPoints = period === 'total' ? (data.totalPoints || 0) : otherPoints;

      // 週期排行只計算有貢獻的人
      if (compareOtherPoints > 0 || period === 'total') {
        totalParticipants++;
        if (compareOtherPoints > comparePoints) {
          higherCount++;
        }
      }
    }
  }

  const rank = higherCount + 1;
  const percentile = totalParticipants > 1
    ? Math.floor(((totalParticipants - rank) / (totalParticipants - 1)) * 100)
    : 100;

  return {
    userId,
    characterId,
    period,
    rank,
    level: levelInfo.level,
    totalPoints,
    periodPoints: userPeriodPoints,
    totalSpent: userData.totalSpent || 0,
    percentile,
    totalParticipants
  };
};

export default {
  getUserCharacterLevel,
  addPoints,
  addPointsFromGift,
  addPointsFromChat,
  addPointsFromSelfie,
  addPointsFromVideo,
  addDailyFirstChatBonus,
  getUserLevelList,
  getCharacterRanking,
  getTopContributedCharacters,
  getUserRankInCharacter
};
