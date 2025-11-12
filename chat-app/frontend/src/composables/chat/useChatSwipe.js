/**
 * 聊天列表滑動操作 Composable
 * 處理左右滑動、顯示操作按鈕等
 */

import { reactive, ref } from 'vue';

export function useChatSwipe() {
  const SWIPE_ACTION_WIDTH = 140;
  const SWIPE_TRIGGER_THRESHOLD = 48;
  const SWIPE_MAX_RIGHT_OFFSET = 22;

  const swipeOffsets = reactive({});
  const swipeMeta = reactive({
    activeId: null,
    startX: 0,
    pointerId: null,
    dragging: false,
  });
  const shouldBlockThreadClick = ref(false);

  /**
   * 限制數值在範圍內
   */
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  /**
   * 獲取滑動偏移量
   */
  const getSwipeOffset = (id) => swipeOffsets[id] ?? 0;

  /**
   * 檢查是否正在滑動
   */
  const isSwiping = (id) => swipeMeta.dragging && swipeMeta.activeId === id;

  /**
   * 確保滑動條目存在
   */
  const ensureSwipeEntry = (id) => {
    if (typeof swipeOffsets[id] !== 'number') {
      swipeOffsets[id] = 0;
    }
  };

  /**
   * 關閉所有滑動
   */
  const closeAllSwipes = () => {
    Object.keys(swipeOffsets).forEach((key) => {
      if (swipeOffsets[key] !== 0) {
        swipeOffsets[key] = 0;
      }
    });
    shouldBlockThreadClick.value = false;
  };

  /**
   * 關閉其他滑動（保留當前）
   */
  const closeOtherSwipes = (id) => {
    Object.keys(swipeOffsets).forEach((key) => {
      if (key !== id && swipeOffsets[key] !== 0) {
        swipeOffsets[key] = 0;
      }
    });
  };

  /**
   * 重置滑動元數據
   */
  const resetSwipeMeta = () => {
    swipeMeta.activeId = null;
    swipeMeta.startX = 0;
    swipeMeta.pointerId = null;
    swipeMeta.dragging = false;
  };

  /**
   * 開始滑動
   */
  const handleSwipeStart = (event, id) => {
    if (swipeMeta.dragging || event.button !== 0) return;

    ensureSwipeEntry(id);
    closeOtherSwipes(id);

    swipeMeta.activeId = id;
    swipeMeta.startX = event.clientX;
    swipeMeta.pointerId = event.pointerId;
    swipeMeta.dragging = false;

    event.target.setPointerCapture?.(event.pointerId);
  };

  /**
   * 滑動移動
   */
  const handleSwipeMove = (event, id) => {
    if (swipeMeta.pointerId !== event.pointerId || swipeMeta.activeId !== id) {
      return;
    }

    const deltaX = event.clientX - swipeMeta.startX;

    if (!swipeMeta.dragging && Math.abs(deltaX) > 5) {
      swipeMeta.dragging = true;
      shouldBlockThreadClick.value = true;
    }

    if (!swipeMeta.dragging) return;

    const current = swipeOffsets[id];
    let next = current + deltaX;

    next = clamp(next, -SWIPE_ACTION_WIDTH, SWIPE_MAX_RIGHT_OFFSET);

    swipeOffsets[id] = next;
    swipeMeta.startX = event.clientX;
  };

  /**
   * 結束滑動
   */
  const handleSwipeEnd = (event, id) => {
    if (swipeMeta.pointerId !== event.pointerId || swipeMeta.activeId !== id) {
      return;
    }

    if (event.target.releasePointerCapture) {
      event.target.releasePointerCapture(event.pointerId);
    }

    const current = swipeOffsets[id];

    if (swipeMeta.dragging) {
      if (current < -SWIPE_TRIGGER_THRESHOLD) {
        swipeOffsets[id] = -SWIPE_ACTION_WIDTH;
      } else if (current < 0) {
        swipeOffsets[id] = 0;
        shouldBlockThreadClick.value = false;
      } else {
        swipeOffsets[id] = 0;
        shouldBlockThreadClick.value = false;
      }
    }

    resetSwipeMeta();
  };

  /**
   * 取消滑動
   */
  const handleSwipeCancel = (event, id) => {
    if (swipeMeta.pointerId !== event.pointerId || swipeMeta.activeId !== id) {
      return;
    }

    if (event.target.releasePointerCapture) {
      event.target.releasePointerCapture(event.pointerId);
    }

    swipeOffsets[id] = 0;
    shouldBlockThreadClick.value = false;
    resetSwipeMeta();
  };

  return {
    // 狀態
    swipeOffsets,
    shouldBlockThreadClick,

    // 方法
    getSwipeOffset,
    isSwiping,
    closeAllSwipes,
    closeOtherSwipes,
    handleSwipeStart,
    handleSwipeMove,
    handleSwipeEnd,
    handleSwipeCancel,

    // 常量
    SWIPE_ACTION_WIDTH,
  };
}
