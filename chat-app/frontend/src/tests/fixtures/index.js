/**
 * 測試 Fixtures 統一導出
 */

// 用戶相關數據
export {
  mockFirebaseUser,
  mockUserProfile,
  mockVIPUserProfile,
  mockVVIPUserProfile,
  mockGuestUser,
  mockUserAssets,
  mockMembershipTiers,
  createMockUserProfile,
  createMockFirebaseUser,
} from './userData.js';

// 角色相關數據
export {
  mockFreeCharacter,
  mockLockedCharacter,
  mockUnlockedCharacter,
  mockCharacterList,
  mockFavoriteCharacters,
  createMockCharacter,
} from './characterData.js';

// 對話相關數據
export {
  mockUserMessage,
  mockAIMessage,
  mockMessageList,
  mockConversationSummary,
  mockConversationList,
  mockSuggestions,
  mockConversationLimit,
  mockVoiceLimit,
  mockPhotoLimit,
  mockGeneratedPhoto,
  createMockMessage,
  createMockConversation,
} from './conversationData.js';
