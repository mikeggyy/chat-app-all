// @ts-nocheck
import { ref, type Ref } from "vue";
import { useToast } from "../useToast.js";
import { usePurchaseConfirm } from "../usePurchaseConfirm.js";
import { useGuestGuard } from "../useGuestGuard.js";
import { apiJson } from "../../utils/api.js";
import { logger } from "../../utils/logger.js";
import { purchaseQueue } from "../../utils/requestQueue.js";
import type { User, MembershipInfo } from "../../types/index.js";

/**
 * 金幣套餐數據
 */
export interface CoinPackageData {
  id: string;
  coins: number;
  totalCoins: number;
  price: number;
  unitPrice: number;
  bonus: number;
}

/**
 * 資產商品數據
 */
export interface ShopItem {
  id: string;
  name: string;
  fullName?: string;
  price: number;
  originalPrice?: number;
  badge?: string;
  category: string;
  quantity?: number;
  effect?: string;
  isCoinPackage?: boolean;
  coinData?: CoinPackageData;
}

/**
 * useShopPurchase 依賴項
 */
export interface UseShopPurchaseOptions {
  user: Ref<User | null>;
  balance: Ref<number>;
  membership: Ref<MembershipInfo | null>;
  activeCategory: Ref<string>;
  loadBalance: (userId: string, options?: { skipGlobalLoading?: boolean }) => Promise<void>;
  purchasePackage: (userId: string, packageId: string, options?: { paymentMethod?: string }) => Promise<void>;
}

/**
 * useShopPurchase 返回類型
 */
export interface UseShopPurchaseReturn {
  isPurchasing: Ref<boolean>;
  isPurchasingItem: Ref<boolean>;
  handlePurchase: (item: ShopItem) => Promise<void>;
  handlePurchaseCoin: (pkg: CoinPackageData) => Promise<void>;
  handlePurchaseItem: (item: ShopItem) => Promise<void>;
  handlePurchasePotion: (item: ShopItem) => Promise<void>;
}

/**
 * 商城購買邏輯 Composable
 * 處理金幣、資產卡、道具的購買流程
 */
export function useShopPurchase(options: UseShopPurchaseOptions = {} as UseShopPurchaseOptions): UseShopPurchaseReturn {
  const {
    user,
    balance,
    membership,
    activeCategory,
    loadBalance,
    purchasePackage,
  } = options;

  const { success, error: showError } = useToast();
  const { showConfirm } = usePurchaseConfirm();
  const { requireLogin } = useGuestGuard();

  const isPurchasing = ref(false);
  const isPurchasingItem = ref(false);

  /**
   * 購買金幣套餐
   * @param pkg - 金幣套餐數據
   */
  const handlePurchaseCoin = async (pkg: CoinPackageData): Promise<void> => {
    if (!pkg || isPurchasing.value) {
      return;
    }

    if (!user.value?.id) {
      showError("請先登入");
      return;
    }

    if (requireLogin({ feature: "購買金幣" })) {
      return;
    }

    // 確認購買
    const confirmMessage = `確定要購買 ${
      pkg.totalCoins || pkg.coins
    } 金幣嗎？\n價格：${pkg.unitPrice || pkg.price} 元${
      pkg.bonus > 0 ? `\n贈送：${pkg.bonus} 金幣` : ""
    }`;
    const confirmed = await showConfirm(confirmMessage, {
      title: "確認購買金幣",
      confirmText: "立即購買",
    });

    if (!confirmed) {
      return;
    }

    isPurchasing.value = true;

    try {
      await purchasePackage(user.value.id, pkg.id, {
        paymentMethod: "credit_card",
      });

      await loadBalance(user.value.id, { skipGlobalLoading: true });

      success(`成功購買 ${pkg.totalCoins || pkg.coins} 金幣！`, {
        title: "購買成功",
      });
    } catch (err: any) {
      const message = err?.message || "購買失敗，請稍後再試";
      showError(message);
    } finally {
      isPurchasing.value = false;
    }
  };

  /**
   * 購買資產商品（解鎖卡等）
   * @param item - 資產商品數據
   */
  const handlePurchaseItem = async (item: ShopItem): Promise<void> => {
    if (!item || isPurchasingItem.value) {
      return;
    }

    if (!user.value?.id) {
      showError("請先登入");
      return;
    }

    if (requireLogin({ feature: "購買商品" })) {
      return;
    }

    if (balance.value < item.price) {
      showError("金幣不足，請先儲值");
      // 切換到金幣分類
      activeCategory.value = "coins";
      return;
    }

    // 如果是道具類別，需要特殊處理
    if (item.category === "potions") {
      return handlePurchasePotion(item);
    }

    // 確認購買
    const itemName = item.fullName || item.name;
    const confirmMessage = `確定要購買 ${itemName} 嗎？\n價格：${
      item.price
    } 金幣${
      item.originalPrice
        ? `\n原價：${item.originalPrice} 金幣 (${item.badge})`
        : ""
    }`;
    const confirmed = await showConfirm(confirmMessage, {
      title: "確認購買",
      confirmText: "立即購買",
    });

    if (!confirmed) {
      return;
    }

    isPurchasingItem.value = true;

    try {
      // ✅ 使用請求隊列確保購買操作順序執行，避免並發衝突
      const result = await purchaseQueue.enqueue(async () => {
        // 構建 SKU
        // 資產卡：構建為 category-quantity（例如 character-unlock-5）
        const sku = `${item.category}-${item.quantity || 1}`;

        logger.log("[購買資產] item:", item);
        logger.log("[購買資產] sku:", sku);
        logger.log("[購買資產] price:", item.price);

        // 呼叫資產購買 API（使用新版 SKU）
        return await apiJson("/api/assets/purchase", {
          method: "POST",
          body: {
            sku: sku,
          },
        });
      });

      if (result.success) {
        // 更新金幣餘額（跳過全域loading避免閃爍）
        await loadBalance(user.value.id, { skipGlobalLoading: true });

        success(`成功購買 ${item.name}！`);
      } else {
        throw new Error(result.message || "購買失敗");
      }
    } catch (error: any) {
      showError(error?.message || "購買失敗，請稍後再試");
    } finally {
      isPurchasingItem.value = false;
    }
  };

  /**
   * 購買藥水道具（使用統一的 SKU 格式）
   * @param item - 藥水商品數據
   */
  const handlePurchasePotion = async (item: ShopItem): Promise<void> => {
    if (isPurchasingItem.value) {
      return;
    }

    // 檢查是否是腦力激盪藥水且用戶是VVIP
    if (
      item.id.includes("brain_boost") &&
      membership.value?.tier === "vvip"
    ) {
      showError("您的模型已經是最高級了");
      return;
    }

    // 確認購買
    const confirmMessage = `確定要購買 ${item.name} 嗎？\n價格：${
      item.price
    } 金幣${
      item.originalPrice
        ? `\n原價：${item.originalPrice} 金幣 (${item.badge})`
        : ""
    }\n效果：${item.effect}`;
    const confirmed = await showConfirm(confirmMessage, {
      title: "確認購買道具",
      confirmText: "立即購買",
    });

    if (!confirmed) {
      return;
    }

    isPurchasingItem.value = true;

    try {
      // ✅ 使用請求隊列確保購買操作順序執行，避免並發衝突
      const result = await purchaseQueue.enqueue(async () => {
        // 使用統一的資產購買 API（SKU 格式）
        return await apiJson("/api/assets/purchase", {
          method: "POST",
          body: {
            sku: item.id, // 藥水的 SKU (例如：memory_boost_1, brain_boost_5)
          },
        });
      });

      if (result.success) {
        // 更新金幣餘額（跳過全域loading避免閃爍）
        await loadBalance(user.value.id, { skipGlobalLoading: true });

        success(`成功購買 ${item.name}！已加入庫存`);
      } else {
        throw new Error(result.message || "購買失敗");
      }
    } catch (error: any) {
      showError(error?.message || "購買失敗，請稍後再試");
    } finally {
      isPurchasingItem.value = false;
    }
  };

  /**
   * 統一購買處理
   * @param item - 商品數據
   */
  const handlePurchase = async (item: ShopItem): Promise<void> => {
    if (item.isCoinPackage) {
      await handlePurchaseCoin(item.coinData!);
    } else {
      await handlePurchaseItem(item);
    }
  };

  return {
    // State
    isPurchasing,
    isPurchasingItem,

    // Methods
    handlePurchase,
    handlePurchaseCoin,
    handlePurchaseItem,
    handlePurchasePotion,
  };
}
