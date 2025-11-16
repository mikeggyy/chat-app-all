/**
 * 檢查用戶的對話記錄
 * 診斷為什麼對話列表不顯示
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

const checkUserConversations = async (userId) => {
  console.log('='.repeat(60));
  console.log('檢查用戶對話記錄');
  console.log('='.repeat(60));
  console.log(`用戶 ID: ${userId}`);
  console.log('');

  try {
    const db = getFirestoreDb();

    // 1. 檢查用戶文檔中的 conversations 數組（舊格式）
    console.log('[1] 檢查用戶文檔中的 conversations 陣列（舊格式）...');
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log('❌ 用戶不存在！');
      return;
    }

    const userData = userDoc.data();
    const oldConversations = Array.isArray(userData.conversations) ? userData.conversations : [];

    console.log(`舊格式對話數量: ${oldConversations.length}`);
    if (oldConversations.length > 0) {
      console.log('舊格式對話列表:');
      oldConversations.forEach((conv, index) => {
        if (typeof conv === 'string') {
          console.log(`  ${index + 1}. ${conv}`);
        } else {
          console.log(`  ${index + 1}. ${conv.conversationId || conv.characterId || conv.id}`);
        }
      });
    }
    console.log('');

    // 2. 檢查 conversations 子集合（新格式）
    console.log('[2] 檢查 conversations 子集合（新格式）...');
    const conversationsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .orderBy('updatedAt', 'desc')
      .get();

    console.log(`子集合對話數量: ${conversationsSnapshot.size}`);
    console.log('');

    if (conversationsSnapshot.size === 0) {
      console.log('❌ 子集合中沒有對話記錄！');
      console.log('');
      console.log('💡 可能的原因:');
      console.log('  1. 用戶確實沒有發送過任何消息');
      console.log('  2. 發送消息時沒有正確保存對話記錄');
      console.log('  3. 對話記錄被意外刪除');
      console.log('');

      if (oldConversations.length > 0) {
        console.log('⚠️ 但是舊格式中有對話記錄，可能需要遷移數據');
      }
    } else {
      console.log('子集合對話詳情:');
      const allCharacters = getAllCharacters();
      const characterMap = new Map(allCharacters.map(char => [char.id, char]));

      const conversations = [];
      conversationsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        const characterId = data.characterId || doc.id;
        const character = characterMap.get(characterId);

        conversations.push({
          id: doc.id,
          characterId,
          data
        });

        console.log(`  ${index + 1}. 角色 ID: ${characterId}`);
        if (character) {
          console.log(`     角色名稱: ${character.display_name || character.name}`);
        } else {
          console.log(`     ⚠️ 角色不存在於緩存中`);
        }
        console.log(`     最後更新: ${data.updatedAt || '未知'}`);
        console.log(`     最後消息: ${data.lastMessage || data.partnerLastMessage || '無'}`);
        console.log('');
      });
    }

    // 3. 檢查實際的消息記錄
    console.log('[3] 檢查實際的消息記錄...');
    const allConversationIds = new Set();

    // 從舊格式收集
    oldConversations.forEach(conv => {
      if (typeof conv === 'string') {
        allConversationIds.add(conv);
      } else {
        const id = conv.conversationId || conv.characterId || conv.id;
        if (id) allConversationIds.add(id);
      }
    });

    // 從新格式收集
    conversationsSnapshot.docs.forEach(doc => {
      allConversationIds.add(doc.id);
    });

    console.log(`共有 ${allConversationIds.size} 個可能的對話`);
    console.log('');

    if (allConversationIds.size > 0) {
      console.log('檢查每個對話的消息數量:');
      for (const conversationId of allConversationIds) {
        const messagesSnapshot = await db
          .collection('conversations')
          .doc(`${userId}::${conversationId}`)
          .collection('messages')
          .get();

        const messageCount = messagesSnapshot.size;
        console.log(`  ${conversationId}: ${messageCount} 條消息`);

        if (messageCount === 0) {
          console.log(`    ⚠️ 沒有消息記錄，但對話列表中有此項`);
        }
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('診斷總結');
    console.log('='.repeat(60));

    if (conversationsSnapshot.size === 0 && allConversationIds.size === 0) {
      console.log('❌ 問題: 用戶沒有任何對話記錄');
      console.log('');
      console.log('💡 建議:');
      console.log('  1. 確認用戶確實發送過消息');
      console.log('  2. 檢查瀏覽器控制台是否有 API 錯誤');
      console.log('  3. 檢查後端日誌確認消息是否成功保存');
    } else if (conversationsSnapshot.size === 0 && oldConversations.length > 0) {
      console.log('⚠️ 問題: 只有舊格式數據，沒有新格式數據');
      console.log('');
      console.log('💡 建議:');
      console.log('  需要執行數據遷移，將舊格式遷移到子集合');
    } else if (conversationsSnapshot.size > 0) {
      console.log('✅ 對話記錄正常');
      console.log(`  - 子集合中有 ${conversationsSnapshot.size} 個對話`);
      console.log('');
      console.log('💡 如果前端仍然顯示"沒有聊天記錄"，可能的原因:');
      console.log('  1. 前端 API 調用失敗（檢查瀏覽器控制台）');
      console.log('  2. 用戶 ID 不匹配');
      console.log('  3. 認證問題');
      console.log('  4. 緩存問題（清除瀏覽器緩存重試）');
    }

    console.log('');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
  }
};

// 從命令行參數獲取用戶 ID
const userId = process.argv[2];

if (!userId) {
  console.error('❌ 請提供用戶 ID');
  console.log('');
  console.log('使用方法:');
  console.log('  node scripts/check-user-conversations.js <用戶ID>');
  console.log('');
  console.log('示例:');
  console.log('  node scripts/check-user-conversations.js 6FXftJp96WeXYqAO4vRYs52EFXN2');
  process.exit(1);
}

checkUserConversations(userId)
  .then(() => {
    console.log('檢查完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('檢查失敗:', error);
    process.exit(1);
  });
