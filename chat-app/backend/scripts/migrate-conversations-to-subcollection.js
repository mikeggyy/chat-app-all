/**
 * 遷移腳本：將用戶文檔中的 conversations 數組遷移到 Firestore 子集合
 *
 * 使用方法：
 * node scripts/migrate-conversations-to-subcollection.js
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import { getMatchById } from "../src/match/match.service.js";
import { addOrUpdateConversation } from "../src/user/userConversations.service.js";

const db = getFirestoreDb();

async function migrateUserConversations(userId, conversations) {
  if (!Array.isArray(conversations) || conversations.length === 0) {
    return { success: true, count: 0, userId };
  }

  let migratedCount = 0;
  let errors = [];

  for (const conv of conversations) {
    try {
      // 提取 conversationId
      let conversationId;
      if (typeof conv === "string") {
        conversationId = conv;
      } else if (conv.conversationId) {
        conversationId = conv.conversationId;
      } else if (conv.characterId) {
        conversationId = conv.characterId;
      } else if (conv.id) {
        conversationId = conv.id;
      }

      if (!conversationId) {
        console.warn(`跳過無效的對話:`, conv);
        continue;
      }

      // 構建 metadata
      const metadata = {
        characterId: conversationId,
        lastMessage: conv.lastMessage || "",
        lastMessageAt: conv.lastMessageAt || new Date().toISOString(),
        updatedAt: conv.updatedAt || new Date().toISOString(),
      };

      if (conv.lastSpeaker) {
        metadata.lastSpeaker = conv.lastSpeaker;
      }
      if (conv.partnerLastMessage) {
        metadata.partnerLastMessage = conv.partnerLastMessage;
      }
      if (conv.partnerLastRepliedAt) {
        metadata.partnerLastRepliedAt = conv.partnerLastRepliedAt;
      }

      // 獲取角色信息
      try {
        const character = await getMatchById(conversationId);
        if (character) {
          metadata.character = {
            id: character.id,
            display_name: character.display_name,
            portraitUrl: character.portraitUrl,
            background: character.background,
          };
        }
      } catch (charError) {
        console.warn(`無法獲取角色 ${conversationId} 信息:`, charError.message);
      }

      // 寫入到子集合
      await addOrUpdateConversation(userId, conversationId, metadata);
      migratedCount++;
      console.log(`✓ 已遷移對話: ${userId} -> ${conversationId}`);
    } catch (error) {
      errors.push({ conversationId: conv.conversationId || conv, error: error.message });
      console.error(`✗ 遷移對話失敗:`, error.message);
    }
  }

  return {
    success: errors.length === 0,
    count: migratedCount,
    errors,
    userId,
  };
}

async function migrateAllConversations() {
  console.log("開始遷移所有用戶的對話記錄到 Firestore 子集合...\n");

  try {
    // 獲取所有用戶
    const usersSnapshot = await db.collection("users").get();

    if (usersSnapshot.empty) {
      console.log("沒有找到任何用戶記錄");
      return;
    }

    console.log(`找到 ${usersSnapshot.size} 個用戶\n`);

    let totalMigrated = 0;
    let totalErrors = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const conversations = userData.conversations || [];

      console.log(`\n處理用戶: ${userId}`);
      console.log(`  對話數量: ${conversations.length}`);

      if (conversations.length === 0) {
        console.log(`  跳過（無對話記錄）`);
        continue;
      }

      const result = await migrateUserConversations(userId, conversations);

      totalMigrated += result.count;
      totalErrors += result.errors.length;

      console.log(`  已遷移: ${result.count} 個對話`);
      if (result.errors.length > 0) {
        console.log(`  錯誤: ${result.errors.length} 個`);
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("遷移完成！");
    console.log(`總共遷移: ${totalMigrated} 個對話`);
    if (totalErrors > 0) {
      console.log(`總錯誤數: ${totalErrors}`);
    }
    console.log("=".repeat(50));

  } catch (error) {
    console.error("遷移過程發生錯誤:", error);
    throw error;
  }
}

// 執行遷移
migrateAllConversations()
  .then(() => {
    console.log("\n遷移腳本執行完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n遷移腳本執行失敗:", error);
    process.exit(1);
  });
