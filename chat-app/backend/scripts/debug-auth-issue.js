/**
 * 認證問題調試腳本
 * 用於診斷 401 錯誤和 Firebase 認證問題
 */

import 'dotenv/config';
import { getFirebaseAdminAuth } from '../src/firebase/index.js';
import logger from '../src/utils/logger.js';

/**
 * 測試 Firebase Admin SDK 配置
 */
async function testFirebaseConfig() {
  console.log('\n========== Firebase Admin SDK 配置測試 ==========\n');

  try {
    const auth = getFirebaseAdminAuth();
    console.log('✅ Firebase Admin SDK 初始化成功');

    // 檢查項目 ID
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    console.log(`📋 Project ID: ${projectId}`);

    if (!projectId) {
      console.error('❌ 缺少 FIREBASE_ADMIN_PROJECT_ID 環境變數');
      return false;
    }

    if (projectId !== 'chat-app-3-8a7ee') {
      console.warn(`⚠️ Project ID 不匹配預期值: ${projectId}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Firebase Admin SDK 初始化失敗:', error.message);
    return false;
  }
}

/**
 * 測試 token 驗證
 */
async function testTokenVerification(testToken) {
  console.log('\n========== Token 驗證測試 ==========\n');

  if (!testToken) {
    console.log('⏭️ 跳過 token 驗證測試（未提供測試 token）');
    console.log('💡 提示：您可以從瀏覽器開發者工具的 Network 標籤中複製 Authorization header 的 token');
    return;
  }

  try {
    const auth = getFirebaseAdminAuth();

    // 移除 "Bearer " 前綴（如果有）
    const cleanToken = testToken.replace(/^Bearer\s+/i, '').trim();

    console.log(`🔑 Token (前 30 字元): ${cleanToken.substring(0, 30)}...`);
    console.log('⏳ 正在驗證 token...\n');

    const decoded = await auth.verifyIdToken(cleanToken);

    console.log('✅ Token 驗證成功！');
    console.log(`👤 用戶 ID: ${decoded.uid}`);
    console.log(`📧 Email: ${decoded.email || '(無)'}`);
    console.log(`⏰ Token 簽發時間: ${new Date(decoded.iat * 1000).toLocaleString('zh-TW')}`);
    console.log(`⏰ Token 過期時間: ${new Date(decoded.exp * 1000).toLocaleString('zh-TW')}`);

    // 檢查是否過期
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      console.warn('⚠️ Token 已過期！');
    } else {
      const remainingMinutes = Math.floor((decoded.exp - now) / 60);
      console.log(`⏱️ Token 剩餘有效時間: ${remainingMinutes} 分鐘`);
    }

  } catch (error) {
    console.error('❌ Token 驗證失敗:', error.message);
    console.error('錯誤碼:', error.code || '無');

    if (error.code === 'auth/id-token-expired') {
      console.log('\n💡 解決方案：Token 已過期，請重新登入或刷新頁面');
    } else if (error.code === 'auth/invalid-id-token') {
      console.log('\n💡 解決方案：Token 格式無效，請確認從正確的地方複製 token');
    } else if (error.code === 'auth/argument-error') {
      console.log('\n💡 解決方案：Token 格式錯誤，確保沒有多餘的字元');
    }
  }
}

/**
 * 測試測試帳號配置
 */
function testTestAccountConfig() {
  console.log('\n========== 測試帳號配置 ==========\n');

  const isProduction = process.env.NODE_ENV === 'production';
  const enabledInProd = process.env.ENABLE_TEST_ACCOUNTS_IN_PROD === 'true';

  console.log(`🌍 環境: ${isProduction ? '生產環境' : '開發環境'}`);
  console.log(`🧪 測試帳號在生產環境啟用: ${enabledInProd ? '是' : '否'}`);

  if (isProduction && !enabledInProd) {
    console.log('⚠️ 測試帳號在生產環境已禁用（這是正常的安全措施）');
  }
}

/**
 * 測試 CORS 配置
 */
function testCORSConfig() {
  console.log('\n========== CORS 配置檢查 ==========\n');

  const corsOrigin = process.env.CORS_ORIGIN;

  if (!corsOrigin) {
    console.warn('⚠️ 缺少 CORS_ORIGIN 環境變數');
    return;
  }

  const allowedOrigins = corsOrigin.split(',').map(o => o.trim());

  console.log('✅ 允許的來源：');
  allowedOrigins.forEach(origin => {
    console.log(`   - ${origin}`);
  });

  // 檢查是否包含局域網 IP
  const hasLANIP = allowedOrigins.some(o => o.includes('192.168.'));
  if (hasLANIP) {
    console.log('✅ 包含局域網 IP 配置');
  } else {
    console.warn('⚠️ 未包含局域網 IP，如果從局域網訪問可能會有 CORS 問題');
  }
}

/**
 * 主函數
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║      Firebase 認證問題診斷工具                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 獲取命令行參數（可選的測試 token）
  const testToken = process.argv[2];

  // 執行所有測試
  await testFirebaseConfig();
  testTestAccountConfig();
  testCORSConfig();
  await testTokenVerification(testToken);

  console.log('\n========== 診斷完成 ==========\n');
  console.log('💡 常見問題解決方案：\n');
  console.log('1. 用戶未登入：');
  console.log('   - 在前端執行遊客登入或 Google 登入');
  console.log('   - 確認瀏覽器 localStorage 中有 auth 資料\n');

  console.log('2. Token 已過期：');
  console.log('   - 刷新頁面讓前端自動獲取新 token');
  console.log('   - 或重新登入\n');

  console.log('3. 局域網訪問問題：');
  console.log('   - 確認 CORS_ORIGIN 包含您的 IP（如 http://192.168.1.107:5173）');
  console.log('   - 確認前端 .env 的 VITE_API_URL 指向正確的後端地址\n');

  console.log('4. Firebase 配置問題：');
  console.log('   - 確認前後端的 FIREBASE_PROJECT_ID 一致');
  console.log('   - 確認 FIREBASE_ADMIN_PRIVATE_KEY 正確且完整\n');

  console.log('📖 使用方式：');
  console.log('   node scripts/debug-auth-issue.js');
  console.log('   node scripts/debug-auth-issue.js <your-token>  # 測試特定 token\n');
}

main().catch(error => {
  console.error('\n❌ 執行過程中發生錯誤:', error);
  process.exit(1);
});
