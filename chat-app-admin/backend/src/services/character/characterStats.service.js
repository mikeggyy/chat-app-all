import { db } from "../../firebase/index.js";
import logger from "../../utils/logger.js";

/**
 * 角色統計服務
 *
 * ⚠️ 警告：此服務包含高成本操作，應謹慎使用
 */

/**
 * 同步單個角色的聊天用戶數量
 * 使用增量查詢減少 Firestore 成本
 *
 * @param {string} characterId - 角色 ID
 * @returns {Promise<{userCount: number, conversationCount: number}>}
 */
export async function syncSingleCharacterUserCount(characterId) {
  try {
    // 查詢包含此角色的所有對話（使用複合索引）
    const conversationsQuery = db.collectionGroup("conversations")
      .where("characterId", "==", characterId)
      .select(); // 只選擇文檔 ID，不讀取內容

    const conversationsSnapshot = await conversationsQuery.get();

    // 使用 Set 去重用戶 ID
    const uniqueUserIds = new Set();

    conversationsSnapshot.forEach((doc) => {
      // 從路徑提取 userId: users/{userId}/conversations/{conversationId}
      const userId = doc.ref.parent.parent?.id;
      if (userId) {
        uniqueUserIds.add(userId);
      }
    });

    const userCount = uniqueUserIds.size;
    const conversationCount = conversationsSnapshot.size;

    // 更新角色文檔
    await db.collection("characters").doc(characterId).update({
      totalChatUsers: userCount,
      totalConversations: conversationCount,
      statsLastSyncedAt: new Date().toISOString(),
    });

    logger.info(`[角色統計] 已同步角色 ${characterId}: ${userCount} 個用戶, ${conversationCount} 個對話`);

    return { userCount, conversationCount };
  } catch (error) {
    logger.error(`[角色統計] 同步角色 ${characterId} 失敗:`, error);
    throw error;
  }
}

/**
 * 批量同步所有角色的聊天用戶數量
 *
 * ⚠️ 高成本操作警告：
 * - 此操作會掃描所有對話文檔
 * - 建議只在低流量時段執行
 * - 對於大型數據庫（>10萬對話），建議使用 Cloud Functions 定時任務
 *
 * @param {Object} options - 配置選項
 * @param {number} options.maxCharacters - 最多處理的角色數量（默認：無限制）
 * @param {boolean} options.forceFullScan - 是否強制全表掃描（默認：false）
 * @returns {Promise<{totalCharacters: number, totalUpdated: number, warnings: string[]}>}
 */
export async function syncAllCharactersUserCount(options = {}) {
  const {
    maxCharacters = Infinity,
    forceFullScan = false
  } = options;

  const warnings = [];
  let totalUpdated = 0;

  try {
    // 獲取所有角色
    const charactersSnapshot = await db.collection("characters").get();

    if (charactersSnapshot.size > maxCharacters) {
      warnings.push(`角色數量 (${charactersSnapshot.size}) 超過限制 (${maxCharacters})，將只處理前 ${maxCharacters} 個`);
    }

    logger.info(`[角色統計] 開始批量同步，共 ${Math.min(charactersSnapshot.size, maxCharacters)} 個角色`);

    // 逐個角色同步（避免一次性掃描所有對話）
    let processed = 0;
    for (const characterDoc of charactersSnapshot.docs) {
      if (processed >= maxCharacters) break;

      try {
        await syncSingleCharacterUserCount(characterDoc.id);
        totalUpdated++;
        processed++;

        // 每 10 個角色休息 100ms，避免過載
        if (processed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        logger.error(`[角色統計] 同步角色 ${characterDoc.id} 時出錯:`, error);
        warnings.push(`角色 ${characterDoc.id} 同步失敗: ${error.message}`);
      }
    }

    logger.info(`[角色統計] 批量同步完成，已更新 ${totalUpdated}/${charactersSnapshot.size} 個角色`);

    return {
      totalCharacters: charactersSnapshot.size,
      totalUpdated,
      warnings
    };
  } catch (error) {
    logger.error("[角色統計] 批量同步失敗:", error);
    throw error;
  }
}

/**
 * 獲取系統統計概覽
 * 提供低成本的統計數據查詢
 *
 * @returns {Promise<Object>}
 */
export async function getSystemStatsOverview() {
  try {
    // 從 characters 集合獲取統計（已緩存的數據）
    const charactersSnapshot = await db.collection("characters").get();

    let totalChatUsers = 0;
    let totalConversations = 0;
    let charactersWithStats = 0;

    charactersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.totalChatUsers !== undefined) {
        totalChatUsers += data.totalChatUsers || 0;
        totalConversations += data.totalConversations || 0;
        charactersWithStats++;
      }
    });

    return {
      totalCharacters: charactersSnapshot.size,
      charactersWithStats,
      estimatedTotalChatUsers: totalChatUsers,
      estimatedTotalConversations: totalConversations,
      lastCalculated: new Date().toISOString(),
      note: "數據基於角色文檔中緩存的統計信息，非實時數據"
    };
  } catch (error) {
    logger.error("[角色統計] 獲取系統概覽失敗:", error);
    throw error;
  }
}
