// @ts-nocheck
/**
 * Match 手勢控制 Composable
 *
 * 管理觸控和指標事件，處理滑動手勢：
 * - Pointer Events 處理（觸控、滑鼠、筆）
 * - Pointer Capture 管理
 * - 滑動閾值判斷
 * - 垂直滑動取消邏輯
 *
 * @example
 * const gestures = useMatchGestures({
 *   swipeThreshold: 80,
 *   carouselRef: containerRef,
 *   onSwipeComplete: (direction) => {
 *     if (direction === 'next') goToNext();
 *     else goToPrevious();
 *   },
 *   onSwipeCancel: () => resetPosition()
 * });
 *
 * // 在模板中綁定事件
 * <div
 *   @pointerdown="gestures.onSwipeStart"
 *   @pointermove="gestures.onSwipeMove"
 *   @pointerup="gestures.onSwipeEnd"
 * />
 */

import { ref, onBeforeUnmount, type Ref } from 'vue';

// ==================== 類型定義 ====================

/**
 * 滑動方向
 */
export type SwipeDirection = 'next' | 'prev';

/**
 * 座標點
 */
export interface Point {
  clientX: number;
  clientY: number;
}

/**
 * useMatchGestures 參數
 */
export interface UseMatchGesturesOptions {
  /** 滑動閾值（px），默認 80 */
  swipeThreshold?: number;

  /** 卡片寬度的 ref */
  cardWidthRef?: Ref<number>;

  /** 滑動偏移的 ref */
  swipeOffsetRef?: Ref<number>;

  /** 動畫狀態的 ref */
  isAnimatingRef?: Ref<boolean>;

  /** 滑動開始回調 */
  onSwipeStart?: (event: PointerEvent | TouchEvent) => void;

  /** 滑動進行回調 */
  onSwipeMove?: (event: PointerEvent | TouchEvent, offsetX: number, offsetY: number) => void;

  /** 滑動完成回調 (direction: 'next' | 'prev') */
  onSwipeComplete?: (direction: SwipeDirection) => void;

  /** 滑動取消回調 */
  onSwipeCancel?: () => void;

  /** 互動元素選擇器（不觸發滑動） */
  interactiveSelector?: string;
}

/**
 * useMatchGestures 返回類型
 */
export interface UseMatchGesturesReturn {
  // 狀態
  swipeActive: Ref<boolean>;
  swipeStartX: Ref<number>;
  swipeStartY: Ref<number>;

  // 事件處理器
  onSwipeStart: (event: PointerEvent | TouchEvent) => void;
  onSwipeMove: (event: PointerEvent | TouchEvent) => void;
  onSwipeEnd: (event: PointerEvent | TouchEvent) => void;
  onSwipeCancel: (event?: PointerEvent | TouchEvent) => void;
}

// ==================== 工具函數 ====================

/**
 * 從事件中讀取座標點
 * @param event - 事件物件
 * @returns 座標點 { clientX, clientY }
 */
function readPoint(event: PointerEvent | TouchEvent): Point {
  if ('touches' in event && event.touches.length) return event.touches[0];
  if ('changedTouches' in event && event.changedTouches.length) return event.changedTouches[0];
  return event as PointerEvent;
}

// ==================== Composable ====================

/**
 * 創建手勢控制
 *
 * @param options - 配置選項
 * @returns 手勢事件處理器和狀態
 */
export function useMatchGestures(options: UseMatchGesturesOptions = {}): UseMatchGesturesReturn {
  const {
    swipeThreshold = 80,
    cardWidthRef,
    swipeOffsetRef,
    isAnimatingRef,
    onSwipeStart: onSwipeStartCallback,
    onSwipeMove: onSwipeMoveCallback,
    onSwipeComplete,
    onSwipeCancel: onSwipeCancelCallback,
    interactiveSelector = 'button, [role="button"], a, input, textarea, select, label',
  } = options;

  // 手勢狀態
  const swipeActive = ref<boolean>(false);
  const swipeStartX = ref<number>(0);
  const swipeStartY = ref<number>(0);

  // Pointer capture 狀態
  let activePointerId: number | null = null;
  let activePointerTarget: HTMLElement | null = null;

  // ✅ 效能優化：RAF 節流狀態
  let rafId: number | null = null;
  let pendingOffsetX: number = 0;

  /**
   * 捕獲 Pointer（用於追蹤移動端的多點觸控）
   * @param event - Pointer 事件
   */
  const capturePointer = (event: PointerEvent | TouchEvent): void => {
    if (!(event instanceof PointerEvent)) return;
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    try {
      target.setPointerCapture(event.pointerId);
      activePointerId = event.pointerId;
      activePointerTarget = target;
    } catch {
      activePointerId = null;
      activePointerTarget = null;
    }
  };

  /**
   * 釋放 Pointer Capture
   * @param event - Pointer 事件（可選）
   */
  const releaseCapturedPointer = (event?: PointerEvent | TouchEvent): void => {
    const pointerId =
      event instanceof PointerEvent ? event.pointerId : activePointerId;
    const target =
      event instanceof PointerEvent && event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : activePointerTarget;

    if (pointerId == null || !target) {
      activePointerId = null;
      activePointerTarget = null;
      return;
    }

    try {
      target.releasePointerCapture(pointerId);
    } catch {
      // 忽略無法釋放的例外
    } finally {
      if (activePointerId === pointerId) {
        activePointerId = null;
        activePointerTarget = null;
      }
    }
  };

  /**
   * 滑動開始事件處理器
   * @param event - 事件物件
   */
  const onSwipeStart = (event: PointerEvent | TouchEvent): void => {
    // 只處理滑鼠左鍵
    if (
      event instanceof PointerEvent &&
      event.pointerType === 'mouse' &&
      event.button !== 0
    ) {
      return;
    }

    // 檢查是否點擊在互動元素上（不觸發滑動）
    const target = event.target;
    if (
      target instanceof Element &&
      (target.closest('.actions') ||
        target.closest('.bio-card-header') ||
        target.closest(interactiveSelector))
    ) {
      return;
    }

    // 阻止默認行為
    if (event instanceof PointerEvent && event.cancelable) {
      event.preventDefault();
    }

    // 捕獲 pointer
    capturePointer(event);

    // 記錄起始位置
    const point = readPoint(event);
    swipeActive.value = true;
    swipeStartX.value = point.clientX;
    swipeStartY.value = point.clientY;

    // 重置偏移和動畫狀態
    if (swipeOffsetRef) swipeOffsetRef.value = 0;
    if (isAnimatingRef) isAnimatingRef.value = false;

    // 觸發回調
    if (onSwipeStartCallback) {
      onSwipeStartCallback(event);
    }
  };

  /**
   * 滑動移動事件處理器
   * ✅ 效能優化：使用 RAF 節流，減少重排頻率
   * @param event - 事件物件
   */
  const onSwipeMove = (event: PointerEvent | TouchEvent): void => {
    if (!swipeActive.value) return;

    const point = readPoint(event);
    const offsetX = point.clientX - swipeStartX.value;
    const offsetY = Math.abs(point.clientY - swipeStartY.value);

    // 垂直滑動超過閾值時取消水平滑動（立即執行）
    if (offsetY > 90) {
      // 取消待處理的 RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      onSwipeCancel();
      return;
    }

    // ✅ 使用 RAF 批量更新，減少 60-120 次/秒 → 60 次/秒
    pendingOffsetX = offsetX;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (swipeOffsetRef && swipeActive.value) {
          swipeOffsetRef.value = pendingOffsetX;
        }
        rafId = null;
      });
    }

    // 觸發回調（傳遞即時值，讓調用方決定是否節流）
    if (onSwipeMoveCallback) {
      onSwipeMoveCallback(event, offsetX, offsetY);
    }
  };

  /**
   * 滑動結束事件處理器
   * @param event - 事件物件
   */
  const onSwipeEnd = (event: PointerEvent | TouchEvent): void => {
    if (!swipeActive.value) return;

    releaseCapturedPointer(event);

    const point = readPoint(event);
    const diffX = point.clientX - swipeStartX.value;
    const diffY = Math.abs(point.clientY - swipeStartY.value);
    swipeActive.value = false;

    // 判斷是否達到滑動閾值
    if (Math.abs(diffX) > swipeThreshold && diffY < 90) {
      const direction: SwipeDirection = diffX < 0 ? 'next' : 'prev';
      if (onSwipeComplete) {
        onSwipeComplete(direction);
      }
    } else {
      // 未達閾值，取消滑動
      if (onSwipeCancelCallback) {
        onSwipeCancelCallback();
      }
    }
  };

  /**
   * 取消滑動事件處理器
   * @param event - 事件物件（可選）
   */
  const onSwipeCancel = (event?: PointerEvent | TouchEvent): void => {
    releaseCapturedPointer(event);
    if (!swipeActive.value) return;

    swipeActive.value = false;

    if (onSwipeCancelCallback) {
      onSwipeCancelCallback();
    }
  };

  // 清理資源
  onBeforeUnmount(() => {
    releaseCapturedPointer();
    // ✅ 清理待處理的 RAF
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  return {
    // 狀態
    swipeActive,
    swipeStartX,
    swipeStartY,

    // 事件處理器
    onSwipeStart,
    onSwipeMove,
    onSwipeEnd,
    onSwipeCancel,
  };
}
