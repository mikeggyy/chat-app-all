import { computed, reactive } from "vue";
import { apiJson } from "../utils/api";
import { useFirebaseAuth } from "./useFirebaseAuth.js";
import { generateUid, normalizeArray, normalizeGender } from "../../../shared/utils/userUtils.js";
import { generateRandomUserName } from "../utils/randomUserName.js";
import { isGuestUser } from "../../../../shared/config/testAccounts.js";

const baseState = reactive({
  user: null,
});

const profileCache = new Map();
const firebaseAuth = useFirebaseAuth();

const normalizeUser = (payload = {}) => {
  const nowIso = new Date().toISOString();
  const id = payload.id ?? "";
  const createdAt = payload.createdAt ?? nowIso;
  const updatedAt = payload.updatedAt ?? createdAt;
  const lastLoginAt = payload.lastLoginAt ?? nowIso;

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
    uid: payload.uid ?? generateUid(id || nowIso),
    updatedAt,
    conversations: normalizeArray(payload.conversations),
    favorites: normalizeArray(payload.favorites),
  };
};

const cacheUserProfile = (payload) => {
  const profile = normalizeUser(payload);
  if (profile.id) {
    profileCache.set(profile.id, profile);
  }
  baseState.user = profile;
  return profile;
};

const loadUserProfile = async (id, options = {}) => {
  const { force = false, fallback, skipGlobalLoading = false } = options;
  if (!id) {
    throw new Error("載入使用者資料時需要提供 id");
  }

  if (!force && profileCache.has(id)) {
    const cached = profileCache.get(id);
    baseState.user = cached;
    return cached;
  }

  try {
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

const setUserProfile = (payload) => {
  return cacheUserProfile(payload);
};

const updateUserAvatar = async (photoURL) => {
  const current = baseState.user;
  if (!current?.id) {
    throw new Error("目前沒有可更新的使用者資料");
  }
  if (!photoURL) {
    throw new Error("更新頭像時需要提供有效的 photoURL");
  }

  let token;
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

const updateUserProfileDetails = async (patch = {}) => {
  const current = baseState.user;
  if (!current?.id) {
    throw new Error("目前沒有可更新的使用者資料");
  }
  if (!patch || typeof patch !== "object") {
    throw new Error("更新個人資料時需要提供有效的內容");
  }

  let token;
  try {
    token = await firebaseAuth.getCurrentUserIdToken();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "未取得 Firebase 權杖，無法更新個人資料";
    throw new Error(message);
  }

  const payload = {};
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

  return cacheUserProfile(updated);
};

const addConversationHistory = async (conversationId) => {
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

  let token;
  try {
    token = await firebaseAuth.getCurrentUserIdToken();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "未取得 Firebase 權杖，無法更新聊天紀錄";
    throw new Error(message);
  }

  const postConversation = async () => {
    return apiJson(`/api/users/${encodeURIComponent(current.id)}/conversations`, {
      method: "POST",
      body: { conversationId },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  };

  const ensureUserRecord = async () => {
    const bootstrapPayload = {
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

  let response;

  try {
    response = await postConversation();
  } catch (error) {
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

const resetConversationHistory = async (conversationId) => {
  const current = baseState.user;
  if (!current?.id) {
    throw new Error("目前沒有可更新的使用者資料");
  }
  if (!conversationId) {
    throw new Error("重置聊天紀錄時需要提供有效的 conversationId");
  }

  let token;
  try {
    token = await firebaseAuth.getCurrentUserIdToken();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "未取得 Firebase 權杖，無法重置聊天紀錄";
    throw new Error(message);
  }

  let response;
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
  } catch (error) {
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
          value.conversationId ??
          value.characterId ??
          value.character?.id ??
          value.matchId ??
          value.id ??
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

const clearUserProfile = () => {
  baseState.user = null;
};

export const useUserProfile = () => {
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
