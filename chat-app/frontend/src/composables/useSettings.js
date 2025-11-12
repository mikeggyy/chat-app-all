/**
 * useSettings Composable
 *
 * 負責設定選單和登出邏輯的狀態管理
 */

import { ref, watchEffect, nextTick, onBeforeUnmount } from "vue";
import { logger } from "@/utils/logger";

/**
 * 設定選單 Composable
 * @param {Object} options - 配置選項
 * @param {Function} options.onLogout - 登出回調函數
 * @returns {Object} 設定選單狀態和方法
 */
export function useSettings({ onLogout }) {
  // ==================== 狀態管理 ====================

  const isMenuOpen = ref(false);
  const isLogoutConfirmVisible = ref(false);
  const isLoggingOut = ref(false);
  const error = ref("");

  const menuButtonRef = ref(null);
  const menuRef = ref(null);
  const logoutCancelButtonRef = ref(null);

  // ==================== 方法 ====================

  /**
   * 綁定選單按鈕 ref
   * @param {HTMLElement} el - 元素
   */
  const bindMenuButton = (el) => {
    menuButtonRef.value = el ?? null;
  };

  /**
   * 綁定選單 ref
   * @param {HTMLElement} el - 元素
   */
  const bindMenu = (el) => {
    menuRef.value = el ?? null;
  };

  /**
   * 綁定登出取消按鈕 ref
   * @param {HTMLElement} el - 元素
   */
  const bindLogoutCancelButton = (el) => {
    logoutCancelButtonRef.value = el ?? null;
  };

  /**
   * 打開設定選單
   */
  const openMenu = () => {
    error.value = "";
    isMenuOpen.value = true;
  };

  /**
   * 關閉設定選單
   */
  const closeMenu = () => {
    isMenuOpen.value = false;
    menuRef.value = null;
  };

  /**
   * 切換設定選單
   * @param {Event} event - 事件對象
   */
  const toggleMenu = (event) => {
    event?.stopPropagation();
    error.value = "";
    isMenuOpen.value = !isMenuOpen.value;
    if (!isMenuOpen.value) {
      menuRef.value = null;
    }
  };

  /**
   * 處理文檔點擊（關閉選單）
   * @param {Event} event - 事件對象
   */
  const handleDocumentClick = (event) => {
    if (!isMenuOpen.value) return;
    const menuEl = menuRef.value;
    const buttonEl = menuButtonRef.value;
    if (
      menuEl &&
      !menuEl.contains(event.target) &&
      buttonEl &&
      !buttonEl.contains(event.target)
    ) {
      closeMenu();
    }
  };

  /**
   * 請求登出
   */
  const requestLogout = () => {
    if (isLoggingOut.value) return;
    error.value = "";
    isLogoutConfirmVisible.value = true;
    closeMenu();
  };

  /**
   * 取消登出確認
   */
  const cancelLogoutConfirm = () => {
    if (isLoggingOut.value) return;
    error.value = "";
    isLogoutConfirmVisible.value = false;
  };

  /**
   * 確認登出
   */
  const confirmLogout = async () => {
    if (isLoggingOut.value) return;
    error.value = "";
    isLoggingOut.value = true;

    try {
      await onLogout();
      isLogoutConfirmVisible.value = false;
      closeMenu();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "登出失敗，請稍後再試。";
      error.value = message;
      if (import.meta.env.DEV) {
        logger.error("[useSettings] 登出失敗:", err);
      }
    } finally {
      isLoggingOut.value = false;
    }
  };

  /**
   * 處理設定選項選擇
   * @param {string} key - 選項鍵
   */
  const handleOptionSelect = (key) => {
    error.value = "";
    switch (key) {
      case "logout":
        requestLogout();
        return;
      default:
        closeMenu();
        if (import.meta.env.DEV) {
          logger.warn("[useSettings] 未知選項:", key);
        }
        return;
    }
  };

  // ==================== 生命週期 ====================

  // 監聽選單打開狀態，設置文檔點擊監聽器
  watchEffect((onCleanup) => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isMenuOpen.value) {
      error.value = "";
      return;
    }

    const doc = window.document;
    doc.addEventListener("click", handleDocumentClick);

    nextTick(() => {
      const firstMenuItem = menuRef.value?.querySelector(
        "button.settings-menu__item"
      );
      firstMenuItem?.focus();
    }).catch(() => {});

    onCleanup(() => {
      doc.removeEventListener("click", handleDocumentClick);
    });
  });

  // 監聽登出確認框打開狀態，設置焦點
  watchEffect(() => {
    if (!isLogoutConfirmVisible.value) {
      return;
    }
    nextTick(() => {
      logoutCancelButtonRef.value?.focus();
    }).catch(() => {});
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
