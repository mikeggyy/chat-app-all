import dotenv from 'dotenv';
dotenv.config();

import { db, FieldValue } from './src/firebase/index.js';

const userId = 'U7AqYhvoOQXXIE519oUdHb1zFy83';

console.log(`修復用戶 ${userId} 的錢包數據...\n`);

async function fixUserWallet() {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log('❌ 用戶不存在');
      return;
    }

    const data = userDoc.data();

    console.log('📊 當前數據：');
    console.log('  wallet:', data.wallet ? JSON.stringify(data.wallet) : '不存在');
    console.log('  walletBalance:', data.walletBalance ?? '不存在');
    console.log('  coins:', data.coins ?? '不存在');
    console.log('  "wallet.balance" (錯誤欄位):', data['wallet.balance'] ?? '不存在');

    // 確定正確的金幣數量（優先順序：wallet.balance > walletBalance > coins）
    let correctBalance = 0;
    if (data.wallet && typeof data.wallet.balance === 'number') {
      correctBalance = data.wallet.balance;
      console.log(`\n✅ 使用 wallet.balance: ${correctBalance}`);
    } else if (typeof data.walletBalance === 'number') {
      correctBalance = data.walletBalance;
      console.log(`\n✅ 使用 walletBalance: ${correctBalance}`);
    } else if (typeof data.coins === 'number') {
      correctBalance = data.coins;
      console.log(`\n✅ 使用 coins: ${correctBalance}`);
    } else if (typeof data['wallet.balance'] === 'number') {
      correctBalance = data['wallet.balance'];
      console.log(`\n⚠️ 使用錯誤欄位 "wallet.balance": ${correctBalance}`);
    } else {
      console.log('\n❌ 找不到任何金幣數據，使用默認值 0');
    }

    // 修復：統一更新為正確的結構
    const updates = {
      wallet: {
        balance: correctBalance,
        currency: data.wallet?.currency || "TWD",
        updatedAt: new Date().toISOString(),
      },
      walletBalance: correctBalance,
      coins: correctBalance,
      updatedAt: new Date().toISOString(),
    };

    // 刪除錯誤的 "wallet.balance" 欄位（如果存在）
    if (data['wallet.balance'] !== undefined) {
      updates['wallet.balance'] = FieldValue.delete();
      console.log('\n🗑️ 刪除錯誤欄位 "wallet.balance"');
    }

    console.log('\n🔧 開始修復...');
    await userRef.set(updates, { merge: true });

    console.log('\n✅ 修復完成！新的數據結構：');
    const updatedDoc = await userRef.get();
    const updatedData = updatedDoc.data();
    console.log('  wallet:', JSON.stringify(updatedData.wallet));
    console.log('  walletBalance:', updatedData.walletBalance);
    console.log('  coins:', updatedData.coins);
    console.log(`\n💰 最終金幣數量: ${correctBalance}`);

    console.log('\n⏱️ 主應用緩存將在 60 秒內過期，之後會顯示正確的金幣數量');
    console.log('💡 或者重新登入立即生效');

  } catch (error) {
    console.error('❌ 修復失敗:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

fixUserWallet();
