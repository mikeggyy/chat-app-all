import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 初始化 Firebase Admin
// 使用用戶下載的 service account key
const serviceAccountPath = 'C:\\Users\\User\\Downloads\\chat-app-3-8a7ee-firebase-adminsdk-fbsvc-4b26e4d530.json';

try {
  const { default: serviceAccount } = await import(serviceAccountPath, { assert: { type: 'json' } });

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'chat-app-3-8a7ee'
  });

  console.log('✅ Firebase Admin 初始化成功');
} catch (error) {
  console.error('❌ Firebase Admin 初始化失敗:', error.message);
  process.exit(1);
}

/**
 * 設置用戶為超級管理員
 * @param {string} email - 用戶 email
 */
async function setSuperAdmin(email) {
  try {
    // 1. 根據 email 查找用戶
    console.log(`\n🔍 查找用戶: ${email}`);
    const user = await admin.auth().getUserByEmail(email);
    console.log(`✅ 找到用戶:`);
    console.log(`   - UID: ${user.uid}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Email 已驗證: ${user.emailVerified}`);

    // 2. 查看當前的 Custom Claims
    console.log(`\n📋 當前 Custom Claims:`, user.customClaims || '(無)');

    // 3. 設置超級管理員權限
    console.log(`\n⚙️  設置超級管理員權限...`);
    await admin.auth().setCustomUserClaims(user.uid, {
      super_admin: true,
      admin: true  // 同時保留 admin 權限
    });

    // 4. 驗證設置成功
    const updatedUser = await admin.auth().getUser(user.uid);
    console.log(`\n✅ 權限設置成功！`);
    console.log(`📋 更新後的 Custom Claims:`, updatedUser.customClaims);

    console.log(`\n🎉 ${email} 已成功設置為超級管理員！`);
    console.log(`\n⚠️  注意: 用戶需要重新登入才能使權限生效。`);

  } catch (error) {
    console.error(`\n❌ 設置失敗:`, error.message);
    if (error.code === 'auth/user-not-found') {
      console.error(`   用戶 ${email} 不存在，請先創建此用戶。`);
    }
    throw error;
  }
}

// 執行腳本
const targetEmail = 'mike666@admin.com';
console.log('🚀 開始設置超級管理員...');
console.log(`📧 目標用戶: ${targetEmail}`);

setSuperAdmin(targetEmail)
  .then(() => {
    console.log('\n✨ 完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 執行失敗:', error);
    process.exit(1);
  });
