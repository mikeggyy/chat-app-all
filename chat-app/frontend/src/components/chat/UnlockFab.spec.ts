/**
 * UnlockFab 組件測試
 * 測試快速解鎖角色懸浮按鈕的渲染和交互
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import UnlockFab from './UnlockFab.vue';

describe('UnlockFab', () => {
  // ==========================================
  // 基本渲染測試
  // ==========================================

  describe('基本渲染', () => {
    it('應該在角色已解鎖時不渲染按鈕', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: true,
          hasCharacterTickets: false,
          characterTickets: 0,
        },
      });

      expect(wrapper.find('.unlock-fab').exists()).toBe(false);
      // HTML 包含註釋，所以不能精確匹配
      expect(wrapper.html()).toContain('<!--v-if-->');
    });

    it('應該在角色未解鎖時渲染按鈕', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: false,
          characterTickets: 0,
        },
      });

      expect(wrapper.find('.unlock-fab').exists()).toBe(true);
    });

    it('應該使用默認 props（未解鎖，無卡片）', () => {
      const wrapper = mount(UnlockFab);

      // 默認應該顯示（isCharacterUnlocked 默認為 false）
      expect(wrapper.find('.unlock-fab').exists()).toBe(true);
      expect(wrapper.find('.unlock-fab').classes()).not.toContain('has-cards');
      expect(wrapper.find('.unlock-fab__count').exists()).toBe(false);
    });

    it('應該在沒有卡片時顯示按鈕（無數量徽章）', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: false,
          characterTickets: 0,
        },
      });

      expect(wrapper.find('.unlock-fab').exists()).toBe(true);
      expect(wrapper.find('.unlock-fab__count').exists()).toBe(false);
    });

    it('應該在有卡片時顯示按鈕和數量徽章', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: 3,
        },
      });

      expect(wrapper.find('.unlock-fab').exists()).toBe(true);
      expect(wrapper.find('.unlock-fab__count').exists()).toBe(true);
      expect(wrapper.find('.unlock-fab__count').text()).toBe('3');
    });
  });

  // ==========================================
  // Props 測試
  // ==========================================

  describe('Props', () => {
    it('應該顯示正確的卡片數量', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: 5,
        },
      });

      expect(wrapper.find('.unlock-fab__count').text()).toBe('5');
    });

    it('應該在有卡片時添加 has-cards 類', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: 1,
        },
      });

      expect(wrapper.find('.unlock-fab').classes()).toContain('has-cards');
    });

    it('應該在沒有卡片時不添加 has-cards 類', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: false,
          characterTickets: 0,
        },
      });

      expect(wrapper.find('.unlock-fab').classes()).not.toContain('has-cards');
    });

    it('應該處理大量卡片數字', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: 999,
        },
      });

      expect(wrapper.find('.unlock-fab__count').text()).toBe('999');
    });
  });

  // ==========================================
  // Computed Properties 測試
  // ==========================================

  describe('Computed Properties', () => {
    it('應該在有卡片時顯示「使用解鎖卡」title', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: 3,
        },
      });

      expect(wrapper.find('.unlock-fab').attributes('title')).toBe(
        '使用解鎖卡（擁有 3 張）'
      );
    });

    it('應該在沒有卡片時顯示「購買解鎖卡」title', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: false,
          characterTickets: 0,
        },
      });

      expect(wrapper.find('.unlock-fab').attributes('title')).toBe('購買解鎖卡');
    });

    it('應該在只有 1 張卡片時顯示正確的 title', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: 1,
        },
      });

      expect(wrapper.find('.unlock-fab').attributes('title')).toBe(
        '使用解鎖卡（擁有 1 張）'
      );
    });
  });

  // ==========================================
  // 事件發射測試
  // ==========================================

  describe('事件發射', () => {
    it('應該在點擊時發出 unlock-action 事件', async () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: false,
        },
      });

      await wrapper.find('.unlock-fab').trigger('click');

      expect(wrapper.emitted('unlock-action')).toBeTruthy();
      expect(wrapper.emitted('unlock-action')).toHaveLength(1);
    });

    it('應該允許多次觸發 unlock-action 事件', async () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: 3,
        },
      });

      const button = wrapper.find('.unlock-fab');

      await button.trigger('click');
      await button.trigger('click');
      await button.trigger('click');

      expect(wrapper.emitted('unlock-action')).toHaveLength(3);
    });
  });

  // ==========================================
  // 組件結構測試
  // ==========================================

  describe('組件結構', () => {
    it('應該包含正確的 CSS 類', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: 5,
        },
      });

      expect(wrapper.find('.unlock-fab').exists()).toBe(true);
      expect(wrapper.find('.unlock-fab__icon').exists()).toBe(true);
      expect(wrapper.find('.unlock-fab__count').exists()).toBe(true);
    });

    it('應該顯示票券 emoji 圖標', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
        },
      });

      expect(wrapper.find('.unlock-fab__icon').text()).toBe('🎫');
    });

    it('應該是 button 元素', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
        },
      });

      expect(wrapper.find('.unlock-fab').element.tagName).toBe('BUTTON');
    });

    it('應該有正確的 button type', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
        },
      });

      expect(wrapper.find('.unlock-fab').attributes('type')).toBe('button');
    });
  });

  // ==========================================
  // Props 更新測試
  // ==========================================

  describe('Props 更新', () => {
    it('應該響應 isCharacterUnlocked 的變化', async () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: false,
        },
      });

      expect(wrapper.find('.unlock-fab').exists()).toBe(true);

      // 更新為已解鎖
      await wrapper.setProps({ isCharacterUnlocked: true });

      expect(wrapper.find('.unlock-fab').exists()).toBe(false);
    });

    it('應該響應 hasCharacterTickets 的變化', async () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: false,
          characterTickets: 0,
        },
      });

      expect(wrapper.find('.unlock-fab').classes()).not.toContain('has-cards');
      expect(wrapper.find('.unlock-fab__count').exists()).toBe(false);

      // 更新為有卡片
      await wrapper.setProps({ hasCharacterTickets: true, characterTickets: 3 });

      expect(wrapper.find('.unlock-fab').classes()).toContain('has-cards');
      expect(wrapper.find('.unlock-fab__count').exists()).toBe(true);
      expect(wrapper.find('.unlock-fab__count').text()).toBe('3');
    });

    it('應該響應 characterTickets 的變化', async () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: 1,
        },
      });

      expect(wrapper.find('.unlock-fab__count').text()).toBe('1');
      expect(wrapper.find('.unlock-fab').attributes('title')).toBe(
        '使用解鎖卡（擁有 1 張）'
      );

      // 更新數量
      await wrapper.setProps({ characterTickets: 10 });

      expect(wrapper.find('.unlock-fab__count').text()).toBe('10');
      expect(wrapper.find('.unlock-fab').attributes('title')).toBe(
        '使用解鎖卡（擁有 10 張）'
      );
    });
  });

  // ==========================================
  // 邊界情況測試
  // ==========================================

  describe('邊界情況', () => {
    it('應該處理 0 張卡片', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: 0,
        },
      });

      // 即使 hasCharacterTickets 為 true，數量為 0 時應該顯示
      expect(wrapper.find('.unlock-fab__count').exists()).toBe(true);
      expect(wrapper.find('.unlock-fab__count').text()).toBe('0');
      expect(wrapper.find('.unlock-fab').attributes('title')).toBe(
        '使用解鎖卡（擁有 0 張）'
      );
    });

    it('應該處理負數卡片（異常情況）', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: -1,
        },
      });

      // 應該顯示負數（不過這在實際應用中不應該發生）
      expect(wrapper.find('.unlock-fab__count').text()).toBe('-1');
    });

    it('應該處理 hasCharacterTickets 為 true 但 characterTickets 為 0 的不一致狀態', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: true,
          characterTickets: 0,
        },
      });

      // 應該顯示數量徽章（即使數量為 0）
      expect(wrapper.find('.unlock-fab__count').exists()).toBe(true);
      expect(wrapper.find('.unlock-fab').classes()).toContain('has-cards');
    });

    it('應該處理 hasCharacterTickets 為 false 但 characterTickets 大於 0 的不一致狀態', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: false,
          characterTickets: 5,
        },
      });

      // 應該隱藏數量徽章（基於 hasCharacterTickets）
      expect(wrapper.find('.unlock-fab__count').exists()).toBe(false);
      expect(wrapper.find('.unlock-fab').classes()).not.toContain('has-cards');
      expect(wrapper.find('.unlock-fab').attributes('title')).toBe('購買解鎖卡');
    });
  });

  // ==========================================
  // Accessibility 測試
  // ==========================================

  describe('Accessibility（可訪問性）', () => {
    it('應該有有意義的 title 屬性', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
          hasCharacterTickets: false,
        },
      });

      const title = wrapper.find('.unlock-fab').attributes('title');
      expect(title).toBeTruthy();
      expect(title).toBe('購買解鎖卡');
    });

    it('應該有正確的按鈕類型', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
        },
      });

      expect(wrapper.find('.unlock-fab').attributes('type')).toBe('button');
    });

    it('應該可以通過鍵盤觸發（button 元素自帶）', () => {
      const wrapper = mount(UnlockFab, {
        props: {
          isCharacterUnlocked: false,
        },
      });

      // button 元素預設支持鍵盤事件，只需確認是 button 即可
      expect(wrapper.find('.unlock-fab').element.tagName).toBe('BUTTON');
    });
  });
});
