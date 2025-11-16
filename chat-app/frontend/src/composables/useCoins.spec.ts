/**
 * useCoins Composable 簡化測試
 *
 * 測試範圍：
 * - 金幣餘額加載
 * - 金幣套餐加載和排序
 * - 金幣購買（冪等性、隊列）
 * - Computed 屬性
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';

// Mock dependencies
vi.mock('../utils/api', () => ({
  apiJson: vi.fn(),
}));

vi.mock('../utils/idempotency.js', () => ({
  generateIdempotencyKey: vi.fn(() => 'mock-idempotency-key'),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../utils/requestQueue.js', () => ({
  coinQueue: {
    enqueue: vi.fn((fn: () => Promise<any>) => fn()), // 直接執行函數
  },
}));

interface CoinPackage {
  id: string;
  coins: number;
  order?: number;
  popular?: boolean;
  bestValue?: boolean;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
}

describe('useCoins - 金幣系統測試', () => {
  let useCoins: any;
  let apiJson: Mock;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const { apiJson: mockApiJson } = await import('../utils/api');
    apiJson = mockApiJson as Mock;

    const { useCoins: composable } = await import('./useCoins.js');
    useCoins = composable;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('初始狀態', () => {
    it('應該初始化為空狀態', () => {
      const coins = useCoins();

      expect(coins.balance.value).toBe(0);
      expect(coins.packages.value).toEqual([]);
      expect(coins.transactions.value).toEqual([]);
      expect(coins.isLoading.value).toBe(false);
      expect(coins.error.value).toBeNull();
    });
  });

  describe('loadBalance', () => {
    it('應該成功加載金幣餘額', async () => {
      const coins = useCoins();
      apiJson.mockResolvedValueOnce({ balance: 1000 });

      await coins.loadBalance();

      expect(apiJson).toHaveBeenCalledWith('/api/coins/balance', expect.any(Object));
      expect(coins.balance.value).toBe(1000);
      expect(coins.isLoading.value).toBe(false);
    });

    it('應該處理加載失敗', async () => {
      const coins = useCoins();
      apiJson.mockRejectedValueOnce(new Error('Network error'));

      await expect(coins.loadBalance()).rejects.toThrow('Network error');
      expect(coins.error.value).toBe('Network error');
    });
  });

  describe('loadPackages', () => {
    it('應該成功加載並排序金幣套餐', async () => {
      const coins = useCoins();
      const mockPackages: CoinPackage[] = [
        { id: 'large', coins: 1000, order: 3 },
        { id: 'small', coins: 100, order: 1 },
        { id: 'medium', coins: 500, order: 2 },
      ];

      apiJson.mockResolvedValueOnce({ packages: mockPackages });

      await coins.loadPackages();

      // 應該按 order 排序
      expect(coins.packages.value[0].id).toBe('small');
      expect(coins.packages.value[1].id).toBe('medium');
      expect(coins.packages.value[2].id).toBe('large');
    });

    it('應該處理沒有 order 欄位的套餐', async () => {
      const coins = useCoins();
      apiJson.mockResolvedValueOnce({
        packages: [
          { id: 'a', coins: 100 },
          { id: 'b', coins: 200, order: 1 },
        ],
      });

      await coins.loadPackages();

      expect(coins.packages.value).toHaveLength(2);
    });
  });

  describe('purchasePackage', () => {
    it('應該成功購買金幣套餐（增量更新）', async () => {
      const coins = useCoins();
      apiJson
        .mockResolvedValueOnce({ balance: 100 }) // loadBalance
        .mockResolvedValueOnce({ coinsAdded: 500, newBalance: 600 }); // purchase

      await coins.loadBalance();
      await coins.purchasePackage(null, 'small');

      expect(coins.balance.value).toBe(600); // 100 + 500
    });

    it('應該支持絕對值更新（fallback）', async () => {
      const coins = useCoins();
      apiJson.mockResolvedValueOnce({ newBalance: 1000 });

      await coins.purchasePackage(null, 'medium');

      expect(coins.balance.value).toBe(1000);
    });

    it('應該在未提供 packageId 時拋出錯誤', async () => {
      const coins = useCoins();

      await expect(coins.purchasePackage(null, null)).rejects.toThrow('需要提供套餐 ID');
      expect(coins.error.value).toBe('需要提供套餐 ID');
    });

    it('應該包含冪等性鍵', async () => {
      const coins = useCoins();
      apiJson.mockResolvedValueOnce({ newBalance: 500 });

      await coins.purchasePackage(null, 'small');

      expect(apiJson).toHaveBeenCalledWith(
        '/api/coins/purchase/package',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            packageId: 'small',
            idempotencyKey: 'mock-idempotency-key',
          }),
        })
      );
    });

    it('應該處理冪等性響應', async () => {
      const coins = useCoins();
      apiJson.mockResolvedValueOnce({
        newBalance: 500,
        _idempotent: true,
        _cached: true,
      });

      await coins.purchasePackage(null, 'small');

      expect(coins.balance.value).toBe(500);
    });
  });

  describe('Computed 屬性', () => {
    it('formattedBalance 應該正確格式化', async () => {
      const coins = useCoins();
      apiJson.mockResolvedValueOnce({ balance: 1234567 });

      await coins.loadBalance();

      expect(coins.formattedBalance.value).toContain('1');
      expect(coins.formattedBalance.value).toContain('234');
      expect(coins.formattedBalance.value).toContain('567');
    });

    it('popularPackage 應該返回標記為 popular 的套餐', async () => {
      const coins = useCoins();
      apiJson.mockResolvedValueOnce({
        packages: [
          { id: 'small', coins: 100 },
          { id: 'medium', coins: 500, popular: true },
          { id: 'large', coins: 1000 },
        ],
      });

      await coins.loadPackages();

      expect(coins.popularPackage.value.id).toBe('medium');
    });

    it('bestValuePackage 應該返回標記為 bestValue 的套餐', async () => {
      const coins = useCoins();
      apiJson.mockResolvedValueOnce({
        packages: [
          { id: 'small', coins: 100 },
          { id: 'large', coins: 1000, bestValue: true },
        ],
      });

      await coins.loadPackages();

      expect(coins.bestValuePackage.value.id).toBe('large');
    });
  });

  describe('工具函數', () => {
    it('hasEnoughCoins 應該正確判斷', async () => {
      const coins = useCoins();
      apiJson.mockResolvedValueOnce({ balance: 500 });

      await coins.loadBalance();

      expect(coins.hasEnoughCoins(300)).toBe(true);
      expect(coins.hasEnoughCoins(500)).toBe(true);
      expect(coins.hasEnoughCoins(600)).toBe(false);
    });
  });

  describe('loadTransactions', () => {
    it('應該成功加載交易記錄', async () => {
      const coins = useCoins();
      const mockTransactions: Transaction[] = [
        { id: 'tx1', amount: 100, type: 'purchase' },
        { id: 'tx2', amount: -50, type: 'spend' },
      ];

      apiJson.mockResolvedValueOnce({ transactions: mockTransactions });

      await coins.loadTransactions();

      expect(coins.transactions.value).toEqual(mockTransactions);
    });
  });

  describe('loadPricing', () => {
    it('應該成功加載功能定價', async () => {
      const coins = useCoins();
      const mockPricing = {
        voice: 10,
        photo: 50,
        gift: 100,
      };

      apiJson.mockResolvedValueOnce(mockPricing);

      const result = await coins.loadPricing();

      expect(result).toEqual(mockPricing);
    });
  });
});
