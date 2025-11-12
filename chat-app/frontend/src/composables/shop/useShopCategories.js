import { ref, computed, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";

/**
 * 商城分類管理 Composable
 * 處理分類切換、URL 同步、滾動行為
 */
export function useShopCategories() {
  const route = useRoute();
  const router = useRouter();

  // 分類定義
  const categories = ref([
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
  const activeCategory = ref("coins");

  // 當前分類資訊
  const activeCategoryInfo = computed(() => {
    return categories.value.find((cat) => cat.id === activeCategory.value);
  });

  /**
   * 滾動到當前選中的分類標籤
   */
  const scrollToActiveCategory = () => {
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
   * @param {string} categoryId - 分類 ID
   */
  const handleCategoryChange = (categoryId) => {
    activeCategory.value = categoryId;
    scrollToActiveCategory();
  };

  /**
   * 從 URL query 參數初始化分類
   * @param {string} categoryQuery - URL 查詢參數中的分類 ID
   */
  const initializeCategoryFromQuery = (categoryQuery) => {
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
   * @param {string} newCategory - 新的分類 ID
   */
  const updateCategoryFromRoute = (newCategory) => {
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
