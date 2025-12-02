/**
 * 資產套餐數據導入腳本
 * 將資產套餐（解鎖卡、創建卡等）配置導入到 Firestore
 *
 * 用法: node scripts/import-asset-packages.js
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
 * 資產套餐數據
 * 對應 /api/assets/packages 端點
 */
const ASSET_PACKAGES_DATA = [
  // ========== 角色解鎖卡 ==========
  {
    id: 'character-unlock-1',
    sku: 'character-unlock-1',
    category: 'character-unlock',
    baseId: 'character-unlock',
    name: '角色解鎖卡 x1',
    displayName: '1 張',
    description: '解鎖一個角色 7 天',
    icon: '🎭',
    iconColor: 'character',
    quantity: 1,
    quantityUnit: '張',
    basePrice: 100,
    finalPrice: 100,
    originalPrice: null,
    discountRate: 1,
    badge: null,
    popular: false,
    status: 'active',
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'character-unlock-3',
    sku: 'character-unlock-3',
    category: 'character-unlock',
    baseId: 'character-unlock',
    name: '角色解鎖卡 x3',
    displayName: '3 張',
    description: '解鎖三個角色各 7 天',
    icon: '🎭',
    iconColor: 'character',
    quantity: 3,
    quantityUnit: '張',
    basePrice: 300,
    finalPrice: 270,
    originalPrice: 300,
    discountRate: 0.9,
    badge: '9折',
    popular: true,
    status: 'active',
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'character-unlock-5',
    sku: 'character-unlock-5',
    category: 'character-unlock',
    baseId: 'character-unlock',
    name: '角色解鎖卡 x5',
    displayName: '5 張',
    description: '解鎖五個角色各 7 天',
    icon: '🎭',
    iconColor: 'character',
    quantity: 5,
    quantityUnit: '張',
    basePrice: 500,
    finalPrice: 400,
    originalPrice: 500,
    discountRate: 0.8,
    badge: '8折',
    popular: false,
    status: 'active',
    order: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ========== 照片解鎖卡 ==========
  {
    id: 'photo-unlock-1',
    sku: 'photo-unlock-1',
    category: 'photo-unlock',
    baseId: 'photo-unlock',
    name: '照片解鎖卡 x1',
    displayName: '1 張',
    description: '解鎖一張 AI 生成照片',
    icon: '📸',
    iconColor: 'photo',
    quantity: 1,
    quantityUnit: '張',
    basePrice: 25,
    finalPrice: 25,
    originalPrice: null,
    discountRate: 1,
    badge: null,
    popular: false,
    status: 'active',
    order: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'photo-unlock-5',
    sku: 'photo-unlock-5',
    category: 'photo-unlock',
    baseId: 'photo-unlock',
    name: '照片解鎖卡 x5',
    displayName: '5 張',
    description: '解鎖五張 AI 生成照片',
    icon: '📸',
    iconColor: 'photo',
    quantity: 5,
    quantityUnit: '張',
    basePrice: 125,
    finalPrice: 100,
    originalPrice: 125,
    discountRate: 0.8,
    badge: '8折',
    popular: true,
    status: 'active',
    order: 11,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'photo-unlock-10',
    sku: 'photo-unlock-10',
    category: 'photo-unlock',
    baseId: 'photo-unlock',
    name: '照片解鎖卡 x10',
    displayName: '10 張',
    description: '解鎖十張 AI 生成照片',
    icon: '📸',
    iconColor: 'photo',
    quantity: 10,
    quantityUnit: '張',
    basePrice: 250,
    finalPrice: 175,
    originalPrice: 250,
    discountRate: 0.7,
    badge: '7折',
    popular: false,
    status: 'active',
    order: 12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ========== 影片解鎖卡 ==========
  {
    id: 'video-unlock-1',
    sku: 'video-unlock-1',
    category: 'video-unlock',
    baseId: 'video-unlock',
    name: '影片解鎖卡 x1',
    displayName: '1 張',
    description: '解鎖一部 AI 生成影片',
    icon: '🎬',
    iconColor: 'video',
    quantity: 1,
    quantityUnit: '張',
    basePrice: 60,
    finalPrice: 60,
    originalPrice: null,
    discountRate: 1,
    badge: null,
    popular: false,
    status: 'active',
    order: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'video-unlock-3',
    sku: 'video-unlock-3',
    category: 'video-unlock',
    baseId: 'video-unlock',
    name: '影片解鎖卡 x3',
    displayName: '3 張',
    description: '解鎖三部 AI 生成影片',
    icon: '🎬',
    iconColor: 'video',
    quantity: 3,
    quantityUnit: '張',
    basePrice: 180,
    finalPrice: 150,
    originalPrice: 180,
    discountRate: 0.83,
    badge: '83折',
    popular: true,
    status: 'active',
    order: 21,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'video-unlock-5',
    sku: 'video-unlock-5',
    category: 'video-unlock',
    baseId: 'video-unlock',
    name: '影片解鎖卡 x5',
    displayName: '5 張',
    description: '解鎖五部 AI 生成影片',
    icon: '🎬',
    iconColor: 'video',
    quantity: 5,
    quantityUnit: '張',
    basePrice: 300,
    finalPrice: 225,
    originalPrice: 300,
    discountRate: 0.75,
    badge: '75折',
    popular: false,
    status: 'active',
    order: 22,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // ========== 角色創建卡 ==========
  {
    id: 'create-1',
    sku: 'create-1',
    category: 'create',
    baseId: 'create',
    name: '角色創建卡 x1',
    displayName: '1 張',
    description: '創建一個自訂 AI 角色',
    icon: '✨',
    iconColor: 'create',
    quantity: 1,
    quantityUnit: '張',
    basePrice: 150,
    finalPrice: 150,
    originalPrice: null,
    discountRate: 1,
    badge: null,
    popular: false,
    status: 'active',
    order: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'create-3',
    sku: 'create-3',
    category: 'create',
    baseId: 'create',
    name: '角色創建卡 x3',
    displayName: '3 張',
    description: '創建三個自訂 AI 角色',
    icon: '✨',
    iconColor: 'create',
    quantity: 3,
    quantityUnit: '張',
    basePrice: 450,
    finalPrice: 360,
    originalPrice: 450,
    discountRate: 0.8,
    badge: '8折',
    popular: true,
    status: 'active',
    order: 31,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * 導入資產套餐數據到 Firestore
 */
async function importAssetPackages() {
  console.log('🚀 開始導入資產套餐數據...\n');

  const batch = db.batch();
  const collection = db.collection('asset_packages');

  for (const pkg of ASSET_PACKAGES_DATA) {
    const docRef = collection.doc(pkg.id);
    batch.set(docRef, pkg, { merge: true });
    console.log(`✅ 準備導入: ${pkg.name}`);
    console.log(`   - 分類: ${pkg.category}`);
    console.log(`   - 價格: ${pkg.finalPrice} 金幣 (原價: ${pkg.basePrice})`);
    console.log(`   - 數量: ${pkg.quantity} ${pkg.quantityUnit}`);
    console.log(`   - 排序: ${pkg.order}\n`);
  }

  try {
    await batch.commit();
    console.log('✅ 資產套餐數據導入成功!\n');

    // 驗證導入結果
    console.log('🔍 驗證導入結果...');
    const snapshot = await collection.where('status', '==', 'active').get();
    console.log(`✅ 成功導入 ${snapshot.size} 個資產套餐\n`);

    // 按分類顯示
    const byCategory = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!byCategory[data.category]) {
        byCategory[data.category] = [];
      }
      byCategory[data.category].push(data);
    });

    console.log('📋 導入的資產套餐（按分類）:');
    for (const [category, items] of Object.entries(byCategory)) {
      console.log(`\n   📁 ${category}:`);
      items.forEach(item => {
        console.log(`      - ${item.name}: ${item.finalPrice} 金幣`);
      });
    }

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
    await importAssetPackages();
    console.log('\n🎉 所有操作完成!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 執行失敗:', error);
    process.exit(1);
  }
}

// 執行
main();
