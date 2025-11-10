/**
 * 自動修復未使用 asyncHandler 包裹的異步路由
 *
 * 使用方法：
 * node scripts/fix-async-routes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 需要修復的路由文件列表
const ROUTE_FILES = [
  'src/ai/ai.routes.js',
  'src/characterCreation/characterCreation.routes.js',
  'src/gift/gift.routes.js',
  'src/match/match.routes.js',
  'src/membership/membership.routes.js',
  'src/membership/unlockTickets.routes.js',
  'src/payment/coins.routes.js',
  'src/payment/order.routes.js',
  'src/payment/potion.routes.js',
  'src/payment/transaction.routes.js',
  'src/shop/shop.routes.js',
  'src/user/assetPackages.routes.js',
  'src/user/assetPurchase.routes.js',
];

/**
 * 檢查文件是否已導入 asyncHandler
 */
function hasAsyncHandlerImport(content) {
  return /import\s+\{[^}]*asyncHandler[^}]*\}\s+from/.test(content) ||
         /import\s+asyncHandler\s+from/.test(content);
}

/**
 * 添加 asyncHandler 導入
 */
function addAsyncHandlerImport(content) {
  // 檢查是否已有 routeHelpers 的導入
  const routeHelpersImportMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"](\.\.\/)*utils\/routeHelpers\.js['"]/);

  if (routeHelpersImportMatch) {
    // 已有導入，檢查是否包含 asyncHandler
    const imports = routeHelpersImportMatch[1];
    if (imports.includes('asyncHandler')) {
      return content; // 已經導入了
    }

    // 添加 asyncHandler 到現有導入
    const newImports = imports.trim() + ', asyncHandler';
    return content.replace(
      routeHelpersImportMatch[0],
      `import { ${newImports} } from "${routeHelpersImportMatch[2] || '../'}utils/routeHelpers.js"`
    );
  }

  // 沒有 routeHelpers 導入，添加新的導入語句
  // 找到第一個 import 語句後插入
  const lines = content.split('\n');
  let insertIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      insertIndex = i + 1;
    } else if (lines[i].trim() && !lines[i].startsWith('import ') && insertIndex > 0) {
      break;
    }
  }

  // 計算相對路徑深度
  const depth = (content.match(/src\//g) || []).length;
  const prefix = '../'.repeat(depth > 1 ? depth - 1 : 1);

  lines.splice(insertIndex, 0, `import { asyncHandler } from "${prefix}utils/routeHelpers.js";`);
  return lines.join('\n');
}

/**
 * 修復異步路由
 */
function fixAsyncRoutes(content) {
  // 匹配模式：
  // router.method("/path", async (req, res) => {
  // router.method("/path", requireAuth, async (req, res) => {
  // router.method("/path", middleware1, middleware2, async (req, res) => {

  const routePattern = /(router\.(get|post|put|patch|delete)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*)((?:[\w]+\s*,\s*)*)(async\s*\(\s*req\s*,\s*res\s*(?:,\s*next\s*)?\)\s*=>)/g;

  let fixed = content;
  let match;
  const matches = [];

  // 收集所有匹配
  while ((match = routePattern.exec(content)) !== null) {
    // 檢查是否已經被 asyncHandler 包裹
    const beforeMatch = content.substring(Math.max(0, match.index - 50), match.index);
    if (!beforeMatch.includes('asyncHandler')) {
      matches.push(match);
    }
  }

  // 從後往前替換，避免索引錯位
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const [fullMatch, routerPart, method, middlewares, asyncPart] = match;

    // 構建修復後的代碼
    const middlewaresStr = middlewares.trim() ? middlewares : '';
    const replacement = `${routerPart}${middlewaresStr}asyncHandler(${asyncPart}`;

    // 找到對應的結束括號
    const startIndex = match.index + fullMatch.length;
    let braceCount = 1;
    let endIndex = startIndex;

    for (let j = startIndex; j < content.length; j++) {
      if (content[j] === '{') braceCount++;
      if (content[j] === '}') braceCount--;
      if (braceCount === 0) {
        endIndex = j + 1;
        break;
      }
    }

    // 找到路由定義的結束位置（通常是 ); 或 ));）
    let routeEnd = endIndex;
    while (routeEnd < content.length && /[\s\)]/.test(content[routeEnd])) {
      routeEnd++;
      if (content[routeEnd] === ';') {
        routeEnd++;
        break;
      }
    }

    // 在結束大括號後添加 )
    const before = content.substring(0, match.index);
    const middle = replacement + content.substring(startIndex, endIndex) + ')';
    const after = content.substring(endIndex, routeEnd);
    const rest = content.substring(routeEnd);

    fixed = before + middle + after + rest;
    content = fixed; // 更新 content 以便下一次迭代使用正確的索引
  }

  return fixed;
}

/**
 * 處理單個文件
 */
function processFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return false;
  }

  console.log(`\n📝 處理文件: ${filePath}`);

  let content = fs.readFileSync(fullPath, 'utf-8');
  const originalContent = content;

  // 1. 添加 asyncHandler 導入（如果需要）
  if (!hasAsyncHandlerImport(content)) {
    console.log('   ➕ 添加 asyncHandler 導入');
    content = addAsyncHandlerImport(content);
  }

  // 2. 修復異步路由
  content = fixAsyncRoutes(content);

  // 3. 檢查是否有修改
  if (content !== originalContent) {
    // 創建備份
    const backupPath = fullPath + '.backup';
    fs.writeFileSync(backupPath, originalContent, 'utf-8');
    console.log(`   💾 創建備份: ${path.basename(backupPath)}`);

    // 寫入修復後的文件
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log('   ✅ 文件已修復');
    return true;
  } else {
    console.log('   ✨ 文件無需修改');
    return false;
  }
}

/**
 * 主函數
 */
function main() {
  console.log('🔧 開始批量修復異步路由...\n');
  console.log('此腳本將：');
  console.log('1. 檢查並添加 asyncHandler 導入');
  console.log('2. 自動包裹未處理的異步路由');
  console.log('3. 為每個修改的文件創建 .backup 備份\n');

  let fixedCount = 0;
  let totalCount = 0;

  for (const file of ROUTE_FILES) {
    totalCount++;
    if (processFile(file)) {
      fixedCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✨ 完成！共處理 ${totalCount} 個文件，修復了 ${fixedCount} 個文件`);
  console.log('='.repeat(50));

  if (fixedCount > 0) {
    console.log('\n⚠️  請注意：');
    console.log('1. 備份文件已創建（.backup 擴展名）');
    console.log('2. 請手動檢查修復的文件，確保修改正確');
    console.log('3. 運行測試以驗證功能正常');
    console.log('4. 確認無誤後可刪除備份文件');
  }
}

main();
