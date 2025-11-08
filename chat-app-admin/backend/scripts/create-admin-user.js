/**
 * 創建管理員用戶腳本
 *
 * 用途：在 Firebase Emulator 中創建測試管理員帳號
 * 運行：node scripts/create-admin-user.js
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { auth } from "../src/firebase/index.js";

const ADMIN_USERS = [
  {
    email: "mike666@admin.com",
    password: "12345678",
    displayName: "Mike (超級管理員)",
    role: "super_admin",
  },
  {
    email: "admin@test.com",
    password: "admin123",
    displayName: "Admin (一般管理員)",
    role: "admin",
  },
  {
    email: "moderator@test.com",
    password: "mod123",
    displayName: "Moderator (內容審核員)",
    role: "moderator",
  },
];

async function createAdminUser(userData) {
  try {
    console.log(`\n📝 創建用戶: ${userData.email}`);

    // 創建用戶
    const userRecord = await auth.createUser({
      email: userData.email,
      password: userData.password,
      displayName: userData.displayName,
      emailVerified: true, // 自動驗證郵箱
    });

    console.log(`✅ 用戶已創建: ${userRecord.uid}`);

    // 設置自定義聲明（權限）
    const claims = {};
    claims[userData.role] = true;

    await auth.setCustomUserClaims(userRecord.uid, claims);

    console.log(`✅ 權限已設置: ${userData.role}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   密碼: ${userData.password}`);
    console.log(`   UID: ${userRecord.uid}`);

    return userRecord;
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      console.log(`⚠️  用戶已存在: ${userData.email}`);

      // 獲取現有用戶並更新權限
      try {
        const existingUser = await auth.getUserByEmail(userData.email);
        const claims = {};
        claims[userData.role] = true;
        await auth.setCustomUserClaims(existingUser.uid, claims);

        console.log(`✅ 已更新現有用戶權限: ${userData.role}`);
        console.log(`   UID: ${existingUser.uid}`);

        return existingUser;
      } catch (updateError) {
        console.error(`❌ 更新用戶失敗:`, updateError.message);
      }
    } else {
      console.error(`❌ 創建用戶失敗:`, error.message);
    }
    return null;
  }
}

async function main() {
  const isEmulator = process.env.USE_FIREBASE_EMULATOR === "true";

  console.log("🚀 開始創建管理員帳號...\n");

  if (isEmulator) {
    console.log("⚠️  使用 Firebase Emulator 模式");
    console.log("⚠️  請確保 Firebase Emulator 正在運行！\n");
  } else {
    console.log("✅ 使用真實 Firebase 生產環境");
    console.log(`✅ 項目: ${process.env.FIREBASE_ADMIN_PROJECT_ID}\n`);
  }

  for (const userData of ADMIN_USERS) {
    await createAdminUser(userData);
  }

  console.log("\n✨ 完成！\n");
  console.log("📋 管理員帳號列表：");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("1. 超級管理員");
  console.log("   Email: mike666@admin.com");
  console.log("   密碼: 12345678");
  console.log("   權限: super_admin (完整權限)");
  console.log("\n2. 一般管理員");
  console.log("   Email: admin@test.com");
  console.log("   密碼: admin123");
  console.log("   權限: admin (部分權限)");
  console.log("\n3. 內容審核員");
  console.log("   Email: moderator@test.com");
  console.log("   密碼: mod123");
  console.log("   權限: moderator (僅審核權限)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("💡 使用方式：");
  console.log("   1. 訪問管理後臺: http://localhost:5174");
  console.log("   2. 使用郵箱密碼登入");
  console.log("   3. 輸入上述任一組帳號密碼即可登入\n");

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ 執行失敗:", error);
  process.exit(1);
});
