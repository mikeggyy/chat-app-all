/**
 * Match 輪播控制 Composable
 *
 * 管理角色配對輪播的核心邏輯，包括：
 * - 當前索引追蹤
 * - 輪播資料計算
 * - 動畫狀態管理
 * - 卡片寬度測量
 *
 * @example
 * const carousel = useMatchCarousel({
 *   matches: matchesRef,
 *   onIndexChange: (newIndex) => console.log('Index changed:', newIndex)
 * });
 *
 * // 切換到下一張
 * carousel.goToNext();
 *
 * // 切換到上一張
 * carousel.goToPrevious();
 */

import { ref, computed, onBeforeUnmount, watch } from 'vue';

/**
 * 創建輪播控制
 *
 * @param {Object} options - 配置選項
 * @param {import('vue').Ref<Array>} options.matches - 配對角色列表
 * @param {Function} options.onIndexChange - 索引變更回調函數
 * @returns {Object} 輪播控制方法和狀態
 */
export function useMatchCarousel(options = {}) {
  const { matches, onIndexChange } = options;

  // 輪播狀態
  const currentIndex = ref(0);
  const swipeOffset = ref(0);
  const isAnimating = ref(false);
  const carouselContainer = ref(null);
  const cardWidth = ref(0);

  // 動畫定時器
  let resetTimerId;

  // ✅ P1 優化（2025-01）：智能預加載下一張圖片
  const preloadImage = (url) => {
    if (!url || typeof url !== 'string') return;
    const img = new Image();
    img.src = url;
  };

  /**
   * 計算輪播項目（包含前、當前、後三張）
   * 使用環形索引確保無限輪播
   */
  const carouselMatches = computed(() => {
    const list = matches?.value || [];
    const len = list.length;
    if (!len) return [];

    const wrapIndex = (offset) => (currentIndex.value + offset + len) % len;
    const build = (offset, slot) => {
      const idx = wrapIndex(offset);
      const data = list[idx];
      return {
        slot,
        index: idx,
        data,
        key: `${data?.id ?? 'match'}-${slot}-${currentIndex.value}`,
      };
    };

    // 單張卡片時只顯示當前
    if (len === 1) {
      return [build(0, 'current')];
    }

    // 多張卡片時顯示前、當前、後
    return [build(-1, 'prev'), build(0, 'current'), build(1, 'next')];
  });

  /**
   * 計算 translateX 值
   * 考慮基礎偏移和手勢滑動偏移
   */
  const translateValue = computed(() => {
    const hasLoop = carouselMatches.value.length > 1;
    const base = hasLoop ? '-100%' : '0px';
    const offset = `${swipeOffset.value}px`;
    return hasLoop ? `calc(${base} + ${offset})` : offset;
  });

  /**
   * 輪播軌道樣式（用於內容）
   */
  const trackStyle = computed(() => ({
    transform: `translateX(${translateValue.value})`,
    transition: isAnimating.value ? 'transform 0.22s ease-out' : 'none',
  }));

  /**
   * 背景軌道樣式（較慢的過渡）
   */
  const backgroundTrackStyle = computed(() => ({
    transform: `translateX(${translateValue.value})`,
    transition: isAnimating.value ? 'transform 0.28s ease-out' : 'none',
  }));

  /**
   * 測量卡片寬度
   */
  const measureCardWidth = () => {
    cardWidth.value = carouselContainer.value?.offsetWidth ?? 0;
  };

  /**
   * 清除動畫定時器
   */
  const clearAnimationTimer = () => {
    if (resetTimerId) {
      clearTimeout(resetTimerId);
      resetTimerId = undefined;
    }
  };

  /**
   * 重置滑動偏移（帶動畫）
   */
  const scheduleReset = () => {
    clearAnimationTimer();
    isAnimating.value = true;
    swipeOffset.value = 0;
    resetTimerId = window.setTimeout(() => {
      isAnimating.value = false;
      resetTimerId = undefined;
    }, 220);
  };

  /**
   * 根據索引顯示配對角色
   * @param {number} index - 目標索引
   */
  const showMatchByIndex = (index) => {
    if (!matches?.value?.length) return;
    const normalized = (index + matches.value.length) % matches.value.length;
    currentIndex.value = normalized;

    // 觸發索引變更回調
    if (onIndexChange) {
      const matchData = matches.value[normalized];
      onIndexChange(normalized, matchData);
    }
  };

  /**
   * 切換到下一張
   */
  const goToNext = () => {
    if (!matches?.value?.length) return;
    showMatchByIndex(currentIndex.value + 1);
  };

  /**
   * 切換到上一張
   */
  const goToPrevious = () => {
    if (!matches?.value?.length) return;
    showMatchByIndex(currentIndex.value - 1);
  };

  /**
   * 動畫切換到指定方向
   * @param {'next' | 'prev'} direction - 切換方向
   */
  const animateTo = (direction) => {
    clearAnimationTimer();
    if (!cardWidth.value) {
      measureCardWidth();
    }

    const width =
      cardWidth.value ||
      carouselContainer.value?.offsetWidth ||
      window.innerWidth ||
      1;

    isAnimating.value = true;
    swipeOffset.value = direction === 'next' ? -width : width;

    resetTimerId = window.setTimeout(() => {
      if (direction === 'next') {
        showMatchByIndex(currentIndex.value + 1);
      } else {
        showMatchByIndex(currentIndex.value - 1);
      }

      isAnimating.value = false;
      swipeOffset.value = 0;
    }, 220);
  };

  /**
   * 初始化：顯示第一張
   */
  const initialize = () => {
    measureCardWidth();
    if (matches?.value?.length) {
      showMatchByIndex(0);
    }
  };

  // ✅ P1 優化（2025-01）：監聽索引變化，智能預加載相鄰圖片
  watch(currentIndex, (newIndex) => {
    const len = matches?.value?.length || 0;
    if (len <= 2) return; // 少於 3 張時無需預加載

    // 預加載下一張圖片
    const nextIdx = (newIndex + 1) % len;
    const nextUrl = matches.value[nextIdx]?.portraitUrl;
    if (nextUrl) {
      preloadImage(nextUrl);
    }

    // 也預加載前一張（雙向滑動支援）
    const prevIdx = (newIndex - 1 + len) % len;
    const prevUrl = matches.value[prevIdx]?.portraitUrl;
    if (prevUrl) {
      preloadImage(prevUrl);
    }
  });

  // 清理資源
  onBeforeUnmount(() => {
    clearAnimationTimer();
  });

  return {
    // 狀態
    currentIndex,
    swipeOffset,
    isAnimating,
    carouselContainer,
    cardWidth,

    // 計算屬性
    carouselMatches,
    translateValue,
    trackStyle,
    backgroundTrackStyle,

    // 方法
    measureCardWidth,
    showMatchByIndex,
    goToNext,
    goToPrevious,
    animateTo,
    scheduleReset,
    initialize,
  };
}
