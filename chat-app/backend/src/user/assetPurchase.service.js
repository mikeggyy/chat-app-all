/**
 * 資產購買服務
 * 處理用戶購買資產卡的邏輯
 * 使用 SKU 架構確保價格一致性
 */

import { getFirestoreDb } from "../firebase/index.js";
import logger from "../utils/logger.js";
import { deductCoins } from "../payment/coins.service.js";
import { addUserAsset } from "./assets.service.js";
import { getUserById } from "./user.service.js";

/**
 * 從 Firestore 獲取套餐配置（支持解鎖卡和藥水）
 * @param {string} sku - 套餐 SKU
 * @returns {Promise<Object>} 套餐配置
 */
const getPackageBySku = async (sku) => {
  const db = getFirestoreDb();

  // 先嘗試從 asset_packages 集合獲取（解鎖卡）
  let packageDoc = await db.collection("asset_packages").doc(sku).get();

  if (packageDoc.exists) {
    return packageDoc.data();
  }

  // 如果找不到，嘗試從 potions 集合獲取（藥水）
  packageDoc = await db.collection("potions").doc(sku).get();

  if (packageDoc.exists) {
    return packageDoc.data();
  }

  return null;
};

/**
 * 購買資產套餐（基於 SKU）
 * 使用 Firestore Transaction 確保扣款和增加資產的原子性
 * @param {string} userId - 用戶 ID
 * @param {string} sku - 套餐 SKU (例如: video-unlock-5)
 * @returns {Promise<Object>} 購買結果
 */
export const purchaseAssetPackage = async (userId, sku) => {
  if (!userId) {
    throw new Error("用戶 ID 不能為空");
  }

  if (!sku) {
    throw new Error("套餐 SKU 不能為空");
  }

  // 從 Firestore 獲取套餐配置
  const packageConfig = await getPackageBySku(sku);
  if (!packageConfig) {
    throw new Error(`找不到套餐配置: ${sku}`);
  }

  // 檢查套餐狀態
  if (packageConfig.status !== "active") {
    throw new Error(`套餐已停用: ${sku}`);
  }

  // 兼容兩種價格欄位：finalPrice（解鎖卡）和 unitPrice（藥水）
  const price = packageConfig.finalPrice || packageConfig.unitPrice;
  const quantity = packageConfig.quantity || 1;
  const name = packageConfig.displayName || packageConfig.name;
  // 兼容不同的資產類型欄位
  let assetType = packageConfig.assetType;
  let category = packageConfig.category; // 使用 let 因為藥水可能需要設置默認值

  // 如果沒有 assetType但有 baseId（藥水），則設置為藥水類型
  if (!assetType && packageConfig.baseId) {
    // ✅ 修復：藥水使用統一的資產購買邏輯（不再轉發到 potion.service.js）
    // 藥水的庫存存儲在 usage_limits 集合的 potionInventory 中
    logger.info(`[資產購買] 檢測到藥水商品: ${sku}, baseId=${packageConfig.baseId}, quantity=${quantity}, price=${price}`);

    // 將 baseId 映射為 potionInventory 的欄位名稱
    const potionTypeMapping = {
      'memory_boost': 'memoryBoost',
      'brain_boost': 'brainBoost',
    };

    assetType = potionTypeMapping[packageConfig.baseId];

    if (!assetType) {
      throw new Error(`未知的藥水類型: ${packageConfig.baseId}`);
    }

    // 標記為藥水商品（使用特殊的購買邏輯）
    category = category || 'potions';
  }

  logger.info(
    `[資產購買] 開始購買: userId=${userId}, sku=${sku}, quantity=${quantity}, price=${price}, assetType=${assetType}, category=${category}`
  );

  // 轉換 assetType 格式：characterUnlockCard -> characterUnlockCards
  const assetTypeMapping = {
    characterUnlockCard: "characterUnlockCards",
    photoUnlockCard: "photoUnlockCards",
    videoUnlockCard: "videoUnlockCards",
    voiceUnlockCard: "voiceUnlockCards",
    createCards: "createCards",
  };

  const mainDocAssetType = assetTypeMapping[assetType] || assetType;

  // 導入必要的服務
  const { getWalletBalance, createWalletUpdate } = await import("./walletHelpers.js");
  const { createTransactionInTx, TRANSACTION_TYPES } = await import("../payment/transaction.service.js");
  const { FieldValue } = await import("firebase-admin/firestore");

  // ✅ 使用單個 Transaction 確保原子性：扣款 + 增加資產 + 創建交易記錄
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);
  const isPotionPurchase = category === 'potions';
  const usageLimitRef = isPotionPurchase ? db.collection("usage_limits").doc(userId) : null;

  const result = await db.runTransaction(async (transaction) => {
    // 1. 在 Transaction 內讀取用戶資料
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();
    const currentBalance = getWalletBalance(user);

    // 2. 檢查金幣餘額
    if (currentBalance < price) {
      throw new Error(`金幣不足，需要 ${price} 金幣，當前餘額 ${currentBalance} 金幣`);
    }

    // 3. 獲取當前資產數量（藥水從 usage_limits 讀取，其他從 users.assets 讀取）
    let previousAssetQuantity = 0;
    let newAssetQuantity = 0;

    if (isPotionPurchase) {
      // 藥水：從 usage_limits 集合讀取
      const usageLimitDoc = await transaction.get(usageLimitRef);
      const usageLimitData = usageLimitDoc.exists ? usageLimitDoc.data() : {};
      const potionInventory = usageLimitData.potionInventory || {};
      previousAssetQuantity = potionInventory[mainDocAssetType] || 0;
      newAssetQuantity = previousAssetQuantity + quantity;
    } else {
      // 其他資產：從 users.assets 讀取
      const currentAssets = user.assets || {};
      previousAssetQuantity = currentAssets[mainDocAssetType] || 0;
      newAssetQuantity = previousAssetQuantity + quantity;
    }

    // 4. 計算新金幣餘額
    const newBalance = currentBalance - price;

    // 5. 在同一 Transaction 內：扣款 + 增加資產
    const walletUpdate = createWalletUpdate(newBalance);
    const now = new Date().toISOString();

    // 5a. 更新用戶餘額
    const userUpdateData = {
      wallet: walletUpdate.wallet,
      updatedAt: now,
    };

    if (!isPotionPurchase) {
      // 非藥水：更新 users.assets
      userUpdateData[`assets.${mainDocAssetType}`] = newAssetQuantity;
    }

    transaction.update(userRef, userUpdateData);

    // 5b. 如果是藥水，更新 usage_limits.potionInventory
    if (isPotionPurchase) {
      // ✅ 在 transaction 中不能使用 FieldValue.increment()，必須直接設置計算後的值
      transaction.set(
        usageLimitRef,
        {
          potionInventory: {
            [mainDocAssetType]: newAssetQuantity, // 直接使用計算後的值
          },
          updatedAt: now, // 使用普通時間戳而不是 serverTimestamp()
        },
        { merge: true }
      );
    }

    // 6. 在同一 Transaction 內創建交易記錄
    // ✅ P1-3 修復：統一使用絕對值存儲 amount
    createTransactionInTx(transaction, {
      userId,
      type: TRANSACTION_TYPES.SPEND,
      amount: price, // 使用絕對值
      description: `購買${category} ${name}`,
      metadata: {
        sku,
        packageName: name,
        category,
        assetType: mainDocAssetType,
        quantity,
        finalPrice: price,
      },
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });

    logger.info(
      `[資產購買] Transaction 成功: userId=${userId}, sku=${sku}, quantity=${quantity}, ` +
      `price=${price}, balance: ${currentBalance} → ${newBalance}, ` +
      `assets: ${previousAssetQuantity} → ${newAssetQuantity}`
    );

    // 返回購買結果
    return {
      success: true,
      sku,
      packageName: name,
      category,
      assetType: mainDocAssetType,
      quantity,
      finalPrice: price,
      coinsSpent: price,
      newBalance,
      previousBalance: currentBalance,
      assetQuantity: newAssetQuantity,
      previousAssetQuantity,
    };
  });

  // ✅ Transaction 成功後，異步記錄資產審計日誌（失敗不影響主流程）
  try {
    await logAssetChange({
      userId,
      assetType: mainDocAssetType,
      action: "add",
      amount: quantity,
      previousQuantity: result.previousAssetQuantity,
      newQuantity: result.assetQuantity,
      reason: `購買 ${name}`,
      metadata: { sku, packageName: name, category, price },
    });
  } catch (error) {
    logger.warn(`[資產購買] 審計日誌記錄失敗（不影響購買）: ${error.message}`);
  }

  return result;
};

/**
 * 購買資產卡（舊版 API，向後兼容）
 * @deprecated 請使用 purchaseAssetPackage
 */
export const purchaseAssetCard = async (userId, assetId, quantity = 1) => {
  // 嘗試構建 SKU
  const sku = `${assetId}-${quantity}`;
  logger.warn(
    `[資產購買] 使用舊版 API，嘗試轉換為 SKU: ${sku}`
  );

  return await purchaseAssetPackage(userId, sku);
};

/**
 * 批量購買資產卡（用於套餐）
 * 使用 Firestore Transaction 確保扣款和增加所有資產的原子性
 * @param {string} userId - 用戶 ID
 * @param {Array<{assetId: string, quantity: number}>} items - 購買項目列表
 * @returns {Promise<Object>} 購買結果
 */
export const purchaseAssetBundle = async (userId, items) => {
  if (!userId) {
    throw new Error("用戶 ID 不能為空");
  }

  if (!items || items.length === 0) {
    throw new Error("購買項目不能為空");
  }

  // 計算總價
  let totalPrice = 0;
  const purchaseDetails = [];

  for (const item of items) {
    const assetConfig = getAssetCardById(item.assetId);
    if (!assetConfig) {
      throw new Error(`找不到資產配置: ${item.assetId}`);
    }

    const itemPrice = assetConfig.basePrice * item.quantity;
    totalPrice += itemPrice;

    purchaseDetails.push({
      assetId: item.assetId,
      assetName: assetConfig.name,
      assetKey: assetConfig.assetKey,
      quantity: item.quantity,
      unitPrice: assetConfig.basePrice,
      totalPrice: itemPrice,
    });
  }

  logger.info(`[資產購買] 開始批量購買: userId=${userId}, itemCount=${items.length}, totalPrice=${totalPrice}`);

  const itemsSummary = purchaseDetails
    .map((d) => `${d.assetName} x${d.quantity}`)
    .join(", ");

  // 導入必要的服務
  const { getWalletBalance, createWalletUpdate } = await import("./walletHelpers.js");
  const { createTransactionInTx, TRANSACTION_TYPES } = await import("../payment/transaction.service.js");
  const { FieldValue } = await import("firebase-admin/firestore");

  // ✅ 使用單個 Transaction 確保原子性：扣款 + 增加所有資產 + 創建交易記錄
  const db = getFirestoreDb();
  const userRef = db.collection("users").doc(userId);

  const result = await db.runTransaction(async (transaction) => {
    // 1. 在 Transaction 內讀取用戶資料
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error("找不到用戶");
    }

    const user = userDoc.data();
    const currentBalance = getWalletBalance(user);

    // 2. 檢查金幣餘額
    if (currentBalance < totalPrice) {
      throw new Error(`金幣不足，需要 ${totalPrice} 金幣，當前餘額 ${currentBalance} 金幣`);
    }

    // 3. 計算新金幣餘額
    const newBalance = currentBalance - totalPrice;

    // 4. 計算所有資產的新數量
    const currentAssets = user.assets || {};
    const assetUpdates = {};
    const assetResults = [];

    for (const detail of purchaseDetails) {
      const previousQuantity = currentAssets[detail.assetKey] || 0;
      const newQuantity = previousQuantity + detail.quantity;

      assetUpdates[`assets.${detail.assetKey}`] = newQuantity;

      assetResults.push({
        assetId: detail.assetId,
        assetName: detail.assetName,
        assetKey: detail.assetKey,
        quantity: detail.quantity,
        previousQuantity,
        newQuantity,
      });
    }

    // 5. 在同一 Transaction 內：扣款 + 增加所有資產
    const walletUpdate = createWalletUpdate(newBalance);
    const now = new Date().toISOString();
    const updateData = {
      wallet: walletUpdate.wallet,
      updatedAt: now,
    };
    Object.assign(updateData, assetUpdates);
    transaction.update(userRef, updateData);

    // 6. 在同一 Transaction 內創建交易記錄
    // ✅ P1-3 修復：統一使用絕對值存儲 amount
    createTransactionInTx(transaction, {
      userId,
      type: TRANSACTION_TYPES.SPEND,
      amount: totalPrice, // 使用絕對值
      description: `批量購買: ${itemsSummary}`,
      metadata: {
        items: purchaseDetails,
      },
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    });

    logger.info(
      `[資產購買] 批量購買 Transaction 成功: userId=${userId}, itemCount=${items.length}, ` +
      `totalPrice=${totalPrice}, balance: ${currentBalance} → ${newBalance}`
    );

    // 返回購買結果
    return {
      success: true,
      items: assetResults,
      totalPrice,
      coinsSpent: totalPrice,
      newBalance,
      previousBalance: currentBalance,
    };
  });

  // ✅ Transaction 成功後，異步記錄所有資產的審計日誌（失敗不影響主流程）
  for (const assetResult of result.items) {
    try {
      await logAssetChange({
        userId,
        assetType: assetResult.assetKey,
        action: "add",
        amount: assetResult.quantity,
        previousQuantity: assetResult.previousQuantity,
        newQuantity: assetResult.newQuantity,
        reason: `批量購買 ${assetResult.assetName}`,
        metadata: {
          assetId: assetResult.assetId,
          unitPrice: purchaseDetails.find(d => d.assetId === assetResult.assetId)?.unitPrice,
          totalPrice: purchaseDetails.find(d => d.assetId === assetResult.assetId)?.totalPrice,
        },
      });
    } catch (error) {
      logger.warn(`[資產購買] 審計日誌記錄失敗（不影響購買）: ${error.message}`);
    }
  }

  return result;
};
