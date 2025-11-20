/**
 * 檢查 Firestore 中解鎖卡的價格配置
 * 用於診斷前端顯示和後端扣款的價格不一致問題
 */

import 'dotenv/config';
import { getFirestoreDb } from '../src/firebase/index.js';
import logger from '../src/utils/logger.js';

const checkUnlockCardPrices = async () => {
  try {
    const db = getFirestoreDb();

    console.log('\n========================================');
    console.log('檢查解鎖卡價格配置');
    console.log('========================================\n');

    // 1. 檢查 unlock_cards 集合（前端商城顯示用）
    console.log('📋 檢查 unlock_cards 集合（前端商城顯示）');
    console.log('----------------------------------------');

    const unlockCardsSnapshot = await db
      .collection('unlock_cards')
      .get();

    if (unlockCardsSnapshot.empty) {
      console.log('❌ unlock_cards 集合為空');
    } else {
      console.log(`✅ 找到 ${unlockCardsSnapshot.size} 個商品\n`);

      unlockCardsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`📦 文檔 ID: ${doc.id}`);
        console.log(`   名稱: ${data.displayName || data.name || '(無)'}`);
        console.log(`   分類: ${data.category || '(無)'}`);
        console.log(`   價格: ${data.unitPrice || data.finalPrice || data.price || '(無)'} 金幣`);
        console.log(`   數量: ${data.quantity || 1}`);
        console.log(`   狀態: ${data.status || '(無)'}`);
        console.log(`   原始數據:`, JSON.stringify(data, null, 2));
        console.log('');
      });
    }

    // 2. 檢查 asset_packages 集合（後端購買邏輯用）
    console.log('\n📋 檢查 asset_packages 集合（後端購買邏輯）');
    console.log('----------------------------------------');

    const assetPackagesSnapshot = await db
      .collection('asset_packages')
      .get();

    if (assetPackagesSnapshot.empty) {
      console.log('❌ asset_packages 集合為空');
    } else {
      console.log(`✅ 找到 ${assetPackagesSnapshot.size} 個套餐\n`);

      assetPackagesSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`📦 文檔 ID (SKU): ${doc.id}`);
        console.log(`   名稱: ${data.displayName || data.name || '(無)'}`);
        console.log(`   分類/資產類型: ${data.category || data.assetType || '(無)'}`);
        console.log(`   價格: ${data.finalPrice || data.unitPrice || data.price || '(無)'} 金幣`);
        console.log(`   數量: ${data.quantity || 1}`);
        console.log(`   狀態: ${data.status || '(無)'}`);
        console.log(`   原始數據:`, JSON.stringify(data, null, 2));
        console.log('');
      });
    }

    // 3. 特別檢查角色解鎖票
    console.log('\n🎯 特別檢查：角色解鎖票');
    console.log('----------------------------------------');

    // 從 unlock_cards 查找
    const characterUnlockInCards = unlockCardsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.category === 'character-unlock' ||
             data.category === 'character_unlock' ||
             (data.displayName && data.displayName.includes('角色解鎖')) ||
             (data.name && data.name.includes('角色解鎖'));
    });

    if (characterUnlockInCards.length > 0) {
      console.log(`\n📌 unlock_cards 中的角色解鎖票 (${characterUnlockInCards.length} 個):`);
      characterUnlockInCards.forEach(doc => {
        const data = doc.data();
        const price = data.unitPrice || data.finalPrice || data.price || 0;
        console.log(`   ${doc.id}: ${data.displayName || data.name} - ${price} 金幣`);
      });
    } else {
      console.log('\n❌ unlock_cards 中沒有找到角色解鎖票');
    }

    // 從 asset_packages 查找
    const characterUnlockInPackages = assetPackagesSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.category === 'character-unlock' ||
             data.category === 'character_unlock' ||
             data.assetType === 'characterUnlockCard' ||
             data.assetType === 'characterUnlockCards' ||
             (data.displayName && data.displayName.includes('角色解鎖')) ||
             (data.name && data.name.includes('角色解鎖'));
    });

    if (characterUnlockInPackages.length > 0) {
      console.log(`\n📌 asset_packages 中的角色解鎖票 (${characterUnlockInPackages.length} 個):`);
      characterUnlockInPackages.forEach(doc => {
        const data = doc.data();
        const price = data.finalPrice || data.unitPrice || data.price || 0;
        console.log(`   ${doc.id}: ${data.displayName || data.name} - ${price} 金幣`);
      });
    } else {
      console.log('\n❌ asset_packages 中沒有找到角色解鎖票');
    }

    // 4. 全面價格對比分析
    console.log('\n\n💡 全面價格一致性檢查：');
    console.log('========================================');

    // 建立商品映射表（按分類）
    const cardsMap = new Map();
    unlockCardsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const category = data.category || 'unknown';
      const quantity = data.quantity || 1;
      const key = `${category}-${quantity}`;

      if (!cardsMap.has(key)) {
        cardsMap.set(key, []);
      }

      cardsMap.get(key).push({
        id: doc.id,
        name: data.displayName || data.name,
        price: data.unitPrice || data.finalPrice || data.price || 0,
        quantity: quantity,
        data: data
      });
    });

    const packagesMap = new Map();
    assetPackagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const category = data.category || data.assetType || 'unknown';
      const quantity = data.quantity || 1;
      const key = `${category}-${quantity}`;

      if (!packagesMap.has(key)) {
        packagesMap.set(key, []);
      }

      packagesMap.get(key).push({
        id: doc.id,
        name: data.displayName || data.name,
        price: data.finalPrice || data.unitPrice || data.price || 0,
        quantity: quantity,
        data: data
      });
    });

    // 找出所有分類
    const allCategories = new Set([...cardsMap.keys(), ...packagesMap.keys()]);

    let totalIssues = 0;
    const issues = [];

    console.log('\n按分類對比價格：\n');

    allCategories.forEach(categoryKey => {
      const cardsItems = cardsMap.get(categoryKey) || [];
      const packagesItems = packagesMap.get(categoryKey) || [];

      console.log(`📂 分類: ${categoryKey}`);
      console.log('   ----------------------------------------');

      // unlock_cards 中的商品
      if (cardsItems.length > 0) {
        console.log(`   📌 unlock_cards (前端顯示):`);
        cardsItems.forEach(item => {
          console.log(`      - ${item.id}: ${item.name} - ${item.price} 金幣 (數量: ${item.quantity})`);
        });
      } else {
        console.log(`   ❌ unlock_cards: 無此商品`);
      }

      // asset_packages 中的商品
      if (packagesItems.length > 0) {
        console.log(`   📌 asset_packages (後端購買):`);
        packagesItems.forEach(item => {
          console.log(`      - ${item.id}: ${item.name} - ${item.price} 金幣 (數量: ${item.quantity})`);
        });
      } else {
        console.log(`   ❌ asset_packages: 無此商品`);
      }

      // 價格對比
      if (cardsItems.length > 0 && packagesItems.length > 0) {
        // 檢查是否有價格不一致
        const cardPrices = new Set(cardsItems.map(i => i.price));
        const packagePrices = new Set(packagesItems.map(i => i.price));

        const hasInconsistency =
          cardsItems.some(card =>
            !packagesItems.some(pkg => pkg.price === card.price)
          ) ||
          packagesItems.some(pkg =>
            !cardsItems.some(card => card.price === pkg.price)
          );

        if (hasInconsistency) {
          console.log(`   ⚠️  價格不一致！`);
          console.log(`      前端顯示: ${Array.from(cardPrices).join(', ')} 金幣`);
          console.log(`      後端扣款: ${Array.from(packagePrices).join(', ')} 金幣`);
          totalIssues++;
          issues.push({
            category: categoryKey,
            cardPrices: Array.from(cardPrices),
            packagePrices: Array.from(packagePrices),
            cardsItems,
            packagesItems
          });
        } else {
          console.log(`   ✅ 價格一致 (${Array.from(cardPrices).join(', ')} 金幣)`);
        }
      } else if (cardsItems.length === 0 && packagesItems.length > 0) {
        console.log(`   ⚠️  僅在 asset_packages 存在，unlock_cards 缺少此商品`);
        totalIssues++;
        issues.push({
          category: categoryKey,
          issue: 'missing_in_unlock_cards',
          packagesItems
        });
      } else if (cardsItems.length > 0 && packagesItems.length === 0) {
        console.log(`   ⚠️  僅在 unlock_cards 存在，asset_packages 缺少此商品`);
        totalIssues++;
        issues.push({
          category: categoryKey,
          issue: 'missing_in_asset_packages',
          cardsItems
        });
      }

      console.log('');
    });

    // 5. 問題總結
    console.log('\n\n📊 問題總結：');
    console.log('========================================');

    if (totalIssues === 0) {
      console.log('✅ 沒有發現價格不一致的問題！');
    } else {
      console.log(`⚠️  發現 ${totalIssues} 個問題需要修正：\n`);

      issues.forEach((issue, index) => {
        console.log(`${index + 1}. 【${issue.category}】`);

        if (issue.issue === 'missing_in_unlock_cards') {
          console.log(`   問題: unlock_cards 集合缺少此商品`);
          console.log(`   建議: 在 unlock_cards 添加對應商品`);
          console.log(`   參考 asset_packages:`, issue.packagesItems.map(i => `${i.id} (${i.price}金幣)`).join(', '));
        } else if (issue.issue === 'missing_in_asset_packages') {
          console.log(`   問題: asset_packages 集合缺少此商品`);
          console.log(`   建議: 在 asset_packages 添加對應商品`);
          console.log(`   參考 unlock_cards:`, issue.cardsItems.map(i => `${i.id} (${i.price}金幣)`).join(', '));
        } else {
          console.log(`   問題: 兩個集合中的價格不一致`);
          console.log(`   unlock_cards 價格: ${issue.cardPrices.join(', ')} 金幣`);
          console.log(`   asset_packages 價格: ${issue.packagePrices.join(', ')} 金幣`);
          console.log(`   建議: 統一價格為 ${Math.min(...issue.packagePrices)} 金幣 (使用後端實際扣款價格)`);
        }
        console.log('');
      });
    }

    // 6. 檢查 potions 集合（藥水商品）
    console.log('\n\n📋 檢查 potions 集合（藥水商品）');
    console.log('========================================');

    const potionsSnapshot = await db
      .collection('potions')
      .get();

    if (potionsSnapshot.empty) {
      console.log('❌ potions 集合為空');
    } else {
      console.log(`✅ 找到 ${potionsSnapshot.size} 個藥水商品\n`);

      potionsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`📦 文檔 ID: ${doc.id}`);
        console.log(`   名稱: ${data.displayName || data.name || '(無)'}`);
        console.log(`   基礎 ID: ${data.baseId || '(無)'}`);
        console.log(`   價格: ${data.unitPrice || data.finalPrice || data.price || '(無)'} 金幣`);
        console.log(`   數量: ${data.quantity || 1}`);
        console.log(`   狀態: ${data.status || '(無)'}`);
        console.log(`   描述: ${data.description || '(無)'}`);
        console.log('');
      });
    }

    // 7. 與 asset_packages 中的藥水對比
    console.log('\n🔍 檢查藥水價格一致性：');
    console.log('----------------------------------------');

    const potionInPackages = assetPackagesSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.baseId === 'memory_boost' || data.baseId === 'brain_boost';
    });

    if (potionInPackages.length > 0 && potionsSnapshot.size > 0) {
      console.log('\n對比 potions 集合和 asset_packages 中的藥水：\n');

      let potionIssues = 0;

      // 檢查每個藥水
      potionsSnapshot.forEach(potionDoc => {
        const potionData = potionDoc.data();
        const baseId = potionData.baseId;
        const potionPrice = potionData.unitPrice || potionData.finalPrice || potionData.price || 0;
        const potionQty = potionData.quantity || 1;

        // 在 asset_packages 中找相同的商品
        const matchingPackages = potionInPackages.filter(pkgDoc => {
          const pkgData = pkgDoc.data();
          return pkgData.baseId === baseId && (pkgData.quantity || 1) === potionQty;
        });

        console.log(`📌 ${potionData.displayName || potionData.name} (${baseId}, 數量: ${potionQty})`);
        console.log(`   potions 集合: ${potionPrice} 金幣`);

        if (matchingPackages.length > 0) {
          matchingPackages.forEach(pkgDoc => {
            const pkgData = pkgDoc.data();
            const pkgPrice = pkgData.finalPrice || pkgData.unitPrice || pkgData.price || 0;

            console.log(`   asset_packages (${pkgDoc.id}): ${pkgPrice} 金幣`);

            if (potionPrice !== pkgPrice) {
              console.log(`   ⚠️  價格不一致！`);
              potionIssues++;
            } else {
              console.log(`   ✅ 價格一致`);
            }
          });
        } else {
          console.log(`   ❌ asset_packages 中沒有對應商品`);
          potionIssues++;
        }
        console.log('');
      });

      if (potionIssues > 0) {
        console.log(`⚠️  發現 ${potionIssues} 個藥水價格問題\n`);
        totalIssues += potionIssues;
      } else {
        console.log('✅ 所有藥水價格一致\n');
      }
    }

    // 8. 檢查配置文件中的定義
    console.log('\n\n📝 配置文件中的定義：');
    console.log('========================================');
    console.log('位置: backend/src/membership/membership.config.js');
    console.log('');
    console.log('AI_FEATURE_PRICES:');
    console.log('  - characterUnlockTicket.basePrice = 300 金幣');
    console.log('  - aiPhoto.basePrice = 50 金幣');
    console.log('  - aiVideo.basePrice = 200 金幣');

    // 9. 最終總結
    console.log('\n\n📊 最終總結：');
    console.log('========================================');

    if (totalIssues === 0) {
      console.log('✅ 所有商品價格一致，沒有發現問題！');
    } else {
      console.log(`⚠️  總共發現 ${totalIssues} 個問題需要修正`);
      console.log('\n建議修正方案：');
      console.log('1. 統一使用 asset_packages 作為價格來源（後端實際扣款價格）');
      console.log('2. 將 unlock_cards 的價格同步到 asset_packages 的價格');
      console.log('3. 或者考慮廢棄 unlock_cards 集合，統一使用 asset_packages');
    }

    console.log('\n\n✅ 檢查完成！');
    console.log('========================================\n');

  } catch (error) {
    logger.error('檢查失敗:', error);
    console.error('❌ 錯誤:', error.message);
  }
};

// 執行檢查
checkUnlockCardPrices()
  .then(() => {
    console.log('腳本執行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('腳本執行失敗:', error);
    process.exit(1);
  });
