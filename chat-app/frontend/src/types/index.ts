/**
 * 通用類型定義
 */

import type { Ref, ComputedRef } from 'vue';

// ==================== 用戶相關 ====================

export interface Wallet {
  balance: number;
  currency: string;
  updatedAt: string;
  history?: any[];
}

export interface UserAssets {
  characterUnlockCards: number;
  photoUnlockCards: number;
  videoUnlockCards: number;
  voiceUnlockCards: number;
  createCards: number;
}

export interface User {
  id: string;
  displayName: string;
  locale: string;
  createdAt: string;
  defaultPrompt: string;
  email: string;
  photoURL: string;
  lastLoginAt: string;
  phoneNumber: string | null;
  gender: string;
  age: number | null;
  hasCompletedOnboarding: boolean;
  notificationOptIn: boolean;
  signInProvider: string;
  uid: string;
  updatedAt: string;
  conversations: string[];
  favorites: string[];
  wallet: Wallet;
  membershipTier: string;
  membershipStatus: string;
  membershipStartedAt: string | null;
  membershipExpiresAt: string | null;
  membershipAutoRenew: boolean;
  assets: UserAssets;
  isGuest?: boolean;
}

/**
 * UserProfile - 統一的用戶資料類型
 * 用於組件和 composables 中的用戶資料傳遞
 * 所有欄位為可選，支持動態屬性以保持向後兼容
 */
export type UserProfile = Partial<User> & {
  id?: string;
  [key: string]: any;
};

// ==================== 消息相關 ====================

export type MessageRole = 'user' | 'partner' | 'ai';
export type MessageState = 'pending' | 'sent' | 'error' | 'retrying' | 'failed';

export interface Message {
  id?: string; // id 可選，因為創建新消息時可能還沒有 id
  text: string;
  role: MessageRole | string; // 允許 string 以支持動態值
  state?: MessageState | string; // 允許 string 以支持動態狀態
  timestamp?: number | Date;
  createdAt?: string;
  imageUrl?: string;
  video?: {
    url: string;
    duration?: string;
    resolution?: string;
  } | string; // 允許 'loading' 狀態
  retryCount?: number;
  error?: string;
  // 支持動態屬性（用於向後兼容和擴展）
  content?: string; // content 是 text 的別名，用於與後端 API 兼容
  hadImage?: boolean; // 用於緩存標記
  [key: string]: any; // 允許額外的動態屬性
}

// ==================== 角色/夥伴相關 ====================

export interface Partner {
  id: string;
  display_name: string;
  background: string;
  portraitUrl?: string;
  age?: number;
  personality?: string;
  hobbies?: string[];
  occupation?: string;
  first_message?: string;
  // API 可能返回的替代屬性名稱
  name?: string; // 等同於 display_name
}

// ==================== Firebase Auth 相關 ====================

export interface FirebaseAuthService {
  getCurrentUserIdToken: () => Promise<string>;
  signOut?: () => Promise<void>;
  getCurrentUser?: () => Promise<User | null>;
}

// ==================== API 相關 ====================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface SuggestionResponse {
  suggestions: string[];
  fallback?: boolean;
  message?: string;
}

// ==================== Composable 返回類型 ====================

export interface Toast {
  success: (message: string) => void;
  error: (message: string) => void;
  info?: (message: string) => void;
  warning?: (message: string) => void;
}

// ==================== 通用工具類型 ====================

export type MaybeRef<T> = T | Ref<T>;
export type MaybeComputedRef<T> = T | ComputedRef<T>;
export type RefOrComputed<T> = Ref<T> | ComputedRef<T>;

// ==================== 限制相關 ====================

export interface LimitCheckResult {
  allowed: boolean;
  remaining: number;
  total: number;
  used?: number;
  resetTime?: Date | string;
  // 廣告相關屬性（API 可能返回）
  dailyAdLimit?: number;
  adsWatchedToday?: number;
  isUnlocked?: boolean;
}

export interface PhotoLimitInfo {
  used: number;
  remaining: number;
  total: number;
  standardTotal: number | null;
  isTestAccount: boolean;
  cards: number;
  tier: string;
  resetPeriod?: string;
  // API 可能返回的替代屬性名稱
  photosLimit?: number; // 等同於 total
  photoCards?: number;  // 等同於 cards
}

// ==================== 會員相關 ====================

// ✅ 2025-11-30 更新：新增 Lite 等級
export type MembershipTier = 'free' | 'lite' | 'vip' | 'vvip';

export interface MembershipFeatures {
  conversationLimit: number;
  voiceLimit: number;
  photoLimit: number;
  unlimitedConversation?: boolean;
  unlimitedVoice?: boolean;
}

export interface MembershipPricing {
  monthly?: number;
  quarterly?: number;
  yearly?: number;
}

export interface MembershipInfo {
  tier: MembershipTier;
  features: MembershipFeatures;
  pricing?: MembershipPricing;
  expiresAt?: string | null;
  isActive: boolean;
  subscriptionStatus?: string;
}

export interface UpgradeProgress {
  step: 'validating' | 'processing' | 'finalizing' | 'completed' | '';
  message: string;
}

// ==================== 建議系統相關 ====================

export interface SuggestionConfig {
  MAX_ITEMS: number;
  SIGNATURE_WINDOW: number;
  FALLBACK_SUGGESTIONS: string[];
}

// ==================== 金幣系統相關 ====================

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: number;
  order?: number;
  popular?: boolean;
  bestValue?: boolean;
  bonus?: number;
}

export interface CoinTransaction {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description?: string;
  createdAt: string;
}

export interface CoinsState {
  balance: number;
  transactions: CoinTransaction[];
  packages: CoinPackage[];
}
