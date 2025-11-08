import "dotenv/config";
import "../src/setup-emulator.js";
import { getFirestoreDb } from "../src/firebase/index.js";

/**
 * 正規化角色數據格式
 * - 將 gender 從 "female"/"male" 轉換為 "女性"/"男性"
 * - 將 voice 從物件轉換為字串 ID
 * - 將 tags 從物件轉換為字串陣列
 */
async function normalizeCharacterData() {
  console.log("🔧 開始正規化角色數據格式...\n");

  try {
    const db = getFirestoreDb();
    const charactersRef = db.collection("characters");
    const snapshot = await charactersRef.get();

    if (snapshot.empty) {
      console.log("⚠️  沒有找到任何角色數據");
      process.exit(0);
    }

    console.log(`📊 找到 ${snapshot.size} 個角色\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    // 使用 batch 批量更新
    const batch = db.batch();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const updates = {};
      let needsUpdate = false;

      // 正規化 gender
      if (data.gender) {
        const genderMap = {
          "female": "女性",
          "male": "男性",
          "女性": "女性",
          "男性": "男性",
        };

        const normalizedGender = typeof data.gender === "string"
          ? genderMap[data.gender.toLowerCase()] || data.gender
          : data.gender;

        if (normalizedGender !== data.gender) {
          updates.gender = normalizedGender;
          needsUpdate = true;
          console.log(`  ✓ ${doc.id} (${data.display_name}): gender "${data.gender}" → "${normalizedGender}"`);
        }
      }

      // 正規化 voice
      if (data.voice) {
        let normalizedVoice = "";

        if (typeof data.voice === "string") {
          normalizedVoice = data.voice;
        } else if (typeof data.voice === "object" && data.voice !== null) {
          normalizedVoice = data.voice.id || data.voice.value || data.voice.voice || "";

          if (normalizedVoice && normalizedVoice !== data.voice) {
            updates.voice = normalizedVoice;
            needsUpdate = true;
            console.log(`  ✓ ${doc.id} (${data.display_name}): voice [object] → "${normalizedVoice}"`);
          }
        }
      }

      // 正規化 tags
      if (data.tags) {
        let normalizedTags = [];

        if (Array.isArray(data.tags)) {
          // 已經是陣列，過濾確保只有字串
          normalizedTags = data.tags.filter(tag => typeof tag === "string" && tag.trim());
        } else if (typeof data.tags === "object" && data.tags !== null) {
          // 是物件，提取值
          normalizedTags = Object.values(data.tags).filter(tag => typeof tag === "string" && tag.trim());

          if (normalizedTags.length > 0) {
            updates.tags = normalizedTags;
            needsUpdate = true;
            console.log(`  ✓ ${doc.id} (${data.display_name}): tags [object] → [${normalizedTags.join(", ")}]`);
          }
        }
      }

      // 如果需要更新，加入 batch
      if (needsUpdate) {
        updates.updatedAt = new Date().toISOString();
        batch.update(doc.ref, updates);
        updatedCount++;
      } else {
        skippedCount++;
      }
    });

    // 提交 batch 更新
    if (updatedCount > 0) {
      console.log(`\n📤 正在提交 ${updatedCount} 個角色的更新...`);
      await batch.commit();
      console.log("✅ 批量更新成功！\n");
    } else {
      console.log("\n✅ 所有角色數據格式已經正確，無需更新\n");
    }

    // 驗證結果
    console.log("🔍 驗證更新結果...\n");
    const verifySnapshot = await charactersRef.get();

    console.log("📋 角色數據檢查:");
    verifySnapshot.forEach((doc) => {
      const data = doc.data();
      const genderType = typeof data.gender;
      const voiceType = typeof data.voice;
      const tagsType = Array.isArray(data.tags) ? "array" : typeof data.tags;

      console.log(`   - ${data.display_name} (${doc.id})`);
      console.log(`     性別: ${data.gender} (${genderType})`);
      console.log(`     語音: ${data.voice} (${voiceType})`);
      console.log(`     標籤: ${Array.isArray(data.tags) ? `[${data.tags.join(", ")}]` : data.tags} (${tagsType})`);
    });

    console.log("\n📊 更新統計:");
    console.log(`   - 已更新: ${updatedCount} 個角色`);
    console.log(`   - 已跳過: ${skippedCount} 個角色（格式已正確）`);
    console.log(`   - 總計: ${snapshot.size} 個角色\n`);

    console.log("🎉 角色數據正規化完成！");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ 正規化失敗:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

normalizeCharacterData();
