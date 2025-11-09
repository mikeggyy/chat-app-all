/**
 * 角色服務模塊
 * 處理角色的刪除等操作
 */

import { db, FieldValue } from "../../firebase/index.js";
import { deleteImages } from "../../storage/r2Storage.service.js";

/**
 * 刪除角色及其相關數據
 * 包括：
 * 1. 角色的肖像圖片 (portraitUrl)
 * 2. 所有用戶與該角色的對話照片
 * 3. 所有用戶與該角色的對話記錄
 * 4. 角色在 usage_limits 中的數據
 * 5. 角色文檔本身
 *
 * @param {string} characterId - 角色 ID
 * @returns {Promise<Object>} 刪除結果統計
 */
export const deleteCharacter = async (characterId) => {
  if (!characterId) {
    throw new Error("缺少必要參數：characterId");
  }

  const deletionStats = {
    characterDeleted: false,
    portraitImageDeleted: false,
    photosDeleted: 0,
    photoImagesDeleted: 0,
    conversationsDeleted: 0,
    usageLimitsUpdated: 0,
  };

  try {
    // 1. 獲取角色資料
    const characterDoc = await db.collection("characters").doc(characterId).get();

    if (!characterDoc.exists) {
      throw new Error("角色不存在");
    }

    const characterData = characterDoc.data();
    const portraitUrl = characterData.portraitUrl;

    console.log(`[管理後台] 開始刪除角色: ${characterId} (${characterData.display_name || characterData.name})`);

    // 2. 刪除角色的肖像圖片（如果存在且是 R2 URL）
    if (portraitUrl && portraitUrl.includes("r2.dev")) {
      try {
        await deleteImages([portraitUrl]);
        deletionStats.portraitImageDeleted = true;
        console.log(`[管理後台] 已刪除角色肖像圖片: ${portraitUrl}`);
      } catch (error) {
        console.error(`[管理後台] 刪除角色肖像圖片失敗:`, error);
        // 繼續執行
      }
    }

    // 3. 使用 collectionGroup 查詢所有用戶的照片，找到與該角色相關的照片
    // user_photos/{userId}/photos 子集合中 characterId == characterId
    try {
      const photosSnapshot = await db
        .collectionGroup("photos")
        .where("characterId", "==", characterId)
        .get();

      if (!photosSnapshot.empty) {
        console.log(`[管理後台] 找到 ${photosSnapshot.size} 張與角色 ${characterId} 相關的照片`);

        // 收集所有照片的 imageUrl
        const photoUrls = [];
        photosSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data?.imageUrl) {
            photoUrls.push(data.imageUrl);
          }
        });

        // 先刪除 R2 上的圖片文件
        if (photoUrls.length > 0) {
          try {
            const r2DeleteResult = await deleteImages(photoUrls);
            deletionStats.photoImagesDeleted = r2DeleteResult.success;
            console.log(`[管理後台] R2 圖片刪除: 成功 ${r2DeleteResult.success}，失敗 ${r2DeleteResult.failed}`);
          } catch (error) {
            console.error(`[管理後台] 刪除角色相關 R2 圖片失敗:`, error);
            // 繼續執行
          }
        }

        // 再刪除 Firestore 記錄（批量刪除）
        let batch = db.batch();
        let batchCount = 0;

        for (const doc of photosSnapshot.docs) {
          batch.delete(doc.ref);
          batchCount++;
          deletionStats.photosDeleted++;

          // Firestore batch 限制為 500 個操作
          if (batchCount === 500) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }

        // 提交剩餘的批次
        if (batchCount > 0) {
          await batch.commit();
        }

        console.log(`[管理後台] 已刪除 ${deletionStats.photosDeleted} 張照片記錄`);
      }
    } catch (error) {
      console.error(`[管理後台] 刪除角色相關照片失敗:`, error);
      // 繼續執行
    }

    // 4. 刪除與該角色相關的對話記錄
    // conversations 文檔 ID 格式：userId::characterId
    // 需要掃描所有對話，找出文檔 ID 以 ::characterId 結尾的
    try {
      const conversationsSnapshot = await db.collection("conversations").get();

      if (!conversationsSnapshot.empty) {
        let batch = db.batch();
        let batchCount = 0;
        const suffix = `::${characterId}`;

        for (const doc of conversationsSnapshot.docs) {
          // 檢查文檔 ID 是否以 ::characterId 結尾
          if (doc.id.endsWith(suffix)) {
            batch.delete(doc.ref);
            batchCount++;
            deletionStats.conversationsDeleted++;

            if (batchCount === 500) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        console.log(`[管理後台] 已刪除 ${deletionStats.conversationsDeleted} 條對話記錄`);
      }
    } catch (error) {
      console.error(`[管理後台] 刪除對話記錄失敗:`, error);
      // 繼續執行
    }

    // 5. 刪除用戶子集合中的對話元數據（users/{userId}/conversations）
    // 使用 collectionGroup 查詢所有用戶的 conversations 子集合
    try {
      const userConversationsSnapshot = await db
        .collectionGroup("conversations")
        .where("characterId", "==", characterId)
        .get();

      if (!userConversationsSnapshot.empty) {
        let batch = db.batch();
        let batchCount = 0;
        let userConversationsDeleted = 0;

        for (const doc of userConversationsSnapshot.docs) {
          batch.delete(doc.ref);
          batchCount++;
          userConversationsDeleted++;

          if (batchCount === 500) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        console.log(`[管理後台] 已刪除 ${userConversationsDeleted} 條用戶對話元數據`);
      }
    } catch (error) {
      console.error(`[管理後台] 刪除用戶對話元數據失敗:`, error);
      // 繼續執行（可能這個集合不存在或沒有 characterId 字段）
    }

    // 6. 從所有用戶的 usage_limits 中刪除與該角色相關的數據
    // 需要掃描所有 usage_limits 文檔，移除 conversation[characterId] 和 voice[characterId]
    try {
      const usageLimitsSnapshot = await db.collection("usage_limits").get();

      if (!usageLimitsSnapshot.empty) {
        let batch = db.batch();
        let batchCount = 0;

        for (const doc of usageLimitsSnapshot.docs) {
          const data = doc.data();
          let needsUpdate = false;
          const updates = {};

          // 檢查 conversation 字段
          if (data.conversation && data.conversation[characterId]) {
            updates[`conversation.${characterId}`] = FieldValue.delete();
            needsUpdate = true;
          }

          // 檢查 voice 字段
          if (data.voice && data.voice[characterId]) {
            updates[`voice.${characterId}`] = FieldValue.delete();
            needsUpdate = true;
          }

          // 檢查 activePotionEffects 字段
          if (data.activePotionEffects) {
            for (const [effectId, effect] of Object.entries(data.activePotionEffects)) {
              if (effect.characterId === characterId) {
                updates[`activePotionEffects.${effectId}`] = FieldValue.delete();
                needsUpdate = true;
              }
            }
          }

          if (needsUpdate) {
            batch.update(doc.ref, updates);
            batchCount++;
            deletionStats.usageLimitsUpdated++;

            if (batchCount === 500) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        console.log(`[管理後台] 已更新 ${deletionStats.usageLimitsUpdated} 個用戶的 usage_limits`);
      }
    } catch (error) {
      console.error(`[管理後台] 更新 usage_limits 失敗:`, error);
      // 繼續執行
    }

    // 7. 最後刪除角色文檔本身
    await db.collection("characters").doc(characterId).delete();
    deletionStats.characterDeleted = true;
    console.log(`[管理後台] 已刪除角色文檔: ${characterId}`);

    return deletionStats;
  } catch (error) {
    console.error(`[管理後台] 刪除角色失敗:`, error);
    throw error;
  }
};

export default {
  deleteCharacter,
};
