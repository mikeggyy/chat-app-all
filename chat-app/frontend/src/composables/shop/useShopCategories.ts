// @ts-nocheck
import { ref, computed, nextTick } from "vue";
import type { Ref, ComputedRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Router, RouteLocationNormalizedLoaded } from "vue-router";

/**
 * 商城分類介面
 */
export interface ShopCategory {
  id: string;
  label: string;
  description: string;
}

/**
 * 商城分類管理 Composable 依賴項介面
 */
export interface UseShopCategoriesDeps {
  route?: RouteLocationNormalizedLoaded;
  router?: Router;
}

/**
 * 商城分類管理 Composable 返回值介面
 */
export interface UseShopCategoriesReturn {
  // State
  categories: Ref<ShopCategory[]>;
  activeCategory: Ref<string>;
  activeCategoryInfo: ComputedRef<ShopCategory | undefined>;

  // Methods
  handleCategoryChange: (categoryId: string) => void;
  scrollToActiveCategory: () => void;
  initializeCategoryFromQuery: (categoryQuery: string | undefined) => void;
  updateCategoryFromRoute: (newCategory: string | undefined) => void;
}

/**
 * 商城分類管理 Composable
 * 處理分類切換、URL 同步、滾動行為
 */
export function useShopCategories(
  deps?: UseShopCategoriesDeps
): UseShopCategoriesReturn {
  const route = deps?.route ?? useRoute();
  const router = deps?.router ?? useRouter();

  // 分類定義
  const categories = ref<ShopCategory[]>([
    { id: "coins", label: "金幣", description: "購買金幣，用於商城內的各種消費" },
    { id: "potions", label: "道具", description: "購買增強道具，提升對話體驗" },
    {
      id: "character-unlock",
      label: "角色解鎖票",
      description: "解鎖與特定角色 7 天無限對話（300金幣/張）",
    },
    {
      id: "photo-unlock",
      label: "拍照卡",
      description: "用於生成角色AI照片（50金幣/張）",
    },
    {
      id: "video-unlock",
      label: "影片卡",
      description: "用於生成角色AI短影片（200金幣/支）",
    },
    {
      id: "voice-unlock",
      label: "語音解鎖卡",
      description: "解鎖角色語音播放功能（免費/VIP用戶適用）",
    },
    { id: "create", label: "創建角色卡", description: "獲得創建專屬角色的機會" },
  ]);

  // 當前選中的分類
  const activeCategory = ref<string>("coins");

  // 當前分類資訊
  const activeCategoryInfo = computed<ShopCategory | undefined>(() => {
    return categories.value.find((cat) => cat.id === activeCategory.value);
  });

  /**
   * 滾動到當前選中的分類標籤
   */
  const scrollToActiveCategory = (): void => {
    nextTick(() => {
      const activeTab = document.querySelector(".category-tab--active");
      if (activeTab) {
        activeTab.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    });
  };

  /**
   * 切換分類
   * @param categoryId - 分類 ID
   */
  const handleCategoryChange = (categoryId: string): void => {
    activeCategory.value = categoryId;
    scrollToActiveCategory();
  };

  /**
   * 從 URL query 參數初始化分類
   * @param categoryQuery - URL 查詢參數中的分類 ID
   */
  const initializeCategoryFromQuery = (categoryQuery: string | undefined): void => {
    if (categoryQuery) {
      const validCategories = categories.value.map((c) => c.id);
      if (validCategories.includes(categoryQuery)) {
        activeCategory.value = categoryQuery;
        scrollToActiveCategory();
      }
    }
  };

  /**
   * 監聽路由變化更新分類
   * @param newCategory - 新的分類 ID
   */
  const updateCategoryFromRoute = (newCategory: string | undefined): void => {
    if (newCategory) {
      const validCategories = categories.value.map((c) => c.id);
      if (validCategories.includes(newCategory)) {
        activeCategory.value = newCategory;
        nextTick(() => {
          scrollToActiveCategory();
        });
      }
    }
  };

  return {
    // State
    categories,
    activeCategory,
    activeCategoryInfo,

    // Methods
    handleCategoryChange,
    scrollToActiveCategory,
    initializeCategoryFromQuery,
    updateCategoryFromRoute,
  };
}
