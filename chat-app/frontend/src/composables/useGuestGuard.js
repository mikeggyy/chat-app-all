import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useUserProfile } from "./useUserProfile";
import { useToast } from "./useToast";

const GUEST_MESSAGE_LIMIT = 2; // 遊客訊息限制
const GUEST_MESSAGE_COUNT_KEY = "guestMessageCount";

/**
 * 遊客守衛 composable
 * 用於檢查用戶是否為遊客，並在需要時引導登入
 */
export function useGuestGuard() {
  const router = useRouter();
  const { user } = useUserProfile();
  const { warning } = useToast();

  // 檢查是否為遊客
  const isGuest = computed(() => {
    return user.value?.isGuest === true || user.value?.signInProvider === "guest";
  });

  // 取得遊客已發送的訊息數量
  const getGuestMessageCount = () => {
    if (!isGuest.value) return 0;
    const count = localStorage.getItem(GUEST_MESSAGE_COUNT_KEY);
    const parsed = count ? parseInt(count, 10) : 0;
    return parsed;
  };

  // 增加遊客訊息計數
  const incrementGuestMessageCount = () => {
    if (!isGuest.value) return;
    const currentCount = getGuestMessageCount();
    const newCount = currentCount + 1;
    localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, String(newCount));
  };

  // 重置遊客訊息計數（當用戶登入後）
  const resetGuestMessageCount = () => {
    localStorage.removeItem(GUEST_MESSAGE_COUNT_KEY);
  };

  // 檢查遊客是否還能發送訊息
  const canGuestSendMessage = () => {
    if (!isGuest.value) {
      return true;
    }
    const count = getGuestMessageCount();
    const canSend = count < GUEST_MESSAGE_LIMIT;
    return canSend;
  };

  // 取得遊客剩餘訊息數量
  const guestRemainingMessages = computed(() => {
    if (!isGuest.value) return null;
    const sent = getGuestMessageCount();
    return Math.max(0, GUEST_MESSAGE_LIMIT - sent);
  });

  /**
   * 要求登入（遊客檢查）
   * @param {Object} options - 配置選項
   * @param {string} options.feature - 功能名稱（用於頁面顯示）
   * @param {boolean} options.redirect - 是否自動導向升級頁面
   * @returns {boolean} - 如果是遊客返回 true（被攔截），否則返回 false（允許繼續）
   */
  const requireLogin = (options = {}) => {
    const {
      feature = "此功能",
      redirect = true,
    } = options;

    if (!isGuest.value) {
      return false; // 不是遊客，允許繼續
    }

    // 導向遊客升級頁面
    if (redirect) {
      router.push({
        name: "guest-upgrade",
        query: { feature }
      });
    }

    return true; // 是遊客，被攔截
  };

  /**
   * 檢查功能權限並執行操作
   * @param {Function} callback - 要執行的操作
   * @param {Object} options - requireLogin 的配置選項
   * @returns {Promise<any>} - 如果允許則執行 callback，否則返回 undefined
   */
  const guardedAction = async (callback, options = {}) => {
    if (requireLogin(options)) {
      return; // 被攔截，不執行
    }
    return await callback();
  };

  return {
    isGuest,
    requireLogin,
    guardedAction,
    canGuestSendMessage,
    incrementGuestMessageCount,
    resetGuestMessageCount,
    guestRemainingMessages,
    GUEST_MESSAGE_LIMIT,
  };
}
