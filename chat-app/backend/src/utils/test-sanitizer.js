/**
 * 日誌脫敏功能測試腳本
 * 用於驗證敏感信息是否被正確過濾
 */

import logger from './logger.js';
import { sanitize, containsSensitiveData } from './sanitizer.js';

console.log('🧪 開始測試日誌脫敏功能...\n');

// ==================== 測試 1: 密碼脫敏 ====================
console.log('📝 測試 1: 密碼字段脫敏');
const userWithPassword = {
  username: 'testuser',
  password: 'MySecretPassword123!',
  email: 'user@example.com',
};

const sanitized1 = sanitize(userWithPassword);
console.log('原始:', userWithPassword);
console.log('脫敏:', sanitized1);
console.log('✓ 密碼應該被替換為 [REDACTED]\n');

// ==================== 測試 2: Token 脫敏 ====================
console.log('📝 測試 2: Token 脫敏');
const authData = {
  userId: 'user123',
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  apiKey: 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG',
};

const sanitized2 = sanitize(authData);
console.log('原始:', authData);
console.log('脫敏:', sanitized2);
console.log('✓ Token 應該被部分隱藏（前後各 4 字元）\n');

// ==================== 測試 3: Email 部分隱藏 ====================
console.log('📝 測試 3: Email 部分隱藏');
const contactInfo = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '0912345678',
};

const sanitized3 = sanitize(contactInfo);
console.log('原始:', contactInfo);
console.log('脫敏:', sanitized3);
console.log('✓ Email 應顯示為 jo***@example.com');
console.log('✓ 手機號應顯示為 09****5678\n');

// ==================== 測試 4: 嵌套對象脫敏 ====================
console.log('📝 測試 4: 嵌套對象脫敏');
const nestedData = {
  user: {
    id: 'user123',
    profile: {
      email: 'user@example.com',
      settings: {
        password: 'secret123',
        apiKey: 'sk_test_FAKE_KEY_FOR_TESTING_ONLY_12345',
      },
    },
  },
  metadata: {
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
};

const sanitized4 = sanitize(nestedData);
console.log('原始:', JSON.stringify(nestedData, null, 2));
console.log('脫敏:', JSON.stringify(sanitized4, null, 2));
console.log('✓ 嵌套的密碼和 Token 都應該被脫敏\n');

// ==================== 測試 5: 數組中的敏感數據 ====================
console.log('📝 測試 5: 數組中的敏感數據');
const arrayData = {
  users: [
    { username: 'user1', password: 'pass1' },
    { username: 'user2', password: 'pass2' },
  ],
  tokens: [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test1',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test2',
  ],
};

const sanitized5 = sanitize(arrayData);
console.log('原始:', arrayData);
console.log('脫敏:', sanitized5);
console.log('✓ 數組中的所有敏感數據都應該被脫敏\n');

// ==================== 測試 6: Logger 集成測試 ====================
console.log('📝 測試 6: Logger 集成測試');
console.log('以下日誌應該自動脫敏敏感信息：\n');

// 測試 info 級別
logger.info('用戶登入', {
  userId: 'user123',
  email: 'test@example.com',
  password: 'ShouldNotAppear',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example',
});

// 測試 error 級別
logger.error('API 請求失敗', {
  endpoint: '/api/users',
  apiKey: 'sk-proj-1234567890abcdefghij',
  error: 'Unauthorized',
});

// 測試 debug 級別
logger.debug('配置信息', {
  firebase: {
    apiKey: 'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ',
    projectId: 'chat-app-test',
  },
  openai: {
    apiKey: 'sk-proj-test1234567890',
  },
});

console.log('\n✓ 以上日誌中的密碼、Token、API Key 應該都被脫敏\n');

// ==================== 測試 7: 敏感數據檢測 ====================
console.log('📝 測試 7: 敏感數據檢測');
const testStrings = [
  { str: 'normal string', expected: false },
  { str: 'password=secret123', expected: true },
  { str: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', expected: true },
  { str: 'sk-proj-1234567890abcdefghij', expected: true },
  { str: 'user email: test@example.com', expected: false },
];

testStrings.forEach(({ str, expected }) => {
  const result = containsSensitiveData(str);
  const status = result === expected ? '✓' : '✗';
  console.log(`${status} "${str.substring(0, 30)}..." -> ${result} (expected: ${expected})`);
});

// ==================== 測試 8: 特殊情況 ====================
console.log('\n📝 測試 8: 特殊情況處理');

// null 和 undefined
console.log('null:', sanitize(null));
console.log('undefined:', sanitize(undefined));

// 循環引用
const circular = { name: 'test' };
circular.self = circular;
console.log('循環引用:', sanitize(circular));

// Date 對象
const dateObj = { created: new Date(), password: 'secret' };
const sanitized8 = sanitize(dateObj);
console.log('Date 對象:', sanitized8);

// Error 對象
const errorObj = new Error('Test error');
errorObj.password = 'secret';
console.log('Error 對象:', sanitize(errorObj));

console.log('\n🎉 所有測試完成！');
console.log('請檢查輸出，確認所有敏感信息都已被正確脫敏。');
