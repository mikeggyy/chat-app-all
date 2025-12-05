<script setup lang="ts">
import { computed } from "vue";
import { GiftIcon, TrophyIcon, CheckIcon } from "@heroicons/vue/24/solid";
import { XMarkIcon } from "@heroicons/vue/24/outline";

// Props
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
  };
  isLegendary?: boolean;
  isCompleted?: boolean;
  isClaimed?: boolean;
  progress?: number;
}

interface Props {
  isOpen: boolean;
  canClaim: boolean;
  isClaiming: boolean;
  currentStreak: number;
  todayReward: DailyReward | null;
  monthRewards?: DailyReward[];
  weekRewards?: DailyReward[];
  displayMilestones?: MilestoneReward[];
  nextMilestone?: { days: number; title: string; daysRemaining: number } | null;
  claimResult?: {
    dailyReward: DailyReward;
    milestoneReward: MilestoneReward | null;
    totalCoinsEarned: number;
  } | null;
}

interface Emits {
  (e: "close"): void;
  (e: "claim"): void;
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  canClaim: false,
  isClaiming: false,
  currentStreak: 0,
  todayReward: null,
  monthRewards: () => [],
  weekRewards: () => [],
  displayMilestones: () => [],
  nextMilestone: null,
  claimResult: null,
});

const emit = defineEmits<Emits>();

// 計算屬性
const showClaimResult = computed(() => {
  return props.claimResult !== null;
});

// 將 21 天獎勵分成 3 週
const weeklyRewards = computed(() => {
  const rewards = props.monthRewards || props.weekRewards || [];
  if (rewards.length <= 7) {
    // 向後兼容：如果只有 7 天的數據
    return [{ week: 1, label: "本週", days: rewards }];
  }
  // 只顯示前 21 天（3 週）
  return [
    { week: 1, label: "第一週", days: rewards.slice(0, 7) },
    { week: 2, label: "第二週", days: rewards.slice(7, 14) },
    { week: 3, label: "第三週", days: rewards.slice(14, 21) },
  ];
});

// 當前週期內的進度（21 天循環）
const currentDayInCycle = computed(() => {
  if (props.currentStreak === 0) return 0;
  const day = props.currentStreak % 21;
  return day === 0 ? 21 : day;
});

// 格式化獎勵文字
const formatRewards = (rewards: MilestoneReward["rewards"]) => {
  const parts: string[] = [];
  if (rewards.coins) parts.push(`${rewards.coins} 金幣`);
  if (rewards.photoUnlockCards)
    parts.push(`${rewards.photoUnlockCards} 照片卡`);
  if (rewards.characterUnlockCards)
    parts.push(`${rewards.characterUnlockCards} 角色券`);
  return parts.join(" + ");
};

// 方法
const handleClose = () => {
  emit("close");
};

const handleClaim = () => {
  if (props.canClaim && !props.isClaiming) {
    emit("claim");
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="handleClose">
        <div class="modal-container">
          <!-- 頭部 -->
          <div class="modal-header">
            <div class="header-icon">
              <GiftIcon class="icon" />
            </div>
            <h2 class="header-title">每日登入獎勵</h2>
            <button class="close-btn" @click="handleClose">
              <XMarkIcon class="close-icon" />
            </button>
          </div>

          <!-- 連續登入天數 -->
          <div class="streak-section">
            <div class="streak-badge">
              <span class="fire-emoji">🔥</span>
              <span class="streak-count">{{ currentStreak }}</span>
              <span class="streak-label">連續登入</span>
            </div>
            <div
              v-if="monthRewards && monthRewards.length > 7"
              class="cycle-progress"
            >
              連續進度：{{ currentDayInCycle }}/21 天
            </div>
          </div>

          <!-- 里程碑獎勵預覽 -->
          <div
            v-if="displayMilestones && displayMilestones.length > 0"
            class="milestones-section"
          >
            <div class="milestones-title">
              <TrophyIcon class="trophy-icon" />
              <span>里程碑獎勵</span>
            </div>
            <div class="milestones-grid">
              <div
                v-for="milestone in displayMilestones"
                :key="milestone.days"
                class="milestone-card"
                :class="{
                  'milestone-card--completed': milestone.isCompleted,
                  'milestone-card--claimed': milestone.isClaimed,
                }"
                :style="{ '--milestone-color': milestone.color || '#ec4899' }"
              >
                <div class="milestone-badge-icon">{{ milestone.badge }}</div>
                <div class="milestone-days">{{ milestone.days }}天</div>
                <div class="milestone-card-title">{{ milestone.title }}</div>
                <div class="milestone-card-rewards">
                  {{ formatRewards(milestone.rewards) }}
                </div>
                <div v-if="milestone.isClaimed" class="milestone-check">
                  <CheckIcon class="check-icon" />
                </div>
                <div
                  v-else-if="!milestone.isCompleted"
                  class="milestone-progress-bar"
                >
                  <div
                    class="milestone-progress-fill"
                    :style="{ width: `${milestone.progress}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 領取結果 -->
          <div v-if="showClaimResult && claimResult" class="claim-result">
            <div class="result-title">🎉 獲得獎勵！</div>
            <div class="result-coins">
              <span class="coins-amount"
                >+{{ claimResult.totalCoinsEarned }}</span
              >
              <span class="coins-label">金幣</span>
            </div>
            <div v-if="claimResult.milestoneReward" class="milestone-bonus">
              <div class="bonus-badge">
                {{ claimResult.milestoneReward.badge }}
              </div>
              <div class="bonus-title">
                {{ claimResult.milestoneReward.title }}
              </div>
              <div class="bonus-rewards">
                <span
                  v-if="claimResult.milestoneReward.rewards.photoUnlockCards"
                >
                  +{{
                    claimResult.milestoneReward.rewards.photoUnlockCards
                  }}
                  照片卡
                </span>
                <span
                  v-if="
                    claimResult.milestoneReward.rewards.characterUnlockCards
                  "
                >
                  +{{
                    claimResult.milestoneReward.rewards.characterUnlockCards
                  }}
                  角色解鎖券
                </span>
              </div>
            </div>
          </div>

          <!-- 今日獎勵預覽（未領取時顯示） -->
          <div v-else-if="canClaim && todayReward" class="today-reward">
            <div class="today-label">
              今日獎勵（第 {{ todayReward.day }} 天）
            </div>
            <div class="today-coins">
              <span class="coins-amount">{{ todayReward.coins }}</span>
              <span class="coins-label">金幣</span>
            </div>
          </div>

          <!-- 本月每日獎勵預覽 -->
          <div class="month-rewards">
            <div
              v-for="weekData in weeklyRewards"
              :key="weekData.week"
              class="week-section"
            >
              <div class="week-label">{{ weekData.label }}</div>
              <div class="week-days">
                <div
                  v-for="reward in weekData.days"
                  :key="reward.day"
                  class="day-reward"
                  :class="{
                    'day-reward--claimed': reward.isClaimed,
                    'day-reward--today': reward.isToday,
                    'day-reward--milestone': reward.milestone,
                    'day-reward--highlight': reward.highlight,
                  }"
                >
                  <div class="day-number">{{ reward.day }}天</div>
                  <div class="day-coins">
                    <img
                      src="/icons/wallet-coin.png"
                      alt="金幣"
                      class="coin-icon"
                    />
                    <span>{{ reward.coins }}</span>
                  </div>
                  <!-- 已領取覆蓋層 - 覆蓋整個日期格子 -->
                  <div v-if="reward.isClaimed" class="claimed-overlay">
                    <CheckIcon class="claimed-check-icon" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 下一個里程碑進度 -->
          <div v-if="nextMilestone && !showClaimResult" class="next-milestone">
            <div class="next-milestone-header">
              <span>下一個里程碑：{{ nextMilestone.title }}</span>
            </div>
            <div class="next-milestone-remaining">
              還差 <strong>{{ nextMilestone.daysRemaining }}</strong> 天
            </div>
          </div>

          <!-- 按鈕 -->
          <div class="modal-actions">
            <button
              v-if="canClaim && !showClaimResult"
              class="claim-btn"
              :disabled="isClaiming"
              @click="handleClaim"
            >
              <span v-if="isClaiming">領取中...</span>
              <span v-else>領取獎勵</span>
            </button>
            <button v-else class="confirm-btn" @click="handleClose">
              {{ showClaimResult ? "太棒了！" : "明天再來" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.modal-container {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  border: 1px solid rgba(236, 72, 153, 0.3);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  max-width: 420px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: linear-gradient(
    135deg,
    rgba(236, 72, 153, 0.2),
    rgba(30, 64, 175, 0.2)
  );
}

.header-icon {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 0.75rem;

  .icon {
    width: 26px;
    height: 26px;
    color: white;
  }
}

.header-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
}

.close-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  padding: 0.4rem;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .close-icon {
    width: 18px;
    height: 18px;
    color: #94a3b8;
  }
}

.streak-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem;
  gap: 0.5rem;
}

.streak-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(
    135deg,
    rgba(251, 146, 60, 0.2),
    rgba(234, 88, 12, 0.2)
  );
  border: 1px solid rgba(251, 146, 60, 0.3);
  border-radius: 999px;
  padding: 0.4rem 1rem;
}

.fire-emoji {
  font-size: 1.1rem;
  line-height: 1;
}

.streak-count {
  font-size: 1.4rem;
  font-weight: 800;
  color: #fb923c;
}

.streak-label {
  font-size: 0.8rem;
  color: #fbbf24;
}

.cycle-progress {
  font-size: 0.75rem;
  color: #64748b;
}

// 里程碑區塊
.milestones-section {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.milestones-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 0.6rem;

  .trophy-icon {
    width: 16px;
    height: 16px;
    color: #fbbf24;
  }
}

.milestones-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.milestone-card {
  position: relative;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  padding: 0.5rem;
  text-align: center;
  transition: all 0.2s;

  &--completed {
    background: color-mix(in srgb, var(--milestone-color) 10%, transparent);
    border-color: var(--milestone-color);
  }

  &--claimed {
    opacity: 0.7;
  }
}

.milestone-badge-icon {
  font-size: 1.2rem;
  margin-bottom: 0.2rem;
}

.milestone-days {
  font-size: 0.9rem;
  font-weight: 700;
  color: #f8fafc;
}

.milestone-card-title {
  font-size: 0.65rem;
  color: #94a3b8;
  margin-bottom: 0.2rem;
}

.milestone-card-rewards {
  font-size: 0.55rem;
  color: #fbbf24;
  line-height: 1.3;
}

.milestone-check {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  background: #22c55e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  .check-icon {
    width: 10px;
    height: 10px;
    color: white;
  }
}

.milestone-progress-bar {
  height: 3px;
  background: rgba(148, 163, 184, 0.2);
  border-radius: 2px;
  margin-top: 0.3rem;
  overflow: hidden;
}

.milestone-progress-fill {
  height: 100%;
  background: var(--milestone-color);
  border-radius: 2px;
  transition: width 0.3s ease;
}

// 本月獎勵區塊
.month-rewards {
  padding: 0.5rem 0.75rem;
}

.week-section {
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.week-label {
  font-size: 0.7rem;
  color: #64748b;
  margin-bottom: 0.3rem;
  padding-left: 0.25rem;
}

.week-days {
  display: flex;
  gap: 0.25rem;
}

.day-reward {
  position: relative;
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.15rem;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 6px;
  text-align: center;
  transition: all 0.2s;

  &--claimed {
    // 已領取的日期用覆蓋層顯示勾勾，不需要降低透明度
    border-color: rgba(34, 197, 94, 0.4);
  }

  &--today {
    background: rgba(236, 72, 153, 0.15);
    border-color: rgba(236, 72, 153, 0.4);
    transform: scale(1.05);
    z-index: 1;
  }

  &--milestone {
    background: linear-gradient(
      135deg,
      rgba(251, 191, 36, 0.15),
      rgba(245, 158, 11, 0.1)
    );
    border-color: rgba(251, 191, 36, 0.3);
  }

  &--highlight {
    border-color: rgba(251, 191, 36, 0.5);
  }
}

.day-number {
  font-size: 0.6rem;
  color: #94a3b8;
}

.day-coins {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fbbf24;
}

.coin-icon {
  width: 0.7rem;
  height: 0.7rem;
  object-fit: contain;
}

// 已領取覆蓋層 - 覆蓋整個日期格子
.claimed-overlay {
  position: absolute;
  inset: 0;
  background: rgba(34, 197, 94, 0.85);
  border-radius: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.claimed-check-icon {
  width: 1.2rem;
  height: 1.2rem;
  color: white;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

// 領取結果
.claim-result {
  text-align: center;
  padding: 0.75rem;
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.1),
    rgba(16, 185, 129, 0.05)
  );
  margin: 0.5rem 0.75rem;
  border-radius: 12px;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.result-title {
  font-size: 1rem;
  font-weight: 600;
  color: #22c55e;
  margin-bottom: 0.4rem;
}

.result-coins {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.3rem;
}

.coins-amount {
  font-size: 1.8rem;
  font-weight: 800;
  color: #fbbf24;
}

.coins-label {
  font-size: 0.9rem;
  color: #fbbf24;
  opacity: 0.8;
}

.milestone-bonus {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.bonus-badge {
  font-size: 1.3rem;
  margin-bottom: 0.2rem;
}

.bonus-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #a78bfa;
  margin-bottom: 0.2rem;
}

.bonus-rewards {
  font-size: 0.75rem;
  color: #94a3b8;

  span {
    display: inline-block;
    margin: 0 0.2rem;
  }
}

// 今日獎勵
.today-reward {
  text-align: center;
  padding: 0.75rem;
}

.today-label {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-bottom: 0.4rem;
}

.today-coins {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.3rem;
}

// 下一個里程碑
.next-milestone {
  text-align: center;
  padding: 0.5rem 0.75rem;
  background: rgba(30, 41, 59, 0.3);
  margin: 0 0.75rem;
  border-radius: 8px;
}

.next-milestone-header {
  font-size: 0.75rem;
  color: #94a3b8;
}

.next-milestone-remaining {
  font-size: 0.8rem;
  color: #64748b;

  strong {
    color: #ec4899;
    font-size: 1rem;
  }
}

// 按鈕
.modal-actions {
  padding: 0.75rem;
}

.claim-btn,
.confirm-btn {
  width: 100%;
  padding: 0.875rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.claim-btn {
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  color: white;
  box-shadow: 0 4px 15px rgba(236, 72, 153, 0.4);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(236, 72, 153, 0.5);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.confirm-btn {
  background: rgba(148, 163, 184, 0.2);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.3);

  &:hover {
    background: rgba(148, 163, 184, 0.3);
  }
}

// 動畫
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;

  .modal-container {
    transform: scale(0.9) translateY(20px);
  }
}

// ========================================
// 桌面版樣式 (≥ 1024px)
// ========================================
@media (min-width: 1024px) {
  .modal-container {
    max-width: 520px;
    border-radius: 24px;
  }

  .modal-header {
    padding: 1.5rem;
  }

  .header-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;

    .icon {
      width: 30px;
      height: 30px;
    }
  }

  .header-title {
    font-size: 1.35rem;
  }

  .close-btn {
    padding: 0.5rem;
    transition: all 0.2s ease;

    &:hover {
      transform: scale(1.1);
    }

    .close-icon {
      width: 20px;
      height: 20px;
    }
  }

  .streak-section {
    padding: 1rem;
  }

  .streak-badge {
    padding: 0.5rem 1.25rem;
  }

  .streak-count {
    font-size: 1.6rem;
  }

  .milestones-section {
    padding: 1rem 1.25rem;
  }

  .milestones-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  .milestone-card {
    border-radius: 12px;
    padding: 0.75rem 0.5rem;
    transition: all 0.2s ease;

    &:hover:not(.milestone-card--claimed) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }
  }

  .milestone-badge-icon {
    font-size: 1.4rem;
  }

  .month-rewards {
    padding: 0.75rem 1rem;
  }

  .week-days {
    gap: 0.4rem;
  }

  .day-reward {
    padding: 0.5rem 0.25rem;
    border-radius: 8px;
    transition: all 0.2s ease;

    &:hover:not(.day-reward--claimed) {
      transform: translateY(-2px);
    }

    &--today {
      transform: scale(1.08);

      &:hover {
        transform: scale(1.1);
      }
    }
  }

  .day-number {
    font-size: 0.7rem;
  }

  .day-coins {
    font-size: 0.8rem;
  }

  .coin-icon {
    width: 0.8rem;
    height: 0.8rem;
  }

  .claim-result {
    padding: 1rem;
    margin: 0.75rem 1rem;
  }

  .result-title {
    font-size: 1.1rem;
  }

  .coins-amount {
    font-size: 2rem;
  }

  .modal-actions {
    padding: 1rem;
  }

  .claim-btn,
  .confirm-btn {
    padding: 1rem;
    font-size: 1.05rem;
    border-radius: 14px;
  }

  .claim-btn:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(236, 72, 153, 0.5);
  }
}
</style>
