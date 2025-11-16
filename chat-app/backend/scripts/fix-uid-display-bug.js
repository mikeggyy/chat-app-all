/**
 * 修復 UID 顯示 bug
 *
 * 問題：前端顯示 "ZiSriundefined語undefinedundefined" 而不是實際的 Firebase UID
 *
 * 此腳本會：
 * 1. 檢查所有用戶的 uid 欄位
 * 2. 列出有問題的 uid（包含 "undefined" 字符串）
 * 3. 修復 uid 為正確的 Firebase UID (等於 id 欄位)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加載環境變數
dotenv.config({ path: path.join(__dirname, '../.env') });

import { getFirestoreDb } from '../src/firebase/index.js';
import logger from '../src/utils/logger.js';

const db = getFirestoreDb();

async function checkAndFixUidFields() {
  logger.info('開始檢查所有用戶的 uid 欄位...');

  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  logger.info(`找到 ${snapshot.size} 個用戶`);

  const problematicUsers = [];
  const fixes = [];

  snapshot.forEach(doc => {
    const userData = doc.data();
    const userId = doc.id;
    const currentUid = userData.uid;

    // 檢查 uid 是否有問題
    const hasUndefined = currentUid && typeof currentUid === 'string' && currentUid.includes('undefined');
    const isEmpty = !currentUid || currentUid === '未設定帳號';
    const mismatch = currentUid && currentUid !== userId;

    if (hasUndefined || isEmpty || mismatch) {
      problematicUsers.push({
        id: userId,
        currentUid,
        issue: hasUndefined ? 'contains_undefined' : (isEmpty ? 'empty' : 'mismatch'),
        displayName: userData.displayName || '無名稱',
        email: userData.email || '無 Email'
      });

      // 準備修復
      fixes.push({
        id: userId,
        correctUid: userId
      });
    }
  });

  // 顯示問題
  if (problematicUsers.length === 0) {
    logger.info('✅ 沒有發現 uid 欄位問題');
    return;
  }

  logger.warn(`⚠️ 發現 ${problematicUsers.length} 個有問題的 uid 欄位：`);
  problematicUsers.forEach(user => {
    logger.warn(`  - ${user.displayName} (${user.email})`);
    logger.warn(`    ID: ${user.id}`);
    logger.warn(`    錯誤的 UID: ${user.currentUid}`);
    logger.warn(`    問題類型: ${user.issue}`);
    logger.warn('');
  });

  // 詢問是否修復
  logger.info('準備修復這些用戶的 uid 欄位...');

  // 執行修復
  const batch = db.batch();
  fixes.forEach(fix => {
    const userRef = usersRef.doc(fix.id);
    batch.update(userRef, {
      uid: fix.correctUid,
      updatedAt: new Date().toISOString()
    });
  });

  await batch.commit();
  logger.info(`✅ 已修復 ${fixes.length} 個用戶的 uid 欄位`);

  // 再次檢查
  logger.info('驗證修復結果...');
  const verifySnapshot = await usersRef.get();
  let stillHasIssues = false;

  verifySnapshot.forEach(doc => {
    const userData = doc.data();
    const userId = doc.id;
    const currentUid = userData.uid;

    if (currentUid && currentUid.includes('undefined')) {
      stillHasIssues = true;
      logger.error(`❌ 用戶 ${userId} 的 uid 仍然有問題: ${currentUid}`);
    }
  });

  if (!stillHasIssues) {
    logger.info('✅ 所有用戶的 uid 欄位已正確設置');
  }
}

// 執行
checkAndFixUidFields()
  .then(() => {
    logger.info('腳本執行完成');
    process.exit(0);
  })
  .catch(error => {
    logger.error('腳本執行失敗:', error);
    process.exit(1);
  });
