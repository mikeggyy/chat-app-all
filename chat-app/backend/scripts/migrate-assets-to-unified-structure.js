/**
 * 資產存儲結構統一遷移腳本
 *
 * 目的：
 * 1. 將所有用戶的資產統一到 users/{userId}.assets 對象
 * 2. 清理舊的存儲位置（unlockTickets、頂層字段）
 * 3. 生成遷移報告
 *
 * 使用方法：
 * node scripts/migrate-assets-to-unified-structure.js [options]
 *
 * 選項：
 * --dry-run    只分析不執行遷移（默認）
 * --execute    實際執行遷移
 * --batch-size 每批處理的用戶數（默認 100）
 * --cleanup    清理舊數據（需要先執行遷移）
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

import { getFirestoreDb } from "../src/firebase/index.js";
import logger from "../src/utils/logger.js";

const ASSET_TYPES = [
  'characterUnlockCards',
  'photoUnlockCards',
  'videoUnlockCards',
  'voiceUnlockCards',
  'createCards'
];

// 解析命令行參數
const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');
const shouldCleanup = args.includes('--cleanup');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100;

/**
 * 分析用戶資產存儲狀態
 */
async function analyzeUserAssets(userId, userData) {
  const analysis = {
    userId,
    hasNewLocation: false,      // users/{userId}.assets.{type}
    hasTransitionLocation: false, // users/{userId}.unlockTickets.{type}
    hasOldLocation: false,       // users/{userId}.{type}
    needsMigration: false,
    assets: {},
    conflicts: []
  };

  // 檢查新位置（推薦）
  if (userData.assets && typeof userData.assets === 'object') {
    analysis.hasNewLocation = true;
    for (const assetType of ASSET_TYPES) {
      if (typeof userData.assets[assetType] === 'number') {
        analysis.assets[assetType] = {
          new: userData.assets[assetType]
        };
      }
    }
  }

  // 檢查過渡位置
  if (userData.unlockTickets && typeof userData.unlockTickets === 'object') {
    analysis.hasTransitionLocation = true;
    for (const assetType of ASSET_TYPES) {
      if (typeof userData.unlockTickets[assetType] === 'number') {
        if (!analysis.assets[assetType]) {
          analysis.assets[assetType] = {};
        }
        analysis.assets[assetType].transition = userData.unlockTickets[assetType];
      }
    }
  }

  // 檢查舊位置（頂層字段）
  for (const assetType of ASSET_TYPES) {
    if (typeof userData[assetType] === 'number') {
      analysis.hasOldLocation = true;
      if (!analysis.assets[assetType]) {
        analysis.assets[assetType] = {};
      }
      analysis.assets[assetType].old = userData[assetType];
    }
  }

  // 檢查是否有衝突（不同位置的值不一致）
  for (const assetType of ASSET_TYPES) {
    const locations = analysis.assets[assetType];
    if (locations) {
      const values = Object.values(locations);
      if (values.length > 1) {
        const uniqueValues = [...new Set(values)];
        if (uniqueValues.length > 1) {
          analysis.conflicts.push({
            assetType,
            values: locations
          });
        }
      }
    }
  }

  // 判斷是否需要遷移
  analysis.needsMigration =
    (!analysis.hasNewLocation && (analysis.hasTransitionLocation || analysis.hasOldLocation)) ||
    analysis.conflicts.length > 0;

  return analysis;
}

/**
 * 遷移單個用戶的資產
 */
async function migrateUserAssets(userId, userData, analysis) {
  const db = getFirestoreDb();
  const userRef = db.collection('users').doc(userId);

  const updates = {
    assets: {},
    updatedAt: new Date().toISOString()
  };

  // 合併所有位置的資產，優先使用新位置的值
  for (const assetType of ASSET_TYPES) {
    const locations = analysis.assets[assetType];
    if (locations) {
      // 優先級：new > transition > old
      updates.assets[assetType] =
        locations.new ??
        locations.transition ??
        locations.old ??
        0;
    } else {
      // 如果該資產類型不存在，初始化為 0
      updates.assets[assetType] = 0;
    }
  }

  // 如果有衝突，使用最大值（保守策略，避免用戶損失）
  for (const conflict of analysis.conflicts) {
    const values = Object.values(conflict.values);
    updates.assets[conflict.assetType] = Math.max(...values);
    logger.warn(`[遷移] 用戶 ${userId} 的 ${conflict.assetType} 存在衝突，使用最大值: ${updates.assets[conflict.assetType]}`);
  }

  try {
    await userRef.update(updates);
    logger.info(`[遷移] 成功遷移用戶 ${userId} 的資產`);
    return { success: true, userId, updates };
  } catch (error) {
    logger.error(`[遷移] 遷移用戶 ${userId} 失敗: ${error.message}`);
    return { success: false, userId, error: error.message };
  }
}

/**
 * 清理舊數據
 */
async function cleanupOldData(userId) {
  const db = getFirestoreDb();
  const userRef = db.collection('users').doc(userId);

  // 先讀取用戶數據，保留 usageHistory
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  const updates = {
    updatedAt: new Date().toISOString()
  };

  // 清理過渡位置的資產欄位，但保留 usageHistory
  if (userData.unlockTickets) {
    const usageHistory = userData.unlockTickets.usageHistory || [];

    // 如果有 usageHistory，只保留它；否則刪除整個 unlockTickets
    if (usageHistory.length > 0) {
      // 直接設置為只包含 usageHistory 的物件，移除所有資產欄位
      updates.unlockTickets = { usageHistory };
      logger.info(`[清理] 保留用戶 ${userId} 的 ${usageHistory.length} 條 usageHistory 記錄`);
    } else {
      // 沒有 usageHistory，直接刪除整個 unlockTickets
      updates.unlockTickets = null;
    }
  }

  // 清理舊位置（頂層字段）
  for (const assetType of ASSET_TYPES) {
    updates[assetType] = null;
  }

  try {
    await userRef.update(updates);
    logger.info(`[清理] 成功清理用戶 ${userId} 的舊數據`);
    return { success: true, userId };
  } catch (error) {
    logger.error(`[清理] 清理用戶 ${userId} 失敗: ${error.message}`);
    return { success: false, userId, error: error.message };
  }
}

/**
 * 主遷移流程
 */
async function main() {
  console.log('\n========================================');
  console.log('資產存儲結構統一遷移工具');
  console.log('========================================\n');

  console.log(`模式: ${isDryRun ? '分析模式（不執行遷移）' : '執行模式'}`);
  console.log(`批次大小: ${batchSize}`);
  console.log(`清理舊數據: ${shouldCleanup ? '是' : '否'}\n`);

  if (isDryRun) {
    console.log('⚠️  當前為分析模式，不會執行實際遷移');
    console.log('   使用 --execute 參數執行實際遷移\n');
  }

  if (shouldCleanup && isDryRun) {
    console.log('⚠️  清理模式需要配合 --execute 使用\n');
    return;
  }

  const db = getFirestoreDb();
  const stats = {
    total: 0,
    analyzed: 0,
    needsMigration: 0,
    migrated: 0,
    conflicts: 0,
    cleaned: 0,
    errors: []
  };

  try {
    // 獲取所有用戶（分批處理）
    let lastDoc = null;
    let hasMore = true;

    while (hasMore) {
      let query = db.collection('users').limit(batchSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      console.log(`\n處理批次: ${snapshot.docs.length} 個用戶`);

      for (const doc of snapshot.docs) {
        const userId = doc.id;
        const userData = doc.data();
        stats.total++;

        // 分析用戶資產
        const analysis = await analyzeUserAssets(userId, userData);
        stats.analyzed++;

        if (analysis.conflicts.length > 0) {
          stats.conflicts++;
          console.log(`⚠️  用戶 ${userId} 有 ${analysis.conflicts.length} 個衝突:`,
            analysis.conflicts.map(c => `${c.assetType}: ${JSON.stringify(c.values)}`).join(', '));
        }

        if (analysis.needsMigration) {
          stats.needsMigration++;

          if (!isDryRun) {
            // 執行遷移
            const result = await migrateUserAssets(userId, userData, analysis);
            if (result.success) {
              stats.migrated++;

              // 如果需要清理舊數據
              if (shouldCleanup) {
                const cleanupResult = await cleanupOldData(userId);
                if (cleanupResult.success) {
                  stats.cleaned++;
                }
              }
            } else {
              stats.errors.push(result);
            }
          } else {
            console.log(`  需要遷移: 用戶 ${userId}`);
            if (analysis.hasOldLocation) console.log(`    - 有舊位置數據`);
            if (analysis.hasTransitionLocation) console.log(`    - 有過渡位置數據`);
            if (!analysis.hasNewLocation) console.log(`    - 缺少新位置數據`);
          }
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      hasMore = snapshot.docs.length === batchSize;

      // 避免過快請求
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 輸出統計報告
    console.log('\n========================================');
    console.log('遷移報告');
    console.log('========================================\n');
    console.log(`總用戶數: ${stats.total}`);
    console.log(`已分析: ${stats.analyzed}`);
    console.log(`需要遷移: ${stats.needsMigration}`);

    if (!isDryRun) {
      console.log(`已遷移: ${stats.migrated}`);
      if (shouldCleanup) {
        console.log(`已清理: ${stats.cleaned}`);
      }
    }

    console.log(`發現衝突: ${stats.conflicts}`);
    console.log(`錯誤數: ${stats.errors.length}\n`);

    if (stats.errors.length > 0) {
      console.log('錯誤詳情:');
      stats.errors.forEach(err => {
        console.log(`  - 用戶 ${err.userId}: ${err.error}`);
      });
      console.log('');
    }

    if (isDryRun && stats.needsMigration > 0) {
      console.log('✅ 分析完成！');
      console.log(`\n發現 ${stats.needsMigration} 個用戶需要遷移`);
      console.log('\n執行遷移請運行:');
      console.log('  node scripts/migrate-assets-to-unified-structure.js --execute');
      console.log('\n執行遷移並清理舊數據請運行:');
      console.log('  node scripts/migrate-assets-to-unified-structure.js --execute --cleanup\n');
    } else if (!isDryRun) {
      console.log('✅ 遷移完成！\n');
    }

  } catch (error) {
    console.error('❌ 遷移過程發生錯誤:', error);
    process.exit(1);
  }
}

// 執行主流程
main()
  .then(() => {
    console.log('腳本執行完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('腳本執行失敗:', error);
    process.exit(1);
  });
