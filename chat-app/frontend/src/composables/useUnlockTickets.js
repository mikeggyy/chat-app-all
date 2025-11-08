import { ref, computed } from 'vue';
import { apiJson } from '../utils/api.js';

// 解鎖卡狀態的全域管理
const ticketsState = ref({
  characterUnlockTickets: 0,
  photoUnlockCards: 0,
  videoUnlockCards: 0,
  usageHistory: [],
});

const isLoading = ref(false);
const error = ref(null);

/**
 * 解鎖卡系統 composable
 * 管理用戶的角色解鎖券、拍照卡、視訊卡等
 */
export function useUnlockTickets() {
  /**
   * 載入解鎖卡餘額
   * @param {string} userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param {object} options - 選項
   */
  const loadBalance = async (userId, options = {}) => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/unlock-tickets/balance', {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      ticketsState.value = {
        characterUnlockTickets: data.characterUnlockTickets || 0,
        photoUnlockCards: data.photoUnlockCards || 0,
        videoUnlockCards: data.videoUnlockCards || 0,
        usageHistory: data.usageHistory || [],
      };

      return data;
    } catch (err) {
      error.value = err?.message || '載入解鎖卡餘額失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 使用角色解鎖券
   * @param {string} userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param {string} characterId - 角色 ID
   * @param {object} options - 選項
   */
  const useCharacterTicket = async (userId, characterId, options = {}) => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    if (!characterId) {
      error.value = '需要提供角色 ID';
      throw new Error('需要提供角色 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/unlock-tickets/use/character', {
        method: 'POST',
        body: {
          characterId,
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 更新本地餘額
      if (data.remainingTickets !== undefined) {
        ticketsState.value.characterUnlockTickets = data.remainingTickets;
      }

      return data;
    } catch (err) {
      error.value = err?.message || '使用角色解鎖券失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 使用拍照卡
   * @param {string} userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param {string} characterId - 角色 ID
   * @param {object} options - 選項
   */
  const usePhotoCard = async (userId, characterId, options = {}) => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    if (!characterId) {
      error.value = '需要提供角色 ID';
      throw new Error('需要提供角色 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/unlock-tickets/use/photo', {
        method: 'POST',
        body: {
          characterId,
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 更新本地餘額
      if (data.remainingCards !== undefined) {
        ticketsState.value.photoUnlockCards = data.remainingCards;
      }

      return data;
    } catch (err) {
      error.value = err?.message || '使用拍照卡失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 使用視訊卡
   * @param {string} userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param {string} characterId - 角色 ID
   * @param {object} options - 選項
   */
  const useVideoCard = async (userId, characterId, options = {}) => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    if (!characterId) {
      error.value = '需要提供角色 ID';
      throw new Error('需要提供角色 ID');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/unlock-tickets/use/video', {
        method: 'POST',
        body: {
          characterId,
        },
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      // 更新本地餘額
      if (data.remainingCards !== undefined) {
        ticketsState.value.videoUnlockCards = data.remainingCards;
      }

      return data;
    } catch (err) {
      error.value = err?.message || '使用視訊卡失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 檢查是否有特定類型的解鎖卡
   * @param {string} userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param {string} ticketType - 解鎖卡類型 ('character' | 'photo' | 'video')
   * @param {object} options - 選項
   */
  const checkTicketAvailability = async (userId, ticketType, options = {}) => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    if (!ticketType) {
      error.value = '需要提供解鎖卡類型';
      return false;
    }

    try {
      const data = await apiJson(
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
   * @param {string} userId - 用戶 ID（已廢棄，現在從認證 token 自動獲取）
   * @param {object} options - 選項
   */
  const loadHistory = async (userId, options = {}) => {
    // userId 參數已廢棄，保留是為了向後兼容
    // 後端現在從認證 token 自動獲取 userId

    isLoading.value = true;
    error.value = null;

    try {
      const data = await apiJson('/api/unlock-tickets/history', {
        skipGlobalLoading: options.skipGlobalLoading ?? false,
      });

      ticketsState.value.usageHistory = data.history || [];
      return data;
    } catch (err) {
      error.value = err?.message || '載入使用記錄失敗';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  // Computed properties
  const characterTickets = computed(() => ticketsState.value.characterUnlockTickets);
  const photoCards = computed(() => ticketsState.value.photoUnlockCards);
  const videoCards = computed(() => ticketsState.value.videoUnlockCards);
  const usageHistory = computed(() => ticketsState.value.usageHistory);

  // 是否有角色解鎖券
  const hasCharacterTickets = computed(() => characterTickets.value > 0);

  // 是否有拍照卡
  const hasPhotoCards = computed(() => photoCards.value > 0);

  // 是否有視訊卡
  const hasVideoCards = computed(() => videoCards.value > 0);

  // 總解鎖卡數量
  const totalTickets = computed(() => {
    return characterTickets.value + photoCards.value + videoCards.value;
  });

  // 格式化解鎖卡數量
  const formattedTickets = computed(() => {
    return {
      character: new Intl.NumberFormat('zh-TW').format(characterTickets.value),
      photo: new Intl.NumberFormat('zh-TW').format(photoCards.value),
      video: new Intl.NumberFormat('zh-TW').format(videoCards.value),
      total: new Intl.NumberFormat('zh-TW').format(totalTickets.value),
    };
  });

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
    usageHistory,
    hasCharacterTickets,
    hasPhotoCards,
    hasVideoCards,
    totalTickets,
    formattedTickets,
  };
}
