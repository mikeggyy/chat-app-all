/**
 * 授權中間件
 * 用於檢查用戶權限
 */

import { sendError } from "../../../../shared/utils/errorFormatter.js";

/**
 * 要求請求者是資源擁有者
 * 檢查 Firebase 認證的 userId 是否與路由參數中的 userId 匹配
 *
 * @param {Object} options - 選項
 * @param {string} options.paramName - 參數名稱（默認為 'userId'）
 * @param {string} options.errorMessage - 自定義錯誤訊息
 * @returns {Function} Express 中間件
 *
 * @example
 * // 檢查路由參數中的 userId
 * router.get('/users/:userId/profile', requireSameUser(), handler);
 *
 * @example
 * // 檢查自定義參數名稱
 * router.get('/accounts/:accountId', requireSameUser({ paramName: 'accountId' }), handler);
 */
export const requireSameUser = (options = {}) => {
  const {
    paramName = 'userId',
    errorMessage = '無權限存取其他使用者的資源'
  } = options;

  return (req, res, next) => {
    const resourceUserId = req.params[paramName];
    const authenticatedUserId = req.firebaseUser?.uid;

    if (!authenticatedUserId) {
      return sendError(res, "UNAUTHORIZED", "未認證的用戶");
    }

    if (authenticatedUserId !== resourceUserId) {
      return sendError(res, "FORBIDDEN", errorMessage);
    }

    next();
  };
};

/**
 * 要求請求者擁有特定角色
 * 檢查 Firebase Custom Claims 中的角色
 *
 * @param {string|string[]} roles - 允許的角色（單個或陣列）
 * @param {Object} options - 選項
 * @param {string} options.errorMessage - 自定義錯誤訊息
 * @returns {Function} Express 中間件
 *
 * @example
 * // 檢查單一角色
 * router.get('/admin/users', requireRole('admin'), handler);
 *
 * @example
 * // 檢查多個角色（任一符合即可）
 * router.get('/moderator/content', requireRole(['admin', 'moderator']), handler);
 */
export const requireRole = (roles, options = {}) => {
  const {
    errorMessage = '無權限執行此操作'
  } = options;

  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    const userClaims = req.firebaseUser?.customClaims || {};

    // 檢查用戶是否擁有任一允許的角色
    const hasRole = allowedRoles.some(role => userClaims[role] === true);

    if (!hasRole) {
      return sendError(res, "FORBIDDEN", errorMessage);
    }

    next();
  };
};

/**
 * 要求請求者是超級管理員
 * 檢查 Firebase Custom Claims 中的 super_admin 標記
 *
 * @param {Object} options - 選項
 * @param {string} options.errorMessage - 自定義錯誤訊息
 * @returns {Function} Express 中間件
 *
 * @example
 * router.delete('/admin/users/:userId', requireSuperAdmin(), handler);
 */
export const requireSuperAdmin = (options = {}) => {
  return requireRole('super_admin', {
    errorMessage: options.errorMessage || '需要超級管理員權限',
  });
};

/**
 * 要求請求者是管理員（admin 或 super_admin）
 * 檢查 Firebase Custom Claims 中的管理員標記
 *
 * @param {Object} options - 選項
 * @param {string} options.errorMessage - 自定義錯誤訊息
 * @returns {Function} Express 中間件
 *
 * @example
 * router.get('/admin/dashboard', requireAdmin(), handler);
 */
export const requireAdmin = (options = {}) => {
  return requireRole(['admin', 'super_admin'], {
    errorMessage: options.errorMessage || '需要管理員權限',
  });
};

export default {
  requireSameUser,
  requireRole,
  requireSuperAdmin,
  requireAdmin,
};
