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

import { ref, onBeforeUnmount } from 'vue';

/**
 * 從事件中讀取座標點
 * @param {PointerEvent | TouchEvent} event - 事件物件
 * @returns {Object} 座標點 { clientX, clientY }
 */
function readPoint(event) {
  if ('touches' in event && event.touches.length) return event.touches[0];
  if ('changedTouches' in event && event.changedTouches.length) return event.changedTouches[0];
  return event;
}

/**
 * 創建手勢控制
 *
 * @param {Object} options - 配置選項
 * @param {number} options.swipeThreshold - 滑動閾值（px），默認 80
 * @param {import('vue').Ref} options.cardWidthRef - 卡片寬度的 ref
 * @param {import('vue').Ref} options.swipeOffsetRef - 滑動偏移的 ref
 * @param {import('vue').Ref} options.isAnimatingRef - 動畫狀態的 ref
 * @param {Function} options.onSwipeStart - 滑動開始回調
 * @param {Function} options.onSwipeMove - 滑動進行回調
 * @param {Function} options.onSwipeComplete - 滑動完成回調 (direction: 'next' | 'prev')
 * @param {Function} options.onSwipeCancel - 滑動取消回調
 * @param {string} options.interactiveSelector - 互動元素選擇器（不觸發滑動）
 * @returns {Object} 手勢事件處理器和狀態
 */
export function useMatchGestures(options = {}) {
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
  const swipeActive = ref(false);
  const swipeStartX = ref(0);
  const swipeStartY = ref(0);

  // Pointer capture 狀態
  let activePointerId = null;
  let activePointerTarget = null;

  /**
   * 捕獲 Pointer（用於追蹤移動端的多點觸控）
   * @param {PointerEvent} event - Pointer 事件
   */
  const capturePointer = (event) => {
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
   * @param {PointerEvent} [event] - Pointer 事件（可選）
   */
  const releaseCapturedPointer = (event) => {
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
   * @param {PointerEvent | TouchEvent} event - 事件物件
   */
  const onSwipeStart = (event) => {
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
   * @param {PointerEvent | TouchEvent} event - 事件物件
   */
  const onSwipeMove = (event) => {
    if (!swipeActive.value) return;

    const point = readPoint(event);
    const offsetX = point.clientX - swipeStartX.value;
    const offsetY = Math.abs(point.clientY - swipeStartY.value);

    // 垂直滑動超過閾值時取消水平滑動
    if (offsetY > 90) {
      onSwipeCancel();
      return;
    }

    // 更新水平偏移
    if (swipeOffsetRef) {
      swipeOffsetRef.value = offsetX;
    }

    // 觸發回調
    if (onSwipeMoveCallback) {
      onSwipeMoveCallback(event, offsetX, offsetY);
    }
  };

  /**
   * 滑動結束事件處理器
   * @param {PointerEvent | TouchEvent} event - 事件物件
   */
  const onSwipeEnd = (event) => {
    if (!swipeActive.value) return;

    releaseCapturedPointer(event);

    const point = readPoint(event);
    const diffX = point.clientX - swipeStartX.value;
    const diffY = Math.abs(point.clientY - swipeStartY.value);
    swipeActive.value = false;

    // 判斷是否達到滑動閾值
    if (Math.abs(diffX) > swipeThreshold && diffY < 90) {
      const direction = diffX < 0 ? 'next' : 'prev';
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
   * @param {PointerEvent | TouchEvent} [event] - 事件物件（可選）
   */
  const onSwipeCancel = (event) => {
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
