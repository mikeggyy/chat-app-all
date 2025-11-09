/**
 * 診斷用戶 conversations 數據
 * 檢查是否有指向不存在角色的 conversation 記錄
 */

import { initializeFirebase, getFirestoreDb } from "../src/firebase/index.js";
import logger from "../src/utils/logger.js";

async function diagnoseConversations() {
  try {
    // 初始化 Firebase
    await initializeFirebase();
    const db = getFirestoreDb();

    logger.info("開始診斷 conversations 數據...");

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

    // 3. 檢查每個用戶的 conversations
    const issues = [];
    let totalInvalidConversations = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const conversations = Array.isArray(userData.conversations)
        ? userData.conversations
        : [];

      if (conversations.length === 0) {
        continue;
      }

      // 提取 conversation 中的 characterId
      const invalidConversations = [];

      conversations.forEach((conv, index) => {
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

        // 檢查 characterId 是否有效
        if (characterId && !validCharacterIds.has(characterId)) {
          invalidConversations.push({
            index,
            characterId,
            type: typeof conv,
            data: conv,
          });
          totalInvalidConversations++;
        }
      });

      if (invalidConversations.length > 0) {
        issues.push({
          userId,
          displayName: userData.displayName || "未知用戶",
          email: userData.email || "無 email",
          totalConversations: conversations.length,
          invalidConversations,
        });
      }
    }

    // 4. 輸出診斷結果
    logger.info("\n========== 診斷結果 ==========");
    logger.info(`總共發現 ${issues.length} 個用戶有無效的 conversation 記錄`);
    logger.info(`無效 conversation 總數: ${totalInvalidConversations}`);

    if (issues.length > 0) {
      logger.info("\n詳細資訊：");

      issues.forEach((issue, idx) => {
        logger.info(`\n[${idx + 1}] 用戶: ${issue.displayName} (${issue.userId})`);
        logger.info(`   Email: ${issue.email}`);
        logger.info(`   總對話數: ${issue.totalConversations}`);
        logger.info(`   無效對話數: ${issue.invalidConversations.length}`);

        issue.invalidConversations.forEach((invalid) => {
          logger.info(`   - 索引 ${invalid.index}: characterId="${invalid.characterId}"`);
          if (invalid.type === "object") {
            logger.info(`     完整數據: ${JSON.stringify(invalid.data, null, 2)}`);
          }
        });
      });

      logger.info("\n========== 修復建議 ==========");
      logger.info("選項 1: 手動清理無效的 conversation 記錄");
      logger.info("選項 2: 在前端過濾掉「未知角色」");
      logger.info("選項 3: 運行自動修復腳本（將創建 cleanupConversations.js）");
    } else {
      logger.info("✅ 沒有發現無效的 conversation 記錄！");
    }

    logger.info("\n診斷完成！");
    process.exit(0);
  } catch (error) {
    logger.error("診斷過程中發生錯誤:", error);
    process.exit(1);
  }
}

// 執行診斷
diagnoseConversations();
