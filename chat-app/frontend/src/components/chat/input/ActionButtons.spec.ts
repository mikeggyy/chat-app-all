/**
 * ActionButtons 組件測試
 * 測試發送按鈕和禮物按鈕的渲染、禁用狀態和事件
 */

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ActionButtons from './ActionButtons.vue';

// Mock Heroicons
vi.mock('@heroicons/vue/24/outline', () => ({
  PaperAirplaneIcon: {
    name: 'PaperAirplaneIcon',
    template: '<svg class="paper-airplane-icon"></svg>',
  },
  GiftIcon: {
    name: 'GiftIcon',
    template: '<svg class="gift-icon"></svg>',
  },
}));

describe('ActionButtons', () => {
  // ==========================================
  // 基本渲染測試
  // ==========================================

  describe('基本渲染', () => {
    it('應該渲染兩個按鈕（發送和禮物）', () => {
      const wrapper = mount(ActionButtons);

      expect(wrapper.find('.action-buttons__send').exists()).toBe(true);
      expect(wrapper.find('.action-buttons__gift').exists()).toBe(true);
    });

    it('應該使用默認 props', () => {
      const wrapper = mount(ActionButtons);

      // 默認 canSend: false, 所以發送按鈕應該被禁用
      expect(wrapper.find('.action-buttons__send').attributes('disabled')).toBeDefined();
      // 默認 disabled: false, 禮物按鈕不應該被禁用（除非其他條件）
      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeUndefined();
    });

    it('應該顯示圖標', () => {
      const wrapper = mount(ActionButtons);

      expect(wrapper.find('.paper-airplane-icon').exists()).toBe(true);
      expect(wrapper.find('.gift-icon').exists()).toBe(true);
    });
  });

  // ==========================================
  // 發送按鈕測試
  // ==========================================

  describe('發送按鈕', () => {
    it('應該在 canSend 為 true 時啟用發送按鈕', () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: true,
        },
      });

      expect(wrapper.find('.action-buttons__send').attributes('disabled')).toBeUndefined();
      expect(wrapper.find('.action-buttons__send').classes()).not.toContain('is-disabled');
    });

    it('應該在 canSend 為 false 時禁用發送按鈕', () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: false,
        },
      });

      expect(wrapper.find('.action-buttons__send').attributes('disabled')).toBeDefined();
      expect(wrapper.find('.action-buttons__send').classes()).toContain('is-disabled');
    });

    it('應該在 disabled 為 true 時禁用發送按鈕（即使 canSend 為 true）', () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: true,
          disabled: true,
        },
      });

      expect(wrapper.find('.action-buttons__send').attributes('disabled')).toBeDefined();
      expect(wrapper.find('.action-buttons__send').classes()).toContain('is-disabled');
    });

    it('應該在點擊發送按鈕時發出 send-click 事件', async () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: true,
        },
      });

      await wrapper.find('.action-buttons__send').trigger('click');

      expect(wrapper.emitted('send-click')).toBeTruthy();
      expect(wrapper.emitted('send-click')).toHaveLength(1);
    });

    it('應該允許多次點擊發送按鈕', async () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: true,
        },
      });

      const sendButton = wrapper.find('.action-buttons__send');
      await sendButton.trigger('click');
      await sendButton.trigger('click');
      await sendButton.trigger('click');

      expect(wrapper.emitted('send-click')).toHaveLength(3);
    });

    it('應該有正確的 aria-label', () => {
      const wrapper = mount(ActionButtons);

      expect(wrapper.find('.action-buttons__send').attributes('aria-label')).toBe('送出訊息');
    });

    it('應該是 button 元素', () => {
      const wrapper = mount(ActionButtons);

      expect(wrapper.find('.action-buttons__send').element.tagName).toBe('BUTTON');
      expect(wrapper.find('.action-buttons__send').attributes('type')).toBe('button');
    });
  });

  // ==========================================
  // 禮物按鈕測試
  // ==========================================

  describe('禮物按鈕', () => {
    it('應該在默認狀態下啟用禮物按鈕', () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: false,
        },
      });

      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeUndefined();
    });

    it('應該在 isSendingGift 為 true 時禁用禮物按鈕', () => {
      const wrapper = mount(ActionButtons, {
        props: {
          isSendingGift: true,
        },
      });

      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeDefined();
    });

    it('應該在 isRequestingSelfie 為 true 時禁用禮物按鈕', () => {
      const wrapper = mount(ActionButtons, {
        props: {
          isRequestingSelfie: true,
        },
      });

      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeDefined();
    });

    it('應該在 disabled 為 true 時禁用禮物按鈕', () => {
      const wrapper = mount(ActionButtons, {
        props: {
          disabled: true,
        },
      });

      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeDefined();
    });

    it('應該在點擊禮物按鈕時發出 gift-click 事件', async () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: false,
        },
      });

      await wrapper.find('.action-buttons__gift').trigger('click');

      expect(wrapper.emitted('gift-click')).toBeTruthy();
      expect(wrapper.emitted('gift-click')).toHaveLength(1);
    });

    it('應該允許多次點擊禮物按鈕', async () => {
      const wrapper = mount(ActionButtons);

      const giftButton = wrapper.find('.action-buttons__gift');
      await giftButton.trigger('click');
      await giftButton.trigger('click');
      await giftButton.trigger('click');

      expect(wrapper.emitted('gift-click')).toHaveLength(3);
    });

    it('應該有正確的 aria-label', () => {
      const wrapper = mount(ActionButtons);

      expect(wrapper.find('.action-buttons__gift').attributes('aria-label')).toBe('傳送禮物');
    });

    it('應該是 button 元素', () => {
      const wrapper = mount(ActionButtons);

      expect(wrapper.find('.action-buttons__gift').element.tagName).toBe('BUTTON');
      expect(wrapper.find('.action-buttons__gift').attributes('type')).toBe('button');
    });
  });

  // ==========================================
  // Props 更新測試
  // ==========================================

  describe('Props 更新', () => {
    it('應該響應 canSend 的變化', async () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: false,
        },
      });

      expect(wrapper.find('.action-buttons__send').attributes('disabled')).toBeDefined();

      await wrapper.setProps({ canSend: true });

      expect(wrapper.find('.action-buttons__send').attributes('disabled')).toBeUndefined();
    });

    it('應該響應 disabled 的變化', async () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: true,
          disabled: false,
        },
      });

      expect(wrapper.find('.action-buttons__send').attributes('disabled')).toBeUndefined();
      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeUndefined();

      await wrapper.setProps({ disabled: true });

      expect(wrapper.find('.action-buttons__send').attributes('disabled')).toBeDefined();
      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeDefined();
    });

    it('應該響應 isSendingGift 的變化', async () => {
      const wrapper = mount(ActionButtons, {
        props: {
          isSendingGift: false,
        },
      });

      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeUndefined();

      await wrapper.setProps({ isSendingGift: true });

      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeDefined();
    });

    it('應該響應 isRequestingSelfie 的變化', async () => {
      const wrapper = mount(ActionButtons, {
        props: {
          isRequestingSelfie: false,
        },
      });

      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeUndefined();

      await wrapper.setProps({ isRequestingSelfie: true });

      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeDefined();
    });
  });

  // ==========================================
  // 組合條件測試
  // ==========================================

  describe('組合條件', () => {
    it('應該處理多個禁用條件（發送按鈕）', () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: false,
          disabled: true,
        },
      });

      expect(wrapper.find('.action-buttons__send').attributes('disabled')).toBeDefined();
      expect(wrapper.find('.action-buttons__send').classes()).toContain('is-disabled');
    });

    it('應該處理多個禁用條件（禮物按鈕）', () => {
      const wrapper = mount(ActionButtons, {
        props: {
          isSendingGift: true,
          isRequestingSelfie: true,
          disabled: true,
        },
      });

      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeDefined();
    });

    it('應該允許兩個按鈕同時被點擊（在不同時間）', async () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: true,
        },
      });

      await wrapper.find('.action-buttons__send').trigger('click');
      await wrapper.find('.action-buttons__gift').trigger('click');

      expect(wrapper.emitted('send-click')).toHaveLength(1);
      expect(wrapper.emitted('gift-click')).toHaveLength(1);
    });

    it('應該在 isRequestingVideo 為 true 時不影響任何按鈕（僅用於顯示狀態）', () => {
      const wrapper = mount(ActionButtons, {
        props: {
          canSend: true,
          isRequestingVideo: true,
        },
      });

      // isRequestingVideo 不影響任何按鈕的禁用狀態
      expect(wrapper.find('.action-buttons__send').attributes('disabled')).toBeUndefined();
      expect(wrapper.find('.action-buttons__gift').attributes('disabled')).toBeUndefined();
    });
  });

  // ==========================================
  // Accessibility 測試
  // ==========================================

  describe('Accessibility（可訪問性）', () => {
    it('應該有有意義的 aria-label（發送按鈕）', () => {
      const wrapper = mount(ActionButtons);

      const ariaLabel = wrapper.find('.action-buttons__send').attributes('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toBe('送出訊息');
    });

    it('應該有有意義的 aria-label（禮物按鈕）', () => {
      const wrapper = mount(ActionButtons);

      const ariaLabel = wrapper.find('.action-buttons__gift').attributes('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toBe('傳送禮物');
    });

    it('應該正確標記 aria-hidden 的圖標', () => {
      const wrapper = mount(ActionButtons);

      // Heroicons 組件應該有 aria-hidden
      const icons = wrapper.findAll('[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('應該有正確的按鈕類型', () => {
      const wrapper = mount(ActionButtons);

      expect(wrapper.find('.action-buttons__send').attributes('type')).toBe('button');
      expect(wrapper.find('.action-buttons__gift').attributes('type')).toBe('button');
    });
  });

  // ==========================================
  // 組件結構測試
  // ==========================================

  describe('組件結構', () => {
    it('應該包含正確的 CSS 類', () => {
      const wrapper = mount(ActionButtons);

      expect(wrapper.find('.action-buttons').exists()).toBe(true);
      expect(wrapper.find('.action-buttons__send').exists()).toBe(true);
      expect(wrapper.find('.action-buttons__gift').exists()).toBe(true);
    });

    it('應該按正確順序渲染按鈕（發送在前，禮物在後）', () => {
      const wrapper = mount(ActionButtons);

      const buttons = wrapper.findAll('button');
      expect(buttons).toHaveLength(2);
      expect(buttons[0].classes()).toContain('action-buttons__send');
      expect(buttons[1].classes()).toContain('action-buttons__gift');
    });
  });
});
