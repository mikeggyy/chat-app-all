/**
 * 測試數據 - 對話相關
 */

import { createMockTimestamp } from '../utils/testHelpers.js';

/**
 * 模擬的對話訊息（用戶發送）
 */
export const mockUserMessage = {
  id: 'msg-user-001',
  senderId: 'test-user-123',
  senderType: 'user',
  content: '你好，很高興認識你！',
  timestamp: createMockTimestamp(new Date('2025-01-13T10:00:00')),
  isRead: true,
};

/**
 * 模擬的對話訊息（AI 回覆）
 */
export const mockAIMessage = {
  id: 'msg-ai-001',
  senderId: 'char-free-001',
  senderType: 'character',
  content: '你好！我也很高興認識你，有什麼我可以幫忙的嗎？',
  timestamp: createMockTimestamp(new Date('2025-01-13T10:00:05')),
  isRead: true,
  metadata: {
    model: 'gpt-4o-mini',
    tokens: 25,
  },
};

/**
 * 模擬的對話訊息列表
 */
export const mockMessageList = [
  {
    id: 'msg-001',
    senderId: 'test-user-123',
    senderType: 'user',
    content: '嗨！',
    timestamp: createMockTimestamp(new Date('2025-01-13T09:00:00')),
    isRead: true,
  },
  {
    id: 'msg-002',
    senderId: 'char-free-001',
    senderType: 'character',
    content: '你好！很高興見到你！',
    timestamp: createMockTimestamp(new Date('2025-01-13T09:00:02')),
    isRead: true,
  },
  {
    id: 'msg-003',
    senderId: 'test-user-123',
    senderType: 'user',
    content: '今天天氣真好',
    timestamp: createMockTimestamp(new Date('2025-01-13T09:05:00')),
    isRead: true,
  },
  {
    id: 'msg-004',
    senderId: 'char-free-001',
    senderType: 'character',
    content: '是的，今天是個美好的一天！你有什麼計劃嗎？',
    timestamp: createMockTimestamp(new Date('2025-01-13T09:05:05')),
    isRead: true,
  },
];

/**
 * 模擬的對話摘要（對話列表）
 */
export const mockConversationSummary = {
  id: 'conv-001',
  userId: 'test-user-123',
  characterId: 'char-free-001',
  characterName: '艾莉絲',
  characterAvatar: 'https://example.com/alice.jpg',
  lastMessage: '是的，今天是個美好的一天！你有什麼計劃嗎？',
  lastMessageTime: createMockTimestamp(new Date('2025-01-13T09:05:05')),
  unreadCount: 0,
  totalMessages: 4,
  createdAt: createMockTimestamp(new Date('2025-01-13T09:00:00')),
  updatedAt: createMockTimestamp(new Date('2025-01-13T09:05:05')),
};

/**
 * 模擬的對話列表
 */
export const mockConversationList = [
  mockConversationSummary,
  {
    id: 'conv-002',
    userId: 'test-user-123',
    characterId: 'char-free-002',
    characterName: '傑克',
    characterAvatar: 'https://example.com/jack.jpg',
    lastMessage: '聽起來很棒！',
    lastMessageTime: createMockTimestamp(new Date('2025-01-12T15:30:00')),
    unreadCount: 2,
    totalMessages: 15,
    createdAt: createMockTimestamp(new Date('2025-01-12T10:00:00')),
    updatedAt: createMockTimestamp(new Date('2025-01-12T15:30:00')),
  },
  {
    id: 'conv-003',
    userId: 'test-user-123',
    characterId: 'char-unlocked-001',
    characterName: '索菲亞',
    characterAvatar: 'https://example.com/sophia.jpg',
    lastMessage: '晚安，做個好夢！',
    lastMessageTime: createMockTimestamp(new Date('2025-01-11T22:00:00')),
    unreadCount: 0,
    totalMessages: 30,
    createdAt: createMockTimestamp(new Date('2025-01-10T08:00:00')),
    updatedAt: createMockTimestamp(new Date('2025-01-11T22:00:00')),
  },
];

/**
 * 模擬的快速回覆建議
 */
export const mockSuggestions = [
  '告訴我更多',
  '聽起來很有趣！',
  '你覺得呢？',
];

/**
 * 模擬的對話限制資訊
 */
export const mockConversationLimit = {
  userId: 'test-user-123',
  characterId: 'char-free-001',
  count: 5,
  limit: 10,
  resetDate: createMockTimestamp(new Date('2025-01-14T00:00:00')),
  remainingCount: 5,
};

/**
 * 模擬的語音限制資訊
 */
export const mockVoiceLimit = {
  userId: 'test-user-123',
  characterId: 'char-free-001',
  count: 3,
  limit: 5,
  resetDate: createMockTimestamp(new Date('2025-01-14T00:00:00')),
  remainingCount: 2,
};

/**
 * 模擬的照片限制資訊
 */
export const mockPhotoLimit = {
  userId: 'test-user-123',
  count: 1,
  limit: 2,
  resetDate: createMockTimestamp(new Date('2025-02-01T00:00:00')),
  remainingCount: 1,
};

/**
 * 模擬的 AI 生成的自拍照片
 */
export const mockGeneratedPhoto = {
  id: 'photo-001',
  userId: 'test-user-123',
  characterId: 'char-free-001',
  imageUrl: 'https://example.com/generated-photo.webp',
  prompt: '在海邊的自拍照',
  createdAt: createMockTimestamp(new Date('2025-01-13T10:30:00')),
  metadata: {
    model: 'gemini-2.5-flash',
    compressed: true,
    originalSize: 1024000, // 1MB
    compressedSize: 150000, // 150KB
  },
};

/**
 * 創建自定義訊息
 */
export const createMockMessage = (overrides = {}) => ({
  ...mockUserMessage,
  ...overrides,
  id: overrides.id || `msg-${Date.now()}`,
  timestamp: overrides.timestamp || createMockTimestamp(),
});

/**
 * 創建自定義對話摘要
 */
export const createMockConversation = (overrides = {}) => ({
  ...mockConversationSummary,
  ...overrides,
  id: overrides.id || `conv-${Date.now()}`,
});
