/**
 * 特殊優惠 Composable
 * 處理首購優惠、回歸用戶優惠的狀態和購買
 */

import { ref, computed, onMounted } from "vue";
import { apiJson } from "@/utils/api";
import { logger } from "@/utils/logger";

// 優惠內容類型
interface OfferContents {
  coins?: number;
  photoUnlockCards?: number;
  characterUnlockCards?: number;
  videoUnlockCards?: number;
}

// 單一優惠類型
interface SpecialOffer {
  type: "first_purchase" | "returning_user";
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  currency: string;
  discount: string;
  contents: OfferContents;
  badge: string;
  validUntil: string;
  remainingHours: number;
  remainingDays?: number;
  priority: number;
}

// API 回應類型
interface SpecialOffersResponse {
  hasOffers: boolean;
  offers: SpecialOffer[];
  firstPurchase: {
    eligible: boolean;
    reason?: string;
    offer?: SpecialOffer;
    validUntil?: string;
    remainingHours?: number;
    remainingDays?: number;
  };
  returningUser: {
    eligible: boolean;
    reason?: string;
    offer?: SpecialOffer;
    validUntil?: string;
    remainingHours?: number;
  };
}

// 購買結果類型
interface PurchaseResult {
  success: boolean;
  offerType: string;
  offerName: string;
  price: number;
  contents: OfferContents;
  newBalance: number;
  newAssets: Record<string, number>;
}

export function useSpecialOffers() {
  // 狀態
  const offers = ref<SpecialOffer[]>([]);
  const hasOffers = computed(() => offers.value.length > 0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const purchasing = ref(false);

  // 首購優惠
  const firstPurchaseOffer = computed(() =>
    offers.value.find((o) => o.type === "first_purchase")
  );
  const hasFirstPurchaseOffer = computed(() => !!firstPurchaseOffer.value);

  // 回歸優惠
  const returningUserOffer = computed(() =>
    offers.value.find((o) => o.type === "returning_user")
  );
  const hasReturningUserOffer = computed(() => !!returningUserOffer.value);

  // 獲取優先顯示的優惠（用於彈窗）
  const primaryOffer = computed(() => {
    if (offers.value.length === 0) return null;
    // 按優先級排序，返回最高優先級的
    return [...offers.value].sort((a, b) => a.priority - b.priority)[0];
  });

  /**
   * 載入所有可用優惠
   */
  async function fetchOffers(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiJson<SpecialOffersResponse>("/api/offers");
      offers.value = response.offers || [];
    } catch (err: any) {
      error.value = err.message || "獲取優惠失敗";
      logger.error("[特殊優惠] 獲取失敗:", err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 激活回歸用戶優惠（登入時調用）
   */
  async function activateReturningOffer(): Promise<boolean> {
    try {
      const response = await apiJson<{ activated: boolean; reason?: string }>(
        "/api/offers/activate-returning",
        { method: "POST" }
      );

      if (response.activated) {
        // 重新載入優惠列表
        await fetchOffers();
        return true;
      }
      return false;
    } catch (err: any) {
      logger.error("[回歸優惠] 激活失敗:", err);
      return false;
    }
  }

  /**
   * 購買特殊優惠
   */
  async function purchaseOffer(
    offerType: "first_purchase" | "returning_user"
  ): Promise<PurchaseResult | null> {
    purchasing.value = true;
    error.value = null;

    try {
      const idempotencyKey = `purchase_offer_${offerType}_${Date.now()}`;

      const result = await apiJson<PurchaseResult>("/api/offers/purchase", {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ offerType }),
      });

      // 購買成功，重新載入優惠列表
      await fetchOffers();

      return result;
    } catch (err: any) {
      error.value = err.message || "購買失敗";
      logger.error("[特殊優惠] 購買失敗:", err);
      return null;
    } finally {
      purchasing.value = false;
    }
  }

  /**
   * 格式化剩餘時間
   */
  function formatRemainingTime(hours: number, days?: number): string {
    if (days && days > 0) {
      return `剩餘 ${days} 天`;
    }
    if (hours >= 24) {
      const d = Math.floor(hours / 24);
      const h = hours % 24;
      return h > 0 ? `剩餘 ${d} 天 ${h} 小時` : `剩餘 ${d} 天`;
    }
    if (hours > 0) {
      return `剩餘 ${hours} 小時`;
    }
    return "即將到期";
  }

  /**
   * 格式化優惠內容為顯示文字
   */
  function formatContents(contents: OfferContents): string[] {
    const items: string[] = [];
    if (contents.coins) items.push(`${contents.coins} 金幣`);
    if (contents.photoUnlockCards)
      items.push(`${contents.photoUnlockCards} 張照片解鎖卡`);
    if (contents.characterUnlockCards)
      items.push(`${contents.characterUnlockCards} 張角色解鎖卡`);
    if (contents.videoUnlockCards)
      items.push(`${contents.videoUnlockCards} 張影片解鎖卡`);
    return items;
  }

  /**
   * 檢查是否應該顯示優惠彈窗
   * 基於 localStorage 記錄，避免重複顯示
   */
  function shouldShowOfferModal(): boolean {
    if (!hasOffers.value) return false;

    const lastShown = localStorage.getItem("lastOfferModalShown");
    const today = new Date().toDateString();

    // 每天只顯示一次
    if (lastShown === today) {
      return false;
    }

    return true;
  }

  /**
   * 記錄已顯示優惠彈窗
   */
  function markOfferModalShown(): void {
    localStorage.setItem("lastOfferModalShown", new Date().toDateString());
  }

  // 自動載入
  onMounted(() => {
    fetchOffers();
  });

  return {
    // 狀態
    offers,
    hasOffers,
    loading,
    error,
    purchasing,

    // 計算屬性
    firstPurchaseOffer,
    hasFirstPurchaseOffer,
    returningUserOffer,
    hasReturningUserOffer,
    primaryOffer,

    // 方法
    fetchOffers,
    activateReturningOffer,
    purchaseOffer,
    formatRemainingTime,
    formatContents,
    shouldShowOfferModal,
    markOfferModalShown,
  };
}

export type { SpecialOffer, OfferContents, PurchaseResult };
