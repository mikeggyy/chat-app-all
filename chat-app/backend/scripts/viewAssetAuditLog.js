#!/usr/bin/env node

/**
 * 查看用戶的資產審計日誌
 *
 * 用法：node viewAssetAuditLog.js <userId> [options]
 *
 * 選項：
 *   --asset-type <type>  篩選特定資產類型
 *   --limit <number>     限制返回數量（默認 50）
 *   --stats              顯示統計數據
 */

import "dotenv/config";
import "../src/setup-emulator.js";
import { getUserAssetHistory, getAssetChangeStats } from "../src/user/assetAuditLog.service.js";

const userId = process.argv[2];

if (!userId) {
  console.error('❌ 請提供用戶 ID');
  console.error('用法：node viewAssetAuditLog.js <userId> [options]');
  console.error('');
  console.error('範例：');
  console.error('  node viewAssetAuditLog.js PS7LYFSstdgyr7b9sCOKFgt3QVB3');
  console.error('  node viewAssetAuditLog.js PS7LYFSstdgyr7b9sCOKFgt3QVB3 --asset-type createCards');
  console.error('  node viewAssetAuditLog.js PS7LYFSstdgyr7b9sCOKFgt3QVB3 --stats');
  process.exit(1);
}

// 解析選項
const args = process.argv.slice(3);
const assetTypeMatch = args.findIndex(arg => arg === '--asset-type');
const assetType = assetTypeMatch !== -1 ? args[assetTypeMatch + 1] : null;

const limitMatch = args.findIndex(arg => arg === '--limit');
const limit = limitMatch !== -1 ? parseInt(args[limitMatch + 1]) : 50;

const showStats = args.includes('--stats');

async function viewAuditLog() {
  try {
    console.log(`\n🔍 查看用戶 ${userId} 的資產審計日誌\n`);

    if (assetType) {
      console.log(`📌 篩選資產類型: ${assetType}`);
    }
    console.log(`📊 限制數量: ${limit}`);
    console.log('');

    // 獲取歷史記錄
    const history = await getUserAssetHistory(userId, {
      assetType,
      limit,
    });

    if (history.length === 0) {
      console.log('📭 沒有找到審計記錄');
      return;
    }

    console.log(`📋 找到 ${history.length} 條記錄：\n`);

    // 顯示記錄
    history.forEach((log, index) => {
      const action = log.action === 'add' ? '增加' : log.action === 'consume' ? '消耗' : '設置';
      const actionSymbol = log.action === 'add' ? '➕' : log.action === 'consume' ? '➖' : '🔧';

      console.log(`${index + 1}. ${actionSymbol} ${action} ${log.assetType}`);
      console.log(`   數量: ${log.amount}`);
      console.log(`   變更: ${log.previousQuantity} → ${log.newQuantity}`);

      if (log.reason) {
        console.log(`   原因: ${log.reason}`);
      }

      if (log.metadata && Object.keys(log.metadata).length > 0) {
        console.log(`   元數據: ${JSON.stringify(log.metadata, null, 2)}`);
      }

      // 顯示時間
      if (log.createdAt) {
        const date = log.createdAt.toDate ? log.createdAt.toDate() : new Date(log.createdAt);
        console.log(`   時間: ${date.toLocaleString('zh-TW')}`);
      }

      console.log('');
    });

    // 如果需要顯示統計
    if (showStats && assetType) {
      console.log('='.repeat(60));
      console.log(`📊 ${assetType} 統計數據\n`);

      const stats = await getAssetChangeStats(userId, assetType);

      console.log(`  總變更次數: ${stats.totalChanges}`);
      console.log(`  總增加量: ${stats.totalAdded}`);
      console.log(`  總消耗量: ${stats.totalConsumed}`);
      console.log(`  淨變化: ${stats.totalAdded - stats.totalConsumed}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ 查詢失敗:', error);
    throw error;
  }
}

viewAuditLog()
  .then(() => {
    console.log('✅ 完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  });
