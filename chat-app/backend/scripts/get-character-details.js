#!/usr/bin/env node

/**
 * 獲取角色詳細信息
 * 用法：node scripts/get-character-details.js [characterId]
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import { getCharacterById, getCacheStats, initializeCharactersCache } from "../src/services/character/characterCache.service.js";

const characterId = process.argv[2];

if (!characterId) {
  console.error("❌ 請提供角色 ID");
  console.log("用法: node scripts/get-character-details.js [characterId]");
  process.exit(1);
}

(async () => {
  try {
    // 初始化 cache
    console.log("正在初始化 characters cache...\n");
    await initializeCharactersCache();

    console.log(`正在查詢角色: ${characterId}\n`);

    // 1. 檢查 cache
    console.log("=== Cache 查詢 ===");
    const cachedChar = getCharacterById(characterId);
    if (cachedChar) {
      console.log("✅ 在 cache 中找到");
      console.log(`   名稱: ${cachedChar.display_name || cachedChar.displayName || '(無)'}`);
      console.log(`   創建者: ${cachedChar.creatorDisplayName || '(無)'}`);
    } else {
      console.log("❌ cache 中沒有此角色");
    }

    // 2. 檢查 Firestore
    console.log("\n=== Firestore 查詢 ===");
    const db = getFirestoreDb();
    const doc = await db.collection("characters").doc(characterId).get();

    if (doc.exists) {
      console.log("✅ 在 Firestore 中找到");
      const data = doc.data();
      console.log(JSON.stringify({ id: doc.id, ...data }, null, 2));
    } else {
      console.log("❌ Firestore 中沒有此角色");
    }

    // 3. Cache 統計
    console.log("\n=== Cache 統計 ===");
    const stats = getCacheStats();
    console.log(JSON.stringify(stats, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("❌ 錯誤:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
