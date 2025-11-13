/**
 * 測試工具函數
 * 提供常用的測試輔助功能
 */

import { nextTick } from 'vue';
import { vi } from 'vitest';

/**
 * 等待所有 Promise 完成
 */
export const flushPromises = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};

/**
 * 等待 Vue 的下一次更新
 */
export const waitForNextTick = async () => {
  await nextTick();
  await flushPromises();
};

/**
 * 創建一個模擬的 API 響應
 */
export const createMockApiResponse = (data, options = {}) => {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    headers = {},
  } = options;

  return {
    ok,
    status,
    statusText,
    headers: new Headers(headers),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(data)])),
  };
};

/**
 * 創建一個模擬的 API 錯誤響應
 */
export const createMockApiError = (message = 'API Error', status = 500) => {
  return {
    ok: false,
    status,
    statusText: 'Error',
    headers: new Headers(),
    json: () => Promise.resolve({ error: message }),
    text: () => Promise.resolve(JSON.stringify({ error: message })),
  };
};

/**
 * Mock fetch 成功響應
 */
export const mockFetchSuccess = (data) => {
  global.fetch = vi.fn(() =>
    Promise.resolve(createMockApiResponse(data))
  );
};

/**
 * Mock fetch 錯誤響應
 */
export const mockFetchError = (message = 'Network Error', status = 500) => {
  global.fetch = vi.fn(() =>
    Promise.resolve(createMockApiError(message, status))
  );
};

/**
 * Mock fetch 網絡失敗
 */
export const mockFetchNetworkError = () => {
  global.fetch = vi.fn(() =>
    Promise.reject(new Error('Network request failed'))
  );
};

/**
 * 創建一個模擬的 Firebase Timestamp
 */
export const createMockTimestamp = (date = new Date()) => ({
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
  toDate: () => date,
  toMillis: () => date.getTime(),
});

/**
 * 模擬延遲（用於測試加載狀態）
 */
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 創建一個帶有延遲的 Promise
 */
export const createDelayedPromise = (value, delayMs = 100) => {
  return delay(delayMs).then(() => value);
};

/**
 * 等待條件為 true（帶超時）
 */
export const waitFor = async (condition, timeout = 1000) => {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('waitFor timeout');
    }
    await delay(10);
  }
};

/**
 * 創建一個模擬的 ref 對象
 */
export const createMockRef = (value) => ({
  value,
});

/**
 * 創建一個模擬的 reactive 對象
 */
export const createMockReactive = (obj) => ({
  ...obj,
});

/**
 * 斷言 Promise 被拒絕
 */
export const expectToReject = async (promise, errorMessage) => {
  let error;
  try {
    await promise;
  } catch (e) {
    error = e;
  }

  if (!error) {
    throw new Error('Expected promise to reject, but it resolved');
  }

  if (errorMessage && !error.message.includes(errorMessage)) {
    throw new Error(
      `Expected error message to include "${errorMessage}", but got "${error.message}"`
    );
  }

  return error;
};

/**
 * 創建一個模擬的 localStorage
 */
export const createMockLocalStorage = () => {
  let store = {};

  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get store() {
      return { ...store };
    },
  };
};

/**
 * 模擬 console 方法（用於測試日誌）
 */
export const mockConsole = () => {
  const originalConsole = { ...console };

  const mocks = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  Object.keys(mocks).forEach((method) => {
    console[method] = mocks[method];
  });

  return {
    mocks,
    restore: () => {
      Object.keys(originalConsole).forEach((method) => {
        console[method] = originalConsole[method];
      });
    },
  };
};
