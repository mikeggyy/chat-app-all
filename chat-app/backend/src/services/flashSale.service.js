/**
 * 限時閃購服務
 * 處理限時特價活動的創建、查詢和購買
 */

import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import { getWalletBalance, createWalletUpdate } from "../user/walletHelpers.js";
import logger from "../utils/logger.js";

/**
 * 獲取台灣時區當前時間
 * @returns {Date}
 */
const getTaiwanTime = () => {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
};

/**
 * 閃購類型
 */
export const FLASH_SALE_TYPES = {
  COINS: "coins",           // 金幣包
  BUNDLE: "bundle",         // 組合包（金幣+卡片）
  UNLOCK_CARD: "unlock_card", // 解鎖卡
};

/**
 * 閃購狀態
 */
export const FLASH_SALE_STATUS = {
  SCHEDULED: "scheduled",   // 預定中
  ACTIVE: "active",         // 進行中
  ENDED: "ended",           // 已結束
  SOLD_OUT: "sold_out",     // 已售罄
};

/**
 * 獲取所有進行中的閃購活動
 * @returns {Promise<Array>}
 */
export const getActiveFlashSales = async () => {
  const db = getFirestoreDb();
  const now = getTaiwanTime();

  const salesSnapshot = await db.collection("flash_sales")
    .where("enabled", "==", true)
    .where("startTime", "<=", now)
    .where("endTime", ">", now)
    .orderBy("endTime", "asc")
    .get();

  const sales = [];
  for (const doc of salesSnapshot.docs) {
    const data = doc.data();

    // 檢查是否售罄
    if (data.stockLimit && data.soldCount >= data.stockLimit) {
      continue; // 跳過已售罄的
    }

    const endTime = data.endTime.toDate ? data.endTime.toDate() : new Date(data.endTime);
    const remainingMs = endTime.getTime() - now.getTime();
    const remainingMinutes = Math.max(0, Math.floor(remainingMs / (60 * 1000)));

    sales.push({
      id: doc.id,
      name: data.name,
      description: data.description,
      type: data.type,
      price: data.price,
      originalPrice: data.originalPrice,
      currency: data.currency || "TWD",
      discount: data.discount,
      contents: data.contents,
      badge: data.badge,
      endTime: endTime.toISOString(),
      remainingMinutes,
      stockLimit: data.stockLimit || null,
      soldCount: data.soldCount || 0,
      remainingStock: data.stockLimit ? data.stockLimit - (data.soldCount || 0) : null,
      perUserLimit: data.perUserLimit || 1,
    });
  }

  return sales;
};

/**
 * 獲取特定閃購活動
 * @param {string} saleId - 閃購 ID
 * @returns {Promise<Object|null>}
 */
export const getFlashSaleById = async (saleId) => {
  const db = getFirestoreDb();
  const saleDoc = await db.collection("flash_sales").doc(saleId).get();

  if (!saleDoc.exists) {
    return null;
  }

  const data = saleDoc.data();
  const now = getTaiwanTime();
  const startTime = data.startTime.toDate ? data.startTime.toDate() : new Date(data.startTime);
  const endTime = data.endTime.toDate ? data.endTime.toDate() : new Date(data.endTime);

  let status = FLASH_SALE_STATUS.SCHEDULED;
  if (now >= startTime && now < endTime) {
    status = FLASH_SALE_STATUS.ACTIVE;
    if (data.stockLimit && data.soldCount >= data.stockLimit) {
      status = FLASH_SALE_STATUS.SOLD_OUT;
    }
  } else if (now >= endTime) {
    status = FLASH_SALE_STATUS.ENDED;
  }

  const remainingMs = endTime.getTime() - now.getTime();
  const remainingMinutes = Math.max(0, Math.floor(remainingMs / (60 * 1000)));

  return {
    id: saleDoc.id,
    name: data.name,
    description: data.description,
    type: data.type,
    price: data.price,
    originalPrice: data.originalPrice,
    currency: data.currency || "TWD",
    discount: data.discount,
    contents: data.contents,
    badge: data.badge,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    remainingMinutes,
    status,
    stockLimit: data.stockLimit || null,
    soldCount: data.soldCount || 0,
    remainingStock: data.stockLimit ? data.stockLimit - (data.soldCount || 0) : null,
    perUserLimit: data.perUserLimit || 1,
    enabled: data.enabled,
  };
};

/**
 * 檢查用戶是否可以購買閃購
 * @param {string} userId - 用戶 ID
 * @param {string} saleId - 閃購 ID
 * @returns {Promise<Object>}
 */
export const checkFlashSalePurchaseEligibility = async (userId, saleId) => {
  const db = getFirestoreDb();
  const now = getTaiwanTime();

  // 獲取閃購資訊
  const sale = await getFlashSaleById(saleId);
  if (!sale) {
    return { eligible: false, reason: "flash_sale_not_found" };
  }

  // 檢查是否啟用
  if (!sale.enabled) {
    return { eligible: false, reason: "flash_sale_disabled" };
  }

  // 檢查時間
  if (sale.status === FLASH_SALE_STATUS.SCHEDULED) {
    return { eligible: false, reason: "flash_sale_not_started" };
  }
  if (sale.status === FLASH_SALE_STATUS.ENDED) {
    return { eligible: false, reason: "flash_sale_ended" };
  }
  if (sale.status === FLASH_SALE_STATUS.SOLD_OUT) {
    return { eligible: false, reason: "flash_sale_sold_out" };
  }

  // 檢查用戶購買次數
  const purchaseRef = db.collection("users").doc(userId)
    .collection("flash_sale_purchases").doc(saleId);
  const purchaseDoc = await purchaseRef.get();

  if (purchaseDoc.exists) {
    const purchaseData = purchaseDoc.data();
    if (purchaseData.count >= sale.perUserLimit) {
      return {
        eligible: false,
        reason: "purchase_limit_reached",
        currentCount: purchaseData.count,
        limit: sale.perUserLimit,
      };
    }
  }

  return {
    eligible: true,
    sale,
    currentPurchaseCount: purchaseDoc.exists ? purchaseDoc.data().count : 0,
  };
};

/**
 * 購買閃購商品
 * @param {string} userId - 用戶 ID
 * @param {string} saleId - 閃購 ID
 * @returns {Promise<Object>}
 */
export const purchaseFlashSale = async (userId, saleId) => {
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);
  const saleRef = db.collection("flash_sales").doc(saleId);

  // 先檢查資格
  const eligibility = await checkFlashSalePurchaseEligibility(userId, saleId);
  if (!eligibility.eligible) {
    throw new Error(`無法購買此閃購：${eligibility.reason}`);
  }

  const sale = eligibility.sale;
  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取最新的閃購和用戶資料
    const [saleDoc, userDoc] = await Promise.all([
      transaction.get(saleRef),
      transaction.get(userRef),
    ]);

    if (!saleDoc.exists) {
      throw new Error("閃購不存在");
    }
    if (!userDoc.exists) {
      throw new Error("用戶不存在");
    }

    const saleData = saleDoc.data();
    const userData = userDoc.data();
    const now = getTaiwanTime();

    // 2. 再次檢查時間和庫存（在事務內）
    const startTime = saleData.startTime.toDate ? saleData.startTime.toDate() : new Date(saleData.startTime);
    const endTime = saleData.endTime.toDate ? saleData.endTime.toDate() : new Date(saleData.endTime);

    if (now < startTime || now >= endTime) {
      throw new Error("閃購不在有效時間內");
    }

    if (saleData.stockLimit && saleData.soldCount >= saleData.stockLimit) {
      throw new Error("閃購已售罄");
    }

    // 3. 檢查用戶購買記錄
    const purchaseRef = db.collection("users").doc(userId)
      .collection("flash_sale_purchases").doc(saleId);
    const purchaseDoc = await transaction.get(purchaseRef);

    const currentPurchaseCount = purchaseDoc.exists ? purchaseDoc.data().count : 0;
    if (currentPurchaseCount >= saleData.perUserLimit) {
      throw new Error("已達到購買上限");
    }

    // 4. 發放獎勵內容
    const contents = saleData.contents || {};
    const currentAssets = userData.assets || {};
    const newAssets = { ...currentAssets };

    // 金幣處理（使用錢包系統）
    let newBalance = userData.wallet?.balance || 0;
    if (contents.coins && contents.coins > 0) {
      const currentBalance = await getWalletBalance(userId);
      newBalance = currentBalance + contents.coins;
    }

    // 卡片處理
    if (contents.photoUnlockCards) {
      newAssets.photoUnlockCards = (newAssets.photoUnlockCards || 0) + contents.photoUnlockCards;
    }
    if (contents.characterUnlockCards) {
      newAssets.characterUnlockCards = (newAssets.characterUnlockCards || 0) + contents.characterUnlockCards;
    }
    if (contents.videoUnlockCards) {
      newAssets.videoUnlockCards = (newAssets.videoUnlockCards || 0) + contents.videoUnlockCards;
    }

    // 5. 更新用戶資料
    const userUpdate = {
      assets: newAssets,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // 金幣更新
    if (contents.coins && contents.coins > 0) {
      userUpdate.wallet = createWalletUpdate(newBalance);
    }

    transaction.update(userRef, userUpdate);

    // 6. 更新閃購售出數量
    transaction.update(saleRef, {
      soldCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 7. 記錄用戶購買
    if (purchaseDoc.exists) {
      transaction.update(purchaseRef, {
        count: FieldValue.increment(1),
        lastPurchasedAt: FieldValue.serverTimestamp(),
      });
    } else {
      transaction.set(purchaseRef, {
        count: 1,
        firstPurchasedAt: FieldValue.serverTimestamp(),
        lastPurchasedAt: FieldValue.serverTimestamp(),
        saleId: saleId,
        saleName: saleData.name,
      });
    }

    // 8. 創建交易記錄
    const transactionRef = db.collection("users").doc(userId)
      .collection("transactions").doc();
    transaction.set(transactionRef, {
      type: "flash_sale_purchase",
      saleId: saleId,
      saleName: saleData.name,
      price: saleData.price,
      currency: saleData.currency || "TWD",
      contents: contents,
      createdAt: FieldValue.serverTimestamp(),
    });

    result = {
      success: true,
      saleId: saleId,
      saleName: saleData.name,
      contents: contents,
      newBalance: contents.coins ? newBalance : undefined,
      newAssets: newAssets,
    };
  });

  logger.info(`[閃購] 用戶 ${userId} 購買閃購 ${saleId} 成功`);
  return result;
};

/**
 * 獲取用戶的閃購購買記錄
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Array>}
 */
export const getUserFlashSalePurchases = async (userId) => {
  const db = getFirestoreDb();
  const purchasesSnapshot = await db.collection("users").doc(userId)
    .collection("flash_sale_purchases")
    .orderBy("lastPurchasedAt", "desc")
    .limit(50)
    .get();

  return purchasesSnapshot.docs.map(doc => ({
    saleId: doc.id,
    ...doc.data(),
    firstPurchasedAt: doc.data().firstPurchasedAt?.toDate?.().toISOString(),
    lastPurchasedAt: doc.data().lastPurchasedAt?.toDate?.().toISOString(),
  }));
};

// ==================== 管理員功能 ====================

/**
 * 獲取所有閃購活動（管理員用）
 * @param {Object} options - 選項
 * @returns {Promise<Array>}
 */
export const getAllFlashSales = async (options = {}) => {
  const db = getFirestoreDb();
  let query = db.collection("flash_sales").orderBy("createdAt", "desc");

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const salesSnapshot = await query.get();
  const now = getTaiwanTime();

  return salesSnapshot.docs.map(doc => {
    const data = doc.data();
    const startTime = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
    const endTime = data.endTime?.toDate ? data.endTime.toDate() : new Date(data.endTime);

    let status = FLASH_SALE_STATUS.SCHEDULED;
    if (now >= startTime && now < endTime) {
      status = FLASH_SALE_STATUS.ACTIVE;
      if (data.stockLimit && data.soldCount >= data.stockLimit) {
        status = FLASH_SALE_STATUS.SOLD_OUT;
      }
    } else if (now >= endTime) {
      status = FLASH_SALE_STATUS.ENDED;
    }

    return {
      id: doc.id,
      name: data.name,
      description: data.description,
      type: data.type,
      price: data.price,
      originalPrice: data.originalPrice,
      currency: data.currency || "TWD",
      discount: data.discount,
      contents: data.contents,
      badge: data.badge,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status,
      stockLimit: data.stockLimit || null,
      soldCount: data.soldCount || 0,
      perUserLimit: data.perUserLimit || 1,
      enabled: data.enabled,
      createdAt: data.createdAt?.toDate?.().toISOString(),
      updatedAt: data.updatedAt?.toDate?.().toISOString(),
    };
  });
};

/**
 * 創建閃購活動（管理員用）
 * @param {Object} saleData - 閃購資料
 * @returns {Promise<Object>}
 */
export const createFlashSale = async (saleData) => {
  const db = getFirestoreDb();

  const startTime = new Date(saleData.startTime);
  const endTime = new Date(saleData.endTime);

  if (endTime <= startTime) {
    throw new Error("結束時間必須晚於開始時間");
  }

  const newSale = {
    name: saleData.name,
    description: saleData.description || "",
    type: saleData.type || FLASH_SALE_TYPES.BUNDLE,
    price: saleData.price,
    originalPrice: saleData.originalPrice,
    currency: saleData.currency || "TWD",
    discount: saleData.discount || "",
    contents: {
      coins: saleData.contents?.coins || 0,
      photoUnlockCards: saleData.contents?.photoUnlockCards || 0,
      characterUnlockCards: saleData.contents?.characterUnlockCards || 0,
      videoUnlockCards: saleData.contents?.videoUnlockCards || 0,
    },
    badge: saleData.badge || "⚡ 限時閃購",
    startTime: startTime,
    endTime: endTime,
    stockLimit: saleData.stockLimit || null,
    soldCount: 0,
    perUserLimit: saleData.perUserLimit || 1,
    enabled: saleData.enabled !== false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection("flash_sales").add(newSale);
  logger.info(`[閃購] 創建新閃購活動: ${docRef.id}`);

  return {
    id: docRef.id,
    ...newSale,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };
};

/**
 * 更新閃購活動（管理員用）
 * @param {string} saleId - 閃購 ID
 * @param {Object} updateData - 更新資料
 * @returns {Promise<Object>}
 */
export const updateFlashSale = async (saleId, updateData) => {
  const db = getFirestoreDb();
  const saleRef = db.collection("flash_sales").doc(saleId);

  const saleDoc = await saleRef.get();
  if (!saleDoc.exists) {
    throw new Error("閃購活動不存在");
  }

  const updates = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  // 只更新提供的欄位
  if (updateData.name !== undefined) updates.name = updateData.name;
  if (updateData.description !== undefined) updates.description = updateData.description;
  if (updateData.type !== undefined) updates.type = updateData.type;
  if (updateData.price !== undefined) updates.price = updateData.price;
  if (updateData.originalPrice !== undefined) updates.originalPrice = updateData.originalPrice;
  if (updateData.discount !== undefined) updates.discount = updateData.discount;
  if (updateData.badge !== undefined) updates.badge = updateData.badge;
  if (updateData.stockLimit !== undefined) updates.stockLimit = updateData.stockLimit;
  if (updateData.perUserLimit !== undefined) updates.perUserLimit = updateData.perUserLimit;
  if (updateData.enabled !== undefined) updates.enabled = updateData.enabled;

  if (updateData.contents) {
    updates.contents = {
      coins: updateData.contents.coins || 0,
      photoUnlockCards: updateData.contents.photoUnlockCards || 0,
      characterUnlockCards: updateData.contents.characterUnlockCards || 0,
      videoUnlockCards: updateData.contents.videoUnlockCards || 0,
    };
  }

  if (updateData.startTime) {
    updates.startTime = new Date(updateData.startTime);
  }
  if (updateData.endTime) {
    updates.endTime = new Date(updateData.endTime);
  }

  await saleRef.update(updates);
  logger.info(`[閃購] 更新閃購活動: ${saleId}`);

  return { id: saleId, ...updates };
};

/**
 * 刪除閃購活動（管理員用）
 * @param {string} saleId - 閃購 ID
 * @returns {Promise<void>}
 */
export const deleteFlashSale = async (saleId) => {
  const db = getFirestoreDb();
  const saleRef = db.collection("flash_sales").doc(saleId);

  const saleDoc = await saleRef.get();
  if (!saleDoc.exists) {
    throw new Error("閃購活動不存在");
  }

  // 檢查是否有購買記錄
  const data = saleDoc.data();
  if (data.soldCount > 0) {
    throw new Error("已有購買記錄，無法刪除，請改為停用");
  }

  await saleRef.delete();
  logger.info(`[閃購] 刪除閃購活動: ${saleId}`);
};

/**
 * 獲取閃購統計（管理員用）
 * @returns {Promise<Object>}
 */
export const getFlashSaleStats = async () => {
  const db = getFirestoreDb();
  const now = getTaiwanTime();

  const salesSnapshot = await db.collection("flash_sales").get();

  let totalSales = 0;
  let activeSales = 0;
  let totalSoldCount = 0;
  let totalRevenue = 0;

  salesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    totalSales++;
    totalSoldCount += data.soldCount || 0;
    totalRevenue += (data.soldCount || 0) * (data.price || 0);

    const startTime = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
    const endTime = data.endTime?.toDate ? data.endTime.toDate() : new Date(data.endTime);

    if (data.enabled && now >= startTime && now < endTime) {
      if (!data.stockLimit || data.soldCount < data.stockLimit) {
        activeSales++;
      }
    }
  });

  return {
    totalSales,
    activeSales,
    totalSoldCount,
    totalRevenue,
  };
};

export default {
  FLASH_SALE_TYPES,
  FLASH_SALE_STATUS,
  getActiveFlashSales,
  getFlashSaleById,
  checkFlashSalePurchaseEligibility,
  purchaseFlashSale,
  getUserFlashSalePurchases,
  getAllFlashSales,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
  getFlashSaleStats,
};
