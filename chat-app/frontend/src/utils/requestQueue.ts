/**
 * 請求隊列工具
 * 確保財務操作順序執行，避免並發導致的數據不一致
 */

import logger from './logger.js';

/**
 * 隊列統計數據
 */
interface QueueStats {
  total: number;
  succeeded: number;
  failed: number;
  queued: number;
}

/**
 * 隊列狀態
 */
interface QueueStatus {
  name: string;
  queueLength: number;
  processing: boolean;
  stats: QueueStats;
}

/**
 * 隊列項目
 */
interface QueueItem<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

/**
 * 請求隊列類
 * 用於串行化處理異步操作，確保同一時間只有一個操作在執行
 */
class RequestQueue {
  private name: string;
  private queue: QueueItem<any>[];
  private processing: boolean;
  private stats: QueueStats;

  constructor(name: string = 'default') {
    this.name = name;
    this.queue = [];
    this.processing = false;
    this.stats = {
      total: 0,
      succeeded: 0,
      failed: 0,
      queued: 0,
    };
  }

  /**
   * 將請求加入隊列
   * @param fn - 要執行的異步函數
   * @returns 操作結果
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.stats.total++;
      this.stats.queued++;

      logger.log(`[請求隊列-${this.name}] 新增請求，隊列長度: ${this.queue.length}`);

      // 觸發處理
      this.process();
    });
  }

  /**
   * 處理隊列中的請求
   */
  private async process(): Promise<void> {
    // 如果正在處理或隊列為空，直接返回
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const item = this.queue.shift();

    if (!item) {
      this.processing = false;
      return;
    }

    const { fn, resolve, reject } = item;
    this.stats.queued--;

    try {
      logger.log(`[請求隊列-${this.name}] 開始處理請求，剩餘: ${this.queue.length}`);

      const result = await fn();

      this.stats.succeeded++;
      logger.log(`[請求隊列-${this.name}] 請求成功`);

      resolve(result);
    } catch (error) {
      this.stats.failed++;
      logger.error(`[請求隊列-${this.name}] 請求失敗:`, error);

      reject(error);
    } finally {
      this.processing = false;

      // 處理下一個請求
      if (this.queue.length > 0) {
        // 使用 setTimeout 確保不會阻塞主線程
        setTimeout(() => this.process(), 0);
      }
    }
  }

  /**
   * 獲取隊列狀態
   */
  getStatus(): QueueStatus {
    return {
      name: this.name,
      queueLength: this.queue.length,
      processing: this.processing,
      stats: { ...this.stats },
    };
  }

  /**
   * 清空隊列
   */
  clear(): void {
    const count = this.queue.length;

    // 拒絕所有待處理的請求
    this.queue.forEach(({ reject }) => {
      reject(new Error('隊列已清空'));
    });

    this.queue = [];
    this.stats.queued = 0;

    logger.log(`[請求隊列-${this.name}] 已清空隊列，移除 ${count} 個待處理請求`);
  }

  /**
   * 重置統計
   */
  resetStats(): void {
    this.stats = {
      total: 0,
      succeeded: 0,
      failed: 0,
      queued: this.queue.length,
    };
  }
}

// 創建不同類型的請求隊列
export const purchaseQueue = new RequestQueue('purchase'); // 購買操作
export const coinQueue = new RequestQueue('coin'); // 金幣操作
export const giftQueue = new RequestQueue('gift'); // 送禮操作

// 導出請求隊列類供自定義使用
export default RequestQueue;

/**
 * 使用示例:
 *
 * import { purchaseQueue } from '@/utils/requestQueue';
 *
 * // 將購買操作加入隊列
 * const result = await purchaseQueue.enqueue(async () => {
 *   return await api.post('/api/purchase', { itemId });
 * });
 */
