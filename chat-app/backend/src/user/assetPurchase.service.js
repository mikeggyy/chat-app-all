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
  const category = packageConfig.category;

  // 如果沒有 assetType但有 baseId（藥水），則判斷是藥水類型
  if (!assetType && packageConfig.baseId) {
    // 藥水商品，使用藥水購買服務
    logger.info(`[資產購買] 檢測到藥水商品，轉發到藥水購買服務: ${sku}, quantity=${quantity}, price=${price}`);

    // 動態導入藥水購買服務
    const potionService = await import("../payment/potion.service.js");

    // 根據 baseId 判斷藥水類型，傳遞正確的數量和價格
    if (packageConfig.baseId === "memory_boost") {
      return await potionService.purchaseMemoryBoost(userId, {
        quantity,
        unitPrice: price
      });
    } else if (packageConfig.baseId === "brain_boost") {
      return await potionService.purchaseBrainBoost(userId, {
        quantity,
        unitPrice: price
      });
    } else {
      throw new Error(`未知的藥水類型: ${packageConfig.baseId}`);
    }
  }

  logger.info(
    `[資產購買] 開始購買: userId=${userId}, sku=${sku}, quantity=${quantity}, price=${price}, assetType=${assetType}, category=${category}`
  );

  // 檢查金幣餘額
  const user = await getUserById(userId);
  const balance = user?.walletBalance || 0;
  if (balance < price) {
    throw new Error(`金幣不足，需要 ${price} 金幣，當前餘額 ${balance} 金幣`);
  }

  // 1. 扣除金幣
  const deductResult = await deductCoins(
    userId,
    price,
    `購買${category} ${name}`,
    {
      sku,
      packageName: name,
      category,
      assetType,
      quantity,
      finalPrice: price,
    }
  );

  // 2. 增加資產（統一使用主文檔）
  // 轉換 assetType 格式：characterUnlockCard -> characterUnlockCards
  const assetTypeMapping = {
    characterUnlockCard: "characterUnlockCards",
    photoUnlockCard: "photoUnlockCards",
    videoUnlockCard: "videoUnlockCards",
    voiceUnlockCard: "voiceUnlockCards",
    createCards: "createCards",
  };

  const mainDocAssetType = assetTypeMapping[assetType] || assetType;
  const updatedAssets = await addUserAsset(
    userId,
    mainDocAssetType,
    quantity,
    `購買 ${name}`,
    { sku, packageName: name, category, price }
  );
  const newAssetQuantity = updatedAssets[mainDocAssetType] || 0;

  logger.info(
    `[資產購買] 購買成功: userId=${userId}, sku=${sku}, quantity=${quantity}, price=${price}, newBalance=${deductResult.newBalance}, newAssetQuantity=${newAssetQuantity}`
  );

  return {
    success: true,
    sku,
    packageName: name,
    category,
    assetType: mainDocAssetType,
    quantity,
    finalPrice: price,
    coinsSpent: price,
    newBalance: deductResult.newBalance,
    previousBalance: deductResult.previousBalance,
    assetQuantity: newAssetQuantity,
    previousAssetQuantity: newAssetQuantity - quantity, // 計算之前的數量
  };
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

  // 檢查金幣餘額
  const user = await getUserById(userId);
  const balance = user?.walletBalance || 0;
  if (balance < totalPrice) {
    throw new Error(`金幣不足，需要 ${totalPrice} 金幣，當前餘額 ${balance} 金幣`);
  }

  // 1. 扣除金幣
  const itemsSummary = purchaseDetails
    .map((d) => `${d.assetName} x${d.quantity}`)
    .join(", ");

  const deductResult = await deductCoins(
    userId,
    totalPrice,
    `批量購買: ${itemsSummary}`,
    {
      items: purchaseDetails,
    }
  );

  // 2. 增加所有資產（統一使用主文檔）
  const assetResults = [];
  for (const detail of purchaseDetails) {
    // detail.assetKey 已經是正確的格式（複數形式）
    const updatedAssets = await addUserAsset(
      userId,
      detail.assetKey,
      detail.quantity,
      `批量購買 ${detail.assetName}`,
      { assetId: detail.assetId, unitPrice: detail.unitPrice, totalPrice: detail.totalPrice }
    );
    const newQuantity = updatedAssets[detail.assetKey] || 0;

    assetResults.push({
      assetId: detail.assetId,
      assetName: detail.assetName,
      quantity: detail.quantity,
      newQuantity: newQuantity,
    });
  }

  logger.info(`[資產購買] 批量購買成功: userId=${userId}, itemCount=${items.length}, totalPrice=${totalPrice}, newBalance=${deductResult.newBalance}`);

  return {
    success: true,
    items: assetResults,
    totalPrice,
    coinsSpent: totalPrice,
    newBalance: deductResult.newBalance,
    previousBalance: deductResult.previousBalance,
  };
};
