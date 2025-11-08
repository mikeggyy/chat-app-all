/**
 * 檢查用戶影片卡數據
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getUserById } from "../src/user/user.service.js";

const userId = process.argv[2] || "PS7LYFSstdgyr7b9sCOKFgt3QVB3";

async function checkUserVideoCards() {
  console.log("========================================");
  console.log("🔍 檢查用戶影片卡數據");
  console.log("========================================\n");

  try {
    console.log(`用戶 ID: ${userId}\n`);

    // 獲取用戶完整數據
    const user = await getUserById(userId);

    console.log("用戶基本信息:");
    console.log(`  displayName: ${user.displayName || "無"}`);
    console.log(`  email: ${user.email || "無"}`);
    console.log(`  membershipTier: ${user.membershipTier || "無"}\n`);

    console.log("unlockTickets 完整數據:");
    console.log(JSON.stringify(user.unlockTickets, null, 2));
    console.log("");

    if (user.unlockTickets) {
      console.log("unlockTickets 欄位:");
      console.log(`  characterUnlockTickets: ${user.unlockTickets.characterUnlockTickets || 0}`);
      console.log(`  photoUnlockCards: ${user.unlockTickets.photoUnlockCards || 0}`);
      console.log(`  videoUnlockCards: ${user.unlockTickets.videoUnlockCards || 0}`);
    } else {
      console.log("⚠️  unlockTickets 欄位不存在");
    }

    console.log("\n========================================");
    console.log("✅ 檢查完成");
    console.log("========================================");

  } catch (error) {
    console.error("\n❌ 檢查失敗:", error);
    process.exit(1);
  }

  process.exit(0);
}

checkUserVideoCards().catch(console.error);
