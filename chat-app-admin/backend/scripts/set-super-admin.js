/**
 * 設置超級管理員權限腳本
 * 用於為指定用戶添加 super_admin 權限
 *
 * 使用方式:
 * node scripts/set-super-admin.js <email或UID>
 *
 * 例如:
 * node scripts/set-super-admin.js mike465@admin.com
 * node scripts/set-super-admin.js <user-uid>
 */

import 'dotenv/config';
import { auth } from '../src/firebase/index.js';

async function setSuperAdmin(emailOrUid) {
  try {
    console.log(`正在查找用戶: ${emailOrUid}`);

    // 嘗試獲取用戶
    let userRecord;
    try {
      // 先嘗試作為 UID 查找
      userRecord = await auth.getUser(emailOrUid);
    } catch (error) {
      // 如果不是 UID，嘗試作為 email 查找
      try {
        userRecord = await auth.getUserByEmail(emailOrUid);
      } catch (emailError) {
        console.error('❌ 找不到用戶:', emailOrUid);
        console.error('請確認輸入的 Email 或 UID 是否正確');
        process.exit(1);
      }
    }

    console.log('\n找到用戶:');
    console.log(`UID: ${userRecord.uid}`);
    console.log(`Email: ${userRecord.email}`);
    console.log(`顯示名稱: ${userRecord.displayName || '未設置'}`);

    // 顯示當前權限
    console.log('\n當前 Custom Claims:');
    console.log(JSON.stringify(userRecord.customClaims || {}, null, 2));

    // 設置 super_admin 權限
    console.log('\n正在設置 super_admin 權限...');
    await auth.setCustomUserClaims(userRecord.uid, {
      super_admin: true,
    });

    // 驗證設置
    const updatedUser = await auth.getUser(userRecord.uid);
    console.log('\n✅ 權限設置成功！');
    console.log('新的 Custom Claims:');
    console.log(JSON.stringify(updatedUser.customClaims, null, 2));

    console.log('\n⚠️ 重要提示:');
    console.log('1. 用戶需要重新登入才能獲取新的權限');
    console.log('2. 或者等待 Firebase Token 自動刷新（約 1 小時）');
    console.log('3. 管理後臺請刷新頁面或重新登入');

  } catch (error) {
    console.error('❌ 設置權限失敗:', error);
    process.exit(1);
  }
}

// 從命令行參數獲取 email 或 UID
const emailOrUid = process.argv[2];

if (!emailOrUid) {
  console.error('❌ 請提供用戶的 Email 或 UID');
  console.log('\n使用方式:');
  console.log('  node scripts/set-super-admin.js <email或UID>');
  console.log('\n例如:');
  console.log('  node scripts/set-super-admin.js mike465@admin.com');
  console.log('  node scripts/set-super-admin.js 6FXftJp96WeXYqAO4vRYs52EFXN2');
  process.exit(1);
}

setSuperAdmin(emailOrUid);
