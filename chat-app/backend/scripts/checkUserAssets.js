#!/usr/bin/env node

/**
 * 檢查用戶的資產和創建次數
 *
 * 用法：node scripts/checkUserAssets.js <userId>
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

async function checkUserAssets(userId) {
  try {
    const db = getFirestoreDb();

    console.log(`\n🔍 檢查用戶 ${userId} 的資產和創建記錄...\n`);

    // 1. 檢查主文檔的 assets
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('📄 主文檔中的 assets:');
      console.log(`   createCards: ${userData.assets?.createCards || 0}`);
      console.log(`   characterUnlockCards: ${userData.assets?.characterUnlockCards || 0}`);
      console.log(`   photoUnlockCards: ${userData.assets?.photoUnlockCards || 0}`);
      console.log(`   videoUnlockCards: ${userData.assets?.videoUnlockCards || 0}`);
      console.log(`   voiceUnlockCards: ${userData.assets?.voiceUnlockCards || 0}`);
      console.log('');
    }

    // 2. 檢查子集合 users/{userId}/assets
    const assetsSubcollectionSnapshot = await db.collection('users').doc(userId).collection('assets').get();

    if (assetsSubcollectionSnapshot.empty) {
      console.log('❌ 子集合 users/{userId}/assets 為空\n');
    } else {
      console.log(`✅ 子集合找到 ${assetsSubcollectionSnapshot.size} 個資產文檔：\n`);
      assetsSubcollectionSnapshot.forEach(doc => {
        console.log(`  📌 文檔 ID: ${doc.id}`);
        console.log(`     數據: ${JSON.stringify(doc.data(), null, 2)}`);
        console.log('');
      });
    }

    // 3. 檢查獨立集合 user_assets (舊系統)
    const userAssetsDoc = await db.collection('user_assets').doc(userId).get();

    if (!userAssetsDoc.exists) {
      console.log(`⚠️  找不到用戶資產記錄 (user_assets/${userId}) - 這是正常的，舊系統\n`);
    } else {
      const assets = userAssetsDoc.data();
      console.log(`📦 獨立集合 user_assets 中的資產（舊系統）：`);
      console.log(`   創建角色卡: ${assets.createCards || 0}`);
      console.log(`   影片解鎖卡: ${assets.videoCards || 0}`);
      console.log(`   金幣: ${assets.coins || 0}`);
      console.log(`   鑽石: ${assets.diamonds || 0}`);
      console.log(`   最後更新: ${assets.updatedAt || '(未設置)'}`);
      console.log('');
    }

    // 2. 檢查創建限制記錄
    const creationLogsSnapshot = await db.collection('character_creation_logs')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    if (creationLogsSnapshot.empty) {
      console.log(`📋 沒有創建記錄 (character_creation_logs)`);
    } else {
      console.log(`📋 最近的創建記錄（最多 10 條）：`);
      creationLogsSnapshot.forEach((doc, index) => {
        const log = doc.data();
        console.log(`   ${index + 1}. flowId: ${log.flowId || '(未設置)'}`);
        console.log(`      createdAt: ${log.createdAt || '(未設置)'}`);
        console.log(`      status: ${log.status || '(未設置)'}`);
        console.log('');
      });
    }

    // 3. 檢查生成記錄（generation_logs）
    let generationLogsQuery = db.collection('generation_logs');

    // 嘗試查詢
    try {
      const generationLogsSnapshot = await generationLogsQuery
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      if (generationLogsSnapshot.empty) {
        console.log(`📸 沒有圖片生成記錄 (generation_logs)`);
      } else {
        console.log(`📸 最近的圖片生成記錄（最多 10 條）：`);
        generationLogsSnapshot.forEach((doc, index) => {
          const log = doc.data();
          console.log(`   ${index + 1}. flowId: ${log.flowId || '(未設置)'}`);
          console.log(`      status: ${log.status || '(未設置)'}`);
          console.log(`      createdAt: ${log.createdAt || '(未設置)'}`);
          console.log(`      completedAt: ${log.completedAt || '(未完成)'}`);
          console.log('');
        });
      }
    } catch (error) {
      if (error.code === 5) { // NOT_FOUND - index doesn't exist
        console.log(`⚠️  generation_logs 集合可能沒有索引，嘗試不排序查詢...`);
        const generationLogsSnapshot = await generationLogsQuery
          .where('userId', '==', userId)
          .limit(10)
          .get();

        if (generationLogsSnapshot.empty) {
          console.log(`📸 沒有圖片生成記錄`);
        } else {
          console.log(`📸 圖片生成記錄（最多 10 條，未排序）：`);
          generationLogsSnapshot.forEach((doc, index) => {
            const log = doc.data();
            console.log(`   ${index + 1}. flowId: ${log.flowId || '(未設置)'}`);
            console.log(`      status: ${log.status || '(未設置)'}`);
            console.log(`      createdAt: ${log.createdAt || '(未設置)'}`);
            console.log('');
          });
        }
      } else {
        console.error('查詢 generation_logs 失敗:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ 檢查失敗:', error);
    throw error;
  }
}

// 主程式
const userId = process.argv[2];

if (!userId) {
  console.error('❌ 請提供用戶 ID');
  console.error('用法：node scripts/checkUserAssets.js <userId>');
  console.error('範例：node scripts/checkUserAssets.js PS7LYFSstdgyr7b9sCOKFgt3QVB3');
  process.exit(1);
}

checkUserAssets(userId)
  .then(() => {
    console.log('\n✅ 完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  });
