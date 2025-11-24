/**
 * 角色解鎖管理 Composable
 *
 * 管理角色解鎖卡的使用和狀態，包括：
 * - 活躍解鎖效果查詢
 * - 解鎖卡使用邏輯
 * - 解鎖狀態管理
 */

import { ref, computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { apiJson } from '../../utils/api.js';
import { generateUnlockCharacterRequestId } from '../../utils/requestId.js';
import type { FirebaseAuthService } from '../../types';

// ==================== 類型定義 ====================

/**
 * 解鎖效果接口
 */
export interface UnlockEffect {
  unlockType: 'character' | 'content' | 'feature';
  characterId?: string;
  activatedAt?: string; // ✅ 2025-11-25 新增：生效時間（解鎖開始時間）
  expiresAt?: string;
  unlockDays?: number;
}

/**
 * 解鎖卡使用結果
 */
export interface UnlockResult {
  success: boolean;
  unlockDays?: number;
  message?: string;
  error?: string;
}

/**
 * 依賴項接口
 */
export interface UseCharacterUnlockDeps {
  /** 獲取當前用戶 ID */
  getCurrentUserId: () => string | null;
  /** 獲取角色 ID */
  getPartnerId: () => string | null;
  /** 獲取 Firebase Auth 實例 */
  getFirebaseAuth: () => FirebaseAuthService;
  /** 獲取角色顯示名稱 */
  getPartnerDisplayName: () => string;
  /** 關閉解鎖確認彈窗 */
  closeUnlockConfirm: () => void;
  /** 重新加載解鎖卡餘額 */
  loadTicketsBalance: (userId: string) => Promise<void>;
  /** 設置 loading 狀態 */
  setLoading: (key: string, value: boolean) => void;
  /** 顯示錯誤提示 */
  showError: (message: string) => void;
  /** 顯示成功提示 */
  showSuccess: (message: string) => void;
}

/**
 * 返回類型接口
 */
export interface UseCharacterUnlockReturn {
  // 狀態
  /** 活躍的解鎖效果列表 */
  activeUnlockEffects: Ref<UnlockEffect[]>;
  /** 控制是否允許顯示解鎖效果（避免初始閃爍） */
  isUnlockDataLoaded: Ref<boolean>;

  // Computed
  /** 當前角色的解鎖效果 */
  activeCharacterUnlock: ComputedRef<UnlockEffect | null>;
  /** 當前角色是否已解鎖 */
  isCharacterUnlocked: ComputedRef<boolean>;

  // 方法
  /** 加載活躍的解鎖效果 */
  loadActiveUnlocks: () => Promise<void>;
  /** 確認使用解鎖卡 */
  handleConfirmUnlockCharacter: () => Promise<void>;
  /** 重置解鎖數據加載狀態（用於切換角色時） */
  resetUnlockDataLoadedState: () => void;
}

// ==================== Composable 實現 ====================

/**
 * 創建角色解鎖管理 composable
 * @param deps - 依賴項
 * @returns 角色解鎖相關的狀態和方法
 */
export function useCharacterUnlock(deps: UseCharacterUnlockDeps): UseCharacterUnlockReturn {
  const {
    getCurrentUserId,
    getPartnerId,
    getFirebaseAuth,
    getPartnerDisplayName,
    closeUnlockConfirm,
    loadTicketsBalance,
    setLoading,
    showError,
    showSuccess,
  } = deps;

  // ==========================================
  // 狀態
  // ==========================================

  // 活躍的解鎖效果列表
  const activeUnlockEffects = ref<UnlockEffect[]>([]);

  // 控制是否允許顯示解鎖效果（避免初始閃爍）
  const isUnlockDataLoaded = ref<boolean>(false);

  // ==========================================
  // Computed Properties
  // ==========================================

  /**
   * 當前角色的解鎖效果
   */
  const activeCharacterUnlock = computed<UnlockEffect | null>(() => {
    // 只有在數據加載完成後才返回結果，避免閃爍
    if (!isUnlockDataLoaded.value) {
      return null;
    }

    const partnerId = getPartnerId();
    return activeUnlockEffects.value.find(
      (unlock) =>
        unlock.unlockType === 'character' && unlock.characterId === partnerId
    ) ?? null;
  });

  /**
   * 當前角色是否已解鎖
   */
  const isCharacterUnlocked = computed<boolean>(() => {
    // 在數據未加載時，預設視為"已解鎖"（從而隱藏解鎖按鈕，避免閃爍）
    if (!isUnlockDataLoaded.value) {
      return true;
    }
    return !!activeCharacterUnlock.value;
  });

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 加載活躍的解鎖效果
   * @returns {Promise<void>}
   * ✅ 已實現：後端 /api/unlock-tickets/active 端點已添加
   */
  const loadActiveUnlocks = async (): Promise<void> => {
    const userId = getCurrentUserId();
    if (!userId) {
      isUnlockDataLoaded.value = true;
      return;
    }

    // 先清空舊數據，避免閃爍
    activeUnlockEffects.value = [];

    try {
      // ✅ 啟用：後端已實現 /api/unlock-tickets/active 端點
      const response = await apiJson<any>(`/api/unlock-tickets/active`, {
        skipGlobalLoading: true,
      });

      // ✅ 2025-11-25 修復：後端使用 sendSuccess 包裝回應為 { success: true, data: { unlocks: [...] } }
      // 需要訪問 response.data 來獲取實際數據
      const data = response.data || response;

      if (data && data.unlocks) {
        activeUnlockEffects.value = data.unlocks;
      }
    } catch (error) {
      // Silent fail - 不影響用戶體驗
      console.warn('[解鎖狀態] 載入活躍解鎖失敗:', error);
    } finally {
      // 數據加載完成，允許顯示圖標
      isUnlockDataLoaded.value = true;
    }
  };

  /**
   * 確認使用解鎖卡
   * @returns {Promise<void>}
   */
  const handleConfirmUnlockCharacter = async (): Promise<void> => {
    const userId = getCurrentUserId();
    const matchId = getPartnerId();

    if (!userId || !matchId) return;

    setLoading('unlockConfirm', true);

    try {
      // 獲取認證權杖
      const firebaseAuth = getFirebaseAuth();
      const token = await firebaseAuth.getCurrentUserIdToken();

      // 生成唯一請求ID（用於冪等性保護）
      const requestId = generateUnlockCharacterRequestId(userId, matchId);

      // 調用後端 API 使用解鎖卡
      const response = await apiJson<any>('/api/unlock-tickets/use/character', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          characterId: matchId,
          requestId,
        },
        skipGlobalLoading: true,
      });

      // ✅ 2025-11-25 修復：後端使用 sendSuccess 包裝回應為 { success: true, data: { ... } }
      // 需要訪問 response.data 來獲取實際數據
      const result = response.data || response;

      if (result.success || response.success) {
        // 關閉模態框
        closeUnlockConfirm();

        // ✅ 2025-11-25 修復：直接使用 API 返回的數據更新狀態，避免時序問題
        // 不需要等待 Firestore 寫入完成再讀取
        const unlockDays = result.unlockDays || 7;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + unlockDays * 24 * 60 * 60 * 1000);

        // 立即更新 activeUnlockEffects，讓 UI 立即響應
        const newUnlock: UnlockEffect = {
          unlockType: 'character',
          characterId: matchId,
          activatedAt: now.toISOString(), // ✅ 生效時間（現在）
          expiresAt: result.expiresAt || expiresAt.toISOString(), // 優先使用後端返回的 expiresAt
          unlockDays: unlockDays,
        };

        // 添加到活躍解鎖列表（如果不存在）
        const existingIndex = activeUnlockEffects.value.findIndex(
          (u) => u.unlockType === 'character' && u.characterId === matchId
        );
        if (existingIndex === -1) {
          activeUnlockEffects.value.push(newUnlock);
        } else {
          activeUnlockEffects.value[existingIndex] = newUnlock;
        }

        // 確保數據加載完成標記為 true
        isUnlockDataLoaded.value = true;

        // 重新加載解鎖卡餘額（背景更新，不影響 UI）
        loadTicketsBalance(userId).catch(console.error);

        // 顯示解鎖成功訊息
        const characterName = getPartnerDisplayName() || '角色';
        showSuccess(`解鎖成功！與「${characterName}」可暢聊 ${unlockDays} 天 🎉`);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '使用解鎖卡失敗');
    } finally {
      setLoading('unlockConfirm', false);
    }
  };

  /**
   * 重置解鎖數據加載狀態（用於切換角色時）
   */
  const resetUnlockDataLoadedState = (): void => {
    isUnlockDataLoaded.value = false;
  };

  // ==========================================
  // 返回 API
  // ==========================================
  return {
    // 狀態
    activeUnlockEffects,
    isUnlockDataLoaded,

    // Computed
    activeCharacterUnlock,
    isCharacterUnlocked,

    // 方法
    loadActiveUnlocks,
    handleConfirmUnlockCharacter,
    resetUnlockDataLoadedState,
  };
}
