/**
 * P0 優化測試腳本
 * 測試所有 P0 優化是否正常運作
 */

console.log('🧪 開始測試 P0 優化...\n');

// 測試 1: 共享工具模塊加載
console.log('📦 測試 1: 共享工具模塊加載');
try {
  const { getFirestoreDb, getFirebaseAdminAuth } = await import('./shared/backend-utils/firebase.js');
  console.log('  ✅ Firebase 模塊加載成功');
} catch (error) {
  console.error('  ❌ Firebase 模塊加載失敗:', error.message);
}

try {
  const logger = await import('./shared/backend-utils/logger.js');
  console.log('  ✅ Logger 模塊加載成功');
} catch (error) {
  console.error('  ❌ Logger 模塊加載失敗:', error.message);
}

try {
  const { sanitize } = await import('./shared/backend-utils/sanitizer.js');
  console.log('  ✅ Sanitizer 模塊加載成功');
} catch (error) {
  console.error('  ❌ Sanitizer 模塊加載失敗:', error.message);
}

try {
  const csrf = await import('./shared/backend-utils/csrfProtection.js');
  console.log('  ✅ CSRF Protection 模塊加載成功');
} catch (error) {
  console.error('  ❌ CSRF Protection 模塊加載失敗:', error.message);
}

// 測試 2: TTS 緩存模塊
console.log('\n📦 測試 2: TTS 緩存模塊加載');
try {
  const ttsCache = await import('./chat-app/backend/src/ai/ttsCache.service.js');
  console.log('  ✅ TTS Cache 模塊加載成功');

  // 測試緩存統計功能
  const stats = ttsCache.getCacheStats();
  console.log('  ✅ TTS Cache 統計功能正常:', {
    currentSize: stats.currentSize,
    maxSize: stats.maxSize,
    hitRate: stats.hitRate,
  });
} catch (error) {
  console.error('  ❌ TTS Cache 模塊加載失敗:', error.message);
}

// 測試 3: Sanitizer 功能測試
console.log('\n🔒 測試 3: 日誌脫敏功能');
try {
  const { sanitize } = await import('./shared/backend-utils/sanitizer.js');

  const testData = {
    email: 'user@example.com',
    password: 'secret123',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
    phone: '0912345678',
    userId: 'user123',
  };

  const sanitized = sanitize(testData);

  const tests = [
    { field: 'email', expected: 'us***@example.com', actual: sanitized.email },
    { field: 'password', expected: '[REDACTED]', actual: sanitized.password },
    { field: 'phone', expected: '09****5678', actual: sanitized.phone },
    { field: 'userId', expected: 'user123', actual: sanitized.userId }, // userId 不應該被脫敏
  ];

  tests.forEach(test => {
    if (test.actual === test.expected) {
      console.log(`  ✅ ${test.field}: ${test.actual}`);
    } else {
      console.log(`  ❌ ${test.field}: 預期 "${test.expected}", 實際 "${test.actual}"`);
    }
  });
} catch (error) {
  console.error('  ❌ Sanitizer 測試失敗:', error.message);
}

// 測試 4: CSRF Token 生成
console.log('\n🔒 測試 4: CSRF Token 生成');
try {
  const { setCsrfToken } = await import('./shared/backend-utils/csrfProtection.js');

  // 模擬 Express req/res
  const mockReq = { cookies: {} };
  const mockRes = {
    locals: {},
    cookie: (name, value, options) => {
      mockRes.cookies = mockRes.cookies || {};
      mockRes.cookies[name] = value;
      console.log(`  ✅ Cookie 已設置: ${name} = ${value.substring(0, 16)}...`);
    },
  };

  const middleware = setCsrfToken();
  await new Promise((resolve) => {
    middleware(mockReq, mockRes, resolve);
  });

  if (mockRes.locals.csrfToken && mockRes.locals.csrfToken.length === 64) {
    console.log(`  ✅ CSRF Token 生成成功: ${mockRes.locals.csrfToken.substring(0, 16)}...`);
  } else {
    console.log('  ❌ CSRF Token 生成失敗');
  }
} catch (error) {
  console.error('  ❌ CSRF Token 生成測試失敗:', error.message);
}

// 測試結果總結
console.log('\n' + '='.repeat(50));
console.log('🎉 P0 優化模塊測試完成！');
console.log('='.repeat(50));
console.log('\n📋 下一步測試（需要啟動服務）：');
console.log('  1. 啟動服務: npm run dev');
console.log('  2. 測試 TTS 緩存實際運作');
console.log('  3. 測試 CSRF 保護實際運作');
console.log('  4. 測試請求大小限制');
console.log('\n✅ 模塊加載測試全部通過即可進入服務測試階段！');
