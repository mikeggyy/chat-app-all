import fetch from 'node-fetch';

async function testPotionAPI() {
  try {
    const response = await fetch('http://localhost:4000/api/potions/packages');
    const data = await response.json();

    console.log('\n📦 藥水商品 API 回應：\n');

    // 顯示前幾個藥水
    data.potions.slice(0, 5).forEach(p => {
      const badge = p.badge ? `[${p.badge}]` : '';
      console.log(`  ${p.icon} ${p.displayName || p.name} - ${p.unitPrice} 金幣 ${badge}`);
    });

    console.log(`\n  總共 ${data.potions.length} 個藥水 SKU\n`);

    // 檢查不同的 emoji
    const memoryBoost = data.potions.find(p => p.baseId === 'memory_boost');
    const brainBoost = data.potions.find(p => p.baseId === 'brain_boost');

    console.log('🔍 Emoji 驗證：');
    console.log(`  記憶增強藥水 icon: ${memoryBoost?.icon}`);
    console.log(`  腦力激盪藥水 icon: ${brainBoost?.icon}\n`);

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
  }
}

testPotionAPI();
