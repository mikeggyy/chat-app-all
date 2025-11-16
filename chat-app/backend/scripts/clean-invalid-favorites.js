/**
 * 清理用戶的無效收藏
 * 移除不存在的角色 ID
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

const cleanInvalidFavorites = async (userId, options = {}) => {
  const { dryRun = true } = options;

  console.log('='.repeat(60));
  console.log(dryRun ? '🔍 預覽模式（不會實際修改數據）' : '⚠️  執行模式（將修改數據）');
  console.log('='.repeat(60));
  console.log(`用戶 ID: ${userId}`);
  console.log('');

  try {
    const db = getFirestoreDb();

    // 1. 獲取用戶資料
    console.log('[1] 獲取用戶資料...');
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log('❌ 用戶不存在！');
      return { success: false, error: '用戶不存在' };
    }

    const userData = userDoc.data();
    const favorites = Array.isArray(userData.favorites) ? userData.favorites : [];

    console.log(`✅ 找到用戶，當前收藏數量: ${favorites.length}`);
    console.log('');

    if (favorites.length === 0) {
      console.log('⚠️ 用戶沒有任何收藏');
      return { success: true, removed: 0, remaining: 0 };
    }

    // 2. 建立有效角色 ID 的 Set
    console.log('[2] 檢查角色數據...');
    const allCharacters = getAllCharacters();
    const validCharacterIds = new Set(allCharacters.map(char => char.id));

    console.log(`角色緩存中共有 ${validCharacterIds.size} 個角色`);
    console.log('');

    // 3. 同時檢查 Firestore 中的角色（防止緩存不完整）
    console.log('[3] 檢查 Firestore 中的角色...');
    const firestoreCheckPromises = favorites.map(async (favoriteId) => {
      if (validCharacterIds.has(favoriteId)) {
        return { id: favoriteId, exists: true, source: '緩存' };
      }

      // 緩存中沒有，檢查 Firestore
      const charDoc = await db.collection('characters').doc(favoriteId).get();
      if (charDoc.exists) {
        const charData = charDoc.data();
        return {
          id: favoriteId,
          exists: true,
          source: 'Firestore',
          name: charData.display_name || charData.name
        };
      }

      return { id: favoriteId, exists: false };
    });

    const checkResults = await Promise.all(firestoreCheckPromises);
    console.log('');

    // 4. 分類有效和無效的收藏
    const validFavorites = [];
    const invalidFavorites = [];

    checkResults.forEach((result) => {
      if (result.exists) {
        validFavorites.push(result.id);
        console.log(`✅ 有效: ${result.id} ${result.name ? `(${result.name})` : ''} [${result.source}]`);
      } else {
        invalidFavorites.push(result.id);
        console.log(`❌ 無效: ${result.id} (角色不存在)`);
      }
    });

    console.log('');
    console.log('='.repeat(60));
    console.log('檢查結果');
    console.log('='.repeat(60));
    console.log(`總收藏數: ${favorites.length}`);
    console.log(`有效收藏: ${validFavorites.length}`);
    console.log(`無效收藏: ${invalidFavorites.length}`);
    console.log('');

    if (invalidFavorites.length === 0) {
      console.log('✅ 所有收藏都是有效的，無需清理');
      return { success: true, removed: 0, remaining: validFavorites.length };
    }

    console.log('將被移除的無效收藏:');
    invalidFavorites.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });
    console.log('');

    // 5. 執行清理（如果不是 dry run）
    if (!dryRun) {
      console.log('[4] 執行清理...');
      await userRef.update({
        favorites: validFavorites,
        updatedAt: new Date().toISOString()
      });

      console.log('✅ 清理完成！');
      console.log(`保留 ${validFavorites.length} 個有效收藏`);
      console.log(`移除 ${invalidFavorites.length} 個無效收藏`);
    } else {
      console.log('💡 這是預覽模式，沒有實際修改數據');
      console.log('💡 要執行實際清理，請加上參數: --execute');
    }

    console.log('');
    console.log('='.repeat(60));

    return {
      success: true,
      removed: invalidFavorites.length,
      remaining: validFavorites.length,
      invalidIds: invalidFavorites,
      validIds: validFavorites
    };

  } catch (error) {
    console.error('清理過程中發生錯誤:', error);
    return { success: false, error: error.message };
  }
};

// 解析命令行參數
const args = process.argv.slice(2);
const userId = args.find(arg => !arg.startsWith('--'));
const executeMode = args.includes('--execute');

if (!userId) {
  console.error('❌ 請提供用戶 ID');
  console.log('');
  console.log('使用方法:');
  console.log('  node scripts/clean-invalid-favorites.js <用戶ID> [--execute]');
  console.log('');
  console.log('參數說明:');
  console.log('  --execute    實際執行清理（不加此參數則只預覽）');
  console.log('');
  console.log('示例:');
  console.log('  # 預覽模式（不會修改數據）');
  console.log('  node scripts/clean-invalid-favorites.js 6FXftJp96WeXYqAO4vRYs52EFXN2');
  console.log('');
  console.log('  # 執行模式（實際清理）');
  console.log('  node scripts/clean-invalid-favorites.js 6FXftJp96WeXYqAO4vRYs52EFXN2 --execute');
  process.exit(1);
}

cleanInvalidFavorites(userId, { dryRun: !executeMode })
  .then((result) => {
    if (result.success) {
      console.log('✅ 操作完成');
      process.exit(0);
    } else {
      console.error('❌ 操作失敗:', result.error);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ 發生錯誤:', error);
    process.exit(1);
  });
