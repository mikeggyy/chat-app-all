/**
 * 檢查用戶資料
 * 查看用戶在資料庫中的實際數據
 */

import 'dotenv/config';
import { getFirestoreDb } from '../src/firebase/index.js';

const userId = process.argv[2];

if (!userId) {
  console.error('❌ 請提供用戶 ID');
  console.log('使用方式: node scripts/check-user-data.js <userId>');
  process.exit(1);
}

async function checkUserData(userId) {
  console.log(`\n========== 用戶資料檢查 ==========\n`);
  console.log(`用戶 ID: ${userId}\n`);

  try {
    const db = getFirestoreDb();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error('❌ 用戶不存在於資料庫中');
      console.log('\n這可能是因為：');
      console.log('1. 用戶剛剛註冊，資料尚未創建');
      console.log('2. 用戶 ID 錯誤');
      return;
    }

    const userData = userDoc.data();

    console.log('✅ 找到用戶資料：\n');
    console.log('基本資料:');
    console.log(`  - displayName: ${userData.displayName || '(未設置)'}`);
    console.log(`  - email: ${userData.email || '(未設置)'}`);
    console.log(`  - photoURL: ${userData.photoURL || '(未設置)'}`);
    console.log();

    console.log('個人資料:');
    console.log(`  - gender: ${userData.gender || '(未設置)'}`);
    console.log(`  - age: ${userData.age || '(未設置)'}`);
    console.log(`  - hasCompletedOnboarding: ${userData.hasCompletedOnboarding ?? '(未設置)'}`);
    console.log();

    console.log('會員資料:');
    console.log(`  - membershipTier: ${userData.membershipTier || 'free'}`);
    console.log(`  - coins: ${userData.coins || 0}`);
    console.log();

    console.log('時間戳記:');
    console.log(`  - createdAt: ${userData.createdAt || '(未設置)'}`);
    console.log(`  - updatedAt: ${userData.updatedAt || '(未設置)'}`);
    console.log(`  - lastLoginAt: ${userData.lastLoginAt || '(未設置)'}`);
    console.log();

    console.log('其他資料:');
    console.log(`  - favorites: ${JSON.stringify(userData.favorites || [])}`);
    console.log(`  - conversations: ${JSON.stringify(userData.conversations || [])}`);
    console.log();

    // 檢查 onboarding 狀態
    console.log('========== Onboarding 狀態分析 ==========\n');

    if (userData.hasCompletedOnboarding === true) {
      console.log('✅ 用戶已完成 onboarding');
      console.log('   理論上不應該再顯示 onboarding 頁面');
      console.log();
      console.log('如果前端仍然顯示 onboarding 頁面，可能原因：');
      console.log('1. 前端緩存未更新（建議刷新頁面）');
      console.log('2. 前端路由守衛邏輯有問題');
      console.log('3. API 返回的資料有問題');
    } else if (userData.hasCompletedOnboarding === false) {
      console.log('⚠️ 用戶尚未完成 onboarding (hasCompletedOnboarding = false)');
      console.log('   前端正確地顯示了 onboarding 頁面');
      console.log();
      console.log('解決方案：');
      console.log('1. 在前端完成 onboarding 流程');
      console.log('2. 或執行：node scripts/skip-onboarding.js ' + userId);
    } else {
      console.log('⚠️ hasCompletedOnboarding 欄位不存在或為 undefined');
      console.log('   這會被前端視為未完成 onboarding');
      console.log();
      console.log('解決方案：');
      console.log('執行：node scripts/skip-onboarding.js ' + userId);
    }

    console.log();

  } catch (error) {
    console.error('❌ 查詢失敗:', error.message);
  }
}

checkUserData(userId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('執行失敗:', error);
    process.exit(1);
  });
