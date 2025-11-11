/**
 * 照片相簿路由
 */

import { Router } from "express";
import { requireFirebaseAuth } from "../auth/index.js";
import { requireOwnership, asyncHandler, sendSuccess, sendError } from "../utils/routeHelpers.js";
import {
  getCharacterPhotos,
  getUserAllPhotos,
  deletePhotos,
  getPhotoStats,
} from "./photoAlbum.service.js";
import logger from "../utils/logger.js";
import fetch from "node-fetch";

export const photoAlbumRouter = Router();

/**
 * GET /api/photos/download
 * 代理下載圖片（繞過 CORS 限制）
 * Query: ?url=<圖片URL>
 * ⚠️ 重要：此路由必須放在所有動態路由（如 /:userId）之前
 */
photoAlbumRouter.get(
  "/download",
  requireFirebaseAuth,
  asyncHandler(async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return sendError(res, "缺少必要參數：url", 400);
    }

    // 驗證 URL 是否來自允許的域名（安全考慮）
    const allowedDomains = [
      "r2.dev", // Cloudflare R2
      "cloudflare.com",
      "firebasestorage.googleapis.com", // Firebase Storage
    ];

    const isAllowedDomain = allowedDomains.some(domain => url.includes(domain));

    if (!isAllowedDomain) {
      logger.warn(`[圖片下載] 拒絕不允許的域名: ${url}`);
      return sendError(res, "不允許的圖片來源", 403);
    }

    try {
      logger.info(`[圖片下載] 代理下載圖片: ${url}`);

      // 使用後端 fetch 抓取圖片
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`圖片抓取失敗: ${response.status} ${response.statusText}`);
      }

      // 取得圖片數據
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 從 URL 中提取文件名
      const urlParts = url.split("/");
      const filename = urlParts[urlParts.length - 1] || `image-${Date.now()}.webp`;

      // 設置回應 headers
      res.setHeader("Content-Type", response.headers.get("content-type") || "image/webp");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);

      // 返回圖片數據
      res.send(buffer);

      logger.info(`[圖片下載] 成功代理下載: ${filename}`);
    } catch (error) {
      logger.error(`[圖片下載] 代理下載失敗:`, error);
      return sendError(res, `下載圖片失敗: ${error.message}`, 500);
    }
  })
);

/**
 * GET /api/photos/:userId/character/:characterId
 * 獲取用戶與特定角色的所有照片（包含角色基本資訊）
 */
photoAlbumRouter.get(
  "/:userId/character/:characterId",
  requireFirebaseAuth,
  requireOwnership("userId"),
  asyncHandler(async (req, res) => {
    const { userId, characterId } = req.params;

    if (!userId || !characterId) {
      return sendError(res, "缺少必要參數：userId, characterId", 400);
    }

    const result = await getCharacterPhotos(userId, characterId);
    sendSuccess(res, result);
  })
);

/**
 * GET /api/photos/:userId
 * 獲取用戶的所有照片（所有角色）
 */
photoAlbumRouter.get(
  "/:userId",
  requireFirebaseAuth,
  requireOwnership("userId"),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { limit } = req.query;

    if (!userId) {
      return sendError(res, "缺少必要參數：userId", 400);
    }

    const photos = await getUserAllPhotos(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    sendSuccess(res, { photos });
  })
);

/**
 * DELETE /api/photos/:userId
 * 刪除指定照片
 */
photoAlbumRouter.delete(
  "/:userId",
  requireFirebaseAuth,
  requireOwnership("userId"),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { photoIds } = req.body;

    if (!userId) {
      return sendError(res, "缺少必要參數：userId", 400);
    }

    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return sendError(res, "需提供至少一個照片 ID", 400);
    }

    const result = await deletePhotos(userId, photoIds);
    sendSuccess(res, {
      deleted: result.deleted,
    });
  })
);

/**
 * GET /api/photos/:userId/stats
 * 獲取照片統計
 */
photoAlbumRouter.get(
  "/:userId/stats",
  requireFirebaseAuth,
  requireOwnership("userId"),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { characterId } = req.query;

    if (!userId) {
      return sendError(res, "缺少必要參數：userId", 400);
    }

    const stats = await getPhotoStats(userId, characterId || null);
    sendSuccess(res, stats);
  })
);

export default photoAlbumRouter;
