/**
 * useUserProfile.ts
 * 用戶資料管理 Composable（TypeScript 版本）
 */

import { computed, reactive, type ComputedRef } from "vue";
import { apiJson } from "../utils/api";
import { useFirebaseAuth } from "./useFirebaseAuth.js";
import { generateUid, normalizeArray, normalizeGender } from "../../../shared/utils/userUtils.js";
import { generateRandomUserName } from "../utils/randomUserName.js";
import { isGuestUser } from "../../../../shared/config/testAccounts.js";
import type { User, Wallet, UserAssets } from "../types";

// ==================== 類型定義 ====================

interface LoadUserProfileOptions {
  force?: boolean;
  fallback?: Partial<User>;
  skipGlobalLoading?: boolean;
}

interface UpdateUserProfilePatch {
  displayName?: string;
  gender?: string;
  age?: number | null;
  hasCompletedOnboarding?: boolean;
  defaultPrompt?: string;
}

interface CacheEntry {
  data: User;
  timestamp: number;
}

export interface UseUserProfileReturn {
  user: ComputedRef<User | null>;
  isAuthenticated: ComputedRef<boolean>;
  setUserProfile: (payload: Partial<User>) => User;
  clearUserProfile: () => void;
  loadUserProfile: (id: string, options?: LoadUserProfileOptions) => Promise<User>;
  updateUserAvatar: (photoURL: string) => Promise<User>;
  updateUserProfileDetails: (patch: UpdateUserProfilePatch) => Promise<User>;
  addConversationHistory: (conversationId: string) => Promise<User>;
  resetConversationHistory: (conversationId: string) => Promise<User>;
}

// ==================== 狀態和緩存 ====================

const baseState = reactive<{ user: User | null }>({
  user: null,
});

// ✅ P1 優化：增加用戶資料緩存 TTL（10 分鐘）
// 用戶資料變化不頻繁，可以使用更長的緩存時間減少 API 請求
const profileCache = new Map<string, CacheEntry>(); // 存儲格式: { data: userData, timestamp: Date.now() }
const CACHE_TTL = 10 * 60 * 1000; // 10 分鐘 = 600000ms（原本 2 分鐘）
const firebaseAuth = useFirebaseAuth();

// ==================== 內部工具函數 ====================

const normalizeUser = (payload: Partial<User> = {}): User => {
  const nowIso = new Date().toISOString();
  const id = payload.id ?? "";
  const createdAt = payload.createdAt ?? nowIso;
  const updatedAt = payload.updatedAt ?? createdAt;
  const lastLoginAt = payload.lastLoginAt ?? nowIso;

  // ✅ 關鍵修復：uid 必須等於 id（Firebase UID）
  // 永遠不要重新生成 uid，因為它是用戶的唯一標識符
  // 如果後端沒有提供 uid，使用 id 作為後備
  const uid = payload.uid || id || "未設定帳號";

  // 解析錢包餘額（向後兼容：支援讀取舊格式）
  const walletBalance = payload.wallet?.balance
    ?? (payload as any).walletBalance
    ?? (payload as any).coins
    ?? (payload as any).balance
    ?? 0;

  const wallet: Wallet = {
    balance: walletBalance,
    currency: payload.wallet?.currency ?? "TWD",
    updatedAt: payload.wallet?.updatedAt ?? updatedAt,
    ...(payload.wallet?.history ? { history: payload.wallet.history } : {}),
  };

  const assets: UserAssets = {
    characterUnlockCards: payload.assets?.characterUnlockCards ?? 0,
    photoUnlockCards: payload.assets?.photoUnlockCards ?? 0,
    videoUnlockCards: payload.assets?.videoUnlockCards ?? 0,
    voiceUnlockCards: payload.assets?.voiceUnlockCards ?? 0,
    createCards: payload.assets?.createCards ?? 0,
  };

  return {
    id,
    displayName: payload.displayName ?? generateRandomUserName(),
    locale: payload.locale ?? "zh-TW",
    createdAt,
    defaultPrompt: payload.defaultPrompt ?? "",
    email: payload.email ?? "",
    photoURL: payload.photoURL ?? "/avatars/defult-01.webp",
    lastLoginAt,
    phoneNumber: payload.phoneNumber ?? null,
    gender: normalizeGender(payload.gender) ?? "other",
    age: payload.age ?? null,
    hasCompletedOnboarding: Boolean(payload.hasCompletedOnboarding),
    notificationOptIn: Boolean(payload.notificationOptIn),
    signInProvider: payload.signInProvider ?? "unknown",
    uid,  // ✅ 使用上面計算的 uid，不再調用 generateUid
    updatedAt,
    conversations: normalizeArray(payload.conversations),
    favorites: normalizeArray(payload.favorites),

    // 錢包系統欄位
    wallet,

    // 會員系統欄位
    membershipTier: payload.membershipTier ?? "free",
    membershipStatus: payload.membershipStatus ?? "active",
    membershipStartedAt: payload.membershipStartedAt ?? null,
    membershipExpiresAt: payload.membershipExpiresAt ?? null,
    membershipAutoRenew: Boolean(payload.membershipAutoRenew),

    // 資產系統欄位
    assets,
  };
};

const cacheUserProfile = (payload: Partial<User>): User => {
  const profile = normalizeUser(payload);

  // ✅ 存儲帶時間戳的緩存項
  if (profile.id) {
    profileCache.set(profile.id, {
      data: profile,
      timestamp: Date.now(),
    });
  }
  baseState.user = profile;
  return profile;
};

// ==================== 導出函數 ====================

const loadUserProfile = async (id: string, options: LoadUserProfileOptions = {}): Promise<User> => {
  const { force = false, fallback, skipGlobalLoading = false } = options;
  if (!id) {
    throw new Error("載入使用者資料時需要提供 id");
  }

  // ✅ 檢查緩存是否存在且未過期
  if (!force && profileCache.has(id)) {
    const cacheEntry = profileCache.get(id)!;
    const now = Date.now();
    const age = now - cacheEntry.timestamp;

    // 如果緩存未過期（小於 10 分鐘），直接返回
    if (age < CACHE_TTL) {
      const cached = cacheEntry.data;
      baseState.user = cached;
      console.debug(`[useUserProfile] 使用緩存資料: ${id}, 年齡: ${Math.round(age / 1000)}秒`);
      return cached;
    } else {
      // 緩存已過期，從 Map 中刪除
      profileCache.delete(id);
      console.debug(`[useUserProfile] 緩存已過期並刪除: ${id}, 年齡: ${Math.round(age / 1000)}秒`);
    }
  }

  // 緩存不存在或已過期，從 API 獲取新資料
  try {
    console.debug(`[useUserProfile] 從 API 獲取用戶資料: ${id}`);
    const data = await apiJson(`/api/users/${encodeURIComponent(id)}`, {
      skipGlobalLoading,
    });
    return cacheUserProfile(data);
  } catch (error) {
    if (fallback) {
      return cacheUserProfile({ ...fallback, id });
    }
    throw error;
  }
};

const setUserProfile = (payload: Partial<User>): User => {
  return cacheUserProfile(payload);
};

const updateUserAvatar = async (photoURL: string): Promise<User> => {
  const current = baseState.user;
  if (!current?.id) {
    throw new Error("目前沒有可更新的使用者資料");
  }
  if (!photoURL) {
    throw new Error("更新頭像時需要提供有效的 photoURL");
  }

  let token: string;
  try {
    token = await firebaseAuth.getCurrentUserIdToken();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "未取得 Firebase 權杖，無法更新頭像";
    throw new Error(message);
  }

  const updated = await apiJson(
    `/api/users/${encodeURIComponent(current.id)}/photo`,
    {
      method: "PATCH",
      body: { photoURL },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return cacheUserProfile(updated);
};

const updateUserProfileDetails = async (patch: UpdateUserProfilePatch = {}): Promise<User> => {
  const current = baseState.user;
  if (!current?.id) {
    throw new Error("目前沒有可更新的使用者資料");
  }
  if (!patch || typeof patch !== "object") {
    throw new Error("更新個人資料時需要提供有效的內容");
  }

  let token: string;
  try {
    token = await firebaseAuth.getCurrentUserIdToken();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "未取得 Firebase 權杖，無法更新個人資料";
    throw new Error(message);
  }

  const payload: Partial<UpdateUserProfilePatch> = {};
  if (Object.prototype.hasOwnProperty.call(patch, "displayName")) {
    payload.displayName =
      typeof patch.displayName === "string" ? patch.displayName : "";
  }
  if (Object.prototype.hasOwnProperty.call(patch, "gender")) {
    payload.gender = patch.gender;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "age")) {
    payload.age = patch.age;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "hasCompletedOnboarding")) {
    payload.hasCompletedOnboarding = patch.hasCompletedOnboarding;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "defaultPrompt")) {
    payload.defaultPrompt =
      typeof patch.defaultPrompt === "string" ? patch.defaultPrompt : "";
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("未提供可更新的欄位");
  }

  const updated = await apiJson(
    `/api/users/${encodeURIComponent(current.id)}/profile`,
    {
      method: "PATCH",
      body: payload,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const cached = cacheUserProfile(updated);

  return cached;
};

const addConversationHistory = async (conversationId: string): Promise<User> => {
  const current = baseState.user;
  if (!current?.id) {
    throw new Error("目前沒有可更新的使用者資料");
  }
  if (!conversationId) {
    throw new Error("紀錄聊天對象時需要提供有效的 conversationId");
  }

  // 對於遊客用戶，只在本地更新對話列表，不調用 API
  if (isGuestUser(current.id)) {
    const conversations = Array.isArray(current.conversations)
      ? current.conversations
      : [];

    // 如果對話 ID 不在列表中，添加它
    if (!conversations.includes(conversationId)) {
      conversations.push(conversationId);
    }

    return cacheUserProfile({
      ...current,
      conversations,
    });
  }

  let token: string;
  try {
    token = await firebaseAuth.getCurrentUserIdToken();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "未取得 Firebase 權杖，無法更新聊天紀錄";
    throw new Error(message);
  }

  const postConversation = async (): Promise<any> => {
    return apiJson(`/api/users/${encodeURIComponent(current.id)}/conversations`, {
      method: "POST",
      body: { conversationId },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  };

  const ensureUserRecord = async (): Promise<User> => {
    const bootstrapPayload: Partial<User> = {
      id: current.id,
      uid: current.uid ?? current.id,
      displayName: current.displayName ?? "未命名使用者",
      locale: current.locale ?? "zh-TW",
      defaultPrompt: current.defaultPrompt ?? "",
      email: current.email ?? "",
      photoURL: current.photoURL ?? "/avatars/defult-01.webp",
      lastLoginAt: current.lastLoginAt,
      phoneNumber: current.phoneNumber ?? null,
      notificationOptIn: Boolean(current.notificationOptIn),
      signInProvider: current.signInProvider ?? "unknown",
      updatedAt: current.updatedAt,
      createdAt: current.createdAt,
      conversations: Array.isArray(current.conversations)
        ? current.conversations
        : [],
      favorites: Array.isArray(current.favorites) ? current.favorites : [],
    };

    const record = await apiJson("/api/users", {
      method: "POST",
      body: bootstrapPayload,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return cacheUserProfile(record);
  };

  let response: any;

  try {
    response = await postConversation();
  } catch (error: any) {
    const notFound =
      (typeof error?.status === "number" && error.status === 404) ||
      (error instanceof Error &&
        typeof error.message === "string" &&
        error.message.includes("404"));

    if (!notFound) {
      throw error;
    }

    await ensureUserRecord();
    response = await postConversation();
  }

  const conversations = Array.isArray(response?.conversations)
    ? response.conversations
    : [];

  return cacheUserProfile({
    ...current,
    conversations,
  });
};

const resetConversationHistory = async (conversationId: string): Promise<User> => {
  const current = baseState.user;
  if (!current?.id) {
    throw new Error("目前沒有可更新的使用者資料");
  }
  if (!conversationId) {
    throw new Error("重置聊天紀錄時需要提供有效的 conversationId");
  }

  let token: string;
  try {
    token = await firebaseAuth.getCurrentUserIdToken();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "未取得 Firebase 權杖，無法重置聊天紀錄";
    throw new Error(message);
  }

  let response: any;
  try {
    response = await apiJson(
      `/api/users/${encodeURIComponent(current.id)}/conversations/${encodeURIComponent(
        conversationId
      )}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error: any) {
    const notFound =
      (typeof error?.status === "number" && error.status === 404) ||
      (error instanceof Error &&
        typeof error.message === "string" &&
        error.message.includes("404"));

    if (!notFound) {
      throw error;
    }

    const existing = Array.isArray(current.conversations)
      ? current.conversations
      : [];
    const nextConversations = existing.filter((value) => {
      if (typeof value === "string") {
        return value !== conversationId;
      }
      if (value && typeof value === "object") {
        const identifier =
          (value as any).conversationId ??
          (value as any).characterId ??
          (value as any).character?.id ??
          (value as any).matchId ??
          (value as any).id ??
          "";
        return identifier !== conversationId;
      }
      return true;
    });

    return cacheUserProfile({
      ...current,
      conversations: nextConversations,
    });
  }

  const conversations = Array.isArray(response?.conversations)
    ? response.conversations
    : [];

  return cacheUserProfile({
    ...current,
    conversations,
  });
};

const clearUserProfile = (): void => {
  baseState.user = null;
};

// ==================== Composable 主函數 ====================

export const useUserProfile = (): UseUserProfileReturn => {
  const user = computed(() => baseState.user);
  const isAuthenticated = computed(() => Boolean(baseState.user));

  return {
    user,
    isAuthenticated,
    setUserProfile,
    clearUserProfile,
    loadUserProfile,
    updateUserAvatar,
    updateUserProfileDetails,
    addConversationHistory,
    resetConversationHistory,
  };
};
