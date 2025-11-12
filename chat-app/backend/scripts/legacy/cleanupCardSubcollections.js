#!/usr/bin/env node

/**
 * 清理子集合中的卡片文檔
 *
 * 由於卡片類資產已統一到主文檔，子集合中的卡片文檔不再需要
 * 此腳本會刪除這些冗余文檔，但保留禮物文檔
 *
 * ⚠️ 警告：此操作不可逆，請先備份數據！
 *
 * 使用方法：
 * node cleanupCardSubcollections.js [--dry-run] [--limit=10]
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import logger from "../src/utils/logger.js";

const USERS_COLLECTION = "users";
const ASSETS_SUBCOLLECTION = "assets";

// 要刪除的卡片文檔 ID（不包括禮物）
const CARD_DOCUMENT_IDS = [
  "createCards",
  "characterUnlockCard",
  "photoUnlockCard",
  "videoUnlockCard",
  "voiceUnlockCard",
];

// 解析命令行參數
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const limitMatch = args.find((arg) => arg.startsWith("--limit="));
const limit = limitMatch ? parseInt(limitMatch.split("=")[1]) : null;

/**
 * 清理單個用戶的卡片子集合
 */
async function cleanupUserCardAssets(userDoc) {
  const userId = userDoc.id;
  const db = getFirestoreDb();

  // 獲取子集合中的所有文檔
  const assetsSnapshot = await db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(ASSETS_SUBCOLLECTION)
    .get();

  if (assetsSnapshot.empty) {
    logger.info(`⏭️  跳過用戶 ${userId}: 子集合為空`);
    return { skipped: true, reason: "子集合為空" };
  }

  // 找出需要刪除的卡片文檔
  const cardDocsToDelete = [];
  const giftDocsCount = [];

  assetsSnapshot.forEach(doc => {
    if (CARD_DOCUMENT_IDS.includes(doc.id)) {
      cardDocsToDelete.push({
        id: doc.id,
        data: doc.data()
      });
    } else if (doc.id.startsWith('gift_')) {
      giftDocsCount.push(doc.id);
    }
  });

  if (cardDocsToDelete.length === 0) {
    logger.info(`⏭️  跳過用戶 ${userId}: 無卡片文檔需要刪除 (禮物: ${giftDocsCount.length})`);
    return { skipped: true, reason: "無卡片文檔" };
  }

  logger.info(`📦 準備清理用戶 ${userId}`);
  logger.info(`   子集合文檔總數: ${assetsSnapshot.size}`);
  logger.info(`   卡片文檔（將刪除）: ${cardDocsToDelete.length}`);
  logger.info(`   禮物文檔（保留）: ${giftDocsCount.length}`);

  cardDocsToDelete.forEach(doc => {
    logger.info(`   - ${doc.id}: quantity=${doc.data.quantity || 0}`);
  });

  if (isDryRun) {
    logger.info(`   [DRY RUN] 將會刪除以上 ${cardDocsToDelete.length} 個卡片文檔`);
    return { cleaned: false, dryRun: true, count: cardDocsToDelete.length };
  }

  try {
    // 批量刪除卡片文檔
    const batch = db.batch();

    for (const doc of cardDocsToDelete) {
      const docRef = db
        .collection(USERS_COLLECTION)
        .doc(userId)
        .collection(ASSETS_SUBCOLLECTION)
        .doc(doc.id);

      batch.delete(docRef);
    }

    await batch.commit();

    logger.info(`   ✅ 清理完成: 刪除了 ${cardDocsToDelete.length} 個卡片文檔`);
    return { cleaned: true, count: cardDocsToDelete.length };
  } catch (error) {
    logger.error(`   ❌ 清理失敗: ${userId}`, error);
    return { cleaned: false, error: error.message };
  }
}

/**
 * 主清理函數
 */
async function cleanupAllUsers() {
  logger.info("=".repeat(60));
  logger.info("🧹 開始清理卡片子集合文檔");
  logger.info("=".repeat(60));

  if (isDryRun) {
    logger.warn("⚠️  DRY RUN 模式 - 不會實際刪除數據");
  } else {
    logger.warn("⚠️  警告：此操作將永久刪除卡片文檔！");
    logger.warn("   建議先運行 --dry-run 模式檢查");
  }

  if (limit) {
    logger.info(`📊 限制清理數量: ${limit}`);
  }

  const db = getFirestoreDb();
  let query = db.collection(USERS_COLLECTION);

  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  const totalUsers = snapshot.size;

  logger.info(`📊 找到 ${totalUsers} 個用戶`);
  logger.info("");

  const stats = {
    total: totalUsers,
    cleaned: 0,
    skipped: 0,
    failed: 0,
    totalDocsDeleted: 0,
  };

  for (const doc of snapshot.docs) {
    const result = await cleanupUserCardAssets(doc);

    if (result.cleaned) {
      stats.cleaned++;
      stats.totalDocsDeleted += result.count || 0;
    } else if (result.skipped) {
      stats.skipped++;
    } else {
      stats.failed++;
    }
  }

  logger.info("");
  logger.info("=".repeat(60));
  logger.info("✅ 清理完成");
  logger.info("=".repeat(60));
  logger.info(`總用戶數: ${stats.total}`);
  logger.info(`已清理: ${stats.cleaned}`);
  logger.info(`已跳過: ${stats.skipped}`);
  logger.info(`失敗: ${stats.failed}`);
  logger.info(`刪除的卡片文檔總數: ${stats.totalDocsDeleted}`);

  if (isDryRun) {
    logger.warn("");
    logger.warn("⚠️  這是 DRY RUN，沒有實際刪除數據");
    logger.warn("   移除 --dry-run 參數以執行實際清理");
  }

  return stats;
}

/**
 * 驗證清理結果
 */
async function verifyCleanupResults() {
  logger.info("");
  logger.info("=".repeat(60));
  logger.info("🔍 驗證清理結果");
  logger.info("=".repeat(60));

  const db = getFirestoreDb();
  const snapshot = await db.collection(USERS_COLLECTION).limit(5).get();

  for (const doc of snapshot.docs) {
    const userId = doc.id;

    logger.info(`用戶 ${userId}:`);

    // 讀取子集合
    const assetsSnapshot = await db
      .collection(USERS_COLLECTION)
      .doc(userId)
      .collection(ASSETS_SUBCOLLECTION)
      .get();

    if (assetsSnapshot.empty) {
      logger.info(`  子集合: 空（或僅有禮物）`);
    } else {
      logger.info(`  子集合剩餘文檔: ${assetsSnapshot.size}`);
      assetsSnapshot.forEach(assetDoc => {
        if (CARD_DOCUMENT_IDS.includes(assetDoc.id)) {
          logger.warn(`  ⚠️  警告: 仍存在卡片文檔 ${assetDoc.id}`);
        } else if (assetDoc.id.startsWith('gift_')) {
          logger.info(`  ✅ 禮物文檔保留: ${assetDoc.id}`);
        }
      });
    }
    logger.info("");
  }
}

// 執行清理
(async () => {
  try {
    const stats = await cleanupAllUsers();

    // 如果不是 dry run，執行驗證
    if (!isDryRun && stats.cleaned > 0) {
      await verifyCleanupResults();
    }

    process.exit(0);
  } catch (error) {
    logger.error("❌ 清理過程發生錯誤:", error);
    process.exit(1);
  }
})();
