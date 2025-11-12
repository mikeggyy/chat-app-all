/**
 * 圖片生成服務
 * 使用 Gemini 2.5 Flash Image (Nano Banana) 生成保持角色一致性的 AI 角色自拍照片
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateGeminiImage, buildGeminiPrompt } from "./gemini.service.js";
import { getMatchById } from "../match/match.service.js";
import { getConversationHistory, appendConversationMessage } from "../conversation/conversation.service.js";
import { canGeneratePhoto, recordPhotoGeneration } from "./photoLimit.service.js";
import { isDevUser } from "../../../shared/config/testAccounts.js";
import { savePhotoToAlbum } from "../photoAlbum/photoAlbum.service.js";
import { uploadBase64Image, generateFilename } from "../firebase/storage.service.js";

import logger from "../utils/logger.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 為 AI 角色生成自拍照片
 * @param {string} userId - 用戶 ID
 * @param {string} characterId - 角色 ID
 * @param {Object} options - 選項 { usePhotoUnlockCard: boolean }
 * @returns {Promise<Object>} 包含圖片消息的對象
 */
export const generateSelfieForCharacter = async (userId, characterId, options = {}) => {
  const { usePhotoUnlockCard = false } = options;

  if (!userId || !characterId) {
    const error = new Error("需要提供用戶 ID 和角色 ID");
    error.status = 400;
    throw error;
  }

  // 如果使用拍照解鎖卡，先驗證用戶有卡（但不扣除）
  if (usePhotoUnlockCard) {
    const { getPhotoUnlockCards } = await import("../membership/unlockTickets.service.js");
    const cardCount = await getPhotoUnlockCards(userId);

    if (cardCount < 1) {
      const error = new Error("拍照解鎖卡不足");
      error.status = 400;
      throw error;
    }

    logger.info(`[圖片生成] 🎫 用戶 ${userId} 準備使用拍照解鎖卡（當前有 ${cardCount} 張）`);
  } else {
    // 開發測試帳號不跳過限制檢查（使用配置的限制值）
    if (!isDevUser(userId)) {
      // 檢查拍照次數限制
      const limitCheck = await canGeneratePhoto(userId);
      if (!limitCheck.allowed) {
        const error = new Error("已達到拍照次數限制");
        error.status = 403;
        error.limitExceeded = true;
        error.limitInfo = limitCheck;
        throw error;
      }
    }
  }

  // 獲取角色資料
  const character = await getMatchById(characterId);
  if (!character) {
    const error = new Error("找不到指定的角色");
    error.status = 404;
    throw error;
  }

  // 獲取角色參考照片並轉換為 base64
  const portraitPath = character.portraitUrl;

  if (!portraitPath) {
    const error = new Error("角色沒有參考照片，無法生成自拍");
    error.status = 400;
    throw error;
  }

  // 讀取圖片並轉為 base64（支援本地路徑和 Firebase Storage URL）
  let characterImageBase64;
  try {
    let imageBuffer;
    let imageExtension;

    // 檢查是否為 HTTP/HTTPS URL（Cloudflare R2 或 Firebase Storage）
    if (portraitPath.startsWith("http://") || portraitPath.startsWith("https://")) {
      logger.info(`[圖片生成] 從遠端下載角色照片: ${portraitPath}`);

      // 從 URL 下載圖片（帶超時控制）
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10秒超時

      try {
        const response = await fetch(portraitPath, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`下載失敗: ${response.status} ${response.statusText}`);
        }

        // 獲取圖片數據
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);

        // 從 Content-Type 或 URL 獲取圖片格式
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("webp")) {
          imageExtension = "webp";
        } else if (contentType?.includes("png")) {
          imageExtension = "png";
        } else if (contentType?.includes("jpeg") || contentType?.includes("jpg")) {
          imageExtension = "jpeg";
        } else {
          // 從 URL 推斷
          imageExtension = portraitPath.split(".").pop().toLowerCase().split("?")[0];
        }

        logger.info(`[圖片生成] ✅ 成功下載角色照片 (${Math.round(imageBuffer.length / 1024)} KB)`);
      } catch (fetchError) {
        clearTimeout(timeout);
        if (fetchError.name === 'AbortError') {
          throw new Error('下載超時（10秒）');
        }
        throw fetchError;
      }
    } else {
      // 本地文件路徑
      logger.info(`[圖片生成] 從本地讀取角色照片: ${portraitPath}`);

      // 前端的 public 目錄路徑
      const frontendPublicPath = join(__dirname, "..", "..", "..", "frontend", "public");
      const imagePath = join(frontendPublicPath, portraitPath);

      // 讀取文件
      imageBuffer = readFileSync(imagePath);

      // 獲取圖片格式
      imageExtension = portraitPath.split(".").pop().toLowerCase();
    }

    // 轉換為 base64
    const base64Image = imageBuffer.toString("base64");

    // 確定 MIME type
    const mimeType = imageExtension === "webp" ? "image/webp" :
                     imageExtension === "png" ? "image/png" :
                     imageExtension === "jpg" || imageExtension === "jpeg" ? "image/jpeg" :
                     "image/webp";

    // 構建 data URL
    characterImageBase64 = `data:${mimeType};base64,${base64Image}`;

    logger.info("[圖片生成] 為角色", characterId, "生成自拍，圖片大小:", Math.round(base64Image.length / 1024), "KB");
  } catch (error) {
    logger.error("[圖片生成] 讀取角色照片失敗:", error);
    const fallbackError = new Error("無法讀取角色參考照片");
    fallbackError.status = 500;
    throw fallbackError;
  }

  // 獲取對話歷史以了解情境（減少消息數量以降低 token 成本）
  const conversation = await getConversationHistory(userId, characterId);
  const recentMessages = conversation.slice(-3); // 最近 3 條消息（從 6 條減少以節省成本）

  // 🔥 構建圖片生成提示詞（Gemini 版本）- 從 Firestore 讀取模板和場景
  const promptResult = await buildGeminiPrompt(character, recentMessages);
  const prompt = promptResult.prompt;
  const selectedScenario = promptResult.selectedScenario;

  try {
    // 使用 Gemini 2.5 Flash Image (Nano Banana) 生成圖片
    // 支援 2:3 比例，保持角色一致性
    const geminiResult = await generateGeminiImage(characterImageBase64, prompt, {
      styleName: "Disney Charactor", // 使用迪士尼風格
      aspectRatio: "2:3", // 2:3 比例（832x1248 或類似尺寸）
      selectedScenario: selectedScenario, // 🔥 傳遞選中的場景給 Gemini
    });

    if (!geminiResult || !geminiResult.imageDataUrl) {
      throw new Error("圖片生成失敗，未返回圖片 URL");
    }

    const imageDataUrl = geminiResult.imageDataUrl;
    const usageMetadata = geminiResult.usageMetadata;

    // 記錄圖片生成的 token 使用情況
    logger.info(`[圖片生成] Token 使用情況: userId=${userId}, characterId=${characterId}`, {
      promptTokens: usageMetadata.promptTokenCount || 0,
      candidatesTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
    });

    // 上傳圖片到 Firebase Storage（避免 Firestore 大小限制）
    logger.info(`[圖片生成] 開始上傳自拍照片到 Storage: userId=${userId}, characterId=${characterId}`);
    const filename = generateFilename('selfie', characterId);
    const imageUrl = await uploadBase64Image(imageDataUrl, userId, filename, 'image/webp');
    logger.info(`[圖片生成] 自拍照片已上傳到 Storage: ${filename}`);

    // 隨機選擇照片描述文字
    const photoDescriptions = [
      "給你看看我現在的樣子！😊",
      "來～看看我 📷✨",
      "剛拍的照片，感覺還不錯！😄",
      "你看！我現在在這裡～ 📸",
      "傳張照片給你！怎麼樣？ 😊",
      "給你看看我的照片～ 💕",
      "幫我拍了張照片！覺得如何？ 😘",
      "這是我現在的樣子哦～ ✨",
      "照片來囉！給你看看～ 📷",
      "剛拍好的照片，快看！ 😊",
      "想讓你看看我現在在做什麼～ 🌸",
      "欸！你看這張照片 ✨",
      "剛好有人幫我拍了一張！😆",
      "這個瞬間想分享給你 💫",
      "拍了張照片，好想給你看！💖",
      "你猜我現在在哪裡？📍✨",
      "今天的我～怎麼樣？ 😊💕",
      "特地拍給你看的哦！😘",
      "看！這是現在的我 🌟",
      "想讓你看看此刻的我 💝",
      "傳照片給你啦～ 😄📷",
      "你看看你看看！✨😊",
      "剛拍的，還熱騰騰的！📸💕",
      "這張拍得不錯吧？😌✨",
      "捕捉到了這個瞬間！📷💫",
    ];
    const randomDescription = photoDescriptions[Math.floor(Math.random() * photoDescriptions.length)];

    // 創建包含圖片的消息
    const imageMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "partner",
      text: randomDescription,
      imageUrl: imageUrl,
      createdAt: new Date().toISOString(),
    };

    // 將消息添加到對話歷史
    await appendConversationMessage(userId, characterId, imageMessage);

    // 同時保存到獨立的相簿（確保清除對話後照片仍保留）
    try {
      await savePhotoToAlbum(userId, {
        characterId,
        imageUrl: imageUrl,
        text: randomDescription,
        type: 'selfie',
        messageId: imageMessage.id,
        createdAt: imageMessage.createdAt,
        scenario: selectedScenario, // 🔥 記錄使用的場景到 Firestore
      });
      logger.info(`[相簿] 自拍照片已保存到相簿: userId=${userId}, characterId=${characterId}` + (selectedScenario ? `, scenario: "${selectedScenario}"` : ""));
    } catch (albumError) {
      // 即使相簿保存失敗，也不影響主流程（照片已經在對話歷史中）
      logger.error("[相簿] 保存自拍照片到相簿失敗:", albumError);
    }

    // 記錄拍照使用次數或扣除解鎖卡
    let usageRecord;
    if (usePhotoUnlockCard) {
      // 使用解鎖卡
      logger.info(`[圖片生成] 🎫 準備扣除拍照解鎖卡 (userId: ${userId})`);
      const { usePhotoUnlockCard: useCardFn } = await import("../membership/unlockTickets.service.js");
      const cardResult = await useCardFn(userId, characterId);
      logger.info(`[圖片生成] ✅ 用戶 ${userId} 成功使用拍照解鎖卡，剩餘 ${cardResult.remaining} 張`);

      // 創建假的 usage record（使用解鎖卡不計入次數）
      usageRecord = {
        count: 0,
        remaining: 999,
        usedCard: true,
      };
    } else {
      // 正常記錄使用次數
      logger.info(`[圖片生成] 📊 記錄正常拍照次數 (userId: ${userId})`);
      usageRecord = await recordPhotoGeneration(userId);
    }

    return {
      success: true,
      message: imageMessage,
      usage: usageRecord,
      tokenUsage: {
        promptTokens: usageMetadata.promptTokenCount || 0,
        candidatesTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
      }
    };
  } catch (error) {
    logger.error(
      `為角色 ${characterId} 生成自拍失敗:`,
      error
    );
    logger.error(`錯誤堆疊:`, error.stack);

    // ✅ 安全性說明：不需要退款邏輯
    // 因為扣費操作（recordPhotoGeneration / usePhotoUnlockCard）
    // 在所有關鍵步驟（生成圖片、上傳、添加到對話）成功後才執行（行 266/278）
    // 如果任何步驟失敗，都不會執行到扣費步驟，所以不需要回滾

    // 處理 PhotoMaker/Replicate API 錯誤
    if (error?.status === 400) {
      const fallbackError = new Error("圖片生成參數錯誤或提示詞不符合內容政策");
      fallbackError.status = 400;
      throw fallbackError;
    }

    if (error?.status === 401) {
      const fallbackError = new Error("API 認證失敗，請檢查 Replicate Token");
      fallbackError.status = 401;
      throw fallbackError;
    }

    if (error?.status === 429) {
      const fallbackError = new Error("API 請求過於頻繁，請稍後再試");
      fallbackError.status = 429;
      throw fallbackError;
    }

    if (error?.status === 503) {
      throw error; // 保持原始錯誤訊息
    }

    // 拋出詳細錯誤而不是通用訊息
    throw error;
  }
};

export default {
  generateSelfieForCharacter,
};
