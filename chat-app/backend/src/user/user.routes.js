import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  upsertUser,
  updateUserPhoto,
  updateUserProfileFields,
  addFavoriteForUser,
  removeFavoriteForUser,
  addConversationForUser,
  removeConversationForUser,
  normalizeUser,
} from "./user.service.js";
import {
  getUserAssets,
  addUserAsset,
  consumeUserAsset,
  setUserAssets,
} from "./assets.service.js";
import { getUserConversations } from "./userConversations.service.js";
import { requireFirebaseAuth } from "../auth/index.js";
import { requireOwnership, asyncHandler } from "../utils/routeHelpers.js";
import { requireAdmin } from "../middleware/adminAuth.middleware.js";
import {
  getMatchesByIds,
  listMatchesByCreator,
} from "../match/match.service.js";
import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import logger from "../utils/logger.js";
import {
  sendSuccess,
  sendError,
  ApiError,
} from "../../../shared/utils/errorFormatter.js";
import { standardRateLimiter, relaxedRateLimiter } from "../middleware/rateLimiterConfig.js";
import { applySelector } from "../utils/responseOptimizer.js";

const shouldIncludeMatches = (query) => {
  const include = typeof query?.include === "string" ? query.include : "";
  if (!include) {
    return false;
  }
  return include
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .some((value) =>
      ["matches", "characters", "details", "all"].includes(value)
    );
};

const buildFavoritesPayload = async (user, includeMatches) => {
  const favorites = Array.isArray(user?.favorites) ? user.favorites : [];

  if (!includeMatches) {
    return { favorites };
  }

  const { matches, missing } = await getMatchesByIds(favorites);
  const payload = {
    favorites,
    matches,
  };

  if (missing.length) {
    payload.missingMatches = missing;
  }

  return payload;
};

export const userRouter = Router();

// 獲取所有用戶列表 - 僅供管理員使用
userRouter.get("/", requireFirebaseAuth, requireAdmin, relaxedRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    const { limit, startAfter } = req.query;

    const result = await getAllUsers({
      limit: limit ? parseInt(limit) : 100,
      startAfter: startAfter || null,
    });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}));

// 獲取指定用戶資料 - 需要身份驗證且只能訪問自己的資料
userRouter.get("/:id", requireFirebaseAuth, requireOwnership("id"), relaxedRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    let user = await getUserById(req.params.id);

    // ✅ 修復：GET 請求不應該創建用戶，直接返回 404
    // 用戶應該通過 POST /api/users 創建，這樣才能從 Firebase Auth 獲取正確的 displayName
    if (!user) {
      throw new ApiError("USER_NOT_FOUND", "找不到指定的使用者資料", { userId: req.params.id });
    }

    // ✅ 關鍵修復：經過 normalizeUser 規範化，確保返回完整且一致的數據格式
    // 這樣可以：
    // 1. 補全缺失的欄位（如 hasCompletedOnboarding, age, gender 等）
    // 2. 確保 GET 和 POST 行為一致
    // 3. 防止前端收到不完整的數據
    const normalized = normalizeUser(user);

    // ✅ 響應優化：根據訪問者決定返回哪些字段
    // 自己查看：返回完整資料（除敏感字段）
    // 他人查看：僅返回公開字段
    const isOwnProfile = req.params.id === req.firebaseUser?.uid;
    const optimized = applySelector(normalized, isOwnProfile ? 'userFull' : 'userPublic');

    sendSuccess(res, optimized);
  } catch (error) {
    next(error);
  }
}));

userRouter.post("/", requireFirebaseAuth, standardRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    const firebaseUser = req.firebaseUser;
    if (!firebaseUser?.uid) {
      return sendError(res, "VALIDATION_ERROR", "Firebase 使用者資訊不完整，無法建立資料", {
        field: "firebaseUser.uid",
      });
    }

    const nowIso = new Date().toISOString();
    const firebaseProviderId =
      firebaseUser.firebase?.sign_in_provider ?? "google";

    const payload = {
      ...req.body,
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      email: req.body?.email ?? firebaseUser.email ?? "",
      displayName:
        req.body?.displayName ?? firebaseUser.name ?? "Firebase 使用者",
      photoURL:
        req.body?.photoURL ?? firebaseUser.picture ?? "/avatars/defult-01.webp",
      signInProvider: req.body?.signInProvider ?? firebaseProviderId,
      lastLoginAt: req.body?.lastLoginAt ?? nowIso,
      updatedAt: req.body?.updatedAt ?? nowIso,
    };

    delete payload.firebaseIdToken;

    const user = await upsertUser(payload);
    sendSuccess(res, user, { status: 201 });
  } catch (error) {
    next(error);
  }
}));

userRouter.patch(
  "/:id/photo",
  requireFirebaseAuth,
  requireOwnership("id"),
  standardRateLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { photoURL } = req.body ?? {};

    const user = await updateUserPhoto(id, photoURL);
    sendSuccess(res, user);
  })
);

userRouter.patch(
  "/:id/profile",
  requireFirebaseAuth,
  requireOwnership("id"),
  standardRateLimiter,
  asyncHandler(async (req, res, next) => {
    try {
      const { id } = req.params;
      const payload = req.body ?? {};
      const patch = {};

      if (Object.prototype.hasOwnProperty.call(payload, "displayName")) {
        patch.displayName = payload.displayName;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "gender")) {
        patch.gender = payload.gender;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "age")) {
        patch.age = payload.age;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "hasCompletedOnboarding")) {
        patch.hasCompletedOnboarding = payload.hasCompletedOnboarding;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "defaultPrompt")) {
        patch.defaultPrompt = payload.defaultPrompt;
      }

      if (Object.keys(patch).length === 0) {
        return sendError(res, "VALIDATION_ERROR", "未提供可更新的欄位", {
          availableFields: ["displayName", "gender", "age", "hasCompletedOnboarding", "defaultPrompt"],
        });
      }

      const user = await updateUserProfileFields(id, patch);

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  })
);

userRouter.get("/:id/favorites", requireFirebaseAuth, requireOwnership("id"), relaxedRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    let user = await getUserById(req.params.id);

    // ✅ 修復：不自動創建用戶
    if (!user) {
      throw new ApiError("USER_NOT_FOUND", "找不到指定的使用者資料", { userId: req.params.id });
    }

    const includeMatches = shouldIncludeMatches(req.query);
    sendSuccess(res, await buildFavoritesPayload(user, includeMatches));
  } catch (error) {
    next(error);
  }
}));

userRouter.get("/:id/characters", requireFirebaseAuth, requireOwnership("id"), relaxedRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const characters = await listMatchesByCreator(id);
    sendSuccess(res, {
      characters,
      total: characters.length,
    });
  } catch (error) {
    next(error);
  }
}));

userRouter.post(
  "/:id/favorites",
  requireFirebaseAuth,
  requireOwnership("id"),
  standardRateLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { matchId, favoriteId } = req.body ?? {};
    const targetFavoriteId = matchId ?? favoriteId ?? "";
    const includeMatches = shouldIncludeMatches(req.query);

    // ✅ 參數驗證
    if (!targetFavoriteId || typeof targetFavoriteId !== 'string') {
      return sendError(res, 'VALIDATION_ERROR', '請提供有效的角色 ID', {
        field: 'matchId 或 favoriteId',
        received: targetFavoriteId
      });
    }

    if (targetFavoriteId.length > 100) {
      return sendError(res, 'VALIDATION_ERROR', '角色 ID 長度不得超過 100 個字符', {
        field: 'matchId 或 favoriteId',
        maxLength: 100
      });
    }

    const user = await addFavoriteForUser(id, targetFavoriteId);
    // ✅ totalFavorites 更新邏輯已移至 service 層

    logger.info('[POST favorites] user 對象:', { favorites: user?.favorites, isNewFavorite: user?.isNewFavorite });
    const payload = await buildFavoritesPayload(user, includeMatches);
    logger.info('[POST favorites] payload:', payload);

    sendSuccess(res, payload, 201);
  })
);

userRouter.delete(
  "/:id/favorites/:favoriteId",
  requireFirebaseAuth,
  requireOwnership("id"),
  standardRateLimiter,
  asyncHandler(async (req, res) => {
    const { id, favoriteId } = req.params;
    const includeMatches = shouldIncludeMatches(req.query);

    // ✅ 參數驗證
    if (!favoriteId || typeof favoriteId !== 'string') {
      return sendError(res, 'VALIDATION_ERROR', '請提供有效的角色 ID', {
        field: 'favoriteId',
        received: favoriteId
      });
    }

    if (favoriteId.length > 100) {
      return sendError(res, 'VALIDATION_ERROR', '角色 ID 長度不得超過 100 個字符', {
        field: 'favoriteId',
        maxLength: 100
      });
    }

    const user = await removeFavoriteForUser(id, favoriteId);
    // ✅ totalFavorites 更新邏輯已移至 service 層

    sendSuccess(res, await buildFavoritesPayload(user, includeMatches));
  })
);

userRouter.get("/:id/conversations", requireFirebaseAuth, requireOwnership("id"), relaxedRateLimiter, asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    const cursor = req.query.cursor || null;

    // 從 Firestore 子集合獲取對話列表（支援分頁）
    const result = await getUserConversations(id, {
      limit,
      orderBy: "updatedAt",
      orderDirection: "desc",
      cursor,
    });

    const { conversations, nextCursor, hasMore } = result;

    // 補充角色詳細信息（包含統計數據）
    const characterIds = conversations
      .map((conv) => conv.characterId || conv.conversationId)
      .filter(Boolean);

    // ✅ 性能優化：從內存緩存批量獲取完整角色信息（包括統計數據）
    // 避免 N+1 查詢問題，所有數據都從角色緩存讀取
    const { matches: characters } = await getMatchesByIds(characterIds);
    const charactersMap = new Map(characters.map((char) => [char.id, char]));

    // ✅ 優化：直接使用緩存中的統計信息，無需額外查詢 Firestore
    // 角色緩存已經包含 totalChatUsers 和 totalFavorites
    const enrichedConversations = conversations.map((conv) => {
      const characterId = conv.characterId || conv.conversationId;
      const character = charactersMap.get(characterId);

      return {
        ...conv,
        character: character
          ? {
              ...character,
              // 統計信息直接從緩存中獲取
              messageCount: character.totalChatUsers || 0,
              totalFavorites: character.totalFavorites || 0,
            }
          : conv.character || null,
      };
    });

    // ✅ 響應優化：對每個對話應用 conversationHistory 選擇器
    // 移除完整的消息數組，只保留最後一條消息和必要的元數據
    // 預期節省：500KB → 15KB（節省 97%）
    // ✅ 自動優化嵌套字段：character 字段會自動應用 characterList 選擇器（配置在 responseOptimizer.js）
    const optimizedConversations = applySelector(enrichedConversations, 'conversationHistory');

    sendSuccess(res, {
      conversations: optimizedConversations,
      total: optimizedConversations.length,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    // 如果用戶不存在或出錯，返回空數組
    logger.warn(`獲取用戶對話失敗: ${error.message}`);
    sendSuccess(res, {
      conversations: [],
      total: 0,
      nextCursor: null,
      hasMore: false,
    });
  }
}));

userRouter.post(
  "/:id/conversations",
  requireFirebaseAuth,
  requireOwnership("id"),
  standardRateLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { matchId, conversationId } = req.body ?? {};
    const targetConversationId = conversationId ?? matchId ?? "";

    const user = await addConversationForUser(id, targetConversationId);
    sendSuccess(res, { conversations: user.conversations }, 201);
  })
);

userRouter.delete(
  "/:id/conversations/:conversationId",
  requireFirebaseAuth,
  requireOwnership("id"),
  standardRateLimiter,
  asyncHandler(async (req, res) => {
    const { id, conversationId } = req.params;

    const user = await removeConversationForUser(id, conversationId);
    sendSuccess(res, { conversations: user.conversations });
  })
);

// ========== 資產管理路由 ==========

/**
 * GET /api/users/:id/assets
 * 獲取用戶的資產信息
 */
userRouter.get(
  "/:id/assets",
  requireFirebaseAuth,
  requireOwnership("id"),
  relaxedRateLimiter,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const assets = await getUserAssets(id);
    sendSuccess(res, assets);
  })
);

/**
 * POST /api/users/:id/assets/add
 * 增加用戶的資產
 * Body: { assetType: string, amount: number }
 */
userRouter.post(
  "/:id/assets/add",
  requireFirebaseAuth,
  requireOwnership("id"),
  standardRateLimiter,
  asyncHandler(async (req, res, next) => {
    try {
      const { id } = req.params;
      const { assetType, amount } = req.body;

      if (!assetType) {
        return sendError(res, "VALIDATION_ERROR", "需要提供資產類型", {
          field: "assetType",
        });
      }

      const updatedAssets = await addUserAsset(id, assetType, amount || 1);
      sendSuccess(res, updatedAssets);
    } catch (error) {
      next(error);
    }
  })
);

/**
 * POST /api/users/:id/assets/consume
 * 消耗用戶的資產
 * Body: { assetType: string, amount: number }
 */
userRouter.post(
  "/:id/assets/consume",
  requireFirebaseAuth,
  requireOwnership("id"),
  standardRateLimiter,
  asyncHandler(async (req, res, next) => {
    try {
      const { id } = req.params;
      const { assetType, amount } = req.body;

      if (!assetType) {
        return sendError(res, "VALIDATION_ERROR", "需要提供資產類型", {
          field: "assetType",
        });
      }

      const updatedAssets = await consumeUserAsset(id, assetType, amount || 1);
      sendSuccess(res, updatedAssets);
    } catch (error) {
      if (error.message && error.message.includes("數量不足")) {
        return sendError(res, "INSUFFICIENT_ASSETS", error.message, {
          assetType: req.body.assetType,
          requested: req.body.amount || 1,
        });
      }
      next(error);
    }
  })
);

/**
 * PUT /api/users/:id/assets
 * 設置用戶的資產（僅用於測試或管理）
 * Body: { assets: Object }
 */
userRouter.put(
  "/:id/assets",
  requireFirebaseAuth,
  requireOwnership("id"),
  standardRateLimiter,
  asyncHandler(async (req, res, next) => {
    try {
      const { id } = req.params;
      const { assets } = req.body;

      if (!assets || typeof assets !== "object") {
        return sendError(res, "VALIDATION_ERROR", "需要提供有效的資產對象", {
          field: "assets",
          expectedType: "object",
        });
      }

      const updatedAssets = await setUserAssets(id, assets);
      sendSuccess(res, updatedAssets);
    } catch (error) {
      next(error);
    }
  })
);
