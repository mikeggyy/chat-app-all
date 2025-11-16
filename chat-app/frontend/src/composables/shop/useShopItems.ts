// @ts-nocheck
import { computed, ref, type Ref, type ComputedRef } from "vue";
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
interface CoinPackageData {
  id: string;
  coins: number;
  totalCoins: number;
  price?: number;
  unitPrice?: number;
  bonus: number;
  popular?: boolean;
  bestValue?: boolean;
}

/**
 * 資產套餐原始數據
 */
interface AssetPackageData {
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
}

/**
 * 藥水套餐原始數據
 */
interface PotionPackageData {
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
  // 藥水專用
  description?: string;
  effect?: string;
  requiresCharacter?: boolean;
}

/**
 * useShopItems 依賴參數
 */
export interface UseShopItemsDeps {
  packages: Ref<CoinPackageData[]>;
  assetPackages: Ref<AssetPackageData[]>;
  potionPackages: Ref<PotionPackageData[]>;
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

    return pkgs.map((pkg) => ({
      id: `coin-${pkg.id}`,
      category: "coins",
      name: `${pkg.totalCoins || pkg.coins} 金幣`,
      icon: null, // 金幣使用圖片而非 icon 組件
      iconColor: "coins",
      price: pkg.unitPrice || pkg.price || 0, // 支援統一欄位 unitPrice 和舊欄位 price
      isCoinPackage: true,
      coinData: pkg,
      popular: pkg.popular || false,
      badge: pkg.bestValue ? "超值" : pkg.popular ? "熱門" : null,
      bonusText: pkg.bonus > 0 ? `+${pkg.bonus} 贈送` : null,
      useCoinImage: true, // 標記使用金幣圖片
    }));
  });

  /**
   * 資產卡片商品（從 API 加載）
   */
  const assetCardItems = computed<ShopItem[]>(() => {
    return assetPackages.value.map((pkg) => {
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
      };
    });
  });

  /**
   * 道具商品（從 API 加載）
   */
  const potionItems = computed<ShopItem[]>(() => {
    return potionPackages.value.map((potion) => {
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
      };
    });
  });

  /**
   * 合併所有商品
   */
  const allItems = computed<ShopItem[]>(() => {
    return [...coinItems.value, ...assetCardItems.value, ...potionItems.value];
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
    allItems,
    filteredItems,

    // Constants
    COIN_ICON_PATH,
  };
}
