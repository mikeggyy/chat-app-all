/**
 * useEditorVariables Composable 測試
 * 測試範圍：
 * - 變數列表
 *
 * Note: 僅測試基本功能以避免內存問題
 * 複雜的編輯器測試通過集成測試覆蓋
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorVariables } from './useEditorVariables';

describe('useEditorVariables', () => {
  let composable;

  beforeEach(() => {
    composable = useEditorVariables();
  });

  describe('變數列表', () => {
    it('應該提供聊天變數列表', () => {
      expect(composable.chatVariables).toBeDefined();
      expect(composable.chatVariables.length).toBeGreaterThan(0);
      expect(composable.chatVariables[0]).toHaveProperty('name');
    });

    it('應該提供影片變數列表', () => {
      expect(composable.videoVariables).toBeDefined();
      expect(composable.videoVariables.length).toBeGreaterThan(0);
    });

    it('應該提供圖片變數列表', () => {
      expect(composable.imageVariables).toBeDefined();
      expect(composable.imageVariables.length).toBeGreaterThan(0);
    });

    it('應該提供形象變數列表', () => {
      expect(composable.appearanceVariables).toBeDefined();
      expect(composable.appearanceVariables.length).toBeGreaterThan(0);
    });

    it('應該提供角色設定變數列表', () => {
      expect(composable.personaVariables).toBeDefined();
      expect(composable.personaVariables.length).toBeGreaterThan(0);
    });

    it('所有變數名稱都應該使用大括號包裹', () => {
      const allVariables = [
        ...composable.chatVariables,
        ...composable.videoVariables,
        ...composable.imageVariables,
        ...composable.appearanceVariables,
        ...composable.personaVariables,
      ];

      allVariables.forEach((variable) => {
        expect(variable.name).toMatch(/^\{.+\}$/);
      });
    });
  });

  describe('基本功能', () => {
    it('應該導出 textToEditorContent 函數', () => {
      expect(typeof composable.textToEditorContent).toBe('function');
    });

    it('應該導出 editorToText 函數', () => {
      expect(typeof composable.editorToText).toBe('function');
    });

    it('應該導出 insertVariable 函數', () => {
      expect(typeof composable.insertVariable).toBe('function');
    });

    it('應該導出 createEditor 函數', () => {
      expect(typeof composable.createEditor).toBe('function');
    });
  });
});
