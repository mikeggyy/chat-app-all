/**
 * 組合禮包服務
 * 處理組合禮包的查詢、購買和限購追蹤
 */

import { getUserById } from "../user/user.service.js";
import { getWalletBalance, createWalletUpdate } from "../user/walletHelpers.js";
import { BUNDLE_PACKAGES } from "../membership/membership.config.js";
import {
  createTransactionInTx,
  TRANSACTION_TYPES
} from "./transaction.service.js";
import { getFirestoreDb, FieldValue } from "../firebase/index.js";
import { CacheManager } from "../utils/CacheManager.js";
import logger from "../utils/logger.js";

// 使用 CacheManager 緩存組合禮包
const bundlePackagesCache = new CacheManager({
  name: "BundlePackages",
  ttl: 60 * 1000, // 1 分鐘緩存
  enableAutoCleanup: true,
});

/**
 * 從 Firestore 獲取組合禮包
 * @returns {Promise<Array>} 組合禮包列表
 */
const getBundlePackagesFromFirestore = async () => {
  // 檢查緩存
  const cached = bundlePackagesCache.get("all");
  if (cached) {
    logger.debug(`[禮包服務] 使用快取的組合禮包`);
    return cached;
  }

  try {
    const db = getFirestoreDb();
    const snapshot = await db.collection("bundle_packages").where("status", "==", "active").get();

    if (!snapshot.empty) {
      const packages = [];
      snapshot.forEach(doc => {
        packages.push(doc.data());
      });

      // 按照 order 欄位排序（升序）
      packages.sort((a, b) => (a.order || 0) - (b.order || 0));

      // 存入緩存
      bundlePackagesCache.set("all", packages);

      logger.debug(`[禮包服務] 從 Firestore 讀取組合禮包: ${packages.length} 個`);
      return packages;
    }
  } catch (error) {
    logger.warn(`[禮包服務] 從 Firestore 讀取組合禮包失敗: ${error.message}`);
  }

  // 如果 Firestore 中沒有，使用代碼中的默認值
  const defaultPackages = Object.values(BUNDLE_PACKAGES);
  logger.debug(`[禮包服務] 使用代碼中的組合禮包`);
  return defaultPackages;
};

/**
 * 獲取用戶的禮包購買記錄
 * @param {string} userId - 用戶 ID
 * @returns {Promise<Object>} 購買記錄 { bundleId: { count, lastPurchaseAt, firstPurchaseAt } }
 */
export const getUserBundlePurchases = async (userId) => {
  const db = getFirestoreDb();
  const purchasesRef = db.collection("users").doc(userId).collection("bundle_purchases");
  const snapshot = await purchasesRef.get();

  const purchases = {};
  snapshot.forEach(doc => {
    purchases[doc.id] = doc.data();
  });

  return purchases;
};

/**
 * 檢查用戶是否可以購買禮包（根據限購規則）
 * @param {string} userId - 用戶 ID
 * @param {Object} bundle - 禮包配置
 * @returns {Promise<Object>} { canPurchase, reason, nextAvailableAt }
 */
export const checkPurchaseLimit = async (userId, bundle) => {
  const purchaseLimit = bundle.purchaseLimit;

  // 無限制
  if (!purchaseLimit || purchaseLimit === "none") {
    return { canPurchase: true };
  }

  // 獲取用戶購買記錄
  const purchases = await getUserBundlePurchases(userId);
  const bundlePurchase = purchases[bundle.id];

  // 從未購買過
  if (!bundlePurchase) {
    return { canPurchase: true };
  }

  const now = new Date();
  const lastPurchaseAt = bundlePurchase.lastPurchaseAt?.toDate?.() || new Date(bundlePurchase.lastPurchaseAt);

  switch (purchaseLimit) {
    case "once":
      // 終身限購一次
      return {
        canPurchase: false,
        reason: "此禮包僅限購買一次",
        purchasedAt: lastPurchaseAt,
      };

    case "monthly": {
      // 每月限購一次（每月 1 號重置）
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const purchaseMonth = new Date(lastPurchaseAt.getFullYear(), lastPurchaseAt.getMonth(), 1);

      if (purchaseMonth >= currentMonth) {
        // 本月已購買
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return {
          canPurchase: false,
          reason: "此禮包每月限購一次，本月已購買",
          purchasedAt: lastPurchaseAt,
          nextAvailableAt: nextMonth,
        };
      }
      return { canPurchase: true };
    }

    case "weekly": {
      // 每週限購一次（每週一重置）
      const getWeekStart = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 週一為起始
        return new Date(d.setDate(diff));
      };

      const currentWeekStart = getWeekStart(now);
      const purchaseWeekStart = getWeekStart(lastPurchaseAt);

      if (purchaseWeekStart >= currentWeekStart) {
        // 本週已購買
        const nextWeekStart = new Date(currentWeekStart);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);
        return {
          canPurchase: false,
          reason: "此禮包每週限購一次，本週已購買",
          purchasedAt: lastPurchaseAt,
          nextAvailableAt: nextWeekStart,
        };
      }
      return { canPurchase: true };
    }

    default:
      return { canPurchase: true };
  }
};

/**
 * 獲取組合禮包列表
 * @returns {Promise<Object>} 組合禮包列表結果
 */
export const getBundlePackages = async () => {
  const packages = await getBundlePackagesFromFirestore();
  return {
    success: true,
    packages,
  };
};

/**
 * 獲取組合禮包列表（包含用戶購買狀態）
 * @param {string} userId - 用戶 ID（可選）
 * @returns {Promise<Object>} 組合禮包列表結果（含購買狀態）
 */
export const getBundlePackagesWithStatus = async (userId) => {
  const packages = await getBundlePackagesFromFirestore();

  // 如果沒有用戶 ID，返回基本列表
  if (!userId) {
    return {
      success: true,
      packages: packages.map(pkg => ({
        ...pkg,
        purchaseStatus: null,
      })),
    };
  }

  // 獲取用戶購買記錄
  const purchases = await getUserBundlePurchases(userId);

  // 為每個禮包添加購買狀態
  const packagesWithStatus = await Promise.all(packages.map(async (pkg) => {
    const limitCheck = await checkPurchaseLimit(userId, pkg);
    const purchaseRecord = purchases[pkg.id];

    return {
      ...pkg,
      purchaseStatus: {
        canPurchase: limitCheck.canPurchase,
        reason: limitCheck.reason || null,
        nextAvailableAt: limitCheck.nextAvailableAt || null,
        purchaseCount: purchaseRecord?.count || 0,
        lastPurchaseAt: purchaseRecord?.lastPurchaseAt || null,
      },
    };
  }));

  return {
    success: true,
    packages: packagesWithStatus,
  };
};

/**
 * 獲取單個組合禮包詳情
 * @param {string} bundleId - 禮包 ID
 * @returns {Promise<Object>} 組合禮包詳情
 */
export const getBundlePackageById = async (bundleId) => {
  const packages = await getBundlePackagesFromFirestore();
  const bundle = packages.find(pkg => pkg.id === bundleId);

  if (!bundle) {
    return {
      success: false,
      error: `找不到組合禮包：${bundleId}`,
    };
  }

  return {
    success: true,
    bundle,
  };
};

/**
 * 購買組合禮包（需要整合支付系統）
 *
 * ⚠️ 注意：此函數假設付款已完成
 * 實際應用中，應先完成第三方支付驗證後再調用此函數
 *
 * @param {string} userId - 用戶 ID
 * @param {string} bundleId - 禮包 ID
 * @param {Object} paymentInfo - 支付信息（可選）
 * @returns {Promise<Object>} 購買結果
 */
export const purchaseBundlePackage = async (userId, bundleId, paymentInfo = {}) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  // 獲取組合禮包
  const packages = await getBundlePackagesFromFirestore();
  const bundle = packages.find(pkg => pkg.id === bundleId);

  if (!bundle) {
    throw new Error(`找不到組合禮包：${bundleId}`);
  }

  // ✅ 檢查限購
  const limitCheck = await checkPurchaseLimit(userId, bundle);
  if (!limitCheck.canPurchase) {
    throw new Error(limitCheck.reason);
  }

  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);
  const purchaseRef = db.collection("users").doc(userId).collection("bundle_purchases").doc(bundleId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料和購買記錄
    const userDoc = await transaction.get(userRef);
    const purchaseDoc = await transaction.get(purchaseRef);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    // 2. 再次檢查限購（Transaction 內確保原子性）
    if (purchaseDoc.exists) {
      const existingPurchase = purchaseDoc.data();
      const purchaseLimit = bundle.purchaseLimit;

      if (purchaseLimit === "once") {
        throw new Error("此禮包僅限購買一次，您已購買過");
      }

      if (purchaseLimit === "monthly") {
        const now = new Date();
        const lastPurchaseAt = existingPurchase.lastPurchaseAt?.toDate?.() || new Date(existingPurchase.lastPurchaseAt);
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const purchaseMonth = new Date(lastPurchaseAt.getFullYear(), lastPurchaseAt.getMonth(), 1);

        if (purchaseMonth >= currentMonth) {
          throw new Error("此禮包每月限購一次，本月已購買");
        }
      }

      if (purchaseLimit === "weekly") {
        const now = new Date();
        const lastPurchaseAt = existingPurchase.lastPurchaseAt?.toDate?.() || new Date(existingPurchase.lastPurchaseAt);

        const getWeekStart = (date) => {
          const d = new Date(date);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          return new Date(d.setDate(diff));
        };

        const currentWeekStart = getWeekStart(now);
        const purchaseWeekStart = getWeekStart(lastPurchaseAt);

        if (purchaseWeekStart >= currentWeekStart) {
          throw new Error("此禮包每週限購一次，本週已購買");
        }
      }
    }

    const userData = userDoc.data();
    const currentBalance = getWalletBalance(userData);
    const currentAssets = userData.assets || {};

    // 3. 計算新的金幣餘額和資產
    const contents = bundle.contents || {};
    const coinsToAdd = contents.coins || 0;
    const newBalance = currentBalance + coinsToAdd;

    // 計算新的資產數量
    const newAssets = { ...currentAssets };

    if (contents.photoUnlockCards) {
      newAssets.photoUnlockCards = (newAssets.photoUnlockCards || 0) + contents.photoUnlockCards;
    }
    if (contents.videoUnlockCards) {
      newAssets.videoUnlockCards = (newAssets.videoUnlockCards || 0) + contents.videoUnlockCards;
    }
    if (contents.characterUnlockCards) {
      newAssets.characterUnlockCards = (newAssets.characterUnlockCards || 0) + contents.characterUnlockCards;
    }
    if (contents.characterCreationCards) {
      newAssets.characterCreationCards = (newAssets.characterCreationCards || 0) + contents.characterCreationCards;
    }
    if (contents.voiceUnlockCards) {
      newAssets.voiceUnlockCards = (newAssets.voiceUnlockCards || 0) + contents.voiceUnlockCards;
    }

    // 4. 更新用戶資料（金幣 + 資產）
    const updateData = {
      ...createWalletUpdate(newBalance),
      assets: newAssets,
      // 同時更新 unlockTickets（向後兼容）
      unlockTickets: newAssets,
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.update(userRef, updateData);

    // 5. 記錄購買（用於限購追蹤）
    const existingPurchaseData = purchaseDoc.exists ? purchaseDoc.data() : null;
    const purchaseData = {
      bundleId: bundle.id,
      bundleName: bundle.name,
      count: (existingPurchaseData?.count || 0) + 1,
      lastPurchaseAt: FieldValue.serverTimestamp(),
      firstPurchaseAt: existingPurchaseData?.firstPurchaseAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    transaction.set(purchaseRef, purchaseData, { merge: true });

    // 6. 創建交易記錄
    createTransactionInTx(transaction, {
      userId,
      type: TRANSACTION_TYPES.PURCHASE,
      amount: bundle.price, // TWD 價格（實際支付金額）
      description: `購買 ${bundle.name}`,
      metadata: {
        bundleId: bundle.id,
        bundleName: bundle.name,
        contents: bundle.contents,
        currency: bundle.currency || "TWD",
        purchaseLimit: bundle.purchaseLimit,
        payment: paymentInfo,
      },
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });

    // 7. 設置返回結果
    result = {
      success: true,
      bundleId: bundle.id,
      bundleName: bundle.name,
      pricePaid: bundle.price,
      currency: bundle.currency || "TWD",
      received: {
        coins: coinsToAdd,
        photoUnlockCards: contents.photoUnlockCards || 0,
        videoUnlockCards: contents.videoUnlockCards || 0,
        characterUnlockCards: contents.characterUnlockCards || 0,
        characterCreationCards: contents.characterCreationCards || 0,
        voiceUnlockCards: contents.voiceUnlockCards || 0,
      },
      newBalance,
      newAssets,
      purchaseCount: purchaseData.count,
    };

    logger.info(
      `[禮包服務] 購買組合禮包: 用戶 ${userId}, 禮包 ${bundle.name}, ` +
      `金幣 ${currentBalance} → ${newBalance}, ` +
      `第 ${purchaseData.count} 次購買`
    );
  });

  return result;
};

/**
 * 清除組合禮包緩存
 * 在管理員更新禮包配置後調用
 */
export const clearBundleCache = () => {
  bundlePackagesCache.delete("all");
  logger.info(`[禮包服務] 已清除組合禮包緩存`);
};

export default {
  getBundlePackages,
  getBundlePackagesWithStatus,
  getBundlePackageById,
  purchaseBundlePackage,
  getUserBundlePurchases,
  checkPurchaseLimit,
  clearBundleCache,
};
