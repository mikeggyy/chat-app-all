import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import {
  getDocument,
  setDocument,
  updateDocument,
  queryCollection,
} from "../utils/firestoreHelpers.js";
import { normalizeGender, normalizeArray, trimString } from "../../../shared/utils/userUtils.js";
import { clearConversationHistory } from "../conversation/conversation.service.js";
import {
  getUserProfileWithCache,
  setCachedUserProfile,
  deleteCachedUserProfile,
} from "./userProfileCache.service.js";
import logger from "../utils/logger.js";

const USERS_COLLECTION = "users";

const extractConversationIdentifier = (value) => {
  if (typeof value === "string") {
    return trimString(value);
  }
  if (value && typeof value === "object") {
    return (
      trimString(value.conversationId) ||
      trimString(value.characterId) ||
      trimString(value.character?.id) ||
      trimString(value.matchId) ||
      trimString(value.id)
    );
  }
  return "";
};

const createConversationEntry = (conversationId, metadata = {}) => {
  const baseId = trimString(conversationId);
  if (!baseId) {
    throw new Error("建立聊天紀錄時需要提供有效的 conversationId");
  }

  const entry = {
    conversationId: baseId,
    characterId:
      trimString(metadata.characterId) ||
      trimString(metadata.matchId) ||
      baseId,
  };

  const assignString = (key, source) => {
    const value = trimString(source);
    if (value) {
      entry[key] = value;
    } else {
      delete entry[key];
    }
  };

  assignString("lastMessage", metadata.lastMessage ?? metadata.preview);
  assignString("lastMessageAt", metadata.lastMessageAt);
  assignString("lastSpeaker", metadata.lastSpeaker);
  assignString("partnerLastMessage", metadata.partnerLastMessage);
  assignString("partnerLastRepliedAt", metadata.partnerLastRepliedAt);

  if (metadata.character && typeof metadata.character === "object") {
    entry.character = metadata.character;
  }

  const explicitUpdatedAt = trimString(metadata.updatedAt);
  const fallbackUpdatedAt =
    entry.partnerLastRepliedAt || entry.lastMessageAt || null;
  entry.updatedAt =
    explicitUpdatedAt || fallbackUpdatedAt || new Date().toISOString();

  return entry;
};

const toNonNegativeInteger = (value) => {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return null;
  }
  return Math.floor(number);
};

const resolveWalletBalance = (...candidates) => {
  for (const candidate of candidates) {
    const normalized = toNonNegativeInteger(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }
  return 0;
};

const normalizeWallet = (walletPayload, resolvedBalance, fallbackUpdatedAt) => {
  const wallet = {
    balance: resolvedBalance,
    currency: "TWD",
    updatedAt: fallbackUpdatedAt,
  };

  if (walletPayload && typeof walletPayload === "object") {
    const currency = trimString(walletPayload.currency);
    if (currency) {
      wallet.currency = currency;
    }

    const updatedAt = trimString(walletPayload.updatedAt);
    if (updatedAt) {
      wallet.updatedAt = updatedAt;
    }

    if (Array.isArray(walletPayload.history)) {
      wallet.history = walletPayload.history;
    }
  }

  return wallet;
};

const normalizeAssets = (payload) => {
  const assets = {
    characterUnlockCards: toNonNegativeInteger(payload?.characterUnlockCards) ?? 0,
    photoUnlockCards: toNonNegativeInteger(payload?.photoUnlockCards) ?? 0,
    videoUnlockCards: toNonNegativeInteger(payload?.videoUnlockCards) ?? 0,
    voiceUnlockCards: toNonNegativeInteger(payload?.voiceUnlockCards) ?? 0,
    createCards: toNonNegativeInteger(payload?.createCards) ?? 0,
  };
  return assets;
};

/**
 * 規範化 unlockTickets 欄位（✅ 只保留 usageHistory，不處理資產卡片）
 */
const normalizeUnlockTickets = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  // ✅ unlockTickets 只用於審計記錄，只保留 usageHistory
  const usageHistory = Array.isArray(payload.usageHistory) ? payload.usageHistory : [];

  return {
    usageHistory
  };
};

export const normalizeUser = (payload = {}) => {
  const nowIso = new Date().toISOString();
  const id = payload.id ?? "";
  const createdAt = payload.createdAt ?? nowIso;
  const updatedAt = payload.updatedAt ?? createdAt;
  const lastLoginAt = payload.lastLoginAt ?? updatedAt;

  // 解析錢包餘額（向後兼容：支援讀取舊格式）
  const walletBalance = resolveWalletBalance(
    payload.wallet?.balance,        // 優先使用新格式
    payload.walletBalance,           // 舊格式 1
    payload.coins,                   // 舊格式 2
    payload.balance                  // 備用
  );
  const wallet = normalizeWallet(payload.wallet, walletBalance, updatedAt);

  // 規範化 unlockTickets（移除 undefined 值）
  const unlockTickets = normalizeUnlockTickets(payload.unlockTickets);

  const user = {
    id,
    displayName: payload.displayName ?? "未命名使用者",
    locale: payload.locale ?? "zh-TW",
    createdAt,
    defaultPrompt: payload.defaultPrompt ?? "",
    email: payload.email ?? "",
    photoURL: payload.photoURL ?? "/avatars/defult-01.webp",
    lastLoginAt,
    phoneNumber: payload.phoneNumber ?? null,
    gender: normalizeGender(payload.gender) ?? "other",
    age: toNonNegativeInteger(payload.age) ?? null,
    hasCompletedOnboarding: Boolean(payload.hasCompletedOnboarding),
    notificationOptIn: Boolean(payload.notificationOptIn),
    signInProvider: payload.signInProvider ?? "unknown",
    uid: payload.uid ?? (id || "未設定帳號"),
    updatedAt,
    conversations: normalizeArray(payload.conversations),
    favorites: normalizeArray(payload.favorites),
    // ⚠️ 不再生成 walletBalance 和 coins（冗餘字段）
    // 統一使用 wallet.balance
    wallet,

    // 會員系統欄位
    membershipTier: payload.membershipTier ?? "free",
    membershipStatus: payload.membershipStatus ?? "active",
    membershipStartedAt: payload.membershipStartedAt ?? null,
    membershipExpiresAt: payload.membershipExpiresAt ?? null,
    membershipAutoRenew: Boolean(payload.membershipAutoRenew),

    // 資產系統欄位
    assets: normalizeAssets(payload.assets),
  };

  // 只在有效時才添加 unlockTickets 欄位（避免寫入 null 或 undefined）
  if (unlockTickets) {
    user.unlockTickets = unlockTickets;
  }

  return user;
};

export const upsertUser = async (payload = {}) => {
  if (!payload.id) {
    throw new Error("使用者資料缺少必要的 id 欄位");
  }

  // ⚠️ 修復：如果 payload 中沒有 hasCompletedOnboarding，從 Firestore 讀取現有值
  // 這樣可以避免在用戶登入時覆蓋已完成的 onboarding 狀態
  let finalPayload = { ...payload };

  if (!Object.prototype.hasOwnProperty.call(payload, "hasCompletedOnboarding")) {
    // 嘗試從 Firestore 讀取現有用戶
    const existing = await getUserById(payload.id);
    if (existing && typeof existing.hasCompletedOnboarding === "boolean") {
      // 保留現有的 hasCompletedOnboarding 值
      finalPayload.hasCompletedOnboarding = existing.hasCompletedOnboarding;
    }
    // 如果是新用戶或現有用戶沒有此欄位，normalizeUser 會使用預設值 false
  }

  const user = normalizeUser(finalPayload);
  const db = getFirestoreDb();
  const userRef = db.collection(USERS_COLLECTION).doc(user.id);

  await userRef.set(user, { merge: true });

  // 更新緩存
  setCachedUserProfile(user.id, user);

  return user;
};

export const getUserById = async (id) => {
  if (!id) return null;

  const user = await getDocument(USERS_COLLECTION, id);
  return user;
};

export const updateUserPhoto = async (id, photoURL) => {
  if (!id) {
    throw new Error("更新頭像時需要提供 id");
  }
  if (!photoURL) {
    throw new Error("更新頭像時需要提供 photoURL");
  }

  const existing = await getUserById(id);
  if (!existing) {
    throw new Error("找不到指定的使用者資料");
  }

  const db = getFirestoreDb();
  const userRef = db.collection(USERS_COLLECTION).doc(id);
  const nowIso = new Date().toISOString();

  const updated = {
    photoURL,
    updatedAt: nowIso,
  };

  await userRef.update(updated);

  const updatedUser = {
    ...existing,
    photoURL,
    updatedAt: nowIso,
  };

  // 刪除舊緩存，下次讀取時會重新緩存
  deleteCachedUserProfile(id);

  return updatedUser;
};

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

export const updateUserProfileFields = async (id, updates = {}) => {
  if (!id) {
    throw new Error("更新個人資料時需要提供 id");
  }
  if (!updates || typeof updates !== "object") {
    throw new Error("更新個人資料時需要提供有效的內容");
  }

  const allowedKeys = ["displayName", "gender", "age", "hasCompletedOnboarding", "defaultPrompt"];
  const hasAllowedKey = allowedKeys.some((key) => hasOwn(updates, key));

  if (!hasAllowedKey) {
    throw new Error("未提供可更新的欄位");
  }

  const existing = await getUserById(id);
  if (!existing) {
    throw new Error("找不到指定的使用者資料");
  }

  const existingName =
    typeof existing.displayName === "string"
      ? existing.displayName.trim()
      : "未命名使用者";
  let nextDisplayName = existingName;
  if (hasOwn(updates, "displayName")) {
    const rawName =
      typeof updates.displayName === "string"
        ? updates.displayName.trim()
        : "";
    if (!rawName.length) {
      throw new Error("名稱不得為空");
    }
    if (rawName.length > 10) {
      throw new Error("名稱請勿超過 10 個字");
    }
    nextDisplayName = rawName;
  }

  const existingGender =
    typeof existing.gender === "string" && existing.gender.trim().length
      ? existing.gender.trim()
      : "other";
  let nextGender = existingGender;
  if (hasOwn(updates, "gender")) {
    const rawGender = updates.gender;
    if (
      rawGender === null ||
      typeof rawGender === "undefined" ||
      (typeof rawGender === "string" && rawGender.trim().length === 0)
    ) {
      nextGender = "other";
    } else {
      nextGender = normalizeGender(rawGender) ?? "other";
    }
  }

  const existingPrompt =
    typeof existing.defaultPrompt === "string"
      ? existing.defaultPrompt.trim()
      : "";
  let nextDefaultPrompt = existingPrompt;
  if (hasOwn(updates, "defaultPrompt")) {
    const rawPrompt =
      typeof updates.defaultPrompt === "string"
        ? updates.defaultPrompt.trim()
        : "";
    if (rawPrompt.length > 50) {
      throw new Error("角色設定請勿超過 50 個字");
    }
    nextDefaultPrompt = rawPrompt;
  }

  const existingAge = toNonNegativeInteger(existing.age) ?? null;
  let nextAge = existingAge;
  if (hasOwn(updates, "age")) {
    const rawAge = updates.age;
    if (rawAge === null || typeof rawAge === "undefined") {
      nextAge = null;
    } else {
      const normalized = toNonNegativeInteger(rawAge);
      if (normalized !== null && (normalized < 13 || normalized > 120)) {
        throw new Error("年齡必須在 13 到 120 歲之間");
      }
      nextAge = normalized;
    }
  }

  const existingHasCompletedOnboarding = Boolean(existing.hasCompletedOnboarding);
  let nextHasCompletedOnboarding = existingHasCompletedOnboarding;
  if (hasOwn(updates, "hasCompletedOnboarding")) {
    nextHasCompletedOnboarding = Boolean(updates.hasCompletedOnboarding);
  }

  const db = getFirestoreDb();
  const userRef = db.collection(USERS_COLLECTION).doc(id);

  // ✅ 修復：只更新有變更的欄位，並單獨處理 updatedAt
  const updateData = {};

  if (nextDisplayName !== existingName) {
    updateData.displayName = nextDisplayName;
  }
  if (nextGender !== existingGender) {
    updateData.gender = nextGender;
  }
  if (nextAge !== existingAge) {
    updateData.age = nextAge;
  }
  if (nextHasCompletedOnboarding !== existingHasCompletedOnboarding) {
    updateData.hasCompletedOnboarding = nextHasCompletedOnboarding;
  }
  if (nextDefaultPrompt !== existingPrompt) {
    updateData.defaultPrompt = nextDefaultPrompt;
  }

  // 總是更新 updatedAt（使用 ISO 字串而非 serverTimestamp）
  updateData.updatedAt = new Date().toISOString();

  await userRef.update(updateData);

  // 直接返回標準化的數據，避免 serverTimestamp 解析延遲問題
  const updatedUser = normalizeUser({
    ...existing,
    displayName: nextDisplayName,
    gender: nextGender,
    age: nextAge,
    hasCompletedOnboarding: nextHasCompletedOnboarding,
    defaultPrompt: nextDefaultPrompt,
    updatedAt: new Date().toISOString(),
  });

  // 刪除舊緩存，下次讀取時會重新緩存
  deleteCachedUserProfile(id);

  return updatedUser;
};

const updateUserFavorites = async (id, buildFavorites) => {
  if (!id) {
    throw new Error("更新收藏時需要提供 id");
  }
  if (typeof buildFavorites !== "function") {
    throw new Error("更新收藏需要提供處理函式");
  }

  let existing = await getUserById(id);

  // ✅ 修復：不自動創建用戶
  if (!existing) {
    throw new Error(`用戶不存在: ${id}，請先完成註冊流程`);
  }

  const favorites = Array.isArray(existing.favorites)
    ? existing.favorites
    : [];
  const nextFavorites = buildFavorites(favorites);

  if (!Array.isArray(nextFavorites)) {
    throw new Error("更新收藏時需要回傳陣列");
  }

  const uniqueFavorites = Array.from(new Set(nextFavorites.filter(Boolean)));

  const db = getFirestoreDb();
  const userRef = db.collection(USERS_COLLECTION).doc(id);
  const nowIso = new Date().toISOString();

  await userRef.update({
    favorites: uniqueFavorites,
    updatedAt: nowIso,
  });

  // ✅ 清除緩存，確保下次讀取時獲取最新數據
  deleteCachedUserProfile(id);

  return {
    ...existing,
    favorites: uniqueFavorites,
    updatedAt: nowIso,
  };
};

export const addFavoriteForUser = async (id, favoriteId) => {
  if (!favoriteId) {
    throw new Error("加入收藏時需要提供 favoriteId");
  }

  // 先檢查是否已經存在
  let isNewFavorite = false;

  const user = await updateUserFavorites(id, (favorites) => {
    const alreadyExists = favorites.includes(favoriteId);
    if (!alreadyExists) {
      isNewFavorite = true;
    }
    return alreadyExists ? favorites : [...favorites, favoriteId];
  });

  logger.info('[addFavoriteForUser] updateUserFavorites 返回:', {
    favorites: user?.favorites,
    favoritesLength: user?.favorites?.length,
    id: user?.id
  });

  // ✅ 如果是首次收藏，更新角色的 totalFavorites
  if (isNewFavorite) {
    try {
      const db = getFirestoreDb();
      const characterRef = db.collection("characters").doc(favoriteId);

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(characterRef);
        if (doc.exists) {
          const currentCount = doc.data().totalFavorites || 0;
          transaction.update(characterRef, {
            totalFavorites: currentCount + 1,
            updatedAt: new Date().toISOString()
          });
        }
      });

      logger.info(`[收藏計數] 角色 ${favoriteId} 的 totalFavorites +1（用戶 ${id}）`);
    } catch (error) {
      logger.error(`[收藏計數] 更新失敗:`, error);
      // 不影響收藏操作
    }
  }

  return {
    ...user,
    isNewFavorite, // 返回是否為新增的喜歡
  };
};

export const removeFavoriteForUser = async (id, favoriteId) => {
  if (!favoriteId) {
    throw new Error("移除收藏時需要提供 favoriteId");
  }

  // 檢查用戶是否真的有這個收藏
  let wasRemoved = false;
  const existingUser = await getUserById(id);
  if (existingUser?.favorites?.includes(favoriteId)) {
    wasRemoved = true;
  }

  const user = await updateUserFavorites(id, (favorites) =>
    favorites.filter((value) => value !== favoriteId)
  );

  // ✅ 如果確實移除了收藏，減少角色的 totalFavorites
  if (wasRemoved) {
    try {
      const db = getFirestoreDb();
      const characterRef = db.collection("characters").doc(favoriteId);

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(characterRef);
        if (doc.exists) {
          const currentCount = doc.data().totalFavorites || 0;
          transaction.update(characterRef, {
            totalFavorites: Math.max(0, currentCount - 1), // 防止負數
            updatedAt: new Date().toISOString()
          });
        }
      });

      logger.info(`[收藏計數] 角色 ${favoriteId} 的 totalFavorites -1（用戶 ${id}）`);
    } catch (error) {
      logger.error(`[收藏計數] 減少失敗:`, error);
      // 不影響取消收藏操作
    }
  }

  return user;
};

const updateUserConversations = async (id, buildConversations) => {
  if (!id) {
    throw new Error("更新聊天紀錄時需要提供 id");
  }
  if (typeof buildConversations !== "function") {
    throw new Error("更新聊天紀錄需要提供處理函式");
  }

  let existing = await getUserById(id);

  // ✅ 修復：不自動創建用戶
  if (!existing) {
    throw new Error(`用戶不存在: ${id}，請先完成註冊流程`);
  }

  const conversations = Array.isArray(existing.conversations)
    ? existing.conversations
    : [];
  const nextConversations = buildConversations(conversations);

  if (!Array.isArray(nextConversations)) {
    throw new Error("更新聊天紀錄時需要回傳陣列");
  }

  const uniqueConversations = [];
  const seen = new Set();

  for (const entry of nextConversations) {
    if (!entry) {
      continue;
    }
    const identifier = extractConversationIdentifier(entry);
    if (!identifier || seen.has(identifier)) {
      continue;
    }
    if (typeof entry === "string") {
      uniqueConversations.push(identifier);
    } else if (entry && typeof entry === "object") {
      uniqueConversations.push({
        ...entry,
        conversationId: trimString(entry.conversationId) || identifier,
        characterId:
          trimString(entry.characterId) ||
          trimString(entry.matchId) ||
          trimString(entry.character?.id) ||
          identifier,
      });
    }
    seen.add(identifier);
  }

  const db = getFirestoreDb();
  const userRef = db.collection(USERS_COLLECTION).doc(id);
  const nowIso = new Date().toISOString();

  await userRef.update({
    conversations: uniqueConversations,
    updatedAt: nowIso,
  });

  // ✅ 清除緩存，確保下次讀取時獲取最新數據
  deleteCachedUserProfile(id);

  return {
    ...existing,
    conversations: uniqueConversations,
    updatedAt: nowIso,
  };
};

export const addConversationForUser = async (id, conversationId, metadata = {}) => {
  const normalizedId = trimString(conversationId);
  if (!normalizedId) {
    throw new Error("建立聊天紀錄時需要提供 conversationId");
  }

  return updateUserConversations(id, (conversations) => {
    const list = Array.isArray(conversations) ? conversations : [];
    const filtered = list.filter((value) => {
      const identifier = extractConversationIdentifier(value);
      return identifier !== normalizedId;
    });
    const entry =
      metadata && typeof metadata === "object"
        ? createConversationEntry(normalizedId, metadata)
        : createConversationEntry(normalizedId);
    return [entry, ...filtered];
  });
};

export const removeConversationForUser = async (id, conversationId) => {
  const normalizedId = trimString(conversationId);
  if (!normalizedId) {
    throw new Error("重置聊天紀錄時需要提供 conversationId");
  }

  const updated = await updateUserConversations(id, (conversations) =>
    conversations.filter((value) => {
      const identifier = extractConversationIdentifier(value);
      return identifier !== normalizedId;
    })
  );

  await clearConversationHistory(id, normalizedId);

  return updated;
};

/**
 * 獲取所有用戶（支援分頁）
 * @param {Object} options - 查詢選項
 * @param {number} options.limit - 每頁數量（默認 100）
 * @param {string} options.startAfter - 從哪個用戶 ID 之後開始（用於分頁）
 * @returns {Promise<Object>} 包含用戶列表和分頁資訊
 */
export const getAllUsers = async (options = {}) => {
  const { limit = 100, startAfter = null } = options;

  const db = getFirestoreDb();
  let query = db.collection(USERS_COLLECTION).orderBy("createdAt", "desc").limit(limit);

  // 如果有 startAfter，從該用戶之後開始查詢
  if (startAfter) {
    const startDoc = await db.collection(USERS_COLLECTION).doc(startAfter).get();
    if (startDoc.exists) {
      query = query.startAfter(startDoc);
    }
  }

  const snapshot = await query.get();
  const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // 返回用戶列表和分頁資訊
  return {
    users,
    hasMore: users.length === limit,
    lastUserId: users.length > 0 ? users[users.length - 1].id : null,
  };
};

/**
 * 清理長時間未活動的用戶資料以防止資料庫過於龐大
 * @param {number} inactiveDays - 未活動天數閾值（預設 30 天）
 * @returns {Object} 清理統計資訊
 */
export const cleanupInactiveUsers = async (inactiveDays = 30) => {
  const now = new Date();
  const inactiveThreshold = new Date(
    now.getTime() - inactiveDays * 24 * 60 * 60 * 1000
  );

  const db = getFirestoreDb();
  const snapshot = await db.collection(USERS_COLLECTION).get();

  const usersToDelete = [];
  const protectedUsers = new Set([
    "test-user", // GUEST_USER_ID
    "dev-user",  // DEV_USER_ID
    "demo-user",
  ]);

  for (const doc of snapshot.docs) {
    const userId = doc.id;
    const user = doc.data();

    // 保護測試帳號不被清理
    if (protectedUsers.has(userId)) {
      continue;
    }

    const lastLoginDate = user.lastLoginAt ? new Date(user.lastLoginAt) : null;
    if (!lastLoginDate || lastLoginDate < inactiveThreshold) {
      usersToDelete.push(userId);
    }
  }

  // 清理用戶及其對話歷史
  const batch = db.batch();
  for (const userId of usersToDelete) {
    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    batch.delete(userRef);

    // TODO: Also clean up related conversation documents
    // This will be implemented when conversation.service.js is migrated
  }

  if (usersToDelete.length > 0) {
    await batch.commit();
  }

  return {
    deletedCount: usersToDelete.length,
    remainingCount: snapshot.docs.length - usersToDelete.length,
    threshold: inactiveThreshold.toISOString(),
  };
};
