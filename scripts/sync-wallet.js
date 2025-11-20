/**
 * 統一用戶金幣餘額腳本
 * 用於查詢和統一前後台金幣顯示
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 初始化 Firebase Admin
const serviceAccountPath = join(__dirname, '../chat-app/backend/serviceAccountKey.json');

try {
  const serviceAccount = await import(serviceAccountPath, { assert: { type: 'json' } });

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount.default),
    projectId: 'chat-app-3-8a7ee',
  });

  console.log('✅ Firebase Admin 已初始化');
} catch (error) {
  console.error('❌ Firebase Admin 初始化失敗:', error.message);
  process.exit(1);
}

const db = admin.firestore();

/**
 * 查詢用戶金幣餘額
 */
async function getUserWallet(userId) {
  const userDoc = await db.collection('users').doc(userId).get();

  if (!userDoc.exists) {
    throw new Error(`用戶 ${userId} 不存在`);
  }

  const userData = userDoc.data();

  // 支援多種金幣格式
  const coins = userData.coins || userData.walletBalance || userData.wallet?.balance || 0;

  return {
    userId,
    coins,
    walletBalance: userData.walletBalance,
    wallet: userData.wallet,
    rawData: {
      coins: userData.coins,
      walletBalance: userData.walletBalance,
      'wallet.balance': userData.wallet?.balance,
    },
  };
}

/**
 * 統一用戶金幣餘額
 * 將所有格式的金幣字段設為相同值
 */
async function unifyUserWallet(userId, targetBalance) {
  const userRef = db.collection('users').doc(userId);

  await userRef.update({
    coins: targetBalance,
    walletBalance: targetBalance,
    'wallet.balance': targetBalance,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ 用戶 ${userId} 的金幣已統一為: ${targetBalance}`);
}

/**
 * 主函數
 */
async function main() {
  const args = process.argv.slice(2);
  const userId = args[0] || '800_0'; // 預設用戶 ID
  const targetBalance = args[1] ? parseInt(args[1]) : null;

  console.log(`\n📊 查詢用戶 ${userId} 的金幣餘額...\n`);

  try {
    // 查詢當前金幣
    const wallet = await getUserWallet(userId);

    console.log('當前金幣狀態：');
    console.log('─────────────────────────────');
    console.log(`用戶 ID: ${wallet.userId}`);
    console.log(`主要餘額 (coins): ${wallet.rawData.coins || '未設置'}`);
    console.log(`錢包餘額 (walletBalance): ${wallet.rawData.walletBalance || '未設置'}`);
    console.log(`錢包對象 (wallet.balance): ${wallet.rawData['wallet.balance'] || '未設置'}`);
    console.log(`─────────────────────────────`);
    console.log(`✅ 計算後的餘額: ${wallet.coins}\n`);

    // 如果提供了目標金額，進行統一
    if (targetBalance !== null) {
      console.log(`\n🔄 統一金幣為: ${targetBalance}\n`);
      await unifyUserWallet(userId, targetBalance);

      // 驗證
      const updatedWallet = await getUserWallet(userId);
      console.log('\n驗證更新後的金幣：');
      console.log('─────────────────────────────');
      console.log(`coins: ${updatedWallet.rawData.coins}`);
      console.log(`walletBalance: ${updatedWallet.rawData.walletBalance}`);
      console.log(`wallet.balance: ${updatedWallet.rawData['wallet.balance']}`);
      console.log(`─────────────────────────────\n`);
    } else {
      console.log('💡 提示：如需統一金幣，請提供目標金額');
      console.log(`   用法: node scripts/sync-wallet.js ${userId} <目標金額>\n`);
      console.log(`   例如: node scripts/sync-wallet.js ${userId} 1500\n`);
    }

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
