/**
 * 會員等級與權限配置
 *
 * ✅ 2025-11-30 更新：完整訂閱策略
 * - 新增 Lite 入門會員（99 TWD/月）
 * - VIP 調整為 299 TWD/月（原 399）
 * - VVIP 調整為 599 TWD/月（原 999）
 * - 支援月/季/年訂閱週期
 */

/**
 * 訂閱週期配置
 * 季訂閱約 16% 折扣，年訂閱約 33% 折扣
 */
export const BILLING_CYCLES = {
  monthly: {
    id: "monthly",
    name: "月訂閱",
    months: 1,
    discountRate: 0, // 無折扣
  },
  quarterly: {
    id: "quarterly",
    name: "季訂閱",
    months: 3,
    discountRate: 0.16, // 約 16% 折扣
  },
  yearly: {
    id: "yearly",
    name: "年訂閱",
    months: 12,
    discountRate: 0.33, // 約 33% 折扣
  },
};

/**
 * 訂閱方案價格表
 * 包含各等級在不同週期的具體價格
 */
export const SUBSCRIPTION_PRICES = {
  lite: {
    monthly: { price: 99, currency: "TWD" },
    quarterly: { price: 249, currency: "TWD" }, // 83/月, 16% off
    yearly: { price: 799, currency: "TWD" }, // 67/月, 32% off
  },
  vip: {
    monthly: { price: 299, currency: "TWD" },
    quarterly: { price: 749, currency: "TWD" }, // 250/月, 16% off
    yearly: { price: 2399, currency: "TWD" }, // 200/月, 33% off
  },
  vvip: {
    monthly: { price: 599, currency: "TWD" },
    quarterly: { price: 1499, currency: "TWD" }, // 500/月, 17% off
    yearly: { price: 4799, currency: "TWD" }, // 400/月, 33% off
  },
};

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
      monthlyPhotos: 0,                   // 遊客無 AI 照片額度
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
      monthlyPhotos: 3,                   // 每月 AI 照片 3 張（基礎額度）
      monthlyCoinsBonus: 0,               // 每月贈送金幣
      coinsDiscount: 0,                   // 金幣購買折扣（0 = 無折扣）
    }
  },

  /**
   * ✅ 2025-11-30 新增：Lite 入門會員
   * 目標：低門檻體驗付費服務，吸引免費用戶轉化
   */
  lite: {
    id: "lite",
    name: "Lite 入門會員",
    price: 99,                            // 月訂閱價格
    currency: "TWD",
    billingCycle: "monthly",
    features: {
      // 對話限制 - 比免費用戶提升
      messagesPerCharacter: 30,           // 每個角色 30 次對話（Free: 10）
      unlimitedChats: false,
      totalCharacters: -1,

      // 語音限制 - 比免費用戶提升
      voicesPerCharacter: 15,             // 每個角色 15 次語音播放（Free: 10）
      unlimitedVoice: false,

      // AI 設定
      aiModel: "gpt-4o-mini",
      maxResponseTokens: 180,             // 略長的回覆（Free: 150）
      maxMemoryTokens: 2000,              // 較大的記憶容量（Free: 1000）

      // 角色相關
      canCreateCharacters: true,
      maxCreatedCharacters: 3,

      // 配對與搜尋
      dailyMatchLimit: 10,                // 每日配對 10 次（Free: 5）
      advancedSearch: false,              // 無進階搜尋
      matchAdsToUnlock: 1,                // ✅ 可選擇看廣告解鎖配對
      unlockedMatchesPerAd: 2,            // 每次廣告解鎖 2 次配對
      dailyMatchAdLimit: 10,

      // ✅ 2025-12-03 修復：廣告相關 - 無強制廣告，但可選擇看廣告獲得額外次數
      requireAds: false,                  // 無強制廣告（主要賣點）
      adsToUnlock: 1,                     // ✅ 修復：可選擇看廣告解鎖
      unlockedMessagesPerAd: 8,           // ✅ 修復：每次廣告解鎖 8 次對話（與 limits.js 一致）
      dailyAdLimitPerCharacter: 10,       // ✅ 修復：每角色每天最多看 10 次廣告

      // 解鎖票與卡片 - 無贈送
      characterUnlockCards: 0,
      characterCreationCards: 0,
      photoUnlockCards: 0,
      videoUnlockCards: 0,

      // AI 特殊功能
      aiPhotoGeneration: false,           // 需金幣購買
      aiVideoGeneration: false,
      aiPhotoDiscount: 0.05,              // ✅ 2025-12-03 新增：AI 拍照 9.5 折
      aiVideoDiscount: 0.05,              // ✅ 2025-12-03 新增：AI 影片 9.5 折

      // 每月福利
      monthlyPhotos: 10,                  // 每月 AI 照片 10 張
      monthlyCoinsBonus: 0,               // 無金幣贈送
      coinsDiscount: 0.05,                // ✅ 2025-12-03 新增：金幣購買 9.5 折
    }
  },

  /**
   * ✅ 2025-11-30 更新：VIP 標準會員
   * 目標：主要付費用戶群，性價比最高
   * 價格調整：399 → 299 TWD/月
   */
  vip: {
    id: "vip",
    name: "VIP 標準會員",
    price: 299,                           // ✅ 調整：399 → 299
    currency: "TWD",
    billingCycle: "monthly",
    features: {
      // 對話限制 - 大幅提升
      messagesPerCharacter: 100,          // ✅ 每個角色 100 次對話（原 20）
      unlimitedChats: false,              // 需使用角色解鎖票才能無限對話
      totalCharacters: -1,

      // 語音限制 - 大幅提升
      voicesPerCharacter: 50,             // ✅ 每個角色 50 次語音（原無限）
      unlimitedVoice: false,              // ✅ 調整為有限制

      // AI 設定
      aiModel: "gpt-4o-mini",
      maxResponseTokens: 250,             // 較長的回覆
      maxMemoryTokens: 5000,              // 較大的記憶容量

      // 角色相關
      canCreateCharacters: true,
      maxCreatedCharacters: 5,            // ✅ 提升到 5 個（原 3）

      // 配對與搜尋
      dailyMatchLimit: 50,                // ✅ 提升到 50（原 30）
      advancedSearch: true,               // 進階搜尋功能
      matchAdsToUnlock: 1,                // ✅ 2025-12-03 修復：可選擇看廣告解鎖配對
      unlockedMatchesPerAd: 5,            // 每次廣告解鎖 5 次配對
      dailyMatchAdLimit: 10,

      // ✅ 2025-12-03 修復：廣告相關 - 無強制廣告，但可選擇看廣告獲得額外次數
      requireAds: false,                  // 無強制廣告
      adsToUnlock: 1,                     // ✅ 修復：可選擇看廣告解鎖
      unlockedMessagesPerAd: 10,          // ✅ 修復：每次廣告解鎖 10 次對話（與 limits.js 一致）
      dailyAdLimitPerCharacter: 10,       // 每角色每天最多看 10 次廣告

      // 每月贈送（訂閱期間每月發放）
      characterUnlockCards: 1,            // ✅ 每月贈送 1 張角色解鎖卡
      characterCreationCards: 0,
      photoUnlockCards: 0,
      videoUnlockCards: 0,

      // AI 特殊功能
      aiPhotoGeneration: false,           // 需金幣購買
      aiVideoGeneration: false,
      aiPhotoDiscount: 0.1,               // ✅ AI 拍照 9 折
      aiVideoDiscount: 0.1,               // ✅ AI 影片 9 折

      // 每月福利
      monthlyPhotos: 30,                  // ✅ 每月 AI 照片 30 張
      monthlyCoinsBonus: 0,               // 無金幣贈送
      coinsDiscount: 0.1,                 // 金幣購買 9 折

      // VIP 專屬
      prioritySupport: true,              // ✅ 優先客服支援
      vipBadge: true,                     // ✅ VIP 徽章
    }
  },

  /**
   * ✅ 2025-11-30 更新：VVIP 尊貴會員
   * 目標：高價值用戶，幾乎無限制的極致體驗
   * 價格調整：999 → 599 TWD/月
   */
  vvip: {
    id: "vvip",
    name: "VVIP 尊貴會員",
    price: 599,                           // ✅ 調整：999 → 599
    currency: "TWD",
    billingCycle: "monthly",
    features: {
      // 對話限制 - ✅ 2025-12-03 調整：設定合理上限避免成本失控
      messagesPerCharacter: 500,          // ✅ 每角色 500 次/日（原無限）
      unlimitedChats: false,              // ✅ 調整為有限制
      totalCharacters: -1,

      // 語音限制 - ✅ 2025-12-03 調整：設定合理上限
      voicesPerCharacter: 200,            // ✅ 每角色 200 次/日（原無限）
      unlimitedVoice: false,              // ✅ 調整為有限制

      // AI 設定 - 高級配置
      aiModel: "gpt-4o-mini",             // 使用最新模型
      maxResponseTokens: 400,             // 更長的回覆
      maxMemoryTokens: 10000,             // 超大記憶容量

      // 角色相關
      canCreateCharacters: true,
      maxCreatedCharacters: 10,           // ✅ 提升到 10 個（原 3）

      // 配對與搜尋 - ✅ 2025-12-03 調整：設定合理上限
      dailyMatchLimit: 100,               // ✅ 每日 100 次配對（原無限）
      advancedSearch: true,
      matchAdsToUnlock: 1,                // ✅ 2025-12-03 修復：可選擇看廣告解鎖配對
      unlockedMatchesPerAd: 10,           // 每次廣告解鎖 10 次配對
      dailyMatchAdLimit: 10,

      // ✅ 2025-12-03 修復：廣告相關 - 無強制廣告，但可選擇看廣告獲得額外次數
      requireAds: false,                  // 無強制廣告
      adsToUnlock: 1,                     // ✅ 修復：可選擇看廣告解鎖
      unlockedMessagesPerAd: 20,          // ✅ 修復：每次廣告解鎖 20 次對話（與 limits.js 一致）
      dailyAdLimitPerCharacter: 10,       // 每角色每天最多看 10 次廣告

      // 每月贈送（訂閱期間每月發放）
      characterUnlockCards: 3,            // ✅ 每月贈送 3 張角色解鎖卡
      characterCreationCards: 0,
      photoUnlockCards: 0,
      videoUnlockCards: 0,

      // AI 特殊功能
      aiPhotoGeneration: false,           // 需金幣購買（但有折扣）
      aiVideoGeneration: false,
      aiPhotoDiscount: 0.2,               // ✅ AI 拍照 8 折
      aiVideoDiscount: 0.2,               // ✅ AI 影片 8 折

      // 每月福利
      monthlyPhotos: 100,                 // ✅ 每月 AI 照片 100 張
      monthlyCoinsBonus: 100,             // ✅ 每月贈送 100 金幣
      coinsDiscount: 0.2,                 // 金幣購買 8 折

      // VVIP 專屬特權
      prioritySupport: true,              // 專屬客服（24 小時內回覆）
      vvipBadge: true,                    // ✅ VVIP 徽章
      earlyAccess: true,                  // ✅ 新功能搶先體驗
      exclusiveCharacters: true,          // ✅ 獨家角色優先解鎖
    }
  }
};

/**
 * AI 特殊功能價格配置（金幣）
 *
 * ✅ 2025-11-30 更新：降低價格提高轉化率
 * - AI 照片：50 → 25 金幣（成本 ~4 金幣，利潤 84%）
 * - AI 影片：200 → 60 金幣（成本 ~12 金幣，利潤 80%）
 * - 7天解鎖：300 → 100 金幣（讓用戶願意嘗試）
 * - 新增永久解鎖選項：250 金幣
 */
export const AI_FEATURE_PRICES = {
  // AI 拍照功能
  aiPhoto: {
    id: "ai_photo",
    name: "AI 自拍照",
    description: "AI 為你的角色生成一張自拍照",
    basePrice: 25,                        // ✅ 降價：50 → 25 金幣
    currency: "coins",
  },

  // AI 影片功能
  aiVideo: {
    id: "ai_video",
    name: "AI 影片",
    description: "AI 為你的角色生成一段短影片",
    basePrice: 60,                        // ✅ 降價：200 → 60 金幣
    currency: "coins",
    estimatedDuration: 5,                 // 預計 5 秒影片
  },

  // 角色解鎖票 - 7天限時（使用金幣購買）
  characterUnlockTicket: {
    id: "character_unlock_ticket",
    name: "7天解鎖券",
    description: "解鎖與特定角色 7 天無限對話",
    basePrice: 100,                       // ✅ 降價：300 → 100 金幣
    currency: "coins",
    permanent: false,                     // 限時解鎖（7 天）
    duration: 7,                          // 7 天
  },

  // ✅ 2025-11-30 新增：永久解鎖
  characterUnlockPermanent: {
    id: "character_unlock_permanent",
    name: "永久解鎖券",
    description: "永久解鎖與特定角色的無限對話",
    basePrice: 250,                       // 250 金幣（約 55 TWD）
    currency: "coins",
    permanent: true,                      // 永久解鎖
    duration: -1,                         // 永久
  },
};

/**
 * 金幣充值方案
 *
 * ✅ 2025-11-30 更新：降低入門門檻，提高付費轉化率
 * - 新增 10 TWD 試用包，降低首次付費心理門檻
 * - 整體金幣成本降低 30-40%，讓用戶覺得「值得」
 * - 金幣單價：0.33 → 0.165 TWD（隨套餐遞減）
 */
export const COIN_PACKAGES = {
  starter: {
    id: "coins_30",
    name: "30 金幣",
    coins: 30,
    bonus: 0,
    totalCoins: 30,
    price: 10,                            // 10 TWD
    currency: "TWD",
    order: 1,
  },
  small: {
    id: "coins_100",
    name: "110 金幣",
    coins: 100,
    bonus: 10,
    totalCoins: 110,
    price: 30,                            // 30 TWD
    currency: "TWD",
    order: 2,
  },
  medium: {
    id: "coins_300",
    name: "360 金幣",
    coins: 300,
    bonus: 60,
    totalCoins: 360,
    price: 80,                            // 80 TWD
    currency: "TWD",
    popular: true,
    order: 3,
  },
  large: {
    id: "coins_600",
    name: "750 金幣",
    coins: 600,
    bonus: 150,
    totalCoins: 750,
    price: 150,                           // 150 TWD
    currency: "TWD",
    order: 4,
  },
  xlarge: {
    id: "coins_1500",
    name: "2000 金幣",
    coins: 1500,
    bonus: 500,
    totalCoins: 2000,
    price: 330,                           // 330 TWD
    currency: "TWD",
    bestValue: true,
    order: 5,
  },
};

/**
 * ✅ 2025-11-30 新增：組合禮包
 * 包含金幣 + 解鎖卡的超值組合，讓用戶一次購買多種道具
 *
 * 定價策略：
 * - 禮包價格 < 單買總價（約 8 折優惠）
 * - 讓用戶覺得「買禮包比較划算」
 */
/**
 * 組合禮包配置
 *
 * purchaseLimit 限購類型：
 * - "once": 終身限購 1 次（新手禮包）
 * - "monthly": 每月限購 1 次（月度重置）
 * - "weekly": 每週限購 1 次（週度重置）
 * - "none" 或 undefined: 無限制
 */
export const BUNDLE_PACKAGES = {
  starter_bundle: {
    id: "bundle_starter",
    name: "新手禮包",
    description: "新手入門必備，體驗所有功能",
    price: 99,
    currency: "TWD",
    order: 1,
    contents: {
      coins: 100,                         // 100 金幣（價值 ~27 TWD）
      photoUnlockCards: 3,                // 3 張照片卡（價值 75 金幣 = ~17 TWD）
      characterUnlockCards: 1,            // 1 張 7 天解鎖券（價值 100 金幣 = ~22 TWD）
    },
    // 單買總價值：~66 TWD，禮包 99 TWD 但多送東西
    badge: "🌟 限購一次",
    popular: true,
    purchaseLimit: "once",                // ✅ 終身限購 1 次
  },
  value_bundle: {
    id: "bundle_value",
    name: "月度禮包",
    description: "每月限定，重度用戶首選",
    price: 299,
    currency: "TWD",
    order: 2,
    contents: {
      coins: 500,                         // 500 金幣（價值 ~110 TWD）
      photoUnlockCards: 10,               // 10 張照片卡（價值 250 金幣）
      videoUnlockCards: 3,                // 3 張影片卡（價值 180 金幣）
      characterUnlockCards: 3,            // 3 張 7 天解鎖券（價值 300 金幣）
    },
    badge: "🔥 每月限購",
    purchaseLimit: "monthly",             // ✅ 每月限購 1 次
  },
  premium_bundle: {
    id: "bundle_premium",
    name: "尊榮禮包",
    description: "最划算的頂級組合",
    price: 599,
    currency: "TWD",
    order: 3,
    contents: {
      coins: 1500,                        // 1500 金幣
      photoUnlockCards: 30,               // 30 張照片卡
      videoUnlockCards: 10,               // 10 張影片卡
      characterUnlockCards: 5,            // 5 張 7 天解鎖券
      characterCreationCards: 2,          // 2 張角色創建卡
    },
    badge: "💎 最超值",
    bestValue: true,
    purchaseLimit: "none",                // ✅ 無限制
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

/**
 * 獲取訂閱價格
 * @param {string} tier - 會員等級 (lite, vip, vvip)
 * @param {string} cycle - 訂閱週期 (monthly, quarterly, yearly)
 * @returns {Object} 價格信息
 */
export const getSubscriptionPrice = (tier, cycle = "monthly") => {
  const tierPrices = SUBSCRIPTION_PRICES[tier];
  if (!tierPrices) {
    throw new Error(`找不到會員等級：${tier}`);
  }

  const cyclePrice = tierPrices[cycle];
  if (!cyclePrice) {
    throw new Error(`找不到訂閱週期：${cycle}`);
  }

  const cycleConfig = BILLING_CYCLES[cycle];
  const monthlyEquivalent = Math.round(cyclePrice.price / cycleConfig.months);
  const baseMonthlyPrice = tierPrices.monthly.price;
  const actualDiscount = Math.round((1 - monthlyEquivalent / baseMonthlyPrice) * 100);

  return {
    ...cyclePrice,
    tier,
    cycle,
    months: cycleConfig.months,
    monthlyEquivalent,
    discountPercent: actualDiscount,
    savings: baseMonthlyPrice * cycleConfig.months - cyclePrice.price,
  };
};

/**
 * 獲取所有訂閱方案（用於前端展示）
 */
export const getAllSubscriptionPlans = () => {
  const plans = [];

  for (const tier of ["lite", "vip", "vvip"]) {
    const tierConfig = MEMBERSHIP_TIERS[tier];
    for (const cycle of ["monthly", "quarterly", "yearly"]) {
      const priceInfo = getSubscriptionPrice(tier, cycle);
      plans.push({
        id: `${tier}_${cycle}`,
        tier,
        tierName: tierConfig.name,
        cycle,
        cycleName: BILLING_CYCLES[cycle].name,
        ...priceInfo,
        features: tierConfig.features,
      });
    }
  }

  return plans;
};

export default {
  MEMBERSHIP_TIERS,
  AI_FEATURE_PRICES,
  COIN_PACKAGES,
  BUNDLE_PACKAGES,                      // ✅ 新增：組合禮包
  AD_CONFIG,
  BILLING_CYCLES,
  SUBSCRIPTION_PRICES,
  getFeaturePrice,
  hasFeatureAccess,
  getSubscriptionPrice,
  getAllSubscriptionPlans,
};
