import "dotenv/config";
import { getFirestoreDb, FieldValue } from "../src/firebase/index.js";

// 歡迎新用戶通知
const WELCOME_NOTIFICATION = {
  title: "🎉 歡迎加入 AI 聊天！",
  message: "感謝您加入我們！立即開始與 AI 角色展開精彩對話吧！",
  fullContent: `親愛的新朋友，歡迎加入 AI 聊天應用！

🌟 開始您的旅程
在這裡，您可以與各種獨特的 AI 角色進行真實有趣的對話。每個角色都有自己的個性和故事，等著與您互動。

✨ 新手福利
• 免費體驗多位 AI 角色對話
• 每日免費語音訊息額度
• 觀看廣告可解鎖更多次數

💡 小提示
• 點擊「配對」發現新角色
• 收藏喜歡的角色方便再次對話
• 升級 VIP 享受無限對話特權

如有任何問題，歡迎隨時聯繫我們！
祝您聊天愉快！ 🎊`,
  type: "system",
  category: "系統公告",
  priority: 1,  // NORMAL
  actions: [
    {
      label: "開始配對",
      type: "primary",
      route: "/match"
    },
    {
      label: "查看會員方案",
      type: "secondary",
      route: "/membership"
    }
  ],
  isActive: true,
};

async function importWelcomeNotification() {
  console.log("正在連接 Firestore...");
  const db = getFirestoreDb();

  console.log("正在導入歡迎通知...");

  const now = new Date();
  const notificationData = {
    ...WELCOME_NOTIFICATION,
    startDate: now,
    endDate: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = await db.collection("notifications").add(notificationData);
    console.log(`✅ 歡迎通知創建成功！`);
    console.log(`   ID: ${docRef.id}`);
    console.log(`   標題: ${WELCOME_NOTIFICATION.title}`);
    console.log(`   分類: ${WELCOME_NOTIFICATION.category}`);
    console.log(`   狀態: ${WELCOME_NOTIFICATION.isActive ? "啟用" : "停用"}`);
  } catch (error) {
    console.error("❌ 導入失敗:", error);
    throw error;
  }

  console.log("\n🎉 導入完成！");
}

// 執行導入
importWelcomeNotification()
  .then(() => {
    console.log("腳本執行完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("腳本執行失敗:", error);
    process.exit(1);
  });
