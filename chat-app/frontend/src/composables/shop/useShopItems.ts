import { computed, type Ref, type ComputedRef } from "vue";
import { COIN_ICON_PATH } from "../../config/assets";

// ==================== 類型定義 ====================

/**
 * Icon 映射項目
 */
interface IconMapping {
  iconColor: string;
}

/**
 * 金幣套餐原始數據
 */
export interface CoinPackageData {
  id: string;
  name?: string;                    // ✅ 新增：套餐名稱
  description?: string;             // ✅ 新增：套餐描述
  coins: number;
  totalCoins?: number;              // 總金幣數（可選，可計算為 coins + bonus）
  price?: number;
  unitPrice?: number;
  bonus?: number;                   // 改為可選，與 CoinPackage 兼容
  popular?: boolean;
  bestValue?: boolean;
  limitedPurchase?: boolean;        // ✅ 新增：首購限定
  order?: number;                   // ✅ 新增：排序
}

/**
 * 資產套餐原始數據
 */
export interface AssetPackageData {
  id?: string;
  sku?: string;
  category: string;
  baseId?: string;
  displayName?: string;
  name?: string;
  icon?: string | null;
  iconColor?: string;
  unitPrice?: number;
  finalPrice?: number;
  quantity?: number;
  popular?: boolean;
  badge?: string | null;
  originalPrice?: number | null;
  order?: number; // 排序順序
}

/**
 * 藥水套餐原始數據
 */
export interface PotionPackageData {
  id: string;
  baseId?: string;
  displayName?: string;
  name?: string;
  description?: string;
  effect?: string | { displayText?: string };
  icon?: string | null;
  iconColor?: string;
  unitPrice: number;
  quantity?: number;
  popular?: boolean;
  badge?: string | null;
  originalPrice?: number | null;
  order?: number; // 排序順序
}

/**
 * 禮包購買狀態
 */
interface BundlePurchaseStatus {
  canPurchase: boolean;
  reason?: string | null;
  nextAvailableAt?: Date | string | null;
  purchaseCount: number;
  lastPurchaseAt?: Date | string | null;
}

/**
 * 組合禮包原始數據
 */
export interface BundlePackageData {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  order?: number;
  contents: {
    coins?: number;
    photoUnlockCards?: number;
    videoUnlockCards?: number;
    characterUnlockCards?: number;
    characterCreationCards?: number;
    voiceUnlockCards?: number;
  };
  badge?: string | null;
  popular?: boolean;
  bestValue?: boolean;
  purchaseLimit?: "once" | "monthly" | "weekly" | "none";
  purchaseStatus?: BundlePurchaseStatus | null;
}

/**
 * 商品項目（統一格式）
 */
export interface ShopItem {
  id: string;
  category: string;
  name: string;
  icon?: string | null;
  emoji?: string | null;
  iconColor?: string;
  price: number;
  quantity?: number;
  popular?: boolean;
  badge?: string | null;
  originalPrice?: number | null;
  // 金幣專用
  isCoinPackage?: boolean;
  coinData?: CoinPackageData;
  bonusText?: string | null;
  useCoinImage?: boolean;
  limitedPurchase?: boolean;        // ✅ 新增：首購限定
  // 藥水專用
  description?: string;
  effect?: string;
  requiresCharacter?: boolean;
  // 組合禮包專用
  isBundlePackage?: boolean;
  bundleData?: BundlePackageData;
  currency?: string;
  contents?: BundlePackageData["contents"];
  purchaseStatus?: BundlePurchaseStatus | null;
  purchaseLimit?: "once" | "monthly" | "weekly" | "none";  // ✅ 新增：限購類型
  // 排序
  order?: number;
}

/**
 * useShopItems 依賴參數
 */
export interface UseShopItemsDeps {
  packages: Ref<CoinPackageData[]>;
  assetPackages: Ref<AssetPackageData[]>;
  potionPackages: Ref<PotionPackageData[]>;
  bundlePackages: Ref<BundlePackageData[]>;
  activeCategory: Ref<string>;
}

/**
 * useShopItems 返回類型
 */
export interface UseShopItemsReturn {
  // Computed
  coinItems: ComputedRef<ShopItem[]>;
  assetCardItems: ComputedRef<ShopItem[]>;
  potionItems: ComputedRef<ShopItem[]>;
  bundleItems: ComputedRef<ShopItem[]>;
  allItems: ComputedRef<ShopItem[]>;
  filteredItems: ComputedRef<ShopItem[]>;
  // Constants
  COIN_ICON_PATH: string;
}

// ==================== 主函數 ====================

/**
 * 商品數據轉換和過濾 Composable
 * 處理不同類型商品的格式化和過濾邏輯
 */
export function useShopItems(
  packages: Ref<CoinPackageData[]>,
  assetPackages: Ref<AssetPackageData[]>,
  potionPackages: Ref<PotionPackageData[]>,
  bundlePackages: Ref<BundlePackageData[]>,
  activeCategory: Ref<string>
): UseShopItemsReturn {
  // Icon 映射表（根據 category 轉換為正確的 iconColor）
  const ICON_MAPPING: Record<string, IconMapping> = {
    character_unlock: { iconColor: "character" },
    photo_unlock: { iconColor: "photo" },
    video_unlock: { iconColor: "video" },
    voice_unlock: { iconColor: "voice" },
    create_character: { iconColor: "create" },
  };

  // 藥水 Icon 映射表
  const POTION_ICON_MAPPING: Record<string, IconMapping> = {
    memory_boost: { iconColor: "memory" },
    brain_boost: { iconColor: "brain" },
  };

  /**
   * 判斷字符串是否為 emoji
   * @param str - 要判斷的字符串
   * @returns {boolean}
   */
  const isEmoji = (str: string | null | undefined): boolean => {
    return !!str && str.length <= 2 && !/^[a-zA-Z]/.test(str);
  };

  /**
   * 金幣套餐轉為商品格式
   */
  const coinItems = computed<ShopItem[]>(() => {
    const pkgs: CoinPackageData[] =
      packages.value && packages.value.length > 0
        ? packages.value
        : [
            { id: "small", coins: 100, totalCoins: 100, price: 50, bonus: 0 },
            { id: "medium", coins: 500, totalCoins: 550, price: 200, bonus: 50 },
            {
              id: "large",
              coins: 1000,
              totalCoins: 1150,
              price: 350,
              bonus: 150,
              popular: true,
            },
            {
              id: "xlarge",
              coins: 3000,
              totalCoins: 3500,
              price: 1000,
              bonus: 500,
              bestValue: true,
            },
          ];

    // ✅ 修復：按照 order 欄位排序（雙重保險）
    const sortedPkgs = [...pkgs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return sortedPkgs.map((pkg) => ({
      id: `coin-${pkg.id}`,
      category: "coins",
      // ✅ 修復：優先使用套餐名稱，若無則顯示金幣數量
      name: pkg.name || `${pkg.totalCoins || pkg.coins} 金幣`,
      description: pkg.description || "",
      icon: null, // 金幣使用圖片而非 icon 組件
      iconColor: "coins",
      price: pkg.unitPrice || pkg.price || 0, // 支援統一欄位 unitPrice 和舊欄位 price
      isCoinPackage: true,
      coinData: pkg,
      popular: pkg.popular || false,
      badge: pkg.bestValue ? "超值" : pkg.popular ? "熱門" : null,
      bonusText: (pkg.bonus ?? 0) > 0 ? `+${pkg.bonus} 贈送` : null,
      useCoinImage: true, // 使用金幣圖片
      limitedPurchase: pkg.limitedPurchase || false, // ✅ 新增：首購限定標記
    }));
  });

  /**
   * 資產卡片商品（從 API 加載）
   */
  const assetCardItems = computed<ShopItem[]>(() => {
    const items = assetPackages.value.map((pkg) => {
      // 從 category 或 baseId 中提取 iconColor
      const mapping: IconMapping =
        ICON_MAPPING[pkg.category] || ICON_MAPPING[pkg.baseId || ""] || { iconColor: "character" };

      const iconValue = pkg.icon || null;
      const isIconEmoji = isEmoji(iconValue);

      return {
        id: pkg.id || pkg.sku || "",
        category: pkg.category,
        name: pkg.displayName || pkg.name || "",
        emoji: isIconEmoji ? iconValue : null, // emoji 放到 emoji 屬性
        icon: isIconEmoji ? null : iconValue, // 組件名放到 icon 屬性
        iconColor: mapping.iconColor || pkg.iconColor || "character",
        price: pkg.unitPrice || pkg.finalPrice || 0,
        quantity: pkg.quantity || 1,
        popular: pkg.popular || false,
        badge: pkg.badge || null,
        originalPrice: pkg.originalPrice || null,
        order: pkg.order ?? 0, // 排序順序
      };
    });

    // ✅ 修復：按照 order 欄位排序（雙重保險）
    return items.sort((a, b) => (a.order || 0) - (b.order || 0));
  });

  /**
   * 道具商品（從 API 加載）
   */
  const potionItems = computed<ShopItem[]>(() => {
    const items = potionPackages.value.map((potion) => {
      const mapping: IconMapping = POTION_ICON_MAPPING[potion.baseId || ""] || { iconColor: "memory" };

      const iconValue = potion.icon || null;
      const isIconEmoji = isEmoji(iconValue);

      // 處理 effect 可能是字符串或對象
      const effectText = typeof potion.effect === "string"
        ? potion.effect
        : potion.effect?.displayText || "";

      return {
        id: potion.id,
        category: "potions",
        name: potion.displayName || potion.name || "",
        description: potion.description,
        effect: effectText,
        emoji: isIconEmoji ? iconValue : null,
        icon: isIconEmoji ? null : iconValue,
        iconColor: mapping.iconColor || potion.iconColor || "memory",
        price: potion.unitPrice,
        quantity: potion.quantity || 1,
        popular: potion.popular || false,
        badge: potion.badge || null,
        requiresCharacter: false,
        originalPrice: potion.originalPrice || null,
        order: potion.order ?? 0, // 排序順序
      };
    });

    // ✅ 修復：按照 order 欄位排序（雙重保險）
    return items.sort((a, b) => (a.order || 0) - (b.order || 0));
  });

  /**
   * 組合禮包商品（從 API 加載）
   * 一次性禮包（purchaseLimit: "once"）購買後會被隱藏
   */
  const bundleItems = computed<ShopItem[]>(() => {
    // 過濾：一次性禮包購買後不顯示
    const visibleBundles = bundlePackages.value.filter((bundle) => {
      if (bundle.purchaseLimit === "once") {
        // 一次性禮包：只有可購買時才顯示
        return bundle.purchaseStatus?.canPurchase !== false;
      }
      // 其他限購類型都顯示
      return true;
    });

    const items = visibleBundles.map((bundle) => {
      // 生成禮包內容描述
      const contentParts: string[] = [];
      if (bundle.contents.coins) {
        contentParts.push(`${bundle.contents.coins} 金幣`);
      }
      if (bundle.contents.photoUnlockCards) {
        contentParts.push(`${bundle.contents.photoUnlockCards} 張照片卡`);
      }
      if (bundle.contents.videoUnlockCards) {
        contentParts.push(`${bundle.contents.videoUnlockCards} 張影片卡`);
      }
      if (bundle.contents.characterUnlockCards) {
        contentParts.push(`${bundle.contents.characterUnlockCards} 張角色解鎖券`);
      }
      if (bundle.contents.characterCreationCards) {
        contentParts.push(`${bundle.contents.characterCreationCards} 張創建角色卡`);
      }
      if (bundle.contents.voiceUnlockCards) {
        contentParts.push(`${bundle.contents.voiceUnlockCards} 張語音卡`);
      }

      return {
        id: `bundle-${bundle.id}`,
        category: "bundles",
        name: bundle.name,
        description: bundle.description || contentParts.join(" + "),
        icon: null,
        emoji: "🎁",
        iconColor: "bundle",
        price: bundle.price,
        currency: bundle.currency || "TWD",
        popular: bundle.popular || false,
        badge: bundle.badge || (bundle.bestValue ? "💎 最超值" : null),
        isBundlePackage: true,
        bundleData: bundle,
        contents: bundle.contents,
        order: bundle.order || 0,
        purchaseStatus: bundle.purchaseStatus || null,
        purchaseLimit: bundle.purchaseLimit || "none",  // ✅ 新增：傳遞限購類型
      };
    });

    // 按照 order 欄位排序
    return items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  /**
   * 合併所有商品
   */
  const allItems = computed<ShopItem[]>(() => {
    return [...coinItems.value, ...bundleItems.value, ...assetCardItems.value, ...potionItems.value];
  });

  /**
   * 過濾當前分類的商品
   */
  const filteredItems = computed<ShopItem[]>(() => {
    return allItems.value.filter(
      (item) => item.category === activeCategory.value
    );
  });

  return {
    // Computed
    coinItems,
    assetCardItems,
    potionItems,
    bundleItems,
    allItems,
    filteredItems,

    // Constants
    COIN_ICON_PATH,
  };
}
