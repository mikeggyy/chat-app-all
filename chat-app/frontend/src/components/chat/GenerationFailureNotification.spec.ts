/**
 * GenerationFailureNotification 組件測試
 * 測試生成失敗通知組件的渲染和交互
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import GenerationFailureNotification from './GenerationFailureNotification.vue';

// Mock Heroicons
vi.mock('@heroicons/vue/24/outline', () => ({
  ExclamationTriangleIcon: {
    name: 'ExclamationTriangleIcon',
    template: '<svg class="icon"></svg>',
  },
}));

describe('GenerationFailureNotification', () => {
  // 清理 DOM
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ==========================================
  // 基本渲染測試
  // ==========================================

  describe('基本渲染', () => {
    it('應該在 isVisible 為 true 時渲染通知', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.failure-notification');
      expect(notification).not.toBeNull();
      expect(notification?.textContent).toContain('照片生成失敗');
      expect(notification?.textContent).toContain('測試角色 的照片生成時發生錯誤');

      wrapper.unmount();
    });

    it('應該在 isVisible 為 false 時不渲染通知', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: false,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.failure-notification');
      expect(notification).toBeNull();

      wrapper.unmount();
    });

    it('應該根據 type="photo" 顯示正確的標題', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.failure-notification');
      expect(notification?.textContent).toContain('照片生成失敗');
      expect(notification?.textContent).toContain('的照片生成時發生錯誤');

      wrapper.unmount();
    });

    it('應該根據 type="video" 顯示正確的標題', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'video',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.failure-notification');
      expect(notification?.textContent).toContain('影片生成失敗');
      expect(notification?.textContent).toContain('的影片生成時發生錯誤');

      wrapper.unmount();
    });

    it('應該顯示正確的角色名稱', () => {
      const characterName = '小美';
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName,
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.failure-notification');
      expect(notification?.textContent).toContain(`${characterName} 的照片生成時發生錯誤`);

      wrapper.unmount();
    });

    it('應該處理空的角色名稱', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '',
        },
        attachTo: document.body,
      });

      // 應該顯示空字符串（不會崩潰）
      const notification = document.body.querySelector('.failure-notification');
      expect(notification?.textContent).toContain(' 的照片生成時發生錯誤');

      wrapper.unmount();
    });
  });

  // ==========================================
  // Reason 顯示測試
  // ==========================================

  describe('Reason 顯示', () => {
    it('應該在提供 reason 時顯示失敗原因', () => {
      const reason = '網絡連接失敗';
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
          reason,
        },
        attachTo: document.body,
      });

      const reasonElement = document.body.querySelector('.notification-reason');
      expect(reasonElement).not.toBeNull();
      expect(reasonElement?.textContent).toContain(reason);

      wrapper.unmount();
    });

    it('應該在沒有提供 reason 時不顯示原因區塊', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const reasonElement = document.body.querySelector('.notification-reason');
      expect(reasonElement).toBeNull();

      wrapper.unmount();
    });

    it('應該在 reason 為空字符串時不顯示原因區塊', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
          reason: '',
        },
        attachTo: document.body,
      });

      const reasonElement = document.body.querySelector('.notification-reason');
      expect(reasonElement).toBeNull();

      wrapper.unmount();
    });
  });

  // ==========================================
  // 事件發射測試
  // ==========================================

  describe('事件發射', () => {
    it('應該在點擊「我知道了」按鈕時發出 close 事件', async () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
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

    it('應該允許多次觸發 close 事件', async () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const closeButton = document.body.querySelector('.notification-close') as HTMLElement;

      closeButton?.click();
      closeButton?.click();
      closeButton?.click();

      expect(wrapper.emitted('close')).toHaveLength(3);

      wrapper.unmount();
    });
  });

  // ==========================================
  // 組件結構測試
  // ==========================================

  describe('組件結構', () => {
    it('應該包含正確的 CSS 類', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      expect(document.body.querySelector('.failure-notification')).not.toBeNull();
      expect(document.body.querySelector('.failure-notification-content')).not.toBeNull();
      expect(document.body.querySelector('.notification-icon')).not.toBeNull();
      expect(document.body.querySelector('.notification-text')).not.toBeNull();
      expect(document.body.querySelector('.notification-title')).not.toBeNull();
      expect(document.body.querySelector('.notification-subtitle')).not.toBeNull();
      expect(document.body.querySelector('.notification-close')).not.toBeNull();

      wrapper.unmount();
    });

    it('應該只包含一個按鈕', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const buttons = document.body.querySelectorAll('.failure-notification button');
      expect(buttons).toHaveLength(1);

      wrapper.unmount();
    });

    it('應該包含圖標', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const icons = document.body.querySelectorAll('.failure-notification .icon');
      expect(icons.length).toBeGreaterThanOrEqual(1);

      wrapper.unmount();
    });
  });

  // ==========================================
  // Props 更新測試
  // ==========================================

  describe('Props 更新', () => {
    it('應該響應 isVisible 的變化', async () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: false,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      expect(document.body.querySelector('.failure-notification')).toBeNull();

      // 更新 prop
      await wrapper.setProps({ isVisible: true });

      expect(document.body.querySelector('.failure-notification')).not.toBeNull();

      wrapper.unmount();
    });

    it('應該響應 type 的變化', async () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo' as 'photo' | 'video',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.failure-notification');
      expect(notification?.textContent).toContain('照片生成失敗');

      // 更新 prop
      await wrapper.setProps({ type: 'video' });

      expect(notification?.textContent).toContain('影片生成失敗');
      expect(notification?.textContent).not.toContain('照片生成失敗');

      wrapper.unmount();
    });

    it('應該響應 characterName 的變化', async () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '角色A',
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.failure-notification');
      expect(notification?.textContent).toContain('角色A 的照片生成時發生錯誤');

      // 更新 prop
      await wrapper.setProps({ characterName: '角色B' });

      expect(notification?.textContent).toContain('角色B 的照片生成時發生錯誤');
      expect(notification?.textContent).not.toContain('角色A');

      wrapper.unmount();
    });

    it('應該響應 reason 的變化', async () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
          reason: '原因A',
        },
        attachTo: document.body,
      });

      let reasonElement = document.body.querySelector('.notification-reason');
      expect(reasonElement?.textContent).toContain('原因A');

      // 更新 prop
      await wrapper.setProps({ reason: '原因B' });

      reasonElement = document.body.querySelector('.notification-reason');
      expect(reasonElement?.textContent).toContain('原因B');
      expect(reasonElement?.textContent).not.toContain('原因A');

      wrapper.unmount();
    });
  });

  // ==========================================
  // Computed Properties 測試
  // ==========================================

  describe('Computed Properties', () => {
    it('應該正確計算 photo 類型的 title', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const title = document.body.querySelector('.notification-title');
      expect(title?.textContent).toBe('照片生成失敗');

      wrapper.unmount();
    });

    it('應該正確計算 video 類型的 title', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'video',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const title = document.body.querySelector('.notification-title');
      expect(title?.textContent).toBe('影片生成失敗');

      wrapper.unmount();
    });

    it('應該正確計算 photo 類型的 subtitle', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '小美',
        },
        attachTo: document.body,
      });

      const subtitle = document.body.querySelector('.notification-subtitle');
      expect(subtitle?.textContent).toBe('小美 的照片生成時發生錯誤');

      wrapper.unmount();
    });

    it('應該正確計算 video 類型的 subtitle', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'video',
          characterName: '小明',
        },
        attachTo: document.body,
      });

      const subtitle = document.body.querySelector('.notification-subtitle');
      expect(subtitle?.textContent).toBe('小明 的影片生成時發生錯誤');

      wrapper.unmount();
    });
  });

  // ==========================================
  // 邊界情況測試
  // ==========================================

  describe('邊界情況', () => {
    it('應該處理特殊字符的角色名稱', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '<script>alert("XSS")</script>',
        },
        attachTo: document.body,
      });

      // Vue 應該自動轉義特殊字符
      const notification = document.body.querySelector('.failure-notification');
      expect(notification?.textContent).toContain('<script>alert("XSS")</script>');

      wrapper.unmount();
    });

    it('應該處理超長的角色名稱', () => {
      const longName = 'A'.repeat(100);
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: longName,
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.failure-notification');
      expect(notification?.textContent).toContain(longName);

      wrapper.unmount();
    });

    it('應該處理包含 emoji 的角色名稱', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '😊 開心角色 🎉',
        },
        attachTo: document.body,
      });

      const notification = document.body.querySelector('.failure-notification');
      expect(notification?.textContent).toContain('😊 開心角色 🎉');

      wrapper.unmount();
    });

    it('應該處理包含特殊字符的 reason', () => {
      const reason = '錯誤: <原因> "詳細信息"';
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
          reason,
        },
        attachTo: document.body,
      });

      // Vue 應該自動轉義特殊字符
      const reasonElement = document.body.querySelector('.notification-reason');
      expect(reasonElement?.textContent).toContain(reason);

      wrapper.unmount();
    });
  });

  // ==========================================
  // Accessibility 測試
  // ==========================================

  describe('Accessibility（可訪問性）', () => {
    it('應該有正確的按鈕類型', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const button = document.body.querySelector('.failure-notification button');
      expect(button?.getAttribute('type')).toBe('button');

      wrapper.unmount();
    });

    it('應該有有意義的按鈕文本', () => {
      const wrapper = mount(GenerationFailureNotification, {
        props: {
          isVisible: true,
          type: 'photo',
          characterName: '測試角色',
        },
        attachTo: document.body,
      });

      const closeButton = document.body.querySelector('.notification-close');
      expect(closeButton?.textContent?.trim()).toBe('我知道了');

      wrapper.unmount();
    });
  });
});
