import { ref, computed, onBeforeUnmount } from "vue";
import type { Ref, ComputedRef } from "vue";

/**
 * useGenerationProgress
 *
 * 管理角色圖片生成過程中的進度條動畫
 *
 * @returns 進度條相關狀態和控制方法
 */
export function useGenerationProgress() {
  // ===== 狀態 =====

  /**
   * 當前進度值 (0-100)
   */
  const progress: Ref<number> = ref(18);

  /**
   * 是否正在播放進度動畫
   */
  const isAnimating: Ref<boolean> = ref(false);

  /**
   * 定時器引用
   */
  let progressTimer: number | null = null;

  // ===== Computed =====

  /**
   * 是否已完成 (進度達到 100%)
   */
  const isComplete: ComputedRef<boolean> = computed(
    () => progress.value >= 100
  );

  /**
   * 進度文字 (格式化為百分比)
   */
  const progressText: ComputedRef<string> = computed(
    () => `${progress.value}%`
  );

  // ===== 方法 =====

  /**
   * 停止進度動畫
   */
  const stopProgressAnimation = (): void => {
    if (progressTimer !== null) {
      window.clearInterval(progressTimer);
      progressTimer = null;
    }
    isAnimating.value = false;
  };

  /**
   * 開始進度動畫
   *
   * 進度條會自動遞增，但不會超過 90%
   * 最後 10% 需要等待實際 API 完成後手動設置
   */
  const startProgressAnimation = (): void => {
    if (typeof window === "undefined" || isAnimating.value) {
      return;
    }

    isAnimating.value = true;
    progressTimer = window.setInterval(() => {
      // 圖片生成需要較長時間，進度條要慢一些
      // 並且不要超過 90%，最後 10% 等實際完成
      const increment =
        progress.value < 50
          ? Math.ceil(Math.random() * 3) // 前半段稍快 (1-3%)
          : Math.ceil(Math.random() * 2); // 後半段很慢 (1-2%)

      progress.value = Math.min(90, progress.value + increment);

      // 不再自動完成，等待實際 API 完成
    }, 1500); // 1.5 秒一次，讓動畫更慢更真實
  };

  /**
   * 重置進度到初始狀態
   */
  const resetProgress = (): void => {
    stopProgressAnimation();
    progress.value = 18;
  };

  /**
   * 設置進度為完成狀態
   */
  const completeProgress = (): void => {
    stopProgressAnimation();
    progress.value = 100;
  };

  /**
   * 手動設置進度值
   *
   * @param value - 進度值 (0-100)
   */
  const setProgress = (value: number): void => {
    progress.value = Math.max(0, Math.min(100, value));
  };

  // ===== 生命周期 =====

  /**
   * 組件卸載時清理定時器
   */
  onBeforeUnmount(() => {
    stopProgressAnimation();
  });

  // ===== 返回 =====

  return {
    // 狀態
    progress,
    isAnimating,

    // Computed
    isComplete,
    progressText,

    // 方法
    startProgressAnimation,
    stopProgressAnimation,
    resetProgress,
    completeProgress,
    setProgress,
  };
}

/**
 * useGenerationProgress 返回類型
 */
export type UseGenerationProgressReturn = ReturnType<typeof useGenerationProgress>;
