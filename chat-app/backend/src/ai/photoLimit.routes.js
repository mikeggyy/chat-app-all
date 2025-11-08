/**
 * 拍照限制 API 路由
 * 掛載路徑：/api/photo-limit
 */

import {
  photoLimitService,
  canGeneratePhoto,
  getPhotoStats,
  purchasePhotoCards,
} from "./photoLimit.service.js";
import { requireFirebaseAuth } from "../auth/firebaseAuth.middleware.js";
import createLimitRouter from "../utils/createLimitRouter.js";
import {
  sendSuccess,
  sendError,
  asyncHandler,
  requireOwnership,
  requireParams,
  getLimitErrorStatus,
} from "../utils/routeHelpers.js";

// 使用工廠函數創建標準路由（僅 reset）
// ⚠️ 跳過 check 和 stats 路由的創建，使用下面的自定義邏輯
export const photoLimitRouter = createLimitRouter({
  service: photoLimitService,
  options: {
    perCharacter: false,
    publicCheck: false,
    publicStats: false,
    skipCheck: true,  // ✅ 跳過默認 check 路由
    skipStats: true,  // ✅ 跳過默認 stats 路由
    resourceName: "拍照",
  },
});

// ==================== 自定義路由 ====================

/**
 * 檢查拍照權限（自定義邏輯）
 * GET /api/photo-limit/check
 * 使用 canGeneratePhoto 以包含照片卡邏輯
 * 🔒 安全增強：從認證 token 獲取 userId，防止查詢他人限制
 */
photoLimitRouter.get(
  "/check",
  requireFirebaseAuth,
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;

    try {
      const result = await canGeneratePhoto(userId);
      sendSuccess(res, result);
    } catch (error) {
      const status = getLimitErrorStatus(error);
      sendError(res, error, status);
    }
  })
);

/**
 * 獲取拍照統計（自定義邏輯）
 * GET /api/photo-limit/stats
 * 使用 getPhotoStats 以包含照片卡邏輯
 * 🔒 安全增強：從認證 token 獲取 userId，防止查看他人統計
 */
photoLimitRouter.get(
  "/stats",
  requireFirebaseAuth,
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;

    try {
      const result = await getPhotoStats(userId);
      sendSuccess(res, result);
    } catch (error) {
      const status = getLimitErrorStatus(error);
      sendError(res, error, status);
    }
  })
);

// ==================== 特定路由（保留） ====================

/**
 * 購買拍照卡
 * POST /api/photo-limit/purchase
 * Body: { quantity, paymentInfo }
 * 🔒 安全增強：從認證 token 獲取 userId，防止代他人購買照片卡
 */
photoLimitRouter.post(
  "/purchase",
  requireFirebaseAuth,
  requireParams(["quantity"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { quantity, paymentInfo } = req.body;

    try {
      const result = purchasePhotoCards(userId, quantity, paymentInfo);
      sendSuccess(res, result);
    } catch (error) {
      const status = getLimitErrorStatus(error);
      sendError(res, error, status);
    }
  })
);

export default photoLimitRouter;
