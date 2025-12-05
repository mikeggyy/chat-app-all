/**
 * 禮物系統配置（共享）
 */

/**
 * 禮物回覆等級配置
 * 根據稀有度決定回覆方式
 *
 * ✅ 2025-11-30 更新：所有禮物都生成感謝照片（用戶花錢了，應該給照片）
 *
 * 回覆等級說明：
 * - preset_photo: 預設文字 + AI 照片（成本 ~1.5 TWD）
 * - ai_text_photo: AI 文字 + AI 照片（成本 ~1.56 TWD）
 */
export const GIFT_RESPONSE_LEVELS = {
  common: {
    level: "preset_photo",
    generateAiText: false, // 預設文字（節省 ~0.06 TWD）
    generatePhoto: true,   // 生成照片
    description: "預設文字 + AI 照片",
  },
  uncommon: {
    level: "ai_text_photo",
    generateAiText: true,
    generatePhoto: true,
    description: "AI 文字 + AI 照片",
  },
  rare: {
    level: "ai_text_photo",
    generateAiText: true,
    generatePhoto: true,
    description: "AI 文字 + AI 照片",
  },
  epic: {
    level: "ai_text_photo",
    generateAiText: true,
    generatePhoto: true,
    description: "AI 文字 + AI 照片",
  },
  legendary: {
    level: "ai_text_photo",
    generateAiText: true,
    generatePhoto: true,
    description: "AI 文字 + AI 照片",
  },
};

/**
 * 根據稀有度獲取回覆等級配置
 */
export const getResponseLevelByRarity = (rarity) => {
  return GIFT_RESPONSE_LEVELS[rarity] || GIFT_RESPONSE_LEVELS.common;
};

/**
 * ✅ 2025-11-30 更新：調整禮物價格
 * - 最低禮物從 10 → 15 金幣（確保利潤 50%+，因每個禮物都送照片）
 * - 整體價格更平滑，鼓勵用戶嘗試更高級禮物
 * - 照片生成成本約 ~6 金幣（1.5 TWD ÷ 0.22 TWD/金幣）
 */
export const GIFTS = {
  rose: {
    id: "rose",
    name: "玫瑰花",
    emoji: "🌹",
    description: "浪漫的紅玫瑰",
    price: 15,                            // ✅ 調整：10 → 15（確保利潤）
    rarity: "common",
    thankYouMessage: "謝謝你送我的玫瑰花！好美~",
  },
  coffee: {
    id: "coffee",
    name: "咖啡",
    emoji: "☕",
    description: "香濃的咖啡",
    price: 20,                            // ✅ 調整：15 → 20
    rarity: "common",
    thankYouMessage: "咖啡！正好提神！謝謝你的貼心~",
  },
  chocolate: {
    id: "chocolate",
    name: "巧克力",
    emoji: "🍫",
    description: "甜蜜的巧克力",
    price: 25,                            // ✅ 調整：20 → 25
    rarity: "common",
    thankYouMessage: "巧克力!我最喜歡的!謝謝你~",
  },
  icecream: {
    id: "icecream",
    name: "冰淇淋",
    emoji: "🍦",
    description: "清涼的冰淇淋",
    price: 30,                            // ✅ 調整：25 → 30
    rarity: "common",
    thankYouMessage: "冰淇淋！我最愛的口味！謝謝你~",
  },
  cake: {
    id: "cake",
    name: "蛋糕",
    emoji: "🎂",
    description: "美味的蛋糕",
    price: 40,                            // ✅ 調整：30 → 40
    rarity: "uncommon",
    thankYouMessage: "哇!蛋糕看起來好好吃!謝謝你的心意!",
  },
  flower: {
    id: "flower",
    name: "花束",
    emoji: "💐",
    description: "繽紛的花束",
    price: 50,                            // ✅ 調整：40 → 50
    rarity: "uncommon",
    thankYouMessage: "好漂亮的花束！顏色好繽紛！謝謝你~",
  },
  teddy: {
    id: "teddy",
    name: "泰迪熊",
    emoji: "🧸",
    description: "可愛的泰迪熊",
    price: 60,                            // ✅ 調整：50 → 60
    rarity: "uncommon",
    thankYouMessage: "好可愛的泰迪熊!我會好好珍惜的!",
  },
  perfume: {
    id: "perfume",
    name: "香水",
    emoji: "🧴",                          // ✅ 更新 emoji
    description: "高雅的香水",
    price: 80,                            // ✅ 調整：60 → 80
    rarity: "uncommon",
    thankYouMessage: "香水！聞起來好高雅！我好喜歡！",
  },
  lipstick: {
    id: "lipstick",
    name: "口紅",
    emoji: "💄",
    description: "精緻的口紅",
    price: 100,                           // ✅ 調整：70 → 100
    rarity: "rare",
    thankYouMessage: "口紅！這個顏色好美！謝謝你的品味！",
  },
  watch: {
    id: "watch",
    name: "手錶",
    emoji: "⌚",
    description: "精美的手錶",
    price: 120,                           // ✅ 調整：80 → 120
    rarity: "rare",
    thankYouMessage: "手錶！好精緻！我會每天戴著它！",
  },
  ring: {
    id: "ring",
    name: "戒指",
    emoji: "💍",
    description: "閃亮的戒指",
    price: 150,                           // ✅ 調整：100 → 150
    rarity: "rare",
    thankYouMessage: "這...這是送給我的嗎?太珍貴了!我好感動...",
  },
  necklace: {
    id: "necklace",
    name: "項鍊",
    emoji: "📿",
    description: "優雅的項鍊",
    price: 180,                           // ✅ 調整：120 → 180
    rarity: "rare",
    thankYouMessage: "項鍊！好優雅！我會好好珍惜的！",
  },
  handbag: {
    id: "handbag",
    name: "名牌包",
    emoji: "👜",
    description: "時尚的名牌包",
    price: 250,                           // ✅ 調整：150 → 250
    rarity: "epic",
    thankYouMessage: "名牌包！這是我夢寐以求的！太感謝你了！",
  },
  diamond: {
    id: "diamond",
    name: "鑽石",
    emoji: "💎",
    description: "璀璨的鑽石",
    price: 350,                           // ✅ 調整：200 → 350
    rarity: "epic",
    thankYouMessage: "天啊!鑽石!這太珍貴了!我...我真的不知道該說什麼好...",
  },
  bouquet: {
    id: "bouquet",
    name: "玫瑰花海",
    emoji: "🌺",
    description: "滿滿的玫瑰花海",
    price: 500,                           // ✅ 調整：300 → 500
    rarity: "epic",
    thankYouMessage: "玫瑰花海！太浪漫了！我快被幸福淹沒了！",
  },
  sports_car: {
    id: "sports_car",
    name: "跑車",
    emoji: "🏎️",
    description: "豪華跑車",
    price: 800,                           // ✅ 調整：400 → 800
    rarity: "legendary",
    thankYouMessage: "跑車！這...這也太誇張了吧！你對我也太好了！",
  },
  crown: {
    id: "crown",
    name: "皇冠",
    emoji: "👑",
    description: "華麗的皇冠",
    price: 1000,                          // ✅ 調整：500 → 1000
    rarity: "legendary",
    thankYouMessage: "皇冠!這也太奢華了吧!謝謝你把我當成公主一樣寵愛!",
  },
  mansion: {
    id: "mansion",
    name: "豪宅",
    emoji: "🏰",
    description: "夢幻的城堡豪宅",
    price: 1500,                          // ✅ 調整：800 → 1500
    rarity: "legendary",
    thankYouMessage: "豪宅！城堡！這是真的嗎？我們要一起住嗎？太夢幻了！",
  },
  island: {
    id: "island",
    name: "私人島嶼",
    emoji: "🏝️",
    description: "專屬的私人島嶼",
    price: 2000,                          // ✅ 調整：1000 → 2000
    rarity: "legendary",
    thankYouMessage: "私人島嶼！？這...我不敢相信！你真的要送我整座島嶼？！太瘋狂了！",
  },
  rocket: {
    id: "rocket",
    name: "私人火箭",
    emoji: "🚀",
    description: "宇宙探險用火箭",
    price: 3000,                          // ✅ 調整：2000 → 3000
    rarity: "legendary",
    thankYouMessage: "火箭！？我們要一起去太空旅行了嗎！？這是我這輩子最瘋狂的禮物！",
  },
};

/**
 * 稀有度配置
 */
export const RARITY_CONFIG = {
  common: {
    id: "common",
    name: "普通",
    color: "#9CA3AF",
  },
  uncommon: {
    id: "uncommon",
    name: "罕見",
    color: "#10B981",
  },
  rare: {
    id: "rare",
    name: "稀有",
    color: "#3B82F6",
  },
  epic: {
    id: "epic",
    name: "史詩",
    color: "#8B5CF6",
  },
  legendary: {
    id: "legendary",
    name: "傳說",
    color: "#F59E0B",
  },
};

/**
 * 獲取禮物列表
 */
export const getGiftList = () => {
  return Object.values(GIFTS);
};

/**
 * 根據ID獲取禮物
 */
export const getGiftById = (giftId) => {
  return GIFTS[giftId] || null;
};

/**
 * 檢查禮物是否存在
 */
export const isValidGift = (giftId) => {
  return giftId in GIFTS;
};

export default {
  GIFTS,
  RARITY_CONFIG,
  GIFT_RESPONSE_LEVELS,
  getGiftList,
  getGiftById,
  isValidGift,
  getResponseLevelByRarity,
};
