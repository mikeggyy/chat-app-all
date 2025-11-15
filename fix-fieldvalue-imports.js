/**
 * 批量修復 FieldValue 導入源
 * 將所有 `import { FieldValue } from "firebase-admin/firestore"`
 * 改為從統一源導入
 */

import fs from 'fs';
import path from 'path';

const filesToFix = [
  'chat-app/backend/src/user/userConversations.service.js',
  'chat-app/backend/src/utils/idempotency.js',
  'chat-app/backend/src/utils/errorLogger.service.js',
  'chat-app/backend/src/user/userAssets.service.js',
  'chat-app/backend/src/utils/firestoreHelpers.js',
  'chat-app/backend/src/user/user.service.js',
  'chat-app/backend/src/user/assetAuditLog.service.js',
  'chat-app/backend/src/user/user.routes.js',
  'chat-app/backend/src/user/assets.service.js',
  'chat-app/backend/src/ad/ad.service.js',
  'chat-app/backend/src/services/modelUsageMonitoring.service.js',
  'chat-app/backend/src/services/apiCostMonitoring.service.js',
  'chat-app/backend/src/membership/unlockTickets.service.js',
  'chat-app/backend/src/gift/gift.service.js',
  'chat-app/backend/src/photoAlbum/photoAlbum.service.js',
  'chat-app/backend/src/services/adWatchMonitor.service.js',
  'chat-app/backend/src/membership/membership.service.js',
  'chat-app/backend/src/payment/transaction.service.js',
  'chat-app/backend/src/payment/coins.service.js',
  'chat-app/backend/src/payment/potion.service.js',
  'chat-app/backend/src/payment/order.service.js',
];

let fixedCount = 0;
let errorCount = 0;

for (const relativePath of filesToFix) {
  const filePath = path.join(process.cwd(), relativePath);

  try {
    // 讀取文件內容
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;

    // 檢查是否有 getFirestoreDb 導入
    const hasGetFirestoreDb = /import\s+{[^}]*getFirestoreDb[^}]*}\s+from\s+["']\.\.\/firebase\/index\.js["']/.test(content);

    if (hasGetFirestoreDb) {
      // 情況 1: 已經有 getFirestoreDb 導入，添加 FieldValue
      content = content.replace(
        /import\s+{\s*getFirestoreDb\s*}\s+from\s+["']\.\.\/firebase\/index\.js["'];?\s*\nimport\s+{\s*FieldValue\s*}\s+from\s+["']firebase-admin\/firestore["'];?/,
        'import { getFirestoreDb, FieldValue } from "../firebase/index.js";'
      );

      // 或者順序相反
      content = content.replace(
        /import\s+{\s*FieldValue\s*}\s+from\s+["']firebase-admin\/firestore["'];?\s*\nimport\s+{\s*getFirestoreDb\s*}\s+from\s+["']\.\.\/firebase\/index\.js["'];?/,
        'import { getFirestoreDb, FieldValue } from "../firebase/index.js";'
      );

      // 如果上面的替換沒有成功，嘗試只替換 FieldValue 導入行
      if (content.includes('from "firebase-admin/firestore"') || content.includes("from 'firebase-admin/firestore'")) {
        // 先移除獨立的 FieldValue 導入
        content = content.replace(/import\s+{\s*FieldValue\s*}\s+from\s+["']firebase-admin\/firestore["'];?\n?/g, '');

        // 然後在 getFirestoreDb 導入中添加 FieldValue
        content = content.replace(
          /import\s+{\s*getFirestoreDb\s*}\s+from\s+["']\.\.\/firebase\/index\.js["'];?/,
          'import { getFirestoreDb, FieldValue } from "../firebase/index.js";'
        );
      }
    } else {
      // 情況 2: 沒有 getFirestoreDb 導入，只替換 FieldValue 源
      // 根據文件路徑深度計算正確的相對路徑
      const depth = (relativePath.match(/\//g) || []).length - 2; // 減去 chat-app/backend
      const relativeDots = '../'.repeat(depth);

      content = content.replace(
        /import\s+{\s*FieldValue\s*}\s+from\s+["']firebase-admin\/firestore["'];?/,
        `import { FieldValue } from "${relativeDots}firebase/index.js";`
      );
    }

    // 如果內容有變化，寫回文件
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ 已修復: ${relativePath}`);
      fixedCount++;
    } else {
      console.log(`⚠️  無變化: ${relativePath}`);
    }

  } catch (error) {
    console.error(`❌ 錯誤處理 ${relativePath}:`, error.message);
    errorCount++;
  }
}

console.log(`\n總結:`);
console.log(`✅ 成功修復: ${fixedCount} 個文件`);
console.log(`❌ 錯誤: ${errorCount} 個文件`);
console.log(`📝 總共處理: ${filesToFix.length} 個文件`);
