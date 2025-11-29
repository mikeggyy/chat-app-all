/**
 * 等級系統路由
 */

import express from "express";
import { asyncHandler } from "../utils/routeHelpers.js";
import { sendSuccess, sendError } from "../../../../shared/utils/errorFormatter.js";
import { requireFirebaseAuth } from "../auth/index.js";
import { relaxedRateLimiter } from "../middleware/rateLimiterConfig.js";
import {
  getUserCharacterLevel,
  getUserLevelList,
  getCharacterRanking,
  getTopContributedCharacters,
  getUserRankInCharacter,
  addDailyFirstChatBonus
} from "./level.service.js";
import {
  calculateLevelFast,
  getPointsForLevel,
  LEVEL_REWARDS,
  MAX_LEVEL,
  LEVEL_POINTS_TABLE
} from "../config/level.config.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * GET /api/levels/config
 * 獲取等級系統配置（公開）
 */
router.get("/config", relaxedRateLimiter,
  asyncHandler(async (req, res) => {
    // 生成等級表（前 20 級作為範例）
    const levelTable = [];
    for (let i = 1; i <= 20; i++) {
      levelTable.push({
        level: i,
        pointsRequired: i === 1 ? 0 : getPointsForLevel(i),
        totalPoints: LEVEL_POINTS_TABLE[i - 1]
      });
    }

    sendSuccess(res, {
      maxLevel: MAX_LEVEL,
      levelTable,
      rewards: LEVEL_REWARDS
    });
  })
);

/**
 * GET /api/levels/top-characters
 * 獲取貢獻最多的角色排名（全站）
 */
router.get("/top-characters", relaxedRateLimiter,
  asyncHandler(async (req, res) => {
    const { limit } = req.query;

    const options = {
      limit: limit ? parseInt(limit, 10) : 10
    };

    const result = await getTopContributedCharacters(options);
    sendSuccess(res, result);
  })
);

/**
 * GET /api/levels/character/:characterId
 * 獲取用戶對特定角色的等級
 */
router.get("/character/:characterId", requireFirebaseAuth, relaxedRateLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { characterId } = req.params;

    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：characterId");
    }

    const result = await getUserCharacterLevel(userId, characterId);
    sendSuccess(res, result);
  })
);

/**
 * GET /api/levels/my-levels
 * 獲取用戶所有角色的等級列表
 */
router.get("/my-levels", requireFirebaseAuth, relaxedRateLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { limit, orderBy, order } = req.query;

    const options = {
      limit: limit ? parseInt(limit, 10) : 20,
      orderBy: orderBy || 'totalPoints',
      order: order || 'desc'
    };

    const result = await getUserLevelList(userId, options);
    sendSuccess(res, result);
  })
);

/**
 * GET /api/levels/ranking/:characterId
 * 獲取角色的貢獻排行榜
 * @query {string} period - 週期類型 (daily/weekly/monthly/total)
 * @query {number} limit - 返回數量
 */
router.get("/ranking/:characterId", relaxedRateLimiter,
  asyncHandler(async (req, res) => {
    const { characterId } = req.params;
    const { limit, period } = req.query;

    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：characterId");
    }

    // 驗證 period 參數
    const validPeriods = ['daily', 'weekly', 'monthly', 'total'];
    const periodValue = period && validPeriods.includes(period) ? period : 'total';

    const options = {
      limit: limit ? parseInt(limit, 10) : 50,
      period: periodValue
    };

    const result = await getCharacterRanking(characterId, options);
    sendSuccess(res, result);
  })
);

/**
 * GET /api/levels/my-rank/:characterId
 * 獲取用戶在角色排行榜中的排名
 * @query {string} period - 週期類型 (daily/weekly/monthly/total)
 */
router.get("/my-rank/:characterId", requireFirebaseAuth, relaxedRateLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { characterId } = req.params;
    const { period } = req.query;

    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：characterId");
    }

    // 驗證 period 參數
    const validPeriods = ['daily', 'weekly', 'monthly', 'total'];
    const periodValue = period && validPeriods.includes(period) ? period : 'total';

    const options = { period: periodValue };
    const result = await getUserRankInCharacter(userId, characterId, options);
    sendSuccess(res, result);
  })
);

/**
 * POST /api/levels/daily-bonus/:characterId
 * 領取每日首次對話獎勵
 */
router.post("/daily-bonus/:characterId", requireFirebaseAuth, relaxedRateLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { characterId } = req.params;

    if (!characterId) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：characterId");
    }

    const result = await addDailyFirstChatBonus(userId, characterId);

    if (result === null) {
      return sendSuccess(res, {
        alreadyClaimed: true,
        message: "今日已領取過獎勵"
      });
    }

    sendSuccess(res, {
      alreadyClaimed: false,
      ...result
    });
  })
);

/**
 * GET /api/levels/calculate
 * 計算等級（工具端點，用於前端預覽）
 */
router.get("/calculate", relaxedRateLimiter,
  asyncHandler(async (req, res) => {
    const { points } = req.query;

    if (!points) {
      return sendError(res, "VALIDATION_ERROR", "缺少必要參數：points");
    }

    const totalPoints = parseInt(points, 10);
    if (isNaN(totalPoints) || totalPoints < 0) {
      return sendError(res, "VALIDATION_ERROR", "points 必須是非負整數");
    }

    const levelInfo = calculateLevelFast(totalPoints);
    sendSuccess(res, levelInfo);
  })
);

export default router;
