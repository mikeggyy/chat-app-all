// @ts-nocheck
import { ref, computed, watch, onBeforeUnmount, Ref, ComputedRef } from 'vue';
import { Router, RouteLocationNormalizedLoaded } from 'vue-router';
import {
  HeartIcon,
  SparklesIcon,
  FireIcon,
  StarIcon,
  BoltIcon
} from '@heroicons/vue/24/solid';
import { logger } from '../utils/logger.js';

/**
 * Icon map types
 */
type IconKey = 'heart' | 'sparkles' | 'fire' | 'star' | 'bolt';

/**
 * Icon component type (Vue component)
 */
type IconComponent = any;

/**
 * Panel configuration object
 */
interface PanelConfig {
  description?: string;
  badgeLabel?: string;
  iconKey?: IconKey;
  heroImage?: string;
}

/**
 * Panel configuration mapping
 */
interface PanelConfigMap {
  [key: string]: PanelConfig;
}

/**
 * Query object type
 */
interface QueryObject {
  [key: string]: string | string[] | undefined;
}

/**
 * Return type for usePanelManager composable
 */
interface UsePanelManagerReturn {
  // State
  isOpen: Ref<boolean>;
  description: Ref<string>;
  badgeLabel: Ref<string>;
  heroImage: Ref<string>;
  badgeIconKey: Ref<IconKey>;

  // Computed
  currentType: ComputedRef<string>;
  badgeIcon: ComputedRef<IconComponent>;

  // Methods
  open: (type: string, onBeforeOpen?: (type: string) => Promise<void>) => Promise<void>;
  close: () => void;
  updateQuery: (panelType: string | null) => void;
  syncStateFromRoute: () => void;
  syncMetadataFromRoute: () => void;

  // Constants
  ICON_MAP: Record<IconKey, IconComponent>;
  DEFAULT_HERO_FALLBACK: string;
}

/**
 * Panel 管理 Composable
 * 管理彈窗面板的狀態、URL 同步和可見性
 *
 * @param {Router} router - Vue Router 實例
 * @param {RouteLocationNormalizedLoaded} route - Vue Router 當前路由
 * @param {PanelConfigMap} panelConfigs - 面板配置對象
 * @returns {UsePanelManagerReturn} 面板管理 API
 */
export function usePanelManager(
  router: Router,
  route: RouteLocationNormalizedLoaded,
  panelConfigs: PanelConfigMap = {}
): UsePanelManagerReturn {
  const PANEL_QUERY_KEY = 'panel';
  const DEFAULT_HERO_FALLBACK = '/banner/recent-records-banner-placeholder.webp';
  const DEFAULT_ICON_KEY: IconKey = 'heart';

  // Icon 映射
  const ICON_MAP: Record<IconKey, IconComponent> = {
    heart: HeartIcon,
    sparkles: SparklesIcon,
    fire: FireIcon,
    star: StarIcon,
    bolt: BoltIcon
  };

  // Panel 狀態
  const isOpen: Ref<boolean> = ref(false);
  const description: Ref<string> = ref('');
  const badgeLabel: Ref<string> = ref('');
  const heroImage: Ref<string> = ref(DEFAULT_HERO_FALLBACK);
  const badgeIconKey: Ref<IconKey> = ref(DEFAULT_ICON_KEY);

  // 計算屬性：當前面板類型
  const currentType: ComputedRef<string> = computed(() => {
    const panelValue = route.query[PANEL_QUERY_KEY];
    return typeof panelValue === 'string' ? panelValue.trim().toLowerCase() : '';
  });

  // 計算屬性：Badge Icon 組件
  const badgeIcon: ComputedRef<IconComponent> = computed(() => {
    return ICON_MAP[badgeIconKey.value] ?? HeartIcon;
  });

  /**
   * 更新 URL 查詢參數
   * @param {string|null} panelType - 面板類型，null 表示關閉
   */
  const updateQuery = (panelType: string | null): void => {
    const nextQuery: Record<string, string | string[] | undefined> = { ...route.query };
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

    router.replace({ query: nextQuery }).catch((error: any) => {
      if (error?.name === 'NavigationDuplicated') {
        return;
      }
    });
  };

  /**
   * 從路由同步面板開啟狀態
   */
  const syncStateFromRoute = (): void => {
    const panelValue = route.query[PANEL_QUERY_KEY];
    const normalizedPanel: string = typeof panelValue === 'string'
      ? panelValue.trim().toLowerCase()
      : '';

    // 檢查 panel 值是否為有效的配置類型
    const shouldOpen: boolean = normalizedPanel.length > 0 &&
                      panelConfigs[normalizedPanel] !== undefined;

    if (isOpen.value !== shouldOpen) {
      isOpen.value = shouldOpen;
    }
  };

  /**
   * 從路由同步面板元數據（描述、標題、圖片等）
   */
  const syncMetadataFromRoute = (): void => {
    const panelType = route.query[PANEL_QUERY_KEY];

    if (panelType && panelConfigs[panelType as string]) {
      const config: PanelConfig = panelConfigs[panelType as string];
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
  const updateBottomNavVisibility = (shouldHide: boolean): void => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('hide-bottom-nav', shouldHide);
  };

  /**
   * 開啟面板
   * @param {string} type - 面板類型
   * @param {Function} onBeforeOpen - 開啟前的回調函數（可選）
   */
  const open = async (type: string, onBeforeOpen?: (type: string) => Promise<void>): Promise<void> => {
    // 從配置中獲取面板信息
    const config: PanelConfig = panelConfigs[type] || panelConfigs[Object.keys(panelConfigs)[0]];

    if (!config) {
      logger.warn(`Panel config for type "${type}" not found`);
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
  const close = (): void => {
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
  watch(isOpen, (newIsOpen: boolean) => {
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
