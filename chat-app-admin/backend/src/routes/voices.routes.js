/**
 * 語音路由
 * 用於管理後台獲取可用的 TTS 語音列表
 */

import express from "express";
import axios from "axios";
import { requireMinRole } from "../middleware/admin.middleware.js";

const router = express.Router();

// 主應用 API 的 URL
const MAIN_APP_API_URL = process.env.MAIN_APP_API_URL || "http://localhost:4000";

/**
 * GET /api/voices
 * 獲取所有可用的 TTS 語音列表
 * 🔒 權限：所有管理員
 */
router.get("/", requireMinRole("moderator"), async (req, res) => {
  try {
    // 從主應用 API 獲取語音列表
    const response = await axios.get(`${MAIN_APP_API_URL}/api/voices`, {
      timeout: 10000,
    });

    res.json(response.data);
  } catch (error) {
    console.error("[管理後台] 獲取語音列表失敗:", error.message);
    res.status(500).json({
      error: "獲取語音列表失敗",
      message: error.message,
    });
  }
});

/**
 * GET /api/voices/recommended
 * 獲取推薦的語音列表
 * 🔒 權限：所有管理員
 */
router.get("/recommended", requireMinRole("moderator"), async (req, res) => {
  try {
    const response = await axios.get(`${MAIN_APP_API_URL}/api/voices/recommended`, {
      timeout: 10000,
    });

    res.json(response.data);
  } catch (error) {
    console.error("[管理後台] 獲取推薦語音列表失敗:", error.message);
    res.status(500).json({
      error: "獲取推薦語音列表失敗",
      message: error.message,
    });
  }
});

export default router;
