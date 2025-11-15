/**
 * 檢查聊天相關 composables 的參數傳遞
 * 檢查函數簽名和實際調用是否匹配
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const composablesDir = path.join(__dirname, 'src', 'composables', 'chat');

// 定義需要檢查的 composables 及其預期參數
const composablesToCheck = {
  'useSuggestions': {
    expectedParams: ['messages', 'partner', 'firebaseAuth', 'currentUserId'],
    file: 'useSuggestions.js',
    type: 'positional'
  },
  'usePartner': {
    expectedParams: ['{ partnerId }'],
    file: 'usePartner.js',
    type: 'destructured'
  },
  'useChatMessages': {
    expectedParams: ['partnerId'],
    file: 'useChatMessages.js',
    type: 'positional'
  },
  'useSendMessage': {
    expectedParams: ['options object'],
    file: 'useSendMessage.js',
    type: 'options'
  },
  'useEventHandlers': {
    expectedParams: ['options object'],
    file: 'useEventHandlers.js',
    type: 'options'
  },
  'useChatActions': {
    expectedParams: ['options object'],
    file: 'useChatActions.js',
    type: 'options'
  }
};

// 讀取文件並提取函數簽名
function extractFunctionSignature(filePath, functionName) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 匹配 export function useName(...) 或 export const useName = (...) =>
    const regex1 = new RegExp(`export\\s+function\\s+${functionName}\\s*\\(([^)]*)\\)`, 'm');
    const regex2 = new RegExp(`export\\s+const\\s+${functionName}\\s*=\\s*\\(([^)]*)\\)\\s*=>`, 'm');

    const match = content.match(regex1) || content.match(regex2);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  } catch (error) {
    return null;
  }
}

// 搜索函數調用
function findFunctionCalls(directory, functionName) {
  const calls = [];

  function searchDir(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else if (file.endsWith('.js') || file.endsWith('.vue')) {
        const content = fs.readFileSync(fullPath, 'utf-8');

        // 查找調用模式：= useName( 或 } = useName(
        const regex = new RegExp(`(=|})\\s*${functionName}\\s*\\(([^)]*)\\)`, 'gm');
        let match;

        while ((match = regex.exec(content)) !== null) {
          const lines = content.substring(0, match.index).split('\n');
          const lineNumber = lines.length;

          calls.push({
            file: fullPath,
            line: lineNumber,
            params: match[2].trim(),
            context: content.substring(Math.max(0, match.index - 100), match.index + match[0].length + 100)
          });
        }
      }
    }
  }

  searchDir(directory);
  return calls;
}

console.log('🔍 檢查聊天 Composables 的參數傳遞\n');
console.log('=' .repeat(80));

let totalIssues = 0;

for (const [funcName, config] of Object.entries(composablesToCheck)) {
  console.log(`\n📦 檢查 ${funcName}`);
  console.log('-'.repeat(80));

  // 1. 檢查函數簽名
  const filePath = path.join(composablesDir, config.file);
  const signature = extractFunctionSignature(filePath, funcName);

  if (signature) {
    console.log(`✅ 函數簽名: ${funcName}(${signature})`);
  } else {
    console.log(`⚠️  無法提取函數簽名`);
  }

  // 2. 查找所有調用
  const srcDir = path.join(__dirname, 'src');
  const calls = findFunctionCalls(srcDir, funcName);

  console.log(`📍 找到 ${calls.length} 個調用點:`);

  if (calls.length === 0) {
    console.log(`   ⚠️  未找到任何調用（可能未被使用）`);
    totalIssues++;
  }

  for (const call of calls) {
    const relativePath = path.relative(__dirname, call.file);
    console.log(`\n   位置: ${relativePath}:${call.line}`);
    console.log(`   參數: ${call.params || '(無參數)'}`);

    // 簡單驗證
    if (config.type === 'positional' && config.expectedParams.length > 0) {
      const paramCount = call.params ? call.params.split(',').length : 0;
      if (paramCount === 0 && config.expectedParams.length > 0) {
        console.log(`   ❌ 錯誤: 缺少參數！預期 ${config.expectedParams.length} 個參數`);
        totalIssues++;
      } else if (paramCount < config.expectedParams.length) {
        console.log(`   ⚠️  警告: 參數數量可能不足（${paramCount} < ${config.expectedParams.length}）`);
        totalIssues++;
      } else {
        console.log(`   ✅ 參數數量正確`);
      }
    } else if (call.params === '' || call.params === null) {
      console.log(`   ❌ 錯誤: 調用時未傳遞參數！`);
      totalIssues++;
    } else {
      console.log(`   ✅ 已傳遞參數`);
    }
  }
}

console.log('\n' + '='.repeat(80));
if (totalIssues === 0) {
  console.log('✅ 檢查完成！未發現問題。');
} else {
  console.log(`⚠️  檢查完成！發現 ${totalIssues} 個潛在問題。`);
}
console.log('='.repeat(80) + '\n');
