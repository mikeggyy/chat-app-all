/**
 * 導入禮物套餐 SKU 到 Firestore
 *
 * 使用方式：
 * cd backend
 * node scripts/import-gift-packages.js
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import logger from "../src/utils/logger.js";
import { getAllGiftPackages } from "../../shared/config/giftPackages.js";

async function importGiftPackages() {
  try {
    logger.info("========================================");
    logger.info("開始導入禮物套餐 SKU 到 Firestore");
    logger.info("========================================");

    const db = getFirestoreDb();
    const packagesRef = db.collection("asset_packages");

    const packages = getAllGiftPackages();

    logger.info(`準備導入 ${packages.length} 個禮物套餐 SKU...`);

    for (const pkg of packages) {
      const docData = {
        sku: pkg.sku,
        assetType: pkg.assetType,
        itemId: pkg.itemId,
        category: pkg.category,
        name: pkg.name,
        giftName: pkg.giftName,
        emoji: pkg.emoji,
        description: pkg.description,
        quantity: pkg.quantity,
        basePrice: pkg.basePrice,
        discountRate: pkg.discountRate,
        finalPrice: pkg.finalPrice,
        popular: pkg.popular || false,
        badge: pkg.badge || null,
        rarity: pkg.rarity,
        status: "active", // active, disabled
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await packagesRef.doc(pkg.sku).set(docData, { merge: true });
      logger.info(
        `✓ 已導入套餐: ${pkg.giftName} ${pkg.name} - ${pkg.finalPrice} 金幣 (${pkg.sku})`
      );
    }

    logger.info("========================================");
    logger.info(`✅ 成功導入 ${packages.length} 個禮物套餐 SKU`);
    logger.info("========================================");

    process.exit(0);
  } catch (error) {
    logger.error("導入失敗:", error);
    process.exit(1);
  }
}

// 執行導入
importGiftPackages();
