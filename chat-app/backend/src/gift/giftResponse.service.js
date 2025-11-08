/**
 * 禮物回應服務
 * 處理AI角色收到禮物後的感謝訊息和自拍照生成
 */

import logger from "../utils/logger.js";
import { getGiftById } from "../config/gifts.js";
import { getOpenAIClient } from "../ai/ai.service.js";
import { generateGeminiImage } from "../ai/gemini.service.js";
import { getConversationHistory, appendConversationMessage } from "../conversation/conversation.service.js";
import { savePhotoToAlbum } from "../photoAlbum/photoAlbum.service.js";
import { uploadBase64Image, generateFilename } from "../firebase/storage.service.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 生成AI角色收到禮物的感謝訊息
 */
export const generateGiftThankYouMessage = async (characterData, giftId, userId) => {
  try {
    const gift = getGiftById(giftId);
    if (!gift) {
      throw new Error(`找不到禮物：${giftId}`);
    }

    // 可以直接使用配置中的感謝訊息
    // 或使用AI生成更個性化的回應
    const useAiGenerated = true;

    if (!useAiGenerated) {
      return gift.thankYouMessage;
    }

    // 使用AI生成個性化感謝訊息
    const systemPrompt = `你是 ${characterData.display_name}。
${characterData.background}

你剛收到了來自用戶的禮物：${gift.name} ${gift.emoji}

請生成一個真誠、符合你角色性格的感謝訊息。訊息應該：
1. 表達驚喜和感激
2. 符合你的角色性格和背景
3. 自然、不過度浮誇
4. 長度控制在1-2句話
5. 可以適當加入emoji表情

直接輸出感謝訊息，不需要其他說明。`;

    const conversationHistory = await getConversationHistory(userId, characterData.id);
    const recentContext = conversationHistory.slice(-3); // 取最近3條對話作為上下文

    // 使用OpenAI生成個性化感謝訊息
    const openai = getOpenAIClient();
    const messages = [
      { role: "system", content: systemPrompt },
      ...recentContext.map(msg => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.text
      })),
      { role: "user", content: `收到了 ${gift.name} 作為禮物` }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 150,
      temperature: 0.8,
    });

    const thankYouMessage = completion.choices[0]?.message?.content || gift.thankYouMessage;

    return thankYouMessage;
  } catch (error) {
    logger.error("生成感謝訊息失敗:", error);
    // 降級使用預設訊息
    const gift = getGiftById(giftId);
    return gift?.thankYouMessage || "謝謝你的禮物！我好開心！";
  }
};

/**
 * 生成AI角色拿著禮物的自拍照
 */
export const generateGiftSelfie = async (characterData, giftId, userId = null) => {
  try {
    const gift = getGiftById(giftId);
    if (!gift) {
      throw new Error(`找不到禮物：${giftId}`);
    }

    // 讀取角色肖像作為參考（支援本地路徑和 Firebase Storage URL）
    let referenceImageBuffer;
    try {
      const portraitUrl = characterData.portraitUrl;

      // 檢查是否為 HTTP/HTTPS URL（Cloudflare R2 或 Firebase Storage）
      if (portraitUrl && (portraitUrl.startsWith("http://") || portraitUrl.startsWith("https://"))) {
        logger.info(`[禮物回應] 從遠端下載角色肖像: ${portraitUrl}`);

        // 從 URL 下載圖片（帶超時控制）
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10秒超時

        try {
          const response = await fetch(portraitUrl, { signal: controller.signal });
          clearTimeout(timeout);

          if (!response.ok) {
            throw new Error(`下載失敗: ${response.status} ${response.statusText}`);
          }

          // 獲取圖片數據
          const arrayBuffer = await response.arrayBuffer();
          referenceImageBuffer = Buffer.from(arrayBuffer);

          logger.info(`[禮物回應] ✅ 成功下載角色肖像 (${Math.round(referenceImageBuffer.length / 1024)} KB)`);
        } catch (fetchError) {
          clearTimeout(timeout);
          if (fetchError.name === 'AbortError') {
            throw new Error('下載超時（10秒）');
          }
          throw fetchError;
        }
      } else if (portraitUrl) {
        // 本地文件路徑
        logger.info(`[禮物回應] 從本地讀取角色肖像: ${portraitUrl}`);

        const portraitPath = path.join(
          __dirname,
          "../../..",
          "frontend/public",
          portraitUrl
        );
        referenceImageBuffer = await fs.readFile(portraitPath);
      } else {
        referenceImageBuffer = null;
      }
    } catch (err) {
      logger.warn(`無法讀取角色肖像:`, err.message);
      referenceImageBuffer = null;
    }

    // 構建圖片生成提示詞
    const imagePrompt = buildGiftSelfiePrompt(characterData, gift);

    // 使用Gemini生成圖片
    const geminiResult = await generateGeminiImage(
      referenceImageBuffer ? referenceImageBuffer.toString('base64') : null,
      imagePrompt
    );

    const imageDataUrl = geminiResult.imageDataUrl;
    const usageMetadata = geminiResult.usageMetadata;

    // 記錄 token 使用情況
    logger.info(`[禮物照片] Token 使用情況: characterId=${characterData.id}, giftId=${giftId}`, {
      promptTokens: usageMetadata.promptTokenCount || 0,
      candidatesTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
    });

    // 上傳圖片到 Firebase Storage（避免 Firestore 大小限制）
    let finalImageUrl = imageDataUrl;
    logger.info(`[禮物照片] 原始圖片 base64 長度: ${imageDataUrl?.length || 0}`);

    if (userId) {
      try {
        logger.info(`[禮物照片] 開始上傳禮物照片到 Storage: userId=${userId}, characterId=${characterData.id}, giftId=${giftId}`);
        const filename = generateFilename('gift', characterData.id);
        finalImageUrl = await uploadBase64Image(imageDataUrl, userId, filename, 'image/webp');
        logger.info(`[禮物照片] ✅ 禮物照片已成功上傳到 Storage: ${filename}`);
        logger.info(`[禮物照片] ✅ Storage URL: ${finalImageUrl}`);
        logger.info(`[禮物照片] ✅ Storage URL 長度: ${finalImageUrl.length}`);
      } catch (uploadError) {
        logger.error("[禮物照片] ❌ 上傳到 Storage 失敗，使用 base64 fallback:", uploadError);
        // 降級使用 base64（雖然可能有大小問題）
      }
    }

    // 如果提供了 userId 和 characterId，同時保存到相簿
    if (userId && characterData.id) {
      try {
        await savePhotoToAlbum(userId, {
          characterId: characterData.id,
          imageUrl: finalImageUrl,
          text: `收到${gift.name}的感謝照片`,
          type: 'gift',
          giftId: gift.id,
          createdAt: new Date().toISOString(),
        });
        logger.info(`[相簿] 禮物照片已保存到相簿: userId=${userId}, characterId=${characterData.id}, giftId=${giftId}`);
      } catch (albumError) {
        // 即使相簿保存失敗，也不影響主流程
        logger.error("[相簿] 保存禮物照片到相簿失敗:", albumError);
      }
    }

    return {
      success: true,
      imageUrl: finalImageUrl,
      gift: {
        id: gift.id,
        name: gift.name,
        emoji: gift.emoji,
      },
    };
  } catch (error) {
    logger.error("生成禮物自拍照失敗:", error);
    throw new Error(`生成禮物自拍照失敗: ${error.message}`);
  }
};

/**
 * 構建禮物照片的提示詞
 */
const buildGiftSelfiePrompt = (characterData, gift) => {
  // 為每種禮物提供多個場景選項（包含室內與戶外）
  const giftScenes = {
    rose: [
      "在陽光灑落的花園裡，輕輕聞著玫瑰花香，臉上洋溢著幸福的笑容",
      "站在窗邊，手持玫瑰花欣賞著，柔和的光線照在臉上",
      "坐在公園的長椅上，把玫瑰花放在胸前，享受寧靜的時刻",
      "在陽台上，微風吹拂，手中的玫瑰花在搖曳，自然優雅的姿態",
      "在書桌旁，將玫瑰花插在花瓶中，滿意地欣賞著",
      "在戶外花圃旁，陽光下手持玫瑰花，周圍是盛開的花朵",
      "站在街邊咖啡廳的露天座位，玫瑰花放在桌上，愜意的微笑",
      "在城市公園的噴泉旁，手持玫瑰花漫步，享受午後時光",
    ],
    chocolate: [
      "坐在舒適的沙發上品嚐巧克力，臉上洋溢著幸福的表情",
      "在咖啡廳裡，手持巧克力配著飲料，享受悠閒時光",
      "躺在床上，開心地吃著巧克力，溫馨放鬆的氛圍",
      "在廚房裡，剛打開巧克力盒子，興奮地挑選著",
      "坐在窗邊，一邊看書一邊品嚐巧克力，愜意的午後",
      "在公園的草地上野餐，享用著巧克力，陽光灑在身上",
      "坐在戶外長椅上，吃著巧克力看著風景，放鬆的表情",
      "在海邊或湖邊，手持巧克力欣賞美景，微風輕拂",
    ],
    cake: [
      "坐在餐桌前，面對精緻的蛋糕，準備切下第一塊",
      "在甜點店裡，驚喜地看著眼前的蛋糕，雙手合十",
      "在廚房裡，站在蛋糕旁邊，開心地準備享用",
      "在客廳沙發上，把蛋糕放在茶几上，滿足的笑容",
      "坐在戶外露台，蛋糕在陽光下閃閃發亮，享受甜蜜時刻",
      "在花園的野餐桌旁，面對蛋糕，周圍是綠意盎然的景色",
      "在咖啡廳的戶外座位區，蛋糕擺在桌上，享受愜意時光",
      "在公園的樹蔭下，坐在草地上享用蛋糕，輕鬆愉快",
    ],
    teddy: [
      "坐在床上，溫柔地抱著泰迪熊，臉上帶著甜美的笑容",
      "在沙發上，把泰迪熊放在懷裡，享受放鬆時光",
      "站在臥室裡，把泰迪熊舉高看著，開心的表情",
      "躺在床上，泰迪熊在身旁，溫馨舒適的氛圍",
      "坐在窗邊，陽光灑在泰迪熊上，溫暖的畫面",
      "在公園的草地上，坐著抱著泰迪熊，享受戶外時光",
      "在花園的長椅上，泰迪熊在腿上，悠閒地曬太陽",
      "在戶外咖啡座，泰迪熊放在桌上，溫馨可愛的氛圍",
    ],
    ring: [
      "在窗邊，手伸向陽光展示戒指，戒指閃閃發亮",
      "坐在梳妝台前，仔細欣賞手上的戒指，驚喜的表情",
      "在咖啡廳裡，優雅地展示手上的戒指，感動的神情",
      "站在鏡子前，看著手上的戒指，幸福滿溢",
      "在花園裡，手持鮮花和戒指一起，浪漫的氛圍",
      "在海邊或湖邊，手舉向天空展示戒指，陽光閃耀",
      "在公園的櫻花樹下，展示戒指，花瓣紛飛的浪漫場景",
      "在城市街道的咖啡座外，優雅地展示戒指，都市浪漫",
    ],
    diamond: [
      "在精緻的環境中，手持鑽石對著光線欣賞，驚艷的神情",
      "坐在優雅的椅子上，小心翼翼地捧著鑽石，興奮的表情",
      "站在窗邊，讓陽光照在鑽石上，閃耀璀璨的光芒",
      "在奢華的房間裡，欣賞手中的鑽石，滿意的笑容",
      "坐在梳妝台前，把鑽石放在眼前仔細觀看，著迷的眼神",
      "在戶外陽光下，手持鑽石對著天空，璀璨光芒四射",
      "在花園的噴泉旁，鑽石在陽光和水珠中閃耀，夢幻場景",
      "站在高處眺望風景，手中鑽石閃閃發光，優雅姿態",
    ],
    crown: [
      "在鏡子前，優雅地戴著皇冠，高貴自信的姿態",
      "坐在華麗的椅子上，戴著皇冠，女王般的氣場",
      "站在窗邊，陽光照在皇冠上，閃閃發光，優雅的笑容",
      "在臥室裡，剛戴上皇冠，驚喜且開心的表情",
      "坐在書桌前，把皇冠放在頭上，欣賞鏡中的自己",
      "在花園的拱門下，戴著皇冠，如同童話中的公主",
      "站在陽台上眺望遠方，皇冠在陽光下閃耀，高貴優雅",
      "在戶外宮廷風格的場景中，戴著皇冠，女王般的氣勢",
    ],
  };

  // 隨機選擇一個場景
  const scenes = giftScenes[gift.id] || [
    `在自然的場景中，與${gift.name}互動，展現開心愉悅的表情`,
    `在舒適的空間裡，欣賞著${gift.name}，滿足的笑容`,
    `在優雅的環境中，享受著${gift.name}帶來的喜悅`,
    `在溫馨的場所，開心地展示${gift.name}`,
  ];

  const randomScene = scenes[Math.floor(Math.random() * scenes.length)];

  const basePrompt = `A natural portrait photo of ${characterData.display_name}, ${randomScene}.

Character details:
${characterData.background}

Style: High quality portrait photography, warm natural lighting, genuine happy expression, Disney character style, natural and relaxed pose.

Setting: Can be any fitting location - indoors, outdoors, café, garden, bedroom, or other comfortable space. The character should appear natural and at ease, not posing for a selfie.

Focus on showing both the character and the gift (${gift.name} ${gift.emoji}) naturally in the scene.`;

  return basePrompt;
};

/**
 * 完整的禮物回應流程
 * 包含感謝訊息和自拍照
 * 統一參照自拍照片的邏輯：在後端直接保存到對話歷史
 */
export const processGiftResponse = async (characterData, giftId, userId, options = {}) => {
  const generatePhoto = options.generatePhoto !== false; // 預設生成照片

  // 生成感謝訊息
  const thankYouMessage = await generateGiftThankYouMessage(
    characterData,
    giftId,
    userId
  );

  // 創建並保存感謝訊息到對話歷史
  const thankYouMessageObj = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: "partner",
    text: thankYouMessage,
    createdAt: new Date().toISOString(),
  };

  // 先保存感謝訊息
  await appendConversationMessage(userId, characterData.id, thankYouMessageObj);
  logger.info(`[禮物回應] 感謝訊息已保存到對話歷史: userId=${userId}, characterId=${characterData.id}`);

  let photoMessage = null;

  // 生成自拍照（如果需要）
  if (generatePhoto) {
    try {
      const photoResult = await generateGiftSelfie(characterData, giftId, userId);
      logger.info(`[禮物回應] 禮物照片生成成功: userId=${userId}, characterId=${characterData.id}, hasImageUrl=${!!photoResult?.imageUrl}, imageUrlLength=${photoResult?.imageUrl?.length}`);

      if (photoResult?.imageUrl) {
        // 創建包含圖片的消息（參照自拍照片的格式）
        photoMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: "partner",
          text: `收到${getGiftById(giftId)?.name || '禮物'}的感謝照片 ${getGiftById(giftId)?.emoji || ''}`,
          imageUrl: photoResult.imageUrl,
          createdAt: new Date().toISOString(),
        };

        // 保存照片消息到對話歷史（在後端，統一邏輯）
        await appendConversationMessage(userId, characterData.id, photoMessage);
        logger.info(`[禮物回應] ✅ 照片消息已保存到對話歷史: userId=${userId}, characterId=${characterData.id}, imageUrl=${photoResult.imageUrl.substring(0, 100)}...`);
      }
    } catch (error) {
      logger.error(`[禮物回應] 生成禮物自拍照失敗，但繼續流程: userId=${userId}, characterId=${characterData.id}`, error);
      // 即使照片生成失敗，也返回感謝訊息
    }
  }

  // 返回結果（統一格式，與自拍照片一致）
  const response = {
    success: true,
    thankYouMessage: thankYouMessageObj,
    photoMessage: photoMessage,
    gift: getGiftById(giftId),
  };

  logger.info(`[禮物回應] 返回結果: hasPhotoMessage=${!!photoMessage}`);
  return response;
};

export default {
  generateGiftThankYouMessage,
  generateGiftSelfie,
  processGiftResponse,
};
