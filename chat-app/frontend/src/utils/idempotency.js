/**
 * 冪等性工具
 * 為支付操作生成唯一的冪等性鍵
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 生成冪等性鍵（使用 UUID v4）
 * 用於支付操作等需要防止重複執行的請求
 * @returns {string} UUID v4 格式的冪等性鍵
 *
 * @example
 * const idempotencyKey = generateIdempotencyKey();
 * // 返回: "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateIdempotencyKey() {
  return uuidv4();
}

/**
 * 為特定操作生成冪等性鍵
 * @param {string} operation - 操作類型（如 'coin-package', 'membership-upgrade'）
 * @param {Object} params - 額外參數
 * @returns {string} 冪等性鍵
 *
 * @example
 * const key = generateOperationIdempotencyKey('coin-package', { packageId: 'large' });
 * // 返回: UUID v4 字符串
 */
export function generateOperationIdempotencyKey(operation, params = {}) {
  // 每次都生成新的 UUID，不管參數如何
  // 這確保每次操作都是獨立的
  return generateIdempotencyKey();
}

export default {
  generateIdempotencyKey,
  generateOperationIdempotencyKey,
};
