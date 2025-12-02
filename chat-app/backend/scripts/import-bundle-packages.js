/**
 * 組合禮包數據導入腳本
 * 將組合禮包配置導入到 Firestore
 *
 * 用法: node scripts/import-bundle-packages.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加載環境變數
dotenv.config({ path: join(__dirname, '../.env') });

// 使用項目的 Firebase 初始化
const { getFirestoreDb } = await import('../src/firebase/index.js');
const db = getFirestoreDb();

console.log('✅ Firebase 初始化成功 (使用項目配置)');

/**
 * 組合禮包數據
 * 對應 /api/bundles 端點
 *
 * 購買限制 (purchaseLimit):
 * - "once": 終身限購 1 次
 * - "monthly": 每月限購 1 次
 * - "weekly": 每週限購 1 次
 * - "none" 或 undefined: 無限制
 */
const BUNDLE_PACKAGES_DATA = [
  {
    id: 'bundle_starter',
    name: '新手禮包',
    description: '新手入門必備，體驗所有功能',
    price: 99,
    currency: 'TWD',
    order: 1,
    contents: {
      coins: 100,                         // 100 金幣
      photoUnlockCards: 3,                // 3 張照片卡
      characterUnlockCards: 1,            // 1 張角色解鎖券
    },
    badge: '🌟 限購一次',
    popular: true,
    purchaseLimit: 'once',                // 終身限購 1 次
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bundle_value',
    name: '月度禮包',
    description: '每月限定，重度用戶首選',
    price: 299,
    currency: 'TWD',
    order: 2,
    contents: {
      coins: 500,                         // 500 金幣
      photoUnlockCards: 10,               // 10 張照片卡
      videoUnlockCards: 3,                // 3 張影片卡
      characterUnlockCards: 3,            // 3 張角色解鎖券
    },
    badge: '🔥 每月限購',
    popular: false,
    purchaseLimit: 'monthly',             // 每月限購 1 次
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bundle_premium',
    name: '尊榮禮包',
    description: '最划算的頂級組合',
    price: 599,
    currency: 'TWD',
    order: 3,
    contents: {
      coins: 1500,                        // 1500 金幣
      photoUnlockCards: 30,               // 30 張照片卡
      videoUnlockCards: 10,               // 10 張影片卡
      characterUnlockCards: 5,            // 5 張角色解鎖券
      characterCreationCards: 2,          // 2 張角色創建卡
    },
    badge: '💎 最超值',
    popular: false,
    bestValue: true,
    purchaseLimit: 'none',                // 無限制
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'bundle_weekly',
    name: '週末特惠包',
    description: '每週限定優惠',
    price: 49,
    currency: 'TWD',
    order: 4,
    contents: {
      coins: 50,                          // 50 金幣
      photoUnlockCards: 2,                // 2 張照片卡
    },
    badge: '⚡ 每週限購',
    popular: false,
    purchaseLimit: 'weekly',              // 每週限購 1 次
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * 導入組合禮包數據到 Firestore
 */
async function importBundlePackages() {
  console.log('🚀 開始導入組合禮包數據...\n');

  const batch = db.batch();
  const collection = db.collection('bundle_packages');

  for (const pkg of BUNDLE_PACKAGES_DATA) {
    const docRef = collection.doc(pkg.id);
    batch.set(docRef, pkg, { merge: true });

    console.log(`✅ 準備導入: ${pkg.name}`);
    console.log(`   - 價格: ${pkg.price} ${pkg.currency}`);
    console.log(`   - 內容:`);
    if (pkg.contents.coins) console.log(`     · 金幣: ${pkg.contents.coins}`);
    if (pkg.contents.photoUnlockCards) console.log(`     · 照片卡: ${pkg.contents.photoUnlockCards}`);
    if (pkg.contents.videoUnlockCards) console.log(`     · 影片卡: ${pkg.contents.videoUnlockCards}`);
    if (pkg.contents.characterUnlockCards) console.log(`     · 角色解鎖券: ${pkg.contents.characterUnlockCards}`);
    if (pkg.contents.characterCreationCards) console.log(`     · 角色創建卡: ${pkg.contents.characterCreationCards}`);
    console.log(`   - 購買限制: ${pkg.purchaseLimit || '無'}`);
    console.log(`   - 排序: ${pkg.order}\n`);
  }

  try {
    await batch.commit();
    console.log('✅ 組合禮包數據導入成功!\n');

    // 驗證導入結果
    console.log('🔍 驗證導入結果...');
    const snapshot = await collection.where('status', '==', 'active').get();
    console.log(`✅ 成功導入 ${snapshot.size} 個組合禮包\n`);

    // 顯示導入的禮包列表
    console.log('📋 導入的組合禮包:');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.name}: ${data.price} ${data.currency} (${data.purchaseLimit || '無限購'})`);
    });

  } catch (error) {
    console.error('❌ 導入失敗:', error);
    throw error;
  }
}

/**
 * 主函數
 */
async function main() {
  try {
    await importBundlePackages();
    console.log('\n🎉 所有操作完成!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 執行失敗:', error);
    process.exit(1);
  }
}

// 執行
main();
