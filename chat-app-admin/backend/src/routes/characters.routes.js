import express from "express";
import { db } from "../firebase/index.js";
import { requireMinRole, requireRole } from "../middleware/admin.middleware.js";

const router = express.Router();

/**
 * GET /api/characters
 * 獲取角色列表
 * 🔒 權限：所有管理員
 */
router.get("/", requireMinRole("moderator"), async (req, res) => {
  try {
    const charactersSnapshot = await db.collection("characters").get();

    const characters = [];
    charactersSnapshot.forEach((doc) => {
      characters.push({ id: doc.id, ...doc.data() });
    });

    res.json({ characters, total: characters.length });
  } catch (error) {
    res.status(500).json({ error: "獲取角色列表失敗" });
  }
});

/**
 * GET /api/characters/:characterId
 * 獲取單個角色詳情
 * 🔒 權限：所有管理員
 */
router.get("/:characterId", requireMinRole("moderator"), async (req, res) => {
  try {
    const { characterId } = req.params;
    const characterDoc = await db.collection("characters").doc(characterId).get();

    if (!characterDoc.exists) {
      return res.status(404).json({ error: "角色不存在" });
    }

    res.json({ id: characterDoc.id, ...characterDoc.data() });
  } catch (error) {
    res.status(500).json({ error: "獲取角色詳情失敗" });
  }
});

/**
 * POST /api/characters
 * 創建新角色
 * 🔒 權限：admin 以上
 */
router.post("/", requireMinRole("admin"), async (req, res) => {
  try {
    // TODO: 實現角色創建邏輯
    res.status(501).json({ error: "功能尚未實現" });
  } catch (error) {
    res.status(500).json({ error: "創建角色失敗" });
  }
});

/**
 * POST /api/characters/sync-chat-users
 * 同步所有角色的聊天用戶數量到 Firestore
 * 🔒 權限：admin 以上
 */
router.post("/sync-chat-users", requireMinRole("admin"), async (req, res) => {
  try {
    // 使用 collection group query 獲取所有用戶的 conversations 子集合
    const conversationsSnapshot = await db.collectionGroup("conversations").get();

    // 統計每個角色的不重複用戶數量
    const characterUserSets = new Map();

    conversationsSnapshot.forEach((doc) => {
      const data = doc.data();
      const characterId = data.characterId || data.conversationId;

      // 從文檔路徑提取 userId: users/{userId}/conversations/{conversationId}
      const userId = doc.ref.parent.parent?.id;

      if (characterId && userId) {
        if (!characterUserSets.has(characterId)) {
          characterUserSets.set(characterId, new Set());
        }
        characterUserSets.get(characterId).add(userId);
      }
    });

    // 批量更新 Firestore
    let batch = db.batch();
    let batchCount = 0;
    let totalUpdated = 0;

    for (const [characterId, userSet] of characterUserSets.entries()) {
      const charRef = db.collection("characters").doc(characterId);
      batch.update(charRef, {
        totalChatUsers: userSet.size,
        updatedAt: new Date().toISOString(),
      });
      batchCount++;
      totalUpdated++;

      // Firestore batch 限制為 500 個操作
      if (batchCount === 500) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    // 提交剩餘的批次操作
    if (batchCount > 0) {
      await batch.commit();
    }

    res.json({
      message: "同步完成",
      totalCharacters: characterUserSets.size,
      totalUpdated,
    });
  } catch (error) {
    res.status(500).json({ error: "同步失敗", message: error.message });
  }
});

/**
 * PATCH /api/characters/:characterId
 * 更新角色資訊
 * 🔒 權限：admin 以上
 */
router.patch("/:characterId", requireMinRole("admin"), async (req, res) => {
  try {
    const { characterId } = req.params;
    const updates = req.body;

    // 檢查角色是否存在
    const characterDoc = await db.collection("characters").doc(characterId).get();
    if (!characterDoc.exists) {
      return res.status(404).json({ error: "角色不存在" });
    }

    // 允許更新的字段
    const allowedFields = [
      "display_name",
      "gender",
      "voice",
      "locale",
      "background",
      "secret_background",
      "first_message",
      "tags",
      "plot_hooks",
      "portraitUrl",
      "status",
      "isPublic",
      "totalChatUsers",    // 允許管理員手動調整聊天人數
      "totalFavorites",    // 允許管理員手動調整收藏數
    ];

    // 過濾只允許更新的字段
    const updateData = {};
    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    // 如果沒有任何更新，返回錯誤
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "沒有提供任何更新數據" });
    }

    // 添加更新時間
    updateData.updatedAt = new Date().toISOString();

    // 更新角色
    await db.collection("characters").doc(characterId).update(updateData);

    // 獲取更新後的角色數據
    const updatedDoc = await db.collection("characters").doc(characterId).get();

    res.json({
      message: "角色更新成功",
      character: { id: updatedDoc.id, ...updatedDoc.data() },
    });
  } catch (error) {
    res.status(500).json({ error: "更新角色失敗", message: error.message });
  }
});

export default router;
