/**
 * 管理員權限中間件
 * 檢查用戶是否具有管理員權限
 */
function adminMiddleware(req, res, next) {
  try {
    const claims = req.user?.claims;

    if (!claims) {
      return res.status(401).json({ error: "未認證" });
    }

    // 檢查是否有任何管理員權限
    const isAdmin = !!(
      claims.super_admin ||
      claims.admin ||
      claims.moderator
    );

    if (!isAdmin) {
      return res.status(403).json({
        error: "權限不足",
        message: "僅限管理員訪問",
      });
    }

    // 將管理員角色附加到請求對象
    req.adminRole = claims.super_admin
      ? "super_admin"
      : claims.admin
      ? "admin"
      : "moderator";

    next();
  } catch (error) {
    return res.status(500).json({ error: "權限驗證失敗" });
  }
}

/**
 * 角色權限層級定義
 */
const ROLE_HIERARCHY = {
  super_admin: 3,
  admin: 2,
  moderator: 1,
};

/**
 * 檢查用戶是否具有指定的角色權限
 * @param {...string} allowedRoles - 允許的角色列表
 * @returns {Function} Express 中間件
 *
 * @example
 * router.delete("/:userId", requireRole("super_admin"), deleteUser);
 * router.post("/moderate", requireRole("super_admin", "admin", "moderator"), moderateContent);
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const currentRole = req.adminRole;

    if (!currentRole) {
      return res.status(401).json({
        error: "未認證",
        message: "請先通過管理員驗證",
      });
    }

    // 檢查當前角色是否在允許的角色列表中
    if (!allowedRoles.includes(currentRole)) {
      return res.status(403).json({
        error: "權限不足",
        message: `此操作需要以下角色之一: ${allowedRoles.join(", ")}`,
        currentRole,
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
}

/**
 * 檢查用戶是否具有最低角色權限等級
 * @param {string} minRole - 最低要求的角色
 * @returns {Function} Express 中間件
 *
 * @example
 * router.put("/config", requireMinRole("admin"), updateConfig);
 */
export function requireMinRole(minRole) {
  return (req, res, next) => {
    const currentRole = req.adminRole;

    if (!currentRole) {
      return res.status(401).json({
        error: "未認證",
        message: "請先通過管理員驗證",
      });
    }

    const currentLevel = ROLE_HIERARCHY[currentRole] || 0;
    const minLevel = ROLE_HIERARCHY[minRole] || 0;

    if (currentLevel < minLevel) {
      return res.status(403).json({
        error: "權限不足",
        message: `此操作至少需要 ${minRole} 權限`,
        currentRole,
        requiredRole: minRole,
      });
    }

    next();
  };
}

export default adminMiddleware;
