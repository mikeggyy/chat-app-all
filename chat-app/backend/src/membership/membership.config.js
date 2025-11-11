/**
 * 會員等級與權限配置
 */

export const MEMBERSHIP_TIERS = {
  guest: {
    id: "guest",
    name: "訪客",
    price: 0,
    currency: "TWD",
    features: {
      // 對話限制 - 遊客僅 2 條訊息體驗
      messagesPerCharacter: 2,            // 每個角色 2 次對話（體驗用）
      unlimitedChats: false,
      totalCharacters: -1,                // 可對話角色數量無限制（但每個角色只能聊 2 句）

      // 語音限制 - 遊客不能使用語音
      voicesPerCharacter: 0,              // 0 次語音播放
      unlimitedVoice: false,

      // AI 設定
      aiModel: "gpt-4o-mini",
      maxResponseTokens: 100,             // 較短的回覆（約 50 個中文字）
      maxMemoryTokens: 500,               // 較小的記憶容量

      // 角色相關 - 遊客不能創建角色
      canCreateCharacters: false,         // 不能創建角色
      maxCreatedCharacters: 0,

      // 配對與搜尋
      dailyMatchLimit: 3,                 // 每日配對 3 次（體驗用）
      advancedSearch: false,
      matchAdsToUnlock: 0,                // 遊客不能看廣告解鎖
      unlockedMatchesPerAd: 0,
      dailyMatchAdLimit: 0,

      // 廣告相關 - 遊客不能看廣告
      requireAds: false,                  // 不提供廣告功能
      adsToUnlock: 0,
      unlockedMessagesPerAd: 0,
      dailyAdLimitPerCharacter: 0,

      // 解鎖票與卡片 - 遊客沒有
      characterUnlockCards: 0,
      characterCreationCards: 0,
      photoUnlockCards: 0,
      videoUnlockCards: 0,

      // AI 特殊功能 - 遊客不能使用
      aiPhotoGeneration: false,
      aiVideoGeneration: false,

      // 其他
      monthlyCoinsBonus: 0,
      coinsDiscount: 0,
    }
  },

  free: {
    id: "free",
    name: "免費會員",
    price: 0,
    currency: "TWD",
    features: {
      // 對話限制
      messagesPerCharacter: 10,           // 每個角色 10 次對話
      unlimitedChats: false,              // 不能無限對話
      totalCharacters: -1,                // 可對話角色數量（-1 為無限制）

      // 語音限制
      voicesPerCharacter: 10,             // 每個角色 10 次語音播放
      unlimitedVoice: false,              // 不能無限使用語音

      // AI 設定
      aiModel: "gpt-4o-mini",             // 使用的 AI 模型
      maxResponseTokens: 150,             // AI 回復長度限制（tokens，約 75-100 個中文字，1-2 句完整回覆）
      maxMemoryTokens: 1000,              // 對話記憶容量（tokens）

      // 角色相關
      canCreateCharacters: true,          // 可以創建角色（基礎功能）
      maxCreatedCharacters: 3,            // 最多創建 3 個角色（每月重置，參考 config/limits.js）

      // 配對與搜尋
      dailyMatchLimit: 5,                 // 每日配對次數限制
      advancedSearch: false,              // 無進階搜尋
      matchAdsToUnlock: 1,                // 看 1 次廣告解鎖額外配對
      unlockedMatchesPerAd: 1,            // 每次廣告解鎖 1 次配對
      dailyMatchAdLimit: 10,              // 每天最多看 10 次廣告解鎖配對

      // 廣告相關
      requireAds: true,                   // 需要看廣告
      adsToUnlock: 1,                     // 看 1 次廣告解鎖額外對話
      unlockedMessagesPerAd: 5,           // 每次廣告解鎖 5 次對話
      dailyAdLimitPerCharacter: 10,       // 每個角色每天最多看 10 次廣告

      // 解鎖票與卡片
      characterUnlockCards: 0,            // 開通時送的角色解鎖卡（用於解鎖與角色 7 天無限對話）
      characterCreationCards: 0,          // 開通時送的創建角色卡（用於創建新角色）
      photoUnlockCards: 0,                // 開通時送的拍照解鎖卡
      videoUnlockCards: 0,                // 開通時送的影片解鎖卡

      // AI 特殊功能（需要金幣或解鎖卡）
      aiPhotoGeneration: false,           // 不包含 AI 拍照（需金幣購買）
      aiVideoGeneration: false,           // 不包含 AI 影片（需金幣購買）

      // 其他
      monthlyCoinsBonus: 0,               // 每月贈送金幣
      coinsDiscount: 0,                   // 金幣購買折扣（0 = 無折扣）
    }
  },

  vip: {
    id: "vip",
    name: "VIP",
    price: 399,
    currency: "TWD",
    billingCycle: "monthly",
    features: {
      // 對話限制
      messagesPerCharacter: 20,           // 每個角色 20 次對話
      unlimitedChats: false,              // 需使用角色解鎖票才能無限對話
      totalCharacters: -1,                // 無限制角色數量

      // 語音限制
      voicesPerCharacter: -1,             // 無限語音播放
      unlimitedVoice: true,               // 無限使用語音

      // AI 設定
      aiModel: "gpt-4o-mini",             // 使用的 AI 模型
      maxResponseTokens: 250,             // AI 回復長度限制（tokens，約 125-150 個中文字，2-3 句完整回覆）
      maxMemoryTokens: 5000,              // 對話記憶容量（tokens）

      // 角色相關
      canCreateCharacters: true,
      maxCreatedCharacters: 3,            // 最多創建 3 個角色（每月重置，與免費用戶相同，主要使用開通時送的解鎖票）

      // 配對與搜尋
      dailyMatchLimit: 30,                // 每日配對次數
      advancedSearch: true,               // 進階搜尋功能
      matchAdsToUnlock: 1,                // 看 1 次廣告解鎖額外配對
      unlockedMatchesPerAd: 5,            // 每次廣告解鎖 5 次配對
      dailyMatchAdLimit: 10,              // 每天最多看 10 次廣告解鎖配對

      // 廣告相關
      requireAds: true,                   // 需要看廣告解鎖額外對話
      adsToUnlock: 1,                     // 看 1 次廣告解鎖額外對話
      unlockedMessagesPerAd: 10,          // 每次廣告解鎖 10 次對話
      dailyAdLimitPerCharacter: 10,       // 每個角色每天最多看 10 次廣告

      // 解鎖票與卡片（開通時一次發放）
      characterUnlockCards: 10,           // 開通時送 10 張角色解鎖卡（用於解鎖與角色 7 天無限對話）
      characterCreationCards: 10,         // 開通時送 10 張創建角色卡（用於創建新角色）⭐
      photoUnlockCards: 20,               // 開通時送 20 張拍照解鎖卡
      videoUnlockCards: 3,                // 開通時送 3 張影片解鎖卡

      // AI 特殊功能
      aiPhotoGeneration: false,           // 需要使用解鎖卡或金幣
      aiVideoGeneration: false,           // 需要使用解鎖卡或金幣
      aiPhotoDiscount: 0,                 // AI 拍照無折扣
      aiVideoDiscount: 0,                 // AI 影片無折扣

      // 其他
      monthlyCoinsBonus: 600,             // 開通時贈送 600 金幣
      coinsDiscount: 0.1,                 // 金幣購買 9 折
    }
  },

  vvip: {
    id: "vvip",
    name: "VVIP",
    price: 999,
    currency: "TWD",
    billingCycle: "monthly",
    features: {
      // 對話限制
      messagesPerCharacter: 50,           // 每個角色 50 次對話
      unlimitedChats: false,              // 需使用角色解鎖票才能無限對話
      totalCharacters: -1,

      // 語音限制
      voicesPerCharacter: -1,             // 無限語音播放
      unlimitedVoice: true,               // 無限使用語音

      // AI 設定
      aiModel: "gpt-4.1-mini",            // VVIP 專屬：使用更高級的 AI 模型，對話品質更好
      maxResponseTokens: 400,             // AI 回復長度限制（tokens，約 200-250 個中文字，3-4 句完整回覆）
      maxMemoryTokens: 10000,             // 對話記憶容量（tokens）

      // 角色相關
      canCreateCharacters: true,
      maxCreatedCharacters: 3,            // 每月基礎額度 3 個角色（與 Free/VIP 相同）

      // 配對與搜尋
      dailyMatchLimit: -1,                // 無限配對
      advancedSearch: true,
      matchAdsToUnlock: 0,                // VVIP 不需要看廣告（無限配對）
      unlockedMatchesPerAd: 0,            // VVIP 不需要看廣告（無限配對）
      dailyMatchAdLimit: 0,               // VVIP 不需要看廣告（無限配對）

      // 廣告相關
      requireAds: true,                   // 需要看廣告解鎖額外對話
      adsToUnlock: 1,                     // 看 1 次廣告解鎖額外對話
      unlockedMessagesPerAd: 20,          // 每次廣告解鎖 20 次對話
      dailyAdLimitPerCharacter: 10,       // 每個角色每天最多看 10 次廣告

      // 解鎖票與卡片（開通時一次發放）
      characterUnlockCards: 30,           // 開通時送 30 張角色解鎖卡（用於解鎖與角色 7 天無限對話）
      characterCreationCards: 30,         // 開通時送 30 張創建角色卡（用於創建新角色）⭐
      photoUnlockCards: 60,               // 開通時送 60 張拍照解鎖卡
      videoUnlockCards: 10,               // 開通時送 10 張影片解鎖卡

      // AI 特殊功能
      aiPhotoGeneration: false,           // 需要使用解鎖卡或金幣
      aiVideoGeneration: false,           // 需要使用解鎖卡或金幣
      aiPhotoDiscount: 0,                 // AI 拍照無折扣
      aiVideoDiscount: 0,                 // AI 影片無折扣

      // 其他
      monthlyCoinsBonus: 2000,            // 開通時贈送 2000 金幣
      coinsDiscount: 0.2,                 // 金幣購買 8 折
    }
  }
};

/**
 * AI 特殊功能價格配置（金幣）
 */
export const AI_FEATURE_PRICES = {
  // AI 拍照功能
  aiPhoto: {
    id: "ai_photo",
    name: "AI 自拍照",
    description: "AI 為你的角色生成一張自拍照",
    basePrice: 50,                        // 基礎價格 50 金幣
    currency: "coins",
  },

  // AI 影片功能
  aiVideo: {
    id: "ai_video",
    name: "AI 影片",
    description: "AI 為你的角色生成一段短影片",
    basePrice: 200,                       // 基礎價格 200 金幣
    currency: "coins",
    estimatedDuration: 5,                 // 預計 5 秒影片
  },

  // 角色解鎖票（使用金幣購買）
  characterUnlockTicket: {
    id: "character_unlock_ticket",
    name: "角色解鎖票",
    description: "解鎖與特定角色 7 天無限對話",
    basePrice: 300,                       // 300 金幣
    currency: "coins",
    permanent: false,                     // 限時解鎖（7 天）
    duration: 7,                          // 7 天
  },
};

/**
 * 金幣充值方案
 */
export const COIN_PACKAGES = {
  small: {
    id: "coins_100",
    name: "100 金幣",
    coins: 100,
    bonus: 0,                             // 無贈送
    totalCoins: 100,
    price: 50,
    currency: "TWD",
  },
  medium: {
    id: "coins_500",
    name: "500 金幣",
    coins: 500,
    bonus: 50,                            // 贈送 50
    totalCoins: 550,
    price: 200,
    currency: "TWD",
    popular: false,
  },
  large: {
    id: "coins_1000",
    name: "1000 金幣",
    coins: 1000,
    bonus: 150,                           // 贈送 150
    totalCoins: 1150,
    price: 350,
    currency: "TWD",
    popular: true,                        // 推薦方案
  },
  xlarge: {
    id: "coins_3000",
    name: "3000 金幣",
    coins: 3000,
    bonus: 500,                           // 贈送 500
    totalCoins: 3500,
    price: 1000,
    currency: "TWD",
    bestValue: true,                      // 最超值
  },
};

/**
 * 廣告配置
 */
export const AD_CONFIG = {
  // 廣告提供商配置（範例）
  providers: {
    google: {
      id: "google_admob",
      name: "Google AdMob",
      enabled: true,
    },
  },

  // 廣告類型
  types: {
    rewardedAd: {
      id: "rewarded_ad",
      name: "獎勵廣告",
      reward: {
        type: "messages",
        amount: 5,                        // 獲得 5 次對話機會
      },
      cooldown: 300,                      // 冷卻時間 5 分鐘（秒）
    },

    interstitialAd: {
      id: "interstitial_ad",
      name: "插頁廣告",
      reward: {
        type: "messages",
        amount: 3,
      },
      cooldown: 600,                      // 10 分鐘
    },
  },

  // 每日廣告觀看上限
  dailyAdLimit: 10,                       // 免費用戶每天最多看 10 次廣告
};

/**
 * 根據會員等級取得價格（考慮折扣）
 */
export const getFeaturePrice = (featureId, membershipTier = "free") => {
  const feature = AI_FEATURE_PRICES[featureId];
  if (!feature) {
    throw new Error(`找不到功能：${featureId}`);
  }

  const tierConfig = MEMBERSHIP_TIERS[membershipTier];
  if (!tierConfig) {
    return feature.basePrice;
  }

  // 檢查是否有折扣
  let discount = 0;

  if (featureId === "aiPhoto" && tierConfig.features.aiPhotoDiscount) {
    discount = tierConfig.features.aiPhotoDiscount;
  } else if (featureId === "aiVideo" && tierConfig.features.aiVideoDiscount) {
    discount = tierConfig.features.aiVideoDiscount;
  }

  const finalPrice = Math.ceil(feature.basePrice * (1 - discount));

  return {
    basePrice: feature.basePrice,
    discount: discount,
    finalPrice: finalPrice,
    saved: feature.basePrice - finalPrice,
  };
};

/**
 * 檢查用戶是否有權限使用某功能
 */
export const hasFeatureAccess = (membershipTier, featureName) => {
  const tierConfig = MEMBERSHIP_TIERS[membershipTier];
  if (!tierConfig) {
    return MEMBERSHIP_TIERS.free.features[featureName] || false;
  }

  return tierConfig.features[featureName] || false;
};

export default {
  MEMBERSHIP_TIERS,
  AI_FEATURE_PRICES,
  COIN_PACKAGES,
  AD_CONFIG,
  getFeaturePrice,
  hasFeatureAccess,
};
