/**
 * useGenerationFailureNotification.ts
 * 管理照片和影片生成失敗通知
 * 即使用戶離開聊天室，重新進入時也能看到失敗通知
 */

import { ref, type Ref } from 'vue';

export interface GenerationFailure {
  type: 'photo' | 'video';
  characterId: string;
  characterName: string;
  failedAt: string;
  reason?: string;
}

export interface UseGenerationFailureNotificationReturn {
  failures: Ref<GenerationFailure[]>;
  addFailure: (failure: GenerationFailure) => void;
  clearFailure: (index: number) => void;
  clearAllFailures: () => void;
  checkForFailures: (characterId: string) => GenerationFailure[];
}

/**
 * 生成失敗通知 Composable
 *
 * 管理生成失敗通知的顯示和清除
 */
export function useGenerationFailureNotification(): UseGenerationFailureNotificationReturn {
  // 失敗通知列表（存儲在內存中，也可以選擇持久化到 localStorage）
  const failures: Ref<GenerationFailure[]> = ref([]);

  /**
   * 添加失敗通知
   */
  const addFailure = (failure: GenerationFailure): void => {
    // 避免重複添加
    const exists = failures.value.some(
      f => f.type === failure.type &&
          f.characterId === failure.characterId &&
          f.failedAt === failure.failedAt
    );

    if (!exists) {
      failures.value.push(failure);

      // 可選：持久化到 localStorage
      try {
        localStorage.setItem('generation_failures', JSON.stringify(failures.value));
      } catch (error) {
        console.warn('[GenerationFailure] 無法保存到 localStorage:', error);
      }
    }
  };

  /**
   * 清除單個失敗通知
   */
  const clearFailure = (index: number): void => {
    if (index >= 0 && index < failures.value.length) {
      failures.value.splice(index, 1);

      // 更新 localStorage
      try {
        localStorage.setItem('generation_failures', JSON.stringify(failures.value));
      } catch (error) {
        console.warn('[GenerationFailure] 無法更新 localStorage:', error);
      }
    }
  };

  /**
   * 清除所有失敗通知
   */
  const clearAllFailures = (): void => {
    failures.value = [];

    // 清除 localStorage
    try {
      localStorage.removeItem('generation_failures');
    } catch (error) {
      console.warn('[GenerationFailure] 無法清除 localStorage:', error);
    }
  };

  /**
   * 檢查特定角色的失敗通知
   */
  const checkForFailures = (characterId: string): GenerationFailure[] => {
    return failures.value.filter(f => f.characterId === characterId);
  };

  // 初始化時從 localStorage 加載
  try {
    const stored = localStorage.getItem('generation_failures');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        failures.value = parsed;

        // 清除超過 24 小時的失敗記錄
        const now = new Date().getTime();
        failures.value = failures.value.filter(f => {
          const failedTime = new Date(f.failedAt).getTime();
          return now - failedTime < 24 * 60 * 60 * 1000; // 24 小時
        });

        // 更新 localStorage
        if (failures.value.length !== parsed.length) {
          localStorage.setItem('generation_failures', JSON.stringify(failures.value));
        }
      }
    }
  } catch (error) {
    console.warn('[GenerationFailure] 無法從 localStorage 加載:', error);
  }

  return {
    failures,
    addFailure,
    clearFailure,
    clearAllFailures,
    checkForFailures,
  };
}
