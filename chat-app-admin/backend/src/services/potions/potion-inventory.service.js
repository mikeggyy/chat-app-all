import { db, auth } from "../../firebase/index.js";

/**
 * 藥水庫存服務模塊
 * 處理用戶藥水庫存的設置和管理
 */

/**
 * 直接設置用戶的藥水庫存數量（兩階段系統）
 *
 * @param {string} userId - 用戶 ID
 * @param {Object} inventory - 庫存數量
 * @param {number} inventory.memoryBoost - 記憶增強藥水數量
 * @param {number} inventory.brainBoost - 腦力激盪藥水數量
 * @returns {Promise<Object>} 更新結果
 * @throws {Error} 操作失敗時拋出錯誤
 */
export const setInventory = async (userId, inventory) => {
  const { memoryBoost, brainBoost } = inventory;

  // 檢查參數
  if (typeof memoryBoost !== "number" || typeof brainBoost !== "number") {
    throw new Error("庫存數量必須是數字");
  }

  if (memoryBoost < 0 || brainBoost < 0) {
    throw new Error("庫存數量不能為負數");
  }

  // 檢查用戶是否存在
  try {
    await auth.getUser(userId);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new Error("用戶不存在");
    }
    throw error;
  }

  // 直接設置庫存數量
  await db
    .collection("usage_limits")
    .doc(userId)
    .set(
      {
        potionInventory: {
          memoryBoost,
          brainBoost,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

  return {
    message: "藥水庫存更新成功",
    inventory: {
      memoryBoost,
      brainBoost,
    },
  };
};
