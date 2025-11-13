/**
 * UTC+8 時區邏輯測試
 * 驗證每日重置是否使用正確的 UTC+8 時間
 */

/**
 * 模擬 getUTC8Date 函數
 */
const getUTC8Date = () => {
  const now = new Date();
  const utc8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return utc8Time.toISOString().split("T")[0];
};

/**
 * 模擬 getUTC8Month 函數
 */
const getUTC8Month = () => {
  const now = new Date();
  const utc8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return utc8Time.toISOString().slice(0, 7);
};

console.log('========================================');
console.log('UTC+8 時區邏輯測試');
console.log('========================================\n');

// 測試當前時間
const now = new Date();
const utcDate = now.toISOString().split("T")[0];
const utc8Date = getUTC8Date();
const utc8Month = getUTC8Month();

console.log('📅 當前時間信息：');
console.log(`   系統時間: ${now.toString()}`);
console.log(`   UTC 時間: ${now.toISOString()}`);
console.log(`   UTC 日期: ${utcDate}`);
console.log(`   UTC+8 日期: ${utc8Date}`);
console.log(`   UTC+8 月份: ${utc8Month}\n`);

// 測試邊界情況
console.log('🔍 測試邊界情況：\n');

// 測試 1: UTC 午夜前後（UTC+8 早上 8:00 前後）
const testCases = [
  { utc: '2025-01-13T15:59:59.000Z', desc: 'UTC 1/13 15:59 (台灣 1/13 23:59)' },
  { utc: '2025-01-13T16:00:00.000Z', desc: 'UTC 1/13 16:00 (台灣 1/14 00:00)' },
  { utc: '2025-01-13T16:00:01.000Z', desc: 'UTC 1/13 16:01 (台灣 1/14 00:01)' },
  { utc: '2025-01-13T23:59:59.000Z', desc: 'UTC 1/13 23:59 (台灣 1/14 07:59)' },
  { utc: '2025-01-14T00:00:00.000Z', desc: 'UTC 1/14 00:00 (台灣 1/14 08:00)' },
];

testCases.forEach((testCase, index) => {
  const testDate = new Date(testCase.utc);
  const testUTC8 = new Date(testDate.getTime() + 8 * 60 * 60 * 1000);
  const testUTC8DateStr = testUTC8.toISOString().split("T")[0];

  console.log(`測試 ${index + 1}: ${testCase.desc}`);
  console.log(`   UTC+8 日期: ${testUTC8DateStr}`);
  console.log(`   完整時間: ${testUTC8.toISOString()}\n`);
});

// 測試重置邏輯
console.log('✅ 重置邏輯測試：\n');

const testResetLogic = (lastResetDate, currentDate) => {
  const shouldReset = lastResetDate !== currentDate;
  return shouldReset;
};

const resetTests = [
  { last: '2025-01-13', current: '2025-01-13', expected: false, desc: '同一天' },
  { last: '2025-01-13', current: '2025-01-14', expected: true, desc: '跨天' },
  { last: '2025-01-31', current: '2025-02-01', expected: true, desc: '跨月' },
  { last: null, current: '2025-01-14', expected: true, desc: '首次使用' },
];

resetTests.forEach((test, index) => {
  const result = testResetLogic(test.last, test.current);
  const status = result === test.expected ? '✅' : '❌';
  console.log(`${status} 測試 ${index + 1} (${test.desc}):`);
  console.log(`   lastResetDate: ${test.last}`);
  console.log(`   currentDate: ${test.current}`);
  console.log(`   shouldReset: ${result} (預期: ${test.expected})\n`);
});

console.log('========================================');
console.log('✅ UTC+8 時區邏輯測試完成');
console.log('========================================\n');

console.log('📝 重點說明：\n');
console.log('1. 所有每日重置現在基於 UTC+8 時區');
console.log('2. 台灣用戶的重置時間為午夜 00:00（本地時間）');
console.log('3. UTC 時間下午 16:00 = UTC+8 午夜 00:00（重置點）');
console.log('4. 月度重置同樣基於 UTC+8 時區\n');

console.log('🌍 各時區的重置時間：\n');
console.log('   🇹🇼 台灣 (UTC+8):    00:00 (午夜) ✅ 最佳體驗');
console.log('   🇬🇧 英國 (UTC+0):    16:00 (下午 4 點)');
console.log('   🇺🇸 美東 (UTC-5):    11:00 (上午 11 點)');
console.log('   🇯🇵 日本 (UTC+9):    01:00 (凌晨 1 點)');
console.log('   🇨🇳 中國 (UTC+8):    00:00 (午夜) ✅\n');
