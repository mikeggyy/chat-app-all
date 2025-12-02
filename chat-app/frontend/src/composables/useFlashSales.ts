/**
 * 限時閃購 Composable
 * 處理閃購活動的狀態、倒數計時和購買
 */

import { ref, computed, onMounted, onUnmounted } from "vue";
import { apiJson } from "@/utils/api";
import { logger } from "@/utils/logger";

// 閃購內容類型
interface FlashSaleContents {
  coins?: number;
  photoUnlockCards?: number;
  characterUnlockCards?: number;
  videoUnlockCards?: number;
}

// 閃購類型
export interface FlashSale {
  id: string;
  name: string;
  description: string;
  type: string;
  price: number;
  originalPrice: number;
  currency: string;
  discount: string;
  contents: FlashSaleContents;
  badge: string;
  endTime: string;
  remainingMinutes: number;
  stockLimit: number | null;
  soldCount: number;
  remainingStock: number | null;
  perUserLimit: number;
}

// 購買結果類型
export interface FlashSalePurchaseResult {
  success: boolean;
  saleId: string;
  saleName: string;
  contents: FlashSaleContents;
  newBalance?: number;
  newAssets?: Record<string, number>;
}

// API 響應類型
interface FlashSalesResponse {
  success: boolean;
  sales: FlashSale[];
  count: number;
}

interface EligibilityResponse {
  success: boolean;
  eligible: boolean;
  reason?: string;
  sale?: FlashSale;
  currentPurchaseCount?: number;
}

export function useFlashSales() {
  // 狀態
  const sales = ref<FlashSale[]>([]);
  const loading = ref(false);
  const purchasing = ref(false);
  const error = ref<string | null>(null);

  // 倒數計時器
  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * 獲取所有進行中的閃購
   */
  async function fetchSales(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiJson<FlashSalesResponse>("/api/flash-sales");
      sales.value = response.sales || [];
    } catch (err: any) {
      error.value = err.message || "獲取閃購活動失敗";
      logger.error("[閃購] 獲取失敗:", err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 檢查購買資格
   */
  async function checkEligibility(saleId: string): Promise<EligibilityResponse | null> {
    try {
      const response = await apiJson<EligibilityResponse>(
        `/api/flash-sales/${saleId}/eligibility`
      );
      return response;
    } catch (err: any) {
      logger.error("[閃購] 檢查資格失敗:", err);
      return null;
    }
  }

  /**
   * 購買閃購商品
   */
  async function purchaseSale(
    saleId: string
  ): Promise<FlashSalePurchaseResult | null> {
    purchasing.value = true;
    error.value = null;

    try {
      const idempotencyKey = `flash_sale_${saleId}_${Date.now()}`;

      const result = await apiJson<FlashSalePurchaseResult>("/api/flash-sales/purchase", {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ saleId }),
      });

      // 購買成功，重新載入列表
      await fetchSales();

      return result;
    } catch (err: any) {
      error.value = err.message || "購買失敗";
      logger.error("[閃購] 購買失敗:", err);
      return null;
    } finally {
      purchasing.value = false;
    }
  }

  /**
   * 格式化剩餘時間
   */
  function formatRemainingTime(minutes: number): string {
    if (minutes <= 0) return "已結束";

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}小時 ${mins}分鐘`;
    }
    return `${mins}分鐘`;
  }

  /**
   * 格式化剩餘時間（簡短版）
   */
  function formatRemainingTimeShort(minutes: number): string {
    if (minutes <= 0) return "已結束";

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  /**
   * 計算折扣百分比
   */
  function calculateDiscount(sale: FlashSale): number {
    if (!sale.originalPrice || sale.originalPrice <= sale.price) {
      return 0;
    }
    return Math.round((1 - sale.price / sale.originalPrice) * 100);
  }

  /**
   * 啟動倒數計時更新
   */
  function startCountdown(): void {
    if (countdownInterval) return;

    countdownInterval = setInterval(() => {
      sales.value = sales.value.map(sale => ({
        ...sale,
        remainingMinutes: Math.max(0, sale.remainingMinutes - 1),
      })).filter(sale => sale.remainingMinutes > 0);
    }, 60000); // 每分鐘更新一次
  }

  /**
   * 停止倒數計時
   */
  function stopCountdown(): void {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  // 計算屬性
  const hasActiveSales = computed(() => sales.value.length > 0);

  const firstSale = computed(() => sales.value[0] || null);

  const urgentSales = computed(() =>
    sales.value.filter(sale => sale.remainingMinutes <= 60)
  );

  // 生命週期
  onMounted(() => {
    fetchSales();
    startCountdown();
  });

  onUnmounted(() => {
    stopCountdown();
  });

  return {
    // 狀態
    sales,
    loading,
    purchasing,
    error,

    // 計算屬性
    hasActiveSales,
    firstSale,
    urgentSales,

    // 方法
    fetchSales,
    checkEligibility,
    purchaseSale,
    formatRemainingTime,
    formatRemainingTimeShort,
    calculateDiscount,
    startCountdown,
    stopCountdown,
  };
}
