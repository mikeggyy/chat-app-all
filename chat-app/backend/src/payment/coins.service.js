/**
 * 金幣系統服務
 * 處理金幣的消費、充值、交易記錄
 */

import { getUserById, upsertUser } from "../user/user.service.js";
import { getWalletBalance, createWalletUpdate } from "../user/walletHelpers.js";
import { AI_FEATURE_PRICES, getFeaturePrice, COIN_PACKAGES } from "../membership/membership.config.js";
import { unlockPermanently } from "../conversation/conversationLimit.service.js";
import {
  getTicketBalance,
  usePhotoUnlockCard,
  useVideoUnlockCard,
  useCharacterUnlockTicket
} from "../membership/unlockTickets.service.js";
import {
  createTransaction,
  createTransactionInTx,
  getUserTransactions,
  getUserTransactionStats,
  TRANSACTION_TYPES as TX_TYPES
} from "./transaction.service.js";
import { getFirestoreDb } from "../firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import { CacheManager } from "../utils/CacheManager.js";
import logger from "../utils/logger.js";

// ✅ 優化：使用統一的 CacheManager 替代自定義緩存
const aiFeaturePricesCache = new CacheManager({
  name: "AIFeaturePrices",
  ttl: 60 * 1000, // 1 分鐘緩存
  enableAutoCleanup: true,
});

const coinPackagesCache = new CacheManager({
  name: "CoinPackages",
  ttl: 60 * 1000, // 1 分鐘緩存
  enableAutoCleanup: true,
});

/**
 * 從 Firestore 獲取 AI 功能價格
 * @returns {Promise<Object>} AI 功能價格配置
 */
const getAiFeaturePricesFromFirestore = async () => {
  // ✅ 優化：使用 CacheManager（鍵為固定值 "all"）
  const cached = aiFeaturePricesCache.get("all");
  if (cached) {
    logger.debug(`[金幣服務] 使用快取的 AI 功能價格`);
    return cached;
  }

  try {
    const db = getFirestoreDb();
    const snapshot = await db.collection("ai_feature_prices").get();

    if (!snapshot.empty) {
      const prices = {};
      snapshot.forEach(doc => {
        prices[doc.id] = doc.data();
      });

      // ✅ 優化：使用 CacheManager 存儲
      aiFeaturePricesCache.set("all", prices);

      logger.debug(`[金幣服務] 從 Firestore 讀取 AI 功能價格: ${Object.keys(prices).length} 個`);
      return prices;
    }
  } catch (error) {
    logger.warn(`[金幣服務] 從 Firestore 讀取 AI 功能價格失敗: ${error.message}`);
  }

  // 如果 Firestore 中沒有，使用代碼中的默認值
  logger.debug(`[金幣服務] 使用代碼中的 AI 功能價格`);
  return AI_FEATURE_PRICES;
};

/**
 * 從 Firestore 獲取金幣充值套餐
 * @returns {Promise<Array>} 金幣套餐列表
 */
const getCoinPackagesFromFirestore = async () => {
  // ✅ 優化：使用 CacheManager（鍵為固定值 "all"）
  const cached = coinPackagesCache.get("all");
  if (cached) {
    logger.debug(`[金幣服務] 使用快取的金幣套餐`);
    return cached;
  }

  try {
    const db = getFirestoreDb();
    const snapshot = await db.collection("coin_packages").where("status", "==", "active").get();

    if (!snapshot.empty) {
      const packages = [];
      snapshot.forEach(doc => {
        packages.push(doc.data());
      });

      // ✅ 優化：使用 CacheManager 存儲
      coinPackagesCache.set("all", packages);

      logger.debug(`[金幣服務] 從 Firestore 讀取金幣套餐: ${packages.length} 個`);
      return packages;
    }
  } catch (error) {
    logger.warn(`[金幣服務] 從 Firestore 讀取金幣套餐失敗: ${error.message}`);
  }

  // 如果 Firestore 中沒有，使用代碼中的默認值
  const defaultPackages = Object.values(COIN_PACKAGES);
  logger.debug(`[金幣服務] 使用代碼中的金幣套餐`);
  return defaultPackages;
};

/**
 * 交易類型（從 transaction.service 導出）
 */
export const TRANSACTION_TYPES = TX_TYPES;

/**
 * 獲取用戶金幣餘額
 */
export const getCoinsBalance = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  return {
    userId,
    balance: getWalletBalance(user),
    currency: "coins",
  };
};

/**
 * 扣除金幣（使用 Firestore Transaction 確保原子性）
 */
export const deductCoins = async (userId, amount, description, metadata = {}) => {
  if (amount <= 0) {
    throw new Error("扣除金額必須大於 0");
  }

  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();
    const currentBalance = getWalletBalance(user);

    // 2. 檢查餘額是否足夠
    if (currentBalance < amount) {
      throw new Error(`金幣不足，當前餘額：${currentBalance}，需要：${amount}`);
    }

    const newBalance = currentBalance - amount;

    // 3. 在同一事務中更新用戶餘額
    const walletUpdate = createWalletUpdate(newBalance);
    transaction.update(userRef, {
      ...walletUpdate,
      updatedAt: new Date().toISOString(),
    });

    // 4. 在同一事務中創建交易記錄
    // ✅ P1-3 修復：統一使用絕對值存儲 amount，由 type 決定加減
    createTransactionInTx(transaction, {
      userId,
      type: TRANSACTION_TYPES.SPEND,
      amount: amount, // 使用絕對值（正數），統計時根據 type 判斷加減
      description,
      metadata,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });

    // 5. 設置返回結果
    result = {
      success: true,
      previousBalance: currentBalance,
      newBalance,
      amount,
    };

    logger.info(`[金幣服務] 扣除金幣: 用戶 ${userId}, 金額 ${amount}, 餘額 ${currentBalance} → ${newBalance}`);
  });

  return result;
};

/**
 * 增加金幣（使用 Firestore Transaction 確保原子性）
 */
export const addCoins = async (userId, amount, type, description, metadata = {}) => {
  if (amount <= 0) {
    throw new Error("增加金額必須大於 0");
  }

  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();
    const currentBalance = getWalletBalance(user);
    const newBalance = currentBalance + amount;

    // 2. 在同一事務中更新用戶餘額
    const walletUpdate = createWalletUpdate(newBalance);
    transaction.update(userRef, {
      ...walletUpdate,
      updatedAt: new Date().toISOString(),
    });

    // 3. 在同一事務中創建交易記錄
    createTransactionInTx(transaction, {
      userId,
      type,
      amount,
      description,
      metadata,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });

    // 4. 設置返回結果
    result = {
      success: true,
      previousBalance: currentBalance,
      newBalance,
      amount,
    };

    logger.info(`[金幣服務] 增加金幣: 用戶 ${userId}, 金額 ${amount}, 餘額 ${currentBalance} → ${newBalance}`);
  });

  return result;
};

/**
 * 購買角色無限對話解鎖（使用角色解鎖票或金幣）
 * ✅ P1-3 修復：檢查角色是否已解鎖，避免重複購買
 */
export const purchaseUnlimitedChat = async (userId, characterId, options = {}) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  const db = getFirestoreDb();

  // 獲取價格配置（在 Transaction 外）
  const aiFeaturePrices = await getAiFeaturePricesFromFirestore();
  const feature = aiFeaturePrices.character_unlock_ticket || aiFeaturePrices.characterUnlockTicket;
  if (!feature) {
    throw new Error("找不到角色解鎖票價格配置");
  }

  // 檢查是否使用解鎖票（在 Transaction 外）
  const characterUnlockCards = user?.assets?.characterUnlockCards ||
                                user?.unlockTickets?.characterUnlockCards || 0;
  const useTicket = options.useTicket !== false; // 預設使用解鎖票

  // ✅ P1-3 Critical 修復：使用 Transaction 確保原子性
  // 將檢查、扣款、解鎖三個操作放在同一個 Transaction 內
  let result;

  await db.runTransaction(async (transaction) => {
    // 1. 在 Transaction 內讀取最新狀態
    const limitRef = db.collection("usage_limits").doc(userId);
    const limitDoc = await transaction.get(limitRef);

    const conversationLimit = limitDoc.exists
      ? limitDoc.data()?.conversation?.[characterId]
      : null;

    // 2. 檢查是否已永久解鎖（在 Transaction 內）
    if (conversationLimit?.permanentUnlock) {
      throw new Error("該角色已永久解鎖，無需重複購買");
    }

    // 提示用戶是否有臨時解鎖（可選）
    if (conversationLimit?.temporaryUnlockUntil) {
      const expiryDate = new Date(conversationLimit.temporaryUnlockUntil);
      if (expiryDate > new Date()) {
        logger.info(
          `[角色解鎖] 用戶 ${userId} 購買永久解鎖，當前有臨時解鎖至 ${expiryDate.toISOString()}`
        );
      }
    }

    // 3. 使用解鎖票或金幣
    if (useTicket && characterUnlockCards > 0) {
      // 使用解鎖票（在 Transaction 內扣除）
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);
      const userData = userDoc.data();

      // ✅ Quick Win #2: 統一從 assets.* 讀取（向後兼容 unlockTickets.*）
      const currentTickets = userData.assets?.characterUnlockCards ||
                            userData.unlockTickets?.characterUnlockCards || 0;
      if (currentTickets < 1) {
        throw new Error("解鎖票不足");
      }

      // ✅ 同時更新兩個位置（向後兼容）
      transaction.update(userRef, {
        "assets.characterUnlockCards": currentTickets - 1,
        "unlockTickets.characterUnlockCards": currentTickets - 1,
        updatedAt: new Date().toISOString(),
      });

      result = {
        success: true,
        featureId: "character_unlock_ticket",
        characterId,
        cost: 0,
        paymentMethod: "unlock_ticket",
        remainingTickets: currentTickets - 1,
        permanent: true,
      };
    } else {
      // 使用金幣（在 Transaction 內扣除）
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);
      const userData = userDoc.data();

      const currentBalance = getWalletBalance(userData);
      if (currentBalance < feature.basePrice) {
        throw new Error(`金幣不足，需要 ${feature.basePrice}，當前餘額 ${currentBalance}`);
      }

      const newBalance = currentBalance - feature.basePrice;

      // 更新用戶餘額
      transaction.update(userRef, {
        ...createWalletUpdate(newBalance),
        updatedAt: new Date().toISOString(),
      });

      // 創建交易記錄
      const transactionRef = db.collection("transactions").doc();
      transaction.set(transactionRef, {
        userId,
        type: TRANSACTION_TYPES.SPEND,  // ✅ 統一使用 SPEND 類型（消費金幣）
        amount: feature.basePrice,      // ✅ 使用絕對值（符合 P1-3 修復規範）
        description: `角色解鎖票 - ${characterId}`,
        metadata: {
          featureId: feature.id,
          characterId,
          itemType: "character_unlock_ticket",  // ✅ 明確記錄購買的商品類型
          paymentMethod: "coins",
        },
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        status: "completed",
        createdAt: new Date().toISOString(),
      });

      result = {
        success: true,
        featureId: feature.id,
        characterId,
        cost: feature.basePrice,
        paymentMethod: "coins",
        balance: newBalance,
        permanent: true,
      };
    }

    // 4. 永久解鎖（在 Transaction 內）
    const newConversationLimit = {
      ...conversationLimit,
      permanentUnlock: true,
      unlockedAt: new Date().toISOString(),
    };

    transaction.set(
      limitRef,
      {
        conversation: {
          [characterId]: newConversationLimit,
        },
      },
      { merge: true }
    );

    // 4.5 ✅ P2-7 新增：記錄到 unlockedCharacters 欄位（快速查詢已解鎖角色）
    const unlockedCharactersUpdate = {
      [`unlockedCharacters.${characterId}`]: {
        unlockedAt: FieldValue.serverTimestamp(),
        unlockedBy: useTicket && characterUnlockCards > 0 ? "ticket" : "coins",
        permanent: true, // 永久解鎖
        expiresAt: null, // 永久解鎖無過期時間
      },
    };
    transaction.update(userRef, unlockedCharactersUpdate);

    logger.info(`[角色解鎖] ✅ Transaction 完成 - 用戶 ${userId} 永久解鎖角色 ${characterId}`);
  });

  return result;
};

/**
 * 獲取功能價格（考慮會員折扣）
 */
export const getFeaturePricing = async (userId, featureId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("找不到用戶");
  }

  const tier = user.membershipTier || "free";
  const pricing = getFeaturePrice(featureId, tier);

  return {
    featureId,
    tier,
    ...pricing,
  };
};

/**
 * 獲取所有可購買功能的價格列表
 */
export const getAllFeaturePrices = async (userId) => {
  const user = await getUserById(userId);
  const tier = user?.membershipTier || "free";

  const aiFeaturePrices = await getAiFeaturePricesFromFirestore();
  const features = {};

  for (const [featureId, feature] of Object.entries(aiFeaturePrices)) {
    const pricing = getFeaturePrice(featureId, tier);
    features[featureId] = {
      ...feature,
      ...pricing,
    };
  }

  return {
    tier,
    balance: getWalletBalance(user),
    features,
  };
};

/**
 * 獲取用戶交易記錄
 */
export const getTransactionHistory = async (userId, options = {}) => {
  const transactions = await getUserTransactions(userId, options);

  return {
    userId,
    total: transactions.length,
    offset: options.offset || 0,
    limit: options.limit || 50,
    transactions,
  };
};

/**
 * 獲取金幣充值套餐列表
 */
export const getCoinPackages = async () => {
  const packages = await getCoinPackagesFromFirestore();
  return {
    success: true,
    packages,
  };
};

/**
 * 充值金幣（管理員或支付成功後呼叫）
 */
export const rechargeCoins = (userId, amount, paymentInfo = {}) => {
  return addCoins(
    userId,
    amount,
    TRANSACTION_TYPES.PURCHASE,
    `購買金幣 x${amount}`,
    {
      payment: paymentInfo,
    }
  );
};

/**
 * 購買金幣套餐（整合支付系統後使用）
 */
export const purchaseCoinPackage = async (userId, packageId, paymentInfo = {}) => {
  const packages = await getCoinPackagesFromFirestore();
  const coinPackage = packages.find(pkg => pkg.id === packageId);

  if (!coinPackage) {
    throw new Error(`找不到金幣套餐：${packageId}`);
  }

  // TODO: 整合支付系統
  // 目前直接發放金幣，實際應用應先驗證付款成功

  return addCoins(
    userId,
    coinPackage.totalCoins,
    TRANSACTION_TYPES.PURCHASE,
    `購買 ${coinPackage.name}`,
    {
      packageId,
      baseCoins: coinPackage.coins,
      bonus: coinPackage.bonus,
      payment: paymentInfo,
    }
  );
};

/**
 * 簡易退款（僅退還金幣，不回滾資產）
 * @deprecated 請使用 refundPurchase 以獲得完整的退款流程
 */
export const refundCoins = (userId, amount, reason) => {
  return addCoins(
    userId,
    amount,
    TRANSACTION_TYPES.REFUND,
    `退款：${reason}`,
    { reason }
  );
};

/**
 * 完整退款流程（推薦）
 * ✅ 功能包括：
 * - 查詢原交易並驗證
 * - 檢查是否已退款
 * - 檢查退款時間限制（7天內）
 * - 退還金幣
 * - 回滾已消耗的資產（如果有）
 * - 更新原交易狀態
 * - 創建退款交易記錄
 *
 * ⚠️ 安全警告：
 * - forceRefund 參數應該僅限管理員使用
 * - 在路由層面必須使用 requireAdmin 中間件保護此功能
 * - 強制退款會繞過時間限制和資產使用檢查，可能導致商業損失
 *
 * @param {string} userId - 用戶 ID
 * @param {string} transactionId - 原交易 ID
 * @param {string} reason - 退款原因
 * @param {Object} options - 選項
 * @param {number} options.refundDaysLimit - 退款期限（天數），默認 7 天
 * @param {boolean} options.forceRefund - 是否強制退款（跳過時間和資產使用檢查），默認 false
 *                                        ⚠️ 僅供管理員使用，需要在路由層驗證管理員權限
 * @returns {Promise<Object>} 退款結果
 */
export const refundPurchase = async (userId, transactionId, reason, options = {}) => {
  const { refundDaysLimit = 7, forceRefund = false } = options;

  // ✅ P0-1 安全檢查：記錄強制退款操作（便於審計）
  if (forceRefund) {
    logger.warn(
      `[退款] ⚠️ 強制退款模式已啟用 - 用戶: ${userId}, 交易: ${transactionId}, ` +
      `原因: ${reason}。此操作應僅由管理員執行。`
    );
  }

  const db = getFirestoreDb();

  return await db.runTransaction(async (transaction) => {
    // 1. 查詢原交易
    const txRef = db.collection("transactions").doc(transactionId);
    const txDoc = await transaction.get(txRef);

    if (!txDoc.exists) {
      throw new Error("找不到原交易記錄");
    }

    const originalTx = txDoc.data();

    // 2. 驗證交易所屬用戶
    if (originalTx.userId !== userId) {
      throw new Error("交易記錄與用戶不符");
    }

    // 3. 檢查是否已退款
    if (originalTx.status === "refunded") {
      throw new Error(`該交易已於 ${new Date(originalTx.refundedAt?.toDate?.() || originalTx.refundedAt).toLocaleString()} 退款`);
    }

    // 4. 檢查退款時間限制
    if (!forceRefund) {
      const txTime = originalTx.createdAt?.toDate?.() || new Date(originalTx.createdAt);
      const now = new Date();
      const daysDiff = (now - txTime) / (1000 * 60 * 60 * 24);

      if (daysDiff > refundDaysLimit) {
        throw new Error(`超過退款期限（${refundDaysLimit}天），當前已過 ${Math.floor(daysDiff)} 天`);
      }
    }

    // 5. 檢查原交易類型（只有扣款交易可退款）
    const refundableTypes = [
      TRANSACTION_TYPES.PURCHASE,
      TRANSACTION_TYPES.GIFT,
      TRANSACTION_TYPES.UNLOCK,
      TRANSACTION_TYPES.DEDUCT,
    ];

    if (!refundableTypes.includes(originalTx.type)) {
      throw new Error(`該交易類型（${originalTx.type}）不支持退款`);
    }

    // 6. 讀取用戶資料
    const userRef = db.collection("users").doc(userId);
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();
    const currentBalance = getWalletBalance(user);

    // 7. 提前解析 metadata（用於判斷是否需要讀取 limitRef）
    // ✅ P1-1 優化：完整的資產回滾邏輯
    // ✅ Risk Fix: 添加 metadata 完整性驗證
    const metadata = originalTx.metadata || {};
    const assetType = metadata.assetType;
    const quantity = metadata.quantity || 1;
    const characterId = metadata.characterId;
    const itemType = metadata.itemType;

    // 8. ✅ Transaction 優化：提前讀取 limitRef（如果需要）
    // 將讀取操作移到所有寫入操作之前，符合 Transaction 最佳實踐
    let limitDoc = null;
    if (itemType === 'character_unlock_ticket' && characterId) {
      const limitRef = db.collection('usage_limits').doc(userId);
      limitDoc = await transaction.get(limitRef);
    }

    // 9. 計算初始退款金額（稍後可能因資產已使用而調整）
    const refundAmount = Math.abs(originalTx.amount);

    // 10. 回滾資產（如果有）

    // 防禦性檢查：對於需要資產回滾的交易類型，驗證 metadata 是否存在
    const ASSET_REQUIRED_TYPES = [
      TRANSACTION_TYPES.UNLOCK,    // 解鎖交易通常涉及解鎖券
      TRANSACTION_TYPES.PURCHASE,  // 購買交易可能涉及資產
    ];

    if (ASSET_REQUIRED_TYPES.includes(originalTx.type) && !assetType) {
      logger.warn(
        `[退款] ⚠️ 交易 ${transactionId} (類型: ${originalTx.type}) 缺少 metadata.assetType，` +
        `可能無法完整回滾資產。Metadata: ${JSON.stringify(metadata)}`
      );
      // 繼續執行退款（至少退還金幣），但記錄警告
    }

    // ✅ P0-1 修復：增強退款驗證，防止先用後退漏洞
    let actualRefundAmount = refundAmount; // 實際退款金額（可能因資產已使用而減少）
    let usedAssetValue = 0; // 已使用資產的價值

    if (assetType) {
      const currentAssets = user.assets || {};
      const currentQuantity = currentAssets[assetType] || 0;

      // ⚠️ 檢查用戶是否還有足夠的資產可以扣除
      if (currentQuantity < quantity) {
        const usedQuantity = quantity - currentQuantity;
        logger.warn(
          `[退款] 用戶 ${userId} 的 ${assetType} 已使用 ${usedQuantity}/${quantity}，` +
          `當前剩餘 ${currentQuantity}`
        );

        // ✅ P0-1 修復：計算已使用資產的價值（按市價扣除）
        // 從原交易金額中推算單個資產的價值
        // 使用 Math.floor() 向下取整，避免退款金額超過原購買金額
        const unitPrice = Math.floor(refundAmount / quantity);
        usedAssetValue = usedQuantity * unitPrice;

        // ✅ 修復：實施部分退款機制
        // 已使用的資產不退款，只退還未使用資產的價值
        actualRefundAmount = currentQuantity * unitPrice;

        // ✅ P0-1 安全檢查：確保退款金額不超過原購買金額
        if (actualRefundAmount > refundAmount) {
          logger.warn(
            `[退款] 計算的退款金額 ${actualRefundAmount} 超過原購買金額 ${refundAmount}，` +
            `已調整為原購買金額`
          );
          actualRefundAmount = refundAmount;
        }

        // 檢查退款冷靜期（24 小時內可忽略已使用資產）
        const txTime = originalTx.createdAt?.toDate?.() || new Date(originalTx.createdAt);
        const hoursSincePurchase = (now - txTime) / (1000 * 60 * 60);

        if (hoursSincePurchase <= 24 && !forceRefund) {
          // 24 小時內允許全額退款（冷靜期政策）
          logger.info(`[退款] 購買在 24 小時內（${hoursSincePurchase.toFixed(1)}h），適用冷靜期政策，允許全額退款`);
          actualRefundAmount = refundAmount;
          usedAssetValue = 0;
        } else if (currentQuantity === 0) {
          // ✅ 修復：如果資產已完全使用，拒絕退款（除非強制）
          if (!forceRefund) {
            throw new Error(
              `無法退款：購買的資產已完全使用（${usedQuantity}/${quantity}）。` +
              `如需協助，請聯繫客服。`
            );
          }
          logger.warn(`[退款] ⚠️ 強制退款模式：資產已完全使用但仍允許全額退款`);
          actualRefundAmount = refundAmount;
          usedAssetValue = 0;
        } else {
          // 部分退款
          logger.info(
            `[退款] 實施部分退款 - 原價: ${refundAmount}, ` +
            `已使用價值: ${usedAssetValue}, ` +
            `實際退款: ${actualRefundAmount}`
          );
        }

        // 扣除剩餘的所有資產
        transaction.update(userRef, {
          [`assets.${assetType}`]: 0,
          [`unlockTickets.${assetType}`]: 0, // ✅ 同步更新 unlockTickets（向後兼容）
        });
      } else {
        // 完整回滾（資產未使用或使用量在可接受範圍內）
        const newQuantity = currentQuantity - quantity;
        transaction.update(userRef, {
          [`assets.${assetType}`]: newQuantity,
          [`unlockTickets.${assetType}`]: newQuantity, // ✅ 同步更新 unlockTickets（向後兼容）
        });
      }

      // ✅ P1-1 優化：如果是角色解鎖券，撤銷永久解鎖狀態
      // ✅ Transaction 優化：使用提前讀取的 limitDoc（Line 628-632）
      if (itemType === 'character_unlock_ticket' && characterId && limitDoc) {
        const limitRef = db.collection('usage_limits').doc(userId);

        if (limitDoc.exists) {
          const limitData = limitDoc.data();
          const conversationLimit = limitData.conversation?.[characterId];

          // 只有在確實是永久解鎖的情況下才撤銷
          if (conversationLimit?.permanentUnlock) {
            transaction.update(limitRef, {
              [`conversation.${characterId}.permanentUnlock`]: false,
              [`conversation.${characterId}.refundedAt`]: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });

            logger.info(`[退款] ✅ 已撤銷用戶 ${userId} 對角色 ${characterId} 的永久解鎖`);
          }
        }
      }
    }

    // 11. ✅ 修復：使用實際退款金額更新用戶餘額
    const newBalance = currentBalance + actualRefundAmount;

    transaction.update(userRef, {
      ...createWalletUpdate(newBalance),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 12. 更新原交易狀態
    transaction.update(txRef, {
      status: "refunded",
      refundedAt: FieldValue.serverTimestamp(),
      refundReason: reason,
    });

    // 13. 創建退款交易記錄
    const refundTxRef = db.collection("transactions").doc();
    transaction.set(refundTxRef, {
      id: refundTxRef.id,
      userId,
      type: TRANSACTION_TYPES.REFUND,
      amount: actualRefundAmount, // ✅ 使用實際退款金額
      description: actualRefundAmount < refundAmount
        ? `部分退款：${reason}（已使用 ${usedAssetValue} 金幣的資產）`
        : `退款：${reason}`,
      metadata: {
        originalTransactionId: transactionId,
        originalAmount: refundAmount,
        actualRefundAmount,
        usedAssetValue,
        reason,
        refundedAsset: assetType ? { type: assetType, quantity, remainingQuantity: currentAssets?.[assetType] || 0 } : null,
        isPartialRefund: actualRefundAmount < refundAmount,
      },
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      refundAmount: actualRefundAmount, // ✅ 返回實際退款金額
      originalAmount: refundAmount, // 原始交易金額
      usedAssetValue, // 已使用資產的價值
      isPartialRefund: actualRefundAmount < refundAmount,
      newBalance,
      refundedAsset: assetType ? {
        type: assetType,
        quantity,
        remainingQuantity: currentAssets?.[assetType] || 0,
        usedQuantity: assetType ? quantity - (currentAssets?.[assetType] || 0) : 0
      } : null,
      originalTransaction: {
        id: transactionId,
        amount: originalTx.amount,
        type: originalTx.type,
        createdAt: originalTx.createdAt,
      },
    };
  });
};

/**
 * 設定金幣餘額（測試帳號專用，使用 Firestore Transaction 確保原子性）
 * 直接設定金幣數量，不考慮原有餘額
 */
export const setCoinsBalance = async (userId, newBalance) => {
  if (newBalance < 0) {
    throw new Error("金幣餘額不能為負數");
  }

  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  let result = null;

  await db.runTransaction(async (transaction) => {
    // 1. 讀取用戶資料
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();
    const currentBalance = getWalletBalance(user);
    const difference = newBalance - currentBalance;

    // 2. 在同一事務中更新用戶餘額
    const walletUpdate = createWalletUpdate(newBalance);
    transaction.update(userRef, {
      ...walletUpdate,
      updatedAt: new Date().toISOString(),
    });

    // 3. 記錄交易到 Firestore
    const description = difference > 0
      ? `測試帳號設定金幣 +${difference}`
      : `測試帳號設定金幣 ${difference}`;

    createTransactionInTx(transaction, {
      userId,
      type: TRANSACTION_TYPES.ADMIN,
      amount: difference,
      description,
      metadata: { previousBalance: currentBalance },
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });

    // 4. 設置返回結果
    result = {
      success: true,
      previousBalance: currentBalance,
      newBalance,
      difference,
    };

    logger.info(`[金幣服務] 設定金幣餘額: 用戶 ${userId}, 餘額 ${currentBalance} → ${newBalance}`);
  });

  return result;
};

/**
 * 獲取交易記錄統計資訊（使用 Firestore）
 * @param {string} userId - 用戶 ID
 * @param {Object} options - 統計選項
 * @returns {Promise<Object>} 統計資訊
 */
export const getTransactionStats = async (userId, options = {}) => {
  return await getUserTransactionStats(userId, options);
};

export default {
  getCoinsBalance,
  addCoins,
  purchaseUnlimitedChat,
  getFeaturePricing,
  getAllFeaturePrices,
  getTransactionHistory,
  getCoinPackages,
  purchaseCoinPackage,
  rechargeCoins,
  refundCoins,
  setCoinsBalance,
  getTransactionStats,
};
