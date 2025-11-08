import express from "express";
import { db } from "../firebase/index.js";

const router = express.Router();

/**
 * GET /api/conversations
 * 獲取對話列表（支援分頁和篩選）
 */
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      userId = null,
      characterId = null,
      startDate = null,
      endDate = null,
    } = req.query;

    const limit = parseInt(pageSize);
    const offset = (parseInt(page) - 1) * limit;

    // 建立查詢
    let query = db.collection("conversations").orderBy("updatedAt", "desc");

    // 篩選條件
    if (userId) {
      query = query.where("userId", "==", userId);
    }
    if (characterId) {
      query = query.where("characterId", "==", characterId);
    }

    // 日期範圍篩選
    if (startDate) {
      query = query.where("updatedAt", ">=", new Date(startDate));
    }
    if (endDate) {
      query = query.where("updatedAt", "<=", new Date(endDate));
    }

    // 獲取總數
    const countSnapshot = await query.get();
    const total = countSnapshot.size;

    // 分頁
    query = query.limit(limit).offset(offset);

    const snapshot = await query.get();
    const conversations = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // 獲取用戶資訊
      let userName = "未知用戶";
      let userEmail = "";
      if (data.userId) {
        try {
          const userDoc = await db.collection("users").doc(data.userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userName = userData.displayName || userData.name || "未知用戶";
            userEmail = userData.email || "";
          }
        } catch (error) {
          console.error("獲取用戶資訊失敗:", error);
        }
      }

      // 獲取角色資訊
      let characterName = "未知角色";
      console.log(`[對話列表] 對話 ${doc.id}: characterId = ${data.characterId}`);
      if (data.characterId) {
        try {
          const characterDoc = await db
            .collection("characters")
            .doc(data.characterId)
            .get();
          console.log(`[對話列表] 角色文檔存在: ${characterDoc.exists}`);
          if (characterDoc.exists) {
            const characterData = characterDoc.data();
            characterName = characterData.display_name || characterData.name || "未知角色";
            console.log(`[對話列表] 角色名稱: ${characterName}`);
          } else {
            console.log(`[對話列表] 找不到角色: ${data.characterId}`);
          }
        } catch (error) {
          console.error("獲取角色資訊失敗:", error);
        }
      } else {
        console.log(`[對話列表] 對話沒有 characterId 欄位`);
      }

      // 獲取消息數量（從文檔的 messages 陣列欄位）
      const messageCount = Array.isArray(data.messages) ? data.messages.length : 0;

      conversations.push({
        id: doc.id,
        ...data,
        userName,
        userEmail,
        characterName,
        messageCount,
        createdAt: data.createdAt
          ? data.createdAt.toDate().toISOString()
          : null,
        updatedAt: data.updatedAt
          ? data.updatedAt.toDate().toISOString()
          : null,
      });
    }

    res.json({
      success: true,
      conversations,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("獲取對話列表失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取對話列表失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/conversations/stats
 * 獲取對話統計資訊
 */
router.get("/stats", async (req, res) => {
  try {
    const snapshot = await db.collection("conversations").get();

    const stats = {
      totalConversations: snapshot.size,
      activeUsers: 0,
      todayConversations: 0,
      totalMessages: 0,
      byCharacter: {},
    };

    const uniqueUsers = new Set();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const doc of snapshot.docs) {
      const conversation = doc.data();

      // 統計活躍用戶
      if (conversation.userId) {
        uniqueUsers.add(conversation.userId);
      }

      // 統計今日對話數
      if (conversation.updatedAt) {
        const updatedAt = conversation.updatedAt.toDate();
        if (updatedAt >= today) {
          stats.todayConversations++;
        }
      }

      // 統計消息數量（從文檔的 messages 陣列欄位）
      const messages = conversation.messages;
      if (Array.isArray(messages)) {
        stats.totalMessages += messages.length;
      }

      // 按角色統計
      const characterId = conversation.characterId || "unknown";
      if (!stats.byCharacter[characterId]) {
        stats.byCharacter[characterId] = {
          count: 0,
          characterName: "未知角色",
        };
      }
      stats.byCharacter[characterId].count++;

      // 獲取角色名稱
      if (
        characterId !== "unknown" &&
        stats.byCharacter[characterId].characterName === "未知角色"
      ) {
        try {
          const characterDoc = await db
            .collection("characters")
            .doc(characterId)
            .get();
          if (characterDoc.exists) {
            const characterData = characterDoc.data();
            stats.byCharacter[characterId].characterName =
              characterData.display_name || characterData.name || "未知角色";
          }
        } catch (error) {
          console.error("獲取角色名稱失敗:", error);
        }
      }
    }

    stats.activeUsers = uniqueUsers.size;

    res.json({ success: true, stats });
  } catch (error) {
    console.error("獲取對話統計失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取對話統計失敗",
    });
  }
});

/**
 * GET /api/conversations/:id
 * 獲取單一對話詳情（包含完整消息列表）
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("conversations").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "對話不存在",
      });
    }

    const data = doc.data();

    // 獲取用戶資訊
    let userName = "未知用戶";
    let userEmail = "";
    if (data.userId) {
      try {
        const userDoc = await db.collection("users").doc(data.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userName = userData.displayName || userData.name || "未知用戶";
          userEmail = userData.email || "";
        }
      } catch (error) {
        console.error("獲取用戶資訊失敗:", error);
      }
    }

    // 獲取角色資訊
    let characterName = "未知角色";
    if (data.characterId) {
      try {
        const characterDoc = await db
          .collection("characters")
          .doc(data.characterId)
          .get();
        if (characterDoc.exists) {
          const characterData = characterDoc.data();
          characterName = characterData.display_name || characterData.name || "未知角色";
        }
      } catch (error) {
        console.error("獲取角色資訊失敗:", error);
      }
    }

    // 獲取完整消息列表（從文檔的 messages 陣列欄位）
    const messages = Array.isArray(data.messages)
      ? data.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.text || msg.content,
          timestamp: msg.createdAt || msg.timestamp,
          imageUrl: msg.imageUrl,
        }))
      : [];

    res.json({
      success: true,
      conversation: {
        id: doc.id,
        ...data,
        userName,
        userEmail,
        characterName,
        messages,
        createdAt: data.createdAt
          ? data.createdAt.toDate().toISOString()
          : null,
        updatedAt: data.updatedAt
          ? data.updatedAt.toDate().toISOString()
          : null,
      },
    });
  } catch (error) {
    console.error("獲取對話詳情失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取對話詳情失敗",
    });
  }
});

export default router;
