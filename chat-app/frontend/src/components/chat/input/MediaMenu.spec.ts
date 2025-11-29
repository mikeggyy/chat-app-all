/**
 * MediaMenu 組件測試
 * 測試媒體選單的渲染、選單交互、事件發射和點擊外部關閉
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import MediaMenu from './MediaMenu.vue';

// Mock Heroicons
vi.mock('@heroicons/vue/24/outline', () => ({
  EllipsisHorizontalIcon: {
    name: 'EllipsisHorizontalIcon',
    template: '<svg class="ellipsis-icon"></svg>',
  },
  CameraIcon: {
    name: 'CameraIcon',
    template: '<svg class="camera-icon"></svg>',
  },
  VideoCameraIcon: {
    name: 'VideoCameraIcon',
    template: '<svg class="video-camera-icon"></svg>',
  },
}));

describe('MediaMenu', () => {
  let wrapper: VueWrapper<any>;

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  // ==========================================
  // 基本渲染測試
  // ==========================================

  describe('基本渲染', () => {
    it('應該渲染媒體按鈕', () => {
      wrapper = mount(MediaMenu);

      expect(wrapper.find('.media-button').exists()).toBe(true);
    });

    it('應該使用默認 props', () => {
      wrapper = mount(MediaMenu);

      expect(wrapper.find('.media-button').attributes('disabled')).toBeUndefined();
      expect(wrapper.find('.media-button').classes()).not.toContain('is-loading');
    });

    it('應該顯示圖標', () => {
      wrapper = mount(MediaMenu);

      expect(wrapper.find('.ellipsis-icon').exists()).toBe(true);
    });

    it('應該在初始狀態下不顯示選單', () => {
      wrapper = mount(MediaMenu);

      expect(wrapper.find('.media-menu').exists()).toBe(false);
    });
  });

  // ==========================================
  // 選單切換測試
  // ==========================================

  describe('選單切換', () => {
    it('應該在點擊按鈕後顯示選單', async () => {
      wrapper = mount(MediaMenu);

      expect(wrapper.find('.media-menu').exists()).toBe(false);

      await wrapper.find('.media-button').trigger('click');

      expect(wrapper.find('.media-menu').exists()).toBe(true);
    });

    it('應該在再次點擊按鈕後隱藏選單', async () => {
      wrapper = mount(MediaMenu);

      await wrapper.find('.media-button').trigger('click');
      expect(wrapper.find('.media-menu').exists()).toBe(true);

      await wrapper.find('.media-button').trigger('click');
      expect(wrapper.find('.media-menu').exists()).toBe(false);
    });

    it('應該更新 aria-expanded 屬性', async () => {
      wrapper = mount(MediaMenu);

      expect(wrapper.find('.media-button').attributes('aria-expanded')).toBe('false');

      await wrapper.find('.media-button').trigger('click');

      expect(wrapper.find('.media-button').attributes('aria-expanded')).toBe('true');
    });

    it('應該允許多次切換選單', async () => {
      wrapper = mount(MediaMenu);

      const button = wrapper.find('.media-button');

      await button.trigger('click');
      expect(wrapper.find('.media-menu').exists()).toBe(true);

      await button.trigger('click');
      expect(wrapper.find('.media-menu').exists()).toBe(false);

      await button.trigger('click');
      expect(wrapper.find('.media-menu').exists()).toBe(true);
    });
  });

  // ==========================================
  // 選單項目測試
  // ==========================================

  describe('選單項目', () => {
    beforeEach(async () => {
      wrapper = mount(MediaMenu);
      await wrapper.find('.media-button').trigger('click');
    });

    it('應該顯示兩個選單項目', () => {
      const items = wrapper.findAll('.media-menu__item');
      expect(items).toHaveLength(2);
    });

    it('應該顯示「請求自拍照片」選項', () => {
      const items = wrapper.findAll('.media-menu__item');
      expect(items[0].text()).toContain('請求自拍照片');
    });

    it('應該顯示「生成影片」選項', () => {
      const items = wrapper.findAll('.media-menu__item');
      expect(items[1].text()).toContain('生成影片');
    });

    it('應該在選單項目中顯示圖標', () => {
      expect(wrapper.find('.camera-icon').exists()).toBe(true);
      expect(wrapper.find('.video-camera-icon').exists()).toBe(true);
    });

    it('應該在默認狀態下啟用所有選單項目', () => {
      const items = wrapper.findAll('.media-menu__item');
      expect(items[0].attributes('disabled')).toBeUndefined();
      expect(items[1].attributes('disabled')).toBeUndefined();
    });
  });

  // ==========================================
  // 事件發射測試
  // ==========================================

  describe('事件發射', () => {
    beforeEach(async () => {
      wrapper = mount(MediaMenu);
      await wrapper.find('.media-button').trigger('click');
    });

    it('應該在點擊「請求自拍照片」時發出 selfie-click 事件', async () => {
      const items = wrapper.findAll('.media-menu__item');
      await items[0].trigger('click');

      expect(wrapper.emitted('selfie-click')).toBeTruthy();
      expect(wrapper.emitted('selfie-click')).toHaveLength(1);
    });

    it('應該在點擊「生成影片」時發出 video-click 事件', async () => {
      const items = wrapper.findAll('.media-menu__item');
      await items[1].trigger('click');

      expect(wrapper.emitted('video-click')).toBeTruthy();
      expect(wrapper.emitted('video-click')).toHaveLength(1);
    });

    it('應該在點擊選單項目後關閉選單', async () => {
      const items = wrapper.findAll('.media-menu__item');
      await items[0].trigger('click');

      expect(wrapper.find('.media-menu').exists()).toBe(false);
    });

    it('應該允許多次觸發同一事件', async () => {
      const items = wrapper.findAll('.media-menu__item');

      await items[0].trigger('click');

      // 重新打開選單
      await wrapper.find('.media-button').trigger('click');
      const items2 = wrapper.findAll('.media-menu__item');
      await items2[0].trigger('click');

      expect(wrapper.emitted('selfie-click')).toHaveLength(2);
    });
  });

  // ==========================================
  // Props 測試
  // ==========================================

  describe('Props', () => {
    it('應該在 isRequestingSelfie 為 true 時添加 is-loading 類', () => {
      wrapper = mount(MediaMenu, {
        props: {
          isRequestingSelfie: true,
        },
      });

      expect(wrapper.find('.media-button').classes()).toContain('is-loading');
    });

    it('應該在 isRequestingVideo 為 true 時添加 is-loading 類', () => {
      wrapper = mount(MediaMenu, {
        props: {
          isRequestingVideo: true,
        },
      });

      expect(wrapper.find('.media-button').classes()).toContain('is-loading');
    });

    it('應該在 isSendingGift 為 true 時禁用按鈕', () => {
      wrapper = mount(MediaMenu, {
        props: {
          isSendingGift: true,
        },
      });

      expect(wrapper.find('.media-button').attributes('disabled')).toBeDefined();
    });

    it('應該在請求中時禁用選單項目', async () => {
      wrapper = mount(MediaMenu, {
        props: {
          isRequestingSelfie: true,
        },
      });

      await wrapper.find('.media-button').trigger('click');

      const items = wrapper.findAll('.media-menu__item');
      expect(items[0].attributes('disabled')).toBeDefined();
      expect(items[1].attributes('disabled')).toBeDefined();
    });
  });

  // ==========================================
  // Props 更新測試
  // ==========================================

  describe('Props 更新', () => {
    it('應該響應 isRequestingSelfie 的變化', async () => {
      wrapper = mount(MediaMenu, {
        props: {
          isRequestingSelfie: false,
        },
      });

      expect(wrapper.find('.media-button').classes()).not.toContain('is-loading');

      await wrapper.setProps({ isRequestingSelfie: true });

      expect(wrapper.find('.media-button').classes()).toContain('is-loading');
    });

    it('應該響應 isRequestingVideo 的變化', async () => {
      wrapper = mount(MediaMenu, {
        props: {
          isRequestingVideo: false,
        },
      });

      expect(wrapper.find('.media-button').classes()).not.toContain('is-loading');

      await wrapper.setProps({ isRequestingVideo: true });

      expect(wrapper.find('.media-button').classes()).toContain('is-loading');
    });

    it('應該響應 isSendingGift 的變化', async () => {
      wrapper = mount(MediaMenu, {
        props: {
          isSendingGift: false,
        },
      });

      expect(wrapper.find('.media-button').attributes('disabled')).toBeUndefined();

      await wrapper.setProps({ isSendingGift: true });

      expect(wrapper.find('.media-button').attributes('disabled')).toBeDefined();
    });
  });

  // ==========================================
  // 點擊外部關閉選單測試
  // ==========================================

  describe('點擊外部關閉選單', () => {
    it('應該在點擊外部時關閉選單', async () => {
      wrapper = mount(MediaMenu, {
        attachTo: document.body,
      });

      await wrapper.find('.media-button').trigger('click');
      expect(wrapper.find('.media-menu').exists()).toBe(true);

      // 模擬點擊外部
      document.body.click();
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.media-menu').exists()).toBe(false);

      wrapper.unmount();
    });

    it('應該在點擊按鈕自己時不觸發外部點擊關閉', async () => {
      wrapper = mount(MediaMenu, {
        attachTo: document.body,
      });

      await wrapper.find('.media-button').trigger('click');
      expect(wrapper.find('.media-menu').exists()).toBe(true);

      // 點擊按鈕本身會切換狀態（不是外部點擊）
      await wrapper.find('.media-button').trigger('click');
      expect(wrapper.find('.media-menu').exists()).toBe(false);

      wrapper.unmount();
    });

    it('應該在組件卸載時清理事件監聽器', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      wrapper = mount(MediaMenu);
      wrapper.unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  // ==========================================
  // Accessibility 測試
  // ==========================================

  describe('Accessibility（可訪問性）', () => {
    it('應該有有意義的 aria-label（按鈕）', () => {
      wrapper = mount(MediaMenu);

      const ariaLabel = wrapper.find('.media-button').attributes('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toBe('媒體功能');
    });

    it('應該有正確的 aria-expanded 屬性', async () => {
      wrapper = mount(MediaMenu);

      expect(wrapper.find('.media-button').attributes('aria-expanded')).toBe('false');

      await wrapper.find('.media-button').trigger('click');

      expect(wrapper.find('.media-button').attributes('aria-expanded')).toBe('true');
    });

    it('應該有正確的 aria-haspopup 屬性', () => {
      wrapper = mount(MediaMenu);

      expect(wrapper.find('.media-button').attributes('aria-haspopup')).toBe('menu');
    });

    it('應該有有意義的 aria-label（選單）', async () => {
      wrapper = mount(MediaMenu);

      await wrapper.find('.media-button').trigger('click');

      const menuAriaLabel = wrapper.find('.media-menu').attributes('aria-label');
      expect(menuAriaLabel).toBeTruthy();
      expect(menuAriaLabel).toBe('媒體選項');
    });

    it('應該正確使用 role 屬性', async () => {
      wrapper = mount(MediaMenu);

      await wrapper.find('.media-button').trigger('click');

      expect(wrapper.find('.media-menu').attributes('role')).toBe('menu');

      const items = wrapper.findAll('.media-menu__item');
      items.forEach((item) => {
        expect(item.attributes('role')).toBe('menuitem');
      });
    });

    it('應該正確標記 aria-hidden 的圖標', () => {
      wrapper = mount(MediaMenu);

      const icons = wrapper.findAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('應該有正確的按鈕類型', () => {
      wrapper = mount(MediaMenu);

      expect(wrapper.find('.media-button').attributes('type')).toBe('button');
    });
  });

  // ==========================================
  // 組件結構測試
  // ==========================================

  describe('組件結構', () => {
    it('應該包含正確的 CSS 類', async () => {
      wrapper = mount(MediaMenu);

      expect(wrapper.find('.media-wrapper').exists()).toBe(true);
      expect(wrapper.find('.media-button').exists()).toBe(true);

      await wrapper.find('.media-button').trigger('click');

      expect(wrapper.find('.media-menu').exists()).toBe(true);
      expect(wrapper.findAll('.media-menu__item')).toHaveLength(2);
    });

    it('應該是 button 元素', () => {
      wrapper = mount(MediaMenu);

      expect(wrapper.find('.media-button').element.tagName).toBe('BUTTON');
    });

    it('應該按正確順序渲染選單項目（自拍在前，影片在後）', async () => {
      wrapper = mount(MediaMenu);

      await wrapper.find('.media-button').trigger('click');

      const items = wrapper.findAll('.media-menu__item');
      expect(items).toHaveLength(2);
      expect(items[0].text()).toContain('請求自拍照片');
      expect(items[1].text()).toContain('生成影片');
    });
  });

  // ==========================================
  // 邊界情況測試
  // ==========================================

  describe('邊界情況', () => {
    it('應該處理快速連續點擊按鈕', async () => {
      wrapper = mount(MediaMenu);

      const button = wrapper.find('.media-button');

      await button.trigger('click');
      await button.trigger('click');
      await button.trigger('click');
      await button.trigger('click');

      // 最終狀態應該是關閉（偶數次點擊）
      expect(wrapper.find('.media-menu').exists()).toBe(false);
    });

    it('應該處理多個 loading 狀態同時為 true', () => {
      wrapper = mount(MediaMenu, {
        props: {
          isRequestingSelfie: true,
          isRequestingVideo: true,
        },
      });

      expect(wrapper.find('.media-button').classes()).toContain('is-loading');
    });

    it('應該處理所有禁用條件同時為 true', async () => {
      wrapper = mount(MediaMenu, {
        props: {
          isRequestingSelfie: true,
          isRequestingVideo: true,
          isSendingGift: true,
        },
      });

      expect(wrapper.find('.media-button').attributes('disabled')).toBeDefined();
      expect(wrapper.find('.media-button').classes()).toContain('is-loading');
    });
  });
});
