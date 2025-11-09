/**
 * 清理無效的 conversations 記錄
 * 從用戶的 conversations 數組中移除指向不存在角色的記錄
 */

import { initializeFirebase, getFirestoreDb } from "../src/firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import logger from "../src/utils/logger.js";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function cleanupConversations() {
  try {
    // 初始化 Firebase
    await initializeFirebase();
    const db = getFirestoreDb();

    logger.info("開始清理無效的 conversations 記錄...");

    // 1. 獲取所有角色 ID
    const charactersSnapshot = await db.collection("characters").get();
    const validCharacterIds = new Set();

    charactersSnapshot.forEach((doc) => {
      validCharacterIds.add(doc.id);
    });

    logger.info(`找到 ${validCharacterIds.size} 個有效角色`);

    // 2. 獲取所有用戶
    const usersSnapshot = await db.collection("users").get();
    logger.info(`找到 ${usersSnapshot.size} 個用戶`);

    // 3. 收集需要清理的用戶
    const usersToCleanup = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const conversations = Array.isArray(userData.conversations)
        ? userData.conversations
        : [];

      if (conversations.length === 0) {
        continue;
      }

      // 過濾出有效的 conversations
      const validConversations = conversations.filter((conv) => {
        let characterId = null;

        if (typeof conv === "string") {
          characterId = conv;
        } else if (conv && typeof conv === "object") {
          characterId =
            conv.characterId ||
            conv.conversationId ||
            conv.matchId ||
            conv.character?.id ||
            conv.id;
        }

        // 保留有效的 characterId
        return characterId && validCharacterIds.has(characterId);
      });

      // 如果有需要清理的記錄
      if (validConversations.length < conversations.length) {
        usersToCleanup.push({
          userId,
          displayName: userData.displayName || "未知用戶",
          originalCount: conversations.length,
          validCount: validConversations.length,
          removedCount: conversations.length - validConversations.length,
          validConversations,
        });
      }
    }

    if (usersToCleanup.length === 0) {
      logger.info("✅ 沒有需要清理的 conversation 記錄！");
      rl.close();
      process.exit(0);
      return;
    }

    // 4. 顯示清理預覽
    logger.info(`\n找到 ${usersToCleanup.length} 個用戶需要清理：`);
    usersToCleanup.forEach((user, idx) => {
      logger.info(
        `${idx + 1}. ${user.displayName} (${user.userId}): 移除 ${user.removedCount}/${user.originalCount} 個無效記錄`
      );
    });

    // 5. 確認是否執行清理
    const totalRemoved = usersToCleanup.reduce((sum, u) => sum + u.removedCount, 0);
    logger.info(`\n總共將移除 ${totalRemoved} 個無效 conversation 記錄`);

    const answer = await askQuestion("\n確定要執行清理嗎？(yes/no): ");

    if (answer.toLowerCase() !== "yes") {
      logger.info("取消清理操作");
      rl.close();
      process.exit(0);
      return;
    }

    // 6. 執行清理
    logger.info("\n開始執行清理...");

    const batch = db.batch();
    let updatedCount = 0;

    usersToCleanup.forEach((user) => {
      const userRef = db.collection("users").doc(user.userId);
      batch.update(userRef, {
        conversations: user.validConversations,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updatedCount++;
    });

    await batch.commit();

    logger.info(`\n✅ 清理完成！`);
    logger.info(`- 更新了 ${updatedCount} 個用戶`);
    logger.info(`- 移除了 ${totalRemoved} 個無效 conversation 記錄`);

    rl.close();
    process.exit(0);
  } catch (error) {
    logger.error("清理過程中發生錯誤:", error);
    rl.close();
    process.exit(1);
  }
}

// 執行清理
cleanupConversations();
