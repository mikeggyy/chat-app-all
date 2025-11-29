/**
 * ChatContent 組件測試
 * 測試聊天內容容器組件的渲染和事件傳遞
 */

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ChatContent from './ChatContent.vue';

// Mock 子組件
vi.mock('./MessageList.vue', () => ({
  default: {
    name: 'MessageList',
    template: '<div class="message-list-mock"></div>',
  },
}));

vi.mock('./MessageInput.vue', () => ({
  default: {
    name: 'MessageInput',
    template: '<div class="message-input-mock"></div>',
  },
}));

vi.mock('./UnlockFab.vue', () => ({
  default: {
    name: 'UnlockFab',
    template: '<div class="unlock-fab-mock"></div>',
  },
}));

describe('ChatContent', () => {
  // ==========================================
  // 基本渲染測試
  // ==========================================

  describe('基本渲染', () => {
    it('應該渲染所有子組件', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '測試角色',
        },
      });

      expect(wrapper.find('.message-list-mock').exists()).toBe(true);
      expect(wrapper.find('.message-input-mock').exists()).toBe(true);
      expect(wrapper.find('.unlock-fab-mock').exists()).toBe(true);
    });

    it('應該使用默認 props', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '測試角色',
        },
      });

      expect(wrapper.props('messages')).toEqual([]);
      expect(wrapper.props('partnerName')).toBe('測試角色');
      expect(wrapper.props('partnerBackground')).toBe('');
      expect(wrapper.props('isReplying')).toBe(false);
      expect(wrapper.props('disabled')).toBe(false);
    });
  });

  // ==========================================
  // Props 傳遞測試
  // ==========================================

  describe('Props 傳遞', () => {
    it('應該正確傳遞 messages', () => {
      const messages = [
        { id: '1', role: 'user', text: '你好' },
        { id: '2', role: 'assistant', text: '你好！' },
      ];

      const wrapper = mount(ChatContent, {
        props: {
          messages,
          partnerName: '測試角色',
        },
      });

      expect(wrapper.props('messages')).toStrictEqual(messages);
    });

    it('應該正確傳遞 partnerName', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '小美',
        },
      });

      expect(wrapper.props('partnerName')).toBe('小美');
    });

    it('應該正確傳遞所有 MessageList props', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [{ id: '1', role: 'user', text: 'test' }],
          partnerName: '角色',
          partnerBackground: 'https://example.com/bg.jpg',
          isReplying: true,
          playingVoiceMessageId: 'msg-1',
        },
      });

      expect(wrapper.props('partnerBackground')).toBe('https://example.com/bg.jpg');
      expect(wrapper.props('isReplying')).toBe(true);
      expect(wrapper.props('playingVoiceMessageId')).toBe('msg-1');
    });

    it('應該正確傳遞所有 MessageInput props', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
          draft: '草稿內容',
          disabled: true,
          suggestions: ['建議1', '建議2'],
          isLoadingSuggestions: true,
          suggestionError: '載入失敗',
          isSendingGift: true,
          isRequestingSelfie: true,
          isRequestingVideo: true,
          photoRemaining: 5,
        },
      });

      expect(wrapper.props('draft')).toBe('草稿內容');
      expect(wrapper.props('disabled')).toBe(true);
      expect(wrapper.props('suggestions')).toEqual(['建議1', '建議2']);
      expect(wrapper.props('isLoadingSuggestions')).toBe(true);
      expect(wrapper.props('suggestionError')).toBe('載入失敗');
      expect(wrapper.props('isSendingGift')).toBe(true);
      expect(wrapper.props('isRequestingSelfie')).toBe(true);
      expect(wrapper.props('isRequestingVideo')).toBe(true);
      expect(wrapper.props('photoRemaining')).toBe(5);
    });

    it('應該正確傳遞所有 UnlockFab props', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
          isCharacterUnlocked: true,
          hasCharacterTickets: true,
          characterTickets: 3,
        },
      });

      expect(wrapper.props('isCharacterUnlocked')).toBe(true);
      expect(wrapper.props('hasCharacterTickets')).toBe(true);
      expect(wrapper.props('characterTickets')).toBe(3);
    });
  });

  // ==========================================
  // 事件發射測試
  // ==========================================

  describe('事件發射', () => {
    it('應該轉發 play-voice 事件', async () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      const message = { id: 'msg-1', role: 'assistant', text: 'test' };
      await wrapper.vm.$emit('play-voice', message);

      expect(wrapper.emitted('play-voice')).toBeTruthy();
      expect(wrapper.emitted('play-voice')![0]).toEqual([message]);
    });

    it('應該轉發 image-click 事件', async () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      const message = { id: 'msg-1', imageUrl: 'https://example.com/img.jpg' };
      await wrapper.vm.$emit('image-click', message);

      expect(wrapper.emitted('image-click')).toBeTruthy();
      expect(wrapper.emitted('image-click')![0]).toEqual([message]);
    });

    it('應該轉發 update:draft 事件', async () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      await wrapper.vm.$emit('update:draft', '新草稿');

      expect(wrapper.emitted('update:draft')).toBeTruthy();
      expect(wrapper.emitted('update:draft')![0]).toEqual(['新草稿']);
    });

    it('應該轉發 send 事件', async () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      await wrapper.vm.$emit('send', '發送消息');

      expect(wrapper.emitted('send')).toBeTruthy();
      expect(wrapper.emitted('send')![0]).toEqual(['發送消息']);
    });

    it('應該轉發 suggestion-click 事件', async () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      await wrapper.vm.$emit('suggestion-click', '建議內容');

      expect(wrapper.emitted('suggestion-click')).toBeTruthy();
      expect(wrapper.emitted('suggestion-click')![0]).toEqual(['建議內容']);
    });

    it('應該轉發 request-suggestions 事件', async () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      await wrapper.vm.$emit('request-suggestions');

      expect(wrapper.emitted('request-suggestions')).toBeTruthy();
      expect(wrapper.emitted('request-suggestions')).toHaveLength(1);
    });

    it('應該轉發 gift-click 事件', async () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      await wrapper.vm.$emit('gift-click');

      expect(wrapper.emitted('gift-click')).toBeTruthy();
      expect(wrapper.emitted('gift-click')).toHaveLength(1);
    });

    it('應該轉發 selfie-click 事件', async () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      await wrapper.vm.$emit('selfie-click');

      expect(wrapper.emitted('selfie-click')).toBeTruthy();
      expect(wrapper.emitted('selfie-click')).toHaveLength(1);
    });

    it('應該轉發 video-click 事件', async () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      await wrapper.vm.$emit('video-click');

      expect(wrapper.emitted('video-click')).toBeTruthy();
      expect(wrapper.emitted('video-click')).toHaveLength(1);
    });

    it('應該轉發 unlock-action 事件', async () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      await wrapper.vm.$emit('unlock-action');

      expect(wrapper.emitted('unlock-action')).toBeTruthy();
      expect(wrapper.emitted('unlock-action')).toHaveLength(1);
    });
  });

  // ==========================================
  // Refs 暴露測試
  // ==========================================

  describe('Refs 暴露', () => {
    it('應該暴露 messageListRef', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      expect(wrapper.vm.messageListRef).toBeDefined();
    });

    it('應該暴露 messageInputRef', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      expect(wrapper.vm.messageInputRef).toBeDefined();
    });
  });

  // ==========================================
  // 邊界情況測試
  // ==========================================

  describe('邊界情況', () => {
    it('應該處理空消息列表', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      expect(wrapper.props('messages')).toEqual([]);
      expect(wrapper.find('.message-list-mock').exists()).toBe(true);
    });

    it('應該處理大量消息', () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        text: `Message ${i}`,
      }));

      const wrapper = mount(ChatContent, {
        props: {
          messages,
          partnerName: '角色',
        },
      });

      expect(wrapper.props('messages')).toHaveLength(100);
    });

    it('應該處理空的 partnerName', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '',
        },
      });

      expect(wrapper.props('partnerName')).toBe('');
    });

    it('應該處理特殊字符的 partnerName', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '<script>alert("XSS")</script>',
        },
      });

      expect(wrapper.props('partnerName')).toBe('<script>alert("XSS")</script>');
    });

    it('應該處理 undefined 的可選 props', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
          playingVoiceMessageId: undefined,
          suggestionError: undefined,
        },
      });

      expect(wrapper.props('playingVoiceMessageId')).toBeUndefined();
      expect(wrapper.props('suggestionError')).toBeUndefined();
    });
  });

  // ==========================================
  // 組件結構測試
  // ==========================================

  describe('組件結構', () => {
    it('應該有正確的根元素類名', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      expect(wrapper.find('.chat-content').exists()).toBe(true);
    });

    it('應該按順序渲染子組件', () => {
      const wrapper = mount(ChatContent, {
        props: {
          messages: [],
          partnerName: '角色',
        },
      });

      const html = wrapper.html();
      const messageListIndex = html.indexOf('message-list-mock');
      const messageInputIndex = html.indexOf('message-input-mock');
      const unlockFabIndex = html.indexOf('unlock-fab-mock');

      // MessageList 應該在 MessageInput 之前
      expect(messageListIndex).toBeLessThan(messageInputIndex);
      // MessageInput 應該在 UnlockFab 之前
      expect(messageInputIndex).toBeLessThan(unlockFabIndex);
    });
  });
});
