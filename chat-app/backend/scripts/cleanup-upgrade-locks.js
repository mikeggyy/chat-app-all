/**
 * 清理過期的會員升級鎖定 - 定時任務腳本
 *
 * 用途：
 * 1. Cloud Scheduler 定時執行（每 5 分鐘）
 * 2. 手動執行清理任務
 *
 * 使用方式：
 * ```bash
 * # 使用默認設置（清理超過 5 分鐘的鎖定）
 * node scripts/cleanup-upgrade-locks.js
 *
 * # 指定清理閾值（10 分鐘）
 * node scripts/cleanup-upgrade-locks.js --max-age=10
 *
 * # 僅查看鎖定狀態，不執行清理
 * node scripts/cleanup-upgrade-locks.js --dry-run
 * ```
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

import {
  cleanupStaleUpgradeLocks,
  getLockedUsers,
} from "../src/services/membershipLockCleanup.service.js";
import logger from "../src/utils/logger.js";

// 解析命令行參數
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const maxAgeArg = args.find((arg) => arg.startsWith("--max-age="));
const maxAgeMinutes = maxAgeArg ? parseInt(maxAgeArg.split("=")[1], 10) : 5;

console.log("========================================");
console.log("會員升級鎖定清理任務");
console.log("========================================\n");

console.log(`模式: ${isDryRun ? "🔍 僅查看 (不執行清理)" : "🔧 執行清理"}`);
console.log(`清理閾值: ${maxAgeMinutes} 分鐘\n`);

async function main() {
  try {
    if (isDryRun) {
      // Dry-run 模式：僅查看鎖定狀態
      console.log("📋 查詢所有有升級鎖定的用戶...\n");

      const lockedUsers = await getLockedUsers();

      if (lockedUsers.length === 0) {
        console.log("✅ 沒有發現任何升級鎖定\n");
        return;
      }

      console.log(`找到 ${lockedUsers.length} 個有升級鎖定的用戶：\n`);

      lockedUsers.forEach((user) => {
        const status = user.isStale ? "⚠️ 已過期" : "✓ 正常";
        const ageStr = user.lockAgeMinutes !== null ? `${user.lockAgeMinutes} 分鐘` : "未知";

        console.log(`  ${status} 用戶: ${user.userId}`);
        console.log(`     鎖定時長: ${ageStr}`);
        console.log(`     鎖定時間: ${user.upgradingAt}\n`);
      });

      const staleCount = lockedUsers.filter((u) => u.isStale).length;
      if (staleCount > 0) {
        console.log(`⚠️  有 ${staleCount} 個過期鎖定需要清理`);
        console.log(
          `\n提示：執行 'node scripts/cleanup-upgrade-locks.js' 來清理這些鎖定\n`
        );
      }
    } else {
      // 執行清理
      console.log("🔧 開始執行清理任務...\n");

      const result = await cleanupStaleUpgradeLocks(maxAgeMinutes);

      console.log("\n========================================");
      console.log("清理結果統計");
      console.log("========================================\n");

      console.log(`掃描用戶數: ${result.scanned}`);
      console.log(`清理成功數: ${result.cleaned}`);
      console.log(`清理失敗數: ${result.errors}\n`);

      if (result.cleanedUsers.length > 0) {
        console.log("已清理的用戶：");
        result.cleanedUsers.forEach(({ userId, reason }) => {
          console.log(`  ✅ ${userId} (原因: ${reason})`);
        });
        console.log("");
      }

      if (result.cleaned === 0 && result.errors === 0) {
        console.log("✅ 沒有需要清理的鎖定\n");
      } else if (result.errors > 0) {
        console.log(`⚠️  有 ${result.errors} 個清理失敗，請檢查日誌\n`);
        process.exit(1);
      } else {
        console.log(`✅ 成功清理 ${result.cleaned} 個過期鎖定\n`);
      }
    }

    console.log("========================================");
    console.log("任務完成");
    console.log("========================================\n");

    process.exit(0);
  } catch (error) {
    logger.error("[清理任務] 執行失敗:", error);
    console.error("\n❌ 清理任務執行失敗:", error.message);
    console.error("\n詳細錯誤信息:", error);
    process.exit(1);
  }
}

main();
