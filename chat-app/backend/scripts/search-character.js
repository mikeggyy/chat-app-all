#!/usr/bin/env node

/**
 * 搜尋角色
 * 用法：node scripts/search-character.js [關鍵字]
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

const keyword = process.argv[2] || "艾米莉雅";

(async () => {
  try {
    console.log(`正在搜尋包含「${keyword}」的角色...\n`);

    const db = getFirestoreDb();
    const charactersSnapshot = await db.collection("characters").get();

    let found = 0;

    charactersSnapshot.forEach((doc) => {
      const data = doc.data();
      const displayName = data.display_name || data.displayName || "";

      if (displayName.includes(keyword)) {
        found++;
        console.log(`${found}. ${doc.id}`);
        console.log(`   名稱: ${displayName}`);
        console.log(`   創建者: ${data.creatorUid || '(無)'}`);
        console.log(`   創建者名稱: ${data.creatorDisplayName || '(無)'}`);
        console.log(`   狀態: ${data.status || 'active'}`);
        console.log(`   公開: ${data.isPublic !== false ? '是' : '否'}`);
        console.log(`   喜歡數: ${data.totalFavorites || 0}`);
        console.log(`   聊天數: ${data.totalChatUsers || 0}`);
        console.log();
      }
    });

    if (found === 0) {
      console.log("❌ 沒有找到匹配的角色");
    } else {
      console.log(`✅ 找到 ${found} 個匹配的角色`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ 錯誤:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
