import { Router } from "express";
import { requireFirebaseAuth } from "../auth/index.js";
import { asyncHandler } from "../utils/routeHelpers.js";
import { sendSuccess, sendError } from "../../../../shared/utils/errorFormatter.js";
import {
  getRandomMatch,
  listMatchesForUser,
  createMatch,
  getMatchById,
  getPopularMatches,
} from "./match.service.js";
import { getUserById } from "../user/user.service.js";
import { recordCreation } from "../characterCreation/characterCreationLimit.service.js";
import logger from "../utils/logger.js";

export const matchRouter = Router();

/**
 * GET /match/next - 隨機取得下一個角色
 * 注意：為保持向後兼容，直接返回對象而非包裝在 success 中
 */
matchRouter.get(
  "/next",
  asyncHandler(async (_, res) => {
    const match = getRandomMatch();
    if (!match) {
      return sendError(res, "RESOURCE_NOT_FOUND", "目前沒有可用的角色");
    }
    // 直接返回 match 對象以保持向後兼容
    res.json(match);
  })
);

/**
 * GET /match/all - 取得所有角色列表（可依用戶過濾）
 * 注意：為保持向後兼容，直接返回陣列而非包裝對象
 */
matchRouter.get(
  "/all",
  asyncHandler(async (req, res) => {
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";
    const user = userId ? getUserById(userId) : null;

    const matches = await listMatchesForUser(user);
    // 直接返回陣列以保持向後兼容
    res.json(matches);
  })
);

/**
 * GET /match/popular - 取得按聊天數量排序的熱門角色
 * Query params:
 *   - limit: 返回的角色數量（默認 10）
 *   - sync: 是否同步更新 Firestore 中的 totalChatUsers（true/false，默認 false）
 * 注意：返回包含聊天數量的角色列表
 */
matchRouter.get(
  "/popular",
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const sync = req.query.sync === "true" || req.query.sync === "1";

    const matches = await getPopularMatches(limit, { syncToFirestore: sync });

    res.json({
      characters: matches,
      total: matches.length,
      synced: sync, // 告知前端是否進行了同步
    });
  })
);

/**
 * GET /match/:id - 取得指定角色詳細資料
 */
matchRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const characterId = req.params.id;
    const match = await getMatchById(characterId);

    if (!match) {
      return sendError(res, "RESOURCE_NOT_FOUND", "找不到指定的角色", {
        characterId,
      });
    }

    res.json({ character: match });
  })
);

/**
 * POST /match/create - 創建新角色（需要認證）
 */
matchRouter.post(
  "/create",
  requireFirebaseAuth,
  asyncHandler(async (req, res) => {
    const match = await createMatch(req.body);

    // 記錄角色創建次數
    const userId = req.body.creatorUid || req.firebaseUser?.uid;
    if (userId) {
      try {
        recordCreation(userId, match.id);
        if (process.env.NODE_ENV !== "test") {
          logger.info(`[角色創建限制] 已記錄用戶 ${userId} 創建角色 ${match.id}`);
        }
      } catch (recordError) {
        logger.error("[角色創建限制] 記錄創建次數失敗:", recordError);
      }
    }

    sendSuccess(res, match, 201);
  })
);
