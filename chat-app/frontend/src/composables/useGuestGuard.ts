/**
 * useGuestGuard.ts
 * 遊客守衛 Composable（TypeScript 版本）
 * 用於檢查用戶是否為遊客，並在需要時引導登入
 */

import { computed, type ComputedRef } from 'vue';
import { useRouter, type Router } from 'vue-router';
import { useUserProfile } from './useUserProfile.js';
import { useToast } from './useToast.js';

// ==================== 常量定義 ====================

const GUEST_MESSAGE_LIMIT = 2; // 遊客訊息限制
const GUEST_MESSAGE_COUNT_KEY = 'guestMessageCount';

// ==================== 類型定義 ====================

/**
 * requireLogin 選項
 */
export interface RequireLoginOptions {
  feature?: string;
  redirect?: boolean;
}

/**
 * useGuestGuard 返回類型
 */
export interface UseGuestGuardReturn {
  // Computed
  isGuest: ComputedRef<boolean>;
  guestRemainingMessages: ComputedRef<number | null>;

  // Methods
  requireLogin: (options?: RequireLoginOptions) => boolean;
  guardedAction: <T>(callback: () => Promise<T>, options?: RequireLoginOptions) => Promise<T | undefined>;
  canGuestSendMessage: () => boolean;
  incrementGuestMessageCount: () => void;
  resetGuestMessageCount: () => void;

  // Constants
  GUEST_MESSAGE_LIMIT: number;
}

// ==================== Composable 主函數 ====================

/**
 * 遊客守衛 composable
 * 用於檢查用戶是否為遊客，並在需要時引導登入
 */
export function useGuestGuard(): UseGuestGuardReturn {
  const router: Router = useRouter();
  const { user } = useUserProfile();
  const { warning } = useToast();

  // warning 保留用於未來可能的提示功能
  void warning; // 標記參數已被認知

  // ====================
  // Computed
  // ====================

  /**
   * 檢查是否為遊客
   */
  const isGuest = computed(() => {
    return user.value?.isGuest === true || user.value?.signInProvider === 'guest';
  });

  /**
   * 取得遊客剩餘訊息數量
   */
  const guestRemainingMessages = computed(() => {
    if (!isGuest.value) return null;
    const sent = getGuestMessageCount();
    return Math.max(0, GUEST_MESSAGE_LIMIT - sent);
  });

  // ====================
  // Methods
  // ====================

  /**
   * 取得遊客已發送的訊息數量
   */
  const getGuestMessageCount = (): number => {
    if (!isGuest.value) return 0;
    const count = localStorage.getItem(GUEST_MESSAGE_COUNT_KEY);
    const parsed = count ? parseInt(count, 10) : 0;
    return parsed;
  };

  /**
   * 增加遊客訊息計數
   */
  const incrementGuestMessageCount = (): void => {
    if (!isGuest.value) return;
    const currentCount = getGuestMessageCount();
    const newCount = currentCount + 1;
    localStorage.setItem(GUEST_MESSAGE_COUNT_KEY, String(newCount));
  };

  /**
   * 重置遊客訊息計數（當用戶登入後）
   */
  const resetGuestMessageCount = (): void => {
    localStorage.removeItem(GUEST_MESSAGE_COUNT_KEY);
  };

  /**
   * 檢查遊客是否還能發送訊息
   */
  const canGuestSendMessage = (): boolean => {
    if (!isGuest.value) {
      return true;
    }
    const count = getGuestMessageCount();
    const canSend = count < GUEST_MESSAGE_LIMIT;
    return canSend;
  };

  /**
   * 要求登入（遊客檢查）
   * @param options - 配置選項
   * @returns 如果是遊客返回 true（被攔截），否則返回 false（允許繼續）
   */
  const requireLogin = (options: RequireLoginOptions = {}): boolean => {
    const {
      feature = '此功能',
      redirect = true,
    } = options;

    if (!isGuest.value) {
      return false; // 不是遊客，允許繼續
    }

    // 導向遊客升級頁面
    if (redirect) {
      router.push({
        name: 'guest-upgrade',
        query: { feature }
      });
    }

    return true; // 是遊客，被攔截
  };

  /**
   * 檢查功能權限並執行操作
   * @param callback - 要執行的操作
   * @param options - requireLogin 的配置選項
   * @returns 如果允許則執行 callback，否則返回 undefined
   */
  const guardedAction = async <T>(
    callback: () => Promise<T>,
    options: RequireLoginOptions = {}
  ): Promise<T | undefined> => {
    if (requireLogin(options)) {
      return; // 被攔截，不執行
    }
    return await callback();
  };

  return {
    // Computed
    isGuest,
    guestRemainingMessages,

    // Methods
    requireLogin,
    guardedAction,
    canGuestSendMessage,
    incrementGuestMessageCount,
    resetGuestMessageCount,

    // Constants
    GUEST_MESSAGE_LIMIT,
  };
}
