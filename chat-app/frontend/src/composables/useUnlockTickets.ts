// @ts-nocheck
import { ref, computed, Ref, ComputedRef } from 'vue';
import { apiJson } from '../utils/api.js';
import {
  generateUnlockCharacterRequestId,
  generateUnlockPhotoRequestId,
  generateUnlockVideoRequestId,
} from '../utils/requestId.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * 解鎖卡狀態接口
 */
interface UnlockTicketsState {
  characterUnlockCards: number;
  photoUnlockCards: number;
  videoUnlockCards: number;
  voiceUnlockCards: number;
  createCards: number; // 角色創建卡
  usageHistory: UsageHistoryItem[];
}

/**
 * 使用歷史項目接口
 */
interface UsageHistoryItem {
  id?: string;
  type: string;
  timestamp?: string;
  characterId?: string;
  [key: string]: any;
}

/**
 * API 響應基礎接口
 */
interface ApiResponse {
  [key: string]: any;
}

/**
 * 載入餘額響應接口
 */
interface BalanceResponse extends ApiResponse {
  characterUnlockCards?: number;
  photoUnlockCards?: number;
  videoUnlockCards?: number;
  voiceUnlockCards?: number;
  createCards?: number;
  usageHistory?: UsageHistoryItem[];
}

/**
 * 角色卡使用響應接口
 */
interface UseCharacterTicketResponse extends ApiResponse {
  remainingTickets?: number;
}

/**
 * 照片卡使用響應接口
 */
interface UseCardResponse extends ApiResponse {
  remainingCards?: number;
}

/**
 * 票券可用性檢查響應接口
 */
interface TicketAvailabilityResponse extends ApiResponse {
  available?: boolean;
}

/**
 * 歷史記錄響應接口
 */
interface HistoryResponse extends ApiResponse {
  history?: UsageHistoryItem[];
}

/**
 * 格式化票券接口
 */
interface FormattedTickets {
  character: string;
  photo: string;
  video: string;
  voice: string;
  create: string;
  total: string;
}

/**
 * 自定義選項接口
 */
interface LoadOptions {
  skipGlobalLoading?: boolean;
}

/**
 * useUnlockTickets 返回值接口
 */
interface UseUnlockTicketsReturn {
  // State
  tickets: Ref<UnlockTicketsState>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;

  // Actions
  loadBalance: (userId: string, options?: LoadOptions) => Promise<BalanceResponse>;
  useCharacterTicket: (userId: string, characterId: string, options?: LoadOptions) => Promise<UseCharacterTicketResponse>;
  usePhotoCard: (userId: string, characterId: string, options?: LoadOptions) => Promise<UseCardResponse>;
  useVideoCard: (userId: string, characterId: string, options?: LoadOptions) => Promise<UseCardResponse>;
  checkTicketAvailability: (userId: string, ticketType: string, options?: LoadOptions) => Promise<boolean>;
  loadHistory: (userId: string, options?: LoadOptions) => Promise<HistoryResponse>;

  // Computed
  characterTickets: ComputedRef<number>;
  photoCards: ComputedRef<number>;
  videoCards: ComputedRef<number>;
  voiceCards: ComputedRef<number>;
  createCards: ComputedRef<number>;
  usageHistory: ComputedRef<UsageHistoryItem[]>;
  hasCharacterTickets: ComputedRef<boolean>;
  hasPhotoCards: ComputedRef<boolean>;
  hasVideoCards: ComputedRef<boolean>;
  hasVoiceCards: ComputedRef<boolean>;
  hasCreateCards: ComputedRef<boolean>;
  totalTickets: ComputedRef<number>;
  formattedTickets: ComputedRef<FormattedTickets>;
}

// ============================================================================
// Global State
// ============================================================================

// 解鎖卡狀態的全域管理（統一使用 Cards 命名，與共享配置一致）
const ticketsState: Ref<UnlockTicketsState> = ref({
  characterUnlockCards: 0,
  photoUnlockCards: 0,
  videoUnlockCards: 0,
  voiceUnlockCards: 0,
  createCards: 0, // 角色創建卡
  usageHistory: [],
});

const isLoading: Ref<boolean> = ref(false);
const error: Ref<string | null> = ref(null);

// ============================================================================
// Composable
// ============================================================================

/**
 * 解鎖卡系統 composable
 * 管理用戶的角色解鎖券、拍照卡、視訊卡等
 */
export function useUnlockTickets(): UseUnlockTicketsReturn {
  /**
   * 載入解鎖卡餘額
   * @param userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param options - 選項
   */
  const loadBalance = async (userId: string, options: LoadOptions = {}): Promise<BalanceResponse> => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    isLoading.value = true;
    error.value = null;

    try {
      const data: BalanceResponse = await apiJson('/api/unlock-tickets/balances', {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      ticketsState.value = {
        characterUnlockCards: data.characterUnlockCards || 0,
        photoUnlockCards: data.photoUnlockCards || 0,
        videoUnlockCards: data.videoUnlockCards || 0,
        voiceUnlockCards: data.voiceUnlockCards || 0,
        createCards: data.createCards || 0,
        usageHistory: data.usageHistory || [],
      };

      return data;
    } catch (err) {
      const errorMessage = (err as any)?.message || '載入解鎖卡餘額失敗';
      error.value = errorMessage;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 使用角色解鎖券
   * @param userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param characterId - 角色 ID
   * @param options - 選項
   */
  const useCharacterTicket = async (
    userId: string,
    characterId: string,
    options: LoadOptions = {}
  ): Promise<UseCharacterTicketResponse> => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    if (!characterId) {
      error.value = '需要提供角色 ID';
      throw new Error('需要提供角色 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      // 生成唯一請求ID（用於冪等性保護）
      const requestId: string = generateUnlockCharacterRequestId(userId || 'user', characterId);

      const data: UseCharacterTicketResponse = await apiJson('/api/unlock-tickets/use/character', {
        method: 'POST',
        body: {
          characterId,
          requestId,
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 更新本地餘額
      if (data.remainingTickets !== undefined) {
        ticketsState.value.characterUnlockCards = data.remainingTickets;
      }

      return data;
    } catch (err) {
      const errorMessage = (err as any)?.message || '使用角色解鎖券失敗';
      error.value = errorMessage;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 使用拍照卡
   * @param userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param characterId - 角色 ID（已廢棄，拍照卡不綁定角色）
   * @param options - 選項
   */
  const usePhotoCard = async (
    userId: string,
    characterId: string,
    options: LoadOptions = {}
  ): Promise<UseCardResponse> => {
    // userId 和 characterId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId
    // 拍照卡是全局的，不綁定特定角色

    isLoading.value = true;
    error.value = null;

    try {
      // 生成唯一請求ID（用於冪等性保護）
      const requestId: string = generateUnlockPhotoRequestId(userId || 'user');

      const data: UseCardResponse = await apiJson('/api/unlock-tickets/use/photo', {
        method: 'POST',
        body: {
          requestId,
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 更新本地餘額
      if (data.remainingCards !== undefined) {
        ticketsState.value.photoUnlockCards = data.remainingCards;
      }

      return data;
    } catch (err) {
      const errorMessage = (err as any)?.message || '使用拍照卡失敗';
      error.value = errorMessage;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 使用視訊卡
   * @param userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param characterId - 角色 ID（已廢棄，影片卡不綁定角色）
   * @param options - 選項
   */
  const useVideoCard = async (
    userId: string,
    characterId: string,
    options: LoadOptions = {}
  ): Promise<UseCardResponse> => {
    // userId 和 characterId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId
    // 影片卡是全局的，不綁定特定角色

    isLoading.value = true;
    error.value = null;

    try {
      // 生成唯一請求ID（用於冪等性保護）
      const requestId: string = generateUnlockVideoRequestId(userId || 'user');

      const data: UseCardResponse = await apiJson('/api/unlock-tickets/use/video', {
        method: 'POST',
        body: {
          requestId,
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 更新本地餘額
      if (data.remainingCards !== undefined) {
        ticketsState.value.videoUnlockCards = data.remainingCards;
      }

      return data;
    } catch (err) {
      const errorMessage = (err as any)?.message || '使用視訊卡失敗';
      error.value = errorMessage;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 檢查是否有特定類型的解鎖卡
   * @param userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param ticketType - 解鎖卡類型 ('character' | 'photo' | 'video')
   * @param options - 選項
   */
  const checkTicketAvailability = async (
    userId: string,
    ticketType: string,
    options: LoadOptions = {}
  ): Promise<boolean> => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    if (!ticketType) {
      error.value = '需要提供解鎖卡類型';
      return false;
    }

    try {
      const data: TicketAvailabilityResponse = await apiJson(
        `/api/unlock-tickets/check/${encodeURIComponent(ticketType)}`,
        {
          skipGlobalLoading: options.skipGlobalLoading ?? true,
        }
      );

      return data.available || false;
    } catch (err) {
      return false;
    }
  };

  /**
   * 載入使用記錄
   * @param userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param options - 選項
   */
  const loadHistory = async (userId: string, options: LoadOptions = {}): Promise<HistoryResponse> => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    isLoading.value = true;
    error.value = null;

    try {
      const data: HistoryResponse = await apiJson('/api/unlock-tickets/history', {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      ticketsState.value.usageHistory = data.history || [];
      return data;
    } catch (err) {
      const errorMessage = (err as any)?.message || '載入使用記錄失敗';
      error.value = errorMessage;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // ============================================================================
  // Computed Properties
  // ============================================================================

  const characterTickets: ComputedRef<number> = computed(() => ticketsState.value.characterUnlockCards);
  const photoCards: ComputedRef<number> = computed(() => ticketsState.value.photoUnlockCards);
  const videoCards: ComputedRef<number> = computed(() => ticketsState.value.videoUnlockCards);
  const voiceCards: ComputedRef<number> = computed(() => ticketsState.value.voiceUnlockCards);
  const createCards: ComputedRef<number> = computed(() => ticketsState.value.createCards);
  const usageHistory: ComputedRef<UsageHistoryItem[]> = computed(() => ticketsState.value.usageHistory);

  // 是否有角色解鎖券
  const hasCharacterTickets: ComputedRef<boolean> = computed(() => characterTickets.value > 0);

  // 是否有拍照卡
  const hasPhotoCards: ComputedRef<boolean> = computed(() => photoCards.value > 0);

  // 是否有視訊卡
  const hasVideoCards: ComputedRef<boolean> = computed(() => videoCards.value > 0);

  // 是否有語音卡
  const hasVoiceCards: ComputedRef<boolean> = computed(() => voiceCards.value > 0);

  // 是否有創建卡
  const hasCreateCards: ComputedRef<boolean> = computed(() => createCards.value > 0);

  // 總解鎖卡數量
  const totalTickets: ComputedRef<number> = computed(() => {
    return characterTickets.value + photoCards.value + videoCards.value + voiceCards.value + createCards.value;
  });

  // 格式化解鎖卡數量
  const formattedTickets: ComputedRef<FormattedTickets> = computed(() => {
    return {
      character: new Intl.NumberFormat('zh-TW').format(characterTickets.value),
      photo: new Intl.NumberFormat('zh-TW').format(photoCards.value),
      video: new Intl.NumberFormat('zh-TW').format(videoCards.value),
      voice: new Intl.NumberFormat('zh-TW').format(voiceCards.value),
      create: new Intl.NumberFormat('zh-TW').format(createCards.value),
      total: new Intl.NumberFormat('zh-TW').format(totalTickets.value),
    };
  });

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    tickets: ticketsState,
    isLoading,
    error,

    // Actions
    loadBalance,
    useCharacterTicket,
    usePhotoCard,
    useVideoCard,
    checkTicketAvailability,
    loadHistory,

    // Computed
    characterTickets,
    photoCards,
    videoCards,
    voiceCards,
    createCards,
    usageHistory,
    hasCharacterTickets,
    hasPhotoCards,
    hasVideoCards,
    hasVoiceCards,
    hasCreateCards,
    totalTickets,
    formattedTickets,
  };
}
