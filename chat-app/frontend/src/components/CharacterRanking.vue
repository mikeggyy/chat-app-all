<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useLevel, type RankingItem, type UserRank, type RankingPeriod } from "../composables/useLevel";
import LevelBadge from "./LevelBadge.vue";

interface Props {
  characterId: string;
  characterName?: string;
  show?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  characterName: "角色",
  show: false,
});

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { fetchCharacterRanking, fetchMyRank, isLoading, error } = useLevel();

const rankings = ref<RankingItem[]>([]);
const myRank = ref<UserRank | null>(null);
const isVisible = ref(false);

// 週期 Tab 相關
const selectedPeriod = ref<RankingPeriod>('total');
const periodTabs: { key: RankingPeriod; label: string }[] = [
  { key: 'daily', label: '日榜' },
  { key: 'weekly', label: '週榜' },
  { key: 'monthly', label: '月榜' },
  { key: 'total', label: '總榜' },
];

// 獲取顯示的點數（根據週期）
const getDisplayPoints = (item: RankingItem): number => {
  if (selectedPeriod.value === 'total') {
    return item.totalPoints || 0;
  }
  return item.periodPoints ?? item.displayPoints ?? item.totalPoints ?? 0;
};

// 獲取我的排名顯示點數
const myDisplayPoints = computed(() => {
  if (!myRank.value) return 0;
  if (selectedPeriod.value === 'total') {
    return myRank.value.totalPoints || 0;
  }
  return myRank.value.periodPoints ?? myRank.value.totalPoints ?? 0;
});

// 加載排行榜數據
const loadRankings = async () => {
  if (!props.characterId) return;

  const [rankingData, myRankData] = await Promise.all([
    fetchCharacterRanking(props.characterId, 50, selectedPeriod.value),
    fetchMyRank(props.characterId, selectedPeriod.value),
  ]);

  rankings.value = rankingData;
  myRank.value = myRankData;
};

// 切換週期
const switchPeriod = (period: RankingPeriod) => {
  if (selectedPeriod.value === period) return;
  selectedPeriod.value = period;
  loadRankings();
};

// 監聽 show 變化
watch(
  () => props.show,
  (newValue) => {
    isVisible.value = newValue;
    if (newValue) {
      // 重置到總榜
      selectedPeriod.value = 'total';
      loadRankings();
    }
  },
  { immediate: true }
);

// 獲取排名樣式
const getRankStyle = (rank: number) => {
  if (rank === 1) return { icon: "🥇", color: "#FFD700", bg: "rgba(255, 215, 0, 0.1)" };
  if (rank === 2) return { icon: "🥈", color: "#C0C0C0", bg: "rgba(192, 192, 192, 0.1)" };
  if (rank === 3) return { icon: "🥉", color: "#CD7F32", bg: "rgba(205, 127, 50, 0.1)" };
  return { icon: null, color: "#6B7280", bg: "transparent" };
};

// 關閉彈窗
const handleClose = () => {
  isVisible.value = false;
  emit("close");
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isVisible" class="ranking-modal-overlay" @click.self="handleClose">
        <div class="ranking-modal">
          <!-- 標題欄 -->
          <div class="ranking-header">
            <h2 class="ranking-title">
              <span class="trophy">🏆</span>
              {{ characterName }} 排行榜
            </h2>
            <button class="close-btn" @click="handleClose">✕</button>
          </div>

          <!-- 週期 Tab 切換 -->
          <div class="period-tabs">
            <button
              v-for="tab in periodTabs"
              :key="tab.key"
              class="period-tab"
              :class="{ active: selectedPeriod === tab.key }"
              @click="switchPeriod(tab.key)"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- 我的排名 -->
          <div v-if="myRank && myRank.rank" class="my-rank-card">
            <div class="my-rank-label">我的排名</div>
            <div class="my-rank-content">
              <div class="my-rank-number">
                <span v-if="myRank.rank <= 3" class="rank-medal">
                  {{ getRankStyle(myRank.rank).icon }}
                </span>
                <span v-else class="rank-text">#{{ myRank.rank }}</span>
              </div>
              <div class="my-rank-info">
                <LevelBadge
                  :level="myRank.level || 1"
                  :show-progress="false"
                  :show-badge="false"
                  size="sm"
                />
                <span class="points">{{ myDisplayPoints.toLocaleString() }} 點</span>
              </div>
              <div v-if="myRank.percentile !== undefined" class="my-rank-percentile">
                超越 {{ myRank.percentile }}% 的玩家
              </div>
            </div>
          </div>

          <!-- 排行榜列表 -->
          <div class="ranking-list">
            <div v-if="isLoading" class="loading-state">
              <div class="spinner"></div>
              <span>載入中...</span>
            </div>

            <div v-else-if="error" class="error-state">
              <span>{{ error }}</span>
              <button @click="loadRankings" class="retry-btn">重試</button>
            </div>

            <template v-else>
              <div
                v-for="item in rankings"
                :key="item.userId"
                class="ranking-item"
                :style="{ background: getRankStyle(item.rank).bg }"
              >
                <!-- 排名 -->
                <div class="rank-column">
                  <span v-if="item.rank <= 3" class="rank-medal">
                    {{ getRankStyle(item.rank).icon }}
                  </span>
                  <span
                    v-else
                    class="rank-number"
                    :style="{ color: getRankStyle(item.rank).color }"
                  >
                    {{ item.rank }}
                  </span>
                </div>

                <!-- 用戶資訊 -->
                <div class="user-column">
                  <span class="user-name">{{ item.displayName || '匿名用戶' }}</span>
                </div>

                <!-- 等級 -->
                <div class="level-column">
                  <LevelBadge
                    :level="item.level || 1"
                    :show-progress="false"
                    :show-badge="false"
                    size="sm"
                  />
                </div>

                <!-- 點數 -->
                <div class="points-column">
                  {{ getDisplayPoints(item).toLocaleString() }}
                </div>
              </div>

              <div v-if="rankings.length === 0" class="empty-state">
                暫無排行數據
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ranking-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.ranking-modal {
  background: white;
  border-radius: 1rem;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.ranking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #E5E7EB;
  background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
  color: white;
}

.ranking-title {
  font-size: 1.25rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.trophy {
  font-size: 1.5rem;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 週期 Tab 樣式 */
.period-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: #F9FAFB;
  border-bottom: 1px solid #E5E7EB;
}

.period-tab {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  color: #6B7280;
}

.period-tab:hover {
  background: #E5E7EB;
  color: #374151;
}

.period-tab.active {
  background: #6366F1;
  color: white;
  box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);
}

.my-rank-card {
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  margin: 1rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 2px solid #F59E0B;
}

.my-rank-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #92400E;
  margin-bottom: 0.5rem;
}

.my-rank-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.my-rank-number {
  font-size: 1.5rem;
  font-weight: 900;
}

.rank-medal {
  font-size: 1.75rem;
}

.rank-text {
  color: #6366F1;
}

.my-rank-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.points {
  font-size: 0.875rem;
  color: #6B7280;
}

.my-rank-percentile {
  font-size: 0.75rem;
  color: #059669;
  font-weight: 600;
}

.ranking-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1rem 1rem;
}

.ranking-item {
  display: grid;
  grid-template-columns: 3rem 1fr 3rem 4rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  transition: background 0.2s;
}

.ranking-item:hover {
  background: #F3F4F6 !important;
}

.rank-column {
  text-align: center;
}

.rank-number {
  font-weight: 700;
  font-size: 1rem;
}

.user-column {
  overflow: hidden;
}

.user-name {
  font-weight: 500;
  color: #1F2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.level-column {
  display: flex;
  justify-content: center;
}

.points-column {
  text-align: right;
  font-size: 0.875rem;
  font-weight: 600;
  color: #6366F1;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  color: #6B7280;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #E5E7EB;
  border-top-color: #6366F1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  padding: 0.5rem 1rem;
  background: #6366F1;
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 500;
}

.retry-btn:hover {
  background: #4F46E5;
}

/* 過渡動畫 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .ranking-modal,
.modal-leave-active .ranking-modal {
  transition: transform 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .ranking-modal {
  transform: translateY(20px) scale(0.95);
}

.modal-leave-to .ranking-modal {
  transform: translateY(-20px) scale(0.95);
}

/* 響應式 */
@media (max-width: 640px) {
  .ranking-modal {
    max-height: 90vh;
    border-radius: 1rem 1rem 0 0;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    max-width: 100%;
  }

  .ranking-item {
    grid-template-columns: 2.5rem 1fr 2.5rem 3.5rem;
    gap: 0.5rem;
    padding: 0.625rem;
  }
}

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
  .ranking-modal {
    background: #1F2937;
  }

  .ranking-header {
    border-bottom-color: #374151;
  }

  .period-tabs {
    background: #111827;
    border-bottom-color: #374151;
  }

  .period-tab {
    color: #9CA3AF;
  }

  .period-tab:hover {
    background: #374151;
    color: #F3F4F6;
  }

  .period-tab.active {
    background: #6366F1;
    color: white;
  }

  .my-rank-card {
    background: linear-gradient(135deg, #422006 0%, #78350F 100%);
    border-color: #D97706;
  }

  .my-rank-label {
    color: #FCD34D;
  }

  .ranking-item:hover {
    background: #374151 !important;
  }

  .user-name {
    color: #F3F4F6;
  }

  .points {
    color: #9CA3AF;
  }
}
</style>
