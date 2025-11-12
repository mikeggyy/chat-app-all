/**
 * Chat Watchers Composable
 * 處理 ChatView 中的所有 watch 邏輯
 * 從 ChatView.vue 提取為獨立 composable
 */

import { watch } from 'vue';

/**
 * 設置 Chat 相關的 watchers
 * @param {Object} params - 參數對象
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
}) => {
  /**
   * Watch partnerId changes
   * 當切換角色時，清空舊角色的數據並加載新角色
   */
  watch(partnerId, (newId) => {
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
