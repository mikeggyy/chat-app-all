import { db, auth, FieldValue } from "../../firebase/index.js";
import { clearCache } from "../../utils/firestoreCache.js";

/**
 * 用戶服務模塊
 * 處理用戶的查詢、更新、刪除等操作
 */

/**
 * 更新用戶資料
 * 同時更新 Firebase Auth 和 Firestore
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} updateData - 更新數據
 * @param {string} [updateData.displayName] - 顯示名稱
 * @param {string} [updateData.email] - 電子郵件
 * @param {boolean} [updateData.disabled] - 是否禁用
 * @param {string} [updateData.photoURL] - 頭像 URL
 * @param {string} [updateData.gender] - 性別
 * @param {string} [updateData.locale] - 語言設置
 * @param {string} [updateData.membershipTier] - 會員等級
 * @param {string} [updateData.membershipStatus] - 會員狀態
 * @param {boolean} [updateData.membershipAutoRenew] - 自動續費
 * @param {number} [updateData.coins] - 金幣餘額
 * @param {number} [updateData.walletBalance] - 錢包餘額
 * @param {Object} [updateData.assets] - 資產卡片
 * @returns {Promise<Object>} 更新後的用戶數據
 * @throws {Error} 更新失敗時拋出錯誤
 */
export const updateUser = async (userId, updateData) => {
  const {
    displayName,
    email,
    disabled,
    photoURL,
    gender,
    locale,
    membershipTier,
    membershipStatus,
    membershipAutoRenew,
    coins,
    walletBalance,
    assets,
  } = updateData;

  // 更新 Firebase Auth 數據
  const authUpdates = {};
  if (displayName !== undefined) authUpdates.displayName = displayName;
  if (email !== undefined) authUpdates.email = email;
  if (disabled !== undefined) authUpdates.disabled = disabled;
  if (photoURL !== undefined) authUpdates.photoURL = photoURL;

  if (Object.keys(authUpdates).length > 0) {
    await auth.updateUser(userId, authUpdates);
  }

  // 更新 Firestore 數據
  const firestoreUpdates = {};
  if (displayName !== undefined) firestoreUpdates.displayName = displayName;
  if (photoURL !== undefined) firestoreUpdates.photoURL = photoURL;
  if (gender !== undefined) firestoreUpdates.gender = gender;
  if (locale !== undefined) firestoreUpdates.locale = locale;

  // 會員資訊
  if (membershipTier !== undefined) firestoreUpdates.membershipTier = membershipTier;
  if (membershipStatus !== undefined) firestoreUpdates.membershipStatus = membershipStatus;
  if (membershipAutoRenew !== undefined) firestoreUpdates.membershipAutoRenew = membershipAutoRenew;

  // 錢包餘額（支援三種格式，確保前後台同步）
  if (coins !== undefined || walletBalance !== undefined) {
    const newBalance = coins !== undefined ? coins : walletBalance;

    // ✅ 修復：正確更新 wallet 物件（使用巢狀結構）
    firestoreUpdates.wallet = {
      balance: newBalance,
      currency: "TWD",
      updatedAt: new Date().toISOString(),
    };

    // ✅ 同時更新舊格式欄位（向後兼容）
    firestoreUpdates.walletBalance = newBalance;
    firestoreUpdates.coins = newBalance;
  }

  // 資產卡片
  if (assets !== undefined) {
    if (assets.characterUnlockCards !== undefined) {
      firestoreUpdates["assets.characterUnlockCards"] = assets.characterUnlockCards;
    }
    if (assets.photoUnlockCards !== undefined) {
      firestoreUpdates["assets.photoUnlockCards"] = assets.photoUnlockCards;
    }
    if (assets.videoUnlockCards !== undefined) {
      firestoreUpdates["assets.videoUnlockCards"] = assets.videoUnlockCards;
    }
    if (assets.voiceUnlockCards !== undefined) {
      firestoreUpdates["assets.voiceUnlockCards"] = assets.voiceUnlockCards;
    }
    if (assets.createCards !== undefined) {
      firestoreUpdates["assets.createCards"] = assets.createCards;
    }
  }

  firestoreUpdates.updatedAt = new Date().toISOString();

  if (Object.keys(firestoreUpdates).length > 1) { // > 1 因為至少有 updatedAt
    // ✅ 修復：使用 set() with merge 而非 update()，避免文檔不存在時報錯
    await db.collection("users").doc(userId).set(firestoreUpdates, { merge: true });
  }

  // 同步更新子集合（主應用優先從子集合讀取資產）
  if (assets !== undefined) {
    const assetTypeMapping = {
      characterUnlockCards: "characterUnlockCard",
      photoUnlockCards: "photoUnlockCard",
      videoUnlockCards: "videoUnlockCard",
      voiceUnlockCards: "voiceUnlockCard",
      createCards: "createCards",
    };

    // 更新解鎖卡子集合
    for (const [assetKey, quantity] of Object.entries(assets)) {
      if (assetTypeMapping[assetKey] !== undefined && quantity !== undefined) {
        const assetType = assetTypeMapping[assetKey];
        const assetRef = db
          .collection("users")
          .doc(userId)
          .collection("assets")
          .doc(assetType);

        await assetRef.set({
          type: assetType,
          quantity: quantity,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  }

  // 如果修改了會員相關資料，清除快取
  if (membershipTier !== undefined || membershipStatus !== undefined || membershipAutoRenew !== undefined) {
    clearCache(`user:${userId}:membership`);
    console.log(`[管理後台] 用戶 ${userId} 的會員資料已更新，已清除會員快取`);
  }

  // ✅ 修復：如果修改了金幣或資產，記錄日誌提醒
  // 注意：主應用有獨立的 userProfileCache（5分鐘 TTL），需要等待緩存過期
  if (coins !== undefined || walletBalance !== undefined || assets !== undefined) {
    console.warn(`[管理後台] ⚠️ 用戶 ${userId} 的金幣/資產已更新`);
    console.warn(`[管理後台] ⚠️ 主應用的緩存將在 1-5 分鐘內過期並顯示新數據`);
    console.warn(`[管理後台] ⚠️ 如需立即生效，請用戶重新登入或等待緩存過期`);
  }

  // 返回更新後的用戶數據
  const updatedUser = await auth.getUser(userId);
  const userDoc = await db.collection("users").doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : {};

  return {
    uid: updatedUser.uid,
    email: updatedUser.email,
    displayName: updatedUser.displayName,
    disabled: updatedUser.disabled,
    photoURL: userData.photoURL || updatedUser.photoURL,
    membershipTier: userData.membershipTier,
    coins: userData.coins,
  };
};

/**
 * 刪除用戶
 * 刪除 Firebase Auth、Firestore 用戶數據和所有相關集合
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 刪除結果
 */
export const deleteUser = async (userId) => {
  const deletionResults = {
    auth: false,
    firestore: false,
    usageLimits: false,
    conversations: false,
    photos: false,
  };

  try {
    // 1. 刪除 Firebase Auth 用戶
    try {
      await auth.deleteUser(userId);
      deletionResults.auth = true;
    } catch (error) {
      console.error("Failed to delete from Auth:", error);
    }

    // 2. 刪除 Firestore users 集合
    try {
      await db.collection("users").doc(userId).delete();
      deletionResults.firestore = true;
    } catch (error) {
      console.error("Failed to delete from users collection:", error);
    }

    // 3. 刪除 usage_limits 集合
    try {
      await db.collection("usage_limits").doc(userId).delete();
      deletionResults.usageLimits = true;
    } catch (error) {
      console.error("Failed to delete from usage_limits:", error);
    }

    // 4. 刪除所有對話記錄
    try {
      const conversationsSnapshot = await db.collection("conversations")
        .where("userId", "==", userId)
        .get();

      const batch = db.batch();
      conversationsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      deletionResults.conversations = true;
    } catch (error) {
      console.error("Failed to delete conversations:", error);
    }

    // 5. 刪除用戶照片記錄
    try {
      const photosDoc = db.collection("user_photos").doc(userId);
      const photosSnapshot = await photosDoc.collection("photos").get();

      const batch = db.batch();
      photosSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      batch.delete(photosDoc);
      await batch.commit();
      deletionResults.photos = true;
    } catch (error) {
      console.error("Failed to delete photos:", error);
    }

    return deletionResults;
  } catch (error) {
    throw new Error(`Delete user failed: ${error.message}`);
  }
};

/**
 * 獲取用戶詳情
 * 合併 Firebase Auth 和 Firestore 的數據
 *
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 用戶詳情
 */
export const getUserById = async (userId) => {
  const authUser = await auth.getUser(userId);
  const userDoc = await db.collection("users").doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : {};

  return {
    uid: authUser.uid,
    email: authUser.email,
    displayName: authUser.displayName,
    disabled: authUser.disabled,
    photoURL: userData.photoURL || authUser.photoURL,
    ...userData,
    creationTime: authUser.metadata.creationTime,
    lastSignInTime: authUser.metadata.lastSignInTime,
  };
};
