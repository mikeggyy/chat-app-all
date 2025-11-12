#!/usr/bin/env node

/**
 * 刪除指定用戶創建的指定角色
 *
 * 用法：node scripts/deleteUserCharacter.js <userId> <characterName>
 * 範例：node scripts/deleteUserCharacter.js PS7LYFSstdgyr7b9sCOKFgt3QVB3 "櫻井美雪"
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

/**
 * 查找並刪除用戶創建的指定角色
 */
async function deleteUserCharacter(userId, characterName) {
  try {
    console.log(`\n🔍 查找用戶 ${userId} 創建的角色「${characterName}」...\n`);

    const db = getFirestoreDb();

    // 查詢該用戶創建的角色
    const snapshot = await db.collection('characters')
      .where('creatorUid', '==', userId)
      .where('display_name', '==', characterName)
      .get();

    if (snapshot.empty) {
      console.log(`⚠️  找不到角色「${characterName}」`);
      console.log(`   請檢查：`);
      console.log(`   1. 用戶 ID 是否正確：${userId}`);
      console.log(`   2. 角色名稱是否完全匹配：${characterName}`);

      // 列出該用戶的所有角色
      const allCharsSnapshot = await db.collection('characters')
        .where('creatorUid', '==', userId)
        .get();

      if (!allCharsSnapshot.empty) {
        console.log(`\n📋 該用戶創建的所有角色：`);
        allCharsSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log(`   - ${data.display_name || '(無名稱)'} (ID: ${doc.id})`);
        });
      } else {
        console.log(`\n📋 該用戶沒有創建任何角色`);
      }

      return 0;
    }

    // 刪除找到的角色
    const promises = [];
    const characterIds = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      characterIds.push(doc.id);

      console.log(`📄 找到角色：`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   名稱: ${data.display_name}`);
      console.log(`   性別: ${data.gender}`);
      console.log(`   語音: ${data.voice}`);
      console.log(`   頭像: ${data.portraitUrl}`);
      console.log(`   創建時間: ${data.createdAt}`);
      console.log('');

      promises.push(doc.ref.delete());
    });

    await Promise.all(promises);

    console.log(`✅ 成功刪除 ${characterIds.length} 個角色：${characterIds.join(', ')}\n`);
    return characterIds.length;

  } catch (error) {
    console.error('❌ 刪除失敗:', error);
    throw error;
  }
}

// 主程式
const userId = process.argv[2];
const characterName = process.argv[3];

if (!userId || !characterName) {
  console.error('❌ 請提供用戶 ID 和角色名稱');
  console.error('用法：node scripts/deleteUserCharacter.js <userId> <characterName>');
  console.error('範例：node scripts/deleteUserCharacter.js PS7LYFSstdgyr7b9sCOKFgt3QVB3 "櫻井美雪"');
  process.exit(1);
}

deleteUserCharacter(userId, characterName)
  .then((count) => {
    if (count > 0) {
      console.log('✅ 完成');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  });
