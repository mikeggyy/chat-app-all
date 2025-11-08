import "dotenv/config";
import { getFirestoreDb } from "../src/firebase/index.js";
import { FieldValue } from "firebase-admin/firestore";

async function seedTestData() {
  console.log("🌱 開始產生測試數據...\n");

  try {
    const db = getFirestoreDb();

    // 1. 創建測試用戶
    console.log("👤 創建測試用戶...");
    await db.collection("users").doc("test-user-001").set({
      id: "test-user-001",
      uid: "test-uid-001",
      displayName: "測試用戶小明",
      email: "xiaoming@test.com",
      locale: "zh-TW",
      gender: "male",
      photoURL: "/avatars/defult-01.webp",
      membershipTier: "free",
      membershipStatus: "active",
      membershipStartedAt: null,
      membershipExpiresAt: null,
      membershipAutoRenew: false,
      conversations: [],
      favorites: ["match-001", "match-002"],
      walletBalance: 100,
      wallet: {
        balance: 100,
        currency: "TWD",
        updatedAt: new Date().toISOString(),
      },
      assets: {
        characterUnlockCards: 0,
        photoUnlockCards: 0,
        videoUnlockCards: 0,
        voiceUnlockCards: 0,
        createCards: 0,
        gifts: {
          rose: 5,
          chocolate: 3,
          cake: 0,
          teddy: 0,
          ring: 0,
          diamond: 0,
          crown: 0,
        },
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
    });
    console.log("✅ 測試用戶已創建\n");

    // 2. 創建對話記錄
    console.log("💬 創建對話記錄...");
    await db.collection("conversations").doc("test-user-001::match-001").set({
      id: "test-user-001::match-001",
      userId: "test-user-001",
      characterId: "match-001",
      messages: [
        {
          id: "msg-001",
          role: "partner",
          text: "嗨！你好呀～我是小美，很高興認識你！",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: "msg-002",
          role: "user",
          text: "你好！很高興認識你",
          createdAt: new Date(Date.now() - 3000000).toISOString(),
        },
        {
          id: "msg-003",
          role: "partner",
          text: "今天過得怎麼樣？有什麼有趣的事情想分享嗎？",
          createdAt: new Date(Date.now() - 2400000).toISOString(),
        },
        {
          id: "msg-004",
          role: "user",
          text: "還不錯！剛在測試新的聊天功能",
          createdAt: new Date(Date.now() - 1800000).toISOString(),
        },
        {
          id: "msg-005",
          role: "partner",
          text: "哇～聽起來很酷！測試得順利嗎？需要我幫忙測試什麼嗎？😊",
          createdAt: new Date(Date.now() - 1200000).toISOString(),
        },
      ],
      messageCount: 5,
      lastMessage: "哇～聽起來很酷！測試得順利嗎？需要我幫忙測試什麼嗎？😊",
      lastMessageAt: new Date(Date.now() - 1200000).toISOString(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log("✅ 對話記錄已創建（5 條訊息）\n");

    // 3. 創建使用限制記錄
    console.log("📊 創建使用限制記錄...");
    await db.collection("usage_limits").doc("test-user-001").set({
      userId: "test-user-001",

      // 照片限制
      photos: {
        count: 1,
        lifetimeCount: 1,
        unlocked: 0,
        cards: 0,
        permanentUnlock: false,
        lastResetDate: new Date().toISOString().slice(0, 7),
        lastAdTime: null,
        adsWatchedToday: 0,
        history: [
          {
            timestamp: new Date().toISOString(),
          },
        ],
      },

      // 語音限制（按角色）
      voice: {
        "match-001": {
          count: 3,
          lifetimeCount: 3,
          unlocked: 0,
          cards: 0,
          permanentUnlock: false,
          lastResetDate: new Date().toISOString().slice(0, 10),
          lastAdTime: null,
          adsWatchedToday: 0,
          history: [],
        },
      },

      // 對話限制（按角色）
      conversation: {
        "match-001": {
          count: 5,
          lifetimeCount: 5,
          unlocked: 0,
          cards: 0,
          permanentUnlock: false,
          lastResetDate: new Date().toISOString().slice(0, 10),
          lastAdTime: null,
          adsWatchedToday: 0,
          history: [],
        },
      },

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log("✅ 使用限制記錄已創建\n");

    // 4. 驗證數據
    console.log("🔍 驗證創建的數據...");

    const userDoc = await db.collection("users").doc("test-user-001").get();
    console.log(`✅ 用戶文檔存在: ${userDoc.exists}`);

    const convDoc = await db.collection("conversations").doc("test-user-001::match-001").get();
    console.log(`✅ 對話文檔存在: ${convDoc.exists}`);

    const limitsDoc = await db.collection("usage_limits").doc("test-user-001").get();
    console.log(`✅ 限制文檔存在: ${limitsDoc.exists}`);

    console.log("\n📊 數據統計:");
    console.log(`   用戶名稱: ${userDoc.data()?.displayName}`);
    console.log(`   收藏角色數: ${userDoc.data()?.favorites?.length}`);
    console.log(`   對話訊息數: ${convDoc.data()?.messageCount}`);
    console.log(`   已用照片數: ${limitsDoc.data()?.photos?.count}`);
    console.log(`   已用對話數: ${limitsDoc.data()?.conversation?.["match-001"]?.count}`);

    console.log("\n🎉 測試數據創建成功！");
    console.log("\n💡 現在打開 Firestore UI 查看:");
    console.log("   http://localhost:4101/firestore");
    console.log("\n你應該會看到:");
    console.log("   📁 users (1 個文檔)");
    console.log("   📁 conversations (1 個文檔)");
    console.log("   📁 usage_limits (1 個文檔)");

    process.exit(0);
  } catch (error) {
    console.error("❌ 創建測試數據失敗:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedTestData();
