/**
 * 藥水數據導入腳本
 * 將藥水配置從 JS 文件遷移到 Firestore
 *
 * 用法: node scripts/import-potions.js
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
 * 藥水數據 (從 shared/config/potions.js 遷移)
 */
const POTIONS_DATA = [
  {
    id: 'memory_boost',
    name: '記憶增強藥水',
    description: '增加單一角色10000 token上限',
    unitPrice: 200,
    duration: 30, // 天數
    effect: {
      type: 'memory',
      value: 10000, // 增加的 token 數量
      displayText: '增加單一角色記憶上限',
    },
    // 前端顯示用
    displayConfig: {
      unit: '個',
      shortDescription: '效用30天',
    },
    // 商城配置
    category: 'potions',
    popular: false,
    badge: null,
    requiresCharacter: true, // 使用時需要選擇角色
    showInShop: true,
    // 前端圖標配置
    icon: '🧠',
    iconColor: 'memory',
    // 排序
    order: 1,
    // 狀態
    status: 'active',  // ✅ 修復：API 查詢使用 status 而非 enabled
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'brain_boost',
    name: '腦力激盪藥水',
    description: '模型升級為 GPT-4.1 mini',
    unitPrice: 200,
    duration: 30, // 天數
    effect: {
      type: 'model',
      value: 'gpt-4.1-mini', // 升級後的模型
      displayText: '使用更聰明的模型',
    },
    // 前端顯示用
    displayConfig: {
      unit: '個',
      shortDescription: '效用30天',
    },
    // 商城配置
    category: 'potions',
    popular: true,
    badge: '推薦',
    requiresCharacter: false, // 不需要選擇角色，全局升級
    showInShop: true,
    // VVIP 用戶限制
    restrictedTiers: ['vvip'],
    restrictedMessage: '您的模型已經是最高級了',
    // 前端圖標配置
    icon: '⚡',
    iconColor: 'brain',
    // 排序
    order: 2,
    // 狀態
    status: 'active',  // ✅ 修復：API 查詢使用 status 而非 enabled
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * 導入藥水數據到 Firestore
 */
async function importPotions() {
  console.log('🚀 開始導入藥水數據...\n');

  const batch = db.batch();
  const collection = db.collection('potions');

  for (const potion of POTIONS_DATA) {
    const docRef = collection.doc(potion.id);
    batch.set(docRef, potion, { merge: true });
    console.log(`✅ 準備導入藥水: ${potion.name} (${potion.id})`);
    console.log(`   - 價格: ${potion.unitPrice} 金幣`);
    console.log(`   - 效果: ${potion.effect.displayText}`);
    console.log(`   - 持續: ${potion.duration} 天`);
    console.log(`   - 排序: ${potion.order}\n`);
  }

  try {
    await batch.commit();
    console.log('✅ 藥水數據導入成功!\n');

    // 驗證導入結果
    console.log('🔍 驗證導入結果...');
    const snapshot = await collection.get();
    console.log(`✅ 成功導入 ${snapshot.size} 個藥水\n`);

    // 顯示導入的藥水列表
    console.log('📋 導入的藥水列表:');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.name}: ${data.unitPrice} 金幣 (order: ${data.order})`);
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
    await importPotions();
    console.log('\n🎉 所有操作完成!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 執行失敗:', error);
    process.exit(1);
  }
}

// 執行
main();
