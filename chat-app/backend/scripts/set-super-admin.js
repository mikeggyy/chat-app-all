import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 載入環境變數（從 backend 目錄）
config({ path: join(__dirname, '..', '.env') });

// 動態導入 Firebase（在環境變數載入之後）
const { getFirebaseAdminAuth } = await import('../../../shared/backend-utils/firebase.js');

console.log('✅ Firebase Admin 初始化成功（使用環境變數配置）');

/**
 * 設置用戶為超級管理員
 * @param {string} email - 用戶 email
 */
async function setSuperAdmin(email) {
  const auth = getFirebaseAdminAuth();

  try {
    // 1. 根據 email 查找用戶
    console.log(`\n🔍 查找用戶: ${email}`);
    const user = await auth.getUserByEmail(email);
    console.log(`✅ 找到用戶:`);
    console.log(`   - UID: ${user.uid}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Email 已驗證: ${user.emailVerified}`);

    // 2. 查看當前的 Custom Claims
    console.log(`\n📋 當前 Custom Claims:`, user.customClaims || '(無)');

    // 3. 設置超級管理員權限
    console.log(`\n⚙️  設置超級管理員權限...`);
    await auth.setCustomUserClaims(user.uid, {
      super_admin: true,
      admin: true  // 同時保留 admin 權限
    });

    // 4. 驗證設置成功
    const updatedUser = await auth.getUser(user.uid);
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
