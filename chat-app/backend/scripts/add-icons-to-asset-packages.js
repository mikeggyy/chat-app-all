/**
 * 為 asset_packages 集合添加圖標（icon）
 * 解決修正價格後圖標消失的問題
 */

import 'dotenv/config';
import { getFirestoreDb } from '../src/firebase/index.js';
import logger from '../src/utils/logger.js';

// 類別圖標映射表
const CATEGORY_ICONS = {
  'character-unlock': '🎭',
  'photo-unlock': '📸',
  'video-unlock': '🎬',
  'voice-unlock': '🔊',
  'create': '✨',
};

const addIconsToAssetPackages = async () => {
  try {
    const db = getFirestoreDb();

    console.log('\n========================================');
    console.log('為 asset_packages 添加圖標');
    console.log('========================================\n');

    // 1. 讀取所有 asset_packages
    console.log('📖 讀取 asset_packages 數據...\n');

    const snapshot = await db
      .collection('asset_packages')
      .get();

    console.log(`✅ 找到 ${snapshot.size} 個套餐\n`);

    // 2. 分析需要添加圖標的商品
    const toUpdate = [];

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const currentIcon = data.icon || data.emoji;

      // 如果沒有圖標，且屬於已知類別
      if (!currentIcon && CATEGORY_ICONS[data.category]) {
        toUpdate.push({
          docId: doc.id,
          category: data.category,
          name: data.displayName || data.name,
          icon: CATEGORY_ICONS[data.category]
        });
      }
    });

    // 3. 顯示更新計劃
    console.log('📋 更新計劃：');
    console.log('========================================\n');

    if (toUpdate.length > 0) {
      console.log(`📝 需要添加圖標的商品 (${toUpdate.length} 個):\n`);
      toUpdate.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (${item.category})`);
        console.log(`   文檔 ID: ${item.docId}`);
        console.log(`   圖標: ${item.icon}`);
        console.log('');
      });
    } else {
      console.log('✅ 所有商品都已有圖標\n');
      return;
    }

    // 4. 確認執行
    const autoExecute = process.env.AUTO_EXECUTE_FIX === 'true';

    if (!autoExecute) {
      console.log('💡 這是預覽模式。如要實際執行，請設置環境變數：');
      console.log('   AUTO_EXECUTE_FIX=true node scripts/add-icons-to-asset-packages.js');
      console.log('');
      return;
    }

    console.log('\n🚀 開始執行更新...\n');

    // 5. 批量更新
    const batch = db.batch();
    let batchCount = 0;
    let totalUpdated = 0;

    for (const item of toUpdate) {
      const ref = db.collection('asset_packages').doc(item.docId);

      batch.update(ref, {
        icon: item.icon,
        updatedAt: new Date().toISOString()
      });

      batchCount++;
      totalUpdated++;

      console.log(`   ✅ 添加圖標: ${item.name} - ${item.icon}`);

      // Firestore batch 最多 500 個操作
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`   ✅ 已提交 ${totalUpdated} 個更新`);
        batchCount = 0;
      }
    }

    // 提交剩餘的更新
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`\n✅ 圖標添加完成 (${totalUpdated} 個)\n`);

    // 6. 完成總結
    console.log('========================================');
    console.log('✅ 更新完成！');
    console.log('========================================\n');

    console.log('📊 更新總結：');
    console.log(`   - 添加圖標: ${totalUpdated} 個商品\n`);

    console.log('💡 建議：');
    console.log('   1. 重啟後端服務');
    console.log('   2. 刷新商城頁面，確認圖標顯示正常\n');

  } catch (error) {
    logger.error('更新失敗:', error);
    console.error('❌ 錯誤:', error.message);
    throw error;
  }
};

// 執行更新
addIconsToAssetPackages()
  .then(() => {
    console.log('腳本執行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('腳本執行失敗:', error);
    process.exit(1);
  });
