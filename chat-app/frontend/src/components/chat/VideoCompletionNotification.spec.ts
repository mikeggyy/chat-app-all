/**
 * VideoCompletionNotification 組件測試
 * 測試影片完成通知組件的渲染和交互
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import VideoCompletionNotification from './VideoCompletionNotification.vue';

// Mock Heroicons
vi.mock('@heroicons/vue/24/outline', () => ({
  VideoCameraIcon: {
    name: 'VideoCameraIcon',
    template: '<svg class="icon"></svg>',
  },
  XMarkIcon: {
    name: 'XMarkIcon',
    template: '<svg class="icon"></svg>',
  },
}));

describe('VideoCompletionNotification', () => {
  // 清理 DOM
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ==========================================
  // 基本渲染測試
  // ==========================================

  describe('基本渲染', () => {
    it('應該在 isVisible 為 true 時渲染通知', () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      // Teleport 將內容移到 body，所以要在 document.body 中查找
      const notification = document.body.querySelector('.video-notification');
      expect(notification).not.toBeNull();
      expect(notification?.textContent).toContain('影片錄好了！');
      expect(notification?.textContent).toContain('測試角色 的影片已生成完成');

      wrapper.unmount();
    });

    it('應該在 isVisible 為 false 時不渲染通知', () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: false,
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.video-notification');
      expect(notification).toBeNull();

      wrapper.unmount();
    });

    it('應該顯示正確的角色名稱', () => {
      const characterName = '小美';
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName,
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.video-notification');
      expect(notification?.textContent).toContain(`${characterName} 的影片已生成完成`);

      wrapper.unmount();
    });

    it('應該處理空的角色名稱', () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '',
        },
        attachTo: document.body,
      });

      // 應該顯示空字符串（不會崩潰）
      const notification = document.body.querySelector('.video-notification');
      expect(notification?.textContent).toContain(' 的影片已生成完成');

      wrapper.unmount();
    });
  });

  // ==========================================
  // 事件發射測試
  // ==========================================

  describe('事件發射', () => {
    it('應該在點擊「查看」按鈕時發出 view-video 事件', async () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const viewButton = document.body.querySelector('.notification-button') as HTMLElement;
      expect(viewButton).not.toBeNull();
      viewButton?.click();

      expect(wrapper.emitted('view-video')).toBeTruthy();
      expect(wrapper.emitted('view-video')).toHaveLength(1);

      wrapper.unmount();
    });

    it('應該在點擊關閉按鈕時發出 close 事件', async () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const closeButton = document.body.querySelector('.notification-close') as HTMLElement;
      expect(closeButton).not.toBeNull();
      closeButton?.click();

      expect(wrapper.emitted('close')).toBeTruthy();
      expect(wrapper.emitted('close')).toHaveLength(1);

      wrapper.unmount();
    });

    it('應該允許多次觸發事件', async () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const viewButton = document.body.querySelector('.notification-button') as HTMLElement;

      viewButton?.click();
      viewButton?.click();
      viewButton?.click();

      expect(wrapper.emitted('view-video')).toHaveLength(3);

      wrapper.unmount();
    });
  });

  // ==========================================
  // 組件結構測試
  // ==========================================

  describe('組件結構', () => {
    it('應該包含正確的 CSS 類', () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      expect(document.body.querySelector('.video-notification')).not.toBeNull();
      expect(document.body.querySelector('.video-notification-content')).not.toBeNull();
      expect(document.body.querySelector('.notification-icon')).not.toBeNull();
      expect(document.body.querySelector('.notification-text')).not.toBeNull();
      expect(document.body.querySelector('.notification-title')).not.toBeNull();
      expect(document.body.querySelector('.notification-subtitle')).not.toBeNull();
      expect(document.body.querySelector('.notification-button')).not.toBeNull();
      expect(document.body.querySelector('.notification-close')).not.toBeNull();

      wrapper.unmount();
    });

    it('應該包含兩個按鈕', () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const buttons = document.body.querySelectorAll('.video-notification button');
      expect(buttons).toHaveLength(2);

      wrapper.unmount();
    });

    it('應該包含圖標', () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      // 應該有兩個圖標（VideoCameraIcon 和 XMarkIcon）
      const icons = document.body.querySelectorAll('.video-notification .icon');
      expect(icons.length).toBeGreaterThanOrEqual(2);

      wrapper.unmount();
    });
  });

  // ==========================================
  // Props 更新測試
  // ==========================================

  describe('Props 更新', () => {
    it('應該響應 isVisible 的變化', async () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: false,
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      expect(document.body.querySelector('.video-notification')).toBeNull();

      // 更新 prop
      await wrapper.setProps({ isVisible: true });

      expect(document.body.querySelector('.video-notification')).not.toBeNull();

      wrapper.unmount();
    });

    it('應該響應 characterName 的變化', async () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '角色A',
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.video-notification');
      expect(notification?.textContent).toContain('角色A 的影片已生成完成');

      // 更新 prop
      await wrapper.setProps({ characterName: '角色B' });

      expect(notification?.textContent).toContain('角色B 的影片已生成完成');
      expect(notification?.textContent).not.toContain('角色A');

      wrapper.unmount();
    });
  });

  // ==========================================
  // 邊界情況測試
  // ==========================================

  describe('邊界情況', () => {
    it('應該處理特殊字符的角色名稱', () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '<script>alert("XSS")</script>',
        },
        attachTo: document.body,
      });

      // Vue 應該自動轉義特殊字符
      const notification = document.body.querySelector('.video-notification');
      expect(notification?.textContent).toContain('<script>alert("XSS")</script> 的影片已生成完成');

      wrapper.unmount();
    });

    it('應該處理超長的角色名稱', () => {
      const longName = 'A'.repeat(100);
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: longName,
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.video-notification');
      expect(notification?.textContent).toContain(longName);

      wrapper.unmount();
    });

    it('應該處理包含 emoji 的角色名稱', () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '😊 開心角色 🎉',
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.video-notification');
      expect(notification?.textContent).toContain('😊 開心角色 🎉');

      wrapper.unmount();
    });
  });

  // ==========================================
  // Accessibility 測試
  // ==========================================

  describe('Accessibility（可訪問性）', () => {
    it('應該有正確的按鈕類型', () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const buttons = document.body.querySelectorAll('.video-notification button');
      buttons.forEach((button) => {
        expect(button.getAttribute('type')).toBe('button');
      });

      wrapper.unmount();
    });

    it('應該有有意義的按鈕文本', () => {
      const wrapper = mount(VideoCompletionNotification, {
        props: {
          isVisible: true,
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const viewButton = document.body.querySelector('.notification-button');
      expect(viewButton?.textContent?.trim()).toBe('查看');

      wrapper.unmount();
    });
  });
});
