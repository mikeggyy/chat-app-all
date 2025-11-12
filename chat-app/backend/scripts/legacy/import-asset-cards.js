/**
 * 導入資產卡配置到 Firestore
 * 將 shared/config/assets.js 中的資產卡配置導入到 Firestore asset_cards collection
 *
 * 使用方式：
 * node scripts/import-asset-cards.js
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import { ASSET_CARDS_BASE_CONFIG } from "../../shared/config/assets.js";
import logger from "../src/utils/logger.js";

/**
 * 導入資產卡配置到 Firestore
 */
async function importAssetCards() {
  try {
    const db = getFirestoreDb();
    const assetCardsRef = db.collection("asset_cards");

    logger.info("開始導入資產卡配置...");

    const assetCards = Object.values(ASSET_CARDS_BASE_CONFIG);

    for (const card of assetCards) {
      const docData = {
        id: card.id,
        assetKey: card.assetKey,
        name: card.name,
        description: card.description,
        basePrice: card.basePrice,
        displayConfig: card.displayConfig,
        shopConfig: card.shopConfig,
        hasLimit: card.hasLimit || false,
        status: "active", // active, inactive
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 使用 card.id 作為文檔 ID
      await assetCardsRef.doc(card.id).set(docData, { merge: true });

      logger.info(`✓ 已導入資產卡: ${card.name} (${card.id})`);
    }

    logger.info(`\n成功導入 ${assetCards.length} 個資產卡配置！`);

    // 列出所有導入的資產卡
    logger.info("\n已導入的資產卡列表：");
    assetCards.forEach((card, index) => {
      logger.info(`${index + 1}. ${card.name} - ${card.basePrice} 金幣`);
    });

    process.exit(0);
  } catch (error) {
    logger.error("導入資產卡配置失敗:", error);
    process.exit(1);
  }
}

// 執行導入
importAssetCards();
