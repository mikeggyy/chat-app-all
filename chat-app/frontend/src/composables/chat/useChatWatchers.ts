/**
 * Chat Watchers Composable
 * 處理 ChatView 中的所有 watch 邏輯
 * 從 ChatView.vue 提取為獨立 composable
 */

import { watch } from 'vue';
import type { Ref, WatchStopHandle } from 'vue';
import type { Message } from '../../types/index.js';

/**
 * useChatWatchers 依賴項接口
 * 定義所有必需的參數和方法
 */
export interface UseChatWatchersDeps {
  // Refs and computed
  /** 當前聊天夥伴 ID */
  partnerId: Ref<string | null>;
  /** 消息列表 */
  messages: Ref<Message[]>;

  // Actions
  /** 重置解鎖數據加載狀態 */
  resetUnlockDataLoadedState: () => void;
  /** 加載夥伴資料 */
  loadPartner: (partnerId: string) => Promise<void> | void;
  /** 使建議失效 */
  invalidateSuggestions: () => void;

  // Other refs
  /** 活躍的藥水效果列表 */
  activePotionEffects: Ref<any[]>;
  /** 活躍的解鎖效果列表 */
  activeUnlockEffects: Ref<any[]>;
}

/**
 * useChatWatchers 返回類型接口
 * 目前此 composable 僅設置 watchers，不返回任何內容
 */
export interface UseChatWatchersReturn {
  // 此 composable 僅設置 watchers，無返回值
  // 若未來需要返回 watch stop handles，可在此添加
}

/**
 * 設置 Chat 相關的 watchers
 *
 * @param deps - 依賴項對象，包含所需的 refs 和方法
 * @returns void - 此 composable 僅設置 watchers，無返回值
 *
 * @example
 * ```ts
 * useChatWatchers({
 *   partnerId,
 *   messages,
 *   resetUnlockDataLoadedState,
 *   loadPartner,
 *   invalidateSuggestions,
 *   activePotionEffects,
 *   activeUnlockEffects,
 * });
 * ```
 */
export const useChatWatchers = ({
  // Refs and computed
  partnerId,
  messages,

  // Actions
  resetUnlockDataLoadedState,
  loadPartner,
  invalidateSuggestions,

  // Other refs
  activePotionEffects,
  activeUnlockEffects,
}: UseChatWatchersDeps): void => {
  /**
   * Watch partnerId changes
   * 當切換角色時，清空舊角色的數據並加載新角色
   */
  watch(partnerId, (newId: string | null) => {
    if (newId) {
      // 立即隱藏解鎖圖標，避免顯示閃爍
      resetUnlockDataLoadedState();

      // 清空舊角色的效果數據
      activePotionEffects.value = [];
      activeUnlockEffects.value = [];

      // 加載新角色
      loadPartner(newId);
    }
  }, {
    flush: 'sync', // 同步執行，確保在 computed 重新計算前就清空數據
  });

  /**
   * Watch message changes
   * 當消息數量變化時，使建議失效
   */
  watch(
    () => messages.value.length,
    () => {
      invalidateSuggestions();
    }
  );
};
