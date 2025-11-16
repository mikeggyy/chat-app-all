/**
 * selfieMessages.ts
 * 拍照請求訊息配置
 */

/**
 * 拍照請求訊息列表
 * 當用戶點擊拍照按鈕時，會隨機選擇一則訊息發送
 */
export const SELFIE_REQUEST_MESSAGES: string[] = [
  "給我看看你現在的樣子",
  "想看你現在在做什麼",
  "拍張照片給我看看",
  "能給我一張自拍嗎？",
  "想看看你現在穿什麼",
  "讓我看看你現在的狀態",
  "給我看看你的樣子吧",
  "拍張照片分享一下",
  "想看你此刻的模樣",
  "能看看你現在的樣子嗎？",
  "給我看一張你的照片",
  "想看看現在的你",
  "拍一張給我看看",
  "讓我看看你在幹嘛",
  "給我看看你現在的打扮",
  "想看看你現在在哪",
  "拍張照片來看看",
  "能分享一張照片嗎？",
  "想看你現在的樣子",
  "讓我看看你的近況",
  "給我看看你的自拍",
  "想看看你現在的表情",
  "拍一張照片吧",
  "給我看看你",
  "想看你的照片",
  "讓我看看你現在的模樣",
  "能給我看看你嗎？",
  "想看看你的樣子",
  "給我看看你的照片吧",
  "拍張自拍給我",
];

/**
 * 隨機選擇一則拍照請求訊息
 * @returns {string} 隨機選中的訊息
 */
export function getRandomSelfieMessage(): string {
  const randomIndex = Math.floor(
    Math.random() * SELFIE_REQUEST_MESSAGES.length
  );
  return SELFIE_REQUEST_MESSAGES[randomIndex];
}
