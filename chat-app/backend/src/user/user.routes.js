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
} from "./user.service.js";
import {
  getUserAssets,
  addUserAsset,
  consumeUserAsset,
  setUserAssets,
} from "./assets.service.js";
import { getUserConversations } from "./userConversations.service.js";
import { requireFirebaseAuth } from "../auth/index.js";
import { requireOwnership, asyncHandler, sendSuccess, sendError } from "../utils/routeHelpers.js";
import { requireAdmin } from "../middleware/adminAuth.middleware.js";
import {
  getMatchesByIds,
  listMatchesByCreator,
} from "../match/match.service.js";
import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import logger from "../utils/logger.js";

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

const buildFavoritesPayload = (user, includeMatches) => {
  const favorites = Array.isArray(user?.favorites) ? user.favorites : [];

  if (!includeMatches) {
    return { favorites };
  }

  const { matches, missing } = getMatchesByIds(favorites);
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
userRouter.get("/", requireFirebaseAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { limit, startAfter } = req.query;

  const result = await getAllUsers({
    limit: limit ? parseInt(limit) : 100,
    startAfter: startAfter || null,
  });

  res.json(result);
}));

// 獲取指定用戶資料 - 需要身份驗證且只能訪問自己的資料
userRouter.get("/:id", requireFirebaseAuth, requireOwnership("id"), asyncHandler(async (req, res) => {
  let user = await getUserById(req.params.id);

  // 如果用戶不存在，為測試用戶自動創建基本記錄
  if (!user) {
    const newUser = {
      id: req.params.id,
      uid: req.params.id,
      displayName: "測試使用者",
      conversations: [],
      favorites: [],
    };
    await upsertUser(newUser);
    user = await getUserById(req.params.id);

    if (!user) {
      res.status(404).json({ message: "找不到指定的使用者資料" });
      return;
    }
  }

  res.json(user);
}));

userRouter.post("/", requireFirebaseAuth, asyncHandler(async (req, res) => {
  const firebaseUser = req.firebaseUser;
  if (!firebaseUser?.uid) {
    res.status(400).json({
      message: "Firebase 使用者資訊不完整，無法建立資料。",
    });
    return;
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
  res.status(201).json(user);
}));

userRouter.patch(
  "/:id/photo",
  requireFirebaseAuth,
  requireOwnership("id"),
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
  asyncHandler(async (req, res) => {
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
      return sendError(res, "未提供可更新的欄位", 400);
    }

    const user = await updateUserProfileFields(id, patch);
    sendSuccess(res, user);
  })
);

userRouter.get("/:id/favorites", requireFirebaseAuth, requireOwnership("id"), asyncHandler(async (req, res) => {
  let user = await getUserById(req.params.id);

  // 如果用戶不存在，為測試用戶自動創建基本記錄
  if (!user) {
    const newUser = {
      id: req.params.id,
      uid: req.params.id,
      displayName: "測試使用者",
      conversations: [],
      favorites: [],
    };
    await upsertUser(newUser);
    user = await getUserById(req.params.id);

    if (!user) {
      res.status(404).json({ message: "找不到指定的使用者資料" });
      return;
    }
  }

  const includeMatches = shouldIncludeMatches(req.query);
  res.json(buildFavoritesPayload(user, includeMatches));
}));

userRouter.get("/:id/characters", requireFirebaseAuth, requireOwnership("id"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const characters = await listMatchesByCreator(id);
  res.json({
    characters,
    total: characters.length,
  });
}));

userRouter.post(
  "/:id/favorites",
  requireFirebaseAuth,
  requireOwnership("id"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { matchId, favoriteId } = req.body ?? {};
    const targetFavoriteId = matchId ?? favoriteId ?? "";
    const includeMatches = shouldIncludeMatches(req.query);

    const user = await addFavoriteForUser(id, targetFavoriteId);

    // 檢查是否是首次喜歡，如果是則增加角色的 totalFavorites
    if (user?.isNewFavorite) {
      try {
        const db = getFirestoreDb();
        const characterRef = db.collection("characters").doc(targetFavoriteId);
        await characterRef.update({
          totalFavorites: FieldValue.increment(1),
          updatedAt: new Date().toISOString()
        });

        if (process.env.NODE_ENV !== "test") {
          logger.info(`[喜歡數量] 角色 ${targetFavoriteId} 的 totalFavorites +1（用戶 ${id} 首次喜歡）`);
        }
      } catch (incrementError) {
        if (process.env.NODE_ENV !== "test") {
          logger.error(`[喜歡數量] 更新失敗:`, incrementError);
        }
        // 增量失敗不影響收藏操作
      }
    }

    sendSuccess(res, buildFavoritesPayload(user, includeMatches), 201);
  })
);

userRouter.delete(
  "/:id/favorites/:favoriteId",
  requireFirebaseAuth,
  requireOwnership("id"),
  asyncHandler(async (req, res) => {
    const { id, favoriteId } = req.params;
    const includeMatches = shouldIncludeMatches(req.query);

    const user = await removeFavoriteForUser(id, favoriteId);
    sendSuccess(res, buildFavoritesPayload(user, includeMatches));
  })
);

userRouter.get("/:id/conversations", requireFirebaseAuth, requireOwnership("id"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
  const cursor = req.query.cursor || null;

  try {
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

    // 首先從內存獲取基本信息
    const { matches: characters } = getMatchesByIds(characterIds);
    const charactersMap = new Map(characters.map((char) => [char.id, char]));

    // 從 Firestore 獲取統計信息（totalChatUsers, totalFavorites）
    const db = getFirestoreDb();
    const statsPromises = characterIds.map(async (charId) => {
      try {
        const charDoc = await db.collection("characters").doc(charId).get();
        if (charDoc.exists) {
          const data = charDoc.data();
          return {
            id: charId,
            totalChatUsers: data.totalChatUsers || 0,
            totalFavorites: data.totalFavorites || 0,
          };
        }
      } catch (error) {
        logger.warn(`獲取角色 ${charId} 統計信息失敗:`, error);
      }
      return { id: charId, totalChatUsers: 0, totalFavorites: 0 };
    });

    const statsResults = await Promise.all(statsPromises);
    const statsMap = new Map(statsResults.map((stat) => [stat.id, stat]));

    const enrichedConversations = conversations.map((conv) => {
      const characterId = conv.characterId || conv.conversationId;
      const character = charactersMap.get(characterId);
      const stats = statsMap.get(characterId);

      return {
        ...conv,
        character: character
          ? {
              ...character,
              messageCount: stats?.totalChatUsers || 0,
              totalFavorites: stats?.totalFavorites || 0,
            }
          : conv.character || null,
      };
    });

    res.json({
      conversations: enrichedConversations,
      total: enrichedConversations.length,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    // 如果用戶不存在或出錯，返回空數組
    res.json({
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
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { assetType, amount } = req.body;

    if (!assetType) {
      return sendError(res, 400, "需要提供資產類型");
    }

    const updatedAssets = await addUserAsset(id, assetType, amount || 1);
    sendSuccess(res, updatedAssets);
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
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { assetType, amount } = req.body;

    if (!assetType) {
      return sendError(res, 400, "需要提供資產類型");
    }

    try {
      const updatedAssets = await consumeUserAsset(id, assetType, amount || 1);
      sendSuccess(res, updatedAssets);
    } catch (error) {
      if (error.message && error.message.includes("數量不足")) {
        return sendError(res, 400, error.message);
      }
      throw error;
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
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { assets } = req.body;

    if (!assets || typeof assets !== "object") {
      return sendError(res, 400, "需要提供有效的資產對象");
    }

    const updatedAssets = await setUserAssets(id, assets);
    sendSuccess(res, updatedAssets);
  })
);
