/**
 * 設置用戶管理員權限
 * 用法: node scripts/set-admin.js <email>
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 載入環境變數
dotenv.config({ path: join(__dirname, '..', '.env') });

const email = process.argv[2] || 'mike666@admin.com';

// 初始化 Firebase Admin
function initFirebase() {
  if (getApps().length > 0) return;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('缺少 Firebase Admin 環境變數');
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
  });
}

async function setAdminClaim() {
  try {
    initFirebase();
    const auth = getAuth();

    // 通過 email 獲取用戶
    const user = await auth.getUserByEmail(email);
    console.log(`找到用戶: ${user.uid} (${user.email})`);

    // 設置管理員權限
    await auth.setCustomUserClaims(user.uid, {
      admin: true,
      super_admin: true
    });

    console.log(`✅ 已設置管理員權限給 ${email}`);
    console.log('請重新登入後臺');

    process.exit(0);
  } catch (error) {
    console.error('❌ 設置失敗:', error.message);
    process.exit(1);
  }
}

setAdminClaim();
