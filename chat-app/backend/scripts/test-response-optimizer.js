/**
 * 響應優化器測試腳本
 * 用於驗證響應優化器的功能和效果
 */

import {
  removeSensitiveFields,
  pick,
  omit,
  applySelector,
  optimizeResponse,
  estimateSize,
  compareSize,
} from '../src/utils/responseOptimizer.js';

// 測試數據
const testUser = {
  id: 'user-123',
  uid: 'user-123',
  email: 'test@example.com',
  displayName: '測試用戶',
  photoURL: '/avatar.jpg',
  membershipTier: 'vip',
  password: 'secret_password', // 敏感字段
  apiKey: 'sk-xxx', // 敏感字段
  favorites: ['char-1', 'char-2'],
  conversations: ['conv-1', 'conv-2'],
  assets: { coins: 100, createCards: 5 },
  createdAt: '2024-01-01',
  updatedAt: '2024-01-10',
};

const testCharacter = {
  id: 'char-001',
  display_name: '測試角色',
  gender: 'female',
  age: 25,
  background: '角色背景故事',
  personality: '性格描述',
  secret_background: '秘密背景（不應返回給客戶端）',
  scenario: '場景設定',
  greeting: '問候語',
  voices: ['voice1', 'voice2'],
  portraitUrl: '/portrait.jpg',
  tags: ['tag1', 'tag2'],
  creatorUid: 'creator-123',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-10',
  totalChatUsers: 100,
  totalFavorites: 50,
};

const testConversation = {
  id: 'conv-001',
  userId: 'user-123',
  characterId: 'char-001',
  character: { ...testCharacter },
  messages: Array(100).fill({ id: 'msg', role: 'user', text: 'Hello' }),
  lastMessage: '最後一條消息',
  lastMessageAt: '2024-01-10',
  partnerLastMessage: '角色回覆',
  partnerLastRepliedAt: '2024-01-10',
  unreadCount: 2,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-10',
};

const testMessages = [
  {
    id: 'msg-1',
    role: 'user',
    text: 'Hello',
    userId: 'user-123',
    characterId: 'char-001',
    metadata: { timestamp: '2024-01-10' },
    createdAt: '2024-01-10',
    updatedAt: '2024-01-10',
  },
  {
    id: 'msg-2',
    role: 'partner',
    text: 'Hi!',
    imageUrl: '/image.jpg',
    userId: 'user-123',
    characterId: 'char-001',
    metadata: { timestamp: '2024-01-10' },
    createdAt: '2024-01-10',
    updatedAt: '2024-01-10',
  },
];

// 測試函數
function runTests() {
  console.log('🧪 開始測試響應優化器...\n');

  let passed = 0;
  let failed = 0;

  // ==================== 測試 1: 移除敏感字段 ====================
  console.log('📋 測試 1: removeSensitiveFields()');
  try {
    const cleaned = removeSensitiveFields(testUser);

    if (cleaned.password !== undefined || cleaned.apiKey !== undefined) {
      throw new Error('敏感字段未被移除');
    }

    if (!cleaned.id || !cleaned.displayName) {
      throw new Error('正常字段被錯誤移除');
    }

    console.log('✅ 通過：敏感字段已正確移除\n');
    passed++;
  } catch (error) {
    console.error('❌ 失敗:', error.message, '\n');
    failed++;
  }

  // ==================== 測試 2: pick() 函數 ====================
  console.log('📋 測試 2: pick()');
  try {
    const picked = pick(testUser, ['id', 'displayName', 'membershipTier']);

    if (Object.keys(picked).length !== 3) {
      throw new Error(`期望 3 個字段，實際 ${Object.keys(picked).length} 個`);
    }

    if (!picked.id || !picked.displayName || !picked.membershipTier) {
      throw new Error('缺少必要字段');
    }

    if (picked.email || picked.password) {
      throw new Error('包含不應該有的字段');
    }

    console.log('✅ 通過：pick() 正確選擇字段');
    console.log('   保留字段:', Object.keys(picked).join(', '), '\n');
    passed++;
  } catch (error) {
    console.error('❌ 失敗:', error.message, '\n');
    failed++;
  }

  // ==================== 測試 3: omit() 函數 ====================
  console.log('📋 測試 3: omit()');
  try {
    const omitted = omit(testUser, ['password', 'apiKey', 'email']);

    if (omitted.password || omitted.apiKey || omitted.email) {
      throw new Error('字段未被移除');
    }

    if (!omitted.id || !omitted.displayName) {
      throw new Error('正常字段被錯誤移除');
    }

    console.log('✅ 通過：omit() 正確排除字段\n');
    passed++;
  } catch (error) {
    console.error('❌ 失敗:', error.message, '\n');
    failed++;
  }

  // ==================== 測試 4: userPublic 選擇器 ====================
  console.log('📋 測試 4: applySelector(userPublic)');
  try {
    const optimized = applySelector(testUser, 'userPublic');
    const expectedFields = ['id', 'displayName', 'photoURL', 'membershipTier'];

    expectedFields.forEach((field) => {
      if (optimized[field] === undefined) {
        throw new Error(`缺少必要字段: ${field}`);
      }
    });

    if (optimized.email || optimized.favorites || optimized.password) {
      throw new Error('包含不應該有的字段');
    }

    console.log('✅ 通過：userPublic 選擇器正確');
    console.log('   保留字段:', Object.keys(optimized).join(', '), '\n');
    passed++;
  } catch (error) {
    console.error('❌ 失敗:', error.message, '\n');
    failed++;
  }

  // ==================== 測試 5: characterList 選擇器 ====================
  console.log('📋 測試 5: applySelector(characterList)');
  try {
    const optimized = applySelector(testCharacter, 'characterList');
    const expectedFields = [
      'id',
      'display_name',
      'gender',
      'portraitUrl',
      'tags',
      'totalChatUsers',
      'totalFavorites',
    ];

    expectedFields.forEach((field) => {
      if (optimized[field] === undefined) {
        throw new Error(`缺少必要字段: ${field}`);
      }
    });

    if (optimized.secret_background || optimized.personality || optimized.background) {
      throw new Error('包含不應該有的字段');
    }

    console.log('✅ 通過：characterList 選擇器正確');
    console.log('   保留字段:', Object.keys(optimized).join(', '), '\n');
    passed++;
  } catch (error) {
    console.error('❌ 失敗:', error.message, '\n');
    failed++;
  }

  // ==================== 測試 6: message 選擇器 ====================
  console.log('📋 測試 6: applySelector(message) - 數組');
  try {
    const optimized = applySelector(testMessages, 'message');

    if (!Array.isArray(optimized) || optimized.length !== 2) {
      throw new Error('未正確處理數組');
    }

    const expectedFields = ['id', 'role', 'text', 'createdAt'];

    optimized.forEach((msg) => {
      expectedFields.forEach((field) => {
        if (msg[field] === undefined && field !== 'imageUrl' && field !== 'videoUrl') {
          throw new Error(`缺少必要字段: ${field}`);
        }
      });

      if (msg.userId || msg.characterId || msg.metadata) {
        throw new Error('包含不應該有的字段');
      }
    });

    console.log('✅ 通過：message 選擇器正確（數組處理）');
    console.log('   消息 1 字段:', Object.keys(optimized[0]).join(', '));
    console.log('   消息 2 字段:', Object.keys(optimized[1]).join(', '), '\n');
    passed++;
  } catch (error) {
    console.error('❌ 失敗:', error.message, '\n');
    failed++;
  }

  // ==================== 測試 7: conversationHistory 選擇器 ====================
  console.log('📋 測試 7: applySelector(conversationHistory)');
  try {
    const optimized = applySelector(testConversation, 'conversationHistory');

    const expectedFields = [
      'id',
      'characterId',
      'character',
      'lastMessage',
      'lastMessageAt',
      'updatedAt',
    ];

    expectedFields.forEach((field) => {
      if (optimized[field] === undefined) {
        throw new Error(`缺少必要字段: ${field}`);
      }
    });

    if (optimized.messages || optimized.userId) {
      throw new Error('包含不應該有的字段（messages 應被排除）');
    }

    console.log('✅ 通過：conversationHistory 選擇器正確');
    console.log('   保留字段:', Object.keys(optimized).join(', '), '\n');
    passed++;
  } catch (error) {
    console.error('❌ 失敗:', error.message, '\n');
    failed++;
  }

  // ==================== 測試 8: 大小比較 ====================
  console.log('📋 測試 8: compareSize()');
  try {
    const original = testConversation;
    const optimized = applySelector(testConversation, 'conversationHistory');

    const comparison = compareSize(original, optimized);

    if (comparison.saved <= 0) {
      throw new Error('優化後大小未減少');
    }

    if (comparison.percentage <= 0) {
      throw new Error('節省百分比計算錯誤');
    }

    console.log('✅ 通過：大小比較功能正確');
    console.log(`   原始大小: ${comparison.originalSize} bytes`);
    console.log(`   優化後: ${comparison.optimizedSize} bytes`);
    console.log(`   節省: ${comparison.saved} bytes (${comparison.percentage}%)\n`);
    passed++;
  } catch (error) {
    console.error('❌ 失敗:', error.message, '\n');
    failed++;
  }

  // ==================== 測試 9: optimizeResponse() 綜合測試 ====================
  console.log('📋 測試 9: optimizeResponse()');
  try {
    const optimized = optimizeResponse(testUser, {
      selector: 'userPublic',
      removeSensitive: true,
    });

    if (optimized.password || optimized.apiKey) {
      throw new Error('敏感字段未被移除');
    }

    if (!optimized.id || !optimized.displayName) {
      throw new Error('必要字段缺失');
    }

    console.log('✅ 通過：optimizeResponse() 綜合優化正確\n');
    passed++;
  } catch (error) {
    console.error('❌ 失敗:', error.message, '\n');
    failed++;
  }

  // ==================== 測試 10: 空值處理 ====================
  console.log('📋 測試 10: 空值和邊界情況處理');
  try {
    const nullResult = applySelector(null, 'userPublic');
    const undefinedResult = applySelector(undefined, 'userPublic');
    const emptyArrayResult = applySelector([], 'userPublic');

    if (nullResult !== null) {
      throw new Error('null 處理錯誤');
    }

    if (undefinedResult !== undefined) {
      throw new Error('undefined 處理錯誤');
    }

    if (!Array.isArray(emptyArrayResult) || emptyArrayResult.length !== 0) {
      throw new Error('空數組處理錯誤');
    }

    console.log('✅ 通過：空值和邊界情況處理正確\n');
    passed++;
  } catch (error) {
    console.error('❌ 失敗:', error.message, '\n');
    failed++;
  }

  // ==================== 測試總結 ====================
  console.log('═════════════════════════════════════');
  console.log('📊 測試總結');
  console.log('═════════════════════════════════════');
  console.log(`✅ 通過: ${passed} 個測試`);
  console.log(`❌ 失敗: ${failed} 個測試`);
  console.log(`📈 成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('═════════════════════════════════════\n');

  if (failed === 0) {
    console.log('🎉 所有測試通過！響應優化器功能正常。\n');
    process.exit(0);
  } else {
    console.log('⚠️  部分測試失敗，請檢查代碼。\n');
    process.exit(1);
  }
}

// 執行測試
runTests();
