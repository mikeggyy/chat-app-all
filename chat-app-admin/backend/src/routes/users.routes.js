import express from "express";
import { db, auth, FieldValue } from "../firebase/index.js";
import { requireRole, requireMinRole } from "../middleware/admin.middleware.js";

// Service imports
import { updateUser } from "../services/user/user.service.js";
import { getUserPotions } from "../services/potions/potion.util.js";
import { updateUsageLimits, cleanNullKeys } from "../services/limits/usage-limits.service.js";
import { addOrRemovePotions } from "../services/potions/potion.service.js";
import { setInventory } from "../services/potions/potion-inventory.service.js";
import { getEffects, addEffect, updateEffect, deleteEffect } from "../services/potions/potion-effects.service.js";
import { deleteImages } from "../storage/r2Storage.service.js";

const router = express.Router();

/**
 * GET /api/users
 * 獲取用戶列表（從 Firebase Auth 和 Firestore 合併數據）
 */
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    let allUsers = [];
    let total = 0;

    if (search) {
      // 有搜索條件：需要獲取更多用戶來搜索（限制最多 5000 個）
      let nextPageToken;
      let fetchedCount = 0;
      const maxFetch = 5000;

      do {
        const listUsersResult = await auth.listUsers(1000, nextPageToken);
        allUsers = allUsers.concat(listUsersResult.users);
        fetchedCount += listUsersResult.users.length;
        nextPageToken = listUsersResult.pageToken;
      } while (nextPageToken && fetchedCount < maxFetch);

      // 搜索過濾
      const searchLower = search.toLowerCase();
      allUsers = allUsers.filter(user =>
        (user.email && user.email.toLowerCase().includes(searchLower)) ||
        (user.uid && user.uid.toLowerCase().includes(searchLower)) ||
        (user.displayName && user.displayName.toLowerCase().includes(searchLower))
      );
      total = allUsers.length;
    } else {
      // 無搜索條件：只獲取需要的頁數
      const maxResults = pageNum * limitNum;
      let nextPageToken;

      do {
        const fetchSize = Math.min(1000, maxResults - allUsers.length);
        const listUsersResult = await auth.listUsers(fetchSize, nextPageToken);
        allUsers = allUsers.concat(listUsersResult.users);
        nextPageToken = listUsersResult.pageToken;
      } while (nextPageToken && allUsers.length < maxResults);

      // 預估總數（實際可能更多）
      total = nextPageToken ? allUsers.length + 1000 : allUsers.length;
    }

    // 分頁
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedUsers = allUsers.slice(startIndex, startIndex + limitNum);

    // 合併 Firestore 數據
    const usersWithData = await Promise.all(
      paginatedUsers.map(async (authUser) => {
        try {
          const userDoc = await db.collection("users").doc(authUser.uid).get();
          const userData = userDoc.exists ? userDoc.data() : {};

          // 獲取使用限制數據（對話次數、語音次數、拍照次數等）
          const limitsDoc = await db.collection("usage_limits").doc(authUser.uid).get();
          const limitsData = limitsDoc.exists ? limitsDoc.data() : {};

          // 計算總對話次數
          let totalConversationCount = 0;
          let conversationCharacters = 0;
          if (limitsData.conversation) {
            Object.values(limitsData.conversation).forEach(char => {
              totalConversationCount += char.count || 0;
            });
            conversationCharacters = Object.keys(limitsData.conversation).length;
          }

          // 計算總語音使用次數
          let totalVoiceCount = 0;
          let voiceCharacters = 0;
          if (limitsData.voice) {
            Object.values(limitsData.voice).forEach(char => {
              totalVoiceCount += char.count || 0;
            });
            voiceCharacters = Object.keys(limitsData.voice).length;
          }

          // 獲取角色創建統計（使用 character_creation 或其他可能的字段名）
          const characterCreationData = limitsData.character_creation || limitsData.characterCreation || {};

          // 獲取藥水數據
          const potions = await getUserPotions(authUser.uid);

          return {
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName || userData.displayName || "未設置",
            emailVerified: authUser.emailVerified,
            disabled: authUser.disabled,
            createdAt: authUser.metadata.creationTime,
            lastSignInTime: authUser.metadata.lastSignInTime,

            // 基本資料
            photoURL: userData.photoURL || authUser.photoURL,
            gender: userData.gender || null,
            locale: userData.locale || "zh-TW",

            // 會員資訊
            membershipTier: userData.membershipTier || "free",
            membershipStatus: userData.membershipStatus || null,
            membershipStartedAt: userData.membershipStartedAt || null,
            membershipExpiresAt: userData.membershipExpiresAt || null,
            membershipAutoRenew: userData.membershipAutoRenew || false,

            // 錢包與資產（優先使用 walletBalance 頂層字段）
            walletBalance: userData.walletBalance || userData.wallet?.balance || 0,
            coins: userData.walletBalance || userData.wallet?.balance || userData.coins || 0,
            assets: {
              characterUnlockCards: userData.assets?.characterUnlockCards || 0,
              photoUnlockCards: userData.assets?.photoUnlockCards || 0,
              videoUnlockCards: userData.assets?.videoUnlockCards || 0,
              voiceUnlockCards: userData.assets?.voiceUnlockCards || 0,
              createCards: userData.assets?.createCards || 0,
            },

            // 藥水數據
            potions,

            // 使用統計（增強版）
            usageStats: {
              totalConversations: totalConversationCount,
              conversationCharacters,
              photosUsed: limitsData.photos?.count || 0,
              photosLifetime: limitsData.photos?.lifetimeCount || 0,
              totalVoiceUsed: totalVoiceCount,
              voiceCharacters,
              characterCreations: characterCreationData.count || 0,
              characterCreationsLifetime: characterCreationData.lifetimeCount || 0,
            },

            // 詳細使用限制數據
            usageLimits: {
              photos: limitsData.photos || null,
              conversation: limitsData.conversation || {},
              voice: limitsData.voice || {},
              characterCreation: characterCreationData,
            },

            // 其他
            favorites: userData.favorites || [],
            conversations: userData.conversations || [],
            customClaims: authUser.customClaims || {},
          };
        } catch (error) {
          return {
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName || "未設置",
            emailVerified: authUser.emailVerified,
            disabled: authUser.disabled,
            createdAt: authUser.metadata.creationTime,
            lastSignInTime: authUser.metadata.lastSignInTime,
            photoURL: null,
            gender: null,
            locale: "zh-TW",
            membershipTier: "free",
            membershipStatus: null,
            membershipStartedAt: null,
            membershipExpiresAt: null,
            membershipAutoRenew: false,
            coins: 0,
            walletBalance: 0,
            assets: {
              characterUnlockCards: 0,
              photoUnlockCards: 0,
              videoUnlockCards: 0,
              voiceUnlockCards: 0,
              createCards: 0,
            },
            potions: {
              inventory: { memoryBoost: 0, brainBoost: 0 },
              activeEffects: [],
              totalActive: { memoryBoost: 0, brainBoost: 0 },
            },
            usageStats: {
              totalConversations: 0,
              photosUsed: 0,
            },
            favorites: [],
            conversations: [],
            customClaims: authUser.customClaims || {},
          };
        }
      })
    );

    res.json({
      users: usersWithData,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    res.status(500).json({ error: "獲取用戶列表失敗", message: error.message });
  }
});

/**
 * GET /api/users/:userId
 * 獲取單個用戶詳情
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // 從 Firebase Auth 獲取用戶
    const authUser = await auth.getUser(userId);

    // 從 Firestore 獲取用戶數據
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // 獲取使用限制數據
    const limitsDoc = await db.collection("usage_limits").doc(userId).get();
    const limitsData = limitsDoc.exists ? limitsDoc.data() : {};

    // 計算總對話次數
    let totalConversationCount = 0;
    let conversationCharacters = 0;
    if (limitsData.conversation) {
      Object.values(limitsData.conversation).forEach(char => {
        totalConversationCount += char.count || 0;
      });
      conversationCharacters = Object.keys(limitsData.conversation).length;
    }

    // 計算總語音使用次數
    let totalVoiceCount = 0;
    let voiceCharacters = 0;
    if (limitsData.voice) {
      Object.values(limitsData.voice).forEach(char => {
        totalVoiceCount += char.count || 0;
      });
      voiceCharacters = Object.keys(limitsData.voice).length;
    }

    // 獲取角色創建統計
    const characterCreationData = limitsData.character_creation || limitsData.characterCreation || {};

    // 獲取藥水數據
    const potions = await getUserPotions(userId);

    res.json({
      uid: authUser.uid,
      email: authUser.email,
      displayName: authUser.displayName || userData.displayName,
      emailVerified: authUser.emailVerified,
      disabled: authUser.disabled,

      // 基本資料
      photoURL: userData.photoURL || authUser.photoURL,
      gender: userData.gender || null,
      locale: userData.locale || "zh-TW",

      // 會員資訊
      membershipTier: userData.membershipTier || "free",
      membershipStatus: userData.membershipStatus || null,
      membershipStartedAt: userData.membershipStartedAt || null,
      membershipExpiresAt: userData.membershipExpiresAt || null,
      membershipAutoRenew: userData.membershipAutoRenew || false,

      // 錢包與資產（優先使用 walletBalance 頂層字段）
      walletBalance: userData.walletBalance || userData.wallet?.balance || 0,
      coins: userData.walletBalance || userData.wallet?.balance || userData.coins || 0,
      assets: {
        characterUnlockCards: userData.assets?.characterUnlockCards || 0,
        photoUnlockCards: userData.assets?.photoUnlockCards || 0,
        videoUnlockCards: userData.assets?.videoUnlockCards || 0,
        voiceUnlockCards: userData.assets?.voiceUnlockCards || 0,
        createCards: userData.assets?.createCards || 0,
      },

      // 藥水數據
      potions,

      // 使用統計（增強版）
      usageStats: {
        totalConversations: totalConversationCount,
        conversationCharacters,
        photosUsed: limitsData.photos?.count || 0,
        photosLifetime: limitsData.photos?.lifetimeCount || 0,
        totalVoiceUsed: totalVoiceCount,
        voiceCharacters,
        characterCreations: characterCreationData.count || 0,
        characterCreationsLifetime: characterCreationData.lifetimeCount || 0,
      },

      // 詳細使用限制數據
      usageLimits: {
        photos: limitsData.photos || null,
        conversation: limitsData.conversation || {},
        voice: limitsData.voice || {},
        characterCreation: characterCreationData,
      },

      // 其他
      favorites: userData.favorites || [],
      conversations: userData.conversations || [],
      customClaims: authUser.customClaims || {},
      createdAt: authUser.metadata.creationTime,
      lastSignInTime: authUser.metadata.lastSignInTime,
    });
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ error: "用戶不存在" });
    }
    res.status(500).json({ error: "獲取用戶詳情失敗", message: error.message });
  }
});

/**
 * PATCH /api/users/:userId
 * PUT /api/users/:userId
 * 更新用戶資料（包括會員等級和資產）
 * 🔒 權限：admin 以上
 */
const updateUserHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await updateUser(userId, req.body);

    res.json({
      message: "用戶資料更新成功",
      user,
    });
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ error: "用戶不存在" });
    }
    res.status(500).json({ error: "更新用戶資料失敗", message: error.message });
  }
};

// 註冊 PATCH 和 PUT 路由（使用相同的處理函數）
router.patch("/:userId", requireMinRole("admin"), updateUserHandler);
router.put("/:userId", requireMinRole("admin"), updateUserHandler);

/**
 * DELETE /api/users/:userId
 * 刪除用戶（同時刪除 Auth 和 Firestore 數據）
 * 🔒 權限：僅限 super_admin
 */
router.delete("/:userId", requireRole("super_admin"), async (req, res) => {
  try {
    const { userId } = req.params;

    // 檢查用戶是否存在
    try {
      await auth.getUser(userId);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        return res.status(404).json({ error: "用戶不存在" });
      }
      throw error;
    }

    // 統計刪除的數據
    const deletionStats = {
      conversations: 0,
      photos: 0,
    };

    // 1. 刪除所有對話記錄（文檔 ID 格式：userId::characterId）
    try {
      const conversationsSnapshot = await db
        .collection("conversations")
        .where("__name__", ">=", `${userId}::`)
        .where("__name__", "<", `${userId}::\uf8ff`)
        .get();

      const conversationDeletePromises = conversationsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(conversationDeletePromises);
      deletionStats.conversations = conversationsSnapshot.size;
    } catch (error) {
      // 繼續執行，不中斷整個刪除流程
    }

    // 2. 刪除用戶照片相簿（user_photos/{userId}/photos 子集合）
    // 同時刪除 Firestore 記錄和 Cloudflare R2 圖片
    try {
      const photosSnapshot = await db
        .collection("user_photos")
        .doc(userId)
        .collection("photos")
        .get();

      if (!photosSnapshot.empty) {
        // 收集所有照片的 imageUrl（用於刪除 R2 圖片）
        const photoUrls = [];
        photosSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data?.imageUrl) {
            photoUrls.push(data.imageUrl);
          }
        });

        // 先刪除 R2 上的圖片文件
        if (photoUrls.length > 0) {
          try {
            const r2DeleteResult = await deleteImages(photoUrls);
            console.log(`[管理後台] 刪除用戶 R2 圖片: userId=${userId}, 成功=${r2DeleteResult.success}, 失敗=${r2DeleteResult.failed}`);
          } catch (error) {
            console.error(`[管理後台] 刪除用戶 R2 圖片失敗: userId=${userId}`, error);
            // 繼續執行，不中斷刪除流程
          }
        }

        // 再刪除 Firestore 記錄
        const photoDeletePromises = photosSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(photoDeletePromises);
        deletionStats.photos = photosSnapshot.size;
      }

      // 刪除用戶照片文檔本身
      await db.collection("user_photos").doc(userId).delete();
    } catch (error) {
      console.error(`[管理後台] 刪除用戶照片失敗: userId=${userId}`, error);
      // 繼續執行
    }

    // 3. 刪除用戶的使用限制數據
    await db.collection("usage_limits").doc(userId).delete();

    // 4. 刪除 Firestore 用戶數據
    await db.collection("users").doc(userId).delete();

    // 5. 刪除 Firebase Auth 用戶（最後刪除，確保前面的操作能完成）
    await auth.deleteUser(userId);

    res.json({
      message: "用戶刪除成功",
      userId,
      deletionStats: {
        conversations: deletionStats.conversations,
        photos: deletionStats.photos,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "刪除用戶失敗", message: error.message });
  }
});

/**
 * PATCH /api/users/:userId/usage-limits
 * 更新用戶使用限制（重置或直接設置）
 * 🔒 權限：admin 以上
 */
router.patch("/:userId/usage-limits", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await updateUsageLimits(userId, req.body);

    res.json({
      message: "使用限制已更新",
      ...result,
    });
  } catch (error) {
    res.status(500).json({ error: "更新限制失敗", message: error.message });
  }
});

/**
 * POST /api/users/:userId/clean-null-keys
 * 清理用戶使用限制中的 null 鍵
 * 🔒 權限：admin 以上
 */
router.post("/:userId/clean-null-keys", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await cleanNullKeys(userId);

    if (result.hasChanges) {
      res.json({
        message: "成功清理無效鍵",
        userId: result.userId,
        cleaned: result.cleaned,
      });
    } else {
      res.json({
        message: "沒有發現需要清理的無效鍵",
        userId: result.userId,
        cleaned: result.cleaned,
      });
    }
  } catch (error) {
    if (error.message === "用戶使用限制數據不存在") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "清理無效鍵失敗", message: error.message });
  }
});

/**
 * POST /api/users/:userId/potions
 * 管理用戶的藥水（添加/刪除）
 * 🔒 權限：admin 以上
 */
router.post("/:userId/potions", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await addOrRemovePotions(userId, req.body);

    res.json(result);
  } catch (error) {
    if (error.message === "用戶不存在") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("需要指定") || error.message.includes("無效")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "管理藥水失敗", message: error.message });
  }
});

/**
 * GET /api/users/:userId/potions/details
 * 獲取用戶藥水詳細信息（從 usage_limits 集合）
 */
router.get("/:userId/potions/details", async (req, res) => {
  try {
    const { userId } = req.params;

    // 檢查用戶是否存在
    try {
      await auth.getUser(userId);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        return res.status(404).json({ error: "用戶不存在" });
      }
      throw error;
    }

    const limitsDoc = await db.collection("usage_limits").doc(userId).get();

    const now = new Date();
    const potions = [];

    if (limitsDoc.exists) {
      const limitsData = limitsDoc.data();
      const potionsData = limitsData.potions || {};

      // 遍歷藥水對象
      for (const [potionId, potionData] of Object.entries(potionsData)) {
        const isActive = potionData.expiresAt && new Date(potionData.expiresAt) > now;

        potions.push({
          id: potionId,
          ...potionData,
          isActive,
          daysRemaining: isActive
            ? Math.ceil((new Date(potionData.expiresAt) - now) / (24 * 60 * 60 * 1000))
            : 0,
        });
      }
    }

    res.json({
      userId,
      potions,
      summary: {
        total: potions.length,
        active: potions.filter((p) => p.isActive).length,
        expired: potions.filter((p) => !p.isActive).length,
        memoryBoost: potions.filter((p) => p.potionType === "memory_boost" && p.isActive).length,
        brainBoost: potions.filter((p) => p.potionType === "brain_boost" && p.isActive).length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "獲取藥水詳情失敗", message: error.message });
  }
});

/**
 * PUT /api/users/:userId/potions/inventory
 * 直接設置用戶的藥水庫存數量（兩階段系統）
 * 🔒 權限：admin 以上
 */
router.put("/:userId/potions/inventory", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await setInventory(userId, req.body);

    res.json(result);
  } catch (error) {
    if (error.message === "用戶不存在") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("庫存數量")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "設置藥水庫存失敗", message: error.message });
  }
});

/**
 * GET /api/users/:userId/potion-effects
 * 獲取用戶所有角色的活躍藥水效果
 * 🔒 權限：admin 以上
 */
router.get("/:userId/potion-effects", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await getEffects(userId);

    res.json(result);
  } catch (error) {
    if (error.message === "用戶不存在") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "獲取藥水效果失敗", message: error.message });
  }
});

/**
 * POST /api/users/:userId/potion-effects
 * 為用戶的特定角色添加藥水效果
 * 🔒 權限：admin 以上
 * Body: { characterId, potionType, durationDays }
 */
router.post("/:userId/potion-effects", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await addEffect(userId, req.body);

    res.json(result);
  } catch (error) {
    if (error.message === "用戶不存在" || error.message === "角色不存在") {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("參數") || error.message.includes("無效") || error.message.includes("持續天數")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "添加藥水效果失敗", message: error.message });
  }
});

/**
 * PUT /api/users/:userId/potion-effects/:effectId
 * 更新用戶的藥水效果（延長或縮短時間）
 * 🔒 權限：admin 以上
 * Body: { durationDays }
 */
router.put("/:userId/potion-effects/:effectId", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId, effectId } = req.params;
    const result = await updateEffect(userId, effectId, req.body);

    res.json(result);
  } catch (error) {
    if (error.message === "用戶不存在" || error.message.includes("找不到")) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("持續天數")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "更新藥水效果失敗", message: error.message });
  }
});

/**
 * DELETE /api/users/:userId/potion-effects/:effectId
 * 刪除用戶的藥水效果
 * 🔒 權限：admin 以上
 */
router.delete("/:userId/potion-effects/:effectId", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId, effectId } = req.params;
    const result = await deleteEffect(userId, effectId);

    res.json(result);
  } catch (error) {
    if (error.message === "用戶不存在" || error.message.includes("找不到")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "刪除藥水效果失敗", message: error.message });
  }
});

/**
 * GET /api/users/:userId/resource-limits
 * 獲取用戶的所有資源限制（對話、語音、藥水）
 * 用於管理後台的統一資源管理界面
 */
router.get("/:userId/resource-limits", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId } = req.params;

    // 驗證用戶是否存在
    const userRecord = await auth.getUser(userId);
    if (!userRecord) {
      return res.status(404).json({ error: "用戶不存在" });
    }

    // 獲取 usage_limits 文檔
    const usageLimitDoc = await db.collection("usage_limits").doc(userId).get();

    if (!usageLimitDoc.exists) {
      return res.json({
        success: true,
        data: {
          conversation: {
            characters: {},
          },
          voice: {
            characters: {},
          },
          potions: {
            activeEffects: [],
          },
        },
      });
    }

    const usageLimitData = usageLimitDoc.data();

    // 獲取用戶資料以確定會員等級
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const membershipTier = userData.membershipTier || "free";

    // 1. 獲取所有涉及的角色 ID
    const conversationData = usageLimitData.conversation || {};
    const voiceData = usageLimitData.voice || {};
    const activePotionEffects = usageLimitData.activePotionEffects || {};

    const allCharacterIds = new Set([
      ...Object.keys(conversationData),
      ...Object.keys(voiceData),
      ...Object.values(activePotionEffects).map(e => e.characterId).filter(Boolean)
    ]);

    // 2. 批量獲取角色信息
    const charactersMap = new Map();
    if (allCharacterIds.size > 0) {
      const characterPromises = Array.from(allCharacterIds).map(async (charId) => {
        try {
          const charDoc = await db.collection("characters").doc(charId).get();
          if (charDoc.exists) {
            const charData = charDoc.data();
            charactersMap.set(charId, {
              id: charDoc.id,
              display_name: charData.display_name || charData.name || charDoc.id,
              portraitUrl: charData.portraitUrl || charData.avatar || null,
              background: charData.background || null,
            });
          }
        } catch (err) {
          // 單個角色獲取失敗不影響整體
        }
      });
      await Promise.all(characterPromises);
    }

    // 3. 獲取對話限制數據（含角色信息）
    const conversationCharacters = {};
    for (const [characterId, limitData] of Object.entries(conversationData)) {
      conversationCharacters[characterId] = {
        used: limitData.count || 0,
        unlocked: limitData.unlocked || 0,
        cards: limitData.cards || 0,
        permanentUnlock: limitData.permanentUnlock || false,
        customLimit: limitData.customLimit || null,
        lifetimeUsed: limitData.lifetimeCount || 0,
        lastUsedAt: limitData.lastUsedAt || null,
        character: charactersMap.get(characterId) || null,
      };
    }

    // 4. 獲取語音限制數據（含角色信息）
    const voiceCharacters = {};
    for (const [characterId, limitData] of Object.entries(voiceData)) {
      voiceCharacters[characterId] = {
        used: limitData.count || 0,
        unlocked: limitData.unlocked || 0,
        cards: limitData.cards || 0,
        permanentUnlock: limitData.permanentUnlock || false,
        customLimit: limitData.customLimit || null,
        lifetimeUsed: limitData.lifetimeCount || 0,
        lastUsedAt: limitData.lastUsedAt || null,
        character: charactersMap.get(characterId) || null,
      };
    }

    // 5. 獲取藥水效果數據（已激活的，含角色信息）
    const activePotionEffectsData = usageLimitData.activePotionEffects || {};
    const now = new Date();
    const activeEffects = [];

    for (const [effectId, effectData] of Object.entries(activePotionEffectsData)) {
      const expiresAt = effectData.expiresAt ? new Date(effectData.expiresAt) : null;
      const isActive = expiresAt && expiresAt > now;

      if (isActive) {
        // 從 charactersMap 獲取角色資訊（統一數據源）
        const character = charactersMap.get(effectData.characterId);
        const characterName = character?.display_name || "未知角色";
        const characterAvatar = character?.portraitUrl || null;

        const activatedAt = effectData.activatedAt ? new Date(effectData.activatedAt) : null;
        const daysRemaining = expiresAt
          ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        activeEffects.push({
          id: effectId,
          characterId: effectData.characterId,
          characterName,
          characterAvatar,
          character: character || null, // 完整角色信息
          potionType: effectData.potionType,
          potionName: effectData.potionType === "memory_boost" ? "記憶增強藥水" : "腦力激盪藥水",
          activatedAt: activatedAt ? activatedAt.toISOString() : null,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          daysRemaining,
          isActive: true,
        });
      }
    }

    // 4. 獲取藥水庫存
    const potionInventory = usageLimitData.potionInventory || {};

    // 5. 獲取全局使用數據
    const photosData = usageLimitData.photos || {};
    const videosData = usageLimitData.videos || {};
    const characterCreationData = usageLimitData.character_creation || {};

    res.json({
      success: true,
      data: {
        userId,
        membershipTier,
        conversation: {
          characters: conversationCharacters,
        },
        voice: {
          characters: voiceCharacters,
        },
        potions: {
          inventory: {
            memoryBoost: potionInventory.memoryBoost || 0,
            brainBoost: potionInventory.brainBoost || 0,
          },
          activeEffects,
        },
        globalUsage: {
          photosCount: photosData.count || 0,
          videosCount: videosData.count || 0,
          characterCreationCount: characterCreationData.count || 0,
          photos: {
            count: photosData.count || 0,
            unlocked: photosData.unlocked || 0,
            cards: photosData.cards || 0,
            permanentUnlock: photosData.permanentUnlock || false,
            lifetimeCount: photosData.lifetimeCount || 0,
          },
          videos: {
            count: videosData.count || 0,
            unlocked: videosData.unlocked || 0,
            cards: videosData.cards || 0,
            permanentUnlock: videosData.permanentUnlock || false,
            lifetimeCount: videosData.lifetimeCount || 0,
          },
          characterCreation: {
            count: characterCreationData.count || 0,
            unlocked: characterCreationData.unlocked || 0,
            cards: characterCreationData.cards || 0,
            permanentUnlock: characterCreationData.permanentUnlock || false,
            lifetimeCount: characterCreationData.lifetimeCount || 0,
          },
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: "獲取資源限制失敗", message: error.message });
  }
});

/**
 * PUT /api/users/:userId/resource-limits/conversation/:characterId
 * 更新用戶與特定角色的對話限制
 * Body: { unlocked?, cards?, permanentUnlock?, customLimit?, reset?, used? }
 */
router.put("/:userId/resource-limits/conversation/:characterId", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId, characterId } = req.params;
    const { unlocked, cards, permanentUnlock, customLimit, reset, used } = req.body;

    // 驗證用戶是否存在
    await auth.getUser(userId);

    // 驗證角色是否存在
    const characterDoc = await db.collection("characters").doc(characterId).get();
    if (!characterDoc.exists) {
      return res.status(404).json({ error: "角色不存在" });
    }

    const usageLimitRef = db.collection("usage_limits").doc(userId);
    const usageLimitDoc = await usageLimitRef.get();

    let conversationData = {};
    if (usageLimitDoc.exists) {
      const data = usageLimitDoc.data();
      conversationData = data.conversation || {};
    }

    // 獲取或創建該角色的限制數據
    let characterLimit = conversationData[characterId] || {
      count: 0,
      unlocked: 0,
      cards: 0,
      permanentUnlock: false,
      lifetimeCount: 0,
      adsWatchedToday: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
    };

    // 如果 reset 為 true，重置計數
    if (reset === true) {
      characterLimit.count = 0;
    }

    // 更新字段
    if (typeof used === 'number') {
      characterLimit.count = Math.max(0, used);
    }
    if (typeof unlocked === 'number') {
      characterLimit.unlocked = Math.max(0, unlocked);
    }
    if (typeof cards === 'number') {
      characterLimit.cards = Math.max(0, cards);
    }
    if (typeof permanentUnlock === 'boolean') {
      characterLimit.permanentUnlock = permanentUnlock;
    }
    if (typeof customLimit === 'number') {
      characterLimit.customLimit = Math.max(0, customLimit);
    }

    // 更新到 Firestore
    conversationData[characterId] = characterLimit;

    await usageLimitRef.set(
      {
        conversation: conversationData,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    res.json({
      success: true,
      message: "對話限制更新成功",
      data: characterLimit,
    });
  } catch (error) {
    res.status(500).json({ error: "更新對話限制失敗", message: error.message });
  }
});

/**
 * PUT /api/users/:userId/resource-limits/voice/:characterId
 * 更新用戶與特定角色的語音限制
 * Body: { unlocked?, cards?, permanentUnlock?, customLimit?, reset?, used? }
 */
router.put("/:userId/resource-limits/voice/:characterId", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId, characterId } = req.params;
    const { unlocked, cards, permanentUnlock, customLimit, reset, used } = req.body;

    // 驗證用戶是否存在
    await auth.getUser(userId);

    // 驗證角色是否存在
    const characterDoc = await db.collection("characters").doc(characterId).get();
    if (!characterDoc.exists) {
      return res.status(404).json({ error: "角色不存在" });
    }

    const usageLimitRef = db.collection("usage_limits").doc(userId);
    const usageLimitDoc = await usageLimitRef.get();

    let voiceData = {};
    if (usageLimitDoc.exists) {
      const data = usageLimitDoc.data();
      voiceData = data.voice || {};
    }

    // 獲取或創建該角色的限制數據
    let characterLimit = voiceData[characterId] || {
      count: 0,
      unlocked: 0,
      cards: 0,
      permanentUnlock: false,
      lifetimeCount: 0,
      adsWatchedToday: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
    };

    // 如果 reset 為 true，重置計數
    if (reset === true) {
      characterLimit.count = 0;
    }

    // 更新字段
    if (typeof used === 'number') {
      characterLimit.count = Math.max(0, used);
    }
    if (typeof unlocked === 'number') {
      characterLimit.unlocked = Math.max(0, unlocked);
    }
    if (typeof cards === 'number') {
      characterLimit.cards = Math.max(0, cards);
    }
    if (typeof permanentUnlock === 'boolean') {
      characterLimit.permanentUnlock = permanentUnlock;
    }
    if (typeof customLimit === 'number') {
      characterLimit.customLimit = Math.max(0, customLimit);
    }

    // 更新到 Firestore
    voiceData[characterId] = characterLimit;

    await usageLimitRef.set(
      {
        voice: voiceData,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    res.json({
      success: true,
      message: "語音限制更新成功",
      data: characterLimit,
    });
  } catch (error) {
    res.status(500).json({ error: "更新語音限制失敗", message: error.message });
  }
});

/**
 * PUT /api/users/:userId/resource-limits/global/:type
 * 更新用戶的全局資源設定（拍照、影片生成）
 * :type 可以是 'photos' 或 'videos'
 * Body: { unlocked?, cards?, permanentUnlock? }
 */
router.put("/:userId/resource-limits/global/:type", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId, type } = req.params;
    const { unlocked, cards, permanentUnlock, used } = req.body;

    // 驗證類型
    if (!["photos", "videos", "character_creation"].includes(type)) {
      return res.status(400).json({ error: "無效的資源類型", validTypes: ["photos", "videos", "character_creation"] });
    }

    // 驗證用戶是否存在
    const userRecord = await auth.getUser(userId);
    if (!userRecord) {
      return res.status(404).json({ error: "用戶不存在" });
    }

    const usageLimitRef = db.collection("usage_limits").doc(userId);
    const doc = await usageLimitRef.get();
    const usageLimitData = doc.exists ? doc.data() : {};

    // 獲取當前數據或初始化
    const currentData = usageLimitData[type] || {
      count: 0,
      lifetimeCount: 0,
      unlocked: 0,
      cards: 0,
      permanentUnlock: false,
      adsWatchedToday: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
    };

    // 更新欄位
    if (typeof used === 'number') {
      currentData.count = Math.max(0, used);
    }
    if (typeof unlocked === 'number') {
      currentData.unlocked = Math.max(0, unlocked);
    }
    if (typeof cards === 'number') {
      currentData.cards = Math.max(0, cards);
    }
    if (typeof permanentUnlock === 'boolean') {
      currentData.permanentUnlock = permanentUnlock;
    }

    // 更新到 Firestore
    await usageLimitRef.set(
      {
        [type]: currentData,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const typeNames = {
      photos: '拍照',
      videos: '影片生成',
      character_creation: '創建角色',
    };

    res.json({
      success: true,
      message: `${typeNames[type] || type}資源設定已更新`,
      data: currentData,
    });
  } catch (error) {
    res.status(500).json({ error: "更新失敗", message: error.message });
  }
});

/**
 * PUT /api/users/:userId/resource-limits/global/:type/reset
 * 重置用戶的全局資源使用次數（拍照、影片生成）
 * :type 可以是 'photos' 或 'videos'
 */
router.put("/:userId/resource-limits/global/:type/reset", requireMinRole("admin"), async (req, res) => {
  try {
    const { userId, type } = req.params;

    // 驗證類型
    if (!["photos", "videos"].includes(type)) {
      return res.status(400).json({ error: "無效的資源類型", validTypes: ["photos", "videos"] });
    }

    // 驗證用戶是否存在
    const userRecord = await auth.getUser(userId);
    if (!userRecord) {
      return res.status(404).json({ error: "用戶不存在" });
    }

    const usageLimitRef = db.collection("usage_limits").doc(userId);
    const doc = await usageLimitRef.get();
    const usageLimitData = doc.exists ? doc.data() : {};

    // 獲取當前數據
    const currentData = usageLimitData[type] || {};

    // 重置 count 為 0，保留其他字段
    const updatedData = {
      ...currentData,
      count: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
    };

    // 更新到 Firestore
    await usageLimitRef.set(
      {
        [type]: updatedData,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    res.json({
      success: true,
      message: `${type === 'photos' ? '拍照' : '影片生成'}次數已重置`,
      data: updatedData,
    });
  } catch (error) {
    res.status(500).json({ error: "重置失敗", message: error.message });
  }
});

export default router;
