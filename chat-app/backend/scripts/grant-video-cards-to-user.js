/**
 * 為指定用戶發放影片卡
 * 使用方式: node scripts/grant-video-cards-to-user.js <userId> <amount>
 * 範例: node scripts/grant-video-cards-to-user.js eU8gsMOZ5FPB8qCVcTwx9k1X8DW2 3
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { grantTickets } from "../src/membership/unlockTickets.service.js";
import { getTicketBalance } from "../src/membership/unlockTickets.service.js";
import { getUserById } from "../src/user/user.service.js";

const userId = process.argv[2];
const amount = parseInt(process.argv[3]) || 1;

if (!userId) {
  console.error("❌ 請提供用戶 ID");
  console.log("使用方式: node scripts/grant-video-cards-to-user.js <userId> <amount>");
  console.log("範例: node scripts/grant-video-cards-to-user.js eU8gsMOZ5FPB8qCVcTwx9k1X8DW2 3");
  process.exit(1);
}

async function grantVideoCardsToUser() {
  console.log("\n========================================");
  console.log("🎁 為用戶發放影片卡");
  console.log("========================================\n");

  try {
    // 1. 檢查用戶是否存在
    console.log(`1️⃣ 檢查用戶 ${userId}...\n`);
    const user = await getUserById(userId);

    if (!user) {
      console.error(`❌ 找不到用戶: ${userId}`);
      process.exit(1);
    }

    console.log(`✓ 用戶存在: ${user.displayName || user.email || userId}\n`);

    // 2. 查看當前餘額
    console.log("2️⃣ 查看當前影片卡餘額...\n");
    const beforeBalance = await getTicketBalance(userId);
    console.log(`當前影片卡: ${beforeBalance.videoUnlockCards} 張\n`);

    // 3. 發放影片卡
    console.log(`3️⃣ 發放 ${amount} 張影片卡...\n`);
    await grantTickets(userId, {
      videoUnlockCards: amount,
    });
    console.log("✓ 影片卡發放成功\n");

    // 4. 查看發放後餘額
    console.log("4️⃣ 查看發放後的影片卡餘額...\n");
    const afterBalance = await getTicketBalance(userId);
    console.log(`更新後影片卡: ${afterBalance.videoUnlockCards} 張\n`);

    console.log("========================================");
    console.log("✅ 發放完成！");
    console.log("========================================\n");

    console.log("📊 總結:");
    console.log(`  用戶: ${user.displayName || user.email || userId}`);
    console.log(`  發放前: ${beforeBalance.videoUnlockCards} 張`);
    console.log(`  發放數量: ${amount} 張`);
    console.log(`  發放後: ${afterBalance.videoUnlockCards} 張`);
    console.log("");

  } catch (error) {
    console.error("\n❌ 發放失敗:", error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// 執行
grantVideoCardsToUser();
