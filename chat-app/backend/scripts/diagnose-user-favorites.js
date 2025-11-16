/**
 * 診斷用戶收藏數據
 * 用於調試「喜歡」標籤顯示"收藏角色"的問題
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 載入環境變數
dotenv.config({ path: resolve(__dirname, '../.env') });

import { getFirestoreDb } from '../src/firebase/index.js';
import { getAllCharacters } from '../src/services/character/characterCache.service.js';
import logger from '../src/utils/logger.js';

const diagnoseUserFavorites = async (userId) => {
  console.log('='.repeat(60));
  console.log('診斷用戶收藏數據');
  console.log('='.repeat(60));
  console.log(`用戶 ID: ${userId}`);
  console.log('');

  try {
    const db = getFirestoreDb();

    // 1. 獲取用戶資料
    console.log('[1] 獲取用戶資料...');
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log('❌ 用戶不存在！');
      return;
    }

    const userData = userDoc.data();
    const favorites = Array.isArray(userData.favorites) ? userData.favorites : [];

    console.log(`✅ 找到用戶，收藏數量: ${favorites.length}`);
    console.log('收藏 ID 列表:', favorites);
    console.log('');

    if (favorites.length === 0) {
      console.log('⚠️ 用戶沒有收藏任何角色');
      return;
    }

    // 2. 檢查角色緩存
    console.log('[2] 檢查角色緩存...');
    const allCharacters = getAllCharacters();
    const characterMap = new Map(allCharacters.map(char => [char.id, char]));

    console.log(`角色緩存中共有 ${allCharacters.length} 個角色`);
    console.log('');

    // 3. 檢查每個收藏的角色
    console.log('[3] 檢查每個收藏的角色...');
    console.log('');

    const found = [];
    const missing = [];

    for (const favoriteId of favorites) {
      console.log(`檢查: ${favoriteId}`);

      // 先檢查緩存
      const cachedChar = characterMap.get(favoriteId);
      if (cachedChar) {
        console.log(`  ✅ 在緩存中找到: ${cachedChar.display_name || cachedChar.name}`);
        found.push({ id: favoriteId, name: cachedChar.display_name || cachedChar.name, source: '緩存' });
        continue;
      }

      // 再檢查 Firestore
      const charDoc = await db.collection('characters').doc(favoriteId).get();
      if (charDoc.exists) {
        const charData = charDoc.data();
        console.log(`  ✅ 在 Firestore 中找到: ${charData.display_name || charData.name}`);
        found.push({ id: favoriteId, name: charData.display_name || charData.name, source: 'Firestore' });
      } else {
        console.log(`  ❌ 未找到此角色（緩存和 Firestore 都沒有）`);
        missing.push(favoriteId);
      }
    }

    // 4. 總結
    console.log('');
    console.log('='.repeat(60));
    console.log('診斷結果總結');
    console.log('='.repeat(60));
    console.log(`總收藏數: ${favorites.length}`);
    console.log(`找到角色: ${found.length}`);
    console.log(`缺失角色: ${missing.length}`);
    console.log('');

    if (found.length > 0) {
      console.log('找到的角色:');
      found.forEach((char, index) => {
        console.log(`  ${index + 1}. ${char.name} (ID: ${char.id}, 來源: ${char.source})`);
      });
      console.log('');
    }

    if (missing.length > 0) {
      console.log('⚠️ 缺失的角色 ID（這些會顯示為"收藏角色"）:');
      missing.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
      });
      console.log('');

      console.log('💡 建議解決方案:');
      console.log('1. 檢查這些 ID 是否正確（可能是錯誤的 ID 或已刪除的角色）');
      console.log('2. 如果是錯誤的 ID，從用戶的 favorites 陣列中移除');
      console.log('3. 如果是正確的角色 ID，確保角色數據已導入到 Firestore');
    }

    // 5. 檢查對話記錄
    console.log('');
    console.log('[4] 檢查用戶的對話記錄...');
    const conversationsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .get();

    console.log(`對話記錄數量: ${conversationsSnapshot.size}`);

    if (conversationsSnapshot.size === 0) {
      console.log('⚠️ 用戶沒有任何對話記錄');
      console.log('💡 提示: 只有發送過消息後才會有對話記錄');
    } else {
      console.log('對話列表:');
      conversationsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  ${index + 1}. ${data.characterId || doc.id} (更新時間: ${data.updatedAt || '未知'})`);
      });
    }

  } catch (error) {
    console.error('診斷過程中發生錯誤:', error);
  }

  console.log('');
  console.log('='.repeat(60));
};

// 從命令行參數獲取用戶 ID
const userId = process.argv[2];

if (!userId) {
  console.error('❌ 請提供用戶 ID');
  console.log('');
  console.log('使用方法:');
  console.log('  node scripts/diagnose-user-favorites.js <用戶ID>');
  console.log('');
  console.log('示例:');
  console.log('  node scripts/diagnose-user-favorites.js 6FXftJp96WeXYqAO4vRYs52EFXN2');
  process.exit(1);
}

diagnoseUserFavorites(userId)
  .then(() => {
    console.log('診斷完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('診斷失敗:', error);
    process.exit(1);
  });
