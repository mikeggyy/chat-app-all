import sharp from 'sharp';
import { readdir, stat, mkdir } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置
const CONFIG = {
  inputDir: join(__dirname, '../public/ai-role'),
  outputDir: join(__dirname, '../public/ai-role/optimized'),
  // 生成多個尺寸的圖片（響應式圖片）
  sizes: [
    { width: 200, suffix: '-sm' },   // 小尺寸（縮圖）
    { width: 400, suffix: '-md' },   // 中尺寸（列表顯示）
    { width: 800, suffix: '-lg' },   // 大尺寸（詳情頁）
  ],
  // WebP 壓縮質量
  quality: 80,
  // 支持的圖片格式
  supportedFormats: ['.jpg', '.jpeg', '.png', '.webp'],
};

/**
 * 獲取目錄中的所有圖片文件
 */
async function getImageFiles(dir) {
  const files = await readdir(dir);
  const imageFiles = [];

  for (const file of files) {
    const filePath = join(dir, file);
    const fileStat = await stat(filePath);

    if (fileStat.isFile()) {
      const ext = extname(file).toLowerCase();
      if (CONFIG.supportedFormats.includes(ext)) {
        imageFiles.push(filePath);
      }
    }
  }

  return imageFiles;
}

/**
 * 優化並生成多尺寸圖片
 */
async function optimizeImage(inputPath) {
  const fileName = basename(inputPath, extname(inputPath));

  try {
    // 確保輸出目錄存在
    await mkdir(CONFIG.outputDir, { recursive: true });

    console.log(`正在處理: ${fileName}`);

    // 為每個尺寸生成圖片
    for (const { width, suffix } of CONFIG.sizes) {
      const outputPath = join(CONFIG.outputDir, `${fileName}${suffix}.webp`);

      await sharp(inputPath)
        .resize(width, null, {
          withoutEnlargement: true, // 不放大圖片
          fit: 'inside',
        })
        .webp({
          quality: CONFIG.quality,
          effort: 6, // 壓縮努力程度 (0-6)，6 最好但最慢
        })
        .toFile(outputPath);

      console.log(`  ✓ 生成 ${width}px 版本: ${suffix}.webp`);
    }

    // 生成原始尺寸的優化版本
    const originalOutputPath = join(CONFIG.outputDir, `${fileName}.webp`);
    await sharp(inputPath)
      .webp({
        quality: CONFIG.quality,
        effort: 6,
      })
      .toFile(originalOutputPath);

    console.log(`  ✓ 生成原始尺寸優化版本`);

    // 獲取文件大小信息
    const originalSize = (await stat(inputPath)).size;
    const optimizedSize = (await stat(originalOutputPath)).size;
    const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(2);

    console.log(`  📊 原始大小: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`  📊 優化後: ${(optimizedSize / 1024).toFixed(2)} KB`);
    console.log(`  💾 減少: ${reduction}%\n`);

  } catch (error) {
    console.error(`❌ 處理失敗 ${fileName}:`, error.message);
  }
}

/**
 * 主函數
 */
async function main() {
  console.log('🖼️  開始優化圖片...\n');
  console.log(`輸入目錄: ${CONFIG.inputDir}`);
  console.log(`輸出目錄: ${CONFIG.outputDir}\n`);

  try {
    const imageFiles = await getImageFiles(CONFIG.inputDir);

    if (imageFiles.length === 0) {
      console.log('⚠️  未找到需要優化的圖片');
      return;
    }

    console.log(`找到 ${imageFiles.length} 張圖片\n`);

    // 處理所有圖片
    for (const imagePath of imageFiles) {
      await optimizeImage(imagePath);
    }

    console.log('✅ 所有圖片優化完成！');
    console.log(`\n📁 優化後的圖片保存在: ${CONFIG.outputDir}`);
    console.log('\n💡 使用建議:');
    console.log('  - 小尺寸 (-sm): 用於縮圖、卡片列表');
    console.log('  - 中尺寸 (-md): 用於普通列表顯示');
    console.log('  - 大尺寸 (-lg): 用於詳情頁、全屏顯示');
    console.log('  - 原始尺寸: 用於高分辨率顯示\n');

  } catch (error) {
    console.error('❌ 優化失敗:', error);
    process.exit(1);
  }
}

main();
