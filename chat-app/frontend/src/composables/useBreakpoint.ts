import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue';

/**
 * 響應式斷點檢測 Composable
 *
 * 斷點定義：
 * - Mobile: < 768px
 * - Tablet: 768px - 1023px
 * - Desktop: ≥ 1024px
 * - Wide: ≥ 1440px
 */

// 斷點常數
export const BREAKPOINTS = {
  mobile: 767,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

interface UseBreakpointReturn {
  /** 當前視窗寬度 */
  windowWidth: Ref<number>;
  /** 是否為手機版 (< 768px) */
  isMobile: ComputedRef<boolean>;
  /** 是否為平板版 (768px - 1023px) */
  isTablet: ComputedRef<boolean>;
  /** 是否為桌面版 (≥ 1024px) */
  isDesktop: ComputedRef<boolean>;
  /** 是否為寬螢幕 (≥ 1440px) */
  isWide: ComputedRef<boolean>;
  /** 是否不是手機版 (≥ 768px) */
  isNotMobile: ComputedRef<boolean>;
  /** 當前斷點名稱 */
  currentBreakpoint: ComputedRef<'mobile' | 'tablet' | 'desktop' | 'wide'>;
}

// 全局狀態（單例模式，避免重複監聽）
let globalWindowWidth: Ref<number> | null = null;
let listenerCount = 0;
let resizeHandler: (() => void) | null = null;

/**
 * 響應式斷點檢測
 *
 * @example
 * ```vue
 * <script setup>
 * import { useBreakpoint } from '@/composables/useBreakpoint';
 *
 * const { isMobile, isDesktop, currentBreakpoint } = useBreakpoint();
 * </script>
 *
 * <template>
 *   <DesktopHeader v-if="isDesktop" />
 *   <BottomNavBar v-else />
 * </template>
 * ```
 */
export function useBreakpoint(): UseBreakpointReturn {
  // 初始化全局狀態
  if (!globalWindowWidth) {
    globalWindowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
  }

  const windowWidth = globalWindowWidth;

  // 計算屬性
  const isMobile = computed(() => windowWidth.value < BREAKPOINTS.tablet);
  const isTablet = computed(
    () => windowWidth.value >= BREAKPOINTS.tablet && windowWidth.value < BREAKPOINTS.desktop
  );
  const isDesktop = computed(() => windowWidth.value >= BREAKPOINTS.desktop);
  const isWide = computed(() => windowWidth.value >= BREAKPOINTS.wide);
  const isNotMobile = computed(() => windowWidth.value >= BREAKPOINTS.tablet);

  const currentBreakpoint = computed<'mobile' | 'tablet' | 'desktop' | 'wide'>(() => {
    if (windowWidth.value >= BREAKPOINTS.wide) return 'wide';
    if (windowWidth.value >= BREAKPOINTS.desktop) return 'desktop';
    if (windowWidth.value >= BREAKPOINTS.tablet) return 'tablet';
    return 'mobile';
  });

  // Resize 處理（節流）
  let resizeTimer: number | undefined;

  const handleResize = () => {
    if (resizeTimer !== undefined) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(() => {
      if (globalWindowWidth) {
        globalWindowWidth.value = window.innerWidth;
      }
      resizeTimer = undefined;
    }, 100);
  };

  onMounted(() => {
    if (typeof window === 'undefined') return;

    // 首次掛載時更新寬度
    if (globalWindowWidth) {
      globalWindowWidth.value = window.innerWidth;
    }

    // 只有第一個使用者需要添加監聽器
    if (listenerCount === 0) {
      resizeHandler = handleResize;
      window.addEventListener('resize', resizeHandler);
    }
    listenerCount++;
  });

  onUnmounted(() => {
    if (typeof window === 'undefined') return;

    // 清理定時器
    if (resizeTimer !== undefined) {
      clearTimeout(resizeTimer);
    }

    // 最後一個使用者需要移除監聽器
    listenerCount--;
    if (listenerCount === 0 && resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
  });

  return {
    windowWidth,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    isNotMobile,
    currentBreakpoint,
  };
}

export default useBreakpoint;
