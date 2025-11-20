/**
 * 管理員權限驗證中間件
 * 用於保護需要管理員權限的路由
 */

import { TEST_ACCOUNTS } from "../../shared/config/testAccounts.js";
import { sendError } from "../utils/routeHelpers.js";

/**
 * 管理員用戶 ID 列表
 * 注意：生產環境應從環境變數或資料庫讀取
 */
const ADMIN_USER_IDS = [
  TEST_ACCOUNTS.DEV_USER_ID, // 開發者測試帳號
  // 可以添加其他管理員 ID
];

/**
 * 檢查用戶是否為管理員
 * @param {string} userId - 用戶 ID
 * @returns {boolean} 是否為管理員
 */
export const isAdmin = (userId) => {
  return ADMIN_USER_IDS.includes(userId);
};

/**
 * 管理員權限驗證中間件
 * 必須在 requireFirebaseAuth 之後使用
 *
 * @example
 * router.post('/admin/reset', requireFirebaseAuth, requireAdmin, asyncHandler(...))
 */
export const requireAdmin = (req, res, next) => {
  const userId = req.firebaseUser?.uid;

  if (!userId) {
    return sendError(res, "未驗證的請求：缺少用戶資訊", 401);
  }

  if (!isAdmin(userId)) {
    return sendError(res, "此操作需要管理員權限", 403);
  }

  // 添加管理員標記到請求物件
  req.isAdmin = true;
  next();
};

export default {
  requireAdmin,
  isAdmin,
};
