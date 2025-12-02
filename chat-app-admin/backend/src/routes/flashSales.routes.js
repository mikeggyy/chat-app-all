/**
 * 限時閃購管理 API 路由（管理後台）
 */

import express from "express";
import { db } from "../firebase/index.js";
import { requireMinRole, requireRole } from "../middleware/admin.middleware.js";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

/**
 * 閃購類型
 */
const FLASH_SALE_TYPES = {
  COINS: "coins",
  BUNDLE: "bundle",
  UNLOCK_CARD: "unlock_card",
};

/**
 * 閃購狀態
 */
const FLASH_SALE_STATUS = {
  SCHEDULED: "scheduled",
  ACTIVE: "active",
  ENDED: "ended",
  SOLD_OUT: "sold_out",
};

/**
 * 獲取台灣時區當前時間
 */
const getTaiwanTime = () => {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
};

/**
 * GET /api/flash-sales
 * 獲取所有閃購活動
 * 🔒 權限：moderator 以上
 */
router.get("/", requireMinRole("moderator"), async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    let query = db.collection("flash_sales").orderBy("createdAt", "desc");

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const salesSnapshot = await query.get();
    const now = getTaiwanTime();

    const sales = salesSnapshot.docs.map(doc => {
      const data = doc.data();
      const startTime = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
      const endTime = data.endTime?.toDate ? data.endTime.toDate() : new Date(data.endTime);

      let saleStatus = FLASH_SALE_STATUS.SCHEDULED;
      if (now >= startTime && now < endTime) {
        saleStatus = FLASH_SALE_STATUS.ACTIVE;
        if (data.stockLimit && data.soldCount >= data.stockLimit) {
          saleStatus = FLASH_SALE_STATUS.SOLD_OUT;
        }
      } else if (now >= endTime) {
        saleStatus = FLASH_SALE_STATUS.ENDED;
      }

      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        type: data.type,
        price: data.price,
        originalPrice: data.originalPrice,
        currency: data.currency || "TWD",
        discount: data.discount,
        contents: data.contents,
        badge: data.badge,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: saleStatus,
        stockLimit: data.stockLimit || null,
        soldCount: data.soldCount || 0,
        perUserLimit: data.perUserLimit || 1,
        enabled: data.enabled,
        createdAt: data.createdAt?.toDate?.().toISOString(),
        updatedAt: data.updatedAt?.toDate?.().toISOString(),
      };
    });

    // 如果有狀態過濾
    let filteredSales = sales;
    if (status) {
      filteredSales = sales.filter(s => s.status === status);
    }

    res.json({
      success: true,
      sales: filteredSales,
      total: filteredSales.length,
    });
  } catch (error) {
    console.error("[閃購管理] 獲取列表失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取閃購列表失敗",
    });
  }
});

/**
 * GET /api/flash-sales/stats
 * 獲取閃購統計
 * 🔒 權限：moderator 以上
 */
router.get("/stats", requireMinRole("moderator"), async (req, res) => {
  try {
    const now = getTaiwanTime();
    const salesSnapshot = await db.collection("flash_sales").get();

    let totalSales = 0;
    let activeSales = 0;
    let scheduledSales = 0;
    let endedSales = 0;
    let totalSoldCount = 0;
    let totalRevenue = 0;

    salesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalSales++;
      totalSoldCount += data.soldCount || 0;
      totalRevenue += (data.soldCount || 0) * (data.price || 0);

      const startTime = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
      const endTime = data.endTime?.toDate ? data.endTime.toDate() : new Date(data.endTime);

      if (now < startTime) {
        scheduledSales++;
      } else if (now >= startTime && now < endTime) {
        if (data.enabled && (!data.stockLimit || data.soldCount < data.stockLimit)) {
          activeSales++;
        }
      } else {
        endedSales++;
      }
    });

    res.json({
      success: true,
      stats: {
        totalSales,
        activeSales,
        scheduledSales,
        endedSales,
        totalSoldCount,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("[閃購管理] 獲取統計失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取統計失敗",
    });
  }
});

/**
 * GET /api/flash-sales/:id
 * 獲取特定閃購詳情
 * 🔒 權限：moderator 以上
 */
router.get("/:id", requireMinRole("moderator"), async (req, res) => {
  try {
    const { id } = req.params;
    const saleDoc = await db.collection("flash_sales").doc(id).get();

    if (!saleDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "閃購活動不存在",
      });
    }

    const data = saleDoc.data();
    const now = getTaiwanTime();
    const startTime = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
    const endTime = data.endTime?.toDate ? data.endTime.toDate() : new Date(data.endTime);

    let status = FLASH_SALE_STATUS.SCHEDULED;
    if (now >= startTime && now < endTime) {
      status = FLASH_SALE_STATUS.ACTIVE;
      if (data.stockLimit && data.soldCount >= data.stockLimit) {
        status = FLASH_SALE_STATUS.SOLD_OUT;
      }
    } else if (now >= endTime) {
      status = FLASH_SALE_STATUS.ENDED;
    }

    res.json({
      success: true,
      sale: {
        id: saleDoc.id,
        name: data.name,
        description: data.description,
        type: data.type,
        price: data.price,
        originalPrice: data.originalPrice,
        currency: data.currency || "TWD",
        discount: data.discount,
        contents: data.contents,
        badge: data.badge,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status,
        stockLimit: data.stockLimit || null,
        soldCount: data.soldCount || 0,
        perUserLimit: data.perUserLimit || 1,
        enabled: data.enabled,
        createdAt: data.createdAt?.toDate?.().toISOString(),
        updatedAt: data.updatedAt?.toDate?.().toISOString(),
      },
    });
  } catch (error) {
    console.error("[閃購管理] 獲取詳情失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取閃購詳情失敗",
    });
  }
});

/**
 * POST /api/flash-sales
 * 創建新的閃購活動
 * 🔒 權限：admin 以上
 */
router.post("/", requireMinRole("admin"), async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      price,
      originalPrice,
      discount,
      contents,
      badge,
      startTime,
      endTime,
      stockLimit,
      perUserLimit,
      enabled,
    } = req.body;

    // 驗證必填欄位
    if (!name || !price || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: "缺少必填欄位：name, price, startTime, endTime",
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: "無效的時間格式",
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        error: "結束時間必須晚於開始時間",
      });
    }

    const newSale = {
      name,
      description: description || "",
      type: type || FLASH_SALE_TYPES.BUNDLE,
      price: Number(price),
      originalPrice: Number(originalPrice) || Number(price),
      currency: "TWD",
      discount: discount || "",
      contents: {
        coins: Number(contents?.coins) || 0,
        photoUnlockCards: Number(contents?.photoUnlockCards) || 0,
        characterUnlockCards: Number(contents?.characterUnlockCards) || 0,
        videoUnlockCards: Number(contents?.videoUnlockCards) || 0,
      },
      badge: badge || "⚡ 限時閃購",
      startTime: start,
      endTime: end,
      stockLimit: stockLimit ? Number(stockLimit) : null,
      soldCount: 0,
      perUserLimit: Number(perUserLimit) || 1,
      enabled: enabled !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("flash_sales").add(newSale);

    res.status(201).json({
      success: true,
      message: "閃購活動創建成功",
      sale: {
        id: docRef.id,
        ...newSale,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
  } catch (error) {
    console.error("[閃購管理] 創建失敗:", error);
    res.status(500).json({
      success: false,
      error: "創建閃購活動失敗",
    });
  }
});

/**
 * PUT /api/flash-sales/:id
 * 更新閃購活動
 * 🔒 權限：admin 以上
 */
router.put("/:id", requireMinRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const saleRef = db.collection("flash_sales").doc(id);
    const saleDoc = await saleRef.get();

    if (!saleDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "閃購活動不存在",
      });
    }

    const {
      name,
      description,
      type,
      price,
      originalPrice,
      discount,
      contents,
      badge,
      startTime,
      endTime,
      stockLimit,
      perUserLimit,
      enabled,
    } = req.body;

    const updates = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (price !== undefined) updates.price = Number(price);
    if (originalPrice !== undefined) updates.originalPrice = Number(originalPrice);
    if (discount !== undefined) updates.discount = discount;
    if (badge !== undefined) updates.badge = badge;
    if (stockLimit !== undefined) updates.stockLimit = stockLimit ? Number(stockLimit) : null;
    if (perUserLimit !== undefined) updates.perUserLimit = Number(perUserLimit);
    if (enabled !== undefined) updates.enabled = enabled;

    if (contents) {
      updates.contents = {
        coins: Number(contents.coins) || 0,
        photoUnlockCards: Number(contents.photoUnlockCards) || 0,
        characterUnlockCards: Number(contents.characterUnlockCards) || 0,
        videoUnlockCards: Number(contents.videoUnlockCards) || 0,
      };
    }

    if (startTime) {
      const start = new Date(startTime);
      if (isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          error: "無效的開始時間格式",
        });
      }
      updates.startTime = start;
    }

    if (endTime) {
      const end = new Date(endTime);
      if (isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: "無效的結束時間格式",
        });
      }
      updates.endTime = end;
    }

    await saleRef.update(updates);

    res.json({
      success: true,
      message: "閃購活動更新成功",
    });
  } catch (error) {
    console.error("[閃購管理] 更新失敗:", error);
    res.status(500).json({
      success: false,
      error: "更新閃購活動失敗",
    });
  }
});

/**
 * DELETE /api/flash-sales/:id
 * 刪除閃購活動
 * 🔒 權限：super_admin
 */
router.delete("/:id", requireRole("super_admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const saleRef = db.collection("flash_sales").doc(id);
    const saleDoc = await saleRef.get();

    if (!saleDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "閃購活動不存在",
      });
    }

    const data = saleDoc.data();

    // 檢查是否有購買記錄
    if (data.soldCount > 0) {
      return res.status(400).json({
        success: false,
        error: "已有購買記錄，無法刪除，請改為停用",
      });
    }

    await saleRef.delete();

    res.json({
      success: true,
      message: "閃購活動已刪除",
    });
  } catch (error) {
    console.error("[閃購管理] 刪除失敗:", error);
    res.status(500).json({
      success: false,
      error: "刪除閃購活動失敗",
    });
  }
});

/**
 * PATCH /api/flash-sales/:id/toggle
 * 切換閃購活動啟用狀態
 * 🔒 權限：admin 以上
 */
router.patch("/:id/toggle", requireMinRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const saleRef = db.collection("flash_sales").doc(id);
    const saleDoc = await saleRef.get();

    if (!saleDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "閃購活動不存在",
      });
    }

    const currentEnabled = saleDoc.data().enabled;
    await saleRef.update({
      enabled: !currentEnabled,
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({
      success: true,
      message: `閃購活動已${!currentEnabled ? "啟用" : "停用"}`,
      enabled: !currentEnabled,
    });
  } catch (error) {
    console.error("[閃購管理] 切換狀態失敗:", error);
    res.status(500).json({
      success: false,
      error: "切換狀態失敗",
    });
  }
});

/**
 * POST /api/flash-sales/:id/duplicate
 * 複製閃購活動（用於快速創建類似活動）
 * 🔒 權限：admin 以上
 */
router.post("/:id/duplicate", requireMinRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const saleDoc = await db.collection("flash_sales").doc(id).get();

    if (!saleDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "閃購活動不存在",
      });
    }

    const originalData = saleDoc.data();
    const now = new Date();

    // 複製活動，時間設為未來
    const newSale = {
      ...originalData,
      name: `${originalData.name} (複製)`,
      startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 明天開始
      endTime: new Date(now.getTime() + 48 * 60 * 60 * 1000),   // 後天結束
      soldCount: 0,
      enabled: false, // 預設停用
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("flash_sales").add(newSale);

    res.status(201).json({
      success: true,
      message: "閃購活動複製成功",
      saleId: docRef.id,
    });
  } catch (error) {
    console.error("[閃購管理] 複製失敗:", error);
    res.status(500).json({
      success: false,
      error: "複製閃購活動失敗",
    });
  }
});

export default router;
