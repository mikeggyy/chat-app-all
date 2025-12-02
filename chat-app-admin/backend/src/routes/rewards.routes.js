import express from "express";
import { db } from "../firebase/index.js";
import { requireMinRole, requireRole } from "../middleware/admin.middleware.js";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

// 預設獎勵配置（當 Firestore 中沒有配置時使用）
const DEFAULT_DAILY_REWARDS = [
  { day: 1, coins: 5, description: "每日獎勵" },
  { day: 2, coins: 5, description: "每日獎勵" },
  { day: 3, coins: 10, description: "第三天驚喜" },
  { day: 4, coins: 5, description: "每日獎勵" },
  { day: 5, coins: 10, description: "第五天驚喜" },
  { day: 6, coins: 15, description: "週末前奏" },
  { day: 7, coins: 30, description: "週獎勵", highlight: true },
];

const DEFAULT_STREAK_MILESTONES = [
  {
    days: 7,
    rewards: { coins: 20 },
    title: "一週達成",
    description: "連續登入 7 天",
    badge: "🎯",
  },
  {
    days: 14,
    rewards: { coins: 0, photoUnlockCards: 1 },
    title: "兩週達成",
    description: "連續登入 14 天",
    badge: "⭐",
  },
  {
    days: 30,
    rewards: { coins: 50, characterUnlockCards: 1 },
    title: "月度達成",
    description: "連續登入 30 天",
    badge: "🏆",
  },
  {
    days: 60,
    rewards: { coins: 100 },
    title: "雙月達成",
    description: "連續登入 60 天",
    badge: "💎",
  },
  {
    days: 90,
    rewards: { coins: 200, photoUnlockCards: 3, characterUnlockCards: 1 },
    title: "傳奇達成",
    description: "連續登入 90 天",
    badge: "👑",
    isLegendary: true,
  },
];

const DEFAULT_FIRST_PURCHASE_OFFER = {
  id: "first_purchase_special",
  name: "新手首儲禮包",
  description: "限時首儲，超值優惠只給新朋友",
  price: 99,
  originalPrice: 299,
  currency: "TWD",
  discount: "67%",
  contents: {
    coins: 300,
    photoUnlockCards: 5,
    characterUnlockCards: 1,
  },
  badge: "🎁 限時首儲",
  validDays: 7,
  purchaseLimit: "first_purchase",
  enabled: true,
};

const DEFAULT_RETURNING_USER_OFFER = {
  id: "returning_user_special",
  name: "回歸禮包",
  description: "歡迎回來！專屬老朋友的超值優惠",
  price: 149,
  originalPrice: 399,
  currency: "TWD",
  discount: "63%",
  contents: {
    coins: 500,
    photoUnlockCards: 8,
    characterUnlockCards: 2,
    videoUnlockCards: 1,
  },
  badge: "🎊 回歸限定",
  inactiveDays: 7,      // 多少天未登入算回歸用戶
  validHours: 48,       // 優惠有效時間（小時）
  enabled: true,
};

/**
 * GET /api/rewards/config
 * 獲取所有獎勵配置
 * 🔒 權限：moderator 以上
 */
router.get("/config", requireMinRole("moderator"), async (req, res) => {
  try {
    const configRef = db.collection("reward_configs");

    // 獲取每日獎勵配置
    const dailyRewardsDoc = await configRef.doc("daily_rewards").get();
    const dailyRewards = dailyRewardsDoc.exists
      ? dailyRewardsDoc.data().rewards
      : DEFAULT_DAILY_REWARDS;

    // 獲取里程碑配置
    const milestonesDoc = await configRef.doc("streak_milestones").get();
    const streakMilestones = milestonesDoc.exists
      ? milestonesDoc.data().milestones
      : DEFAULT_STREAK_MILESTONES;

    // 獲取首購優惠配置
    const firstPurchaseDoc = await configRef.doc("first_purchase_offer").get();
    const firstPurchaseOffer = firstPurchaseDoc.exists
      ? firstPurchaseDoc.data()
      : DEFAULT_FIRST_PURCHASE_OFFER;

    // 獲取回歸用戶優惠配置
    const returningUserDoc = await configRef.doc("returning_user_offer").get();
    const returningUserOffer = returningUserDoc.exists
      ? returningUserDoc.data()
      : DEFAULT_RETURNING_USER_OFFER;

    res.json({
      dailyRewards,
      streakMilestones,
      firstPurchaseOffer,
      returningUserOffer,
      // 標記是否使用預設值
      isUsingDefaults: {
        dailyRewards: !dailyRewardsDoc.exists,
        streakMilestones: !milestonesDoc.exists,
        firstPurchaseOffer: !firstPurchaseDoc.exists,
        returningUserOffer: !returningUserDoc.exists,
      },
    });
  } catch (error) {
    console.error("獲取獎勵配置失敗:", error);
    res.status(500).json({ error: "獲取獎勵配置失敗" });
  }
});

/**
 * PUT /api/rewards/config/daily
 * 更新每日登入獎勵配置
 * 🔒 權限：super_admin（影響用戶獎勵，敏感操作）
 */
router.put("/config/daily", requireRole("super_admin"), async (req, res) => {
  try {
    const { rewards } = req.body;

    // 驗證輸入
    if (!Array.isArray(rewards) || rewards.length !== 7) {
      return res.status(400).json({ error: "每日獎勵必須包含 7 天的配置" });
    }

    // 驗證每天的配置
    for (const reward of rewards) {
      if (
        typeof reward.day !== "number" ||
        reward.day < 1 ||
        reward.day > 7 ||
        typeof reward.coins !== "number" ||
        reward.coins < 0 ||
        typeof reward.description !== "string"
      ) {
        return res.status(400).json({
          error: "每日獎勵配置格式錯誤",
          details: "每天必須包含 day(1-7)、coins(>=0)、description"
        });
      }
    }

    // 排序確保順序正確
    const sortedRewards = [...rewards].sort((a, b) => a.day - b.day);

    await db.collection("reward_configs").doc("daily_rewards").set({
      rewards: sortedRewards,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid,
    });

    res.json({
      message: "每日登入獎勵配置更新成功",
      rewards: sortedRewards,
    });
  } catch (error) {
    console.error("更新每日獎勵配置失敗:", error);
    res.status(500).json({ error: "更新每日獎勵配置失敗" });
  }
});

/**
 * PUT /api/rewards/config/milestones
 * 更新里程碑獎勵配置
 * 🔒 權限：super_admin
 */
router.put("/config/milestones", requireRole("super_admin"), async (req, res) => {
  try {
    const { milestones } = req.body;

    // 驗證輸入
    if (!Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ error: "里程碑獎勵配置不能為空" });
    }

    // 驗證每個里程碑
    for (const milestone of milestones) {
      if (
        typeof milestone.days !== "number" ||
        milestone.days < 1 ||
        typeof milestone.title !== "string" ||
        !milestone.title ||
        typeof milestone.description !== "string" ||
        typeof milestone.badge !== "string" ||
        typeof milestone.rewards !== "object"
      ) {
        return res.status(400).json({
          error: "里程碑配置格式錯誤",
          details: "每個里程碑必須包含 days、title、description、badge、rewards"
        });
      }
    }

    // 排序確保順序正確（按天數升序）
    const sortedMilestones = [...milestones].sort((a, b) => a.days - b.days);

    await db.collection("reward_configs").doc("streak_milestones").set({
      milestones: sortedMilestones,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid,
    });

    res.json({
      message: "里程碑獎勵配置更新成功",
      milestones: sortedMilestones,
    });
  } catch (error) {
    console.error("更新里程碑配置失敗:", error);
    res.status(500).json({ error: "更新里程碑配置失敗" });
  }
});

/**
 * PUT /api/rewards/config/first-purchase
 * 更新首購優惠配置
 * 🔒 權限：super_admin
 */
router.put("/config/first-purchase", requireRole("super_admin"), async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      originalPrice,
      discount,
      contents,
      badge,
      validDays,
      enabled,
    } = req.body;

    // 驗證必要字段
    if (
      typeof name !== "string" || !name ||
      typeof price !== "number" || price < 0 ||
      typeof originalPrice !== "number" || originalPrice < price ||
      typeof contents !== "object" ||
      typeof validDays !== "number" || validDays < 1
    ) {
      return res.status(400).json({
        error: "首購優惠配置格式錯誤",
        details: "請檢查所有必填字段是否正確"
      });
    }

    const configData = {
      id: "first_purchase_special",
      name,
      description: description || "",
      price,
      originalPrice,
      currency: "TWD",
      discount: discount || `${Math.round((1 - price / originalPrice) * 100)}%`,
      contents: {
        coins: contents.coins || 0,
        photoUnlockCards: contents.photoUnlockCards || 0,
        characterUnlockCards: contents.characterUnlockCards || 0,
      },
      badge: badge || "🎁 限時首儲",
      validDays,
      purchaseLimit: "first_purchase",
      enabled: enabled !== false,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid,
    };

    await db.collection("reward_configs").doc("first_purchase_offer").set(configData);

    res.json({
      message: "首購優惠配置更新成功",
      config: configData,
    });
  } catch (error) {
    console.error("更新首購優惠配置失敗:", error);
    res.status(500).json({ error: "更新首購優惠配置失敗" });
  }
});

/**
 * PUT /api/rewards/config/returning-user
 * 更新回歸用戶優惠配置
 * 🔒 權限：super_admin
 */
router.put("/config/returning-user", requireRole("super_admin"), async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      originalPrice,
      discount,
      contents,
      badge,
      inactiveDays,
      validHours,
      enabled,
    } = req.body;

    // 驗證必要字段
    if (
      typeof name !== "string" || !name ||
      typeof price !== "number" || price < 0 ||
      typeof originalPrice !== "number" || originalPrice < price ||
      typeof contents !== "object" ||
      typeof inactiveDays !== "number" || inactiveDays < 1 ||
      typeof validHours !== "number" || validHours < 1
    ) {
      return res.status(400).json({
        error: "回歸用戶優惠配置格式錯誤",
        details: "請檢查所有必填字段是否正確"
      });
    }

    const configData = {
      id: "returning_user_special",
      name,
      description: description || "",
      price,
      originalPrice,
      currency: "TWD",
      discount: discount || `${Math.round((1 - price / originalPrice) * 100)}%`,
      contents: {
        coins: contents.coins || 0,
        photoUnlockCards: contents.photoUnlockCards || 0,
        characterUnlockCards: contents.characterUnlockCards || 0,
        videoUnlockCards: contents.videoUnlockCards || 0,
      },
      badge: badge || "🎊 回歸限定",
      inactiveDays,
      validHours,
      enabled: enabled !== false,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid,
    };

    await db.collection("reward_configs").doc("returning_user_offer").set(configData);

    res.json({
      message: "回歸用戶優惠配置更新成功",
      config: configData,
    });
  } catch (error) {
    console.error("更新回歸用戶優惠配置失敗:", error);
    res.status(500).json({ error: "更新回歸用戶優惠配置失敗" });
  }
});

/**
 * POST /api/rewards/config/reset
 * 重置獎勵配置為預設值
 * 🔒 權限：super_admin
 */
router.post("/config/reset", requireRole("super_admin"), async (req, res) => {
  try {
    const { type } = req.body; // "daily" | "milestones" | "first-purchase" | "returning-user" | "all"

    const batch = db.batch();
    const configRef = db.collection("reward_configs");
    const timestamp = FieldValue.serverTimestamp();
    const updatedBy = req.user.uid;

    if (type === "daily" || type === "all") {
      batch.set(configRef.doc("daily_rewards"), {
        rewards: DEFAULT_DAILY_REWARDS,
        updatedAt: timestamp,
        updatedBy,
        resetToDefault: true,
      });
    }

    if (type === "milestones" || type === "all") {
      batch.set(configRef.doc("streak_milestones"), {
        milestones: DEFAULT_STREAK_MILESTONES,
        updatedAt: timestamp,
        updatedBy,
        resetToDefault: true,
      });
    }

    if (type === "first-purchase" || type === "all") {
      batch.set(configRef.doc("first_purchase_offer"), {
        ...DEFAULT_FIRST_PURCHASE_OFFER,
        updatedAt: timestamp,
        updatedBy,
        resetToDefault: true,
      });
    }

    if (type === "returning-user" || type === "all") {
      batch.set(configRef.doc("returning_user_offer"), {
        ...DEFAULT_RETURNING_USER_OFFER,
        updatedAt: timestamp,
        updatedBy,
        resetToDefault: true,
      });
    }

    await batch.commit();

    res.json({
      message: `獎勵配置已重置為預設值`,
      resetType: type,
    });
  } catch (error) {
    console.error("重置獎勵配置失敗:", error);
    res.status(500).json({ error: "重置獎勵配置失敗" });
  }
});

/**
 * GET /api/rewards/stats
 * 獲取獎勵統計數據
 * 🔒 權限：moderator 以上
 *
 * 注意：由於 collectionGroup 查詢需要特定索引，這裡使用簡化的統計方式
 * 實際統計數據可能需要透過 Cloud Functions 或定期任務來計算
 */
router.get("/stats", requireMinRole("moderator"), async (req, res) => {
  try {
    // 獲取台灣時區的今日日期
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayStr = taiwanTime.toISOString().split("T")[0];

    // 由於 collectionGroup 需要索引，先返回基本統計
    // 後續可以建立索引後再啟用完整統計
    let todayClaims = 0;
    let totalUsers = 0;
    const milestoneStats = {};

    try {
      // 嘗試使用 collectionGroup 查詢（需要索引）
      // 集合路徑: users/{userId}/rewards/login_streak
      const todayClaimsSnapshot = await db.collectionGroup("rewards")
        .where("lastClaimDate", "==", todayStr)
        .count()
        .get();
      todayClaims = todayClaimsSnapshot.data().count;

      const totalClaimsSnapshot = await db.collectionGroup("rewards")
        .count()
        .get();
      totalUsers = totalClaimsSnapshot.data().count;
    } catch (indexError) {
      // 如果索引不存在，記錄錯誤但不中斷
      console.warn("獎勵統計查詢需要 Firestore 索引:", indexError.message);
      // 返回 0 作為預設值
    }

    // 里程碑統計暫時返回空對象（需要建立複合索引）
    for (const milestone of DEFAULT_STREAK_MILESTONES) {
      milestoneStats[`${milestone.days}days`] = 0;
    }

    res.json({
      todayClaims,
      totalUsers,
      milestoneStats,
      generatedAt: new Date().toISOString(),
      note: "統計數據可能需要建立 Firestore 索引後才能正確顯示",
    });
  } catch (error) {
    console.error("獲取獎勵統計失敗:", error);
    res.status(500).json({ error: "獲取獎勵統計失敗", details: error.message });
  }
});

export default router;
