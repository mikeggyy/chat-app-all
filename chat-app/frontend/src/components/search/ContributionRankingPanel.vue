<script setup lang="ts">
import { ref } from "vue";
import { ArrowRightIcon, TrophyIcon } from "@heroicons/vue/24/solid";
import CharacterCard from "./CharacterCard.vue";
import CharacterContributionModal from "./CharacterContributionModal.vue";

interface TopContributor {
  rank: number;
  userId: string;
  points: number;
  displayName: string;
  photoURL?: string;
}

interface ContributionItem {
  id: string;
  matchId: string;
  rank: number;
  name: string;
  description: string;
  image: string;
  totalPoints: number;
  totalSpent: number;
  contributorCount: number;
  totalPointsFormatted: string;
  totalSpentFormatted: string;
  topContributors: TopContributor[];
}

// 排名標籤
const getRankLabel = (rank: number): string => {
  switch (rank) {
    case 1:
      return "榜一";
    case 2:
      return "榜二";
    case 3:
      return "榜三";
    default:
      return `第${rank}`;
  }
};

// 排名樣式類
const getRankClass = (rank: number): string => {
  switch (rank) {
    case 1:
      return "rank-gold";
    case 2:
      return "rank-silver";
    case 3:
      return "rank-bronze";
    default:
      return "";
  }
};

const props = defineProps({
  characters: {
    type: Array as () => ContributionItem[],
    default: () => [],
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["open-panel"]);

// Modal 狀態
const showModal = ref(false);
const selectedCharacter = ref<ContributionItem | null>(null);

const handleViewRanking = () => {
  emit("open-panel", "contribution");
};

// 點擊卡片打開該角色的貢獻排行榜
const handleCardClick = (item: ContributionItem) => {
  selectedCharacter.value = item;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  selectedCharacter.value = null;
};

// 將角色數據轉換為 CharacterCard 需要的格式
const formatForCard = (item: ContributionItem) => {
  return {
    id: item.matchId,
    matchId: item.matchId,
    name: item.name,
    image: item.image,
    // 使用貢獻數據顯示
    favoritesCountFormatted: item.contributorCount.toString(),
    messageCountFormatted: item.totalPointsFormatted,
  };
};
</script>

<template>
  <section class="contribution-section">
    <header class="section-header compact">
      <div class="section-title">
        <div class="section-icon accent-gold">
          <TrophyIcon aria-hidden="true" />
        </div>
        <div>
          <p class="section-kicker">粉絲熱情</p>
          <h2>貢獻排行</h2>
        </div>
      </div>
      <button
        type="button"
        class="section-action"
        @click="handleViewRanking"
        aria-haspopup="dialog"
      >
        <span>查看榜單</span>
        <ArrowRightIcon class="icon" aria-hidden="true" />
      </button>
    </header>

    <!-- 加載中狀態 -->
    <div v-if="isLoading" class="contribution-empty">
      <p>載入中...</p>
    </div>

    <!-- 空狀態 -->
    <div v-else-if="characters.length === 0" class="contribution-empty">
      <p>暫無貢獻數據</p>
      <span>快去和角色互動吧！</span>
    </div>

    <!-- 貢獻排行列表 -->
    <div v-else class="contribution-scroll">
      <div
        v-for="(item, index) in characters"
        :key="item.id"
        class="contribution-card-wrapper"
      >
        <!-- 排名徽章 -->
        <div class="rank-badge" :class="`rank-${index + 1}`">
          {{ index + 1 }}
        </div>
        <CharacterCard
          :profile="formatForCard(item)"
          @click="handleCardClick(item)"
        />
        <!-- 前3名貢獻者 -->
        <div v-if="item.topContributors?.length" class="top-contributors">
          <div
            v-for="contributor in item.topContributors"
            :key="contributor.userId"
            class="contributor-row"
            :class="getRankClass(contributor.rank)"
          >
            <span class="contributor-rank">{{
              getRankLabel(contributor.rank)
            }}</span>
            <div class="contributor-info">
              <img
                v-if="contributor.photoURL"
                :src="contributor.photoURL"
                :alt="contributor.displayName"
                class="contributor-avatar"
              />
              <div v-else class="contributor-avatar placeholder">
                {{ contributor.displayName?.charAt(0) || '?' }}
              </div>
              <span class="contributor-name">{{ contributor.displayName }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 角色貢獻排行榜 Modal -->
    <CharacterContributionModal
      v-if="selectedCharacter"
      :show="showModal"
      :character-id="selectedCharacter.matchId"
      :character-name="selectedCharacter.name"
      :character-image="selectedCharacter.image"
      @close="closeModal"
    />
  </section>
</template>

<style scoped lang="scss">
.contribution-section {
  background: rgba(15, 23, 42, 0.7);
  border-radius: 18px;
  padding: clamp(1.3rem, 4vw, 1.65rem);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 24px 48px rgba(2, 6, 23, 0.45);
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .contribution-empty {
    padding: 2rem 1rem;
    text-align: center;
    color: rgba(226, 232, 240, 0.6);

    p {
      margin: 0 0 0.5rem;
      font-size: 0.95rem;
      color: rgba(226, 232, 240, 0.75);
    }

    span {
      font-size: 0.85rem;
    }
  }

  .contribution-scroll {
    display: flex;
    gap: 1rem;
    overflow-x: auto;
    padding-bottom: 0.4rem;
    margin: 0 -0.5rem 0 -0.5rem;
    padding-inline: 0.5rem;
    scroll-snap-type: x mandatory;
  }
}

.contribution-card-wrapper {
  position: relative;
  flex-shrink: 0;
  scroll-snap-align: start;
  width: 140px;
  min-width: 140px;

  .top-contributors {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.4rem;
  }

  .contributor-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.2rem 0.4rem;
    background: rgba(71, 85, 105, 0.3);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 6px;
    overflow: hidden;

    .contributor-rank {
      font-size: 0.65rem;
      font-weight: 700;
      flex-shrink: 0;
      color: rgba(226, 232, 240, 0.7);
    }

    .contributor-info {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      min-width: 0;
      max-width: 70%;
      overflow: hidden;
    }

    .contributor-avatar {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      flex-shrink: 0;
      object-fit: cover;
      border: 1px solid rgba(148, 163, 184, 0.3);

      &.placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(71, 85, 105, 0.6);
        font-size: 0.55rem;
        font-weight: 600;
        color: rgba(226, 232, 240, 0.8);
      }
    }

    .contributor-name {
      font-size: 0.7rem;
      color: rgba(226, 232, 240, 0.85);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    // 榜一 - 金色
    &.rank-gold {
      background: linear-gradient(
        135deg,
        rgba(251, 191, 36, 0.2),
        rgba(245, 158, 11, 0.15)
      );
      border-color: rgba(251, 191, 36, 0.35);

      .contributor-rank {
        color: #fbbf24;
      }

      .contributor-avatar {
        border-color: rgba(251, 191, 36, 0.6);
      }
    }

    // 榜二 - 銀色
    &.rank-silver {
      background: linear-gradient(
        135deg,
        rgba(148, 163, 184, 0.2),
        rgba(100, 116, 139, 0.15)
      );
      border-color: rgba(148, 163, 184, 0.35);

      .contributor-rank {
        color: #94a3b8;
      }

      .contributor-avatar {
        border-color: rgba(148, 163, 184, 0.6);
      }
    }

    // 榜三 - 銅色
    &.rank-bronze {
      background: linear-gradient(
        135deg,
        rgba(205, 127, 50, 0.2),
        rgba(160, 82, 45, 0.15)
      );
      border-color: rgba(205, 127, 50, 0.35);

      .contributor-rank {
        color: #cd7f32;
      }

      .contributor-avatar {
        border-color: rgba(205, 127, 50, 0.6);
      }
    }
  }
}

.rank-badge {
  position: absolute;
  top: 2px;
  left: 2px;
  z-index: 10;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.85rem;
  font-weight: 700;
  background: rgba(71, 85, 105, 0.9);
  border: 2px solid rgba(148, 163, 184, 0.3);
  color: #e2e8f0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  &.rank-1 {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    border-color: #fcd34d;
    color: #451a03;
    box-shadow: 0 4px 16px rgba(251, 191, 36, 0.5);
  }

  &.rank-2 {
    background: linear-gradient(135deg, #94a3b8, #64748b);
    border-color: #cbd5e1;
    color: #1e293b;
    box-shadow: 0 4px 12px rgba(148, 163, 184, 0.4);
  }

  &.rank-3 {
    background: linear-gradient(135deg, #cd7f32, #a0522d);
    border-color: #daa520;
    color: #fff;
    box-shadow: 0 4px 12px rgba(205, 127, 50, 0.4);
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.85rem;

  h2 {
    margin: 0;
    font-size: 1.3rem;
    color: #f8fafc;
    letter-spacing: 0.03em;
  }

  .section-kicker {
    margin: 0;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(226, 232, 240, 0.6);
  }
}

.section-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(226, 232, 240, 0.08);

  svg {
    width: 20px;
    height: 20px;
  }

  &.accent-gold {
    background: linear-gradient(
      135deg,
      rgba(251, 191, 36, 0.28),
      rgba(245, 158, 11, 0.22)
    );
    border-color: rgba(251, 191, 36, 0.5);
    color: #fef3c7;
  }
}

.section-action {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(15, 23, 42, 0.4);
  color: rgba(226, 232, 240, 0.85);
  font-size: 0.82rem;
  font-weight: 600;
  transition: border-color 160ms ease, transform 160ms ease;

  .icon {
    width: 18px;
    height: 18px;
  }

  &:hover {
    border-color: rgba(148, 163, 184, 0.45);
    transform: translateX(2px);
  }
}

@media (max-width: 640px) {
  .section-action {
    align-self: flex-start;
  }
}
</style>
