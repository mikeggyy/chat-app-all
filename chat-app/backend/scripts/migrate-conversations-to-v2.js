/**
 * 對話數據遷移腳本 - V1 到 V2
 *
 * 將舊的對話架構（messages 陣列）遷移到新的子集合架構
 *
 * 舊架構：
 * conversations/{conversationId}
 *   - messages: [array]
 *
 * 新架構：
 * conversations/{conversationId}
 *   - metadata
 *   - messages/{messageId} (subcollection)
 *
 * 使用方法：
 * node migrate-conversations-to-v2.js [--dry-run] [--limit=10]
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";
import logger from "../src/utils/logger.js";

const CONVERSATIONS_COLLECTION = "conversations";
const MESSAGES_SUBCOLLECTION = "messages";

// 解析命令行參數
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const limitMatch = args.find((arg) => arg.startsWith("--limit="));
const limit = limitMatch ? parseInt(limitMatch.split("=")[1]) : null;

/**
 * 遷移單個對話
 */
async function migrateConversation(conversationDoc) {
  const conversationId = conversationDoc.id;
  const data = conversationDoc.data();

  // 檢查是否已經遷移過（如果沒有 messages 陣列，可能已經遷移）
  if (!Array.isArray(data.messages)) {
    logger.info(`⏭️  跳過對話 ${conversationId}: 沒有 messages 陣列`);
    return { skipped: true, reason: "no_messages_array" };
  }

  const messages = data.messages;
  const messageCount = messages.length;

  logger.info(`📦 準備遷移對話 ${conversationId}: ${messageCount} 則訊息`);

  if (isDryRun) {
    logger.info(`   [DRY RUN] 將會遷移 ${messageCount} 則訊息`);
    return { migrated: false, dryRun: true, messageCount };
  }

  const db = getFirestoreDb();
  const conversationRef = db.collection(CONVERSATIONS_COLLECTION).doc(conversationId);
  const messagesRef = conversationRef.collection(MESSAGES_SUBCOLLECTION);

  try {
    // 1. 將訊息寫入子集合（分批處理，每批 500 條）
    for (let i = 0; i < messages.length; i += 500) {
      const chunk = messages.slice(i, i + 500);
      const batch = db.batch();

      chunk.forEach((msg) => {
        const messageRef = messagesRef.doc(msg.id);
        batch.set(messageRef, {
          id: msg.id,
          role: msg.role,
          text: msg.text,
          createdAt: msg.createdAt,
          ...(msg.imageUrl && { imageUrl: msg.imageUrl }),
        });
      });

      await batch.commit();
      logger.info(`   ✅ 寫入訊息批次: ${i + 1}-${Math.min(i + chunk.length, messages.length)}`);
    }

    // 2. 更新對話元數據，移除舊的 messages 陣列
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

    await conversationRef.update({
      messageCount: messageCount,
      lastMessage: lastMessage ? lastMessage.text : "",
      lastMessageAt: lastMessage ? lastMessage.createdAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      // 移除舊的 messages 陣列
      messages: FieldValue.delete(),
    });

    logger.info(`   ✅ 遷移完成: ${conversationId} (${messageCount} 則訊息)`);

    return { migrated: true, messageCount };
  } catch (error) {
    logger.error(`   ❌ 遷移失敗: ${conversationId}`, error);
    return { migrated: false, error: error.message };
  }
}

/**
 * 主遷移函數
 */
async function migrateAllConversations() {
  logger.info("=".repeat(60));
  logger.info("🚀 開始對話數據遷移 (V1 → V2)");
  logger.info("=".repeat(60));

  if (isDryRun) {
    logger.warn("⚠️  DRY RUN 模式 - 不會實際修改數據");
  }

  if (limit) {
    logger.info(`📊 限制遷移數量: ${limit}`);
  }

  const db = getFirestoreDb();
  let query = db.collection(CONVERSATIONS_COLLECTION);

  if (limit) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  const totalConversations = snapshot.size;

  logger.info(`📊 找到 ${totalConversations} 個對話`);
  logger.info("");

  const stats = {
    total: totalConversations,
    migrated: 0,
    skipped: 0,
    failed: 0,
    totalMessages: 0,
  };

  for (const doc of snapshot.docs) {
    const result = await migrateConversation(doc);

    if (result.migrated) {
      stats.migrated++;
      stats.totalMessages += result.messageCount || 0;
    } else if (result.skipped) {
      stats.skipped++;
    } else {
      stats.failed++;
    }
  }

  logger.info("");
  logger.info("=".repeat(60));
  logger.info("✅ 遷移完成");
  logger.info("=".repeat(60));
  logger.info(`總對話數: ${stats.total}`);
  logger.info(`已遷移: ${stats.migrated} (${stats.totalMessages} 則訊息)`);
  logger.info(`已跳過: ${stats.skipped}`);
  logger.info(`失敗: ${stats.failed}`);

  if (isDryRun) {
    logger.warn("");
    logger.warn("⚠️  這是 DRY RUN，沒有實際修改數據");
    logger.warn("   移除 --dry-run 參數以執行實際遷移");
  }

  return stats;
}

/**
 * 驗證遷移結果
 */
async function verifyMigration() {
  logger.info("");
  logger.info("=".repeat(60));
  logger.info("🔍 驗證遷移結果");
  logger.info("=".repeat(60));

  const db = getFirestoreDb();
  const snapshot = await db.collection(CONVERSATIONS_COLLECTION).limit(5).get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const messagesRef = doc.ref.collection(MESSAGES_SUBCOLLECTION);
    const messagesSnapshot = await messagesRef.limit(1).get();

    logger.info(`對話 ${doc.id}:`);
    logger.info(`  - messageCount: ${data.messageCount || 0}`);
    logger.info(`  - 子集合訊息數: ${messagesSnapshot.size > 0 ? "有" : "無"}`);
    logger.info(`  - 舊 messages 陣列: ${data.messages ? "存在（未遷移）" : "已移除（已遷移）"}`);
  }
}

// 執行遷移
(async () => {
  try {
    const stats = await migrateAllConversations();

    // 如果不是 dry run，執行驗證
    if (!isDryRun && stats.migrated > 0) {
      await verifyMigration();
    }

    process.exit(0);
  } catch (error) {
    logger.error("❌ 遷移過程發生錯誤:", error);
    process.exit(1);
  }
})();
