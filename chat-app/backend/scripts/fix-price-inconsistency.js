/**
 * 修正價格不一致問題
 * 方案 A: 統一使用 asset_packages 的價格（後端實際扣款價格）
 *
 * 執行步驟：
 * 1. 將 unlock_cards 的價格更新為 asset_packages 的價格
 * 2. 在 asset_packages 中添加缺失的商品
 */

import 'dotenv/config';
import { getFirestoreDb } from '../src/firebase/index.js';
import logger from '../src/utils/logger.js';

const fixPriceInconsistency = async () => {
  try {
    const db = getFirestoreDb();

    console.log('\n========================================');
    console.log('修正價格不一致問題');
    console.log('方案 A: 統一使用 asset_packages 價格');
    console.log('========================================\n');

    // 1. 讀取兩個集合的數據
    console.log('📖 讀取 Firestore 數據...\n');

    const [unlockCardsSnapshot, assetPackagesSnapshot] = await Promise.all([
      db.collection('unlock_cards').get(),
      db.collection('asset_packages').get()
    ]);

    console.log(`✅ unlock_cards: ${unlockCardsSnapshot.size} 個商品`);
    console.log(`✅ asset_packages: ${assetPackagesSnapshot.size} 個套餐\n`);

    // 2. 建立映射表
    const cardsMap = new Map();
    unlockCardsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const category = data.category || 'unknown';
      const quantity = data.quantity || 1;
      const key = `${category}-${quantity}`;

      cardsMap.set(key, {
        docId: doc.id,
        data: data,
        category,
        quantity,
        currentPrice: data.unitPrice || data.finalPrice || data.price || 0
      });
    });

    const packagesMap = new Map();
    assetPackagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const category = data.category || data.assetType || 'unknown';
      const quantity = data.quantity || 1;
      const key = `${category}-${quantity}`;

      packagesMap.set(key, {
        docId: doc.id,
        data: data,
        category,
        quantity,
        price: data.finalPrice || data.unitPrice || data.price || 0
      });
    });

    // 3. 分析需要更新的項目
    const toUpdate = [];
    const toAddToAssetPackages = [];

    console.log('🔍 分析價格差異...\n');

    cardsMap.forEach((cardItem, key) => {
      const packageItem = packagesMap.get(key);

      if (packageItem) {
        // 兩個集合都有，檢查價格是否一致
        if (cardItem.currentPrice !== packageItem.price) {
          toUpdate.push({
            key,
            docId: cardItem.docId,
            name: cardItem.data.displayName || cardItem.data.name,
            oldPrice: cardItem.currentPrice,
            newPrice: packageItem.price,
            category: cardItem.category,
            quantity: cardItem.quantity
          });
        }
      } else {
        // unlock_cards 有但 asset_packages 沒有
        toAddToAssetPackages.push({
          key,
          category: cardItem.category,
          quantity: cardItem.quantity,
          name: cardItem.data.displayName || cardItem.data.name,
          baseId: cardItem.data.baseId,
          price: cardItem.currentPrice,
          data: cardItem.data
        });
      }
    });

    // 4. 顯示更新計劃
    console.log('📋 更新計劃：');
    console.log('========================================\n');

    if (toUpdate.length > 0) {
      console.log(`📝 需要更新 unlock_cards 價格的商品 (${toUpdate.length} 個):\n`);
      toUpdate.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (${item.category}, 數量: ${item.quantity})`);
        console.log(`   文檔 ID: ${item.docId}`);
        console.log(`   ${item.oldPrice} 金幣 → ${item.newPrice} 金幣 (${item.newPrice > item.oldPrice ? '+' : ''}${item.newPrice - item.oldPrice})`);
        console.log('');
      });
    } else {
      console.log('✅ 沒有需要更新價格的商品\n');
    }

    if (toAddToAssetPackages.length > 0) {
      console.log(`📝 需要添加到 asset_packages 的商品 (${toAddToAssetPackages.length} 個):\n`);
      toAddToAssetPackages.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (${item.category}, 數量: ${item.quantity})`);
        console.log(`   價格: ${item.price} 金幣`);
        console.log('');
      });
    } else {
      console.log('✅ 沒有需要添加到 asset_packages 的商品\n');
    }

    // 5. 確認執行
    const totalChanges = toUpdate.length + toAddToAssetPackages.length;

    if (totalChanges === 0) {
      console.log('✅ 所有價格已經一致，無需修正！\n');
      return;
    }

    console.log(`\n⚠️  總共需要修改 ${totalChanges} 個項目`);
    console.log('========================================\n');

    // 檢查是否有環境變數控制自動執行
    const autoExecute = process.env.AUTO_EXECUTE_FIX === 'true';

    if (!autoExecute) {
      console.log('💡 這是預覽模式。如要實際執行修正，請設置環境變數：');
      console.log('   AUTO_EXECUTE_FIX=true node scripts/fix-price-inconsistency.js');
      console.log('');
      return;
    }

    console.log('🚀 開始執行修正...\n');

    // 6. 更新 unlock_cards 價格
    if (toUpdate.length > 0) {
      console.log(`📝 更新 unlock_cards 價格 (${toUpdate.length} 個)...\n`);

      const batch = db.batch();
      let batchCount = 0;
      let totalUpdated = 0;

      for (const item of toUpdate) {
        const ref = db.collection('unlock_cards').doc(item.docId);

        batch.update(ref, {
          unitPrice: item.newPrice,
          basePrice: item.newPrice,
          updatedAt: new Date().toISOString()
        });

        batchCount++;
        totalUpdated++;

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
        console.log(`   ✅ 已提交 ${totalUpdated} 個更新`);
      }

      console.log(`\n✅ unlock_cards 價格更新完成 (${totalUpdated} 個)\n`);
    }

    // 7. 添加缺失的商品到 asset_packages
    if (toAddToAssetPackages.length > 0) {
      console.log(`📝 添加缺失商品到 asset_packages (${toAddToAssetPackages.length} 個)...\n`);

      const batch = db.batch();
      let batchCount = 0;
      let totalAdded = 0;

      for (const item of toAddToAssetPackages) {
        // 生成 SKU (格式: category-quantity)
        const sku = `${item.category.replace(/_/g, '-')}-${item.quantity}`;
        const ref = db.collection('asset_packages').doc(sku);

        // 映射 category 到 assetType
        const assetTypeMapping = {
          'character-unlock': 'characterUnlockCard',
          'photo-unlock': 'photoUnlockCard',
          'video-unlock': 'videoUnlockCard',
          'voice-unlock': 'voiceUnlockCard',
          'create': 'createCards'
        };

        const assetType = assetTypeMapping[item.category] || 'unknown';

        // 計算折扣率（從原始數據中獲取，或根據數量計算）
        let discountRate = item.data.discount || 1;
        if (item.quantity >= 20) discountRate = 0.8;
        else if (item.quantity >= 10) discountRate = 0.85;
        else if (item.quantity >= 5) discountRate = 0.9;
        else if (item.quantity >= 3) discountRate = 0.95;

        const basePrice = Math.round(item.price / discountRate);

        const packageData = {
          sku: sku,
          category: item.category,
          assetType: assetType,
          name: `${item.quantity} 張`,
          quantity: item.quantity,
          basePrice: basePrice,
          finalPrice: item.price,
          discountRate: discountRate,
          badge: item.data.badge || null,
          popular: item.data.popular || false,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        batch.set(ref, packageData);

        batchCount++;
        totalAdded++;

        console.log(`   ✅ 添加: ${sku} (${item.name}) - ${item.price} 金幣`);

        // Firestore batch 最多 500 個操作
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   ✅ 已提交 ${totalAdded} 個新增`);
          batchCount = 0;
        }
      }

      // 提交剩餘的新增
      if (batchCount > 0) {
        await batch.commit();
      }

      console.log(`\n✅ asset_packages 新增完成 (${totalAdded} 個)\n`);
    }

    // 8. 完成總結
    console.log('\n========================================');
    console.log('✅ 修正完成！');
    console.log('========================================\n');

    console.log('📊 修正總結：');
    console.log(`   - 更新 unlock_cards 價格: ${toUpdate.length} 個`);
    console.log(`   - 添加到 asset_packages: ${toAddToAssetPackages.length} 個`);
    console.log(`   - 總共修改: ${totalChanges} 個項目\n`);

    console.log('💡 建議：');
    console.log('   1. 重新運行檢查腳本驗證修正結果：');
    console.log('      node scripts/check-unlock-card-prices.js');
    console.log('   2. 清理前端緩存，刷新商城頁面');
    console.log('   3. 測試購買流程，確認價格一致\n');

  } catch (error) {
    logger.error('修正失敗:', error);
    console.error('❌ 錯誤:', error.message);
    throw error;
  }
};

// 執行修正
fixPriceInconsistency()
  .then(() => {
    console.log('腳本執行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('腳本執行失敗:', error);
    process.exit(1);
  });
