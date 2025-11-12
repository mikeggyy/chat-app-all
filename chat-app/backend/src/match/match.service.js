import { aiMatches } from "./match.data.js";
import { getFirestoreDb } from "../firebase/index.js";
import { FieldPath } from "firebase-admin/firestore";
import { uploadBase64Image, generateFilename } from "../firebase/storage.service.js";
import logger from "../utils/logger.js";
import { getCharacterById, getAllCharacters, characterExists } from "../services/character/characterCache.service.js";

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

export const getMatchesByIds = async (ids) => {
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

  // ✅ 優化：一次性獲取所有角色並建立 Map，避免重複查找
  const allCharacters = getAllCharacters(); // 從緩存獲取所有角色
  const characterMap = new Map(allCharacters.map(char => [char.id, char]));

  // Fallback: 如果緩存為空，使用內存數組
  if (characterMap.size === 0) {
    aiMatches.forEach(match => characterMap.set(match.id, match));
  }

  // 第一步：從緩存/內存中查找
  normalizedIds.forEach((id) => {
    const character = characterMap.get(id);

    if (character) {
      matches.push(cloneMatch(character));
    } else {
      missing.push(id);
    }
  });

  // 🔥 第二步：批量查詢缺失的角色（避免 N+1 問題）
  if (missing.length > 0) {
    try {
      const db = getFirestoreDb();

      // Firestore 的 'in' 查詢限制為 10 個，需要分批查詢
      const chunks = [];
      for (let i = 0; i < missing.length; i += 10) {
        chunks.push(missing.slice(i, i + 10));
      }

      if (process.env.NODE_ENV !== "test") {
        logger.info(
          `[Match Service] 批量查詢 ${missing.length} 個缺失角色（分 ${chunks.length} 批）`
        );
      }

      // 並行查詢所有批次（使用 FieldPath.documentId() 查詢文檔 ID）
      const queryPromises = chunks.map(chunk =>
        db.collection("characters")
          .where(FieldPath.documentId(), "in", chunk)
          .get()
      );

      const snapshots = await Promise.all(queryPromises);

      // 處理查詢結果
      const foundIds = new Set();
      snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          const character = {
            ...doc.data(),
            id: doc.id,
          };
          matches.push(cloneMatch(character));
          foundIds.add(doc.id);
        });
      });

      // 更新 missing 陣列，只保留真正找不到的
      const stillMissing = missing.filter(id => !foundIds.has(id));

      if (process.env.NODE_ENV !== "test") {
        logger.info(
          `[Match Service] 批量查詢完成: 找到 ${foundIds.size} 個，仍缺失 ${stillMissing.length} 個`
        );
      }

      return { matches, missing: stillMissing };
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        logger.error("[Match Service] 批量查詢角色失敗:", error);
      }
      // 查詢失敗時，返回已找到的角色和原始的 missing 陣列
      return { matches, missing };
    }
  }

  return { matches, missing };
};

export const listMatchesForUser = async (user) => {
  const favoritesSet = new Set(
    Array.isArray(user?.favorites) ? user.favorites : []
  );
  const conversationsSet = new Set(
    Array.isArray(user?.conversations) ? user.conversations : []
  );

  // ✅ 優化：從緩存獲取活躍且公開的角色（取代 Firestore 直接查詢）
  let allCharacters = [];

  try {
    // 從內存緩存讀取，速度極快且不產生 Firestore 讀取費用
    allCharacters = getAllCharacters({
      status: "active",
      isPublic: true,
    });

    // 如果緩存返回空數組（可能是緩存未初始化），進入 Fallback
    if (allCharacters.length === 0) {
      if (process.env.NODE_ENV !== "test") {
        logger.warn(`[Match Service] ⚠️ 緩存返回空數組，使用 Fallback`);
      }

      // 使用內存數組作為 Fallback
      allCharacters = aiMatches.filter((char) => {
        return char.status === "active" && char.isPublic === true;
      });
    } else {
      if (process.env.NODE_ENV !== "test") {
        logger.info(`[Match Service] ✅ 從緩存載入 ${allCharacters.length} 個角色（無 Firestore 讀取）`);
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Match Service] ❌ 從緩存載入角色失敗，嘗試 Fallback:", error);
    }

    // Fallback: 如果發生錯誤，使用內存數組
    allCharacters = aiMatches.filter((char) => {
      return char.status === "active" && char.isPublic === true;
    });

    if (process.env.NODE_ENV !== "test") {
      logger.warn(`[Match Service] ⚠️ 使用 Fallback，載入 ${allCharacters.length} 個角色`);
    }
  }

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
 * 支持兩種分頁模式：
 * 1. cursor-based（推薦）：使用 cursor 參數，性能優異，僅讀取需要的數據
 * 2. offset-based（向後兼容）：使用 offset 參數，性能較差，會讀取並跳過前面的數據
 *
 * @param {number} limit - 返回的角色數量（默認 10）
 * @param {Object} options - 選項
 * @param {number} options.offset - 分頁偏移量（offset-based，向後兼容）
 * @param {string} options.cursor - 游標（cursor-based，推薦）
 * @returns {Promise<{characters: Array, cursor: string|null, hasMore: boolean}>} 角色列表和分頁信息
 */
export const getPopularMatches = async (limit = 10, options = {}) => {
  const { offset = 0, cursor = null } = options;

  try {
    const db = getFirestoreDb();

    // 基礎查詢
    let query = db
      .collection("characters")
      .where("status", "==", "active")
      .where("isPublic", "==", true)
      .orderBy("totalChatUsers", "desc");

    let paginationInfo = {
      mode: 'offset',
      value: offset
    };

    // 優先使用 cursor-based 分頁（高效）
    if (cursor) {
      try {
        // cursor 是上一頁最後一個文檔的 ID
        const cursorDoc = await db.collection("characters").doc(cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
          paginationInfo = {
            mode: 'cursor',
            value: cursor
          };
        } else {
          logger.warn(`[Match Service] Cursor document not found: ${cursor}, falling back to offset`);
        }
      } catch (err) {
        logger.error(`[Match Service] Failed to use cursor: ${cursor}`, err);
        // 繼續使用 offset-based 作為 fallback
      }
    }
    // Fallback：使用 offset-based 分頁（低效，但向後兼容）
    else if (offset > 0) {
      // ⚠️ 性能警告：這會讀取並丟棄前 offset 條數據
      const offsetSnapshot = await query.limit(offset).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    // 多讀取 1 條以判斷是否還有更多數據
    const charactersSnapshot = await query.limit(limit + 1).get();

    const characters = [];
    const docs = charactersSnapshot.docs.slice(0, limit); // 只取實際需要的數量
    const hasMore = charactersSnapshot.docs.length > limit;

    docs.forEach((doc) => {
      const data = doc.data();
      characters.push({
        ...data,
        id: doc.id,
        messageCount: data.totalChatUsers || 0,
      });
    });

    // 新的 cursor 是本頁最後一個文檔的 ID
    const nextCursor = docs.length > 0 ? docs[docs.length - 1].id : null;

    if (process.env.NODE_ENV !== "test") {
      logger.info(
        `[Match Service] Found ${characters.length} popular characters ` +
        `(mode: ${paginationInfo.mode}, value: ${paginationInfo.value}, ` +
        `hasMore: ${hasMore}, nextCursor: ${nextCursor || 'null'})`
      );
    }

    // 返回包含分頁信息的結果
    return {
      characters: characters.map(cloneMatch),
      cursor: nextCursor,
      hasMore,
      // 向後兼容：也返回舊格式
      __legacy: characters.map(cloneMatch)
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Match Service] Failed to get popular matches:", error);
    }

    // Fallback：返回內存中的角色
    const fallbackChars = aiMatches.slice(offset, offset + limit).map(cloneMatch);
    return {
      characters: fallbackChars,
      cursor: null,
      hasMore: offset + limit < aiMatches.length,
      __legacy: fallbackChars
    };
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
