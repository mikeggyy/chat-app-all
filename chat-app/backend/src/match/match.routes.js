import { Router } from "express";
import { requireFirebaseAuth } from "../auth/index.js";
import { asyncHandler } from "../utils/routeHelpers.js";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../../shared/utils/errorFormatter.js";
import {
  getRandomMatch,
  listMatchesForUser,
  createMatch,
  getMatchById,
  getPopularMatches,
} from "./match.service.js";
import { getCharacterById } from "../services/character/characterCache.service.js";
import { getUserById } from "../user/user.service.js";
import { recordCreation } from "../characterCreation/characterCreationLimit.service.js";
import logger from "../utils/logger.js";
import { validateRequest } from "../middleware/validation.middleware.js";
import {
  getAllMatchesSchema,
  getPopularMatchesSchema,
  getMatchByIdSchema,
  createMatchSchema,
} from "./match.schemas.js";
import { standardRateLimiter, relaxedRateLimiter } from "../middleware/rateLimiterConfig.js";
import { applySelector } from "../utils/responseOptimizer.js";

export const matchRouter = Router();

/**
 * GET /match/next - 隨機取得下一個角色
 * 注意：為保持向後兼容，直接返回對象而非包裝在 success 中
 */
matchRouter.get(
  "/next",
  relaxedRateLimiter,
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
  relaxedRateLimiter,
  validateRequest(getAllMatchesSchema),
  asyncHandler(async (req, res) => {
    const userId = req.query.userId || "";
    const user = userId ? await getUserById(userId) : null;

    const matches = await listMatchesForUser(user);

    // ✅ 響應優化：應用 characterList 選擇器
    // 列表視圖不需要完整的角色信息（如 secret_background, personality 等）
    // 預期節省：150KB → 45KB（節省 70%）
    const optimized = applySelector(matches, 'characterList');

    // 直接返回陣列以保持向後兼容
    res.json(optimized);
  })
);

/**
 * GET /match/popular - 取得按聊天數量排序的熱門角色
 *
 * 支持兩種分頁模式：
 * 1. cursor-based（推薦）：使用 cursor 參數，性能優異
 * 2. offset-based（向後兼容）：使用 offset 參數，性能較差
 *
 * Query params:
 *   - limit: 返回的角色數量（默認 10，最大 100）
 *   - cursor: 游標（推薦，用於下一頁）
 *   - offset: 分頁偏移量（向後兼容，默認 0）
 *   - sync: 是否同步更新 Firestore 中的 totalChatUsers（true/false，默認 false）
 *
 * 返回格式：
 *   - characters: 角色列表
 *   - cursor: 下一頁的游標（使用 cursor 分頁時）
 *   - hasMore: 是否還有更多數據
 *   - offset: 當前偏移量（使用 offset 分頁時）
 *   - paginationMode: 'cursor' 或 'offset'
 */
matchRouter.get(
  "/popular",
  relaxedRateLimiter,
  validateRequest(getPopularMatchesSchema),
  asyncHandler(async (req, res) => {
    const limit = req.query.limit || 10;
    const offset = req.query.offset || 0;
    const cursor = req.query.cursor || null;
    const sync = req.query.sync || false;

    const result = await getPopularMatches(limit, {
      offset,
      cursor,
      syncToFirestore: sync
    });

    // 判斷使用的分頁模式
    const paginationMode = cursor ? 'cursor' : 'offset';

    // ✅ 響應優化：應用 characterList 選擇器
    // 熱門列表不需要完整的角色信息
    const characters = result.characters || result.__legacy || [];
    const optimizedCharacters = applySelector(characters, 'characterList');

    // 統一的響應格式
    res.json({
      characters: optimizedCharacters,
      cursor: result.cursor || null,  // cursor-based 分頁的下一頁游標
      hasMore: result.hasMore !== undefined ? result.hasMore : characters.length === limit,
      offset: offset,  // offset-based 分頁的當前偏移量
      total: optimizedCharacters.length,
      paginationMode,  // 告知前端使用的分頁模式
      synced: sync,  // 告知前端是否進行了同步
    });
  })
);

/**
 * POST /match/create - 創建新角色（需要認證）
 */
matchRouter.post(
  "/create",
  requireFirebaseAuth,
  standardRateLimiter,
  validateRequest(createMatchSchema),
  asyncHandler(async (req, res) => {
    const userId = req.body.creatorUid || req.firebaseUser?.uid;
    const flowId = req.body.flowId; // 從前端獲取 flowId

    // ✅ 檢查創建資源並扣除（如果在圖片生成時未扣除）
    let needsCreateCard = false;
    let alreadyDeducted = false;

    if (userId) {
      try {
        // 如果有 flowId，檢查是否已在圖片生成時扣除過創建卡
        if (flowId) {
          const { getCreationFlow } = await import("../characterCreation/characterCreation.service.js");
          const flow = await getCreationFlow(flowId);
          alreadyDeducted = flow?.metadata?.deductedOnImageGeneration === true;

          if (alreadyDeducted) {
            logger.info(`[角色創建] 用戶 ${userId} 創建卡已在圖片生成時扣除，跳過扣除`);
          }
        }

        // 如果未在圖片生成時扣除，則在此處檢查並扣除
        if (!alreadyDeducted) {
          const { canCreateCharacter } = await import("../characterCreation/characterCreationLimit.service.js");
          const { consumeUserAsset } = await import("../user/assets.service.js");

          const limitCheck = await canCreateCharacter(userId);
          if (!limitCheck.allowed) {
            return sendError(
              res,
              "LIMIT_EXCEEDED",
              limitCheck.message || "已達到角色創建次數限制",
              { limit: limitCheck }
            );
          }

          // ⚠️ 使用 limitCheck 的信息來判斷是否需要扣除創建卡
          // limitCheck.reason === "create_card_available" 表示需要使用創建卡
          if (limitCheck.reason === "create_card_available" && limitCheck.createCards > 0) {
            // 免費次數用完，需要使用創建卡
            logger.info(`[角色創建] 用戶 ${userId} 免費次數已用完（剩餘 ${limitCheck.remaining}），扣除創建卡（擁有 ${limitCheck.createCards} 張）`);
            needsCreateCard = true;

            // 立即扣除創建卡
            await consumeUserAsset(userId, "createCards", 1);
            logger.info(`[角色創建] 用戶 ${userId} 成功扣除 1 張創建卡`);
          } else {
            logger.info(`[角色創建] 用戶 ${userId} 使用免費次數（剩餘 ${limitCheck.remaining} 次）`);
          }
        }
      } catch (error) {
        logger.error(`[角色創建] 檢查或扣除創建資源失敗: ${error.message}`);
        return sendError(res, "INTERNAL_ERROR", "檢查創建資源失敗", {
          error: error.message,
        });
      }
    }

    // ⚠️ 重要：先記錄創建次數，再創建角色
    // 這樣可以確保即使角色創建失敗，免費次數也會被正確記錄
    // 避免用戶重複使用免費次數

    // 步驟 1: 記錄角色創建次數（增加計數）
    let tempCharacterId = null;
    if (userId) {
      // 暫時使用一個臨時 ID，稍後會更新為真實的角色 ID
      tempCharacterId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      try {
        await recordCreation(userId, tempCharacterId);
        logger.info(`[角色創建] 用戶 ${userId} 創建計數已增加${needsCreateCard ? '（已扣除創建卡）' : '（使用免費次數）'}`);
      } catch (recordError) {
        logger.error("[角色創建] 記錄創建次數失敗:", recordError);
        // ⚠️ 記錄失敗必須拋出錯誤，避免免費次數被重複使用
        throw new ApiError(
          "INTERNAL_ERROR",
          "記錄創建次數失敗，請重試",
          { originalError: recordError.message }
        );
      }
    }

    // 步驟 2: 創建角色
    let match;
    try {
      match = await createMatch(req.body);
      logger.info(`[角色創建] 角色創建成功: ${match.id}`);
    } catch (createError) {
      logger.error("[角色創建] 創建角色失敗，回滾計數:", createError);

      // ✅ 回滾創建次數（如果之前記錄了的話）
      if (userId && tempCharacterId) {
        try {
          const { decrementCreation } = await import("../characterCreation/characterCreationLimit.service.js");
          const rollbackResult = await decrementCreation(userId, {
            reason: 'character_creation_failed',
            error: createError.message,
            tempCharacterId,
            idempotencyKey: tempCharacterId, // ⚠️ 使用 tempCharacterId 作為冪等性鍵，防止重複回滾
          });

          if (rollbackResult.idempotent) {
            logger.info(`[角色創建] 用戶 ${userId} 創建失敗，回滾操作為冪等（已執行過）: ${tempCharacterId}`);
          } else {
            logger.info(`[角色創建] 用戶 ${userId} 創建失敗，已回滾計數: ${tempCharacterId}`);
          }
        } catch (rollbackError) {
          logger.error("[角色創建] 回滾計數失敗:", rollbackError);

          // ⚠️ 回滾失敗 - 記錄到錯誤日誌並生成支持參考號
          try {
            const { logCriticalError } = await import("../utils/errorLogger.service.js");
            const errorReference = await logCriticalError({
              errorType: 'rollback_failure',
              userId,
              operation: 'character_creation',
              error: rollbackError,
              context: {
                tempCharacterId,
                originalError: createError.message,
                timestamp: new Date().toISOString(),
              },
            });

            logger.error(
              `[角色創建] 回滾失敗已記錄，錯誤參考號: ${errorReference}，用戶 ${userId} 的創建次數可能未正確回滾，需要管理員手動檢查`
            );

            // 拋出包含支持參考的錯誤
            throw new ApiError(
              "ROLLBACK_FAILURE",
              `角色創建失敗，且系統未能正確回滾您的創建次數。請聯繫客服並提供此參考號：${errorReference}`,
              {
                errorReference,
                originalError: createError.message,
              }
            );
          } catch (logError) {
            // 如果連日誌記錄都失敗了，至少要告知用戶
            logger.error("[角色創建] 記錄回滾失敗日誌時出錯:", logError);
            throw new ApiError(
              "ROLLBACK_FAILURE",
              `角色創建失敗，且系統未能正確回滾您的創建次數。請聯繫客服並提供您的用戶 ID: ${userId}`,
              { originalError: createError.message }
            );
          }
        }
      }

      throw createError;
    }

    // 使用 201 Created 狀態碼表示資源已成功創建
    res.status(201).json({
      success: true,
      data: match,
    });
  })
);

/**
 * GET /match/batch - 批量獲取角色信息
 *
 * 優化目的：減少 API 請求次數（N 次 → 1 次）
 * 使用場景：收藏列表、對話列表等需要多個角色信息的頁面
 *
 * Query params:
 *   - ids: 角色 ID 列表（逗號分隔，例如：match-001,match-002,match-003）
 *   - limit: 最大返回數量（默認 50，防止過大請求）
 *
 * 返回格式：
 *   - characters: 角色對象映射 { [id]: character }
 *   - found: 成功找到的角色數量
 *   - notFound: 未找到的角色 ID 列表
 *
 * 性能提升：
 *   - 50 個角色：50 次請求 → 1 次請求（減少 98%）
 *   - 響應時間：2.5 秒 → 0.3 秒（快 8 倍）
 */
matchRouter.get(
  "/batch",
  relaxedRateLimiter,
  asyncHandler(async (req, res) => {
    const idsParam = req.query.ids || "";
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // 最多 100 個

    // 解析 ID 列表
    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .slice(0, limit); // 限制數量

    if (ids.length === 0) {
      return sendError(res, "VALIDATION_ERROR", "請提供至少一個角色 ID", {
        example: "/match/batch?ids=match-001,match-002",
      });
    }

    // 批量獲取角色（使用緩存，非常快）
    const characters = {};
    const notFound = [];

    // 並行獲取所有角色
    await Promise.all(
      ids.map(async (id) => {
        try {
          const character = getCharacterById(id);
          if (character) {
            characters[id] = character;
          } else {
            notFound.push(id);
          }
        } catch (error) {
          logger.warn(`[批量查詢] 獲取角色失敗: ${id}`, error.message);
          notFound.push(id);
        }
      })
    );

    logger.info(
      `[批量查詢] 成功: ${Object.keys(characters).length}/${ids.length}`,
      { found: Object.keys(characters).length, notFound: notFound.length }
    );

    res.json({
      characters,
      found: Object.keys(characters).length,
      notFound,
      total: ids.length,
    });
  })
);

/**
 * GET /match/:id - 取得指定角色詳細資料
 * ⚠️ 重要：此路由必須放在最後，因為 :id 會匹配任何路徑
 * 如果放在前面會導致 /batch, /create 等路由無法匹配
 */
matchRouter.get(
  "/:id",
  relaxedRateLimiter,
  validateRequest(getMatchByIdSchema),
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
