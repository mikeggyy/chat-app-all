#!/usr/bin/env node

/**
 * 檢查用戶收藏數據是否有重複
 * 用法：node scripts/check-user-favorites.js [userId]
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

const userId = process.argv[2] || "6FXftJp96WeXYqAO4vRYs52EFXN2";

(async () => {
  try {
    console.log(`正在檢查用戶 ${userId} 的收藏數據...`);

    const db = getFirestoreDb();
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      console.log("❌ 用戶不存在");
      process.exit(1);
    }

    const userData = userDoc.data();
    const favorites = userData.favorites || [];

    console.log("\n收藏統計:");
    console.log(`  總數: ${favorites.length}`);

    // 檢查重複
    const seen = new Set();
    const duplicates = [];
    const duplicateMap = new Map();

    favorites.forEach(id => {
      if (seen.has(id)) {
        duplicates.push(id);
        duplicateMap.set(id, (duplicateMap.get(id) || 1) + 1);
      }
      seen.add(id);
    });

    if (duplicates.length > 0) {
      console.log("\n❌ 發現重複的收藏:");
      duplicateMap.forEach((count, id) => {
        console.log(`  - ${id} (出現 ${count + 1} 次)`);
      });
    } else {
      console.log("\n✅ 沒有重複的收藏");
    }

    console.log(`  去重後數量: ${seen.size}`);

    console.log("\n收藏列表:");
    favorites.forEach((id, index) => {
      const isDuplicate = duplicates.includes(id);
      console.log(`  ${index + 1}. ${id}${isDuplicate ? " ⚠️ 重複" : ""}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ 錯誤:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
