/**
 * 清理用戶數據腳本
 * 用於徹底刪除指定用戶的所有 Firestore 數據
 *
 * ⚠️ 警告: 此操作不可逆！
 *
 * 使用方式:
 * node scripts/cleanup-user-data.js <用戶UID>
 *
 * 例如:
 * node scripts/cleanup-user-data.js PS7LYFSstdgyr7b9sCOKFgt3QVB3
 */

import 'dotenv/config';
import { db } from '../src/firebase/index.js';

/**
 * 刪除用戶在 Firestore 中的所有數據
 * @param {string} userId - 用戶 UID
 */
async function cleanupUserData(userId) {
  console.log(`\n========================================`);
  console.log(`開始清理用戶數據: ${userId}`);
  console.log(`========================================\n`);

  const deletionStats = {
    users: 0,
    conversations: 0,
    user_photos: 0,
    user_potions: 0,
    usage_limits: 0,
    transactions: 0,
    orders: 0,
    generatedVideos: 0,
    character_creation_flows: 0,
    idempotency_keys: 0,
  };

  try {
    // 1. 刪除 users 集合中的用戶文檔
    console.log(`1️⃣  檢查 users 集合...`);
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        await userDoc.ref.delete();
        deletionStats.users = 1;
        console.log(`   ✅ 已刪除 users/${userId}`);
      } else {
        console.log(`   ⚠️  users/${userId} 不存在`);
      }
    } catch (error) {
      console.error(`   ❌ 刪除失敗:`, error.message);
    }

    // 2. 刪除對話記錄（conversations 集合，文檔 ID 格式：userId::characterId）
    console.log(`\n2️⃣  檢查 conversations 集合...`);
    try {
      const conversationsSnapshot = await db
        .collection('conversations')
        .where('__name__', '>=', `${userId}::`)
        .where('__name__', '<', `${userId}::\uf8ff`)
        .get();

      if (!conversationsSnapshot.empty) {
        const deletePromises = conversationsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletionStats.conversations = conversationsSnapshot.size;
        console.log(`   ✅ 已刪除 ${deletionStats.conversations} 個對話記錄`);
      } else {
        console.log(`   ℹ️  沒有對話記錄`);
      }
    } catch (error) {
      console.error(`   ❌ 刪除失敗:`, error.message);
    }

    // 3. 刪除用戶照片（user_photos/{userId}/photos 子集合 + 父文檔）
    console.log(`\n3️⃣  檢查 user_photos 集合...`);
    try {
      const photosSnapshot = await db
        .collection('user_photos')
        .doc(userId)
        .collection('photos')
        .get();

      if (!photosSnapshot.empty) {
        const deletePromises = photosSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletionStats.user_photos = photosSnapshot.size;
        console.log(`   ✅ 已刪除 ${deletionStats.user_photos} 張照片記錄`);
      } else {
        console.log(`   ℹ️  沒有照片記錄`);
      }

      // 刪除父文檔
      const userPhotosDoc = await db.collection('user_photos').doc(userId).get();
      if (userPhotosDoc.exists) {
        await userPhotosDoc.ref.delete();
        console.log(`   ✅ 已刪除 user_photos/${userId} 父文檔`);
      }
    } catch (error) {
      console.error(`   ❌ 刪除失敗:`, error.message);
    }

    // 4. 刪除用戶藥水（user_potions/{userId}/potions 子集合 + 父文檔）
    console.log(`\n4️⃣  檢查 user_potions 集合...`);
    try {
      const potionsSnapshot = await db
        .collection('user_potions')
        .doc(userId)
        .collection('potions')
        .get();

      if (!potionsSnapshot.empty) {
        const deletePromises = potionsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletionStats.user_potions = potionsSnapshot.size;
        console.log(`   ✅ 已刪除 ${deletionStats.user_potions} 個藥水記錄`);
      } else {
        console.log(`   ℹ️  沒有藥水記錄`);
      }

      // 刪除父文檔
      const userPotionsDoc = await db.collection('user_potions').doc(userId).get();
      if (userPotionsDoc.exists) {
        await userPotionsDoc.ref.delete();
        console.log(`   ✅ 已刪除 user_potions/${userId} 父文檔`);
      }
    } catch (error) {
      console.error(`   ❌ 刪除失敗:`, error.message);
    }

    // 5. 刪除使用限制數據（usage_limits 集合）
    console.log(`\n5️⃣  檢查 usage_limits 集合...`);
    try {
      const usageLimitsDoc = await db.collection('usage_limits').doc(userId).get();
      if (usageLimitsDoc.exists) {
        await usageLimitsDoc.ref.delete();
        deletionStats.usage_limits = 1;
        console.log(`   ✅ 已刪除 usage_limits/${userId}`);
      } else {
        console.log(`   ⚠️  usage_limits/${userId} 不存在`);
      }
    } catch (error) {
      console.error(`   ❌ 刪除失敗:`, error.message);
    }

    // 6. 刪除交易記錄（transactions 集合，根據 userId 查詢）
    console.log(`\n6️⃣  檢查 transactions 集合...`);
    try {
      const transactionsSnapshot = await db
        .collection('transactions')
        .where('userId', '==', userId)
        .get();

      if (!transactionsSnapshot.empty) {
        const deletePromises = transactionsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletionStats.transactions = transactionsSnapshot.size;
        console.log(`   ✅ 已刪除 ${deletionStats.transactions} 筆交易記錄`);
      } else {
        console.log(`   ℹ️  沒有交易記錄`);
      }
    } catch (error) {
      console.error(`   ❌ 刪除失敗:`, error.message);
    }

    // 7. 刪除訂單記錄（orders 集合，根據 userId 查詢）
    console.log(`\n7️⃣  檢查 orders 集合...`);
    try {
      const ordersSnapshot = await db
        .collection('orders')
        .where('userId', '==', userId)
        .get();

      if (!ordersSnapshot.empty) {
        const deletePromises = ordersSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletionStats.orders = ordersSnapshot.size;
        console.log(`   ✅ 已刪除 ${deletionStats.orders} 筆訂單記錄`);
      } else {
        console.log(`   ℹ️  沒有訂單記錄`);
      }
    } catch (error) {
      console.error(`   ❌ 刪除失敗:`, error.message);
    }

    // 8. 刪除生成的影片記錄（generatedVideos 集合，根據 userId 查詢）
    console.log(`\n8️⃣  檢查 generatedVideos 集合...`);
    try {
      const videosSnapshot = await db
        .collection('generatedVideos')
        .where('userId', '==', userId)
        .get();

      if (!videosSnapshot.empty) {
        const deletePromises = videosSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletionStats.generatedVideos = videosSnapshot.size;
        console.log(`   ✅ 已刪除 ${deletionStats.generatedVideos} 個影片記錄`);
      } else {
        console.log(`   ℹ️  沒有影片記錄`);
      }
    } catch (error) {
      console.error(`   ❌ 刪除失敗:`, error.message);
    }

    // 9. 刪除角色創建流程記錄（character_creation_flows 集合，根據 userId 查詢）
    console.log(`\n9️⃣  檢查 character_creation_flows 集合...`);
    try {
      const flowsSnapshot = await db
        .collection('character_creation_flows')
        .where('userId', '==', userId)
        .get();

      if (!flowsSnapshot.empty) {
        const deletePromises = flowsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletionStats.character_creation_flows = flowsSnapshot.size;
        console.log(`   ✅ 已刪除 ${deletionStats.character_creation_flows} 個角色創建流程`);
      } else {
        console.log(`   ℹ️  沒有角色創建流程`);
      }
    } catch (error) {
      console.error(`   ❌ 刪除失敗:`, error.message);
    }

    // 10. 刪除冪等性鍵記錄（idempotency_keys 集合，文檔 ID 以 userId 開頭）
    console.log(`\n🔟 檢查 idempotency_keys 集合...`);
    try {
      const idempotencySnapshot = await db
        .collection('idempotency_keys')
        .where('__name__', '>=', `${userId}:`)
        .where('__name__', '<', `${userId}:\uf8ff`)
        .get();

      if (!idempotencySnapshot.empty) {
        const deletePromises = idempotencySnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletionStats.idempotency_keys = idempotencySnapshot.size;
        console.log(`   ✅ 已刪除 ${deletionStats.idempotency_keys} 個冪等性鍵`);
      } else {
        console.log(`   ℹ️  沒有冪等性鍵記錄`);
      }
    } catch (error) {
      console.error(`   ❌ 刪除失敗:`, error.message);
    }

    // 總結
    console.log(`\n========================================`);
    console.log(`✅ 用戶數據清理完成！`);
    console.log(`========================================\n`);
    console.log(`刪除統計:`);
    console.log(`  - users: ${deletionStats.users}`);
    console.log(`  - conversations: ${deletionStats.conversations}`);
    console.log(`  - user_photos: ${deletionStats.user_photos}`);
    console.log(`  - user_potions: ${deletionStats.user_potions}`);
    console.log(`  - usage_limits: ${deletionStats.usage_limits}`);
    console.log(`  - transactions: ${deletionStats.transactions}`);
    console.log(`  - orders: ${deletionStats.orders}`);
    console.log(`  - generatedVideos: ${deletionStats.generatedVideos}`);
    console.log(`  - character_creation_flows: ${deletionStats.character_creation_flows}`);
    console.log(`  - idempotency_keys: ${deletionStats.idempotency_keys}`);

    const totalDeleted = Object.values(deletionStats).reduce((sum, count) => sum + count, 0);
    console.log(`\n  📊 總計刪除: ${totalDeleted} 筆記錄\n`);

  } catch (error) {
    console.error(`\n❌ 清理過程發生錯誤:`, error);
    process.exit(1);
  }
}

// 從命令行參數獲取用戶 UID
const userId = process.argv[2];

if (!userId) {
  console.error('❌ 請提供用戶 UID');
  console.log('\n使用方式:');
  console.log('  node scripts/cleanup-user-data.js <用戶UID>');
  console.log('\n例如:');
  console.log('  node scripts/cleanup-user-data.js PS7LYFSstdgyr7b9sCOKFgt3QVB3');
  process.exit(1);
}

// 確認操作
console.log('\n⚠️  警告: 此操作將刪除用戶的所有 Firestore 數據，且不可逆！');
console.log(`目標用戶 UID: ${userId}\n`);

cleanupUserData(userId);
