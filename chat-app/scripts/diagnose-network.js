/**
 * 網絡診斷工具
 * 診斷 IPv6 連接問題
 */

import { testUrlConnectivity } from '../backend/src/utils/networkFetch.js';

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-5187f353f7054fb9822594d3416854ea.r2.dev';

console.log('🔍 網絡連接診斷工具\n');
console.log(`測試 URL: ${R2_PUBLIC_URL}\n`);

async function main() {
  console.log('🧪 測試 IPv4 和 IPv6 連接性...\n');

  const results = await testUrlConnectivity(R2_PUBLIC_URL);

  console.log('📊 測試結果:\n');
  console.log(`IPv6 (默認):`);
  console.log(`  - 狀態: ${results.ipv6.success ? '✅ 成功' : '❌ 失敗'}`);
  if (results.ipv6.success) {
    console.log(`  - 響應時間: ${results.ipv6.time}ms`);
  } else {
    console.log(`  - 錯誤: ${results.ipv6.error}`);
  }

  console.log(`\nIPv4 (強制):`);
  console.log(`  - 狀態: ${results.ipv4.success ? '✅ 成功' : '❌ 失敗'}`);
  if (results.ipv4.success) {
    console.log(`  - 響應時間: ${results.ipv4.time}ms`);
  } else {
    console.log(`  - 錯誤: ${results.ipv4.error}`);
  }

  console.log(`\n💡 建議:\n`);
  switch (results.recommendation) {
    case 'USE_IPV4_ONLY':
      console.log('  ⚠️  您的網絡環境 IPv6 連接不穩定');
      console.log('  ✅ 後端已自動使用 IPv4 連接（智能 fetch）');
      console.log('  ⚠️  前端影片播放問題可能需要額外處理');
      console.log('\n  前端解決方案：');
      console.log('  1. 切換到行動網絡（4G/5G）測試');
      console.log('  2. 或使用 VPN 改變網絡路由');
      console.log('  3. 或聯繫 ISP 檢查 IPv6 設置');
      break;

    case 'USE_IPV6_ONLY':
      console.log('  ⚠️  您的網絡環境 IPv4 連接不穩定');
      console.log('  ✅ 使用默認設置即可（IPv6）');
      break;

    case 'PREFER_IPV4':
      console.log('  ✅ IPv4 連接更快更穩定');
      console.log('  ✅ 後端已自動優化');
      break;

    case 'PREFER_IPV6':
      console.log('  ✅ IPv6 連接更快更穩定');
      console.log('  ✅ 使用默認設置即可');
      break;

    case 'BOTH_FAILED':
      console.log('  ❌ IPv4 和 IPv6 都無法連接');
      console.log('  可能原因：');
      console.log('  1. 防火牆阻擋');
      console.log('  2. ISP 限制');
      console.log('  3. Cloudflare R2 服務異常');
      console.log('  4. 本地網絡故障');
      break;
  }

  console.log('\n📚 詳細文檔: chat-app/docs/NETWORK_IPV6_ISSUES.md');
}

main().catch(console.error);
