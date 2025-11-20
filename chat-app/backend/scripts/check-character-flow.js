import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";
import logger from "../src/utils/logger.js";

/**
 * 檢查角色創建流程的數據
 * 診斷為什麼角色創建後缺少 persona 數據
 */
async function checkCharacterFlow(characterId) {
  try {
    const db = getFirestoreDb();

    console.log(`\n📋 檢查角色和對應的創建流程\n`);
    console.log("=".repeat(60));

    // 1. 查詢角色數據
    console.log(`\n🔍 步驟 1: 查詢角色數據 (${characterId})\n`);

    const characterDoc = await db.collection("characters").doc(characterId).get();

    if (!characterDoc.exists) {
      console.log(`❌ 角色不存在: ${characterId}`);
      return;
    }

    const character = characterDoc.data();

    console.log(`✅ 找到角色: ${character.display_name || "未命名"}`);
    console.log(`   創建時間: ${character.createdAt}`);
    console.log(`   創建者: ${character.creatorUid || "未知"}`);

    // 檢查關鍵字段
    const missingFields = [];
    if (!character.background || character.background.trim() === "") missingFields.push("background");
    if (!character.secret_background || character.secret_background.trim() === "") missingFields.push("secret_background");
    if (!character.first_message || character.first_message.trim() === "") missingFields.push("first_message");
    if (!character.portraitUrl || character.portraitUrl.trim() === "") missingFields.push("portraitUrl");
    if (!character.voice || character.voice.trim() === "") missingFields.push("voice");

    if (missingFields.length > 0) {
      console.log(`\n⚠️  缺少的字段: ${missingFields.join(", ")}`);
    } else {
      console.log(`\n✅ 所有關鍵字段都已設定`);
    }

    // 2. 查詢對應的創建流程
    console.log(`\n🔍 步驟 2: 查詢對應的創建流程\n`);

    // 嘗試通過 userId 和創建時間找到對應的 flow
    const userId = character.creatorUid;

    if (!userId) {
      console.log(`⚠️  無法查詢創建流程：角色沒有 creatorUid`);
      return;
    }

    const flowsSnapshot = await db
      .collection("character_creation_flows")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    console.log(`   找到 ${flowsSnapshot.size} 個創建流程`);

    if (flowsSnapshot.empty) {
      console.log(`\n❌ 沒有找到對應的創建流程`);
      console.log(`   可能原因:`);
      console.log(`   1. 角色是通過管理後台或其他方式創建的`);
      console.log(`   2. 創建流程已被刪除`);
      console.log(`   3. 角色創建時沒有使用 flow 系統`);
      return;
    }

    // 查找最接近角色創建時間的 flow
    const characterTime = new Date(character.createdAt).getTime();
    let closestFlow = null;
    let minTimeDiff = Infinity;

    flowsSnapshot.forEach((doc) => {
      const flow = doc.data();
      const flowTime = new Date(flow.createdAt).getTime();
      const timeDiff = Math.abs(characterTime - flowTime);

      // 在 10 分鐘內的 flow 可能是相關的
      if (timeDiff < 10 * 60 * 1000 && timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestFlow = { id: doc.id, ...flow };
      }
    });

    if (!closestFlow) {
      console.log(`\n⚠️  沒有找到時間接近的創建流程（10分鐘內）`);
      console.log(`\n   最近的流程:`);
      flowsSnapshot.forEach((doc, index) => {
        const flow = doc.data();
        console.log(`   ${index + 1}. ${doc.id}`);
        console.log(`      創建時間: ${flow.createdAt}`);
        console.log(`      狀態: ${flow.status}`);
      });
      return;
    }

    // 3. 分析 flow 數據
    console.log(`\n✅ 找到最接近的創建流程: ${closestFlow.id}`);
    console.log(`   時間差: ${Math.round(minTimeDiff / 1000)} 秒`);
    console.log(`   狀態: ${closestFlow.status}`);
    console.log(`   創建時間: ${closestFlow.createdAt}`);

    console.log(`\n📝 Flow Persona 數據:`);
    if (closestFlow.persona) {
      console.log(`   name: "${closestFlow.persona.name || ""}"`);
      console.log(`   tagline (→ background): "${closestFlow.persona.tagline || ""}"`);
      console.log(`   hiddenProfile (→ secret_background): "${closestFlow.persona.hiddenProfile || ""}"`);
      console.log(`   prompt (→ first_message): "${closestFlow.persona.prompt || ""}"`);

      // 檢查是否為空
      const emptyPersonaFields = [];
      if (!closestFlow.persona.name || closestFlow.persona.name.trim() === "") emptyPersonaFields.push("name");
      if (!closestFlow.persona.tagline || closestFlow.persona.tagline.trim() === "") emptyPersonaFields.push("tagline");
      if (!closestFlow.persona.hiddenProfile || closestFlow.persona.hiddenProfile.trim() === "") emptyPersonaFields.push("hiddenProfile");
      if (!closestFlow.persona.prompt || closestFlow.persona.prompt.trim() === "") emptyPersonaFields.push("prompt");

      if (emptyPersonaFields.length > 0) {
        console.log(`\n⚠️  Flow 中的空字段: ${emptyPersonaFields.join(", ")}`);
        console.log(`\n🔍 問題診斷: Flow 中的 persona 數據本身就是空的！`);
        console.log(`   這說明在創建角色之前，設定步驟的數據沒有正確保存到 flow。`);
      } else {
        console.log(`\n✅ Flow 中的 persona 數據完整`);
        console.log(`\n🔍 問題診斷: Flow 數據正常，但角色創建時沒有正確映射！`);
      }
    } else {
      console.log(`   ❌ flow.persona 不存在或為 null`);
      console.log(`\n🔍 問題診斷: Flow 中完全沒有 persona 數據！`);
    }

    console.log(`\n📝 Flow Appearance 數據:`);
    if (closestFlow.appearance) {
      console.log(`   image: ${closestFlow.appearance.image ? "✅ 已設定" : "❌ 未設定"}`);
      console.log(`   description: ${closestFlow.appearance.description ? `✅ ${closestFlow.appearance.description.length} 字` : "❌ 未設定"}`);
      console.log(`   styles: ${Array.isArray(closestFlow.appearance.styles) && closestFlow.appearance.styles.length > 0 ? `✅ ${closestFlow.appearance.styles.join(", ")}` : "❌ 未設定"}`);
    } else {
      console.log(`   ❌ flow.appearance 不存在或為 null`);
    }

    console.log(`\n📝 Flow Voice 數據:`);
    console.log(`   voice: ${closestFlow.voice || "❌ 未設定"}`);

    // 4. 對比 flow 和 character 數據
    console.log(`\n🔄 數據映射對比:\n`);

    const mappings = [
      { flowField: "persona.name", charField: "display_name", flowValue: closestFlow.persona?.name, charValue: character.display_name },
      { flowField: "persona.tagline", charField: "background", flowValue: closestFlow.persona?.tagline, charValue: character.background },
      { flowField: "persona.hiddenProfile", charField: "secret_background", flowValue: closestFlow.persona?.hiddenProfile, charValue: character.secret_background },
      { flowField: "persona.prompt", charField: "first_message", flowValue: closestFlow.persona?.prompt, charValue: character.first_message },
      { flowField: "appearance.image", charField: "portraitUrl", flowValue: closestFlow.appearance?.image, charValue: character.portraitUrl },
      { flowField: "voice", charField: "voice", flowValue: closestFlow.voice, charValue: character.voice },
    ];

    mappings.forEach(({ flowField, charField, flowValue, charValue }) => {
      const flowEmpty = !flowValue || flowValue.trim() === "";
      const charEmpty = !charValue || charValue.trim() === "";

      if (flowEmpty && charEmpty) {
        console.log(`   ⚠️  ${flowField} → ${charField}: 兩者都為空`);
      } else if (flowEmpty && !charEmpty) {
        console.log(`   ✅ ${flowField} → ${charField}: Flow 空但角色有值（可能是預設值）`);
      } else if (!flowEmpty && charEmpty) {
        console.log(`   ❌ ${flowField} → ${charField}: Flow 有值但角色為空 - 映射失敗！`);
        console.log(`      Flow: "${flowValue.substring(0, 50)}${flowValue.length > 50 ? "..." : ""}"`);
      } else if (flowValue === charValue) {
        console.log(`   ✅ ${flowField} → ${charField}: 映射成功`);
      } else {
        console.log(`   🔍 ${flowField} → ${charField}: 值不同`);
        console.log(`      Flow: "${flowValue.substring(0, 50)}${flowValue.length > 50 ? "..." : ""}"`);
        console.log(`      Char: "${charValue.substring(0, 50)}${charValue.length > 50 ? "..." : ""}"`);
      }
    });

    console.log(`\n` + "=".repeat(60));
    console.log(`\n💡 總結:\n`);

    const flowHasPersona = closestFlow.persona &&
      (closestFlow.persona.name || closestFlow.persona.tagline || closestFlow.persona.hiddenProfile || closestFlow.persona.prompt);

    if (!flowHasPersona) {
      console.log(`❌ 根本原因: Flow 中沒有 persona 數據`);
      console.log(`\n可能的原因:`);
      console.log(`1. 前端在設定步驟點擊「下一步」時，沒有調用 syncSummaryToBackend`);
      console.log(`2. syncSummaryToBackend 調用失敗但沒有提示用戶`);
      console.log(`3. 前端的 personaForm 數據本身就是空的`);
      console.log(`4. 後端的 mergeCreationFlow 沒有正確保存 persona 數據`);
      console.log(`\n建議:`);
      console.log(`- 檢查瀏覽器控制台的網絡請求，看 PATCH /flows/:flowId 是否成功`);
      console.log(`- 檢查請求體是否包含 persona 數據`);
      console.log(`- 在前端添加錯誤提示，syncSummaryToBackend 失敗時阻止跳轉`);
    } else {
      const charHasData = character.background || character.secret_background || character.first_message;

      if (!charHasData) {
        console.log(`❌ 根本原因: Flow 有數據，但創建角色時映射失敗`);
        console.log(`\n可能的原因:`);
        console.log(`1. finalizeCharacterCreation 讀取的 flow 不是最新的`);
        console.log(`2. matchData 構建錯誤，沒有正確映射 flow.persona 到對應字段`);
        console.log(`3. 後端 createMatch 接收到空數據`);
        console.log(`\n建議:`);
        console.log(`- 在 finalizeCharacterCreation 添加日誌，輸出構建的 matchData`);
        console.log(`- 在後端 createMatch 添加日誌，輸出接收到的 matchData`);
        console.log(`- 確保 fetchCharacterCreationFlow 返回最新的 flow 數據`);
      } else {
        console.log(`✅ 數據流正常！可能是其他原因導致部分數據缺失`);
      }
    }

    console.log(`\n`);

  } catch (error) {
    logger.error("檢查角色流程失敗:", error);
    console.error("\n❌ 錯誤:", error.message);
  }
}

// 從命令行參數獲取角色 ID
const characterId = process.argv[2];

if (!characterId) {
  console.log("\n使用方法:");
  console.log("  node check-character-flow.js <character-id>");
  console.log("\n範例:");
  console.log("  node check-character-flow.js match-1763545954300-rrzog6v");
  console.log("\n");
  process.exit(1);
}

checkCharacterFlow(characterId).then(() => {
  process.exit(0);
});
