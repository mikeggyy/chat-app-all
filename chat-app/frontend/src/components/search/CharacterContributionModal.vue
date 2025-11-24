<script setup lang="ts">
import { ref, watch } from "vue";
import { XMarkIcon, TrophyIcon } from "@heroicons/vue/24/solid";
import { useLevel, type RankingItem, type RankingPeriod } from "../../composables/useLevel";
import LevelBadge from "../LevelBadge.vue";

interface Props {
  characterId: string;
  characterName: string;
  characterImage?: string;
  show: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  characterImage: "/ai-role/match-role-01.webp",
});

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { fetchCharacterRanking, fetchMyRank, isLoading } = useLevel();

const rankings = ref<RankingItem[]>([]);
const myRank = ref<any>(null);
const selectedPeriod = ref<RankingPeriod>("total");

const periodTabs: { key: RankingPeriod; label: string }[] = [
  { key: "daily", label: "日榜" },
  { key: "weekly", label: "週榜" },
  { key: "monthly", label: "月榜" },
  { key: "total", label: "總榜" },
];

// 加載排行榜
const loadRankings = async () => {
  if (!props.characterId) return;

  const [rankingData, myRankData] = await Promise.all([
    fetchCharacterRanking(props.characterId, 100, selectedPeriod.value),
    fetchMyRank(props.characterId, selectedPeriod.value),
  ]);

  rankings.value = rankingData || [];
  myRank.value = myRankData;
};

// 切換週期
const switchPeriod = (period: RankingPeriod) => {
  if (selectedPeriod.value === period) return;
  selectedPeriod.value = period;
  loadRankings();
};

// 獲取顯示點數
const getDisplayPoints = (item: RankingItem): number => {
  if (selectedPeriod.value === "total") {
    return item.totalPoints || 0;
  }
  return item.periodPoints ?? item.displayPoints ?? item.totalPoints ?? 0;
};

// 獲取排名樣式
const getRankStyle = (rank: number) => {
  if (rank === 1) return { icon: "🥇", class: "rank-gold" };
  if (rank === 2) return { icon: "🥈", class: "rank-silver" };
  if (rank === 3) return { icon: "🥉", class: "rank-bronze" };
  return { icon: `${rank}`, class: "" };
};

// 監聽顯示狀態
watch(
  () => props.show,
  (newValue) => {
    if (newValue) {
      selectedPeriod.value = "total";
      loadRankings();
    }
  },
  { immediate: true }
);

const handleClose = () => {
  emit("close");
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="modal-overlay" @click.self="handleClose">
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-info">
              <img :src="characterImage" :alt="characterName" class="character-avatar" />
              <div class="header-text">
                <h2 class="modal-title">{{ characterName }}</h2>
                <p class="modal-subtitle">貢獻排行榜</p>
              </div>
            </div>
            <button class="close-btn" @click="handleClose">
              <XMarkIcon class="icon" />
            </button>
          </div>

          <!-- Period Tabs -->
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

          <!-- My Rank -->
          <div v-if="myRank?.rank" class="my-rank-section">
            <div class="my-rank-label">我的排名</div>
            <div class="my-rank-content">
              <span class="my-rank-number">
                {{ getRankStyle(myRank.rank).icon }}
              </span>
              <span class="my-rank-points">
                {{ (selectedPeriod === 'total' ? myRank.totalPoints : myRank.periodPoints || 0).toLocaleString() }} 點
              </span>
            </div>
          </div>

          <!-- Rankings List -->
          <div class="rankings-container">
            <div v-if="isLoading" class="loading-state">
              <p>載入中...</p>
            </div>

            <div v-else-if="rankings.length === 0" class="empty-state">
              <TrophyIcon class="empty-icon" />
              <p>暫無排行數據</p>
              <span>快去和 {{ characterName }} 互動吧！</span>
            </div>

            <div v-else class="rankings-list">
              <div
                v-for="item in rankings"
                :key="item.userId"
                class="ranking-item"
                :class="getRankStyle(item.rank).class"
              >
                <div class="rank-column">
                  <span class="rank-badge" :class="getRankStyle(item.rank).class">
                    {{ getRankStyle(item.rank).icon }}
                  </span>
                </div>
                <div class="user-column">
                  <span class="user-name">{{ item.displayName || '匿名用戶' }}</span>
                  <LevelBadge
                    :level="item.level || 1"
                    :show-progress="false"
                    :show-badge="false"
                    size="sm"
                  />
                </div>
                <div class="points-column">
                  {{ getDisplayPoints(item).toLocaleString() }} 點
                </div>
              </div>
            </div>
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
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: #1f2937;
  border-radius: 1rem;
  width: 100%;
  max-width: 420px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #374151, #1f2937);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.character-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: cover;
  border: 2px solid rgba(251, 191, 36, 0.5);
}

.header-text {
  .modal-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #f9fafb;
  }

  .modal-subtitle {
    margin: 0.15rem 0 0;
    font-size: 0.8rem;
    color: rgba(156, 163, 175, 0.9);
  }
}

.close-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  .icon {
    width: 20px;
    height: 20px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #f9fafb;
  }
}

.period-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: #111827;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.period-tab {
  flex: 1;
  padding: 0.5rem 0.5rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  color: #9ca3af;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f3f4f6;
  }

  &.active {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  }
}

.my-rank-section {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
  border-bottom: 1px solid rgba(251, 191, 36, 0.2);
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.my-rank-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #fbbf24;
}

.my-rank-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.my-rank-number {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f9fafb;
}

.my-rank-points {
  font-size: 0.85rem;
  color: rgba(249, 250, 251, 0.8);
}

.rankings-container {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.loading-state,
.empty-state {
  padding: 3rem 1rem;
  text-align: center;
  color: #9ca3af;

  p {
    margin: 0.5rem 0;
    font-size: 0.95rem;
  }

  span {
    font-size: 0.85rem;
    color: #6b7280;
  }
}

.empty-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 0.5rem;
  opacity: 0.5;
}

.rankings-list {
  display: flex;
  flex-direction: column;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  &.rank-gold {
    background: linear-gradient(90deg, rgba(251, 191, 36, 0.1), transparent);
  }

  &.rank-silver {
    background: linear-gradient(90deg, rgba(148, 163, 184, 0.1), transparent);
  }

  &.rank-bronze {
    background: linear-gradient(90deg, rgba(205, 127, 50, 0.08), transparent);
  }
}

.rank-column {
  width: 36px;
  flex-shrink: 0;
}

.rank-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 0.9rem;
  font-weight: 700;
  background: rgba(75, 85, 99, 0.5);
  color: #e5e7eb;

  &.rank-gold {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    color: #451a03;
    box-shadow: 0 2px 8px rgba(251, 191, 36, 0.4);
  }

  &.rank-silver {
    background: linear-gradient(135deg, #94a3b8, #64748b);
    color: #1e293b;
    box-shadow: 0 2px 8px rgba(148, 163, 184, 0.3);
  }

  &.rank-bronze {
    background: linear-gradient(135deg, #cd7f32, #a0522d);
    color: #fff;
    box-shadow: 0 2px 8px rgba(205, 127, 50, 0.3);
  }
}

.user-column {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: #f3f4f6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.points-column {
  font-size: 0.85rem;
  font-weight: 600;
  color: #9ca3af;
  white-space: nowrap;
}

// Animation
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container {
  transition: transform 0.25s ease;
}

.modal-fade-enter-from .modal-container,
.modal-fade-leave-to .modal-container {
  transform: scale(0.95) translateY(10px);
}
</style>
