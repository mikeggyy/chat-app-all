/**
 * 影片生成完成提示 Composable
 *
 * 當影片生成完成時，顯示頂部提示並提供滾動到影片位置的按鈕
 */

import { ref, type Ref } from 'vue';

export interface VideoCompletionNotification {
  show: boolean;
  videoMessageId: string;
  characterName: string;
}

export interface UseVideoCompletionNotificationReturn {
  notification: Ref<VideoCompletionNotification | null>;
  showNotification: (videoMessageId: string, characterName: string) => void;
  hideNotification: () => void;
  scrollToVideo: (messageListRef: any, videoMessageId: string) => void;
}

export function useVideoCompletionNotification(): UseVideoCompletionNotificationReturn {
  const notification: Ref<VideoCompletionNotification | null> = ref(null);

  /**
   * 顯示影片完成提示
   */
  const showNotification = (videoMessageId: string, characterName: string): void => {
    notification.value = {
      show: true,
      videoMessageId,
      characterName,
    };
  };

  /**
   * 隱藏提示
   */
  const hideNotification = (): void => {
    notification.value = null;
  };

  /**
   * 滾動到影片位置
   */
  const scrollToVideo = (messageListRef: any, videoMessageId: string): void => {
    if (!messageListRef?.value) {
      console.warn('[VideoNotification] messageListRef 不可用');
      return;
    }

    // 尋找影片消息元素
    const messageElements = messageListRef.value.$el?.querySelectorAll('.chat-bubble');
    if (!messageElements) {
      console.warn('[VideoNotification] 找不到消息元素');
      return;
    }

    // 找到對應的影片消息
    let targetElement: HTMLElement | null = null;
    messageElements.forEach((el: HTMLElement) => {
      // 檢查是否包含影片
      const videoElement = el.querySelector('video');
      if (videoElement) {
        // 可以通過 data 屬性或其他方式標記消息 ID
        // 這裡簡單地找到第一個包含非 loading 影片的消息
        const src = videoElement.getAttribute('src');
        if (src && src !== 'loading') {
          targetElement = el;
        }
      }
    });

    if (targetElement) {
      // 滾動到影片位置
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      // 添加高亮效果
      targetElement.style.transition = 'box-shadow 0.3s ease';
      targetElement.style.boxShadow = '0 0 20px rgba(255, 107, 157, 0.6)';

      setTimeout(() => {
        targetElement!.style.boxShadow = '';
      }, 2000);
    } else {
      console.warn('[VideoNotification] 找不到影片元素');
      // Fallback: 滾動到底部
      if (messageListRef.value.scrollToBottom) {
        messageListRef.value.scrollToBottom();
      }
    }

    // 隱藏提示
    hideNotification();
  };

  return {
    notification,
    showNotification,
    hideNotification,
    scrollToVideo,
  };
}
