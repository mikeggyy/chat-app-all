/**
 * 快速測試收藏功能
 *
 * 快速驗證核心功能是否正常工作
 */

import 'dotenv/config';
import { getFirestoreDb } from '../src/firebase/index.js';
import { TEST_ACCOUNTS } from '../../../shared/config/testAccounts.js';
import { addFavoriteForUser, removeFavoriteForUser } from '../src/user/user.service.js';

const db = getFirestoreDb();
const TEST_USER_ID = TEST_ACCOUNTS.DEV_USER_ID;
const TEST_CHARACTER_ID = 'match-001';

async function getCharacterFavorites(characterId) {
  const doc = await db.collection('characters').doc(characterId).get();
  return doc.data()?.totalFavorites || 0;
}

async function quickTest() {
  console.log('\n🚀 快速測試收藏功能\n');

  try {
    // 1. 收藏測試
    console.log('📝 測試 1: 收藏角色');
    const before1 = await getCharacterFavorites(TEST_CHARACTER_ID);
    console.log(`   收藏前: ${before1}`);

    await addFavoriteForUser(TEST_USER_ID, TEST_CHARACTER_ID);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const after1 = await getCharacterFavorites(TEST_CHARACTER_ID);
    console.log(`   收藏後: ${after1}`);
    console.log(`   ${after1 > before1 ? '✅' : '❌'} 計數${after1 > before1 ? '增加' : '未變化'}\n`);

    // 2. 取消收藏測試
    console.log('📝 測試 2: 取消收藏');
    const before2 = await getCharacterFavorites(TEST_CHARACTER_ID);
    console.log(`   取消前: ${before2}`);

    await removeFavoriteForUser(TEST_USER_ID, TEST_CHARACTER_ID);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const after2 = await getCharacterFavorites(TEST_CHARACTER_ID);
    console.log(`   取消後: ${after2}`);
    console.log(`   ${after2 < before2 ? '✅' : '❌'} 計數${after2 < before2 ? '減少' : '未變化'}\n`);

    console.log('🎉 快速測試完成！\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ 測試失敗:', err.message);
    console.error(err);
    process.exit(1);
  }
}

quickTest();
