/**
 * coins.routes.js 的修復補丁
 *
 * 修復內容：
 * ✅ 添加開發模式繞過的環境和權限檢查
 */

// ==================== 修改：導入開發模式輔助函數 ====================
// 在文件頂部添加導入：

import { validateDevModeBypass } from "../utils/devModeHelper.js";

// ==================== 修改：金幣購買端點（第 300-365 行）====================
// 找到 POST /api/coins/purchase/package 路由，修改如下：

router.post(
  "/api/coins/purchase/package",
  requireFirebaseAuth,
  requireParams(["packageId"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { packageId, requestId } = req.body;

    // 檢查開發模式繞過
    const isDevBypassEnabled = process.env.ENABLE_DEV_PURCHASE_BYPASS === "true";

    if (isDevBypassEnabled) {
      // ✅ 修復：添加安全驗證
      try {
        validateDevModeBypass(userId, {
          featureName: "金幣套餐購買",
          requireTestAccount: true,
        });

        logger.warn(
          `[開發模式] 繞過支付購買金幣套餐：userId=${userId}, packageId=${packageId}`
        );

        // 開發模式：直接購買，無需實際支付
        const idempotencyKey =
          requestId || `purchase-package:${userId}:${packageId}:${Date.now()}`;

        const result = await handleIdempotentRequest(
          idempotencyKey,
          async () => {
            const coinPackage = await getCoinPackageById(packageId);

            if (!coinPackage) {
              throw new Error("套餐不存在");
            }

            // 直接增加金幣
            const addResult = await addCoins(
              userId,
              coinPackage.coins,
              `開發模式購買：${coinPackage.name}`,
              {
                type: "dev_purchase",
                packageId,
                originalPrice: coinPackage.price,
              }
            );

            return {
              success: true,
              package: coinPackage,
              newBalance: addResult.newBalance,
              devMode: true,
            };
          },
          { ttl: 15 * 60 * 1000 }
        );

        return sendSuccess(res, {
          message: "開發模式：購買成功（未實際扣款）",
          ...result,
        });
      } catch (error) {
        // 驗證失敗，拒絕請求
        logger.error(`[安全] 開發模式繞過驗證失敗: ${error.message}`);
        return sendError(res, "FORBIDDEN", error.message);
      }
    }

    // ✅ 正常流程：實際支付驗證
    // TODO: 整合真實支付系統（LINE Pay / ECPay 等）
    return sendError(
      res,
      "NOT_IMPLEMENTED",
      "實際支付功能尚未實現，請使用開發模式測試"
    );
  })
);

// ==================== 修改：測試充值端點（第 374-428 行）====================
// 找到 POST /api/coins/recharge 路由，修改如下：

router.post(
  "/api/coins/recharge",
  requireFirebaseAuth,
  requireParams(["amount"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { amount } = req.body;

    // ✅ 修復：限制僅測試帳號可用
    try {
      validateDevModeBypass(userId, {
        featureName: "測試充值",
        requireTestAccount: true,
      });

      logger.warn(`[測試充值] userId=${userId}, amount=${amount}`);

      const result = await addCoins(userId, amount, "測試充值", {
        type: "test_recharge",
      });

      sendSuccess(res, {
        message: "測試充值成功",
        ...result,
      });
    } catch (error) {
      logger.error(`[安全] 測試充值權限驗證失敗: ${error.message}`);
      return sendError(res, "FORBIDDEN", error.message);
    }
  })
);

// ==================== 修改：設定金幣餘額端點（第 437-474 行）====================
// 找到 POST /api/coins/set-balance 路由，已經有測試帳號限制，但可以加強：

router.post(
  "/api/coins/set-balance",
  requireFirebaseAuth,
  requireParams(["balance"], "body"),
  asyncHandler(async (req, res) => {
    const userId = req.firebaseUser.uid;
    const { balance } = req.body;

    // ✅ 加強：使用統一的驗證函數
    try {
      validateDevModeBypass(userId, {
        featureName: "設定金幣餘額",
        requireTestAccount: true,
      });

      logger.warn(`[測試] 設定金幣餘額：userId=${userId}, balance=${balance}`);

      const result = await setCoinsBalance(userId, balance, "測試設定餘額");

      sendSuccess(res, {
        message: "成功設定金幣餘額（測試功能）",
        ...result,
      });
    } catch (error) {
      logger.error(`[安全] 設定餘額權限驗證失敗: ${error.message}`);
      return sendError(res, "FORBIDDEN", error.message);
    }
  })
);

// ==================== 使用說明 ====================
/*
 * 如何應用這些修復：
 *
 * 1. 將 devModeHelper.js 部署到 src/utils/
 * 2. 在 coins.routes.js 中應用上述修改
 * 3. 同樣的模式應用到其他需要開發模式繞過的文件：
 *    - membership/membership.routes.js (會員升級)
 *    - potion/potion.routes.js (藥水購買，如有開發模式)
 *
 * 環境變數配置：
 * - ENABLE_DEV_PURCHASE_BYPASS=true (僅開發/測試環境)
 * - NODE_ENV=production (生產環境必須設置)
 * - DEV_BYPASS_ALLOWED_IPS=127.0.0.1,::1 (可選，IP 白名單)
 *
 * 修復後的安全保護：
 * ✅ 生產環境自動禁用開發模式繞過
 * ✅ 只允許測試帳號使用
 * ✅ 可選的 IP 白名單保護
 * ✅ 完整的安全日誌記錄
 */
