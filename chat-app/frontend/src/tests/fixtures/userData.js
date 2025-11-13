/**
 * 測試數據 - 用戶相關
 */

import { createMockTimestamp } from '../utils/testHelpers.js';

/**
 * 模擬的 Firebase 用戶對象
 */
export const mockFirebaseUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/avatar.jpg',
  emailVerified: true,
  phoneNumber: null,
  isAnonymous: false,
  metadata: {
    creationTime: '2024-01-01T00:00:00.000Z',
    lastSignInTime: '2025-01-13T00:00:00.000Z',
  },
  providerData: [
    {
      providerId: 'google.com',
      uid: 'google-123',
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: 'https://example.com/avatar.jpg',
    },
  ],
  getIdToken: () => Promise.resolve('mock-token-123'),
  getIdTokenResult: () =>
    Promise.resolve({
      token: 'mock-token-123',
      claims: {
        user_id: 'test-user-123',
      },
    }),
};

/**
 * 模擬的用戶資料（Firestore userProfiles 集合）
 */
export const mockUserProfile = {
  id: 'test-user-123',
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/avatar.jpg',
  membershipTier: 'free',
  coins: 1000,
  createdAt: createMockTimestamp(new Date('2024-01-01')),
  updatedAt: createMockTimestamp(new Date('2025-01-13')),
  stats: {
    totalConversations: 5,
    totalMessages: 50,
    totalGiftsSent: 3,
  },
  preferences: {
    language: 'zh-TW',
    theme: 'light',
  },
};

/**
 * 模擬的 VIP 用戶資料
 */
export const mockVIPUserProfile = {
  ...mockUserProfile,
  id: 'vip-user-123',
  uid: 'vip-user-123',
  email: 'vip@example.com',
  membershipTier: 'vip',
  coins: 5000,
  membership: {
    tier: 'vip',
    startDate: createMockTimestamp(new Date('2025-01-01')),
    endDate: createMockTimestamp(new Date('2025-02-01')),
    isActive: true,
  },
};

/**
 * 模擬的 VVIP 用戶資料
 */
export const mockVVIPUserProfile = {
  ...mockUserProfile,
  id: 'vvip-user-123',
  uid: 'vvip-user-123',
  email: 'vvip@example.com',
  membershipTier: 'vvip',
  coins: 10000,
  membership: {
    tier: 'vvip',
    startDate: createMockTimestamp(new Date('2025-01-01')),
    endDate: createMockTimestamp(new Date('2025-03-01')),
    isActive: true,
  },
};

/**
 * 模擬的訪客用戶
 */
export const mockGuestUser = {
  uid: 'guest-123',
  email: null,
  displayName: 'Guest',
  photoURL: null,
  emailVerified: false,
  phoneNumber: null,
  isAnonymous: true,
  metadata: {
    creationTime: new Date().toISOString(),
    lastSignInTime: new Date().toISOString(),
  },
  providerData: [],
  getIdToken: () => Promise.resolve('guest-token-123'),
  getIdTokenResult: () =>
    Promise.resolve({
      token: 'guest-token-123',
      claims: {
        user_id: 'guest-123',
      },
    }),
};

/**
 * 模擬的用戶資產
 */
export const mockUserAssets = {
  userId: 'test-user-123',
  unlockTickets: 3,
  potions: {
    conversation: 2,
    voice: 1,
    photo: 0,
  },
  unlockedCharacters: ['char-001', 'char-002', 'char-003'],
  updatedAt: createMockTimestamp(),
};

/**
 * 模擬的會員方案
 */
export const mockMembershipTiers = [
  {
    id: 'free',
    name: '免費會員',
    price: 0,
    features: {
      conversationLimit: 10,
      voiceLimit: 5,
      photoLimit: 2,
      canUnlockCharacters: false,
    },
  },
  {
    id: 'vip',
    name: 'VIP 會員',
    price: 299,
    features: {
      conversationLimit: 100,
      voiceLimit: 50,
      photoLimit: 20,
      canUnlockCharacters: true,
      monthlyCoins: 500,
    },
  },
  {
    id: 'vvip',
    name: 'VVIP 會員',
    price: 999,
    features: {
      conversationLimit: -1, // 無限
      voiceLimit: -1,
      photoLimit: -1,
      canUnlockCharacters: true,
      monthlyCoins: 2000,
    },
  },
];

/**
 * 創建自定義用戶資料
 */
export const createMockUserProfile = (overrides = {}) => ({
  ...mockUserProfile,
  ...overrides,
});

/**
 * 創建自定義 Firebase 用戶
 */
export const createMockFirebaseUser = (overrides = {}) => ({
  ...mockFirebaseUser,
  ...overrides,
});
