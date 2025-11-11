/**
 * Characters 內存緩存服務
 *
 * 功能：
 * - 將所有 characters 數據緩存在內存中
 * - 自動監聽 Firestore 變化並更新緩存
 * - 大幅減少 Firestore 讀取次數（預期減少 80-90%）
 *
 * 使用場景：
 * - AI 對話時獲取角色配置
 * - 用戶瀏覽角色列表
 * - 管理後台角色管理
 *
 * 性能優化效果：
 * - 原本：每條消息都查詢 Firestore（1000 用戶 = 1000 次讀取/秒）
 * - 優化後：所有請求從內存讀取（0 次 Firestore 讀取，僅初始化和更新時讀取）
 * - 成本節省：~$0.05-0.10 / 天（基於每天 100 萬條消息）
 */

import { db } from "../../firebase/index.js";
import logger from "../../utils/logger.js";

/**
 * 內存緩存
 * Map<characterId, characterData>
 */
let charactersCache = new Map();

/**
 * 緩存狀態
 */
let cacheInitialized = false;
let cacheLastUpdated = null;
let firestoreUnsubscribe = null;

/**
 * 初始化 characters 緩存
 * 從 Firestore 讀取所有角色數據並緩存
 *
 * @returns {Promise<void>}
 */
export const initializeCharactersCache = async () => {
  try {
    logger.info("[CharacterCache] 正在初始化角色緩存...");

    const charactersSnapshot = await db.collection("characters").get();

    charactersCache.clear();
    charactersSnapshot.docs.forEach((doc) => {
      charactersCache.set(doc.id, {
        id: doc.id,
        ...doc.data(),
      });
    });

    cacheInitialized = true;
    cacheLastUpdated = new Date();

    logger.info(
      `[CharacterCache] ✅ 角色緩存初始化完成，共緩存 ${charactersCache.size} 個角色`
    );

    // 啟動實時監聽
    startRealtimeSync();
  } catch (error) {
    logger.error("[CharacterCache] ❌ 初始化角色緩存失敗:", error);
    throw error;
  }
};

/**
 * 啟動實時同步
 * 監聽 Firestore 的變化並自動更新緩存
 */
const startRealtimeSync = () => {
  // 如果已經有監聽器，先取消
  if (firestoreUnsubscribe) {
    firestoreUnsubscribe();
  }

  firestoreUnsubscribe = db.collection("characters").onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const characterId = change.doc.id;
        const characterData = {
          id: characterId,
          ...change.doc.data(),
        };

        switch (change.type) {
          case "added":
          case "modified":
            charactersCache.set(characterId, characterData);
            logger.info(
              `[CharacterCache] 🔄 角色更新：${characterData.name || characterId}`
            );
            break;

          case "removed":
            charactersCache.delete(characterId);
            logger.info(
              `[CharacterCache] 🗑️ 角色刪除：${characterId}`
            );
            break;
        }
      });

      cacheLastUpdated = new Date();
    },
    (error) => {
      logger.error("[CharacterCache] ❌ 實時同步錯誤:", error);
      // 發生錯誤時，5 分鐘後嘗試重新初始化
      setTimeout(() => {
        logger.info("[CharacterCache] 🔄 嘗試重新初始化緩存...");
        initializeCharactersCache().catch((error) => {
          logger.error("角色快取初始化失敗:", error);
        });
      }, 5 * 60 * 1000);
    }
  );

  logger.info("[CharacterCache] 🔔 實時同步已啟動");
};

/**
 * 根據 ID 獲取角色
 * 從內存緩存讀取，速度極快
 *
 * @param {string} characterId - 角色 ID
 * @returns {Object|null} 角色數據，如果不存在則返回 null
 *
 * @example
 * const character = getCharacterById("char_123");
 * if (character) {
 *   console.log(character.name);
 * }
 */
export const getCharacterById = (characterId) => {
  if (!cacheInitialized) {
    logger.warn(
      "[CharacterCache] ⚠️ 緩存尚未初始化，請先調用 initializeCharactersCache()"
    );
    return null;
  }

  return charactersCache.get(characterId) || null;
};

/**
 * 獲取所有角色
 * 從內存緩存讀取
 *
 * @param {Object} [filter] - 過濾條件
 * @param {boolean} [filter.isPublic] - 是否只返回公開角色
 * @param {boolean} [filter.isActive] - 是否只返回活躍角色
 * @returns {Array<Object>} 角色列表
 *
 * @example
 * const publicCharacters = getAllCharacters({ isPublic: true });
 */
export const getAllCharacters = (filter = {}) => {
  if (!cacheInitialized) {
    logger.warn(
      "[CharacterCache] ⚠️ 緩存尚未初始化，請先調用 initializeCharactersCache()"
    );
    return [];
  }

  let characters = Array.from(charactersCache.values());

  // 應用過濾條件
  if (filter.isPublic !== undefined) {
    characters = characters.filter((c) => c.isPublic === filter.isPublic);
  }

  if (filter.isActive !== undefined) {
    characters = characters.filter((c) => c.isActive === filter.isActive);
  }

  return characters;
};

/**
 * 批量獲取角色
 * 從內存緩存批量讀取，比逐個查詢 Firestore 快得多
 *
 * @param {Array<string>} characterIds - 角色 ID 列表
 * @returns {Map<string, Object>} 角色 ID 到角色數據的映射
 *
 * @example
 * const ids = ["char_1", "char_2", "char_3"];
 * const charactersMap = getCharactersByIds(ids);
 * charactersMap.forEach((character, id) => {
 *   console.log(`${id}: ${character.name}`);
 * });
 */
export const getCharactersByIds = (characterIds) => {
  if (!cacheInitialized) {
    logger.warn(
      "[CharacterCache] ⚠️ 緩存尚未初始化，請先調用 initializeCharactersCache()"
    );
    return new Map();
  }

  const result = new Map();

  characterIds.forEach((id) => {
    const character = charactersCache.get(id);
    if (character) {
      result.set(id, character);
    }
  });

  return result;
};

/**
 * 檢查角色是否存在
 *
 * @param {string} characterId - 角色 ID
 * @returns {boolean} 是否存在
 */
export const characterExists = (characterId) => {
  return cacheInitialized && charactersCache.has(characterId);
};

/**
 * 獲取緩存統計信息
 *
 * @returns {Object} 統計信息
 */
export const getCacheStats = () => {
  return {
    initialized: cacheInitialized,
    totalCharacters: charactersCache.size,
    lastUpdated: cacheLastUpdated ? cacheLastUpdated.toISOString() : null,
    realtimeSyncActive: firestoreUnsubscribe !== null,
  };
};

/**
 * 手動刷新緩存
 * 通常不需要調用，因為有實時同步
 *
 * @returns {Promise<void>}
 */
export const refreshCache = async () => {
  logger.info("[CharacterCache] 🔄 手動刷新緩存...");
  await initializeCharactersCache();
};

/**
 * 清空緩存並停止監聽
 * 用於服務關閉時清理資源
 */
export const destroyCache = () => {
  if (firestoreUnsubscribe) {
    firestoreUnsubscribe();
    firestoreUnsubscribe = null;
  }

  charactersCache.clear();
  cacheInitialized = false;
  cacheLastUpdated = null;

  logger.info("[CharacterCache] 🛑 緩存已清空，監聽已停止");
};

/**
 * 優雅關閉
 * 在進程退出時調用
 */
process.on("SIGINT", () => {
  logger.info("[CharacterCache] 收到 SIGINT 信號，正在清理...");
  destroyCache();
});

process.on("SIGTERM", () => {
  logger.info("[CharacterCache] 收到 SIGTERM 信號，正在清理...");
  destroyCache();
});
