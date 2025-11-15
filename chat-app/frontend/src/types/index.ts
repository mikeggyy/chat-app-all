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

// ==================== 消息相關 ====================

export type MessageRole = 'user' | 'partner' | 'ai';
export type MessageState = 'pending' | 'sent' | 'error' | 'retrying' | 'failed';

export interface Message {
  id: string;
  text: string;
  role: MessageRole;
  state?: MessageState;
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
}

// ==================== 會員相關 ====================

export type MembershipTier = 'free' | 'vip' | 'vvip';

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
