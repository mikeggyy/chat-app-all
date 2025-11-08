/**
 * 用戶錢包字段遷移腳本
 *
 * 清理冗餘字段：walletBalance 和 coins
 * 統一使用：wallet.balance
 *
 * 使用方法：
 * node migrate-user-wallet-fields.js [--dry-run] [--limit=10]
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import { checkWalletFormat, migrateUserWalletFormat } from "../src/user/walletHelpers.js";
import logger from "../src/utils/logger.js";

const USERS_COLLECTION = "users";

// 解析命令行參數
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const limitMatch = args.find((arg) => arg.startsWith("--limit="));
const limit = limitMatch ? parseInt(limitMatch.split("=")[1]) : null;

/**
 * 遷移單個用戶
 */
async function migrateUser(userDoc) {
  const userId = userDoc.id;
  const userData = userDoc.data();

  // 檢查是否需要遷移
  const check = checkWalletFormat(userData);

  if (!check.needsMigration) {
    logger.info(`⏭️  跳過用戶 ${userId}: ${check.reason}`);
    return { skipped: true, reason: check.reason };
  }

  logger.info(`📦 準備遷移用戶 ${userId}`);
  logger.info(`   舊格式: walletBalance=${userData.walletBalance}, coins=${userData.coins}, wallet.balance=${userData.wallet?.balance}`);

  // 執行遷移
  const migration = migrateUserWalletFormat(userData);

  if (isDryRun) {
    logger.info(`   [DRY RUN] 將會更新為:`);
    logger.info(`   新格式: wallet.balance=${migration.after.wallet.balance}`);
    return { migrated: false, dryRun: true, migration };
  }

  const db = getFirestoreDb();
  const userRef = db.collection(USERS_COLLECTION).doc(userId);

  try {
    // 更新用戶文檔，移除舊字段
    await userRef.update({
      wallet: migration.after.wallet,
      walletBalance: FieldValue.delete(),
      coins: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(`   ✅ 遷移完成: wallet.balance=${migration.after.wallet.balance}`);

    return { migrated: true, migration };
  } catch (error) {
    logger.error(`   ❌ 遷移失敗: ${userId}`, error);
    return { migrated: false, error: error.message };
  }
}

/**
 * 主遷移函數
 */
async function migrateAllUsers() {
  logger.info("=".repeat(60));
  logger.info("🚀 開始用戶錢包字段遷移");
  logger.info("=".repeat(60));

  if (isDryRun) {
    logger.warn("⚠️  DRY RUN 模式 - 不會實際修改數據");
  }

  if (limit) {
    logger.info(`📊 限制遷移數量: ${limit}`);
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
    migrated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const doc of snapshot.docs) {
    const result = await migrateUser(doc);

    if (result.migrated) {
      stats.migrated++;
    } else if (result.skipped) {
      stats.skipped++;
    } else {
      stats.failed++;
    }
  }

  logger.info("");
  logger.info("=".repeat(60));
  logger.info("✅ 遷移完成");
  logger.info("=".repeat(60));
  logger.info(`總用戶數: ${stats.total}`);
  logger.info(`已遷移: ${stats.migrated}`);
  logger.info(`已跳過: ${stats.skipped}`);
  logger.info(`失敗: ${stats.failed}`);

  if (isDryRun) {
    logger.warn("");
    logger.warn("⚠️  這是 DRY RUN，沒有實際修改數據");
    logger.warn("   移除 --dry-run 參數以執行實際遷移");
  }

  return stats;
}

/**
 * 驗證遷移結果
 */
async function verifyMigration() {
  logger.info("");
  logger.info("=".repeat(60));
  logger.info("🔍 驗證遷移結果");
  logger.info("=".repeat(60));

  const db = getFirestoreDb();
  const snapshot = await db.collection(USERS_COLLECTION).limit(5).get();

  for (const doc of snapshot.docs) {
    const data = doc.data();

    logger.info(`用戶 ${doc.id}:`);
    logger.info(`  - wallet.balance: ${data.wallet?.balance}`);
    logger.info(`  - walletBalance: ${data.walletBalance !== undefined ? data.walletBalance : "已移除"}`);
    logger.info(`  - coins: ${data.coins !== undefined ? data.coins : "已移除"}`);
  }
}

// 執行遷移
(async () => {
  try {
    const stats = await migrateAllUsers();

    // 如果不是 dry run，執行驗證
    if (!isDryRun && stats.migrated > 0) {
      await verifyMigration();
    }

    process.exit(0);
  } catch (error) {
    logger.error("❌ 遷移過程發生錯誤:", error);
    process.exit(1);
  }
})();
