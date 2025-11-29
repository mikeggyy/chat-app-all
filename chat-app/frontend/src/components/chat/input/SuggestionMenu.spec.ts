/**
 * SuggestionMenu 組件測試
 * 測試建議回覆選單的渲染、載入狀態、錯誤處理、事件發射和點擊外部關閉
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import SuggestionMenu from './SuggestionMenu.vue';

// Mock Heroicons
vi.mock('@heroicons/vue/24/outline', () => ({
  SparklesIcon: {
    name: 'SparklesIcon',
    template: '<svg class="sparkles-icon"></svg>',
  },
}));

describe('SuggestionMenu', () => {
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
    it('應該渲染建議按鈕', () => {
      wrapper = mount(SuggestionMenu);

      expect(wrapper.find('.suggestion-button').exists()).toBe(true);
    });

    it('應該使用默認 props', () => {
      wrapper = mount(SuggestionMenu);

      expect(wrapper.find('.suggestion-button').attributes('disabled')).toBeUndefined();
    });

    it('應該顯示圖標', () => {
      wrapper = mount(SuggestionMenu);

      expect(wrapper.find('.sparkles-icon').exists()).toBe(true);
    });

    it('應該在初始狀態下不顯示選單', () => {
      wrapper = mount(SuggestionMenu);

      expect(wrapper.find('.suggestion-menu').exists()).toBe(false);
    });
  });

  // ==========================================
  // 選單切換測試
  // ==========================================

  describe('選單切換', () => {
    it('應該在點擊按鈕後顯示選單', async () => {
      wrapper = mount(SuggestionMenu);

      expect(wrapper.find('.suggestion-menu').exists()).toBe(false);

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.find('.suggestion-menu').exists()).toBe(true);
    });

    it('應該在再次點擊按鈕後隱藏選單', async () => {
      wrapper = mount(SuggestionMenu);

      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.find('.suggestion-menu').exists()).toBe(true);

      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.find('.suggestion-menu').exists()).toBe(false);
    });

    it('應該更新 aria-expanded 屬性', async () => {
      wrapper = mount(SuggestionMenu);

      expect(wrapper.find('.suggestion-button').attributes('aria-expanded')).toBe('false');

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.find('.suggestion-button').attributes('aria-expanded')).toBe('true');
    });

    it('應該在 disabled 時不切換選單', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          disabled: true,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.find('.suggestion-menu').exists()).toBe(false);
    });

    it('應該允許多次切換選單', async () => {
      wrapper = mount(SuggestionMenu);

      const button = wrapper.find('.suggestion-button');

      await button.trigger('click');
      expect(wrapper.find('.suggestion-menu').exists()).toBe(true);

      await button.trigger('click');
      expect(wrapper.find('.suggestion-menu').exists()).toBe(false);

      await button.trigger('click');
      expect(wrapper.find('.suggestion-menu').exists()).toBe(true);
    });
  });

  // ==========================================
  // 請求建議測試
  // ==========================================

  describe('請求建議', () => {
    it('應該在打開選單時發出 request-suggestions 事件（當建議列表為空且未載入時）', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: [],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.emitted('request-suggestions')).toBeTruthy();
      expect(wrapper.emitted('request-suggestions')).toHaveLength(1);
    });

    it('應該在已有建議時不發出 request-suggestions 事件', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1', '建議 2'],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.emitted('request-suggestions')).toBeFalsy();
    });

    it('應該在正在載入時不發出 request-suggestions 事件', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: [],
          isLoading: true,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.emitted('request-suggestions')).toBeFalsy();
    });

    it('應該在關閉並重新打開選單時再次請求建議（如果建議已被清空）', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: [],
          isLoading: false,
        },
      });

      // 第一次打開
      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.emitted('request-suggestions')).toHaveLength(1);

      // 關閉
      await wrapper.find('.suggestion-button').trigger('click');

      // 第二次打開
      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.emitted('request-suggestions')).toHaveLength(2);
    });
  });

  // ==========================================
  // 載入狀態測試
  // ==========================================

  describe('載入狀態', () => {
    it('應該在 isLoading 為 true 時顯示載入中狀態', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          isLoading: true,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.find('.suggestion-menu__loading').exists()).toBe(true);
      expect(wrapper.find('.suggestion-loader').exists()).toBe(true);
    });

    it('應該顯示載入中文字', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          isLoading: true,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.text()).toContain('生成建議中…');
    });

    it('應該顯示三個載入點', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          isLoading: true,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      const dots = wrapper.findAll('.suggestion-loader__dot');
      expect(dots).toHaveLength(3);
    });

    it('應該在載入完成後隱藏載入狀態', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          isLoading: true,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.find('.suggestion-menu__loading').exists()).toBe(true);

      await wrapper.setProps({ isLoading: false, suggestions: ['建議 1'] });

      expect(wrapper.find('.suggestion-menu__loading').exists()).toBe(false);
    });
  });

  // ==========================================
  // 錯誤狀態測試
  // ==========================================

  describe('錯誤狀態', () => {
    it('應該顯示錯誤訊息', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          error: '生成建議失敗',
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.text()).toContain('生成建議失敗');
    });

    it('應該對錯誤訊息應用錯誤樣式', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          error: '生成建議失敗',
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.find('.suggestion-menu__state--error').exists()).toBe(true);
    });

    it('應該在有錯誤時仍會顯示建議項目（如果有的話）', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          error: '生成建議失敗',
          suggestions: ['建議 1', '建議 2'],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      // 組件會同時顯示錯誤訊息和建議項目
      expect(wrapper.find('.suggestion-menu__state--error').exists()).toBe(true);
      expect(wrapper.findAll('.suggestion-menu__item')).toHaveLength(2);
    });

    it('應該在錯誤清除後顯示建議項目', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          error: '生成建議失敗',
          suggestions: [],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.find('.suggestion-menu__state--error').exists()).toBe(true);

      await wrapper.setProps({ error: null, suggestions: ['建議 1'] });

      expect(wrapper.find('.suggestion-menu__state--error').exists()).toBe(false);
      expect(wrapper.findAll('.suggestion-menu__item')).toHaveLength(1);
    });
  });

  // ==========================================
  // 建議列表測試
  // ==========================================

  describe('建議列表', () => {
    it('應該顯示空狀態訊息（無建議且無錯誤）', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: [],
          isLoading: false,
          error: null,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.find('.suggestion-menu__empty').exists()).toBe(true);
      expect(wrapper.text()).toContain('目前沒有建議內容');
    });

    it('應該顯示建議項目', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1', '建議 2', '建議 3'],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      const items = wrapper.findAll('.suggestion-menu__item');
      expect(items).toHaveLength(3);
      expect(items[0].text()).toBe('建議 1');
      expect(items[1].text()).toBe('建議 2');
      expect(items[2].text()).toBe('建議 3');
    });

    it('應該處理單個建議', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['唯一建議'],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      const items = wrapper.findAll('.suggestion-menu__item');
      expect(items).toHaveLength(1);
      expect(items[0].text()).toBe('唯一建議');
    });

    it('應該處理長文本建議', async () => {
      const longText = '這是一個非常長的建議文本，用於測試組件是否能正確處理長內容的顯示和交互';

      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: [longText],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      const items = wrapper.findAll('.suggestion-menu__item');
      expect(items[0].text()).toBe(longText);
    });
  });

  // ==========================================
  // 事件發射測試
  // ==========================================

  describe('事件發射', () => {
    it('應該在點擊建議項目時發出 suggestion-click 事件', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1', '建議 2'],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      const items = wrapper.findAll('.suggestion-menu__item');
      await items[0].trigger('click');

      expect(wrapper.emitted('suggestion-click')).toBeTruthy();
      expect(wrapper.emitted('suggestion-click')?.[0]).toEqual(['建議 1']);
    });

    it('應該在點擊不同建議時發出不同內容', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1', '建議 2', '建議 3'],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      const items = wrapper.findAll('.suggestion-menu__item');
      await items[1].trigger('click');

      expect(wrapper.emitted('suggestion-click')?.[0]).toEqual(['建議 2']);
    });

    it('應該在點擊建議後關閉選單', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1'],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.find('.suggestion-menu').exists()).toBe(true);

      const items = wrapper.findAll('.suggestion-menu__item');
      await items[0].trigger('click');

      expect(wrapper.find('.suggestion-menu').exists()).toBe(false);
    });

    it('應該允許多次選擇建議', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1', '建議 2'],
          isLoading: false,
        },
      });

      // 第一次選擇
      await wrapper.find('.suggestion-button').trigger('click');
      let items = wrapper.findAll('.suggestion-menu__item');
      await items[0].trigger('click');

      // 第二次選擇
      await wrapper.find('.suggestion-button').trigger('click');
      items = wrapper.findAll('.suggestion-menu__item');
      await items[1].trigger('click');

      expect(wrapper.emitted('suggestion-click')).toHaveLength(2);
      expect(wrapper.emitted('suggestion-click')?.[0]).toEqual(['建議 1']);
      expect(wrapper.emitted('suggestion-click')?.[1]).toEqual(['建議 2']);
    });
  });

  // ==========================================
  // Props 更新測試
  // ==========================================

  describe('Props 更新', () => {
    it('應該響應 suggestions 的變化', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1'],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.findAll('.suggestion-menu__item')).toHaveLength(1);

      await wrapper.setProps({ suggestions: ['建議 1', '建議 2', '建議 3'] });

      expect(wrapper.findAll('.suggestion-menu__item')).toHaveLength(3);
    });

    it('應該響應 isLoading 的變化', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          isLoading: false,
          suggestions: [],
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.find('.suggestion-menu__loading').exists()).toBe(false);

      await wrapper.setProps({ isLoading: true });

      expect(wrapper.find('.suggestion-menu__loading').exists()).toBe(true);
    });

    it('應該響應 error 的變化', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          error: null,
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.find('.suggestion-menu__state--error').exists()).toBe(false);

      await wrapper.setProps({ error: '錯誤訊息' });

      expect(wrapper.find('.suggestion-menu__state--error').exists()).toBe(true);
    });

    it('應該響應 disabled 的變化', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          disabled: false,
        },
      });

      expect(wrapper.find('.suggestion-button').attributes('disabled')).toBeUndefined();

      await wrapper.setProps({ disabled: true });

      expect(wrapper.find('.suggestion-button').attributes('disabled')).toBeDefined();
    });
  });

  // ==========================================
  // 點擊外部關閉選單測試
  // ==========================================

  describe('點擊外部關閉選單', () => {
    it('應該在點擊外部時關閉選單', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1'],
        },
        attachTo: document.body,
      });

      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.find('.suggestion-menu').exists()).toBe(true);

      // 模擬點擊外部
      document.body.click();
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.suggestion-menu').exists()).toBe(false);

      wrapper.unmount();
    });

    it('應該在點擊按鈕自己時不觸發外部點擊關閉', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1'],
        },
        attachTo: document.body,
      });

      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.find('.suggestion-menu').exists()).toBe(true);

      // 點擊按鈕本身會切換狀態（不是外部點擊）
      await wrapper.find('.suggestion-button').trigger('click');
      expect(wrapper.find('.suggestion-menu').exists()).toBe(false);

      wrapper.unmount();
    });

    it('應該在組件卸載時清理事件監聽器', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      wrapper = mount(SuggestionMenu);
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
      wrapper = mount(SuggestionMenu);

      const ariaLabel = wrapper.find('.suggestion-button').attributes('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toBe('取得建議回覆');
    });

    it('應該有正確的 aria-expanded 屬性', async () => {
      wrapper = mount(SuggestionMenu);

      expect(wrapper.find('.suggestion-button').attributes('aria-expanded')).toBe('false');

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.find('.suggestion-button').attributes('aria-expanded')).toBe('true');
    });

    it('應該有正確的 aria-haspopup 屬性', () => {
      wrapper = mount(SuggestionMenu);

      expect(wrapper.find('.suggestion-button').attributes('aria-haspopup')).toBe('menu');
    });

    it('應該有有意義的 aria-label（選單）', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1'],
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      const menuAriaLabel = wrapper.find('.suggestion-menu').attributes('aria-label');
      expect(menuAriaLabel).toBeTruthy();
      expect(menuAriaLabel).toBe('建議回覆');
    });

    it('應該正確使用 role 屬性', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1'],
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.find('.suggestion-menu').attributes('role')).toBe('menu');

      const items = wrapper.findAll('.suggestion-menu__item');
      items.forEach((item) => {
        expect(item.attributes('role')).toBe('menuitem');
      });
    });

    it('應該正確標記 aria-hidden 的圖標', () => {
      wrapper = mount(SuggestionMenu);

      const icons = wrapper.findAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('應該有正確的按鈕類型', () => {
      wrapper = mount(SuggestionMenu);

      expect(wrapper.find('.suggestion-button').attributes('type')).toBe('button');
    });
  });

  // ==========================================
  // 組件結構測試
  // ==========================================

  describe('組件結構', () => {
    it('應該包含正確的 CSS 類', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1'],
        },
      });

      expect(wrapper.find('.suggestion-wrapper').exists()).toBe(true);
      expect(wrapper.find('.suggestion-button').exists()).toBe(true);

      await wrapper.find('.suggestion-button').trigger('click');

      expect(wrapper.find('.suggestion-menu').exists()).toBe(true);
    });

    it('應該是 button 元素', () => {
      wrapper = mount(SuggestionMenu);

      expect(wrapper.find('.suggestion-button').element.tagName).toBe('BUTTON');
    });
  });

  // ==========================================
  // 邊界情況測試
  // ==========================================

  describe('邊界情況', () => {
    it('應該處理快速連續點擊按鈕', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['建議 1'],
        },
      });

      const button = wrapper.find('.suggestion-button');

      await button.trigger('click');
      await button.trigger('click');
      await button.trigger('click');
      await button.trigger('click');

      // 最終狀態應該是關閉（偶數次點擊）
      expect(wrapper.find('.suggestion-menu').exists()).toBe(false);
    });

    it('應該處理空字符串建議', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: [''],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      const items = wrapper.findAll('.suggestion-menu__item');
      expect(items).toHaveLength(1);
      expect(items[0].text()).toBe('');
    });

    it('應該處理特殊字符建議', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: ['<script>alert("XSS")</script>', '你好 & 再見'],
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      const items = wrapper.findAll('.suggestion-menu__item');
      expect(items[0].text()).toContain('script');
      expect(items[1].text()).toContain('&');
    });

    it('應該處理同時有 error 和 isLoading 的情況（error 優先）', async () => {
      wrapper = mount(SuggestionMenu, {
        props: {
          error: '錯誤訊息',
          isLoading: true,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      // isLoading 為 false 時才顯示錯誤，否則顯示載入
      expect(wrapper.find('.suggestion-menu__loading').exists()).toBe(true);

      await wrapper.setProps({ isLoading: false });

      expect(wrapper.find('.suggestion-menu__state--error').exists()).toBe(true);
    });

    it('應該處理大量建議項目', async () => {
      const manySuggestions = Array.from({ length: 20 }, (_, i) => `建議 ${i + 1}`);

      wrapper = mount(SuggestionMenu, {
        props: {
          suggestions: manySuggestions,
          isLoading: false,
        },
      });

      await wrapper.find('.suggestion-button').trigger('click');

      const items = wrapper.findAll('.suggestion-menu__item');
      expect(items).toHaveLength(20);
    });
  });
});
