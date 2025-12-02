/**
 * useLevel.ts
 * 等級系統 composable
 * 管理用戶與角色的等級、點數和排行榜
 */

import { ref } from 'vue';
import { apiJson } from '../utils/api.js';
import { logger } from '../utils/logger.js';

// ==================== 類型定義 ====================

/**
 * 等級進度資訊
 */
export interface LevelProgress {
  level: number;
  currentPoints: number;
  pointsToNextLevel: number;
  progress: number; // 0-100 百分比
  totalPoints: number;
  combo?: {
    count: number;
    multiplier: number;
    effect: string | null;
  };
  leveledUp?: boolean;
  previousLevel?: number;
  pointsAdded?: number;
}

/**
 * 等級配置
 */
export interface LevelConfig {
  maxLevel: number;
  levelTable: Array<{
    level: number;
    pointsRequired: number;
    totalPoints: number;
  }>;
  rewards: Record<number, {
    type: string;
    name: string;
    color: string;
  }>;
}

/**
 * 用戶等級列表項目
 */
export interface UserLevelItem {
  characterId: string;
  characterName?: string;
  level: number;
  totalPoints: number;
  progress: number;
  updatedAt?: string;
}

/**
 * 週期類型
 */
export type RankingPeriod = 'daily' | 'weekly' | 'monthly' | 'total';

/**
 * 排行榜項目
 */
export interface RankingItem {
  rank: number;
  userId: string;
  displayName?: string;
  level: number;
  totalPoints: number;
  periodPoints?: number;
  displayPoints?: number;
}

/**
 * 用戶排名資訊
 */
export interface UserRank {
  rank: number | null;
  totalUsers?: number;
  totalParticipants?: number;
  percentile?: number;
  level: number;
  totalPoints: number;
  periodPoints?: number;
  period?: RankingPeriod;
  message?: string;
}

// ==================== Composable 主函數 ====================

// 全局狀態緩存
const levelConfig = ref<LevelConfig | null>(null);
const characterLevels = ref<Map<string, LevelProgress>>(new Map());
const isLoadingConfig = ref(false);
const isLoading = ref(false);
const error = ref<string | null>(null);

export function useLevel() {
  // ==================== 獲取配置 ====================

  /**
   * 獲取等級系統配置
   */
  const fetchConfig = async (): Promise<LevelConfig | null> => {
    if (levelConfig.value) {
      return levelConfig.value;
    }

    isLoadingConfig.value = true;
    error.value = null;

    try {
      const result = await apiJson('/api/levels/config', {
        method: 'GET',
        skipGlobalLoading: true,
      });

      levelConfig.value = result?.data || result;
      return levelConfig.value;
    } catch (err: any) {
      error.value = err?.message || '獲取等級配置失敗';
      logger.error('[useLevel] 獲取配置失敗:', err);
      return null;
    } finally {
      isLoadingConfig.value = false;
    }
  };

  // ==================== 角色等級操作 ====================

  /**
   * 獲取用戶對特定角色的等級
   */
  const fetchCharacterLevel = async (characterId: string): Promise<LevelProgress | null> => {
    if (!characterId) {
      error.value = '需要提供角色 ID';
      return null;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const result = await apiJson(`/api/levels/character/${encodeURIComponent(characterId)}`, {
        method: 'GET',
        skipGlobalLoading: true,
      });

      // 緩存結果
      const levelData = result?.data || result;
      characterLevels.value.set(characterId, levelData);
      return levelData;
    } catch (err: any) {
      error.value = err?.message || '獲取角色等級失敗';
      logger.error('[useLevel] 獲取角色等級失敗:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 從緩存獲取角色等級
   */
  const getCharacterLevel = (characterId: string): LevelProgress | null => {
    return characterLevels.value.get(characterId) || null;
  };

  /**
   * 更新本地緩存的等級（當收到 levelProgress 時）
   */
  const updateLocalLevel = (characterId: string, levelProgress: LevelProgress): void => {
    characterLevels.value.set(characterId, levelProgress);
  };

  // ==================== 等級列表 ====================

  /**
   * 獲取用戶所有角色的等級列表
   */
  const fetchMyLevels = async (options?: {
    limit?: number;
    orderBy?: 'totalPoints' | 'level' | 'updatedAt';
    order?: 'asc' | 'desc';
  }): Promise<UserLevelItem[]> => {
    isLoading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.orderBy) params.set('orderBy', options.orderBy);
      if (options?.order) params.set('order', options.order);

      const queryString = params.toString();
      const url = `/api/levels/my-levels${queryString ? '?' + queryString : ''}`;

      const result = await apiJson(url, {
        method: 'GET',
        skipGlobalLoading: true,
      });

      return result?.data?.list || result?.data?.levels || [];
    } catch (err: any) {
      error.value = err?.message || '獲取等級列表失敗';
      logger.error('[useLevel] 獲取等級列表失敗:', err);
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  // ==================== 排行榜 ====================

  /**
   * 獲取角色的貢獻排行榜
   * @param characterId - 角色 ID
   * @param limit - 返回數量
   * @param period - 週期類型 (daily/weekly/monthly/total)
   */
  const fetchCharacterRanking = async (
    characterId: string,
    limit: number = 50,
    period: RankingPeriod = 'total'
  ): Promise<RankingItem[]> => {
    if (!characterId) {
      error.value = '需要提供角色 ID';
      return [];
    }

    isLoading.value = true;
    error.value = null;

    try {
      const url = `/api/levels/ranking/${encodeURIComponent(characterId)}?limit=${limit}&period=${period}`;
      const result = await apiJson(url, {
        method: 'GET',
        skipGlobalLoading: true,
      });

      return result?.data?.ranking || [];
    } catch (err: any) {
      error.value = err?.message || '獲取排行榜失敗';
      logger.error('[useLevel] 獲取排行榜失敗:', err);
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 獲取用戶在角色排行榜中的排名
   * @param characterId - 角色 ID
   * @param period - 週期類型 (daily/weekly/monthly/total)
   */
  const fetchMyRank = async (
    characterId: string,
    period: RankingPeriod = 'total'
  ): Promise<UserRank | null> => {
    if (!characterId) {
      error.value = '需要提供角色 ID';
      return null;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const url = `/api/levels/my-rank/${encodeURIComponent(characterId)}?period=${period}`;
      const result = await apiJson(url, {
        method: 'GET',
        skipGlobalLoading: true,
      });

      return result?.data || null;
    } catch (err: any) {
      error.value = err?.message || '獲取排名失敗';
      logger.error('[useLevel] 獲取排名失敗:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  // ==================== 每日獎勵 ====================

  /**
   * 領取每日首次對話獎勵
   */
  const claimDailyBonus = async (characterId: string): Promise<{
    alreadyClaimed: boolean;
    levelProgress?: LevelProgress;
    message?: string;
  }> => {
    if (!characterId) {
      error.value = '需要提供角色 ID';
      return { alreadyClaimed: true, message: '需要提供角色 ID' };
    }

    isLoading.value = true;
    error.value = null;

    try {
      const url = `/api/levels/daily-bonus/${encodeURIComponent(characterId)}`;
      const response = await apiJson(url, {
        method: 'POST',
        skipGlobalLoading: true,
      });

      const result = response?.data || response;

      // 如果成功領取，更新本地緩存
      if (!result.alreadyClaimed && result.level !== undefined) {
        updateLocalLevel(characterId, {
          level: result.level,
          currentPoints: result.currentPoints,
          pointsToNextLevel: result.pointsToNextLevel,
          progress: result.progress,
          totalPoints: result.totalPoints,
          pointsAdded: result.pointsAdded,
        });
      }

      return result;
    } catch (err: any) {
      error.value = err?.message || '領取每日獎勵失敗';
      logger.error('[useLevel] 領取每日獎勵失敗:', err);
      return { alreadyClaimed: true, message: err?.message };
    } finally {
      isLoading.value = false;
    }
  };

  // ==================== 工具函數 ====================

  /**
   * 計算等級（前端預覽）
   */
  const calculateLevel = async (points: number): Promise<LevelProgress | null> => {
    try {
      const url = `/api/levels/calculate?points=${points}`;
      const result = await apiJson(url, {
        method: 'GET',
        skipGlobalLoading: true,
      });
      return result?.data || result;
    } catch (err: any) {
      logger.error('[useLevel] 計算等級失敗:', err);
      return null;
    }
  };

  /**
   * 獲取等級徽章資訊
   */
  const getLevelBadge = (level: number): { name: string; color: string } | null => {
    if (!levelConfig.value?.rewards) return null;

    const rewards = levelConfig.value.rewards;
    const milestones = Object.keys(rewards)
      .map(Number)
      .sort((a, b) => b - a);

    for (const milestone of milestones) {
      if (level >= milestone) {
        return rewards[milestone];
      }
    }
    return null;
  };

  /**
   * 清除緩存
   */
  const clearCache = (characterId?: string): void => {
    if (characterId) {
      characterLevels.value.delete(characterId);
    } else {
      characterLevels.value.clear();
    }
  };

  return {
    // State
    levelConfig,
    characterLevels,
    isLoading,
    isLoadingConfig,
    error,

    // Actions
    fetchConfig,
    fetchCharacterLevel,
    getCharacterLevel,
    updateLocalLevel,
    fetchMyLevels,
    fetchCharacterRanking,
    fetchMyRank,
    claimDailyBonus,
    calculateLevel,
    getLevelBadge,
    clearCache,
  };
}

// ==================== 導出單例 ====================
export default useLevel;
