/**
 * useVariableEditor 邊界情況測試
 *
 * 這個文件包含了對 useVariableEditor composable 的邊界情況測試
 * 用於驗證修復後的代碼能否正確處理各種異常情況
 *
 * 使用方法：
 * 1. 在瀏覽器控制台中運行這些測試
 * 2. 或者集成到測試框架（如 Vitest）中
 */

import {
  textToEditorContent,
  editorContentToText,
} from './useVariableEditor.js';

/**
 * 測試結果記錄
 */
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: [],
};

/**
 * 斷言函數
 */
function assert(condition, testName, expected, actual) {
  testResults.total++;

  if (condition) {
    testResults.passed++;
    testResults.details.push({
      name: testName,
      status: 'PASSED',
      expected,
      actual,
    });
    console.log(`✓ ${testName}`);
  } else {
    testResults.failed++;
    testResults.details.push({
      name: testName,
      status: 'FAILED',
      expected,
      actual,
    });
    console.error(`✗ ${testName}`);
    console.error(`  Expected: ${JSON.stringify(expected)}`);
    console.error(`  Actual: ${JSON.stringify(actual)}`);
  }
}

/**
 * 測試套件 1：textToEditorContent 邊界情況
 */
function testTextToEditorContent() {
  console.log('\n=== 測試 textToEditorContent 邊界情況 ===\n');

  // 測試 1: 空文本
  const test1 = textToEditorContent('', []);
  assert(
    test1.type === 'doc' && test1.content[0].type === 'paragraph',
    '空文本應返回空段落',
    { type: 'doc', content: [{ type: 'paragraph' }] },
    test1
  );

  // 測試 2: null 文本
  const test2 = textToEditorContent(null, []);
  assert(
    test2.type === 'doc' && test2.content[0].type === 'paragraph',
    'null 文本應返回空段落',
    { type: 'doc', content: [{ type: 'paragraph' }] },
    test2
  );

  // 測試 3: undefined 文本
  const test3 = textToEditorContent(undefined, []);
  assert(
    test3.type === 'doc' && test3.content[0].type === 'paragraph',
    'undefined 文本應返回空段落',
    { type: 'doc', content: [{ type: 'paragraph' }] },
    test3
  );

  // 測試 4: variables 為 null
  const test4 = textToEditorContent('Hello {name}', null);
  assert(
    test4.content[0].content.length === 2 &&
    test4.content[0].content[0].text === 'Hello ' &&
    test4.content[0].content[1].text === '{name}',
    'variables 為 null 時應將變數視為普通文本',
    'Hello {name}',
    test4
  );

  // 測試 5: variables 為 undefined
  const test5 = textToEditorContent('Hello {name}', undefined);
  assert(
    test5.content[0].content.length === 2 &&
    test5.content[0].content[0].text === 'Hello ' &&
    test5.content[0].content[1].text === '{name}',
    'variables 為 undefined 時應將變數視為普通文本',
    'Hello {name}',
    test5
  );

  // 測試 6: variables 數組中有 null 元素
  const test6 = textToEditorContent('Hello {name}', [null, { name: '{name}' }, undefined]);
  assert(
    test6.content[0].content.length === 2 &&
    test6.content[0].content[0].text === 'Hello ' &&
    test6.content[0].content[1].type === 'variable',
    'variables 數組中的 null/undefined 應被過濾',
    'Hello {name} as variable',
    test6
  );

  // 測試 7: variables 數組中有缺少 name 的對象
  const test7 = textToEditorContent('Hello {name}', [
    { name: '{name}' },
    { value: 'no-name' },
    {},
  ]);
  assert(
    test7.content[0].content.length === 2 &&
    test7.content[0].content[1].type === 'variable',
    '缺少 name 的對象應被過濾',
    'Hello {name} as variable',
    test7
  );

  // 測試 8: 有效的變數
  const test8 = textToEditorContent('Hello {name}!', [{ name: '{name}' }]);
  assert(
    test8.content[0].content.length === 3 &&
    test8.content[0].content[0].text === 'Hello ' &&
    test8.content[0].content[1].type === 'variable' &&
    test8.content[0].content[1].attrs.name === '{name}' &&
    test8.content[0].content[2].text === '!',
    '有效變數應正確解析',
    'Hello {name}! with variable',
    test8
  );

  // 測試 9: 無效的變數（不在 variables 列表中）
  const test9 = textToEditorContent('Hello {unknown}!', [{ name: '{name}' }]);
  assert(
    test9.content[0].content.length === 3 &&
    test9.content[0].content[1].text === '{unknown}',
    '不在列表中的變數應視為普通文本',
    'Hello {unknown}! as text',
    test9
  );

  // 測試 10: 多個變數
  const test10 = textToEditorContent('Hello {name}, you have {count} messages', [
    { name: '{name}' },
    { name: '{count}' },
  ]);
  assert(
    test10.content[0].content.length === 5 &&
    test10.content[0].content[1].type === 'variable' &&
    test10.content[0].content[3].type === 'variable',
    '多個變數應正確解析',
    '5 parts with 2 variables',
    test10.content[0].content.length
  );
}

/**
 * 測試套件 2：editorContentToText 邊界情況
 */
function testEditorContentToText() {
  console.log('\n=== 測試 editorContentToText 邊界情況 ===\n');

  // 測試 1: null editor
  const test1 = editorContentToText(null);
  assert(
    test1 === '',
    'null editor 應返回空字符串',
    '',
    test1
  );

  // 測試 2: undefined editor
  const test2 = editorContentToText(undefined);
  assert(
    test2 === '',
    'undefined editor 應返回空字符串',
    '',
    test2
  );

  // 測試 3: 模擬 editor.getJSON() 拋出異常
  const mockEditorWithError = {
    getJSON: () => {
      throw new Error('Mock error');
    },
  };
  const test3 = editorContentToText(mockEditorWithError);
  assert(
    test3 === '',
    'getJSON() 拋出異常時應返回空字符串',
    '',
    test3
  );

  // 測試 4: 模擬正常的編輯器內容
  const mockEditor1 = {
    getJSON: () => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'variable', attrs: { name: '{name}' } },
            { type: 'text', text: '!' },
          ],
        },
      ],
    }),
  };
  const test4 = editorContentToText(mockEditor1);
  assert(
    test4 === 'Hello {name}!',
    '正常內容應正確轉換',
    'Hello {name}!',
    test4
  );

  // 測試 5: 模擬 variable 節點缺少 attrs
  const mockEditor2 = {
    getJSON: () => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'variable' }, // 缺少 attrs
            { type: 'text', text: '!' },
          ],
        },
      ],
    }),
  };
  const test5 = editorContentToText(mockEditor2);
  assert(
    test5 === 'Hello !',
    '缺少 attrs 的 variable 應返回空字符串',
    'Hello !',
    test5
  );

  // 測試 6: 模擬 variable 節點的 attrs 為 null
  const mockEditor3 = {
    getJSON: () => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'variable', attrs: null },
            { type: 'text', text: '!' },
          ],
        },
      ],
    }),
  };
  const test6 = editorContentToText(mockEditor3);
  assert(
    test6 === 'Hello !',
    'attrs 為 null 的 variable 應返回空字符串',
    'Hello !',
    test6
  );

  // 測試 7: 模擬 text 節點缺少 text 屬性
  const mockEditor4 = {
    getJSON: () => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text' }, // 缺少 text 屬性
          ],
        },
      ],
    }),
  };
  const test7 = editorContentToText(mockEditor4);
  assert(
    test7 === '',
    '缺少 text 屬性的 text 節點應返回空字符串',
    '',
    test7
  );

  // 測試 8: 多段落內容（測試換行邏輯）
  const mockEditor5 = {
    getJSON: () => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Line 1' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Line 2' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Line 3' }],
        },
      ],
    }),
  };
  const test8 = editorContentToText(mockEditor5);
  assert(
    test8 === 'Line 1\nLine 2\nLine 3',
    '多段落應正確添加換行符',
    'Line 1\nLine 2\nLine 3',
    test8
  );

  // 測試 9: 空段落
  const mockEditor6 = {
    getJSON: () => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    }),
  };
  const test9 = editorContentToText(mockEditor6);
  assert(
    test9 === '',
    '空段落應返回空字符串',
    '',
    test9
  );

  // 測試 10: 嵌套內容
  const mockEditor7 = {
    getJSON: () => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Nested ',
            },
            {
              type: 'bold',
              content: [
                { type: 'text', text: 'content' },
              ],
            },
          ],
        },
      ],
    }),
  };
  const test10 = editorContentToText(mockEditor7);
  assert(
    test10 === 'Nested content',
    '嵌套內容應正確處理',
    'Nested content',
    test10
  );
}

/**
 * 執行所有測試
 */
function runAllTests() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║  useVariableEditor 邊界情況測試套件          ║');
  console.log('╚═══════════════════════════════════════════════╝');

  testTextToEditorContent();
  testEditorContentToText();

  // 輸出測試報告
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║              測試報告                         ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  console.log(`總測試數: ${testResults.total}`);
  console.log(`✓ 通過: ${testResults.passed}`);
  console.log(`✗ 失敗: ${testResults.failed}`);
  console.log(`通過率: ${Math.round((testResults.passed / testResults.total) * 100)}%\n`);

  if (testResults.failed > 0) {
    console.log('失敗的測試：');
    testResults.details
      .filter(t => t.status === 'FAILED')
      .forEach(t => {
        console.log(`  ✗ ${t.name}`);
      });
  }

  if (testResults.failed === 0) {
    console.log('✓ 所有測試通過！邊界情況處理正確。');
  } else {
    console.error(`✗ 有 ${testResults.failed} 個測試失敗。`);
  }

  return testResults;
}

// 如果在 Node.js 環境中運行
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testTextToEditorContent,
    testEditorContentToText,
  };
}

// 如果在瀏覽器環境中運行
if (typeof window !== 'undefined') {
  window.runVariableEditorTests = runAllTests;
  console.log('提示：在瀏覽器控制台中運行 runVariableEditorTests() 來執行測試');
}

// 自動運行測試（如果直接執行此文件）
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests();
}
