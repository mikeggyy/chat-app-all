import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加載環境變數
dotenv.config({ path: join(__dirname, 'chat-app', 'backend', '.env') });

// 初始化 Firebase Admin（使用環境變數）
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const userId = 'U7AqYhvoOQXXIE519oUdHb1zFy83';

console.log(`檢查用戶 ${userId} 的金幣數據...\n`);

async function checkUserCoins() {
  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log('❌ 用戶不存在');
      return;
    }

    const data = userDoc.data();

    console.log('✅ Firestore 中的實際數據：');
    console.log('=====================================');

    // 檢查所有可能的金幣欄位
    console.log('🔍 金幣相關欄位：');
    console.log('  wallet:', data.wallet ? JSON.stringify(data.wallet, null, 2) : '❌ 不存在');
    console.log('  walletBalance:', data.walletBalance ?? '❌ 不存在');
    console.log('  coins:', data.coins ?? '❌ 不存在');
    console.log('  wallet.balance (物件欄位):', data['wallet.balance'] ?? '❌ 不存在');

    console.log('\n📊 主應用會讀取到的金幣（依據優先順序）：');
    let actualBalance = 0;
    let source = '';

    if (data.wallet && typeof data.wallet.balance === 'number') {
      actualBalance = data.wallet.balance;
      source = 'wallet.balance（新格式，優先級最高）';
    } else if (typeof data.walletBalance === 'number') {
      actualBalance = data.walletBalance;
      source = 'walletBalance（舊格式1）';
    } else if (typeof data.coins === 'number') {
      actualBalance = data.coins;
      source = 'coins（舊格式2）';
    } else {
      actualBalance = 0;
      source = '默認值（所有欄位都不存在）';
    }

    console.log(`  💰 實際金幣: ${actualBalance}`);
    console.log(`  📍 數據來源: ${source}`);

    console.log('\n⚠️ 問題診斷：');

    // 檢查是否有錯誤的欄位名
    if (data['wallet.balance'] !== undefined) {
      console.log('  ❌ 發現錯誤欄位 "wallet.balance"（字串作為欄位名）');
      console.log('     這個欄位不會被主應用讀取！');
      console.log(`     錯誤值：${data['wallet.balance']}`);
    }

    // 檢查 wallet 物件結構
    if (data.wallet && typeof data.wallet !== 'object') {
      console.log('  ❌ wallet 欄位不是物件類型');
    } else if (data.wallet && typeof data.wallet.balance !== 'number') {
      console.log('  ⚠️ wallet 物件存在，但 wallet.balance 不是數字');
    }

    // 檢查數據不一致
    const allValues = [
      data.wallet?.balance,
      data.walletBalance,
      data.coins,
      data['wallet.balance']
    ].filter(v => v !== undefined);

    const uniqueValues = new Set(allValues);
    if (uniqueValues.size > 1) {
      console.log('  ⚠️ 多個金幣欄位的值不一致：', Array.from(uniqueValues));
    }

  } catch (error) {
    console.error('❌ 檢查失敗:', error.message);
  } finally {
    process.exit(0);
  }
}

checkUserCoins();
