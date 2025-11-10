/**
 * 會員管理 API 路由
 */

import express from "express";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import { requireOwnership } from "../utils/routeHelpers.js";
import {
  getUserMembership,
  upgradeMembership,
  cancelMembership,
  renewMembership,
  checkFeatureAccess,
  getUserFeatures,
} from "./membership.service.js";

const router = express.Router();

/**
 * 獲取用戶會員資訊
 * GET /api/membership/:userId
 */
router.get("/api/membership/:userId", requireFirebaseAuth, requireOwnership("userId"), async (req, res) => {
  try {
    const { userId } = req.params;
    const membership = await getUserMembership(userId);

    res.json({
      success: true,
      membership,
    });
  } catch (error) {
    res.status(error.message === "找不到用戶" ? 404 : 500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 升級會員
 * POST /api/membership/:userId/upgrade
 * Body: { tier: "vip" | "vvip", durationMonths?: number, autoRenew?: boolean }
 */
router.post("/api/membership/:userId/upgrade", requireFirebaseAuth, requireOwnership("userId"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { tier, durationMonths, autoRenew } = req.body;

    if (!tier || !["vip", "vvip"].includes(tier)) {
      return res.status(400).json({
        success: false,
        error: "請提供有效的會員等級（vip 或 vvip）",
      });
    }

    // TODO: 整合支付系統
    // 1. 創建支付訂單
    // 2. 等待支付完成
    // 3. 驗證支付成功後才升級

    const membership = await upgradeMembership(userId, tier, {
      durationMonths,
      autoRenew,
    });

    res.json({
      success: true,
      message: `成功升級為 ${tier.toUpperCase()}`,
      membership,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 取消訂閱
 * POST /api/membership/:userId/cancel
 * Body: { immediate?: boolean }
 */
router.post("/api/membership/:userId/cancel", requireFirebaseAuth, requireOwnership("userId"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { immediate } = req.body;

    const membership = await cancelMembership(userId, immediate);

    res.json({
      success: true,
      message: immediate ? "已立即取消訂閱" : "將在到期後取消訂閱",
      membership,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 續訂會員
 * POST /api/membership/:userId/renew
 * Body: { durationMonths?: number }
 */
router.post("/api/membership/:userId/renew", requireFirebaseAuth, requireOwnership("userId"), async (req, res) => {
  try {
    const { userId } = req.params;
    const { durationMonths } = req.body;

    // TODO: 整合支付系統

    const membership = renewMembership(userId, durationMonths);

    res.json({
      success: true,
      message: "續訂成功",
      membership,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 檢查功能權限
 * GET /api/membership/:userId/features/:featureName
 */
router.get("/api/membership/:userId/features/:featureName", requireFirebaseAuth, requireOwnership("userId"), async (req, res) => {
  try {
    const { userId, featureName } = req.params;
    const hasAccess = checkFeatureAccess(userId, featureName);

    res.json({
      success: true,
      userId,
      featureName,
      hasAccess,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 獲取用戶所有功能權限
 * GET /api/membership/:userId/features
 */
router.get("/api/membership/:userId/features", requireFirebaseAuth, requireOwnership("userId"), async (req, res) => {
  try {
    const { userId } = req.params;
    const features = getUserFeatures(userId);

    res.json({
      success: true,
      ...features,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
