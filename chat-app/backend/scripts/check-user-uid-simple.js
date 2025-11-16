/**
 * 簡單檢查用戶 UID - 通過 API 調用
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:4000';

async function checkUserUid(userId) {
  try {
    const response = await fetch(`${API_BASE}/api/users/${userId}`);

    if (!response.ok) {
      console.error(`❌ API 錯誤 (${response.status}):`, await response.text());
      return null;
    }

    const data = await response.json();
    console.log('\n=== 用戶數據 ===');
    console.log('ID:', data.id || '無');
    console.log('UID:', data.uid || '無');
    console.log('Display Name:', data.displayName || '無');
    console.log('Email:', data.email || '無');

    // 檢查 UID 是否有問題
    if (data.uid && data.uid.includes('undefined')) {
      console.log('\n⚠️ UID 包含 "undefined" 字符串！');
      console.log('錯誤的 UID:', data.uid);
      console.log('應該是:', data.id);
      return { hasIssue: true, currentUid: data.uid, correctUid: data.id };
    }

    if (data.uid !== data.id) {
      console.log('\n⚠️ UID 與 ID 不符！');
      console.log('UID:', data.uid);
      console.log('ID:', data.id);
      return { hasIssue: true, currentUid: data.uid, correctUid: data.id };
    }

    console.log('\n✅ UID 正常');
    return { hasIssue: false };

  } catch (error) {
    console.error('檢查失敗:', error.message);
    return null;
  }
}

// 從命令行參數獲取用戶 ID
const userId = process.argv[2];

if (!userId) {
  console.log('使用方式: node check-user-uid-simple.js <USER_ID>');
  console.log('\n請提供您的用戶 ID（從 API 響應中獲取）');
  process.exit(1);
}

console.log(`檢查用戶: ${userId}`);
console.log('請確保後端服務器正在運行 (http://localhost:4000)\n');

checkUserUid(userId)
  .then(result => {
    if (result && result.hasIssue) {
      console.log('\n需要修復 UID。請使用後端 Admin API 或直接修改 Firestore。');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('執行失敗:', error);
    process.exit(1);
  });
