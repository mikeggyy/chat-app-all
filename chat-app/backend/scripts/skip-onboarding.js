/**
 * 跳過 Onboarding 流程
 * 直接將用戶標記為已完成首次設置
 */

import 'dotenv/config';
import { getFirestoreDb } from '../src/firebase/index.js';

const userId = process.argv[2];

if (!userId) {
  console.error('❌ 請提供用戶 ID');
  console.log('使用方式: node scripts/skip-onboarding.js <userId>');
  process.exit(1);
}

async function skipOnboarding(userId) {
  console.log(`\n正在為用戶 ${userId} 跳過 onboarding...\n`);

  try {
    const db = getFirestoreDb();
    const userRef = db.collection('users').doc(userId);

    // 檢查用戶是否存在
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error('❌ 用戶不存在');
      return;
    }

    const userData = userDoc.data();
    console.log('當前用戶資料:');
    console.log(`  - hasCompletedOnboarding: ${userData.hasCompletedOnboarding}`);
    console.log(`  - gender: ${userData.gender || '(未設置)'}`);
    console.log(`  - age: ${userData.age || '(未設置)'}`);

    // 更新 hasCompletedOnboarding
    await userRef.update({
      hasCompletedOnboarding: true,
      updatedAt: new Date().toISOString(),
    });

    console.log('\n✅ 成功更新用戶資料');
    console.log('用戶現在可以直接使用應用，不會再看到 onboarding 頁面');

  } catch (error) {
    console.error('❌ 更新失敗:', error.message);
  }
}

skipOnboarding(userId)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('執行失敗:', error);
    process.exit(1);
  });
