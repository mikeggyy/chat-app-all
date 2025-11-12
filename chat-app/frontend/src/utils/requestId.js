/**
 * 請求ID生成工具
 * 為冪等性請求生成唯一標識
 */

/**
 * 生成唯一的請求ID
 * @param {string} prefix - ID前綴
 * @returns {string} 請求ID
 */
export function generateRequestId(prefix = 'req') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * 生成語音播放請求ID
 * @param {string} userId - 用戶ID
 * @param {string} characterId - 角色ID
 * @param {string} messageId - 消息ID
 * @returns {string} 請求ID
 */
export function generateVoiceRequestId(userId, characterId, messageId) {
  // 使用確定性ID，相同消息的語音請求使用相同ID
  return `voice-${userId}-${characterId}-${messageId}`;
}

/**
 * 生成拍照請求ID
 * @param {string} userId - 用戶ID
 * @param {string} characterId - 角色ID
 * @returns {string} 請求ID
 */
export function generatePhotoRequestId(userId, characterId) {
  // 每次拍照都是新請求，使用時間戳保證唯一性
  return generateRequestId(`photo-${userId}-${characterId}`);
}

/**
 * 生成送禮請求ID
 * @param {string} userId - 用戶ID
 * @param {string} characterId - 角色ID
 * @param {string} giftId - 禮物ID
 * @returns {string} 請求ID
 */
export function generateGiftRequestId(userId, characterId, giftId) {
  // 每次送禮都是新請求，使用時間戳保證唯一性
  return generateRequestId(`gift-${userId}-${characterId}-${giftId}`);
}

/**
 * 生成AI回覆請求ID
 * @param {string} userId - 用戶ID
 * @param {string} characterId - 角色ID
 * @param {string} userMessageId - 用戶消息ID
 * @returns {string} 請求ID
 */
export function generateAiReplyRequestId(userId, characterId, userMessageId) {
  // 使用確定性ID，相同用戶消息的AI回覆使用相同ID
  return `ai-reply-${userId}-${characterId}-${userMessageId}`;
}

/**
 * 生成角色解鎖卡使用請求ID
 * @param {string} userId - 用戶ID
 * @param {string} characterId - 角色ID
 * @returns {string} 請求ID
 */
export function generateUnlockCharacterRequestId(userId, characterId) {
  // 每次解鎖都是新請求，使用時間戳保證唯一性
  return generateRequestId(`unlock-character-${userId}-${characterId}`);
}

/**
 * 生成拍照解鎖卡使用請求ID
 * @param {string} userId - 用戶ID
 * @returns {string} 請求ID
 */
export function generateUnlockPhotoRequestId(userId) {
  // 每次使用都是新請求，使用時間戳保證唯一性
  return generateRequestId(`unlock-photo-${userId}`);
}

/**
 * 生成影片解鎖卡使用請求ID
 * @param {string} userId - 用戶ID
 * @returns {string} 請求ID
 */
export function generateUnlockVideoRequestId(userId) {
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
