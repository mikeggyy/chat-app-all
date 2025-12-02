/**
 * 批次導入所有 Firestore 資料
 * 用於初始化開發環境或 Firebase Emulator
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = join(__dirname, "..");

const importScripts = [
  {
    name: "AI 角色資料",
    file: "scripts/import-characters-to-firestore.js",
    description: "導入 AI 角色定義和元數據",
  },
  {
    name: "系統配置",
    file: "scripts/import-configs-to-firestore.js",
    description: "導入禮物、稀有度、自拍訊息等配置",
  },
  {
    name: "會員方案",
    file: "scripts/import-membership-configs.js",
    description: "導入會員等級和定價配置",
  },
  {
    name: "角色風格",
    file: "scripts/import-character-styles.js",
    description: "導入角色創建可選風格配置",
  },
  {
    name: "藥水商品",
    file: "scripts/import-potions.js",
    description: "導入藥水商品配置",
  },
  {
    name: "資產套餐",
    file: "scripts/import-asset-packages.js",
    description: "導入解鎖卡、創建卡等資產套餐",
  },
  {
    name: "組合禮包",
    file: "scripts/import-bundle-packages.js",
    description: "導入組合禮包配置",
  },
  {
    name: "測試資料",
    file: "scripts/seed-test-data.js",
    description: "導入測試用戶和對話資料（可選）",
  },
];

const runScript = (scriptPath, scriptName) => {
  return new Promise((resolve, reject) => {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`▶ 開始執行: ${scriptName}`);
    console.log(`${"=".repeat(60)}\n`);

    const child = spawn("node", [scriptPath], {
      cwd: backendDir,
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`\n✅ ${scriptName} - 完成`);
        resolve();
      } else {
        console.error(`\n❌ ${scriptName} - 失敗 (exit code: ${code})`);
        reject(new Error(`${scriptName} failed with exit code ${code}`));
      }
    });

    child.on("error", (err) => {
      console.error(`\n❌ ${scriptName} - 執行錯誤:`, err);
      reject(err);
    });
  });
};

const main = async () => {
  console.log("\n🚀 開始批次導入 Firestore 資料...\n");

  const startTime = Date.now();
  let successCount = 0;
  let failedCount = 0;

  for (const script of importScripts) {
    try {
      const scriptPath = join(backendDir, script.file);
      await runScript(scriptPath, script.name);
      successCount++;
    } catch (error) {
      failedCount++;
      console.error(`\n⚠️  跳過 ${script.name}，繼續執行下一個...\n`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 導入完成摘要`);
  console.log(`${"=".repeat(60)}`);
  console.log(`✅ 成功: ${successCount} 個`);
  console.log(`❌ 失敗: ${failedCount} 個`);
  console.log(`⏱️  總耗時: ${duration} 秒`);
  console.log(`${"=".repeat(60)}\n`);

  if (failedCount > 0) {
    console.log("⚠️  部分導入失敗，請檢查上方錯誤訊息");
    process.exit(1);
  }

  console.log("✨ 所有資料導入完成！");
};

main().catch((error) => {
  console.error("\n❌ 批次導入過程發生錯誤:", error);
  process.exit(1);
});
