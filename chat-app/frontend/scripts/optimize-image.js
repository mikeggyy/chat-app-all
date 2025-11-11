import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 圖片優化腳本
 * 將 ranking-hero.png 轉換為 WebP 格式並壓縮
 */
async function optimizeImage() {
  const inputPath = join(__dirname, '../public/banner/ranking-hero.png');
  const outputPath = join(__dirname, '../public/banner/ranking-hero.webp');

  // 檢查輸入檔案是否存在
  if (!existsSync(inputPath)) {
    console.error(`❌ 找不到圖片: ${inputPath}`);
    process.exit(1);
  }

  try {
    console.log('🔄 開始優化圖片...');
    console.log(`📁 輸入: ${inputPath}`);

    // 讀取原始圖片資訊
    const metadata = await sharp(inputPath).metadata();
    console.log(`📊 原始尺寸: ${metadata.width}x${metadata.height}`);
    console.log(`📊 原始格式: ${metadata.format}`);

    // 轉換為 WebP 並壓縮
    await sharp(inputPath)
      .webp({
        quality: 85, // 品質設定 (0-100)，85 可以達到很好的壓縮效果
        effort: 6,   // 壓縮努力程度 (0-6)，數字越大壓縮越好但速度越慢
      })
      .toFile(outputPath);

    // 檢查輸出檔案
    const outputMetadata = await sharp(outputPath).metadata();
    const stats = await import('fs').then(fs => fs.promises.stat(outputPath));
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`✅ 優化完成！`);
    console.log(`📁 輸出: ${outputPath}`);
    console.log(`📊 輸出尺寸: ${outputMetadata.width}x${outputMetadata.height}`);
    console.log(`📊 輸出格式: ${outputMetadata.format}`);
    console.log(`💾 檔案大小: ${sizeMB} MB`);

    // 檢查檔案大小是否符合目標 (200-300KB)
    const targetMaxKB = 300;
    const sizeKB = stats.size / 1024;

    if (sizeKB > targetMaxKB) {
      console.warn(`⚠️  檔案大小 ${sizeKB.toFixed(0)}KB 超過目標 ${targetMaxKB}KB`);
      console.log('💡 建議: 降低品質參數或調整尺寸');
    } else {
      console.log(`✨ 檔案大小符合目標 (<${targetMaxKB}KB)`);
    }

  } catch (error) {
    console.error('❌ 優化失敗:', error.message);
    process.exit(1);
  }
}

optimizeImage();
