/**
 * Vitest 測試環境設置文件
 * 在所有測試之前運行，用於配置全局測試環境
 */

import { vi } from 'vitest';
import { config } from '@vue/test-utils';

// ===========================
// 1. Mock Firebase
// ===========================

// Mock Firebase Auth
const mockAuth = {
  currentUser: null,
  onAuthStateChanged: vi.fn((callback) => {
    callback(mockAuth.currentUser);
    return vi.fn(); // unsubscribe function
  }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
};

// Mock Firestore
const mockFirestore = {
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      onSnapshot: vi.fn(),
    })),
    where: vi.fn(() => ({
      get: vi.fn(),
      onSnapshot: vi.fn(),
    })),
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn(),
      })),
    })),
    add: vi.fn(),
    get: vi.fn(),
  })),
  doc: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
};

// Mock Firebase Storage
const mockStorage = {
  ref: vi.fn(() => ({
    put: vi.fn(),
    getDownloadURL: vi.fn(),
  })),
};

// 全局 Mock Firebase 模塊
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => mockAuth),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => mockFirestore),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ seconds: Date.now() / 1000 })),
    fromDate: vi.fn((date) => ({ seconds: date.getTime() / 1000 })),
  },
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => mockStorage),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

// ===========================
// 2. Mock Vue Router
// ===========================

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  currentRoute: {
    value: {
      path: '/',
      params: {},
      query: {},
    },
  },
};

const mockRoute = {
  path: '/',
  params: {},
  query: {},
  meta: {},
};

// 配置 Vue Test Utils 全局屬性
config.global.mocks = {
  $router: mockRouter,
  $route: mockRoute,
};

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRoute,
  createRouter: vi.fn(),
  createWebHistory: vi.fn(),
}));

// ===========================
// 3. Mock LocalStorage
// ===========================

const localStorageMock = (() => {
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
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// ===========================
// 4. Mock API Fetch
// ===========================

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// ===========================
// 5. Mock Console (減少測試輸出噪音)
// ===========================

// 在測試中靜默 console.warn 和 console.error（可選）
// global.console = {
//   ...console,
//   warn: vi.fn(),
//   error: vi.fn(),
// };

// ===========================
// 6. 測試工具函數
// ===========================

/**
 * 創建一個模擬的 Firebase 用戶對象
 */
export const createMockUser = (overrides = {}) => ({
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  emailVerified: true,
  ...overrides,
});

/**
 * 設置模擬的已登入用戶
 */
export const setMockAuthUser = (user) => {
  mockAuth.currentUser = user;
};

/**
 * 清除模擬的登入用戶
 */
export const clearMockAuthUser = () => {
  mockAuth.currentUser = null;
};

/**
 * 等待 Vue 的下一次更新
 */
export const flushPromises = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};

// ===========================
// 7. 測試環境變數
// ===========================

// 設置測試環境變數
process.env.NODE_ENV = 'test';
process.env.VITE_API_URL = 'http://localhost:4000';
process.env.VITE_FIREBASE_PROJECT_ID = 'test-project';

// ===========================
// 8. 全局測試 Hooks
// ===========================

// 每個測試前重置所有 mocks
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  clearMockAuthUser();
});

// 每個測試後清理
afterEach(() => {
  vi.restoreAllMocks();
});

console.log('✅ Vitest 測試環境設置完成');
