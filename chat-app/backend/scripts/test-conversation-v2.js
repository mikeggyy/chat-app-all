/**
 * 對話服務 V2 測試腳本
 *
 * 測試新的子集合架構功能
 *
 * 使用方法：
 * node test-conversation-v2.js
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import * as conversationV2 from "../src/conversation/conversationV2.service.js";
import logger from "../src/utils/logger.js";

const TEST_USER_ID = "test-user-v2";
const TEST_CHARACTER_ID = "match-001";

/**
 * 清理測試數據
 */
async function cleanup() {
  logger.info("🧹 清理測試數據...");
  try {
    await conversationV2.deleteConversation(TEST_USER_ID, TEST_CHARACTER_ID);
    logger.info("✅ 清理完成");
  } catch (error) {
    logger.info("   (沒有需要清理的數據)");
  }
}

/**
 * 測試 1: 添加訊息
 */
async function testAddMessages() {
  logger.info("");
  logger.info("=".repeat(60));
  logger.info("測試 1: 添加訊息");
  logger.info("=".repeat(60));

  // 添加單條訊息
  const msg1 = await conversationV2.appendConversationMessage(
    TEST_USER_ID,
    TEST_CHARACTER_ID,
    {
      role: "user",
      text: "你好！這是測試訊息",
    }
  );
  logger.info(`✅ 添加用戶訊息: ${msg1.id}`);

  const msg2 = await conversationV2.appendConversationMessage(
    TEST_USER_ID,
    TEST_CHARACTER_ID,
    {
      role: "partner",
      text: "哈囉～很高興認識你！",
    }
  );
  logger.info(`✅ 添加角色訊息: ${msg2.id}`);

  // 添加包含圖片的訊息
  const msg3 = await conversationV2.appendConversationMessage(
    TEST_USER_ID,
    TEST_CHARACTER_ID,
    {
      role: "partner",
      text: "這是我的照片～",
      imageUrl: "https://example.com/photo1.jpg",
    }
  );
  logger.info(`✅ 添加照片訊息: ${msg3.id}`);

  // 批量添加訊息
  const batchMessages = [
    { role: "user", text: "訊息 4" },
    { role: "partner", text: "訊息 5" },
    { role: "user", text: "訊息 6" },
  ];

  await conversationV2.appendConversationMessages(
    TEST_USER_ID,
    TEST_CHARACTER_ID,
    batchMessages
  );
  logger.info(`✅ 批量添加 ${batchMessages.length} 則訊息`);
}

/**
 * 測試 2: 查詢訊息
 */
async function testQueryMessages() {
  logger.info("");
  logger.info("=".repeat(60));
  logger.info("測試 2: 查詢訊息");
  logger.info("=".repeat(60));

  // 獲取最近訊息
  const recentMessages = await conversationV2.getRecentMessages(
    TEST_USER_ID,
    TEST_CHARACTER_ID,
    10
  );
  logger.info(`✅ 查詢最近訊息: 共 ${recentMessages.length} 則`);
  recentMessages.slice(0, 3).forEach((msg) => {
    logger.info(`   - ${msg.role}: ${msg.text}`);
  });

  // 分頁查詢
  const { messages, hasMore } = await conversationV2.getConversationHistory(
    TEST_USER_ID,
    TEST_CHARACTER_ID,
    { limit: 3, orderDirection: "asc" }
  );
  logger.info(`✅ 分頁查詢: 共 ${messages.length} 則, hasMore=${hasMore}`);

  // 查詢照片訊息
  const photos = await conversationV2.getConversationPhotos(
    TEST_USER_ID,
    TEST_CHARACTER_ID,
    10
  );
  logger.info(`✅ 查詢照片訊息: 共 ${photos.length} 則`);
  photos.forEach((msg) => {
    logger.info(`   - ${msg.text} (${msg.imageUrl})`);
  });
}

/**
 * 測試 3: 對話統計
 */
async function testConversationStats() {
  logger.info("");
  logger.info("=".repeat(60));
  logger.info("測試 3: 對話統計");
  logger.info("=".repeat(60));

  const stats = await conversationV2.getConversationStats(
    TEST_USER_ID,
    TEST_CHARACTER_ID
  );

  logger.info(`✅ 對話統計:`);
  logger.info(`   - 存在: ${stats.exists}`);
  logger.info(`   - 訊息數量: ${stats.messageCount}`);
  logger.info(`   - 最後訊息: ${stats.lastMessage}`);
  logger.info(`   - 最後更新: ${stats.lastMessageAt}`);
}

/**
 * 測試 4: 刪除訊息
 */
async function testDeleteMessages() {
  logger.info("");
  logger.info("=".repeat(60));
  logger.info("測試 4: 刪除訊息");
  logger.info("=".repeat(60));

  // 先獲取要刪除的訊息 ID
  const messages = await conversationV2.getRecentMessages(
    TEST_USER_ID,
    TEST_CHARACTER_ID,
    5
  );

  if (messages.length > 0) {
    const messageIdsToDelete = [messages[0].id];

    const result = await conversationV2.deleteConversationMessages(
      TEST_USER_ID,
      TEST_CHARACTER_ID,
      messageIdsToDelete
    );

    logger.info(`✅ 刪除訊息: ${result.deletedCount} 則`);
  }
}

/**
 * 測試 5: 效能測試（大量訊息）
 */
async function testPerformance() {
  logger.info("");
  logger.info("=".repeat(60));
  logger.info("測試 5: 效能測試");
  logger.info("=".repeat(60));

  const messageCount = 100;
  const messages = [];

  for (let i = 0; i < messageCount; i++) {
    messages.push({
      role: i % 2 === 0 ? "user" : "partner",
      text: `測試訊息 ${i + 1}`,
    });
  }

  const startTime = Date.now();
  await conversationV2.appendConversationMessages(
    TEST_USER_ID,
    TEST_CHARACTER_ID,
    messages
  );
  const endTime = Date.now();

  logger.info(`✅ 批量添加 ${messageCount} 則訊息`);
  logger.info(`   耗時: ${endTime - startTime}ms`);
  logger.info(`   平均: ${((endTime - startTime) / messageCount).toFixed(2)}ms/則`);

  // 查詢效能
  const queryStartTime = Date.now();
  await conversationV2.getRecentMessages(TEST_USER_ID, TEST_CHARACTER_ID, 50);
  const queryEndTime = Date.now();

  logger.info(`✅ 查詢最近 50 則訊息`);
  logger.info(`   耗時: ${queryEndTime - queryStartTime}ms`);
}

/**
 * 主測試函數
 */
async function runAllTests() {
  logger.info("=".repeat(60));
  logger.info("🧪 對話服務 V2 測試");
  logger.info("=".repeat(60));
  logger.info("");

  try {
    // 清理舊數據
    await cleanup();

    // 執行測試
    await testAddMessages();
    await testQueryMessages();
    await testConversationStats();
    await testDeleteMessages();
    await testPerformance();

    logger.info("");
    logger.info("=".repeat(60));
    logger.info("✅ 所有測試完成");
    logger.info("=".repeat(60));

    // 清理測試數據
    await cleanup();

    process.exit(0);
  } catch (error) {
    logger.error("❌ 測試失敗:", error);
    process.exit(1);
  }
}

// 執行測試
runAllTests();
