import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

import { getFirestoreDb } from "../src/firebase/index.js";

const userId = process.argv[2] || 'PS7LYFSstdgyr7b9sCOKFgt3QVB3';

const db = getFirestoreDb();
const doc = await db.collection('users').doc(userId).get();

if (!doc.exists) {
  console.log(`用戶 ${userId} 不存在`);
  process.exit(1);
}

const data = doc.data();

console.log('\n========== 用戶資產驗證 ==========\n');
console.log('用戶 ID:', userId);
console.log('\n📦 Assets (新位置):');
console.log(JSON.stringify(data.assets, null, 2));

console.log('\n📋 UnlockTickets (過渡位置):');
if (data.unlockTickets) {
  const keys = Object.keys(data.unlockTickets);
  console.log('包含的鍵:', keys.join(', '));

  // 檢查是否有資產數值欄位
  const assetFields = ['characterUnlockCards', 'photoUnlockCards', 'videoUnlockCards', 'voiceUnlockCards', 'createCards'];
  const hasAssetValues = assetFields.some(field => typeof data.unlockTickets[field] === 'number');

  if (hasAssetValues) {
    console.log('⚠️  仍包含資產數值欄位:');
    assetFields.forEach(field => {
      if (typeof data.unlockTickets[field] === 'number') {
        console.log(`  - ${field}: ${data.unlockTickets[field]}`);
      }
    });
  }

  if (data.unlockTickets.usageHistory) {
    console.log(`✅ 包含 usageHistory (${data.unlockTickets.usageHistory.length} 條記錄)`);
  }
} else {
  console.log('無');
}

console.log('\n📝 頂層欄位 (舊位置):');
const topLevelAssets = ['characterUnlockCards', 'photoUnlockCards', 'videoUnlockCards', 'voiceUnlockCards', 'createCards'];
const hasTopLevel = topLevelAssets.some(field => typeof data[field] === 'number');
if (hasTopLevel) {
  console.log('⚠️  仍有頂層資產欄位:');
  topLevelAssets.forEach(field => {
    if (typeof data[field] === 'number') {
      console.log(`  - ${field}: ${data[field]}`);
    }
  });
} else {
  console.log('✅ 無頂層資產欄位');
}

console.log('\n========================================\n');

process.exit(0);
