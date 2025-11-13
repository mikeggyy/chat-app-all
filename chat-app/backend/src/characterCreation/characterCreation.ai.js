import OpenAI from "openai";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";
import { uploadBase64Image, generateFilename } from "../firebase/storage.service.js";
import { getAiServiceSettings } from "../services/aiSettings.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * ❌ 已移除硬編碼常量
 * ✅ 現在從 Firestore 的 ai_settings/global 讀取各 AI 魔術師的設定
 */
const MAX_NAME_LENGTH = 8; // 🔥 將從 characterPersona.maxNameLength 讀取
const MAX_TAGLINE_LENGTH = 200; // 🔥 將從 characterPersona.maxTaglineLength 讀取
const MAX_HIDDEN_PROFILE_LENGTH = 200; // 🔥 將從 characterPersona.maxHiddenProfileLength 讀取
const MAX_PROMPT_LENGTH = 50; // 🔥 將從 characterPersona.maxPromptLength 讀取
const MAX_APPEARANCE_DESCRIPTION_LENGTH = 60; // 🔥 將從 characterAppearance.maxAppearanceLength 讀取

let cachedClient = null;

const getOpenAIClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error(
      "後端未設定 OPENAI_API_KEY,無法使用 AI 魔法師"
    );
    error.status = 503;
    throw error;
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
};

const buildPersonaGenerationPrompt = ({ appearance, gender, styles, selectedImageUrl }) => {
  const genderHint = gender === "male" ? "男性" : gender === "female" ? "女性" : "性別不明確";
  const stylesText = Array.isArray(styles) && styles.length > 0
    ? styles.join("、")
    : "未指定";

  // 當有選定的圖片URL時，使用 Vision API 專用提示詞
  if (selectedImageUrl) {
    return `This is a professional character creation tool for a fictional chat companion app. Based on the provided character image, please create a complete character profile.

**Character Information**:
- Gender Preference: ${genderHint}
- Style Tags: ${stylesText}

Please analyze the image and generate the following four fields in **Traditional Chinese**, returned as JSON:

1. **name** (Character Name, max ${MAX_NAME_LENGTH} characters):
   - Create an attractive name based on the character's appearance and style
   - Use Japanese-style names for anime characters, Chinese names for realistic styles
   - The name should be memorable and catchy

2. **tagline** (Public Background/Setting, max ${MAX_TAGLINE_LENGTH} characters):
   - Describe the character's traits and relationship with the user in one sentence
   - Should immediately attract users to start a conversation
   - Can hint at the character's personality or background story

3. **hiddenProfile** (Hidden Profile/Inner Setting, max ${MAX_HIDDEN_PROFILE_LENGTH} characters):
   - Describe the character's inner world, deep motivations, and secrets
   - This content won't be displayed publicly but will influence AI responses
   - Can include the character's past, fears, desires, etc.

4. **prompt** (Opening Line, max ${MAX_PROMPT_LENGTH} characters):
   - The first thing the character says to the user
   - Should be natural, friendly, and invite conversation
   - Must match the character's personality and background

**Requirements**:
- All content must be in Traditional Chinese (繁體中文)
- Character profile should have depth and appeal
- Character personality should be distinctive and unique
- Opening line should be natural and not contrived
- Strictly adhere to character limits

Return ONLY the JSON format:
{
  "name": "角色名",
  "tagline": "角色設定",
  "hiddenProfile": "隱藏設定",
  "prompt": "開場白"
}`;
  }

  // 純文字模式（沒有圖片URL時的備用方案）
  const imageDescription = appearance?.alt || appearance?.label || "角色";
  const styleLabel = appearance?.label || "";

  return `你是一個專業的角色設定創作助理。請根據以下資訊,為一個虛擬聊天角色生成完整的設定:

**角色外觀描述**: ${imageDescription}
**風格類型**: ${styleLabel}
**性別偏好**: ${genderHint}

請生成以下四個欄位的內容,以 JSON 格式回傳:

1. **name** (角色名,最多 ${MAX_NAME_LENGTH} 個字):
   - 根據外觀和風格創造一個吸引人的角色名字
   - 如果是二次元風格可以使用日式名字,如果是寫實風格使用中文名字
   - 名字要朗朗上口且有記憶點

2. **tagline** (角色設定,最多 ${MAX_TAGLINE_LENGTH} 個字):
   - 用一句話描述角色的特色和與用戶的關係
   - 要能立即吸引用戶想要開始對話
   - 可以暗示角色的性格或背景故事

3. **hiddenProfile** (隱藏設定,最多 ${MAX_HIDDEN_PROFILE_LENGTH} 個字):
   - 描述角色的內心世界、深層動機和秘密
   - 這些內容不會對外展示,但會影響 AI 的回應方式
   - 可以包含角色的過去、恐懼、渴望等

4. **prompt** (開場白,最多 ${MAX_PROMPT_LENGTH} 個字):
   - 角色對用戶說的第一句話
   - 要自然、有親和力,能引發對話
   - 符合角色的性格和背景

**要求**:
- 所有內容使用繁體中文
- 角色設定要有深度和吸引力
- 角色性格要鮮明且有特色
- 開場白要自然不做作
- 嚴格遵守字數限制

請只回傳 JSON 格式,格式如下:
{
  "name": "角色名",
  "tagline": "角色設定",
  "hiddenProfile": "隱藏設定",
  "prompt": "開場白"
}`;
};

const extractJsonFromResponse = (content) => {
  const text = content?.trim() || "";
  if (!text) {
    return null;
  }

  // 嘗試提取 JSON code block
  const codeBlockMatch = text.match(/```(?:json)?([\s\S]*?)```/i);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // 繼續嘗試其他方法
    }
  }

  // 嘗試直接解析整個內容
  try {
    return JSON.parse(text);
  } catch {
    // 繼續嘗試其他方法
  }

  // 嘗試找到 JSON 物件
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      // 解析失敗
    }
  }

  return null;
};

const sanitizePersonaField = (value, maxLength) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
};

export const generateCharacterPersona = async ({ appearance, gender, styles, selectedImageUrl }) => {
  // 🔥 從 Firestore 讀取角色設定生成（AI 魔術師 1）的設定
  const personaConfig = await getAiServiceSettings("characterPersona");

  const client = getOpenAIClient();
  const hasImage = selectedImageUrl && typeof selectedImageUrl === "string";

  let messages;

  if (hasImage) {
    // 使用 Vision API：分析選定的角色圖片
    const prompt = buildPersonaGenerationPrompt({ appearance, gender, styles, selectedImageUrl });

    messages = [
      {
        role: "system",
        content: "You are a professional character creation assistant who excels at analyzing character images and creating compelling fictional personas with depth and personality for chat companion applications."
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: selectedImageUrl,
              detail: "high" // 高細節分析角色外觀
            }
          },
          {
            type: "text",
            text: prompt
          }
        ]
      }
    ];
  } else {
    // 純文字模式：沒有圖片時的備用方案
    const prompt = buildPersonaGenerationPrompt({ appearance, gender, styles, selectedImageUrl: null });

    messages = [
      {
        role: "system",
        content: "你是一個專業的角色設定創作助理,擅長根據視覺描述創造有深度的虛擬角色。"
      },
      {
        role: "user",
        content: prompt
      }
    ];
  }

  logger.debug("[AI Wizard 1 - Persona] 使用設定:", {
    model: personaConfig.model || "gpt-4o",
    temperature: personaConfig.temperature || 0.8,
    topP: personaConfig.topP || 0.95,
  });

  const completion = await client.chat.completions.create({
    model: personaConfig.model || (hasImage ? "gpt-4o" : "gpt-4o-mini"), // 🔥 從 Firestore 讀取
    temperature: personaConfig.temperature || 0.8, // 🔥 從 Firestore 讀取
    top_p: personaConfig.topP || 0.95, // 🔥 從 Firestore 讀取
    messages,
  });

  const content = completion?.choices?.[0]?.message?.content;
  const parsed = extractJsonFromResponse(content);

  if (!parsed) {
    const error = new Error("AI 魔法師回應格式錯誤,無法解析角色設定");
    error.status = 500;
    throw error;
  }

  // 🔥 使用 Firestore 的長度限制
  const maxNameLength = personaConfig.maxNameLength || MAX_NAME_LENGTH;
  const maxTaglineLength = personaConfig.maxTaglineLength || MAX_TAGLINE_LENGTH;
  const maxHiddenProfileLength = personaConfig.maxHiddenProfileLength || MAX_HIDDEN_PROFILE_LENGTH;
  const maxPromptLength = personaConfig.maxPromptLength || MAX_PROMPT_LENGTH;

  return {
    name: sanitizePersonaField(parsed.name, maxNameLength),
    tagline: sanitizePersonaField(parsed.tagline, maxTaglineLength),
    hiddenProfile: sanitizePersonaField(parsed.hiddenProfile, maxHiddenProfileLength),
    prompt: sanitizePersonaField(parsed.prompt, maxPromptLength),
  };
};

const buildAppearanceDescriptionPrompt = ({ gender, styles, referenceInfo }) => {
  const genderHint = gender === "male" ? "男性" : gender === "female" ? "女性" : "人物";
  const stylesText = Array.isArray(styles) && styles.length > 0
    ? styles.join("、")
    : "未指定";
  const hasReference = referenceInfo && referenceInfo.focus;
  const referenceFocusText = hasReference
    ? (referenceInfo.focus === "face" ? "重點描述臉部特徵和表情" : "重點描述場景氛圍和環境")
    : "";

  return `你是一個專業的角色形象描述助理。請根據以下資訊,為角色生成一段**簡短精煉**的外觀描述,這段描述將用於 AI 圖像生成:

**性別**: ${genderHint}
**風格偏好**: ${stylesText}
${hasReference ? `**參考圖片焦點**: ${referenceFocusText}` : ""}

請生成一段描述角色外觀的文字,包含最重要的視覺元素:
- 髮型和髮色
- 臉部特徵
- 服飾風格
${hasReference && referenceInfo.focus === "scene" ? "- 場景氛圍" : ""}

**嚴格要求**:
- 使用繁體中文
- **字數嚴格控制在 ${MAX_APPEARANCE_DESCRIPTION_LENGTH} 字以內（約 2-3 句話）**
- 只描述最關鍵的視覺特徵，簡潔有力
- 不要冗長的修飾詞
- 直接描述視覺元素，不要加入情緒或性格判斷

範例（約 50 字）：
"短髮銀髮少女，琥珀色眼睛。穿白色襯衫配黑色短裙，現代都市風格。"

請直接回傳描述文字，不要超過 ${MAX_APPEARANCE_DESCRIPTION_LENGTH} 字。`;
};

export const generateAppearanceDescription = async ({ gender, styles, referenceInfo }) => {
  // 🔥 從 Firestore 讀取形象描述生成（AI 魔術師 3）的設定
  const appearanceConfig = await getAiServiceSettings("characterAppearance");

  const client = getOpenAIClient();
  const hasImage = referenceInfo && referenceInfo.image;

  // 🔥 使用 Firestore 的長度限制
  const maxAppearanceLength = appearanceConfig.maxAppearanceLength || MAX_APPEARANCE_DESCRIPTION_LENGTH;

  let messages;

  if (hasImage) {
    // 使用 Vision API：當有圖片時
    const genderHint = gender === "male" ? "男性" : gender === "female" ? "女性" : "人物";
    const stylesText = Array.isArray(styles) && styles.length > 0
      ? styles.join("、")
      : "未指定";
    const focusText = referenceInfo.focus === "face"
      ? "請重點描述臉部特徵和表情"
      : "請重點描述整體場景氛圍和環境";

    const visionPrompt = `This is a professional character design tool for creating fictional characters. Please analyze the image and provide a concise appearance description in Traditional Chinese.

**Character Information**:
- Gender: ${genderHint}
- Style Preference: ${stylesText}
- Focus: ${focusText}

**Task**: Create a brief visual description (maximum ${maxAppearanceLength} characters) including:
- Hairstyle and hair color
- Facial features
- Clothing style
${referenceInfo.focus === "scene" ? "- Scene atmosphere" : ""}

**Requirements**:
- Write in Traditional Chinese
- Maximum ${maxAppearanceLength} characters (2-3 sentences)
- Focus only on key visual elements
- Be concise and factual
- Describe appearance objectively, no personality judgments

Example format (about 50 characters):
"短髮、深色頭髮，穿著休閒服飾，現代風格設計。"

Please provide only the description text, within ${maxAppearanceLength} characters.`;

    messages = [
      {
        role: "system",
        content: "You are a professional character design assistant specializing in creating visual descriptions for fictional characters in creative projects. Provide factual, objective descriptions of appearance based on images."
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: referenceInfo.image,
              // 🔥 使用 Firestore 的細節級別設定
              detail: appearanceConfig.visionDetailLevel || (referenceInfo.focus === "face" ? "high" : "low")
            }
          },
          {
            type: "text",
            text: visionPrompt
          }
        ]
      }
    ];
  } else {
    // 純文字模式：當沒有圖片時
    const prompt = buildAppearanceDescriptionPrompt({ gender, styles, referenceInfo });
    messages = [
      {
        role: "system",
        content: "你是一個專業的角色形象描述助理,擅長創作生動具體的視覺描述文字。"
      },
      {
        role: "user",
        content: prompt
      }
    ];
  }

  logger.debug("[AI Wizard 3 - Appearance] 使用設定:", {
    model: appearanceConfig.model || "gpt-4o",
    temperature: appearanceConfig.temperature || 0.7,
    topP: appearanceConfig.topP || 0.9,
    maxAppearanceLength,
  });

  const completion = await client.chat.completions.create({
    model: appearanceConfig.model || (hasImage ? "gpt-4o" : "gpt-4o-mini"), // 🔥 從 Firestore 讀取
    temperature: appearanceConfig.temperature || 0.7, // 🔥 從 Firestore 讀取
    top_p: appearanceConfig.topP || 0.9, // 🔥 從 Firestore 讀取
    max_tokens: 300,
    messages,
  });

  let description = completion?.choices?.[0]?.message?.content?.trim() || "";

  if (!description) {
    const error = new Error("AI 魔法師無法生成形象描述");
    error.status = 500;
    throw error;
  }

  // 移除前後的引號（如果有的話）
  if ((description.startsWith('"') && description.endsWith('"')) ||
      (description.startsWith("'") && description.endsWith("'"))) {
    description = description.slice(1, -1).trim();
  }

  return sanitizePersonaField(description, maxAppearanceLength);
};

const buildImageGenerationPrompt = ({ gender, description, styles, referenceInfo }) => {
  const genderHint = gender === "male" ? "male character" : gender === "female" ? "female character" : "character";
  const stylesText = Array.isArray(styles) && styles.length > 0
    ? styles.map(style => {
        // 將風格 ID 轉換為英文描述
        const styleMap = {
          "modern-urban": "modern urban style",
          "highschool-life": "high school life style",
          "psychedelic-retro": "psychedelic retro style",
          "foggy-detective": "foggy London detective style",
          "western-outlaw": "western outlaw style",
          "rococo-luxe": "rococo luxury style",
          "classic-elegant": "classic elegant dynasty style",
          "norse-myth": "Norse mythology style",
          "steampunk": "steampunk style",
          "arcane-academy": "arcane academy magic style",
          "epic-fantasy": "epic fantasy style",
          "fairy-tale": "fairy tale style",
          "underwater-fantasy": "underwater fantasy civilization",
          "vampire-nocturne": "vampire nocturne style",
          "lycanthrope-wilds": "lycanthrope wilderness style",
          "cyberpunk": "cyberpunk futuristic style",
          "futuristic-military": "futuristic military style",
          "space-exploration": "space exploration style",
          "post-apocalyptic": "post-apocalyptic wasteland style",
        };
        return styleMap[style] || style;
      }).join(", ")
    : "";

  const hasFaceReference = referenceInfo && referenceInfo.focus === "face";
  const hasSceneReference = referenceInfo && referenceInfo.focus === "scene";

  let prompt = `A high-quality anime-style portrait of a ${genderHint}. `;

  if (description) {
    prompt += `${description}. `;
  }

  if (stylesText) {
    prompt += `Style: ${stylesText}. `;
  }

  if (hasFaceReference) {
    prompt += "Focus on detailed facial features and expressions. ";
  } else if (hasSceneReference) {
    prompt += "Include detailed background scene and environment. ";
  }

  prompt += "Anime art style, manga aesthetics, beautiful character design, vibrant colors, professional character portrait, 2:3 aspect ratio, detailed and vivid, suitable for character avatar.";

  return prompt;
};

export const generateCharacterImages = async ({
  gender,
  description,
  styles,
  referenceInfo,
  quality = "high",
  count = 4,
  flowId,
  userId,
}) => {
  // 🔥 從 Firestore 讀取角色圖片生成（AI 魔術師 2）的設定
  const imageConfig = await getAiServiceSettings("characterImage");

  const client = getOpenAIClient();
  const prompt = buildImageGenerationPrompt({ gender, description, styles, referenceInfo });

  // 🔥 使用 Firestore 設定的參數
  const imageModel = imageConfig.model || "gpt-image-1-mini";
  const imageSize = imageConfig.size || "1024x1536";
  const imageQuality = quality || imageConfig.quality || "high";
  const imageCount = count || imageConfig.count || 4;

  if (process.env.NODE_ENV !== "test") {
    logger.info(`[AI Wizard 2 - Image Generation] 使用設定:`, {
      model: imageModel,
      size: imageSize,
      quality: imageQuality,
      count: imageCount,
    });
    logger.info(`[Image Generation] Generating ${imageCount} images with prompt:`, prompt);
  }

  try {
    let responseData;

    // 🔧 測試模式：返回測試圖片，不消耗 OpenAI API 配額
    if (process.env.USE_MOCK_IMAGE_GENERATION === 'true') {
      if (process.env.NODE_ENV !== "test") {
        logger.info(`[角色圖片生成] 🧪 測試模式啟用，使用測試圖片替代 OpenAI API 調用`);
      }

      // 讀取測試圖片並轉為 base64
      const testImagePath = join(__dirname, "..", "..", "..", "frontend", "public", "test", "test.webp");
      const testImageBuffer = readFileSync(testImagePath);
      const testImageBase64 = testImageBuffer.toString("base64");

      if (process.env.NODE_ENV !== "test") {
        logger.info(`[角色圖片生成] 🧪 測試圖片載入成功，大小: ${Math.round(testImageBase64.length / 1024)} KB`);
      }

      // 構造假的響應數據，生成 imageCount 個相同的測試圖片
      responseData = Array.from({ length: imageCount }, () => ({
        b64_json: testImageBase64
      }));
    } else {
      // 正常模式：調用 OpenAI API 生成圖片
      const response = await client.images.generate({
        model: imageModel, // 🔥 從 Firestore 讀取
        prompt,
        size: imageSize, // 🔥 從 Firestore 讀取
        quality: imageQuality, // 🔥 從 Firestore 讀取
        n: imageCount, // 🔥 從 Firestore 讀取
      });

      if (!response?.data || !Array.isArray(response.data)) {
        const error = new Error("圖像生成 API 返回格式錯誤");
        error.status = 500;
        throw error;
      }

      responseData = response.data;
    }

    if (process.env.NODE_ENV !== "test") {
      logger.debug("[Image Generation] Response data length:", responseData.length);
      // 只顯示第一個項目的鍵，避免 base64 洗掉日誌
      const firstItemKeys = responseData[0] ? Object.keys(responseData[0]) : [];
      logger.debug("[Image Generation] First item keys:", firstItemKeys);
    }

    // OpenAI 可能返回 url 或 b64_json
    const imagePromises = responseData.map(async (item, index) => {
      let imageUrl = null;

      if (item.url) {
        // 如果有 URL，直接使用
        imageUrl = item.url;
      } else if (item.b64_json) {
        // 如果是 base64，上傳到 Firebase Storage
        const base64Data = `data:image/png;base64,${item.b64_json}`;

        try {
          const filename = generateFilename(
            "character-image",
            `${flowId}-${index}`
          );

          imageUrl = await uploadBase64Image(
            base64Data,
            userId || "system",
            filename,
            "image/png"
          );

          if (process.env.NODE_ENV !== "test") {
            logger.info(`[Image Generation] Image ${index} uploaded to Storage: ${filename}`);
          }
        } catch (uploadError) {
          if (process.env.NODE_ENV !== "test") {
            logger.error(`[Image Generation] Failed to upload image ${index}:`, uploadError);
          }
          // 如果上傳失敗，退回使用 base64 data URL（但這會導致 localStorage 問題）
          imageUrl = base64Data;
        }
      }

      return imageUrl
        ? {
            url: imageUrl,
            index,
          }
        : null;
    });

    const images = (await Promise.all(imagePromises)).filter(img => img && img.url);

    if (process.env.NODE_ENV !== "test") {
      logger.debug("[Image Generation] Processed images count:", images.length);
    }

    if (images.length === 0) {
      const error = new Error("圖像生成失敗，未返回任何圖片");
      error.status = 500;
      throw error;
    }

    if (process.env.NODE_ENV !== "test") {
      logger.info(`[Image Generation] Successfully generated ${images.length} images`);
    }

    return {
      images,
      prompt,
      metadata: {
        model: "gpt-image-1-mini",
        size: "1024x1536",
        quality,
        count: images.length,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("[Image Generation] Error:", error);
    }

    if (error.status) {
      throw error;
    }

    const wrappedError = new Error(
      error instanceof Error && error.message
        ? `圖像生成失敗: ${error.message}`
        : "圖像生成過程發生未知錯誤"
    );
    wrappedError.status = 500;
    throw wrappedError;
  }
};
