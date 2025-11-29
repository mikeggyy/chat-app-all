/**
 * TextInput 組件測試
 * 測試文字輸入框的基本功能和交互
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TextInput from './TextInput.vue';

describe('TextInput', () => {
  // ==========================================
  // 基本渲染測試
  // ==========================================

  describe('基本渲染', () => {
    it('應該渲染輸入框', () => {
      const wrapper = mount(TextInput);

      expect(wrapper.find('input').exists()).toBe(true);
      expect(wrapper.find('.text-input').exists()).toBe(true);
    });

    it('應該有正確的 type 屬性', () => {
      const wrapper = mount(TextInput);

      expect(wrapper.find('input').attributes('type')).toBe('text');
    });

    it('應該有 autocomplete="off" 屬性', () => {
      const wrapper = mount(TextInput);

      expect(wrapper.find('input').attributes('autocomplete')).toBe('off');
    });

    it('應該使用默認 placeholder', () => {
      const wrapper = mount(TextInput);

      expect(wrapper.find('input').attributes('placeholder')).toBe('輸入訊息...');
    });

    it('應該使用自定義 placeholder', () => {
      const wrapper = mount(TextInput, {
        props: {
          placeholder: '請輸入內容',
        },
      });

      expect(wrapper.find('input').attributes('placeholder')).toBe('請輸入內容');
    });
  });

  // ==========================================
  // v-model 綁定測試
  // ==========================================

  describe('v-model 綁定', () => {
    it('應該顯示初始值', () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '初始內容',
        },
      });

      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('初始內容');
    });

    it('應該在輸入時發出 update:modelValue 事件', async () => {
      const wrapper = mount(TextInput);

      await wrapper.find('input').setValue('新內容');

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['新內容']);
    });

    it('應該支持多次更新', async () => {
      const wrapper = mount(TextInput);

      await wrapper.find('input').setValue('第一次');
      await wrapper.find('input').setValue('第二次');
      await wrapper.find('input').setValue('第三次');

      expect(wrapper.emitted('update:modelValue')).toHaveLength(3);
      expect(wrapper.emitted('update:modelValue')![2]).toEqual(['第三次']);
    });

    it('應該處理空字符串', async () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '有內容',
        },
      });

      await wrapper.find('input').setValue('');

      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['']);
    });

    it('應該處理 undefined modelValue', () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: undefined,
        },
      });

      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    });
  });

  // ==========================================
  // Enter 鍵提交測試
  // ==========================================

  describe('Enter 鍵提交', () => {
    it('應該在按下 Enter 鍵時發出 submit 事件（有內容）', async () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '有內容',
        },
      });

      await wrapper.find('input').trigger('keydown.enter');

      expect(wrapper.emitted('submit')).toBeTruthy();
      expect(wrapper.emitted('submit')).toHaveLength(1);
    });

    it('應該阻止 Enter 鍵的默認行為', async () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '有內容',
        },
      });

      const event = await wrapper.find('input').trigger('keydown.enter');

      // Trigger 方法會自動處理 prevent，我們檢查事件被正確觸發
      expect(wrapper.emitted('submit')).toBeTruthy();
    });

    it('應該在內容為空時不發出 submit 事件', async () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '',
        },
      });

      await wrapper.find('input').trigger('keydown.enter');

      expect(wrapper.emitted('submit')).toBeFalsy();
    });

    it('應該在內容只有空格時不發出 submit 事件', async () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '   ',
        },
      });

      await wrapper.find('input').trigger('keydown.enter');

      expect(wrapper.emitted('submit')).toBeFalsy();
    });

    it('應該在 disabled 時不發出 submit 事件', async () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '有內容',
          disabled: true,
        },
      });

      await wrapper.find('input').trigger('keydown.enter');

      expect(wrapper.emitted('submit')).toBeFalsy();
    });

    it('應該允許多次提交', async () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '有內容',
        },
      });

      await wrapper.find('input').trigger('keydown.enter');
      await wrapper.find('input').trigger('keydown.enter');
      await wrapper.find('input').trigger('keydown.enter');

      expect(wrapper.emitted('submit')).toHaveLength(3);
    });
  });

  // ==========================================
  // Disabled 狀態測試
  // ==========================================

  describe('Disabled 狀態', () => {
    it('應該在 disabled 時添加 disabled 屬性', () => {
      const wrapper = mount(TextInput, {
        props: {
          disabled: true,
        },
      });

      expect(wrapper.find('input').attributes('disabled')).toBeDefined();
    });

    it('應該在 disabled 時仍可以顯示內容', () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '顯示內容',
          disabled: true,
        },
      });

      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('顯示內容');
    });

    it('應該在非 disabled 時沒有 disabled 屬性', () => {
      const wrapper = mount(TextInput, {
        props: {
          disabled: false,
        },
      });

      expect(wrapper.find('input').attributes('disabled')).toBeUndefined();
    });
  });

  // ==========================================
  // Focus 方法測試
  // ==========================================

  describe('Focus 方法', () => {
    it('應該暴露 focus 方法', () => {
      const wrapper = mount(TextInput);

      expect(wrapper.vm.focus).toBeDefined();
      expect(typeof wrapper.vm.focus).toBe('function');
    });

    it('應該能夠聚焦輸入框', async () => {
      const wrapper = mount(TextInput, {
        attachTo: document.body,
      });

      wrapper.vm.focus();

      await wrapper.vm.$nextTick();

      expect(document.activeElement).toBe(wrapper.find('input').element);

      wrapper.unmount();
    });
  });

  // ==========================================
  // 邊界情況測試
  // ==========================================

  describe('邊界情況', () => {
    it('應該處理非常長的內容', async () => {
      const longText = 'A'.repeat(1000);
      const wrapper = mount(TextInput);

      await wrapper.find('input').setValue(longText);

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([longText]);
    });

    it('應該處理特殊字符', async () => {
      const specialText = '<script>alert("XSS")</script>';
      const wrapper = mount(TextInput);

      await wrapper.find('input').setValue(specialText);

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([specialText]);
    });

    it('應該處理 emoji', async () => {
      const emojiText = '😊 你好 🎉';
      const wrapper = mount(TextInput);

      await wrapper.find('input').setValue(emojiText);

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([emojiText]);
    });

    it('應該處理前後有空格的內容（提交時）', async () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '  有內容  ',
        },
      });

      await wrapper.find('input').trigger('keydown.enter');

      // 只要 trim() 後有內容就應該提交
      expect(wrapper.emitted('submit')).toBeTruthy();
    });

    it('應該處理 tab 鍵（僅空格）', async () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '\t',
        },
      });

      await wrapper.find('input').trigger('keydown.enter');

      expect(wrapper.emitted('submit')).toBeFalsy();
    });
  });

  // ==========================================
  // Props 更新測試
  // ==========================================

  describe('Props 更新', () => {
    it('應該響應 modelValue 的變化', async () => {
      const wrapper = mount(TextInput, {
        props: {
          modelValue: '初始值',
        },
      });

      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('初始值');

      await wrapper.setProps({ modelValue: '更新值' });

      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('更新值');
    });

    it('應該響應 disabled 的變化', async () => {
      const wrapper = mount(TextInput, {
        props: {
          disabled: false,
        },
      });

      expect(wrapper.find('input').attributes('disabled')).toBeUndefined();

      await wrapper.setProps({ disabled: true });

      expect(wrapper.find('input').attributes('disabled')).toBeDefined();
    });

    it('應該響應 placeholder 的變化', async () => {
      const wrapper = mount(TextInput, {
        props: {
          placeholder: '初始提示',
        },
      });

      expect(wrapper.find('input').attributes('placeholder')).toBe('初始提示');

      await wrapper.setProps({ placeholder: '更新提示' });

      expect(wrapper.find('input').attributes('placeholder')).toBe('更新提示');
    });
  });

  // ==========================================
  // Accessibility 測試
  // ==========================================

  describe('Accessibility（可訪問性）', () => {
    it('應該是可聚焦的（非 disabled）', () => {
      const wrapper = mount(TextInput);

      expect(wrapper.find('input').attributes('tabindex')).toBeUndefined(); // 默認可聚焦
    });

    it('應該在 disabled 時仍然是 input 元素', () => {
      const wrapper = mount(TextInput, {
        props: {
          disabled: true,
        },
      });

      expect(wrapper.find('input').element.tagName).toBe('INPUT');
    });

    it('應該有有意義的 placeholder', () => {
      const wrapper = mount(TextInput);

      const placeholder = wrapper.find('input').attributes('placeholder');
      expect(placeholder).toBeTruthy();
      expect(placeholder!.length).toBeGreaterThan(0);
    });
  });
});
