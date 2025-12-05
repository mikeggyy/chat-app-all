/**
 * 會員配置 API 路由
 * 提供會員配置的讀取和更新
 *
 * ✅ 2025-12-03 新增：支援資料庫驅動的會員配置
 *
 * 公開 API（不需要認證）:
 * - GET /api/config/membership-tiers - 獲取所有會員等級配置（給前端顯示用）
 * - GET /api/config/comparison-features - 獲取功能對比表
 *
 * 管理員 API（需要認證 + 管理員權限）:
 * - PUT /api/config/membership-tiers/:tierId - 更新會員等級配置
 * - PUT /api/config/comparison-features/:categoryId - 更新對比表
 * - PUT /api/config/ad-limits - 更新廣告限制
 * - POST /api/config/initialize - 初始化資料庫配置
 */

import express from "express";
import {
  getMembershipTiers,
  getMembershipTierById,
  updateMembershipTier,
  getComparisonFeatures,
  updateComparisonFeature,
  getAdLimits,
  updateAdLimits,
  initializeMembershipConfig,
  clearMembershipConfigCache,
} from "./membershipConfig.service.js";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { requireAdmin } from "../middleware/adminAuth.middleware.js";
import { relaxedRateLimiter, standardRateLimiter } from "../middleware/rateLimiterConfig.js";
import logger from "../utils/logger.js";

const router = express.Router();

// ==================== 公開 API（不需要認證）====================

/**
 * 獲取所有會員等級配置
 * GET /api/config/membership-tiers
 */
router.get("/api/config/membership-tiers", relaxedRateLimiter, async (req, res) => {
  try {
    const tiers = await getMembershipTiers();

    res.json({
      success: true,
      data: tiers,
    });
  } catch (error) {
    logger.error("[ConfigAPI] 獲取會員等級失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取會員等級配置失敗",
    });
  }
});

/**
 * 獲取單一會員等級配置
 * GET /api/config/membership-tiers/:tierId
 */
router.get("/api/config/membership-tiers/:tierId", relaxedRateLimiter, async (req, res) => {
  try {
    const { tierId } = req.params;
    const tier = await getMembershipTierById(tierId);

    if (!tier) {
      return res.status(404).json({
        success: false,
        error: `找不到會員等級: ${tierId}`,
      });
    }

    res.json({
      success: true,
      data: tier,
    });
  } catch (error) {
    logger.error("[ConfigAPI] 獲取會員等級失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取會員等級配置失敗",
    });
  }
});

/**
 * 獲取功能對比表
 * GET /api/config/comparison-features
 */
router.get("/api/config/comparison-features", relaxedRateLimiter, async (req, res) => {
  try {
    const features = await getComparisonFeatures();

    res.json({
      success: true,
      data: features,
    });
  } catch (error) {
    logger.error("[ConfigAPI] 獲取對比表失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取功能對比表失敗",
    });
  }
});

/**
 * 獲取廣告限制配置
 * GET /api/config/ad-limits
 */
router.get("/api/config/ad-limits", relaxedRateLimiter, async (req, res) => {
  try {
    const limits = await getAdLimits();

    res.json({
      success: true,
      data: limits,
    });
  } catch (error) {
    logger.error("[ConfigAPI] 獲取廣告限制失敗:", error);
    res.status(500).json({
      success: false,
      error: "獲取廣告限制配置失敗",
    });
  }
});

// ==================== 管理員 API（需要認證 + 管理員權限）====================

/**
 * 更新會員等級配置
 * PUT /api/config/membership-tiers/:tierId
 */
router.put(
  "/api/config/membership-tiers/:tierId",
  requireFirebaseAuth,
  requireAdmin,
  standardRateLimiter,
  async (req, res) => {
    try {
      const { tierId } = req.params;
      const data = req.body;

      // 驗證必要欄位
      if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          error: "缺少更新資料",
        });
      }

      // 不允許修改 id
      delete data.id;
      delete data.createdAt;

      const result = await updateMembershipTier(tierId, data);

      res.json({
        success: true,
        message: `會員等級 ${tierId} 更新成功`,
        data: result,
      });
    } catch (error) {
      logger.error("[ConfigAPI] 更新會員等級失敗:", error);
      res.status(500).json({
        success: false,
        error: error.message || "更新會員等級配置失敗",
      });
    }
  }
);

/**
 * 更新功能對比表
 * PUT /api/config/comparison-features/:categoryId
 */
router.put(
  "/api/config/comparison-features/:categoryId",
  requireFirebaseAuth,
  requireAdmin,
  standardRateLimiter,
  async (req, res) => {
    try {
      const { categoryId } = req.params;
      const data = req.body;

      if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          error: "缺少更新資料",
        });
      }

      // 不允許修改 id
      delete data.id;
      delete data.createdAt;

      const result = await updateComparisonFeature(categoryId, data);

      res.json({
        success: true,
        message: `對比表 ${categoryId} 更新成功`,
        data: result,
      });
    } catch (error) {
      logger.error("[ConfigAPI] 更新對比表失敗:", error);
      res.status(500).json({
        success: false,
        error: error.message || "更新功能對比表失敗",
      });
    }
  }
);

/**
 * 更新廣告限制配置
 * PUT /api/config/ad-limits
 */
router.put(
  "/api/config/ad-limits",
  requireFirebaseAuth,
  requireAdmin,
  standardRateLimiter,
  async (req, res) => {
    try {
      const data = req.body;

      if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          error: "缺少更新資料",
        });
      }

      delete data.createdAt;

      const result = await updateAdLimits(data);

      res.json({
        success: true,
        message: "廣告限制配置更新成功",
        data: result,
      });
    } catch (error) {
      logger.error("[ConfigAPI] 更新廣告限制失敗:", error);
      res.status(500).json({
        success: false,
        error: error.message || "更新廣告限制配置失敗",
      });
    }
  }
);

/**
 * 初始化資料庫配置（只在資料庫為空時有效）
 * POST /api/config/initialize
 */
router.post(
  "/api/config/initialize",
  requireFirebaseAuth,
  requireAdmin,
  standardRateLimiter,
  async (req, res) => {
    try {
      const result = await initializeMembershipConfig();

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error("[ConfigAPI] 初始化配置失敗:", error);
      res.status(500).json({
        success: false,
        error: error.message || "初始化配置失敗",
      });
    }
  }
);

/**
 * 清除配置緩存
 * POST /api/config/clear-cache
 */
router.post(
  "/api/config/clear-cache",
  requireFirebaseAuth,
  requireAdmin,
  standardRateLimiter,
  async (req, res) => {
    try {
      clearMembershipConfigCache();

      res.json({
        success: true,
        message: "配置緩存已清除",
      });
    } catch (error) {
      logger.error("[ConfigAPI] 清除緩存失敗:", error);
      res.status(500).json({
        success: false,
        error: error.message || "清除緩存失敗",
      });
    }
  }
);

export default router;
