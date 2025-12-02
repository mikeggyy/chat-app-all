/**
 * 通知系統組合函數
 * 提供通知管理的功能，包括獲取、標記、添加通知等
 */

import { ref, computed, type Ref, type ComputedRef } from "vue";
import { apiJson } from "../utils/api";
import { logger } from "../utils/logger";

// ============================================
// Type Definitions
// ============================================

/**
 * 通知操作按鈕
 */
interface NotificationAction {
  label: string;
  type: "primary" | "secondary";
}

/**
 * 通知對象
 */
interface Notification {
  id: string;
  title: string;
  message: string;
  fullContent?: string;
  timestamp?: string;
  createdAt?: string;
  category?: string;
  type?: string;
  isRead: boolean;
  actions?: NotificationAction[];
  isSystemNotification?: boolean;
  isUserNotification?: boolean;
}

/**
 * useNotifications 組合函數的返回類型
 */
interface UseNotificationsReturn {
  notifications: ComputedRef<Notification[]>;
  unreadCount: ComputedRef<number>;
  hasUnreadNotifications: ComputedRef<boolean>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  getNotificationById: (id: string) => Notification | undefined;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchUnreadCount: () => Promise<number>;
}

// ============================================
// Composable Implementation
// ============================================

// 全局狀態（跨組件共享）
const notificationsStore: Ref<Notification[]> = ref([]);
const unreadCountStore: Ref<number> = ref(0);
const isLoadingStore: Ref<boolean> = ref(false);
const errorStore: Ref<string | null> = ref(null);
const lastFetchTime: Ref<number> = ref(0);

// 緩存時間（5 分鐘）
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 通知系統組合函數
 * 提供通知管理的功能，包括獲取、標記、添加通知等
 *
 * @returns {UseNotificationsReturn} 通知系統的公開方法和狀態
 */
export function useNotifications(): UseNotificationsReturn {
  // 計算未讀通知數量
  const unreadCount: ComputedRef<number> = computed(() => {
    return unreadCountStore.value;
  });

  // 是否有未讀通知
  const hasUnreadNotifications: ComputedRef<boolean> = computed(() => {
    return unreadCount.value > 0;
  });

  // 獲取所有通知
  const notifications: ComputedRef<Notification[]> = computed(() => {
    return notificationsStore.value;
  });

  // 是否正在加載
  const isLoading: Ref<boolean> = computed(() => isLoadingStore.value) as Ref<boolean>;

  // 錯誤訊息
  const error: Ref<string | null> = computed(() => errorStore.value) as Ref<string | null>;

  /**
   * 從 API 獲取通知列表
   */
  const fetchNotifications = async (): Promise<void> => {
    // 檢查緩存是否有效
    const now = Date.now();
    if (now - lastFetchTime.value < CACHE_TTL && notificationsStore.value.length > 0) {
      return;
    }

    isLoadingStore.value = true;
    errorStore.value = null;

    try {
      const response = await apiJson("/api/notifications");
      const data = response.data || response;

      if (response.success && data) {
        // 轉換通知格式
        notificationsStore.value = (data.notifications || []).map((n: Notification) => ({
          ...n,
          // 確保時間戳格式一致
          timestamp: n.createdAt || n.timestamp,
        }));
        unreadCountStore.value = data.unreadCount || 0;
        lastFetchTime.value = now;
      } else {
        errorStore.value = response.error || data?.error || "獲取通知失敗";
      }
    } catch (err) {
      errorStore.value = (err as Error).message || "獲取通知失敗";
      logger.error("獲取通知失敗:", err);
    } finally {
      isLoadingStore.value = false;
    }
  };

  /**
   * 獲取未讀通知數量
   */
  const fetchUnreadCount = async (): Promise<number> => {
    try {
      const response = await apiJson("/api/notifications/unread-count");
      const data = response.data || response;

      if (response.success && data) {
        unreadCountStore.value = data.unreadCount || 0;
      }
      return unreadCountStore.value;
    } catch (err) {
      logger.error("獲取未讀數量失敗:", err);
      return unreadCountStore.value;
    }
  };

  /**
   * 根據 ID 獲取通知
   *
   * @param {string} id - 通知 ID
   * @returns {Notification | undefined} 找到的通知對象或 undefined
   */
  const getNotificationById = (id: string): Notification | undefined => {
    return notificationsStore.value.find((notification) => notification.id === id);
  };

  /**
   * 標記通知為已讀
   *
   * @param {string} id - 通知 ID
   */
  const markAsRead = async (id: string): Promise<void> => {
    try {
      const response = await apiJson(`/api/notifications/${id}/read`, {
        method: "POST",
      });

      if (response.success) {
        // 更新本地狀態
        const notification = notificationsStore.value.find((n) => n.id === id);
        if (notification && !notification.isRead) {
          notification.isRead = true;
          unreadCountStore.value = Math.max(0, unreadCountStore.value - 1);
        }
      }
    } catch (err) {
      logger.error("標記已讀失敗:", err);
    }
  };

  /**
   * 標記所有通知為已讀
   */
  const markAllAsRead = async (): Promise<void> => {
    try {
      const response = await apiJson("/api/notifications/read-all", {
        method: "POST",
      });

      if (response.success) {
        // 更新本地狀態
        notificationsStore.value.forEach((notification) => {
          notification.isRead = true;
        });
        unreadCountStore.value = 0;
      }
    } catch (err) {
      logger.error("標記全部已讀失敗:", err);
    }
  };

  return {
    notifications,
    unreadCount,
    hasUnreadNotifications,
    isLoading,
    error,
    getNotificationById,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    fetchUnreadCount,
  };
}
