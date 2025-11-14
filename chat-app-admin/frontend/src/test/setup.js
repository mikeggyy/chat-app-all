/**
 * Vitest 測試設置文件
 * 配置全局測試環境和 Mock
 */

import { vi } from 'vitest';

// Mock Element Plus
vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  ElMessageBox: {
    confirm: vi.fn(),
    alert: vi.fn(),
    prompt: vi.fn(),
  },
}));

// Mock Firebase Auth
vi.mock('../utils/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(),
    signOut: vi.fn(),
  },
}));

// Mock API
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Global test utilities
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
};
