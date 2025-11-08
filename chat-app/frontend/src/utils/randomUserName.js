/**
 * 隨機使用者名稱生成器
 * 用於新註冊用戶的預設名稱
 */

const nicknames = [
  "小高",
  "小美",
  "小明",
  "小華",
  "小芳",
  "小傑",
  "小玲",
  "小強",
  "小文",
  "小婷",
  "阿龍",
  "阿輝",
  "阿志",
  "阿偉",
  "阿賢",
  "阿豪",
  "阿峰",
  "阿成",
  "阿宏",
  "阿德",
];

/**
 * 生成隨機使用者名稱
 * 格式：[暱稱][4位數字]
 * 例如：小高0556
 * @returns {string} 隨機生成的使用者名稱
 */
export const generateRandomUserName = () => {
  // 隨機選擇暱稱
  const nickname = nicknames[Math.floor(Math.random() * nicknames.length)];

  // 生成 4 位數字（0000-9999）
  const number = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  return `${nickname}${number}`;
};
