/**
 * useModalManager 測試
 * 測試統一模態框管理功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { useModalManager } from './useModalManager';
import type { ConversationLimitData, VoiceLimitData, PhotoVideoLimitData, Message } from './useModalManager';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('useModalManager', () => {
  let modalManager: ReturnType<typeof useModalManager>;

  beforeEach(() => {
    modalManager = useModalManager();
    vi.clearAllMocks();
  });

  // ==========================================
  // 通用方法測試 - open()
  // ==========================================

  describe('open() - 通用打開方法', () => {
    it('應該打開指定的模態框', () => {
      modalManager.open('resetConfirm');

      expect(modalManager.modals.resetConfirm.show).toBe(true);
    });

    it('應該打開模態框並更新數據', () => {
      modalManager.open('potionConfirm', { type: 'memoryBoost' });

      expect(modalManager.modals.potionConfirm.show).toBe(true);
      expect(modalManager.modals.potionConfirm.type).toBe('memoryBoost');
    });

    it('應該更新嵌套的 data 對象', () => {
      modalManager.open('conversationLimit', {
        characterName: '測試角色',
        remainingMessages: 5,
      });

      expect(modalManager.modals.conversationLimit.show).toBe(true);
      expect(modalManager.modals.conversationLimit.data.characterName).toBe('測試角色');
      expect(modalManager.modals.conversationLimit.data.remainingMessages).toBe(5);
    });

    it('應該忽略更新中的 show 屬性', () => {
      modalManager.modals.resetConfirm.show = false;

      modalManager.open('resetConfirm', { show: false, loading: true });

      // show 應該被設置為 true（因為是 open），忽略 updates 中的 show
      expect(modalManager.modals.resetConfirm.show).toBe(true);
      expect(modalManager.modals.resetConfirm.loading).toBe(true);
    });

    it('應該處理不存在的模態框', async () => {
      const { logger } = await import('../../utils/logger.js');

      modalManager.open('nonExistent' as any);

      expect(logger.warn).toHaveBeenCalledWith('Modal "nonExistent" not found');
    });
  });

  // ==========================================
  // 通用方法測試 - close()
  // ==========================================

  describe('close() - 通用關閉方法', () => {
    it('應該關閉指定的模態框', () => {
      modalManager.modals.resetConfirm.show = true;

      modalManager.close('resetConfirm');

      expect(modalManager.modals.resetConfirm.show).toBe(false);
    });

    it('應該自動清除 loading 狀態', () => {
      modalManager.modals.resetConfirm.show = true;
      modalManager.modals.resetConfirm.loading = true;

      modalManager.close('resetConfirm');

      expect(modalManager.modals.resetConfirm.loading).toBe(false);
    });

    it('應該在 clearData=true 時清除 voiceLimit 的 pending 數據', () => {
      modalManager.modals.voiceLimit.show = true;
      modalManager.modals.voiceLimit.pending = { id: 'msg-1', text: 'Test' } as Message;

      modalManager.close('voiceLimit', true);

      expect(modalManager.modals.voiceLimit.show).toBe(false);
      expect(modalManager.modals.voiceLimit.pending).toBeNull();
    });

    it('應該在 clearData=true 時清除 photoSelector 的數據', () => {
      modalManager.modals.photoSelector.show = true;
      modalManager.modals.photoSelector.selectedUrl = 'https://example.com/photo.jpg';
      modalManager.modals.photoSelector.useCard = true;
      modalManager.modals.photoSelector.forGift = true;
      modalManager.modals.photoSelector.pendingGift = { id: 'gift-1' };

      modalManager.close('photoSelector', true);

      expect(modalManager.modals.photoSelector.show).toBe(false);
      expect(modalManager.modals.photoSelector.selectedUrl).toBeNull();
      expect(modalManager.modals.photoSelector.useCard).toBe(false);
      expect(modalManager.modals.photoSelector.forGift).toBe(false);
      expect(modalManager.modals.photoSelector.pendingGift).toBeNull();
    });

    it('應該在 clearData=true 時清除 imageViewer 的數據', () => {
      modalManager.modals.imageViewer.show = true;
      modalManager.modals.imageViewer.url = 'https://example.com/image.jpg';
      modalManager.modals.imageViewer.alt = '測試圖片';

      modalManager.close('imageViewer', true);

      expect(modalManager.modals.imageViewer.url).toBe('');
      expect(modalManager.modals.imageViewer.alt).toBe('');
    });

    it('應該在 clearData=true 時清除 potionConfirm 的 type', () => {
      modalManager.modals.potionConfirm.show = true;
      modalManager.modals.potionConfirm.type = 'memoryBoost';

      modalManager.close('potionConfirm', true);

      expect(modalManager.modals.potionConfirm.type).toBe('');
    });
  });

  // ==========================================
  // 通用方法測試 - update()
  // ==========================================

  describe('update() - 更新數據方法', () => {
    it('應該更新模態框數據但不改變 show 狀態', () => {
      modalManager.modals.resetConfirm.show = false;

      modalManager.update('resetConfirm', { loading: true });

      expect(modalManager.modals.resetConfirm.show).toBe(false);
      expect(modalManager.modals.resetConfirm.loading).toBe(true);
    });

    it('應該忽略更新中的 show 屬性', () => {
      modalManager.modals.resetConfirm.show = false;

      modalManager.update('resetConfirm', { show: true, loading: true });

      expect(modalManager.modals.resetConfirm.show).toBe(false);
      expect(modalManager.modals.resetConfirm.loading).toBe(true);
    });

    it('應該更新嵌套的 data 對象', () => {
      modalManager.update('conversationLimit', {
        characterName: '新角色',
        remainingMessages: 10,
      });

      expect(modalManager.modals.conversationLimit.data.characterName).toBe('新角色');
      expect(modalManager.modals.conversationLimit.data.remainingMessages).toBe(10);
    });
  });

  // ==========================================
  // 通用方法測試 - setLoading()
  // ==========================================

  describe('setLoading() - 設置 loading 狀態', () => {
    it('應該設置 loading 狀態', () => {
      modalManager.setLoading('resetConfirm', true);

      expect(modalManager.modals.resetConfirm.loading).toBe(true);
    });

    it('應該處理沒有 loading 屬性的模態框', () => {
      modalManager.setLoading('characterInfo', true);

      // 不應拋出錯誤，但也不應添加 loading 屬性
      expect((modalManager.modals.characterInfo as any).loading).toBeUndefined();
    });
  });

  // ==========================================
  // 便捷方法測試 - 限制類
  // ==========================================

  describe('便捷方法 - 限制類', () => {
    it('showConversationLimit 應該打開對話限制彈窗', () => {
      const data: Partial<ConversationLimitData> = {
        characterName: '測試角色',
        remainingMessages: 3,
      };

      modalManager.showConversationLimit(data);

      expect(modalManager.modals.conversationLimit.show).toBe(true);
      expect(modalManager.modals.conversationLimit.data.characterName).toBe('測試角色');
      expect(modalManager.modals.conversationLimit.data.remainingMessages).toBe(3);
    });

    it('showVoiceLimit 應該打開語音限制彈窗並設置 pending 消息', () => {
      const data: Partial<VoiceLimitData> = {
        characterName: '測試角色',
        usedVoices: 8,
        totalVoices: 10,
      };
      const pendingMessage: Message = { id: 'msg-1', role: 'user', text: 'Test' } as Message;

      modalManager.showVoiceLimit(data, pendingMessage);

      expect(modalManager.modals.voiceLimit.show).toBe(true);
      expect(modalManager.modals.voiceLimit.data.characterName).toBe('測試角色');
      expect(modalManager.modals.voiceLimit.pending).toStrictEqual(pendingMessage);
    });

    it('showPhotoLimit 應該打開照片限制彈窗', () => {
      const data: Partial<PhotoVideoLimitData> = {
        used: 5,
        remaining: 0,
        total: 5,
      };

      modalManager.showPhotoLimit(data);

      expect(modalManager.modals.photoLimit.show).toBe(true);
      expect(modalManager.modals.photoLimit.data.used).toBe(5);
    });

    it('showPotionLimit 應該打開藥水限制彈窗', () => {
      modalManager.showPotionLimit('memoryBoost');

      expect(modalManager.modals.potionLimit.show).toBe(true);
      expect(modalManager.modals.potionLimit.type).toBe('memoryBoost');
    });

    it('closeVoiceLimit 應該關閉並清空數據', () => {
      modalManager.modals.voiceLimit.show = true;
      modalManager.modals.voiceLimit.pending = { id: 'msg-1' } as Message;

      modalManager.closeVoiceLimit();

      expect(modalManager.modals.voiceLimit.show).toBe(false);
      expect(modalManager.modals.voiceLimit.pending).toBeNull();
    });
  });

  // ==========================================
  // 便捷方法測試 - 確認類
  // ==========================================

  describe('便捷方法 - 確認類', () => {
    it('showResetConfirm 應該打開重置確認彈窗', () => {
      modalManager.showResetConfirm();

      expect(modalManager.modals.resetConfirm.show).toBe(true);
    });

    it('showPotionConfirm 應該打開藥水確認彈窗', () => {
      modalManager.showPotionConfirm('brainBoost');

      expect(modalManager.modals.potionConfirm.show).toBe(true);
      expect(modalManager.modals.potionConfirm.type).toBe('brainBoost');
    });

    it('closePotionConfirm 應該關閉並清空 type', () => {
      modalManager.modals.potionConfirm.show = true;
      modalManager.modals.potionConfirm.type = 'memoryBoost';

      modalManager.closePotionConfirm();

      expect(modalManager.modals.potionConfirm.show).toBe(false);
      expect(modalManager.modals.potionConfirm.type).toBe('');
    });
  });

  // ==========================================
  // 便捷方法測試 - 選擇器類
  // ==========================================

  describe('便捷方法 - 選擇器類', () => {
    it('showPhotoSelector 應該以影片模式打開（向後兼容）', () => {
      modalManager.showPhotoSelector(true);

      expect(modalManager.modals.photoSelector.show).toBe(true);
      expect(modalManager.modals.photoSelector.useCard).toBe(true);
      expect(modalManager.modals.photoSelector.forGift).toBe(false);
      expect(modalManager.modals.photoSelector.pendingGift).toBeNull();
    });

    it('showPhotoSelector 應該以禮物模式打開', () => {
      const pendingGift = { id: 'gift-1', name: '玫瑰' };

      modalManager.showPhotoSelector(false, pendingGift);

      expect(modalManager.modals.photoSelector.show).toBe(true);
      expect(modalManager.modals.photoSelector.forGift).toBe(true);
      expect(modalManager.modals.photoSelector.pendingGift).toStrictEqual(pendingGift);
      expect(modalManager.modals.photoSelector.useCard).toBe(false);
    });

    it('closePhotoSelector 應該關閉並清空所有數據', () => {
      modalManager.modals.photoSelector.show = true;
      modalManager.modals.photoSelector.selectedUrl = 'https://example.com/photo.jpg';
      modalManager.modals.photoSelector.useCard = true;
      modalManager.modals.photoSelector.forGift = true;

      modalManager.closePhotoSelector();

      expect(modalManager.modals.photoSelector.show).toBe(false);
      expect(modalManager.modals.photoSelector.selectedUrl).toBeNull();
      expect(modalManager.modals.photoSelector.useCard).toBe(false);
      expect(modalManager.modals.photoSelector.forGift).toBe(false);
    });
  });

  // ==========================================
  // 便捷方法測試 - 查看器類
  // ==========================================

  describe('便捷方法 - 查看器類', () => {
    it('showImageViewer 應該打開圖片查看器', () => {
      modalManager.showImageViewer('https://example.com/image.jpg', '測試圖片');

      expect(modalManager.modals.imageViewer.show).toBe(true);
      expect(modalManager.modals.imageViewer.url).toBe('https://example.com/image.jpg');
      expect(modalManager.modals.imageViewer.alt).toBe('測試圖片');
    });

    it('showBuffDetails 應該打開 Buff 詳情', () => {
      modalManager.showBuffDetails('memory');

      expect(modalManager.modals.buffDetails.show).toBe(true);
      expect(modalManager.modals.buffDetails.type).toBe('memory');
    });

    it('closeImageViewer 應該關閉並清空數據', () => {
      modalManager.modals.imageViewer.show = true;
      modalManager.modals.imageViewer.url = 'https://example.com/image.jpg';

      modalManager.closeImageViewer();

      expect(modalManager.modals.imageViewer.show).toBe(false);
      expect(modalManager.modals.imageViewer.url).toBe('');
    });
  });

  // ==========================================
  // 便捷方法測試 - 動畫類
  // ==========================================

  describe('便捷方法 - 動畫類', () => {
    it('showGiftAnimation 應該打開禮物動畫', () => {
      modalManager.showGiftAnimation('🌹', '玫瑰');

      expect(modalManager.modals.giftAnimation.show).toBe(true);
      expect(modalManager.modals.giftAnimation.emoji).toBe('🌹');
      expect(modalManager.modals.giftAnimation.name).toBe('玫瑰');
    });

    it('showComboAnimation 應該打開連擊動畫', () => {
      modalManager.showComboAnimation(5, 2.5, 'fire');

      expect(modalManager.modals.comboAnimation.show).toBe(true);
      expect(modalManager.modals.comboAnimation.comboCount).toBe(5);
      expect(modalManager.modals.comboAnimation.multiplier).toBe(2.5);
      expect(modalManager.modals.comboAnimation.effect).toBe('fire');
    });

    it('showLevelUpAnimation 應該打開升級動畫', () => {
      modalManager.showLevelUpAnimation(3, 4, '銀牌', 'silver');

      expect(modalManager.modals.levelUpAnimation.show).toBe(true);
      expect(modalManager.modals.levelUpAnimation.previousLevel).toBe(3);
      expect(modalManager.modals.levelUpAnimation.newLevel).toBe(4);
      expect(modalManager.modals.levelUpAnimation.badgeName).toBe('銀牌');
      expect(modalManager.modals.levelUpAnimation.badgeColor).toBe('silver');
    });
  });

  // ==========================================
  // Computed 屬性測試
  // ==========================================

  describe('Computed 屬性', () => {
    it('hasOpenModal 應該在沒有模態框打開時返回 false', async () => {
      await nextTick();
      expect(modalManager.hasOpenModal.value).toBe(false);
    });

    it('hasOpenModal 應該在有模態框打開時返回 true', async () => {
      modalManager.showResetConfirm();
      await nextTick();

      expect(modalManager.hasOpenModal.value).toBe(true);
    });

    it('hasOpenModal 應該在所有模態框關閉時返回 false', async () => {
      modalManager.showResetConfirm();
      modalManager.showImageViewer('test.jpg');
      await nextTick();

      expect(modalManager.hasOpenModal.value).toBe(true);

      modalManager.closeResetConfirm();
      modalManager.closeImageViewer();
      await nextTick();

      expect(modalManager.hasOpenModal.value).toBe(false);
    });

    it('hasLoadingAction 應該在沒有 loading 時返回 false', async () => {
      await nextTick();
      expect(modalManager.hasLoadingAction.value).toBe(false);
    });

    it('hasLoadingAction 應該在有確認操作 loading 時返回 true', async () => {
      modalManager.setLoading('resetConfirm', true);
      await nextTick();

      expect(modalManager.hasLoadingAction.value).toBe(true);
    });

    it('hasLoadingAction 應該檢測所有確認類模態框的 loading', async () => {
      modalManager.setLoading('potionConfirm', true);
      await nextTick();

      expect(modalManager.hasLoadingAction.value).toBe(true);

      modalManager.setLoading('potionConfirm', false);
      modalManager.setLoading('unlockConfirm', true);
      await nextTick();

      expect(modalManager.hasLoadingAction.value).toBe(true);
    });
  });

  // ==========================================
  // API 暴露測試
  // ==========================================

  describe('API 暴露', () => {
    it('應該返回所有必需的屬性和方法', () => {
      expect(modalManager).toHaveProperty('modals');
      expect(modalManager).toHaveProperty('open');
      expect(modalManager).toHaveProperty('close');
      expect(modalManager).toHaveProperty('update');
      expect(modalManager).toHaveProperty('setLoading');
      expect(modalManager).toHaveProperty('hasOpenModal');
      expect(modalManager).toHaveProperty('hasLoadingAction');

      expect(typeof modalManager.open).toBe('function');
      expect(typeof modalManager.close).toBe('function');
      expect(typeof modalManager.update).toBe('function');
      expect(typeof modalManager.setLoading).toBe('function');
    });

    it('應該返回所有便捷方法', () => {
      // 限制類
      expect(typeof modalManager.showConversationLimit).toBe('function');
      expect(typeof modalManager.showVoiceLimit).toBe('function');
      expect(typeof modalManager.showPhotoLimit).toBe('function');

      // 確認類
      expect(typeof modalManager.showResetConfirm).toBe('function');
      expect(typeof modalManager.showPotionConfirm).toBe('function');

      // 選擇器類
      expect(typeof modalManager.showPhotoSelector).toBe('function');

      // 查看器類
      expect(typeof modalManager.showImageViewer).toBe('function');
      expect(typeof modalManager.showBuffDetails).toBe('function');

      // 動畫類
      expect(typeof modalManager.showGiftAnimation).toBe('function');
      expect(typeof modalManager.showComboAnimation).toBe('function');
    });
  });
});
