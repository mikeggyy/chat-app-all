import { computed, ref } from "vue";
import { COIN_ICON_PATH } from "../../config/assets";

/**
 * 商品數據轉換和過濾 Composable
 * 處理不同類型商品的格式化和過濾邏輯
 */
export function useShopItems(packages, assetPackages, potionPackages, activeCategory) {
  // Icon 映射表（根據 category 轉換為正確的 iconColor）
  const ICON_MAPPING = {
    character_unlock: { iconColor: "character" },
    photo_unlock: { iconColor: "photo" },
    video_unlock: { iconColor: "video" },
    voice_unlock: { iconColor: "voice" },
    create_character: { iconColor: "create" },
  };

  // 藥水 Icon 映射表
  const POTION_ICON_MAPPING = {
    memory_boost: { iconColor: "memory" },
    brain_boost: { iconColor: "brain" },
  };

  /**
   * 判斷字符串是否為 emoji
   * @param {string} str - 要判斷的字符串
   * @returns {boolean}
   */
  const isEmoji = (str) => {
    return str && str.length <= 2 && !/^[a-zA-Z]/.test(str);
  };

  /**
   * 金幣套餐轉為商品格式
   */
  const coinItems = computed(() => {
    const pkgs =
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
      price: pkg.unitPrice || pkg.price, // 支援統一欄位 unitPrice 和舊欄位 price
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
  const assetCardItems = computed(() => {
    return assetPackages.value.map((pkg) => {
      // 從 category 或 baseId 中提取 iconColor
      const mapping =
        ICON_MAPPING[pkg.category] || ICON_MAPPING[pkg.baseId] || {};

      const iconValue = pkg.icon || null;
      const isIconEmoji = isEmoji(iconValue);

      return {
        id: pkg.id || pkg.sku,
        category: pkg.category,
        name: pkg.displayName || pkg.name,
        emoji: isIconEmoji ? iconValue : null, // emoji 放到 emoji 屬性
        icon: isIconEmoji ? null : iconValue, // 組件名放到 icon 屬性
        iconColor: mapping.iconColor || pkg.iconColor || "character",
        price: pkg.unitPrice || pkg.finalPrice,
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
  const potionItems = computed(() => {
    return potionPackages.value.map((potion) => {
      const mapping = POTION_ICON_MAPPING[potion.baseId] || {};

      const iconValue = potion.icon || null;
      const isIconEmoji = isEmoji(iconValue);

      return {
        id: potion.id,
        category: "potions",
        name: potion.displayName || potion.name,
        description: potion.description,
        effect: potion.effect?.displayText || potion.effect,
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
  const allItems = computed(() => {
    return [...coinItems.value, ...assetCardItems.value, ...potionItems.value];
  });

  /**
   * 過濾當前分類的商品
   */
  const filteredItems = computed(() => {
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
