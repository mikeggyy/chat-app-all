import "dotenv/config";
// ✅ 2025-11-30 修復：從同一個模組導入 FieldValue 避免序列化錯誤
import { getFirestoreDb, FieldValue } from "../src/firebase/index.js";
import {
  MEMBERSHIP_TIERS,
  AI_FEATURE_PRICES,
  COIN_PACKAGES,
  BUNDLE_PACKAGES,                      // ✅ 新增：組合禮包
  AD_CONFIG
} from "../src/membership/membership.config.js";

async function importMembershipConfigs() {
  console.log("🌱 開始導入會員配置到 Firestore...\n");

  try {
    const db = getFirestoreDb();
    let totalCount = 0;

    // 1. 導入會員等級配置
    console.log("👥 導入會員等級配置...");
    const tierBatch = db.batch();
    Object.values(MEMBERSHIP_TIERS).forEach((tier) => {
      const ref = db.collection("membership_tiers").doc(tier.id);
      tierBatch.set(ref, {
        ...tier,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`   ✓ ${tier.name} (${tier.id})`);
    });
    await tierBatch.commit();
    totalCount += Object.keys(MEMBERSHIP_TIERS).length;
    console.log(`✅ 已導入 ${Object.keys(MEMBERSHIP_TIERS).length} 個會員等級\n`);

    // 2. 導入 AI 功能價格
    console.log("🎨 導入 AI 功能價格配置...");
    const featureBatch = db.batch();
    Object.values(AI_FEATURE_PRICES).forEach((feature) => {
      const ref = db.collection("ai_feature_prices").doc(feature.id);
      featureBatch.set(ref, {
        ...feature,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`   ✓ ${feature.name} (${feature.basePrice} 金幣)`);
    });
    await featureBatch.commit();
    totalCount += Object.keys(AI_FEATURE_PRICES).length;
    console.log(`✅ 已導入 ${Object.keys(AI_FEATURE_PRICES).length} 個 AI 功能價格\n`);

    // 3. 導入金幣充值方案
    console.log("💰 導入金幣充值方案...");
    const coinBatch = db.batch();
    Object.values(COIN_PACKAGES).forEach((pkg) => {
      const ref = db.collection("coin_packages").doc(pkg.id);
      coinBatch.set(ref, {
        ...pkg,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`   ✓ ${pkg.name} - NT$${pkg.price} (${pkg.totalCoins} 金幣)`);
    });
    await coinBatch.commit();
    totalCount += Object.keys(COIN_PACKAGES).length;
    console.log(`✅ 已導入 ${Object.keys(COIN_PACKAGES).length} 個金幣方案\n`);

    // 4. 導入組合禮包
    console.log("🎁 導入組合禮包...");
    const bundleBatch = db.batch();
    Object.values(BUNDLE_PACKAGES).forEach((bundle) => {
      const ref = db.collection("bundle_packages").doc(bundle.id);
      bundleBatch.set(ref, {
        ...bundle,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`   ✓ ${bundle.name} - NT$${bundle.price}`);
    });
    await bundleBatch.commit();
    totalCount += Object.keys(BUNDLE_PACKAGES).length;
    console.log(`✅ 已導入 ${Object.keys(BUNDLE_PACKAGES).length} 個組合禮包\n`);

    // 5. 導入廣告配置
    console.log("📺 導入廣告配置...");
    const adConfigRef = db.collection("system_configs").doc("ad_config");
    await adConfigRef.set({
      ...AD_CONFIG,
      updatedAt: FieldValue.serverTimestamp(),
    });
    totalCount += 1;
    console.log(`   ✓ 廣告配置`);
    console.log(`✅ 已導入廣告配置\n`);

    // 驗證
    console.log("🔍 驗證導入結果...");
    const tiersSnapshot = await db.collection("membership_tiers").get();
    const featuresSnapshot = await db.collection("ai_feature_prices").get();
    const coinsSnapshot = await db.collection("coin_packages").get();
    const bundlesSnapshot = await db.collection("bundle_packages").get();

    console.log(`   📁 membership_tiers: ${tiersSnapshot.size} 個文檔`);
    console.log(`   📁 ai_feature_prices: ${featuresSnapshot.size} 個文檔`);
    console.log(`   📁 coin_packages: ${coinsSnapshot.size} 個文檔`);
    console.log(`   📁 bundle_packages: ${bundlesSnapshot.size} 個文檔`);
    console.log(`   📁 system_configs/ad_config: 1 個文檔`);

    console.log("\n🎉 會員配置導入成功！");
    console.log(`📊 總共導入 ${totalCount} 筆配置數據\n`);

    console.log("💡 查看 Firestore UI:");
    console.log("   http://localhost:4101/firestore");
    console.log("\n你會看到:");
    console.log("   📁 membership_tiers (會員等級配置)");
    console.log("   📁 ai_feature_prices (AI 功能價格)");
    console.log("   📁 coin_packages (金幣充值方案)");
    console.log("   📁 bundle_packages (組合禮包)");
    console.log("   📁 system_configs (系統配置)");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ 導入失敗:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

importMembershipConfigs();
