/**
 * 快速測試腳本：為指定用戶添加金幣
 * 用法：node scripts/add-test-coins.js <userId> [amount]
 */

import 'dotenv/config';
import { getFirestoreDb } from '../src/firebase/index.js';
import { FieldValue } from 'firebase-admin/firestore';

const addCoinsToUser = async (userId, amount = 10000) => {
  try {
    const db = getFirestoreDb();
    const userRef = db.collection('users').doc(userId);

    // 檢查用戶是否存在
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`❌ 找不到用戶 ID: ${userId}`);
      console.log(`提示：請先登入一次以創建用戶資料`);
      return;
    }

    const userData = userDoc.data();
    const currentCoins = userData.walletBalance || userData.coins || 0;

    // 更新金幣（與 coins.service.js 邏輯一致）
    const newBalance = currentCoins + amount;
    await userRef.update({
      walletBalance: newBalance,
      'wallet.balance': newBalance,
      coins: newBalance,
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ 成功為用戶添加金幣！`);
    console.log(`   用戶 ID: ${userId}`);
    console.log(`   原有金幣: ${currentCoins}`);
    console.log(`   添加金幣: ${amount}`);
    console.log(`   新的金幣: ${currentCoins + amount}`);
    console.log(`\n💡 請重新整理前端頁面以查看更新`);

  } catch (error) {
    console.error('❌ 添加金幣失敗:', error.message);
  }
};

// 解析命令行參數
const args = process.argv.slice(2);
const userId = args[0];
const amount = parseInt(args[1]) || 10000;

if (!userId) {
  console.log(`
使用方法：
  node scripts/add-test-coins.js <userId> [amount]

範例：
  node scripts/add-test-coins.js iY2JfwrZAHLpMo21AYg6Xft5lGGb
  node scripts/add-test-coins.js iY2JfwrZAHLpMo21AYg6Xft5lGGb 50000

參數：
  userId  - 用戶 ID（必填）
  amount  - 要添加的金幣數量（選填，預設 10000）

💡 如何找到你的用戶 ID：
  1. 開啟 http://localhost:4101
  2. 點擊 Firestore
  3. 查看 users collection
  `);
  process.exit(1);
}

console.log(`\n🪙 開始為用戶添加金幣...\n`);
addCoinsToUser(userId, amount).then(() => {
  process.exit(0);
});
