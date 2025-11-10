import { ref, computed, watch, onBeforeUnmount } from 'vue';
import {
  HeartIcon,
  SparklesIcon,
  FireIcon,
  StarIcon,
  BoltIcon
} from '@heroicons/vue/24/solid';

/**
 * Panel 管理 Composable
 * 管理彈窗面板的狀態、URL 同步和可見性
 *
 * @param {Object} router - Vue Router 實例
 * @param {Object} route - Vue Router 當前路由
 * @param {Object} panelConfigs - 面板配置對象
 */
export function usePanelManager(router, route, panelConfigs = {}) {
  const PANEL_QUERY_KEY = 'panel';
  const DEFAULT_HERO_FALLBACK = '/banner/recent-records-banner-placeholder.webp';
  const DEFAULT_ICON_KEY = 'heart';

  // Icon 映射
  const ICON_MAP = {
    heart: HeartIcon,
    sparkles: SparklesIcon,
    fire: FireIcon,
    star: StarIcon,
    bolt: BoltIcon
  };

  // Panel 狀態
  const isOpen = ref(false);
  const description = ref('');
  const badgeLabel = ref('');
  const heroImage = ref(DEFAULT_HERO_FALLBACK);
  const badgeIconKey = ref(DEFAULT_ICON_KEY);

  // 計算屬性：當前面板類型
  const currentType = computed(() => {
    const panelValue = route.query[PANEL_QUERY_KEY];
    return typeof panelValue === 'string' ? panelValue.trim().toLowerCase() : '';
  });

  // 計算屬性：Badge Icon 組件
  const badgeIcon = computed(() => {
    return ICON_MAP[badgeIconKey.value] ?? HeartIcon;
  });

  /**
   * 更新 URL 查詢參數
   * @param {string|null} panelType - 面板類型，null 表示關閉
   */
  const updateQuery = (panelType) => {
    const nextQuery = { ...route.query };
    let changed = false;

    if (!panelType) {
      // 移除 panel 參數
      if (Object.prototype.hasOwnProperty.call(route.query, PANEL_QUERY_KEY)) {
        delete nextQuery[PANEL_QUERY_KEY];
        changed = true;
      }
    } else if (route.query[PANEL_QUERY_KEY] !== panelType) {
      // 設置 panel 參數
      nextQuery[PANEL_QUERY_KEY] = panelType;
      changed = true;
    }

    if (!changed) return;

    router.replace({ query: nextQuery }).catch((error) => {
      if (error?.name === 'NavigationDuplicated') {
        return;
      }
    });
  };

  /**
   * 從路由同步面板開啟狀態
   */
  const syncStateFromRoute = () => {
    const panelValue = route.query[PANEL_QUERY_KEY];
    const normalizedPanel = typeof panelValue === 'string'
      ? panelValue.trim().toLowerCase()
      : '';

    // 檢查 panel 值是否為有效的配置類型
    const shouldOpen = normalizedPanel.length > 0 &&
                      panelConfigs[normalizedPanel] !== undefined;

    if (isOpen.value !== shouldOpen) {
      isOpen.value = shouldOpen;
    }
  };

  /**
   * 從路由同步面板元數據（描述、標題、圖片等）
   */
  const syncMetadataFromRoute = () => {
    const panelType = route.query[PANEL_QUERY_KEY];

    if (panelType && panelConfigs[panelType]) {
      const config = panelConfigs[panelType];
      description.value = config.description || '';
      badgeLabel.value = config.badgeLabel || '';
      badgeIconKey.value = config.iconKey || DEFAULT_ICON_KEY;
      heroImage.value = config.heroImage || DEFAULT_HERO_FALLBACK;
    } else {
      // 重置為默認值
      description.value = '';
      badgeLabel.value = '';
      badgeIconKey.value = DEFAULT_ICON_KEY;
      heroImage.value = DEFAULT_HERO_FALLBACK;
    }
  };

  /**
   * 更新 bottom navigation 可見性
   * @param {boolean} shouldHide - 是否隱藏
   */
  const updateBottomNavVisibility = (shouldHide) => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('hide-bottom-nav', shouldHide);
  };

  /**
   * 開啟面板
   * @param {string} type - 面板類型
   * @param {Function} onBeforeOpen - 開啟前的回調函數（可選）
   */
  const open = async (type, onBeforeOpen) => {
    // 從配置中獲取面板信息
    const config = panelConfigs[type] || panelConfigs[Object.keys(panelConfigs)[0]];

    if (!config) {
      console.warn(`Panel config for type "${type}" not found`);
      return;
    }

    // 設置面板顯示內容
    description.value = config.description || '';
    badgeLabel.value = config.badgeLabel || '';
    badgeIconKey.value = config.iconKey || DEFAULT_ICON_KEY;
    heroImage.value = config.heroImage || DEFAULT_HERO_FALLBACK;

    // 執行開啟前的回調（如：加載數據）
    if (onBeforeOpen && typeof onBeforeOpen === 'function') {
      await onBeforeOpen(type);
    }

    isOpen.value = true;

    // 更新 URL
    updateQuery(type);
  };

  /**
   * 關閉面板
   */
  const close = () => {
    isOpen.value = false;
    updateQuery(null);
  };

  // 初始化：從路由同步狀態
  syncStateFromRoute();
  syncMetadataFromRoute();
  updateBottomNavVisibility(isOpen.value);

  // 監聽路由變化
  watch(
    () => route.query[PANEL_QUERY_KEY],
    () => {
      syncStateFromRoute();
    }
  );

  watch(
    () => route.fullPath,
    () => {
      syncMetadataFromRoute();
    }
  );

  // 監聽 isOpen 變化，更新 bottom nav 可見性
  watch(isOpen, (newIsOpen) => {
    updateBottomNavVisibility(newIsOpen);
  });

  // 組件卸載時清理
  onBeforeUnmount(() => {
    updateBottomNavVisibility(false);
  });

  return {
    // 狀態
    isOpen,
    description,
    badgeLabel,
    heroImage,
    badgeIconKey,

    // 計算屬性
    currentType,
    badgeIcon,

    // 方法
    open,
    close,
    updateQuery,
    syncStateFromRoute,
    syncMetadataFromRoute,

    // 常量
    ICON_MAP,
    DEFAULT_HERO_FALLBACK
  };
}
