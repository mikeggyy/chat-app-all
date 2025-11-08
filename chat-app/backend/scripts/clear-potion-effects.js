/**
 * 清除用戶的藥水效果腳本
 * 使用方法：node scripts/clear-potion-effects.js <userId>
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

const db = getFirestoreDb();

async function clearPotionEffects(userId) {
  try {
    console.log(`\n開始清除用戶 ${userId} 的藥水效果...`);

    const usageLimitRef = db.collection("usage_limits").doc(userId);
    const doc = await usageLimitRef.get();

    if (!doc.exists) {
      console.log("❌ 找不到該用戶的 usage_limits 文檔");
      return;
    }

    const data = doc.data();
    const activePotionEffects = data.activePotionEffects || {};

    if (Object.keys(activePotionEffects).length === 0) {
      console.log("✅ 該用戶沒有激活的藥水效果");
      return;
    }

    console.log(`\n找到 ${Object.keys(activePotionEffects).length} 個藥水效果：`);
    for (const [effectId, effectData] of Object.entries(activePotionEffects)) {
      console.log(`  - ${effectId}: ${effectData.potionType} (角色: ${effectData.characterId})`);
    }

    // 清除所有藥水效果
    await usageLimitRef.update({
      activePotionEffects: {},
      updatedAt: new Date().toISOString(),
    });

    console.log(`\n✅ 成功清除所有藥水效果！`);
  } catch (error) {
    console.error("❌ 清除藥水效果失敗:", error);
    throw error;
  }
}

async function clearSpecificEffect(userId, effectId) {
  try {
    console.log(`\n開始清除用戶 ${userId} 的特定藥水效果 ${effectId}...`);

    const usageLimitRef = db.collection("usage_limits").doc(userId);
    const doc = await usageLimitRef.get();

    if (!doc.exists) {
      console.log("❌ 找不到該用戶的 usage_limits 文檔");
      return;
    }

    const data = doc.data();
    const activePotionEffects = data.activePotionEffects || {};

    if (!activePotionEffects[effectId]) {
      console.log(`❌ 找不到藥水效果 ${effectId}`);
      return;
    }

    console.log(`找到藥水效果: ${activePotionEffects[effectId].potionType}`);

    // 刪除特定效果
    delete activePotionEffects[effectId];

    await usageLimitRef.update({
      activePotionEffects,
      updatedAt: new Date().toISOString(),
    });

    console.log(`\n✅ 成功刪除藥水效果 ${effectId}！`);
  } catch (error) {
    console.error("❌ 刪除藥水效果失敗:", error);
    throw error;
  }
}

// 主程序
const userId = process.argv[2];
const effectId = process.argv[3];

if (!userId) {
  console.error("請提供用戶 ID");
  console.log("\n使用方法：");
  console.log("  清除所有藥水效果：node scripts/clear-potion-effects.js <userId>");
  console.log("  清除特定藥水效果：node scripts/clear-potion-effects.js <userId> <effectId>");
  console.log("\n範例：");
  console.log("  node scripts/clear-potion-effects.js 800");
  console.log("  node scripts/clear-potion-effects.js 800 memory_boost_match-001");
  process.exit(1);
}

if (effectId) {
  clearSpecificEffect(userId, effectId)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  clearPotionEffects(userId)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
