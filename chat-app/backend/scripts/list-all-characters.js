#!/usr/bin/env node

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

(async () => {
  try {
    const db = getFirestoreDb();
    const snapshot = await db.collection("characters").get();

    console.log(`共有 ${snapshot.size} 個角色:\n`);

    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. ${data.display_name || data.displayName || "(無名稱)"}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   創建者: ${data.creatorDisplayName || "(系統)"}`);
      console.log(`   狀態: ${data.status || "active"}`);
      console.log("");
    });

    process.exit(0);
  } catch (error) {
    console.error("錯誤:", error.message);
    process.exit(1);
  }
})();
