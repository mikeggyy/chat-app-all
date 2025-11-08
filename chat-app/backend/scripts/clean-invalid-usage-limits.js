/**
 * 清理 usage_limits 集合中的無效鍵名
 *
 * 問題：某些文檔中包含錯誤的鍵名，如 "undefined", "null" 等
 * 正確的鍵名應該是：photos, voice, conversation
 *
 * 執行方式：
 * cd backend/scripts
 * node clean-invalid-usage-limits.js
 */

import "dotenv/config";
import "../src/setup-emulator.js"; // 使用 Emulator
import { getFirestoreDb } from "../src/firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";

// 定義有效的頂層鍵名（排除 Firestore 元數據）
const VALID_KEYS = new Set([
  'userId',
  'photos',
  'voice',
  'conversation',
  'createdAt',
  'updatedAt'
]);

// 定義有效的角色 ID 格式（match-001, match-002 等）
const VALID_CHARACTER_ID_PATTERN = /^match-\d{3}$/;

async function cleanInvalidUsageLimits() {
  console.log("🧹 開始清理 usage_limits 集合中的無效鍵名...\n");

  try {
    const db = getFirestoreDb();
    const usageLimitsRef = db.collection('usage_limits');
    const snapshot = await usageLimitsRef.get();

    if (snapshot.empty) {
      console.log("⚠️  usage_limits 集合為空，無需清理");
      process.exit(0);
    }

    console.log(`📊 找到 ${snapshot.size} 個用戶文檔\n`);

    let totalCleaned = 0;
    let documentsAffected = 0;

    for (const doc of snapshot.docs) {
      const userId = doc.id;
      const data = doc.data();

      console.log(`\n檢查用戶: ${userId}`);

      // 檢查頂層無效鍵名
      const invalidTopKeys = Object.keys(data).filter(key => !VALID_KEYS.has(key));

      if (invalidTopKeys.length > 0) {
        console.log(`  ❌ 發現無效的頂層鍵名: ${invalidTopKeys.join(', ')}`);

        // 準備更新數據（移除無效鍵名）
        const updates = {};
        invalidTopKeys.forEach(key => {
          updates[key] = FieldValue.delete(); // 使用 FieldValue.delete() 刪除欄位
          totalCleaned++;
        });

        await doc.ref.update(updates);
        documentsAffected++;
        console.log(`  ✅ 已移除無效鍵名`);
      }

      // 檢查 voice 和 conversation 中的無效角色 ID
      for (const fieldName of ['voice', 'conversation']) {
        if (data[fieldName] && typeof data[fieldName] === 'object') {
          const invalidCharacterIds = Object.keys(data[fieldName]).filter(
            charId => !VALID_CHARACTER_ID_PATTERN.test(charId) && charId !== 'undefined' && charId !== 'null'
          );

          // 特別檢查 "null" 和 "undefined" 字符串
          const nullishKeys = Object.keys(data[fieldName]).filter(
            charId => charId === 'null' || charId === 'undefined'
          );

          if (nullishKeys.length > 0 || invalidCharacterIds.length > 0) {
            const allInvalidKeys = [...new Set([...nullishKeys, ...invalidCharacterIds])];
            console.log(`  ❌ ${fieldName} 中發現無效的角色 ID: ${allInvalidKeys.join(', ')}`);

            // 準備更新數據（移除無效角色 ID）
            const updates = {};
            allInvalidKeys.forEach(key => {
              updates[`${fieldName}.${key}`] = FieldValue.delete();
              totalCleaned++;
            });

            await doc.ref.update(updates);
            documentsAffected++;
            console.log(`  ✅ 已移除 ${fieldName} 中的無效角色 ID`);
          }
        }
      }

      if (invalidTopKeys.length === 0 &&
          (!data.voice || Object.keys(data.voice).every(k => VALID_CHARACTER_ID_PATTERN.test(k))) &&
          (!data.conversation || Object.keys(data.conversation).every(k => VALID_CHARACTER_ID_PATTERN.test(k)))) {
        console.log(`  ✅ 數據結構正確，無需清理`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 清理完成！");
    console.log("=".repeat(60));
    console.log(`📊 統計資訊:`);
    console.log(`   - 總文檔數: ${snapshot.size}`);
    console.log(`   - 受影響的文檔: ${documentsAffected}`);
    console.log(`   - 清理的無效鍵: ${totalCleaned}`);
    console.log("\n💡 建議：打開 Firestore UI 驗證數據結構");
    console.log("   http://localhost:4101/firestore");

    process.exit(0);
  } catch (error) {
    console.error("❌ 清理失敗:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

cleanInvalidUsageLimits();
