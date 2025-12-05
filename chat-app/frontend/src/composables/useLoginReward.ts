/**
 * 登入獎勵 Composable
 * 處理每日登入獎勵的獲取、領取和狀態管理
 */

import { ref, computed, type Ref, type ComputedRef } from "vue";
import { apiJson } from "../utils/api";
import { logger } from "../utils/logger";

// ==================== 類型定義 ====================

interface DailyReward {
  day: number;
  coins: number;
  description: string;
  highlight?: boolean;
  milestone?: boolean;
  week?: number;
  isClaimed?: boolean;
  isToday?: boolean;
}

interface MilestoneReward {
  days: number;
  title: string;
  description: string;
  badge: string;
  color?: string;
  rewards: {
    coins?: number;
    photoUnlockCards?: number;
    characterUnlockCards?: number;
    videoUnlockCards?: number;
  };
  isLegendary?: boolean;
  isMonthly?: boolean;
  showInModal?: boolean;
  isClaimed?: boolean;
  isCompleted?: boolean;
  isUnlocked?: boolean;
  progress?: number;
  daysRemaining?: number;
}

interface LoginRewardStatus {
  currentStreak: number;
  totalLoginDays: number;
  lastClaimDate: string | null;
  canClaimToday: boolean;
  streakBroken: boolean;
  todayReward: DailyReward | null;
  unclaimedMilestone: MilestoneReward | null;
  nextMilestone: {
    days: number;
    title: string;
    daysRemaining: number;
  } | null;
  claimedMilestones: number[];
  weekRewards: DailyReward[];
  monthRewards?: DailyReward[];
  displayMilestones?: MilestoneReward[];
}

interface ClaimResult {
  success: boolean;
  claimed: boolean;
  currentStreak: number;
  streakBroken: boolean;
  dailyReward: DailyReward;
  milestoneReward: MilestoneReward | null;
  totalCoinsEarned: number;
  newBalance: number;
  newAssets: Record<string, number>;
  nextMilestone: {
    days: number;
    title: string;
    daysRemaining: number;
  } | null;
  totalLoginDays: number;
}

// ==================== 工具函數 ====================

const DISMISSED_KEY = "loginRewardDismissedDate";

/**
 * 獲取今天的日期字串 (YYYY-MM-DD)
 */
const getTodayDateString = (): string => {
  const now = new Date();
  // 使用台灣時區 (UTC+8)
  const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return taiwanTime.toISOString().split("T")[0];
};

/**
 * 檢查今天是否已經關閉過彈窗
 */
const isDismissedToday = (): boolean => {
  const dismissedDate = localStorage.getItem(DISMISSED_KEY);
  return dismissedDate === getTodayDateString();
};

/**
 * 標記今天已關閉彈窗
 */
const markDismissedToday = (): void => {
  localStorage.setItem(DISMISSED_KEY, getTodayDateString());
};

// ==================== 主函數 ====================

export function useLoginReward() {
  // 狀態
  const isLoading: Ref<boolean> = ref(false);
  const isClaiming: Ref<boolean> = ref(false);
  const error: Ref<string | null> = ref(null);
  const status: Ref<LoginRewardStatus | null> = ref(null);
  const lastClaimResult: Ref<ClaimResult | null> = ref(null);
  const showRewardModal: Ref<boolean> = ref(false);

  // 計算屬性
  const canClaim: ComputedRef<boolean> = computed(() => {
    return status.value?.canClaimToday ?? false;
  });

  const currentStreak: ComputedRef<number> = computed(() => {
    return status.value?.currentStreak ?? 0;
  });

  const todayReward: ComputedRef<DailyReward | null> = computed(() => {
    return status.value?.todayReward ?? null;
  });

  const nextMilestone: ComputedRef<MilestoneReward | null> = computed(() => {
    if (!status.value?.nextMilestone) return null;
    return status.value.nextMilestone as unknown as MilestoneReward;
  });

  const weekRewards: ComputedRef<DailyReward[]> = computed(() => {
    return status.value?.weekRewards ?? [];
  });

  const monthRewards: ComputedRef<DailyReward[]> = computed(() => {
    return status.value?.monthRewards ?? status.value?.weekRewards ?? [];
  });

  const displayMilestones: ComputedRef<MilestoneReward[]> = computed(() => {
    return status.value?.displayMilestones ?? [];
  });

  /**
   * 獲取登入獎勵狀態
   */
  const fetchStatus = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiJson("/api/rewards/login/status");
      // API 返回格式: { success, data: { ... } }
      const data = response.data || response;

      if (response.success && data) {
        status.value = data;

        // 如果可以領取且今天還沒關閉過，自動顯示彈窗
        if (data.canClaimToday && !isDismissedToday()) {
          showRewardModal.value = true;
        }
      } else {
        error.value = response.error || data?.error || "獲取獎勵狀態失敗";
      }
    } catch (err: unknown) {
      error.value = (err as Error).message || "獲取獎勵狀態失敗";
      logger.error("獲取登入獎勵狀態失敗:", err);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 領取每日獎勵
   */
  const claimReward = async (): Promise<ClaimResult | null> => {
    if (!canClaim.value || isClaiming.value) {
      return null;
    }

    isClaiming.value = true;
    error.value = null;

    try {
      const idempotencyKey = `login_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const response = await apiJson("/api/rewards/login/claim", {
        method: "POST",
        body: { idempotencyKey },
      });

      // API 返回格式: { success, data: { ... } }
      const data = response.data || response;

      if (response.success && data) {
        lastClaimResult.value = data;

        // 更新狀態
        if (status.value) {
          status.value.canClaimToday = false;
          status.value.currentStreak = data.currentStreak;
          status.value.totalLoginDays = data.totalLoginDays;

          // ✅ 更新 monthRewards 中今日的 isClaimed 狀態
          if (data.dailyReward && data.dailyReward.day !== undefined) {
            // 確保 claimedDay 是數字類型
            const claimedDay = Number(data.dailyReward.day);
            logger.info(`[登入獎勵] 領取成功，更新第 ${claimedDay} 天的狀態`);

            if (status.value.monthRewards && status.value.monthRewards.length > 0) {
              status.value.monthRewards = status.value.monthRewards.map((reward) => {
                // 使用 Number() 確保類型一致的比較
                if (Number(reward.day) === claimedDay) {
                  logger.info(`[登入獎勵] 標記第 ${reward.day} 天為已領取`);
                  return { ...reward, isClaimed: true, isToday: true };
                }
                return reward;
              });
            }

            // 向後兼容：同時更新 weekRewards
            if (status.value.weekRewards && status.value.weekRewards.length > 0) {
              status.value.weekRewards = status.value.weekRewards.map((reward) => {
                if (Number(reward.day) === claimedDay) {
                  return { ...reward, isClaimed: true, isToday: true };
                }
                return reward;
              });
            }
          } else {
            logger.warn("[登入獎勵] API 回傳的 dailyReward.day 為空，無法更新 UI");
          }

          // 更新 todayReward 的狀態
          if (status.value.todayReward) {
            status.value.todayReward.isClaimed = true;
          }
        }

        return data;
      } else {
        error.value = response.error || data?.error || "領取獎勵失敗";
        return null;
      }
    } catch (err: unknown) {
      error.value = (err as Error).message || "領取獎勵失敗";
      logger.error("領取登入獎勵失敗:", err);
      return null;
    } finally {
      isClaiming.value = false;
    }
  };

  /**
   * 關閉獎勵彈窗
   * @param dismissed - 是否標記為今日不再顯示（用戶主動關閉時為 true）
   */
  const closeModal = (dismissed: boolean = true): void => {
    showRewardModal.value = false;
    // 用戶主動關閉時，標記今天不再顯示
    if (dismissed && canClaim.value) {
      markDismissedToday();
    }
  };

  /**
   * 打開獎勵彈窗
   */
  const openModal = (): void => {
    showRewardModal.value = true;
  };

  return {
    // 狀態
    isLoading,
    isClaiming,
    error,
    status,
    lastClaimResult,
    showRewardModal,

    // 計算屬性
    canClaim,
    currentStreak,
    todayReward,
    nextMilestone,
    weekRewards,
    monthRewards,
    displayMilestones,

    // 方法
    fetchStatus,
    claimReward,
    closeModal,
    openModal,
  };
}

export type UseLoginRewardReturn = ReturnType<typeof useLoginReward>;
