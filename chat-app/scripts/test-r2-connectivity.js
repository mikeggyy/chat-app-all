/**
 * 測試 Cloudflare R2 連接性和 CORS 配置
 * 用於診斷影片/圖片無法訪問的問題
 */

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-5187f353f7054fb9822594d3416854ea.r2.dev';
const TEST_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
];

console.log('🧪 Cloudflare R2 連接性測試\n');
console.log(`📍 R2 Public URL: ${R2_PUBLIC_URL}\n`);

/**
 * 測試基本連接
 */
async function testBasicConnectivity() {
  console.log('1️⃣ 測試基本連接...');

  try {
    const response = await fetch(`${R2_PUBLIC_URL}`, { method: 'HEAD' });
    console.log(`   ✅ 狀態: ${response.status} ${response.statusText}`);
    console.log(`   ✅ R2 端點可訪問`);
    return true;
  } catch (error) {
    console.log(`   ❌ 連接失敗: ${error.message}`);
    console.log(`   ⚠️  可能原因:`);
    console.log(`      - 網絡連接問題`);
    console.log(`      - R2_PUBLIC_URL 配置錯誤`);
    console.log(`      - DNS 解析失敗`);
    return false;
  }
}

/**
 * 測試 CORS 配置
 */
async function testCORS() {
  console.log('\n2️⃣ 測試 CORS 配置...');

  for (const origin of TEST_ORIGINS) {
    try {
      const response = await fetch(`${R2_PUBLIC_URL}`, {
        method: 'HEAD',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'GET',
        }
      });

      const allowOrigin = response.headers.get('access-control-allow-origin');
      const allowMethods = response.headers.get('access-control-allow-methods');
      const maxAge = response.headers.get('access-control-max-age');

      if (allowOrigin) {
        console.log(`   ✅ Origin: ${origin}`);
        console.log(`      - Allow-Origin: ${allowOrigin}`);
        console.log(`      - Allow-Methods: ${allowMethods || 'N/A'}`);
        console.log(`      - Max-Age: ${maxAge || 'N/A'}`);
      } else {
        console.log(`   ❌ Origin: ${origin}`);
        console.log(`      - 沒有 CORS 標頭！`);
        console.log(`      - 瀏覽器會阻擋此來源的請求`);
      }
    } catch (error) {
      console.log(`   ❌ Origin: ${origin} - ${error.message}`);
    }
  }
}

/**
 * 測試實際影片 URL（如果提供）
 */
async function testActualVideo(videoUrl) {
  console.log('\n3️⃣ 測試實際影片 URL...');
  console.log(`   URL: ${videoUrl.substring(0, 80)}...`);

  try {
    // 測試 HEAD 請求
    const headResponse = await fetch(videoUrl, { method: 'HEAD' });
    console.log(`   ✅ HEAD 請求成功: ${headResponse.status}`);
    console.log(`      - Content-Type: ${headResponse.headers.get('content-type')}`);
    console.log(`      - Content-Length: ${headResponse.headers.get('content-length')} bytes`);

    // 測試帶 Origin 的請求（模擬瀏覽器）
    const corsResponse = await fetch(videoUrl, {
      method: 'HEAD',
      headers: { 'Origin': 'http://127.0.0.1:5173' }
    });

    const allowOrigin = corsResponse.headers.get('access-control-allow-origin');
    if (allowOrigin) {
      console.log(`   ✅ CORS 標頭存在: ${allowOrigin}`);
    } else {
      console.log(`   ❌ CORS 標頭缺失！`);
      console.log(`      - 瀏覽器將無法播放此影片`);
      console.log(`      - 請在 Cloudflare R2 設置 CORS 規則`);
    }

  } catch (error) {
    console.log(`   ❌ 請求失敗: ${error.message}`);
  }
}

/**
 * 提供診斷建議
 */
function provideDiagnostics(basicOk, corsOk) {
  console.log('\n📊 診斷結果與建議:\n');

  if (!basicOk) {
    console.log('❌ 基本連接失敗');
    console.log('   建議:');
    console.log('   1. 檢查網絡連接');
    console.log('   2. 確認 .env 中的 R2_PUBLIC_URL 正確');
    console.log('   3. 確認 R2 Bucket 已啟用公開訪問');
    console.log('   4. 嘗試在瀏覽器直接訪問 R2_PUBLIC_URL');
  } else if (!corsOk) {
    console.log('⚠️  CORS 配置缺失或不正確');
    console.log('   建議:');
    console.log('   1. 登入 Cloudflare Dashboard → R2 → Bucket 設置');
    console.log('   2. 添加 CORS 規則（詳見 docs/R2_CORS_SETUP.md）');
    console.log('   3. 允許來源: http://127.0.0.1:5173, http://localhost:5173');
    console.log('   4. 允許方法: GET, HEAD');
    console.log('   5. 等待 1-2 分鐘後重新測試');
  } else {
    console.log('✅ 所有測試通過！');
    console.log('   R2 連接和 CORS 配置正常');
  }
}

/**
 * 主函數
 */
async function main() {
  const basicOk = await testBasicConnectivity();
  await testCORS();

  // 如果命令行提供了影片 URL，測試它
  const videoUrl = process.argv[2];
  if (videoUrl && videoUrl.startsWith('http')) {
    await testActualVideo(videoUrl);
  }

  // 簡單檢查 CORS（如果基本連接成功但沒看到 CORS 標頭）
  provideDiagnostics(basicOk, false);

  console.log('\n📚 詳細設置指南: chat-app/docs/R2_CORS_SETUP.md');
}

main().catch(console.error);
