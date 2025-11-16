/**
 * ProfileView 配置文件
 * 集中管理個人資料頁面的配置數據
 */

import {
  BellAlertIcon,
  UserGroupIcon,
  PhotoIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "@heroicons/vue/24/outline";
import type { FunctionalComponent } from "vue";

// ==================== 常量配置 ====================

/**
 * 個人資料欄位長度限制
 */
export const PROFILE_LIMITS = {
  MAX_NAME_LENGTH: 10,
  MAX_PROMPT_LENGTH: 50,
  MIN_AGE: 13,
  MAX_AGE: 120,
} as const;

// ==================== 預設用戶資料 ====================

/**
 * 用戶資料結構
 */
interface UserProfile {
  id: string;
  uid: string;
  displayName: string;
  locale: string;
  createdAt: string;
  defaultPrompt: string;
  email: string;
  photoURL: string;
  lastLoginAt: string;
  phoneNumber: string | null;
  gender: string;
  notificationOptIn: boolean;
  signInProvider: string;
  updatedAt: string;
  conversations: unknown[];
  favorites: unknown[];
}

/**
 * 備用用戶資料（當無法載入用戶資料時使用）
 */
export const FALLBACK_USER: UserProfile = {
  id: "demo-user",
  uid: "LoveDemo晨霧星語",
  displayName: "小高0556",
  locale: "zh-TW",
  createdAt: "2024-01-01T00:00:00.000Z",
  defaultPrompt: "",
  email: "demo@example.com",
  photoURL: "/avatars/defult-01.webp",
  lastLoginAt: "2024-01-01T00:00:00.000Z",
  phoneNumber: null,
  gender: "other",
  notificationOptIn: true,
  signInProvider: "google",
  updatedAt: "2024-01-01T00:00:00.000Z",
  conversations: [],
  favorites: [],
};

// ==================== 頭像配置 ====================

/**
 * 頭像選項
 */
interface AvatarOption {
  src: string;
  label: string;
}

/**
 * 內建頭像選項列表
 */
export const BUILTIN_AVATAR_OPTIONS: AvatarOption[] = [
  { src: "/avatars/defult-01.webp", label: "預設頭像 1" },
  { src: "/avatars/defult-02.webp", label: "預設頭像 2" },
  { src: "/avatars/defult-03.webp", label: "預設頭像 3" },
  { src: "/avatars/defult-04.webp", label: "預設頭像 4" },
  { src: "/avatars/defult-05.webp", label: "預設頭像 5" },
  { src: "/avatars/defult-06.webp", label: "預設頭像 6" },
];

// ==================== 快捷操作配置 ====================

/**
 * 快捷操作項目
 */
interface QuickAction {
  key: string;
  label: string;
  icon: FunctionalComponent;
}

/**
 * 快捷操作列表配置
 * 每個操作包含 key、label 和對應的圖標組件
 */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "notifications",
    label: "通知",
    icon: BellAlertIcon,
  },
  {
    key: "shop",
    label: "商城",
    icon: ShoppingBagIcon,
  },
  {
    key: "membership",
    label: "會員",
    icon: UserGroupIcon,
  },
  {
    key: "favorites",
    label: "相冊",
    icon: PhotoIcon,
  },
  {
    key: "my-characters",
    label: "已創建角色",
    icon: UsersIcon,
  },
];

/**
 * 快捷操作對應的路由名稱映射
 */
export const QUICK_ACTION_ROUTES: Record<string, string> = {
  notifications: "notifications",
  shop: "shop",
  membership: "membership",
  favorites: "favorites",
  "my-characters": "my-characters",
};

// ==================== 表單選項配置 ====================

/**
 * 性別選項
 */
interface FormOption {
  value: string;
  label: string;
}

/**
 * 性別選項
 */
export const GENDER_OPTIONS: FormOption[] = [
  { value: "other", label: "其他" },
  { value: "female", label: "女性" },
  { value: "male", label: "男性" },
];

/**
 * 生成年齡選項
 * @returns {number[]} 年齡選項數組 (13-120)
 */
export const generateAgeOptions = (): number[] => {
  const { MIN_AGE, MAX_AGE } = PROFILE_LIMITS;
  return Array.from(
    { length: MAX_AGE - MIN_AGE + 1 },
    (_, i) => i + MIN_AGE
  );
};

// ==================== 資產類型映射 ====================

/**
 * 解鎖卡類型對應的資產類型
 */
export const ASSET_TYPE_MAP: Record<string, string> = {
  photo: "photoUnlockCards",
  voice: "voiceUnlockCards",
  character: "characterUnlockCards",
  create: "createCards",
};

/**
 * 卡片類型對應的商城分類
 */
export const CARD_CATEGORY_MAP: Record<string, string> = {
  photo: "photo-unlock",
  voice: "voice-unlock",
  character: "character-unlock",
  create: "create",
};

// ==================== 預設資產數據 ====================

/**
 * 用戶資產數據結構
 */
interface UserAssets {
  characterUnlockCards: number;
  photoUnlockCards: number;
  videoUnlockCards: number;
  voiceUnlockCards: number;
  createCards: number;
  potions: {
    memoryBoost: number;
    brainBoost: number;
  };
}

/**
 * 預設用戶資產數據結構
 */
export const DEFAULT_USER_ASSETS: UserAssets = {
  characterUnlockCards: 0,
  photoUnlockCards: 0,
  videoUnlockCards: 0,
  voiceUnlockCards: 0,
  createCards: 0,
  potions: {
    memoryBoost: 0,
    brainBoost: 0,
  },
};

// ==================== 輔助工具函數 ====================

/**
 * 驗證性別值是否有效
 * @param {string} value - 要驗證的性別值
 * @returns {boolean} 是否為有效的性別值
 */
export const isValidGender = (value: string): boolean => {
  const allowedValues = new Set(GENDER_OPTIONS.map((option) => option.value));
  return allowedValues.has(value);
};

/**
 * 驗證年齡是否在有效範圍內
 * @param {number} age - 要驗證的年齡
 * @returns {boolean} 是否為有效年齡
 */
export const isValidAge = (age: number): boolean => {
  const { MIN_AGE, MAX_AGE } = PROFILE_LIMITS;
  return Number.isFinite(age) && age >= MIN_AGE && age <= MAX_AGE;
};
