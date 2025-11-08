/**
 * 導入資產套餐 SKU 到 Firestore
 *
 * 使用方式：
 * cd backend
 * node scripts/import-asset-packages.js
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import logger from "../src/utils/logger.js";
import { getAllPackages } from "../../shared/config/assetPackages.js";

async function importAssetPackages() {
  try {
    logger.info("========================================");
    logger.info("開始導入資產套餐 SKU 到 Firestore");
    logger.info("========================================");

    const db = getFirestoreDb();
    const packagesRef = db.collection("asset_packages");

    const packages = getAllPackages();

    logger.info(`準備導入 ${packages.length} 個套餐 SKU...`);

    for (const pkg of packages) {
      const docData = {
        sku: pkg.sku,
        assetType: pkg.assetType,
        category: pkg.category,
        name: pkg.name,
        quantity: pkg.quantity,
        basePrice: pkg.basePrice,
        discountRate: pkg.discountRate,
        finalPrice: pkg.finalPrice,
        popular: pkg.popular || false,
        badge: pkg.badge || null,
        status: "active", // active, disabled
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await packagesRef.doc(pkg.sku).set(docData, { merge: true });
      logger.info(
        `✓ 已導入套餐: ${pkg.name} - ${pkg.finalPrice} 金幣 (${pkg.sku})`
      );
    }

    logger.info("========================================");
    logger.info(`✅ 成功導入 ${packages.length} 個套餐 SKU`);
    logger.info("========================================");

    process.exit(0);
  } catch (error) {
    logger.error("導入失敗:", error);
    process.exit(1);
  }
}

// 執行導入
importAssetPackages();
