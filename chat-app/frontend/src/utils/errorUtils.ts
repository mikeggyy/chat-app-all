/**
 * 錯誤處理工具函數
 * 提供類型安全的錯誤訊息提取
 */

/**
 * 從未知錯誤中提取錯誤訊息
 * 類型安全的工具函數，用於替代 (error as any)?.message 模式
 * @param error - 未知類型的錯誤
 * @param fallback - 當無法提取訊息時的預設值
 * @returns 錯誤訊息字符串
 */
export function getErrorMessage(error: unknown, fallback = '發生未知錯誤'): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || fallback;
  if (error !== null && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string') return msg || fallback;
  }
  return fallback;
}
