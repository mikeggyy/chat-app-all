/**
 * useAISettings Composable 測試
 * 測試範圍：
 * - AI 設定載入
 * - AI 設定保存
 * - AI 設定重置
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { useAISettings } from './useAISettings';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../utils/api';

describe('useAISettings', () => {
  let composable;

  beforeEach(() => {
    vi.clearAllMocks();
    composable = useAISettings();
  });

  describe('初始狀態', () => {
    it('應該有正確的初始狀態', () => {
      expect(composable.loading.value).toBe(false);
      expect(composable.saving.value).toBe(false);
      expect(composable.saved.value).toBe(false);
    });

    it('應該有預設的 settings', () => {
      expect(composable.settings.chat).toBeDefined();
      expect(composable.settings.chat.model).toBe('gpt-4o-mini');
      expect(composable.settings.tts).toBeDefined();
      expect(composable.settings.imageGeneration).toBeDefined();
      expect(composable.settings.videoGeneration).toBeDefined();
    });

    it('應該有所有必要的 AI 設定類別', () => {
      expect(composable.settings).toHaveProperty('chat');
      expect(composable.settings).toHaveProperty('tts');
      expect(composable.settings).toHaveProperty('imageGeneration');
      expect(composable.settings).toHaveProperty('videoGeneration');
      expect(composable.settings).toHaveProperty('characterPersona');
      expect(composable.settings).toHaveProperty('characterImage');
      expect(composable.settings).toHaveProperty('characterAppearance');
    });
  });

  describe('loadSettings', () => {
    it('應該成功載入設定', async () => {
      const mockSettings = {
        chat: { model: 'gpt-4o', temperature: 0.8 },
        tts: { defaultVoice: 'shimmer' },
      };

      api.get.mockResolvedValue({
        success: true,
        settings: mockSettings,
      });

      await composable.loadSettings();

      expect(api.get).toHaveBeenCalledWith('/api/ai-settings');
      expect(composable.settings.chat.model).toBe('gpt-4o');
      expect(composable.settings.chat.temperature).toBe(0.8);
      expect(composable.settings.tts.defaultVoice).toBe('shimmer');
      expect(ElMessage.success).toHaveBeenCalledWith('設定載入成功');
    });

    it('應該設置 loading 狀態', async () => {
      api.get.mockImplementation(() => {
        expect(composable.loading.value).toBe(true);
        return Promise.resolve({ success: true, settings: {} });
      });

      await composable.loadSettings();

      expect(composable.loading.value).toBe(false);
    });

    it('應該處理載入失敗', async () => {
      api.get.mockRejectedValue(new Error('Network error'));

      await composable.loadSettings();

      expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('載入設定失敗'));
      expect(composable.loading.value).toBe(false);
    });

    it('應該處理無效的響應格式', async () => {
      api.get.mockResolvedValue({ success: true, settings: null });

      await composable.loadSettings();

      expect(ElMessage.warning).toHaveBeenCalledWith('設定載入失敗：無效的響應格式');
    });

    it('應該只更新存在的設定', async () => {
      const originalModel = composable.settings.chat.model;

      api.get.mockResolvedValue({
        success: true,
        settings: {
          nonExistentKey: { value: 'should not merge' },
          chat: { temperature: 0.9 },
        },
      });

      await composable.loadSettings();

      expect(composable.settings.chat.model).toBe(originalModel);
      expect(composable.settings.chat.temperature).toBe(0.9);
      expect(composable.settings).not.toHaveProperty('nonExistentKey');
    });
  });

  describe('saveSettings', () => {
    it('應該成功保存設定', async () => {
      api.put.mockResolvedValue({ success: true });

      await composable.saveSettings();

      expect(api.put).toHaveBeenCalledWith('/api/ai-settings', composable.settings);
      expect(ElMessage.success).toHaveBeenCalledWith('設定已保存');
      expect(composable.saved.value).toBe(true);
    });

    it('應該設置 saving 狀態', async () => {
      api.put.mockImplementation(() => {
        expect(composable.saving.value).toBe(true);
        return Promise.resolve({ success: true });
      });

      await composable.saveSettings();

      expect(composable.saving.value).toBe(false);
    });

    it('應該在 3 秒後重置 saved 狀態', async () => {
      vi.useFakeTimers();
      api.put.mockResolvedValue({ success: true });

      await composable.saveSettings();

      expect(composable.saved.value).toBe(true);

      vi.advanceTimersByTime(3000);

      expect(composable.saved.value).toBe(false);

      vi.useRealTimers();
    });

    it('應該處理保存失敗', async () => {
      api.put.mockRejectedValue(new Error('Save failed'));

      await composable.saveSettings();

      expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('保存設定失敗'));
      expect(composable.saving.value).toBe(false);
      expect(composable.saved.value).toBe(false);
    });

    it('應該在保存開始時重置 saved 狀態', async () => {
      composable.saved.value = true;
      api.put.mockResolvedValue({ success: true });

      const savePromise = composable.saveSettings();

      expect(composable.saved.value).toBe(false);

      await savePromise;
    });
  });

  describe('resetSettings', () => {
    it('應該成功重置設定', async () => {
      const mockResetSettings = {
        chat: { model: 'gpt-4o-mini', temperature: 0.7 },
        tts: { defaultVoice: 'nova' },
      };

      ElMessageBox.confirm.mockResolvedValue('confirm');
      api.post.mockResolvedValue({
        success: true,
        settings: mockResetSettings,
      });

      await composable.resetSettings();

      expect(ElMessageBox.confirm).toHaveBeenCalledWith(
        expect.stringContaining('確定要重置'),
        '重置確認',
        expect.any(Object)
      );
      expect(api.post).toHaveBeenCalledWith('/api/ai-settings/reset');
      expect(composable.settings.chat.model).toBe('gpt-4o-mini');
      expect(ElMessage.success).toHaveBeenCalledWith('已重置為預設值');
    });

    it('應該設置 loading 狀態', async () => {
      ElMessageBox.confirm.mockResolvedValue('confirm');
      api.post.mockImplementation(() => {
        expect(composable.loading.value).toBe(true);
        return Promise.resolve({ success: true, settings: {} });
      });

      await composable.resetSettings();

      expect(composable.loading.value).toBe(false);
    });

    it('應該處理用戶取消', async () => {
      ElMessageBox.confirm.mockRejectedValue('cancel');

      await composable.resetSettings();

      expect(api.post).not.toHaveBeenCalled();
      expect(ElMessage.error).not.toHaveBeenCalled();
    });

    it('應該處理重置失敗', async () => {
      ElMessageBox.confirm.mockResolvedValue('confirm');
      api.post.mockRejectedValue(new Error('Reset failed'));

      await composable.resetSettings();

      expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('重置失敗'));
      expect(composable.loading.value).toBe(false);
    });

    it('應該處理無效的重置響應', async () => {
      ElMessageBox.confirm.mockResolvedValue('confirm');
      api.post.mockResolvedValue({ success: true, settings: null });

      await composable.resetSettings();

      expect(ElMessage.warning).toHaveBeenCalledWith('重置失敗：無效的響應格式');
    });
  });

  describe('響應式狀態', () => {
    it('loading 應該是響應式的', async () => {
      api.get.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({ success: true, settings: {} }), 100);
      }));

      const promise = composable.loadSettings();
      await nextTick();

      expect(composable.loading.value).toBe(true);

      await promise;

      expect(composable.loading.value).toBe(false);
    });

    it('saving 應該是響應式的', async () => {
      api.put.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({ success: true }), 100);
      }));

      const promise = composable.saveSettings();
      await nextTick();

      expect(composable.saving.value).toBe(true);

      await promise;

      expect(composable.saving.value).toBe(false);
    });
  });
});
