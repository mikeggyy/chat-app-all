#!/usr/bin/env node

/**
 * 用戶資產同步腳本
 *
 * 將子集合中的卡片資產同步到主文檔 users/{userId}/assets
 * 解決前後台資產顯示不一致的問題
 *
 * 同步邏輯：
 * - 主文檔的 assets 優先（作為唯一真實來源）
 * - 如果子集合的值大於主文檔，以主文檔為準
 * - 同步後保持主文檔和子集合一致
 *
 * 使用方法：
 * node syncUserAssets.js [--dry-run] [--limit=10]
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import logger from "../src/utils/logger.js";

const USERS_COLLECTION = "users";
const ASSETS_SUBCOLLECTION = "assets";

// 卡片類型映射（子集合文檔 ID -> 主文檔字段名）
const CARD_TYPES = {
  createCards: 'createCards',
  characterUnlockCard: 'characterUnlockCards',
  photoUnlockCard: 'photoUnlockCards',
  videoUnlockCard: 'videoUnlockCards',
  voiceUnlockCard: 'voiceUnlockCards',
};

// 解析命令行參數
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const limitMatch = args.find((arg) => arg.startsWith("--limit="));
const limit = limitMatch ? parseInt(limitMatch.split("=")[1]) : null;

/**
 * 同步單個用戶的資產
 */
async function syncUserAssets(userDoc) {
  const userId = userDoc.id;
  const userData = userDoc.data();
  const db = getFirestoreDb();

  // 獲取主文檔的 assets
  const mainAssets = userData.assets || {};

  // 獲取子集合的資產
  const subcollectionSnapshot = await db
    .collection(USERS_COLLECTION)
    .doc(userId)
    .collection(ASSETS_SUBCOLLECTION)
    .get();

  const subcollectionAssets = {};
  subcollectionSnapshot.forEach(doc => {
    const data = doc.data();
    if (CARD_TYPES[doc.id]) {
      subcollectionAssets[doc.id] = data.quantity || 0;
    }
  });

  // 檢查是否需要同步
  let needsSync = false;
  const updates = {};

  for (const [subcollectionId, mainFieldName] of Object.entries(CARD_TYPES)) {
    const mainValue = mainAssets[mainFieldName] || 0;
    const subcollectionValue = subcollectionAssets[subcollectionId] || 0;

    if (mainValue !== subcollectionValue) {
      needsSync = true;
      updates[subcollectionId] = {
        main: mainValue,
        subcollection: subcollectionValue,
        action: mainValue > 0 ? '同步到子集合' : '子集合歸零',
      };
    }
  }

  if (!needsSync) {
    logger.info(`⏭️  跳過用戶 ${userId}: 資產已同步`);
    return { skipped: true };
  }

  logger.info(`📦 準備同步用戶 ${userId}`);
  Object.entries(updates).forEach(([subcollectionId, info]) => {
    logger.info(`   ${CARD_TYPES[subcollectionId]}: 主文檔=${info.main}, 子集合=${info.subcollection} (${info.action})`);
  });

  if (isDryRun) {
    logger.info(`   [DRY RUN] 將會同步以上資產`);
    return { synced: false, dryRun: true, updates };
  }

  try {
    // 同步到子集合
    const batch = db.batch();

    for (const [subcollectionId, info] of Object.entries(updates)) {
      const assetRef = db
        .collection(USERS_COLLECTION)
        .doc(userId)
        .collection(ASSETS_SUBCOLLECTION)
        .doc(subcollectionId);

      // 如果主文檔有值，更新子集合；否則設為 0
      batch.set(assetRef, {
        type: subcollectionId,
        quantity: info.main,
        updatedAt: new Date(),
        createdAt: new Date(), // 如果不存在會創建
      }, { merge: true });
    }

    await batch.commit();

    logger.info(`   ✅ 同步完成`);
    return { synced: true, updates };
  } catch (error) {
    logger.error(`   ❌ 同步失敗: ${userId}`, error);
    return { synced: false, error: error.message };
  }
}

/**
 * 主同步函數
 */
async function syncAllUsers() {
  logger.info("=".repeat(60));
  logger.info("🚀 開始同步用戶資產");
  logger.info("=".repeat(60));

  if (isDryRun) {
    logger.warn("⚠️  DRY RUN 模式 - 不會實際修改數據");
  }

  if (limit) {
    logger.info(`📊 限制同步數量: ${limit}`);
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
    synced: 0,
    skipped: 0,
    failed: 0,
  };

  for (const doc of snapshot.docs) {
    const result = await syncUserAssets(doc);

    if (result.synced) {
      stats.synced++;
    } else if (result.skipped) {
      stats.skipped++;
    } else {
      stats.failed++;
    }
  }

  logger.info("");
  logger.info("=".repeat(60));
  logger.info("✅ 同步完成");
  logger.info("=".repeat(60));
  logger.info(`總用戶數: ${stats.total}`);
  logger.info(`已同步: ${stats.synced}`);
  logger.info(`已跳過: ${stats.skipped}`);
  logger.info(`失敗: ${stats.failed}`);

  if (isDryRun) {
    logger.warn("");
    logger.warn("⚠️  這是 DRY RUN，沒有實際修改數據");
    logger.warn("   移除 --dry-run 參數以執行實際同步");
  }

  return stats;
}

/**
 * 驗證同步結果
 */
async function verifySyncResults() {
  logger.info("");
  logger.info("=".repeat(60));
  logger.info("🔍 驗證同步結果");
  logger.info("=".repeat(60));

  const db = getFirestoreDb();
  const snapshot = await db.collection(USERS_COLLECTION).limit(5).get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const userId = doc.id;

    logger.info(`用戶 ${userId}:`);
    logger.info(`  主文檔 assets:`);
    logger.info(`    - createCards: ${data.assets?.createCards || 0}`);
    logger.info(`    - characterUnlockCards: ${data.assets?.characterUnlockCards || 0}`);
    logger.info(`    - photoUnlockCards: ${data.assets?.photoUnlockCards || 0}`);

    // 讀取子集合
    const assetsSnapshot = await db
      .collection(USERS_COLLECTION)
      .doc(userId)
      .collection(ASSETS_SUBCOLLECTION)
      .get();

    logger.info(`  子集合 assets:`);
    assetsSnapshot.forEach(assetDoc => {
      if (CARD_TYPES[assetDoc.id]) {
        const assetData = assetDoc.data();
        logger.info(`    - ${assetDoc.id}: ${assetData.quantity || 0}`);
      }
    });
    logger.info("");
  }
}

// 執行同步
(async () => {
  try {
    const stats = await syncAllUsers();

    // 如果不是 dry run，執行驗證
    if (!isDryRun && stats.synced > 0) {
      await verifySyncResults();
    }

    process.exit(0);
  } catch (error) {
    logger.error("❌ 同步過程發生錯誤:", error);
    process.exit(1);
  }
})();
