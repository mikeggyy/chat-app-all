/**
 * 請求ID生成工具
 * 為冪等性請求生成唯一標識
 */

/**
 * 生成唯一的請求ID
 * @param prefix - ID前綴
 * @returns 請求ID
 */
export function generateRequestId(prefix: string = 'req'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * 生成語音播放請求ID
 * @param userId - 用戶ID
 * @param characterId - 角色ID
 * @param messageId - 消息ID
 * @returns 請求ID
 */
export function generateVoiceRequestId(userId: string, characterId: string, messageId: string): string {
  // 使用確定性ID，相同消息的語音請求使用相同ID
  return `voice-${userId}-${characterId}-${messageId}`;
}

/**
 * 生成拍照請求ID
 * @param userId - 用戶ID
 * @param characterId - 角色ID
 * @returns 請求ID
 */
export function generatePhotoRequestId(userId: string, characterId: string): string {
  // 每次拍照都是新請求，使用時間戳保證唯一性
  return generateRequestId(`photo-${userId}-${characterId}`);
}

/**
 * 生成送禮請求ID
 * @param userId - 用戶ID
 * @param characterId - 角色ID
 * @param giftId - 禮物ID
 * @returns 請求ID
 */
export function generateGiftRequestId(userId: string, characterId: string, giftId: string): string {
  // 每次送禮都是新請求，使用時間戳保證唯一性
  return generateRequestId(`gift-${userId}-${characterId}-${giftId}`);
}

/**
 * 生成AI回覆請求ID
 * @param userId - 用戶ID
 * @param characterId - 角色ID
 * @param userMessageId - 用戶消息ID
 * @returns 請求ID
 */
export function generateAiReplyRequestId(userId: string, characterId: string, userMessageId: string): string {
  // 使用確定性ID，相同用戶消息的AI回覆使用相同ID
  return `ai-reply-${userId}-${characterId}-${userMessageId}`;
}

/**
 * 生成角色解鎖卡使用請求ID
 * @param userId - 用戶ID
 * @param characterId - 角色ID
 * @returns 請求ID
 *
 * ✅ 2025-11-25 修復：使用每日確定性ID，防止重複點擊扣卡
 * 策略：同一天內對同一角色的解鎖使用相同ID，啟用冪等性保護
 */
export function generateUnlockCharacterRequestId(userId: string, characterId: string): string {
  // 使用每日確定性ID：同一天內相同用戶+角色的解鎖使用相同ID
  const today = new Date().toISOString().split('T')[0]; // 格式：2025-11-25
  return `unlock-character-${userId}-${characterId}-${today}`;
}

/**
 * 生成拍照解鎖卡使用請求ID
 * @param userId - 用戶ID
 * @returns 請求ID
 */
export function generateUnlockPhotoRequestId(userId: string): string {
  // 每次使用都是新請求，使用時間戳保證唯一性
  return generateRequestId(`unlock-photo-${userId}`);
}

/**
 * 生成影片解鎖卡使用請求ID
 * @param userId - 用戶ID
 * @returns 請求ID
 */
export function generateUnlockVideoRequestId(userId: string): string {
  // 每次使用都是新請求，使用時間戳保證唯一性
  return generateRequestId(`unlock-video-${userId}`);
}

export default {
  generateRequestId,
  generateVoiceRequestId,
  generatePhotoRequestId,
  generateGiftRequestId,
  generateAiReplyRequestId,
  generateUnlockCharacterRequestId,
  generateUnlockPhotoRequestId,
  generateUnlockVideoRequestId,
};
