import { db } from "../../firebase/index.js";

/**
 * 使用限制服務模塊
 * 處理用戶使用限制的更新和清理
 */

/**
 * 更新用戶使用限制（重置或直接設置）
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 更新選項
 * @param {boolean} [options.resetPhotos] - 是否重置拍照次數
 * @param {boolean} [options.resetConversations] - 是否重置所有角色的對話次數
 * @param {boolean} [options.resetVoice] - 是否重置所有角色的語音次數
 * @param {boolean} [options.resetCharacterCreation] - 是否重置角色創建次數
 * @param {number} [options.photosCount] - 直接設置拍照使用次數
 * @param {number} [options.characterCreationCount] - 直接設置角色創建使用次數
 * @param {Object} [options.conversationCounts] - 直接設置對話使用次數（按角色）{ characterId: count }
 * @param {Object} [options.voiceCounts] - 直接設置語音使用次數（按角色）{ characterId: count }
 * @returns {Promise<Object>} 更新結果
 */
export const updateUsageLimits = async (userId, options) => {
  const {
    resetPhotos,
    resetConversations,
    resetVoice,
    resetCharacterCreation,
    photosCount,
    characterCreationCount,
    conversationCounts,
    voiceCounts,
  } = options;

  const limitsRef = db.collection("usage_limits").doc(userId);
  const limitsDoc = await limitsRef.get();

  if (!limitsDoc.exists) {
    // 如果不存在，創建新的限制文檔
    await limitsRef.set({
      userId,
      photos: {
        count: 0,
        lifetimeCount: 0,
        unlocked: 0,
        cards: 0,
        permanentUnlock: false,
        lastResetDate: new Date().toISOString().slice(0, 7),
        lastAdTime: null,
        adsWatchedToday: 0,
        history: [],
      },
      voice: {},
      conversation: {},
      character_creation: {
        count: 0,
        lifetimeCount: 0,
        unlocked: 0,
        cards: 0,
        permanentUnlock: false,
        lastResetDate: new Date().toISOString().slice(0, 7),
        lastAdTime: null,
        adsWatchedToday: 0,
        history: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const limitsData = limitsDoc.exists ? limitsDoc.data() : {};
  const updates = {};

  // === 重置功能 ===

  // 重置拍照次數
  if (resetPhotos) {
    updates["photos.count"] = 0;
    updates["photos.adsWatchedToday"] = 0;
    updates["photos.lastResetDate"] = new Date().toISOString().slice(0, 7);
  }

  // 重置角色創建次數
  if (resetCharacterCreation) {
    updates["character_creation.count"] = 0;
    updates["character_creation.adsWatchedToday"] = 0;
    updates["character_creation.lastResetDate"] = new Date().toISOString().slice(0, 7);
  }

  // 重置所有角色的對話次數
  if (resetConversations) {
    if (limitsData?.conversation) {
      Object.keys(limitsData.conversation).forEach(charId => {
        updates[`conversation.${charId}.count`] = 0;
        updates[`conversation.${charId}.adsWatchedToday`] = 0;
        updates[`conversation.${charId}.lastResetDate`] = new Date().toISOString().slice(0, 10);
      });
    }
  }

  // 重置所有角色的語音次數
  if (resetVoice) {
    if (limitsData?.voice) {
      Object.keys(limitsData.voice).forEach(charId => {
        updates[`voice.${charId}.count`] = 0;
        updates[`voice.${charId}.adsWatchedToday`] = 0;
        updates[`voice.${charId}.lastResetDate`] = new Date().toISOString().slice(0, 10);
      });
    }
  }

  // === 直接設置功能 ===

  // 設置拍照使用次數
  if (photosCount !== undefined) {
    const count = Math.max(0, parseInt(photosCount) || 0);
    updates["photos.count"] = count;
  }

  // 設置角色創建使用次數
  if (characterCreationCount !== undefined) {
    const count = Math.max(0, parseInt(characterCreationCount) || 0);
    updates["character_creation.count"] = count;
  }

  // 設置對話使用次數（按角色）
  if (conversationCounts && typeof conversationCounts === 'object') {
    Object.entries(conversationCounts).forEach(([charId, count]) => {
      const validCount = Math.max(0, parseInt(count) || 0);
      updates[`conversation.${charId}.count`] = validCount;
    });
  }

  // 設置語音使用次數（按角色）
  if (voiceCounts && typeof voiceCounts === 'object') {
    Object.entries(voiceCounts).forEach(([charId, count]) => {
      const validCount = Math.max(0, parseInt(count) || 0);
      updates[`voice.${charId}.count`] = validCount;
    });
  }

  updates.updatedAt = new Date().toISOString();

  if (Object.keys(updates).length > 1) {
    await limitsRef.update(updates);
  }

  return {
    userId,
    updates: Object.keys(updates).filter(k => k !== 'updatedAt'),
  };
};

/**
 * 清理用戶使用限制中的 null 鍵
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 清理結果
 * @throws {Error} 當用戶使用限制數據不存在時拋出錯誤
 */
export const cleanNullKeys = async (userId) => {
  const limitsRef = db.collection("usage_limits").doc(userId);
  const limitsDoc = await limitsRef.get();

  if (!limitsDoc.exists) {
    throw new Error("用戶使用限制數據不存在");
  }

  const limitsData = limitsDoc.data();
  const cleaned = {
    conversation: 0,
    voice: 0,
  };

  // 清理 conversation 中的 null 鍵
  if (limitsData.conversation && typeof limitsData.conversation === 'object') {
    Object.keys(limitsData.conversation).forEach(charId => {
      if (!charId || charId === 'null' || charId === 'undefined') {
        delete limitsData.conversation[charId];
        cleaned.conversation++;
      }
    });
  }

  // 清理 voice 中的 null 鍵
  if (limitsData.voice && typeof limitsData.voice === 'object') {
    Object.keys(limitsData.voice).forEach(charId => {
      if (!charId || charId === 'null' || charId === 'undefined') {
        delete limitsData.voice[charId];
        cleaned.voice++;
      }
    });
  }

  // 更新 Firestore
  if (cleaned.conversation > 0 || cleaned.voice > 0) {
    limitsData.updatedAt = new Date().toISOString();
    await limitsRef.set(limitsData);

    return {
      userId,
      cleaned: {
        conversationKeys: cleaned.conversation,
        voiceKeys: cleaned.voice,
      },
      hasChanges: true,
    };
  }

  return {
    userId,
    cleaned: {
      conversationKeys: 0,
      voiceKeys: 0,
    },
    hasChanges: false,
  };
};
