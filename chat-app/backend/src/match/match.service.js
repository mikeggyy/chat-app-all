import { aiMatches } from "./match.data.js";
import { getFirestoreDb } from "../firebase/index.js";
import { uploadBase64Image, generateFilename } from "../firebase/storage.service.js";
import logger from "../utils/logger.js";
import { getCharacterById, characterExists } from "../services/character/characterCache.service.js";

const cloneMatch = (match) => ({ ...match });

const normalizeId = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
};

export const listMatches = () => aiMatches.map(cloneMatch);

export const getRandomMatch = () => {
  if (!aiMatches.length) {
    return null;
  }
  const match =
    aiMatches[Math.floor(Math.random() * aiMatches.length)] ?? aiMatches[0];
  return match ? cloneMatch(match) : null;
};

export const getMatchById = async (id) => {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    return null;
  }

  try {
    // ✅ 優先從緩存讀取
    const cachedCharacter = getCharacterById(normalizedId);
    if (cachedCharacter) {
      if (process.env.NODE_ENV !== "test") {
        logger.info(`[Match Service] Found character in cache: ${normalizedId}`);
      }
      return cloneMatch(cachedCharacter);
    }

    // ⚠️ 緩存未命中，回退到 Firestore
    logger.warn(`[Match Service] Character not in cache, falling back to Firestore: ${normalizedId}`);
    const db = getFirestoreDb();
    const doc = await db.collection("characters").doc(normalizedId).get();

    if (doc.exists) {
      const character = {
        ...doc.data(),
        id: doc.id,
      };

      if (process.env.NODE_ENV !== "test") {
        logger.info(`[Match Service] Found character in Firestore: ${normalizedId}`);
      }

      return cloneMatch(character);
    }

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Match Service] Character not found in Firestore: ${normalizedId}, checking memory`);
    }

    // Fallback 到記憶體陣列
    const match = aiMatches.find((item) => item.id === normalizedId);
    return match ? cloneMatch(match) : null;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Match Service] Failed to get character by ID:", error);
    }

    // Fallback 到記憶體陣列
    const match = aiMatches.find((item) => item.id === normalizedId);
    return match ? cloneMatch(match) : null;
  }
};

export const getMatchesByIds = (ids) => {
  if (!Array.isArray(ids) || !ids.length) {
    return { matches: [], missing: [] };
  }

  const normalizedIds = [];
  const seen = new Set();

  ids.forEach((value) => {
    const id = normalizeId(value);
    if (id && !seen.has(id)) {
      seen.add(id);
      normalizedIds.push(id);
    }
  });

  const matches = [];
  const missing = [];

  normalizedIds.forEach((id) => {
    // ✅ 優先從緩存讀取
    const cachedCharacter = getCharacterById(id);
    if (cachedCharacter) {
      matches.push(cloneMatch(cachedCharacter));
      return;
    }

    // ⚠️ 緩存未命中，檢查內存數組（舊角色）
    const match = aiMatches.find((item) => item.id === id);
    if (match) {
      matches.push(cloneMatch(match));
    } else {
      missing.push(id);
    }
  });

  return { matches, missing };
};

export const listMatchesForUser = async (user) => {
  const favoritesSet = new Set(
    Array.isArray(user?.favorites) ? user.favorites : []
  );
  const conversationsSet = new Set(
    Array.isArray(user?.conversations) ? user.conversations : []
  );

  // 从 Firestore 获取所有活跃角色
  let firestoreCharacters = [];
  try {
    const db = getFirestoreDb();
    const snapshot = await db
      .collection("characters")
      .where("status", "==", "active")
      .where("isPublic", "==", true)
      .orderBy("createdAt", "desc")
      .get();

    snapshot.forEach((doc) => {
      firestoreCharacters.push({
        ...doc.data(),
        id: doc.id,
      });
    });

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Match Service] Loaded ${firestoreCharacters.length} characters from Firestore`);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Match Service] Failed to load characters from Firestore:", error);
    }
    // Fallback 到内存数组
    firestoreCharacters = [];
  }

  // 合并 Firestore 角色和内存角色（去重）
  const characterMap = new Map();

  // 先加入 Firestore 角色
  firestoreCharacters.forEach((char) => {
    characterMap.set(char.id, char);
  });

  // 再加入内存角色（如果不存在）
  aiMatches.forEach((char) => {
    if (!characterMap.has(char.id)) {
      characterMap.set(char.id, char);
    }
  });

  const allCharacters = Array.from(characterMap.values());

  const decorated = allCharacters.map((match) => {
    const isFavorited = favoritesSet.has(match.id);
    const hasConversation = conversationsSet.has(match.id);
    const priority = !isFavorited && !hasConversation ? 0 : 1;
    return {
      priority,
      sortKey: Math.random(),
      data: match,
    };
  });

  decorated.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.sortKey - b.sortKey;
  });

  return decorated.map((item) => cloneMatch(item.data));
};

const resolveMatchCreatorId = (match) => {
  if (!match || typeof match !== "object") {
    return "";
  }
  const direct =
    normalizeId(match.creatorUid) || normalizeId(match.creator_uid);
  if (direct) {
    return direct;
  }
  return normalizeId(match.creator);
};

/**
 * 獲取按聊天用戶數量排序的熱門角色
 * @param {number} limit - 返回的角色數量（默認 10）
 * @param {Object} options - 選項
 * @param {number} options.offset - 分頁偏移量（默認 0）
 * @returns {Promise<Array>} 按 totalChatUsers 排序的角色列表，messageCount 代表與該角色聊過天的用戶數
 */
export const getPopularMatches = async (limit = 10, options = {}) => {
  const offset = options.offset || 0;

  try {
    const db = getFirestoreDb();

    // 直接從 Firestore 獲取所有公開角色，按 totalChatUsers 降序排序
    let query = db
      .collection("characters")
      .where("status", "==", "active")
      .where("isPublic", "==", true)
      .orderBy("totalChatUsers", "desc");

    // 如果有 offset，需要先獲取前 offset 條數據作為起點
    if (offset > 0) {
      const offsetSnapshot = await query.limit(offset).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    const charactersSnapshot = await query.limit(limit).get();

    const characters = [];
    charactersSnapshot.forEach((doc) => {
      const data = doc.data();
      characters.push({
        ...data,
        id: doc.id,
        messageCount: data.totalChatUsers || 0, // 使用 Firestore 的 totalChatUsers
      });
    });

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Match Service] Found ${characters.length} popular characters (offset: ${offset}, limit: ${limit})`);
    }

    return characters.map(cloneMatch);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Match Service] Failed to get popular matches:", error);
    }

    // Fallback：返回內存中的角色
    return aiMatches.slice(offset, offset + limit).map(cloneMatch);
  }
};

export const listMatchesByCreator = async (creatorId) => {
  const normalized = normalizeId(creatorId);
  if (!normalized) {
    return [];
  }

  try {
    const db = getFirestoreDb();
    const snapshot = await db
      .collection("characters")
      .where("creatorUid", "==", normalized)
      .where("status", "==", "active")
      .orderBy("createdAt", "desc")
      .get();

    const characters = [];
    snapshot.forEach((doc) => {
      characters.push({
        ...doc.data(),
        id: doc.id,
      });
    });

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Match Service] Found ${characters.length} characters for creator: ${normalized}`);
    }

    return characters.map((match) => cloneMatch(match));
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Match Service] Failed to list characters by creator:", error);
    }

    // Fallback 到記憶體陣列
    return aiMatches
      .filter((match) => resolveMatchCreatorId(match) === normalized)
      .map((match) => cloneMatch(match));
  }
};

export const createMatch = async (matchData) => {
  if (!matchData || typeof matchData !== "object") {
    throw new Error("Invalid match data");
  }

  const id = matchData.id || `match-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const creatorUid = normalizeId(matchData.creatorUid) || "";

  // 處理圖片上傳（如果是 base64）
  let portraitUrl = matchData.portraitUrl || "";

  if (portraitUrl && portraitUrl.startsWith("data:image")) {
    try {
      // 上傳 base64 圖片到 Firebase Storage
      const filename = generateFilename("character-portrait", id);
      portraitUrl = await uploadBase64Image(
        portraitUrl,
        creatorUid || "system",
        filename,
        "image/webp"
      );

      if (process.env.NODE_ENV !== "test") {
        logger.info(`[Match Create] Portrait uploaded successfully: ${filename}`);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        logger.error("[Match Create] Failed to upload portrait:", error);
      }
      throw new Error(`圖片上傳失敗: ${error.message}`);
    }
  }

  // 正規化 gender：將英文轉換為繁體中文
  let normalizedGender = matchData.gender || "";
  if (typeof normalizedGender === "string") {
    const genderMap = {
      "female": "女性",
      "male": "男性",
      "女性": "女性",
      "男性": "男性",
    };
    normalizedGender = genderMap[normalizedGender.toLowerCase()] || normalizedGender;
  }

  // 正規化 voice：如果是物件，提取 id；如果是字串，直接使用
  let normalizedVoice = "";
  if (typeof matchData.voice === "string") {
    normalizedVoice = matchData.voice;
  } else if (matchData.voice && typeof matchData.voice === "object") {
    normalizedVoice = matchData.voice.id || matchData.voice.value || matchData.voice.voice || "";
  }

  // 正規化 tags：確保是字串陣列
  let normalizedTags = [];
  if (Array.isArray(matchData.tags)) {
    normalizedTags = matchData.tags.filter(tag => typeof tag === "string" && tag.trim());
  } else if (matchData.tags && typeof matchData.tags === "object") {
    // 如果是物件，嘗試提取值
    normalizedTags = Object.values(matchData.tags).filter(tag => typeof tag === "string" && tag.trim());
  }

  const newMatch = {
    id,
    locale: matchData.locale || "zh-TW",
    creatorUid,
    creatorDisplayName: matchData.creatorDisplayName || "",
    display_name: matchData.display_name || "",
    gender: normalizedGender,
    background: matchData.background || "",
    first_message: matchData.first_message || "",
    secret_background: matchData.secret_background || "",
    appearanceDescription: matchData.appearanceDescription || "",
    styles: Array.isArray(matchData.styles) ? matchData.styles : [],
    totalChatUsers: matchData.totalChatUsers || 0,
    totalFavorites: matchData.totalFavorites || 0,
    portraitUrl,
    plot_hooks: Array.isArray(matchData.plot_hooks) ? matchData.plot_hooks : [],
    voice: normalizedVoice,
    status: "active",
    isPublic: true,
    tags: normalizedTags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 保存到 Firestore
  try {
    const db = getFirestoreDb();
    await db.collection("characters").doc(id).set(newMatch);

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Match Create] Character saved to Firestore: ${id}`);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Match Create] Failed to save to Firestore:", error);
    }
    throw new Error(`儲存角色資料失敗: ${error.message}`);
  }

  // 也加入記憶體陣列（保持向後相容）
  aiMatches.push(newMatch);

  return cloneMatch(newMatch);
};
