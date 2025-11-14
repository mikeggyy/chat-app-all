/**
 * 列出所有管理員用戶腳本
 * 顯示所有具有管理員權限的用戶
 *
 * 使用方式:
 * node scripts/list-admins.js
 */

import 'dotenv/config';
import { auth } from '../src/firebase/index.js';

async function listAdmins() {
  try {
    console.log('正在查找所有管理員用戶...\n');

    const admins = [];
    let pageToken;

    // 遍歷所有用戶（最多 5000 個）
    do {
      const listUsersResult = await auth.listUsers(1000, pageToken);

      for (const user of listUsersResult.users) {
        const claims = user.customClaims || {};

        // 檢查是否有管理員權限
        if (claims.super_admin || claims.admin || claims.moderator) {
          admins.push({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || '未設置',
            role: claims.super_admin
              ? 'super_admin'
              : claims.admin
              ? 'admin'
              : 'moderator',
            disabled: user.disabled,
          });
        }
      }

      pageToken = listUsersResult.pageToken;
    } while (pageToken && admins.length < 5000);

    // 顯示結果
    if (admins.length === 0) {
      console.log('❌ 沒有找到任何管理員用戶');
      console.log('\n💡 提示: 使用以下命令設置超級管理員:');
      console.log('   node scripts/set-super-admin.js <email或UID>');
      return;
    }

    console.log(`✅ 找到 ${admins.length} 個管理員用戶:\n`);

    // 按角色分組顯示
    const superAdmins = admins.filter((a) => a.role === 'super_admin');
    const regularAdmins = admins.filter((a) => a.role === 'admin');
    const moderators = admins.filter((a) => a.role === 'moderator');

    if (superAdmins.length > 0) {
      console.log('🔴 超級管理員 (super_admin):');
      superAdmins.forEach((admin) => {
        console.log(`  - ${admin.email} (${admin.uid})`);
        console.log(`    名稱: ${admin.displayName}`);
        console.log(`    狀態: ${admin.disabled ? '已停用' : '正常'}\n`);
      });
    }

    if (regularAdmins.length > 0) {
      console.log('🟡 管理員 (admin):');
      regularAdmins.forEach((admin) => {
        console.log(`  - ${admin.email} (${admin.uid})`);
        console.log(`    名稱: ${admin.displayName}`);
        console.log(`    狀態: ${admin.disabled ? '已停用' : '正常'}\n`);
      });
    }

    if (moderators.length > 0) {
      console.log('🟢 審核員 (moderator):');
      moderators.forEach((admin) => {
        console.log(`  - ${admin.email} (${admin.uid})`);
        console.log(`    名稱: ${admin.displayName}`);
        console.log(`    狀態: ${admin.disabled ? '已停用' : '正常'}\n`);
      });
    }

    console.log('─────────────────────────────────────');
    console.log('權限說明:');
    console.log('  super_admin - 完整權限（包括刪除用戶）');
    console.log('  admin       - 部分管理權限');
    console.log('  moderator   - 內容審核權限');

  } catch (error) {
    console.error('❌ 查找管理員失敗:', error);
    process.exit(1);
  }
}

listAdmins();
