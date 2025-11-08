#!/usr/bin/env node

/**
 * 列出所有用戶
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

(async () => {
  try {
    console.log("環境配置:");
    console.log(`  USE_FIREBASE_EMULATOR: ${process.env.USE_FIREBASE_EMULATOR || 'false'}`);
    console.log(`  FIREBASE_ADMIN_PROJECT_ID: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
    console.log();

    const db = getFirestoreDb();
    const usersSnapshot = await db.collection("users").get();

    console.log(`找到 ${usersSnapshot.size} 個用戶:\n`);

    if (usersSnapshot.empty) {
      console.log("(沒有用戶數據)");
      process.exit(0);
    }

    usersSnapshot.forEach((doc, index) => {
      const userData = doc.data();
      const favorites = userData.favorites || [];
      const conversations = userData.conversations || [];

      console.log(`${index + 1}. ${doc.id}`);
      console.log(`   名稱: ${userData.displayName || '(無)'}`);
      console.log(`   Email: ${userData.email || '(無)'}`);
      console.log(`   收藏數: ${favorites.length}`);
      console.log(`   對話數: ${conversations.length}`);
      console.log();
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ 錯誤:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
