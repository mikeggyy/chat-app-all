/**
 * 測試數據 - AI 角色相關
 */

import { createMockTimestamp } from '../utils/testHelpers.js';

/**
 * 模擬的 AI 角色（免費）
 */
export const mockFreeCharacter = {
  id: 'char-free-001',
  name: '艾莉絲',
  gender: 'female',
  age: 25,
  personality: ['friendly', 'cheerful', 'helpful'],
  description: '一個友善、開朗的 AI 助手',
  avatar: 'https://example.com/alice.jpg',
  backgroundImage: 'https://example.com/bg-alice.jpg',
  isPremium: false,
  isLocked: false,
  voice: 'shimmer',
  tags: ['friendly', 'assistant'],
  stats: {
    likes: 1500,
    conversations: 5000,
  },
  createdAt: createMockTimestamp(new Date('2024-01-01')),
};

/**
 * 模擬的 AI 角色（需解鎖）
 */
export const mockLockedCharacter = {
  id: 'char-locked-001',
  name: '莉莉安',
  gender: 'female',
  age: 23,
  personality: ['mysterious', 'elegant', 'artistic'],
  description: '一個神秘優雅的藝術家',
  avatar: 'https://example.com/lillian.jpg',
  backgroundImage: 'https://example.com/bg-lillian.jpg',
  isPremium: true,
  isLocked: true,
  unlockPrice: 500, // coins
  voice: 'nova',
  tags: ['mysterious', 'artistic'],
  stats: {
    likes: 3000,
    conversations: 2000,
  },
  createdAt: createMockTimestamp(new Date('2024-02-01')),
};

/**
 * 模擬的 AI 角色（已解鎖）
 */
export const mockUnlockedCharacter = {
  ...mockLockedCharacter,
  id: 'char-unlocked-001',
  name: '索菲亞',
  isLocked: false,
};

/**
 * 模擬的角色列表
 */
export const mockCharacterList = [
  mockFreeCharacter,
  {
    id: 'char-free-002',
    name: '傑克',
    gender: 'male',
    age: 28,
    personality: ['confident', 'adventurous', 'humorous'],
    description: '一個自信幽默的冒險家',
    avatar: 'https://example.com/jack.jpg',
    backgroundImage: 'https://example.com/bg-jack.jpg',
    isPremium: false,
    isLocked: false,
    voice: 'onyx',
    tags: ['adventure', 'humor'],
    stats: {
      likes: 2000,
      conversations: 3500,
    },
    createdAt: createMockTimestamp(new Date('2024-01-15')),
  },
  mockLockedCharacter,
  {
    id: 'char-locked-002',
    name: '維多利亞',
    gender: 'female',
    age: 30,
    personality: ['intelligent', 'sophisticated', 'wise'],
    description: '一個智慧成熟的學者',
    avatar: 'https://example.com/victoria.jpg',
    backgroundImage: 'https://example.com/bg-victoria.jpg',
    isPremium: true,
    isLocked: true,
    unlockPrice: 800,
    voice: 'coral',
    tags: ['wisdom', 'scholar'],
    stats: {
      likes: 2500,
      conversations: 1800,
    },
    createdAt: createMockTimestamp(new Date('2024-03-01')),
  },
];

/**
 * 模擬的用戶收藏列表
 */
export const mockFavoriteCharacters = [
  'char-free-001',
  'char-free-002',
  'char-unlocked-001',
];

/**
 * 創建自定義角色
 */
export const createMockCharacter = (overrides = {}) => ({
  ...mockFreeCharacter,
  ...overrides,
  id: overrides.id || `char-${Date.now()}`,
});
