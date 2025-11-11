import express from "express";
import { db } from "../firebase/index.js";
import { requireMinRole, requireRole } from "../middleware/admin.middleware.js";
import { deleteCharacter } from "../services/character/character.service.js";

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
 *
 * ⚠️ 高成本操作警告：
 * - 此操作會逐個角色掃描對話文檔
 * - 建議只在低流量時段執行
 * - 對於大型數據庫，建議使用 Cloud Functions 定時任務
 *
 * 🔒 權限：僅限 super_admin（批量修改所有角色數據，影響面廣）
 */
router.post("/sync-chat-users", requireRole("super_admin"), async (req, res) => {
  try {
    const { maxCharacters = 100, forceFullScan = false } = req.body;

    // 導入優化的統計服務
    const { syncAllCharactersUserCount } = await import("../services/character/characterStats.service.js");

    // 執行批量同步（使用優化的逐個角色查詢）
    const result = await syncAllCharactersUserCount({
      maxCharacters,
      forceFullScan
    });

    const response = {
      message: "同步完成",
      totalCharacters: result.totalCharacters,
      totalUpdated: result.totalUpdated,
      warnings: result.warnings,
      note: "已使用優化的查詢方式，逐個角色進行統計"
    };

    // 如果有警告，返回 207 Multi-Status
    if (result.warnings.length > 0) {
      return res.status(207).json(response);
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "同步失敗", message: error.message });
  }
});

/**
 * POST /api/characters/:characterId/sync-chat-users
 * 同步單個角色的聊天用戶數量
 * 使用優化的查詢，只掃描該角色的對話
 *
 * 🔒 權限：admin 以上
 */
router.post("/:characterId/sync-chat-users", requireMinRole("admin"), async (req, res) => {
  try {
    const { characterId } = req.params;

    // 檢查角色是否存在
    const characterDoc = await db.collection("characters").doc(characterId).get();
    if (!characterDoc.exists) {
      return res.status(404).json({ error: "角色不存在" });
    }

    // 導入優化的統計服務
    const { syncSingleCharacterUserCount } = await import("../services/character/characterStats.service.js");

    // 同步單個角色
    const result = await syncSingleCharacterUserCount(characterId);

    res.json({
      message: "同步完成",
      characterId,
      userCount: result.userCount,
      conversationCount: result.conversationCount,
      note: "已使用優化的查詢方式，只掃描此角色的對話"
    });
  } catch (error) {
    res.status(500).json({ error: "同步失敗", message: error.message });
  }
});

/**
 * GET /api/characters/stats/overview
 * 獲取系統統計概覽（低成本操作）
 * 基於角色文檔中緩存的統計數據
 *
 * 🔒 權限：所有管理員
 */
router.get("/stats/overview", requireMinRole("moderator"), async (req, res) => {
  try {
    // 導入優化的統計服務
    const { getSystemStatsOverview } = await import("../services/character/characterStats.service.js");

    const stats = await getSystemStatsOverview();

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "獲取統計概覽失敗", message: error.message });
  }
});

/**
 * PATCH /api/characters/:characterId
 * 更新角色資訊
 * 🔒 權限：僅限 super_admin（修改角色會影響所有與該角色互動的用戶）
 */
router.patch("/:characterId", requireRole("super_admin"), async (req, res) => {
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

/**
 * DELETE /api/characters/:characterId
 * 刪除角色及其相關數據
 * 包括：角色肖像圖片、所有用戶的對話照片、對話記錄、usage_limits 數據
 * 🔒 權限：僅限 super_admin
 */
router.delete("/:characterId", requireRole("super_admin"), async (req, res) => {
  try {
    const { characterId } = req.params;

    console.log(`[管理後台] 收到刪除角色請求: ${characterId}`);

    // 調用服務函數刪除角色及相關數據
    const deletionStats = await deleteCharacter(characterId);

    res.json({
      message: "角色刪除成功",
      characterId,
      deletionStats: {
        characterDeleted: deletionStats.characterDeleted,
        portraitImageDeleted: deletionStats.portraitImageDeleted,
        photosDeleted: deletionStats.photosDeleted,
        photoImagesDeleted: deletionStats.photoImagesDeleted,
        videosDeleted: deletionStats.videosDeleted,
        videoFilesDeleted: deletionStats.videoFilesDeleted,
        conversationsDeleted: deletionStats.conversationsDeleted,
        usageLimitsUpdated: deletionStats.usageLimitsUpdated,
      },
    });
  } catch (error) {
    if (error.message === "角色不存在") {
      return res.status(404).json({ error: "角色不存在" });
    }
    console.error(`[管理後台] 刪除角色失敗:`, error);
    res.status(500).json({ error: "刪除角色失敗", message: error.message });
  }
});

export default router;
