/**
 * useSettings Composable (TypeScript)
 *
 * 負責設定選單和登出邏輯的狀態管理
 */

import { ref, watchEffect, nextTick, Ref } from 'vue';
import { logger } from '@/utils/logger.js';

/**
 * 設定選單選項鍵值的聯合類型
 */
type SettingsOptionKey = 'logout' | string;

/**
 * useSettings Composable 的配置選項介面
 */
interface UseSettingsOptions {
  /**
   * 登出回調函數
   */
  onLogout: () => Promise<void>;
}

/**
 * useSettings Composable 的返回值介面
 */
interface UseSettingsReturn {
  // 狀態
  isMenuOpen: Ref<boolean>;
  isLogoutConfirmVisible: Ref<boolean>;
  isLoggingOut: Ref<boolean>;
  error: Ref<string>;

  // DOM 元素引用
  menuButtonRef: Ref<HTMLElement | null>;
  menuRef: Ref<HTMLElement | null>;
  logoutCancelButtonRef: Ref<HTMLElement | null>;

  // 方法
  bindMenuButton: (el: HTMLElement | null) => void;
  bindMenu: (el: HTMLElement | null) => void;
  bindLogoutCancelButton: (el: HTMLElement | null) => void;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: (event?: Event) => void;
  requestLogout: () => void;
  cancelLogoutConfirm: () => void;
  confirmLogout: () => Promise<void>;
  handleOptionSelect: (key: SettingsOptionKey) => void;
}

/**
 * 設定選單 Composable
 * @param {UseSettingsOptions} options - 配置選項
 * @param {Function} options.onLogout - 登出回調函數
 * @returns {UseSettingsReturn} 設定選單狀態和方法
 */
export function useSettings({ onLogout }: UseSettingsOptions): UseSettingsReturn {
  // ==================== 狀態管理 ====================

  const isMenuOpen: Ref<boolean> = ref(false);
  const isLogoutConfirmVisible: Ref<boolean> = ref(false);
  const isLoggingOut: Ref<boolean> = ref(false);
  const error: Ref<string> = ref('');

  const menuButtonRef: Ref<HTMLElement | null> = ref(null);
  const menuRef: Ref<HTMLElement | null> = ref(null);
  const logoutCancelButtonRef: Ref<HTMLElement | null> = ref(null);

  // ==================== 方法 ====================

  /**
   * 綁定選單按鈕 ref
   * @param {HTMLElement | null} el - 元素
   */
  const bindMenuButton = (el: HTMLElement | null): void => {
    menuButtonRef.value = el ?? null;
  };

  /**
   * 綁定選單 ref
   * @param {HTMLElement | null} el - 元素
   */
  const bindMenu = (el: HTMLElement | null): void => {
    menuRef.value = el ?? null;
  };

  /**
   * 綁定登出取消按鈕 ref
   * @param {HTMLElement | null} el - 元素
   */
  const bindLogoutCancelButton = (el: HTMLElement | null): void => {
    logoutCancelButtonRef.value = el ?? null;
  };

  /**
   * 打開設定選單
   */
  const openMenu = (): void => {
    error.value = '';
    isMenuOpen.value = true;
  };

  /**
   * 關閉設定選單
   */
  const closeMenu = (): void => {
    isMenuOpen.value = false;
    menuRef.value = null;
  };

  /**
   * 切換設定選單
   * @param {Event | undefined} event - 事件對象
   */
  const toggleMenu = (event?: Event): void => {
    event?.stopPropagation();
    error.value = '';
    isMenuOpen.value = !isMenuOpen.value;
    if (!isMenuOpen.value) {
      menuRef.value = null;
    }
  };

  /**
   * 處理文檔點擊（關閉選單）
   * @param {Event} event - 事件對象
   */
  const handleDocumentClick = (event: Event): void => {
    if (!isMenuOpen.value) return;
    const menuEl = menuRef.value;
    const buttonEl = menuButtonRef.value;
    const target = event.target as Node;
    if (
      menuEl &&
      !menuEl.contains(target) &&
      buttonEl &&
      !buttonEl.contains(target)
    ) {
      closeMenu();
    }
  };

  /**
   * 請求登出
   */
  const requestLogout = (): void => {
    if (isLoggingOut.value) return;
    error.value = '';
    isLogoutConfirmVisible.value = true;
    closeMenu();
  };

  /**
   * 取消登出確認
   */
  const cancelLogoutConfirm = (): void => {
    if (isLoggingOut.value) return;
    error.value = '';
    isLogoutConfirmVisible.value = false;
  };

  /**
   * 確認登出
   */
  const confirmLogout = async (): Promise<void> => {
    if (isLoggingOut.value) return;
    error.value = '';
    isLoggingOut.value = true;

    try {
      await onLogout();
      isLogoutConfirmVisible.value = false;
      closeMenu();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '登出失敗，請稍後再試。';
      error.value = message;
      if (import.meta.env.DEV) {
        logger.error('[useSettings] 登出失敗:', err);
      }
    } finally {
      isLoggingOut.value = false;
    }
  };

  /**
   * 處理設定選項選擇
   * @param {SettingsOptionKey} key - 選項鍵
   */
  const handleOptionSelect = (key: SettingsOptionKey): void => {
    error.value = '';
    switch (key) {
      case 'logout':
        requestLogout();
        return;
      default:
        closeMenu();
        if (import.meta.env.DEV) {
          logger.warn('[useSettings] 未知選項:', key);
        }
        return;
    }
  };

  // ==================== 生命週期 ====================

  // 監聽選單打開狀態，設置文檔點擊監聽器
  watchEffect((onCleanup) => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!isMenuOpen.value) {
      error.value = '';
      return;
    }

    const doc = window.document;
    doc.addEventListener('click', handleDocumentClick);

    // ✅ 2025-12-01 修復：移除空 catch 塊，nextTick 在 Vue 3 中不會拋出錯誤
    nextTick(() => {
      const firstMenuItem = menuRef.value?.querySelector(
        'button.settings-menu__item'
      ) as HTMLButtonElement | null | undefined;
      firstMenuItem?.focus();
    });

    onCleanup(() => {
      doc.removeEventListener('click', handleDocumentClick);
    });
  });

  // 監聯登出確認框打開狀態，設置焦點
  // ✅ 2025-12-01 修復：移除空 catch 塊
  watchEffect(() => {
    if (!isLogoutConfirmVisible.value) {
      return;
    }
    nextTick(() => {
      logoutCancelButtonRef.value?.focus();
    });
  });

  // ==================== 返回 ====================

  return {
    // 狀態
    isMenuOpen,
    isLogoutConfirmVisible,
    isLoggingOut,
    error,

    // Refs
    menuButtonRef,
    menuRef,
    logoutCancelButtonRef,

    // 方法
    bindMenuButton,
    bindMenu,
    bindLogoutCancelButton,
    openMenu,
    closeMenu,
    toggleMenu,
    requestLogout,
    cancelLogoutConfirm,
    confirmLogout,
    handleOptionSelect,
  };
}
