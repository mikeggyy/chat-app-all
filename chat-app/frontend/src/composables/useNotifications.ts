import { ref, computed, Ref, ComputedRef } from 'vue';

// ============================================
// Type Definitions
// ============================================

/**
 * 通知操作按鈕
 */
interface NotificationAction {
  label: string;
  type: 'primary' | 'secondary';
}

/**
 * 通知對象
 */
interface Notification {
  id: number;
  title: string;
  message: string;
  fullContent: string;
  timestamp: string;
  category: string;
  isRead: boolean;
  actions: NotificationAction[];
}

/**
 * 添加通知時的參數（不包括自動生成的字段）
 */
type AddNotificationPayload = Omit<Notification, 'id' | 'isRead' | 'timestamp'>;

/**
 * useNotifications 組合函數的返回類型
 */
interface UseNotificationsReturn {
  notifications: ComputedRef<Notification[]>;
  unreadCount: ComputedRef<number>;
  hasUnreadNotifications: ComputedRef<boolean>;
  getNotificationById: (id: string | number) => Notification | undefined;
  markAsRead: (id: string | number) => void;
  markAllAsRead: () => void;
  addNotification: (notification: AddNotificationPayload) => void;
}

// ============================================
// Composable Implementation
// ============================================

// 模擬通知數據庫 - 之後可以從 API 獲取
const notificationsStore: Ref<Notification[]> = ref([
  {
    id: 1,
    title: '角色收到新收藏',
    message: '您的角色「我的駕駛是達令」已經收到 5 個新的收藏！恭喜您的創作受到其他用戶的喜愛。',
    fullContent: '您的角色「我的駕駛是達令」在過去 24 小時內收到了 5 個新的收藏！\n\n這是一個很好的成就，說明您創作的角色深受其他用戶喜愛。繼續保持創作熱情，創造更多精彩的角色吧！\n\n收藏用戶來自：\n• 台北小高0556\n• 新竹旅人\n• 台中夜貓\n• 高雄海風\n• 台南古城\n\n您可以到個人檔案頁面查看更多關於您角色的數據統計。',
    timestamp: '2025-10-29 14:30',
    category: '收藏通知',
    isRead: false,
    actions: [
      { label: '查看角色', type: 'primary' },
      { label: '分享', type: 'secondary' }
    ]
  },
  {
    id: 2,
    title: '系統更新通知',
    message: '系統更新通知：我們新增了語音預覽功能，現在您可以在創建角色時試聽不同的語音效果。',
    fullContent: '親愛的用戶您好，\n\n我們很高興地宣布系統已完成最新更新！\n\n更新內容：\n\n【新功能】\n• 新增語音預覽功能：在創建角色時可以試聽 10 種不同的語音效果\n• 優化角色創建流程，提升整體使用體驗\n• 新增語音波形視覺化顯示\n\n【改進項目】\n• 提升聊天介面的響應速度\n• 優化圖片載入效能\n• 修復部分已知問題\n\n感謝您一直以來的支持，我們會持續努力為您提供更好的服務！',
    timestamp: '2025-10-29 11:15',
    category: '系統公告',
    isRead: false,
    actions: [
      { label: '立即體驗', type: 'primary' }
    ]
  },
  {
    id: 3,
    title: '新訊息',
    message: '您有一條新訊息來自「達令」，快去查看吧！',
    fullContent: '您收到了來自「達令」的新訊息！\n\n「達令」剛剛給您發送了一條訊息，對方似乎很期待與您的對話。\n\n最後對話時間：昨天 15:42\n總對話次數：127 次\n\n趕快回覆吧，不要讓對方等太久哦！',
    timestamp: '2025-10-28 16:20',
    category: '訊息通知',
    isRead: true,
    actions: [
      { label: '查看訊息', type: 'primary' }
    ]
  }
]);

/**
 * 通知系統組合函數
 * 提供通知管理的功能，包括獲取、標記、添加通知等
 *
 * @returns {UseNotificationsReturn} 通知系統的公開方法和狀態
 */
export function useNotifications(): UseNotificationsReturn {
  // 計算未讀通知數量
  const unreadCount: ComputedRef<number> = computed(() => {
    return notificationsStore.value.filter(notification => !notification.isRead).length;
  });

  // 是否有未讀通知
  const hasUnreadNotifications: ComputedRef<boolean> = computed(() => {
    return unreadCount.value > 0;
  });

  // 獲取所有通知
  const notifications: ComputedRef<Notification[]> = computed(() => {
    return notificationsStore.value;
  });

  /**
   * 根據 ID 獲取通知
   *
   * @param {string | number} id - 通知 ID
   * @returns {Notification | undefined} 找到的通知對象或 undefined
   */
  const getNotificationById = (id: string | number): Notification | undefined => {
    // ✅ 修復：驗證 parseInt 結果，防止 NaN
    const numId = typeof id === 'number' ? id : parseInt(String(id), 10);
    if (!Number.isFinite(numId)) {
      return undefined;
    }
    return notificationsStore.value.find(notification => notification.id === numId);
  };

  /**
   * 標記通知為已讀
   *
   * @param {string | number} id - 通知 ID
   */
  const markAsRead = (id: string | number): void => {
    // ✅ 修復：驗證 parseInt 結果，防止 NaN
    const numId = typeof id === 'number' ? id : parseInt(String(id), 10);
    if (!Number.isFinite(numId)) {
      return;
    }
    const notification = notificationsStore.value.find(n => n.id === numId);
    if (notification && !notification.isRead) {
      notification.isRead = true;
    }
  };

  /**
   * 標記所有通知為已讀
   */
  const markAllAsRead = (): void => {
    notificationsStore.value.forEach(notification => {
      notification.isRead = true;
    });
  };

  /**
   * 添加新通知（用於模擬或從 API 接收）
   * 自動生成 ID、時間戳和 isRead 狀態
   *
   * @param {AddNotificationPayload} notification - 通知數據
   */
  const addNotification = (notification: AddNotificationPayload): void => {
    const newNotification: Notification = {
      id: Date.now(),
      isRead: false,
      timestamp: new Date().toISOString(),
      ...notification
    };
    notificationsStore.value.unshift(newNotification);
  };

  return {
    notifications,
    unreadCount,
    hasUnreadNotifications,
    getNotificationById,
    markAsRead,
    markAllAsRead,
    addNotification
  };
}
