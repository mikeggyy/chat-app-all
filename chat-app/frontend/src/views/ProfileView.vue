<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  watchEffect,
} from "vue";
import {
  BellAlertIcon,
  UserGroupIcon,
  StarIcon,
  BoltIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  TicketIcon,
  PhotoIcon,
  VideoCameraIcon,
  ShoppingBagIcon,
  WalletIcon,
  UsersIcon,
} from "@heroicons/vue/24/outline";
import { ArrowRightIcon, HeartIcon } from "@heroicons/vue/24/solid";
import AvatarEditorModal from "../components/AvatarEditorModal.vue";
import StatsModal from "../components/StatsModal.vue";
import { useUserProfile } from "../composables/useUserProfile";
import { useRouter } from "vue-router";
import { useFirebaseAuth } from "../composables/useFirebaseAuth";
import { useGuestGuard } from "../composables/useGuestGuard";
import { useNotifications } from "../composables/useNotifications";
import { useMembership } from "../composables/useMembership";
import { useCoins } from "../composables/useCoins";
import { useUnlockTickets } from "../composables/useUnlockTickets";
import { clearTestSession } from "../services/testAuthSession";
import { COIN_ICON_PATH } from "../config/assets";

const router = useRouter();
const firebaseAuth = useFirebaseAuth();
const { hasUnreadNotifications } = useNotifications();
const { requireLogin, isGuest } = useGuestGuard();

// VIP 系統 composables
const {
  tier,
  tierName,
  isVIP,
  isVVIP,
  isPaidMember,
  formattedExpiryDate,
  daysUntilExpiry,
  isExpiringSoon,
  loadMembership
} = useMembership();

const { balance, formattedBalance, loadBalance } = useCoins();

const {
  characterTickets,
  photoCards,
  videoCards,
  loadBalance: loadTicketsBalance,
} = useUnlockTickets();

// 金幣圖標
const isCoinIconAvailable = ref(true);

const handleCoinIconError = () => {
  if (isCoinIconAvailable.value) {
    isCoinIconAvailable.value = false;
  }
};

// 用戶資產
const userAssets = ref({
  characterUnlockCards: 0,
  photoUnlockCards: 0,
  videoUnlockCards: 0,
  voiceUnlockCards: 0,
  createCards: 0,
  potions: {
    memoryBoost: 0,
    brainBoost: 0,
  },
});

const loadUserAssets = async (userId) => {
  if (!userId) return;
  try {
    const { apiJson } = await import("../utils/api.js");
    const data = await apiJson(`/api/users/${encodeURIComponent(userId)}/assets`, {
      skipGlobalLoading: true,
    });
    // 只更新已定義的欄位，避免訪問未定義的屬性
    if (data && typeof data === 'object') {
      userAssets.value = {
        characterUnlockCards: data.characterUnlockCards ?? 0,
        photoUnlockCards: data.photoUnlockCards ?? 0,
        videoUnlockCards: data.videoUnlockCards ?? 0,
        voiceUnlockCards: data.voiceUnlockCards ?? 0,
        createCards: data.createCards ?? 0,
        potions: data.potions ?? userAssets.value.potions,
      };
    }
  } catch (err) {
    if (import.meta.env.DEV) {
    }
  }
};

const {
  user,
  loadUserProfile,
  updateUserAvatar,
  updateUserProfileDetails,
  clearUserProfile,
} = useUserProfile();

const quickActions = [
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

const quickActionRoutes = {
  notifications: "notifications",
  shop: "shop",
  membership: "membership",
  favorites: "favorites",
  "my-characters": "my-characters",
};

const handleQuickActionSelect = async (action) => {
  if (!action || typeof action !== "object") {
    return;
  }

  const routeName = quickActionRoutes[action.key];

  if (!routeName) {
    return;
  }

  try {
    await router.push({ name: routeName });
  } catch (error) {
  }
};

const fallbackUser = {
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

const builtinAvatarOptions = [
  { src: "/avatars/defult-01.webp", label: "預設頭像 1" },
  { src: "/avatars/defult-02.webp", label: "預設頭像 2" },
  { src: "/avatars/defult-03.webp", label: "預設頭像 3" },
  { src: "/avatars/defult-04.webp", label: "預設頭像 4" },
  { src: "/avatars/defult-05.webp", label: "預設頭像 5" },
  { src: "/avatars/defult-06.webp", label: "預設頭像 6" },
];

const profile = computed(() => user.value ?? fallbackUser);
const targetUserId = computed(() => profile.value.id ?? fallbackUser.id ?? "");

const displayedId = computed(
  () => profile.value.uid ?? profile.value.id ?? "尚未設定"
);

const avatarPreview = ref(fallbackUser.photoURL);
const isAvatarModalOpen = ref(false);
const isAvatarSaving = ref(false);
const isAvatarImageLoading = ref(true);
const isStatsModalOpen = ref(false);

watch(
  () => profile.value.photoURL,
  (next) => {
    const nextSrc = next ?? fallbackUser.photoURL;
    if (nextSrc !== avatarPreview.value) {
      isAvatarImageLoading.value = true;
    }
    avatarPreview.value = nextSrc;
  },
  { immediate: true }
);

const auxiliaryActions = [
  {
    key: "edit",
    label: "編輯個人資料",
    icon: PencilSquareIcon,
  },
  {
    key: "settings",
    label: "設定",
    icon: Cog6ToothIcon,
  },
];

const settingsOptions = [{ key: "logout", label: "登出", variant: "danger" }];
const isSettingsMenuOpen = ref(false);
const settingsMenuButtonRef = ref(null);
const settingsMenuRef = ref(null);
const settingsError = ref("");
const isLoggingOut = ref(false);
const isLogoutConfirmVisible = ref(false);
const logoutConfirmCancelButtonRef = ref(null);

const genderOptions = [
  { value: "other", label: "其他" },
  { value: "female", label: "女性" },
  { value: "male", label: "男性" },
];

const ageOptions = computed(() => {
  const options = [];
  for (let i = 13; i <= 120; i++) {
    options.push(i);
  }
  return options;
});

const PROFILE_MAX_NAME_LENGTH = 10;
const PROFILE_MAX_PROMPT_LENGTH = 50;
const allowedGenderValues = new Set(
  genderOptions.map((option) => option.value)
);

const clampTextLength = (value, maxLength) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.length > maxLength ? value.slice(0, maxLength) : value;
};

const fallbackDisplayName =
  typeof fallbackUser.displayName === "string"
    ? clampTextLength(fallbackUser.displayName.trim(), PROFILE_MAX_NAME_LENGTH)
    : "";

const normalizeDisplayName = (
  value,
  { fallback = fallbackDisplayName, allowEmpty = false } = {}
) => {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return allowEmpty ? "" : fallback;
  }
  return clampTextLength(trimmed, PROFILE_MAX_NAME_LENGTH);
};

const normalizePrompt = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return clampTextLength(trimmed, PROFILE_MAX_PROMPT_LENGTH);
};

const normalizeGender = (value) => {
  if (typeof value !== "string") {
    return "other";
  }
  const trimmed = value.trim();
  return allowedGenderValues.has(trimmed) ? trimmed : "other";
};

const buildNormalizedProfile = (sourceProfile = fallbackUser) => ({
  displayName: normalizeDisplayName(sourceProfile.displayName, {
    allowEmpty: true,
  }),
  gender: normalizeGender(sourceProfile.gender),
  age: sourceProfile.age ?? null,
  defaultPrompt: normalizePrompt(sourceProfile.defaultPrompt),
});

const openAvatarEditor = () => {
  // 檢查是否為遊客
  if (requireLogin({ feature: "編輯頭像" })) {
    return;
  }
  isAvatarModalOpen.value = true;
};

const closeAvatarEditor = () => {
  isAvatarModalOpen.value = false;
};

const openStatsModal = () => {
  isStatsModalOpen.value = true;
};

const closeStatsModal = () => {
  isStatsModalOpen.value = false;
};

const handleBuyUnlockCard = (cardType) => {
  // 跳轉到商城頁面，並根據卡片類型選擇對應的分類
  const categoryMap = {
    photo: 'photo-unlock',
    voice: 'voice-unlock',
    character: 'character-unlock',
    create: 'create',
  };

  const category = categoryMap[cardType] || 'coins';
  router.push({ path: '/shop', query: { category } });
};

const handleUsePotion = async (potionType) => {
  if (!targetUserId.value) return;

  try {
    const { apiJson } = await import("../utils/api.js");
    const { useToast } = await import("../composables/useToast");
    const { success, error: showError, warning } = useToast();

    // 記憶增強藥水和腦力激盪藥水都需要在聊天頁面使用（綁定特定角色）
    if (potionType === 'memoryBoost') {
      warning("請在與角色聊天時使用記憶增強藥水");
      return;
    }

    if (potionType === 'brainBoost') {
      warning("請在與角色聊天時使用腦力激盪藥水");
      return;
    }
  } catch (error) {
    const { useToast } = await import("../composables/useToast");
    const { error: showError } = useToast();
    showError(error.message || "使用藥水失敗");
  }
};

const handleUseUnlockCard = async (cardType) => {
  if (!targetUserId.value) return;

  try {
    const { apiJson } = await import("../utils/api.js");

    // 消耗對應的解鎖卡
    const assetTypeMap = {
      photo: 'photoUnlockCards',
      voice: 'voiceUnlockCards',
      character: 'characterUnlockCards',
      create: 'createCards',
    };

    const assetType = assetTypeMap[cardType];
    if (!assetType) return;

    await apiJson(`/api/users/${encodeURIComponent(targetUserId.value)}/assets/consume`, {
      method: 'POST',
      body: JSON.stringify({ assetType, amount: 1 }),
    });

    // 重新載入資產數據
    await loadUserAssets(targetUserId.value);

    // 顯示成功訊息
    if (import.meta.env.DEV) {
    }
  } catch (error) {
  }
};

const handleAvatarUpdate = async (nextUrl) => {
  if (isAvatarSaving.value) return;
  if (typeof nextUrl !== "string" || !nextUrl.length) {
    closeAvatarEditor();
    return;
  }

  const previousPhoto = avatarPreview.value;
  isAvatarImageLoading.value = true;
  avatarPreview.value = nextUrl;

  const isDataUrl = nextUrl.startsWith("data:");

  if (isDataUrl) {
    closeAvatarEditor();
    return;
  }

  if (!profile.value?.id) {
    avatarPreview.value = previousPhoto;
    closeAvatarEditor();
    return;
  }

  isAvatarSaving.value = true;

  try {
    const updated = await updateUserAvatar(nextUrl);
    if (updated?.photoURL && updated.photoURL !== avatarPreview.value) {
      isAvatarImageLoading.value = true;
      avatarPreview.value = updated.photoURL;
    }
    closeAvatarEditor();
  } catch (error) {
    avatarPreview.value = previousPhoto;
    isAvatarImageLoading.value = false;
    if (import.meta.env.DEV) {
    }
  } finally {
    isAvatarSaving.value = false;
  }
};

const handleAvatarLoad = () => {
  isAvatarImageLoading.value = false;
};

const handleAvatarError = () => {
  if (avatarPreview.value !== fallbackUser.photoURL) {
    isAvatarImageLoading.value = true;
    avatarPreview.value = fallbackUser.photoURL;
    return;
  }
  isAvatarImageLoading.value = false;
};

let previousBodyOverflow = "";
const toggleBodyScrollLock = (isLocked) => {
  if (typeof document === "undefined") return;
  if (isLocked) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = previousBodyOverflow || "";
    previousBodyOverflow = "";
  }
};

const profileNameInputRef = ref(null);
const isProfileEditorOpen = ref(false);
const isProfileSaving = ref(false);
const profileEditorError = ref("");

const profileForm = reactive({
  displayName: "",
  gender: "other",
  age: null,
  defaultPrompt: "",
});

const profileFormErrors = reactive({
  displayName: "",
  age: "",
  defaultPrompt: "",
});

let suppressProfileFormDirty = false;

const normalizedProfileSource = computed(() =>
  buildNormalizedProfile(profile.value ?? fallbackUser)
);

const normalizedProfileForm = computed(() => ({
  displayName: normalizeDisplayName(profileForm.displayName, {
    allowEmpty: true,
    fallback: "",
  }),
  gender: normalizeGender(profileForm.gender),
  age: profileForm.age,
  defaultPrompt: normalizePrompt(profileForm.defaultPrompt),
}));

const isProfileFormDirty = computed(() => {
  const source = normalizedProfileSource.value;
  const current = normalizedProfileForm.value;
  return (
    current.displayName !== source.displayName ||
    current.gender !== source.gender ||
    current.age !== source.age ||
    current.defaultPrompt !== source.defaultPrompt
  );
});

const applyProfileToForm = () => {
  suppressProfileFormDirty = true;
  const sourceProfile = normalizedProfileSource.value;
  profileForm.displayName = sourceProfile.displayName;
  profileForm.gender = sourceProfile.gender;
  profileForm.age = sourceProfile.age;
  profileForm.defaultPrompt = sourceProfile.defaultPrompt;
  suppressProfileFormDirty = false;
};

const resetProfileEditorState = () => {
  profileEditorError.value = "";
  profileFormErrors.displayName = "";
  profileFormErrors.age = "";
  profileFormErrors.defaultPrompt = "";
};

applyProfileToForm();
resetProfileEditorState();

const openProfileEditor = () => {
  // 檢查是否為遊客
  if (requireLogin({ feature: "編輯個人資料" })) {
    return;
  }
  applyProfileToForm();
  resetProfileEditorState();
  isProfileEditorOpen.value = true;
};

const closeProfileEditor = () => {
  if (isProfileSaving.value) return;
  isProfileEditorOpen.value = false;
};

const handleProfileOverlayClick = () => {
  if (isProfileSaving.value) return;
  closeProfileEditor();
};

const bindSettingsMenuButton = (el) => {
  settingsMenuButtonRef.value = el ?? null;
};

const bindSettingsMenu = (el) => {
  settingsMenuRef.value = el ?? null;
};

const closeSettingsMenu = () => {
  isSettingsMenuOpen.value = false;
  settingsMenuRef.value = null;
};

const toggleSettingsMenu = (event) => {
  event?.stopPropagation();
  settingsError.value = "";
  isSettingsMenuOpen.value = !isSettingsMenuOpen.value;
  if (!isSettingsMenuOpen.value) {
    settingsMenuRef.value = null;
  }
};

const handleDocumentClick = (event) => {
  if (!isSettingsMenuOpen.value) return;
  const menuEl = settingsMenuRef.value;
  const buttonEl = settingsMenuButtonRef.value;
  if (
    menuEl &&
    !menuEl.contains(event.target) &&
    buttonEl &&
    !buttonEl.contains(event.target)
  ) {
    closeSettingsMenu();
  }
};

const requestLogout = () => {
  if (isLoggingOut.value) return;
  settingsError.value = "";
  isLogoutConfirmVisible.value = true;
  closeSettingsMenu();
};

const cancelLogoutConfirm = () => {
  if (isLoggingOut.value) return;
  settingsError.value = "";
  isLogoutConfirmVisible.value = false;
};

const handleGlobalKeydown = (event) => {
  if (event.key !== "Escape") return;
  if (isProfileEditorOpen.value) {
    event.preventDefault();
    closeProfileEditor();
    return;
  }
  if (isLogoutConfirmVisible.value) {
    event.preventDefault();
    cancelLogoutConfirm();
    return;
  }
  if (isSettingsMenuOpen.value) {
    event.preventDefault();
    closeSettingsMenu();
  }
};

const handleAuxiliaryAction = (key, event) => {
  switch (key) {
    case "edit":
      closeSettingsMenu();
      openProfileEditor();
      return;
    case "settings":
      toggleSettingsMenu(event);
      return;
    default:
      closeSettingsMenu();
      if (import.meta.env.DEV) {
      }
  }
};

const handleSettingsOptionSelect = (key) => {
  settingsError.value = "";
  switch (key) {
    case "logout":
      requestLogout();
      return;
    default:
      closeSettingsMenu();
      if (import.meta.env.DEV) {
      }
      return;
  }
};

const handleLogout = async () => {
  if (isLoggingOut.value) return;
  settingsError.value = "";
  isLoggingOut.value = true;

  try {
    await firebaseAuth.signOut();
    clearUserProfile();
    clearTestSession();
    isLogoutConfirmVisible.value = false;
    closeSettingsMenu();
    await router.replace({ name: "login" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "登出失敗，請稍後再試。";
    settingsError.value = message;
    if (import.meta.env.DEV) {
    }
  } finally {
    isLoggingOut.value = false;
  }
};
const profileDisplayNameLength = computed(
  () => normalizedProfileForm.value.displayName.length
);

const profilePromptLength = computed(
  () => normalizedProfileForm.value.defaultPrompt.length
);

const validateProfileForm = () => {
  let isValid = true;
  const trimmedName = normalizeDisplayName(profileForm.displayName, {
    allowEmpty: true,
    fallback: "",
  });
  const rawNameLength =
    typeof profileForm.displayName === "string"
      ? profileForm.displayName.trim().length
      : 0;

  if (!trimmedName.length) {
    profileFormErrors.displayName = "請輸入名稱";
    isValid = false;
  } else if (rawNameLength > PROFILE_MAX_NAME_LENGTH) {
    profileFormErrors.displayName = `名稱請勿超過 ${PROFILE_MAX_NAME_LENGTH} 個字`;
    isValid = false;
  } else {
    profileFormErrors.displayName = "";
  }

  // 驗證年齡
  const age = profileForm.age;
  if (age !== null && age !== undefined && age !== "") {
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
      profileFormErrors.age = "年齡必須在 13 到 120 歲之間";
      isValid = false;
    } else {
      profileFormErrors.age = "";
    }
  } else {
    profileFormErrors.age = "";
  }

  const trimmedPrompt = normalizePrompt(profileForm.defaultPrompt);
  const rawPromptLength =
    typeof profileForm.defaultPrompt === "string"
      ? profileForm.defaultPrompt.trim().length
      : 0;

  if (rawPromptLength > PROFILE_MAX_PROMPT_LENGTH) {
    profileFormErrors.defaultPrompt = `角色設定請勿超過 ${PROFILE_MAX_PROMPT_LENGTH} 個字`;
    isValid = false;
  } else {
    profileFormErrors.defaultPrompt = "";
  }

  return {
    isValid,
    trimmedName,
    trimmedPrompt,
  };
};

const handleProfileSubmit = async () => {
  if (isProfileSaving.value) return;
  profileEditorError.value = "";

  const { isValid, trimmedName, trimmedPrompt } = validateProfileForm();

  if (!isValid) {
    return;
  }

  const normalizedGender = normalizeGender(profileForm.gender);
  const normalizedAge = profileForm.age !== null && profileForm.age !== undefined && profileForm.age !== "" ? Number(profileForm.age) : null;
  const source = normalizedProfileSource.value;

  const patch = {};

  if (trimmedName !== source.displayName) {
    patch.displayName = trimmedName;
  }
  if (normalizedGender !== source.gender) {
    patch.gender = normalizedGender;
  }
  if (normalizedAge !== source.age) {
    patch.age = normalizedAge;
  }
  if (trimmedPrompt !== source.defaultPrompt) {
    patch.defaultPrompt = trimmedPrompt;
  }

  if (Object.keys(patch).length === 0) {
    profileEditorError.value = "未修改任何資料。";
    return;
  }

  isProfileSaving.value = true;

  try {
    await updateUserProfileDetails(patch);
    isProfileEditorOpen.value = false;
    resetProfileEditorState();
    applyProfileToForm();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "更新個人資料時發生錯誤，請稍後再試。";
    profileEditorError.value = message;
    if (import.meta.env.DEV) {
    }
  } finally {
    isProfileSaving.value = false;
  }
};

const hasBlockingOverlay = computed(
  () =>
    isAvatarModalOpen.value ||
    isProfileEditorOpen.value ||
    isLogoutConfirmVisible.value
);

const shouldListenForGlobalKeydown = computed(
  () =>
    isProfileEditorOpen.value ||
    isSettingsMenuOpen.value ||
    isLogoutConfirmVisible.value
);

watch(
  hasBlockingOverlay,
  (shouldLock) => {
    toggleBodyScrollLock(shouldLock);
  },
  { immediate: true }
);

watchEffect((onCleanup) => {
  if (typeof window === "undefined") {
    return;
  }
  if (!isSettingsMenuOpen.value) {
    settingsError.value = "";
    return;
  }

  const doc = window.document;
  doc.addEventListener("click", handleDocumentClick);

  nextTick(() => {
    const firstMenuItem = settingsMenuRef.value?.querySelector(
      "button.settings-menu__item"
    );
    firstMenuItem?.focus();
  }).catch(() => {});

  onCleanup(() => {
    doc.removeEventListener("click", handleDocumentClick);
  });
});

watchEffect((onCleanup) => {
  if (typeof window === "undefined" || !shouldListenForGlobalKeydown.value) {
    return;
  }

  const listener = handleGlobalKeydown;
  window.addEventListener("keydown", listener);

  onCleanup(() => {
    window.removeEventListener("keydown", listener);
  });
});

watch(isLogoutConfirmVisible, (isOpen) => {
  if (!isOpen) {
    return;
  }
  nextTick(() => {
    logoutConfirmCancelButtonRef.value?.focus();
  }).catch(() => {});
});

onBeforeUnmount(() => {
  toggleBodyScrollLock(false);
});

const ensureProfileLoaded = async (id) => {
  if (!id) return;
  try {
    await loadUserProfile(id, { fallback: fallbackUser });
  } catch (error) {
    if (import.meta.env.DEV) {
    }
  }
};

onMounted(async () => {
  const userId = targetUserId.value;
  void ensureProfileLoaded(userId);

  // 載入 VIP 系統資料
  if (userId) {
    try {
      await Promise.all([
        loadMembership(userId, { skipGlobalLoading: true }),
        loadBalance(userId, { skipGlobalLoading: true }),
        loadTicketsBalance(userId, { skipGlobalLoading: true }),
        loadUserAssets(userId),
      ]);
    } catch (error) {
      if (import.meta.env.DEV) {
      }
    }
  }
});

watch(
  targetUserId,
  (next, prev) => {
    // 不要載入 fallback 用戶資料（demo-user）
    if (next && next !== prev && next !== fallbackUser.id) {
      void ensureProfileLoaded(next);
    }
  },
  { flush: "post" }
);

watch(
  () => profile.value,
  () => {
    if (!isProfileEditorOpen.value) {
      applyProfileToForm();
      resetProfileEditorState();
    }
  },
  { deep: true, immediate: true }
);

watch(isProfileEditorOpen, (isOpen) => {
  if (isOpen) {
    profileEditorError.value = "";
    nextTick(() => {
      profileNameInputRef.value?.focus();
    }).catch(() => {});
  } else {
    applyProfileToForm();
    resetProfileEditorState();
  }
});

watch(
  () => [
    profileForm.displayName,
    profileForm.gender,
    profileForm.age,
    profileForm.defaultPrompt,
  ],
  () => {
    if (suppressProfileFormDirty) return;
    if (isProfileEditorOpen.value) {
      profileEditorError.value = "";
    }
  }
);

watch(
  () => profileForm.displayName,
  (value) => {
    if (suppressProfileFormDirty) return;
    if (typeof value !== "string") {
      suppressProfileFormDirty = true;
      profileForm.displayName = "";
      suppressProfileFormDirty = false;
      return;
    }
    const clamped = clampTextLength(value, PROFILE_MAX_NAME_LENGTH);
    if (clamped !== value) {
      suppressProfileFormDirty = true;
      profileForm.displayName = clamped;
      suppressProfileFormDirty = false;
    }
  }
);

watch(
  () => profileForm.gender,
  (value) => {
    if (suppressProfileFormDirty) return;
    const normalized = normalizeGender(value);
    if (normalized !== value) {
      suppressProfileFormDirty = true;
      profileForm.gender = normalized;
      suppressProfileFormDirty = false;
    }
  }
);

watch(
  () => profileForm.defaultPrompt,
  (value) => {
    if (suppressProfileFormDirty) return;
    if (typeof value !== "string") {
      suppressProfileFormDirty = true;
      profileForm.defaultPrompt = "";
      suppressProfileFormDirty = false;
      return;
    }
    const clamped = clampTextLength(value, PROFILE_MAX_PROMPT_LENGTH);
    if (clamped !== value) {
      suppressProfileFormDirty = true;
      profileForm.defaultPrompt = clamped;
      suppressProfileFormDirty = false;
    }
  }
);
</script>

<template>
  <main class="profile-view" aria-labelledby="profile-heading">
    <section class="profile-hero">
      <div class="profile-hero__overlay"></div>

      <header class="profile-hero__top">
        <button
          type="button"
          class="vip-button"
          :class="{ 'vip-button--active': isVIP || isVVIP }"
          :aria-label="isVIP || isVVIP ? `當前會員: ${tierName}` : '開通 VIP'"
          @click="handleQuickActionSelect({ key: 'membership' })"
        >
          <BoltIcon class="icon" aria-hidden="true" />
          <span>{{ isVIP || isVVIP ? tierName : "開通VIP" }}</span>
        </button>

        <nav class="profile-hero__aux">
          <ul>
            <li
              v-for="action in auxiliaryActions"
              :key="action.key"
              class="profile-hero__aux-item"
              :class="{
                'profile-hero__aux-item--menu': action.key === 'settings',
                'is-open': action.key === 'settings' && isSettingsMenuOpen,
              }"
            >
              <button
                type="button"
                class="aux-button"
                :aria-label="action.label"
                :aria-haspopup="action.key === 'settings' ? 'menu' : undefined"
                :aria-expanded="
                  action.key === 'settings' ? isSettingsMenuOpen : undefined
                "
                :aria-controls="
                  action.key === 'settings'
                    ? 'profile-settings-menu'
                    : undefined
                "
                :ref="action.key === 'settings' ? bindSettingsMenuButton : null"
                @click="handleAuxiliaryAction(action.key, $event)"
              >
                <component :is="action.icon" class="icon" aria-hidden="true" />
              </button>

              <transition name="fade-scale">
                <div
                  v-if="action.key === 'settings' && isSettingsMenuOpen"
                  id="profile-settings-menu"
                  class="settings-menu"
                  role="menu"
                  :ref="bindSettingsMenu"
                  @click.stop
                >
                  <button
                    v-for="option in settingsOptions"
                    :key="option.key"
                    type="button"
                    class="settings-menu__item"
                    :class="{
                      'settings-menu__item--danger':
                        option.variant === 'danger',
                    }"
                    role="menuitem"
                    @click="handleSettingsOptionSelect(option.key)"
                  >
                    {{ option.label }}
                  </button>
                  <p
                    v-if="settingsError"
                    class="settings-menu__error"
                    role="alert"
                  >
                    {{ settingsError }}
                  </p>
                </div>
              </transition>
            </li>
          </ul>
        </nav>
      </header>

      <div class="profile-hero__content">
        <div class="avatar">
          <div class="avatar-ring">
            <img
              v-if="avatarPreview"
              :src="avatarPreview"
              :class="{ 'avatar-ring__image--hidden': isAvatarImageLoading }"
              alt="使用者頭像"
              @load="handleAvatarLoad"
              @error="handleAvatarError"
            />
            <div
              v-if="isAvatarImageLoading"
              class="avatar-ring__spinner"
              role="status"
              aria-label="頭像載入中"
            ></div>
          </div>
          <button
            type="button"
            class="avatar__edit-button"
            aria-label="編輯頭像"
            @click="openAvatarEditor"
          >
            <PencilSquareIcon class="icon" aria-hidden="true" />
          </button>
        </div>

        <div v-if="!isGuest" class="identity">
          <h1 id="profile-heading">{{ profile.displayName }}</h1>
          <p>ID：{{ displayedId }}</p>
        </div>

        <!-- 資產查看按鈕 -->
        <button
          v-if="!isGuest"
          type="button"
          class="stats-button"
          @click="openStatsModal"
        >
          <img
            v-if="isCoinIconAvailable"
            :src="COIN_ICON_PATH"
            alt=""
            class="stats-button__icon stats-button__icon-image"
            decoding="async"
            @error="handleCoinIconError"
          />
          <WalletIcon
            v-else
            class="stats-button__icon stats-button__icon-fallback"
            aria-hidden="true"
          />
          <div class="stats-button__content">
            <span class="stats-button__value">{{ formattedBalance }}</span>
            <span class="stats-button__label">金幣</span>
          </div>
          <ArrowRightIcon class="stats-button__arrow" aria-hidden="true" />
        </button>
      </div>
    </section>

    <section class="quick-actions" aria-label="功能捷徑">
      <ul>
        <li
          v-for="action in quickActions"
          :key="action.key"
          class="quick-action"
        >
          <button
            type="button"
            class="quick-action__button"
            @click="handleQuickActionSelect(action)"
          >
            <span class="quick-action__icon">
              <component :is="action.icon" class="icon" aria-hidden="true" />
              <span
                v-if="action.key === 'notifications' && hasUnreadNotifications"
                class="quick-action__badge"
                aria-hidden="true"
              ></span>
            </span>
            <span class="quick-action__label">{{ action.label }}</span>
          </button>
        </li>
      </ul>
    </section>
  </main>
  <Teleport to="body">
    <div
      v-if="isProfileEditorOpen"
      class="profile-editor-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-editor-title"
      @click.self="handleProfileOverlayClick"
    >
      <div class="profile-editor-dialog">
        <header class="profile-editor-header">
          <div class="profile-editor-header__text">
            <h2 id="profile-editor-title">編輯個人資料</h2>
            <p class="profile-editor-subtitle">
              更新名稱、性別、年齡與角色設定，展現你的個人風格
            </p>
          </div>
          <button
            type="button"
            class="profile-editor-close"
            aria-label="關閉"
            :disabled="isProfileSaving"
            @click="closeProfileEditor"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <form class="profile-editor-form" @submit.prevent="handleProfileSubmit">
          <div class="profile-editor-field">
            <label class="profile-editor-label" for="profile-editor-name">
              名稱
            </label>
            <input
              id="profile-editor-name"
              ref="profileNameInputRef"
              v-model="profileForm.displayName"
              type="text"
              :maxlength="PROFILE_MAX_NAME_LENGTH"
              class="profile-editor-input"
              :disabled="isProfileSaving"
            />
            <div class="profile-editor-meta">
              <span
                >{{ profileDisplayNameLength }} /
                {{ PROFILE_MAX_NAME_LENGTH }}</span
              >
            </div>
            <p
              v-if="profileFormErrors.displayName"
              class="profile-editor-error"
              role="alert"
            >
              {{ profileFormErrors.displayName }}
            </p>
          </div>

          <div class="profile-editor-field">
            <label class="profile-editor-label" for="profile-editor-gender">
              性別
            </label>
            <select
              id="profile-editor-gender"
              v-model="profileForm.gender"
              class="profile-editor-select"
              :disabled="isProfileSaving"
            >
              <option
                v-for="option in genderOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <div class="profile-editor-field">
            <label class="profile-editor-label" for="profile-editor-age">
              年齡
            </label>
            <select
              id="profile-editor-age"
              v-model.number="profileForm.age"
              class="profile-editor-select"
              :disabled="isProfileSaving"
            >
              <option :value="null">請選擇年齡</option>
              <option v-for="age in ageOptions" :key="age" :value="age">
                {{ age }} 歲
              </option>
            </select>
            <p
              v-if="profileFormErrors.age"
              class="profile-editor-error"
              role="alert"
            >
              {{ profileFormErrors.age }}
            </p>
          </div>

          <div class="profile-editor-field">
            <label class="profile-editor-label" for="profile-editor-prompt">
              角色設定
            </label>
            <textarea
              id="profile-editor-prompt"
              v-model="profileForm.defaultPrompt"
              :maxlength="PROFILE_MAX_PROMPT_LENGTH"
              class="profile-editor-textarea"
              rows="4"
              :disabled="isProfileSaving"
            ></textarea>
            <div class="profile-editor-meta profile-editor-meta--counter">
              <span
                >{{ profilePromptLength }} /
                {{ PROFILE_MAX_PROMPT_LENGTH }}</span
              >
            </div>
            <p
              v-if="profileFormErrors.defaultPrompt"
              class="profile-editor-error"
              role="alert"
            >
              {{ profileFormErrors.defaultPrompt }}
            </p>
          </div>

          <p
            v-if="profileEditorError"
            class="profile-editor-error profile-editor-error--global"
            role="alert"
          >
            {{ profileEditorError }}
          </p>

          <footer class="profile-editor-actions">
            <button
              type="button"
              class="profile-editor-btn profile-editor-btn--ghost"
              @click="closeProfileEditor"
              :disabled="isProfileSaving"
            >
              取消
            </button>
            <button
              type="submit"
              class="profile-editor-btn profile-editor-btn--primary"
              :disabled="isProfileSaving || !isProfileFormDirty"
            >
              {{ isProfileSaving ? "儲存中…" : "儲存變更" }}
            </button>
          </footer>
        </form>
      </div>
    </div>
  </Teleport>
  <Teleport to="body">
    <div
      v-if="isLogoutConfirmVisible"
      class="logout-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
    >
      <div
        class="logout-confirm__backdrop"
        role="presentation"
        @click="cancelLogoutConfirm"
      ></div>
      <div class="logout-confirm__panel">
        <header class="logout-confirm__header">
          <h2 id="logout-confirm-title">確認登出</h2>
          <p class="logout-confirm__subtitle">
            登出後需要重新登入才能繼續使用本服務。
          </p>
        </header>
        <p class="logout-confirm__message">確定要登出目前帳號嗎？</p>
        <p v-if="settingsError" class="logout-confirm__error" role="alert">
          {{ settingsError }}
        </p>
        <footer class="logout-confirm__actions">
          <button
            type="button"
            class="logout-confirm__btn"
            ref="logoutConfirmCancelButtonRef"
            @click="cancelLogoutConfirm"
            :disabled="isLoggingOut"
          >
            取消
          </button>
          <button
            type="button"
            class="logout-confirm__btn logout-confirm__btn--danger"
            @click="handleLogout"
            :disabled="isLoggingOut"
          >
            {{ isLoggingOut ? "登出中…" : "確認登出" }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
  <AvatarEditorModal
    v-if="isAvatarModalOpen"
    :default-avatars="builtinAvatarOptions"
    :current-photo="avatarPreview"
    :saving="isAvatarSaving"
    @close="closeAvatarEditor"
    @update="handleAvatarUpdate"
  />

  <StatsModal
    :is-open="isStatsModalOpen"
    :balance="balance"
    :formatted-balance="formattedBalance"
    :character-unlock-cards="userAssets.characterUnlockCards"
    :photo-unlock-cards="userAssets.photoUnlockCards"
    :video-unlock-cards="userAssets.videoUnlockCards"
    :voice-unlock-cards="userAssets.voiceUnlockCards"
    :create-cards="userAssets.createCards"
    :potions="userAssets.potions"
    :tier="tier"
    :tier-name="tierName"
    :is-paid-member="isPaidMember"
    :formatted-expiry-date="formattedExpiryDate"
    :days-until-expiry="daysUntilExpiry"
    :is-expiring-soon="isExpiringSoon"
    :current-photo-usage="0"
    :current-character-creations="0"
    @close="closeStatsModal"
    @buy-unlock-card="handleBuyUnlockCard"
    @use-unlock-card="handleUseUnlockCard"
    @use-potion="handleUsePotion"
  />
</template>

<style scoped lang="scss">
.profile-view {
  position: relative;
  min-height: 100vh;
  background: #0f1016;
  color: #f8f9ff;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding-bottom: calc(var(--bottom-nav-offset, 90px) + 1.5rem);
}

.profile-hero {
  position: relative;
  overflow: hidden;
  padding: 1.5rem 1.75rem 3.5rem;
  background: linear-gradient(140deg, #ff4d8f 0%, #e458b6 45%, #c567ff 100%);

  &__overlay {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 20% 20%,
      rgba(255, 255, 255, 0.18) 0%,
      transparent 48%
    );
    pointer-events: none;
  }

  &__top {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__aux ul {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-top: clamp(1.5rem, 4vw, 2.5rem);
  }
}

.vip-button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  transition: background 150ms ease, transform 150ms ease,
    border-color 150ms ease;

  .icon {
    width: 18px;
    height: 18px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.22);
    border-color: rgba(255, 255, 255, 0.75);
    transform: translateY(-1px);
  }
}

.aux-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  transition: background 150ms ease, transform 150ms ease,
    border-color 150ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.35);
    transform: translateY(-1px);
  }

  .icon {
    width: 20px;
    height: 20px;
  }
}

.profile-hero__aux-item {
  position: relative;
}

.profile-hero__aux-item.is-open .aux-button {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.45);
}

.settings-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 190px;
  padding: 0.6rem;
  border-radius: 16px;
  background: rgba(15, 17, 28, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 18px 36px rgba(15, 17, 28, 0.55);
  backdrop-filter: blur(14px);
  z-index: 2300;
}

.settings-menu__item {
  display: block;
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: #e2e8f0;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  text-align: left;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}

.settings-menu__item:hover,
.settings-menu__item:focus {
  background: rgba(148, 163, 184, 0.2);
  color: #f8fafc;
  outline: none;
}

.settings-menu__item--danger {
  color: #fca5a5;
}

.settings-menu__item--danger:hover,
.settings-menu__item--danger:focus {
  background: rgba(248, 113, 113, 0.18);
  color: #fecaca;
}

.settings-menu__error {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: #fca5a5;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
  transform-origin: top right;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}

.logout-confirm {
  position: fixed;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.logout-confirm__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 17, 28, 0.72);
  backdrop-filter: blur(4px);
  cursor: pointer;
}

.logout-confirm__panel {
  position: relative;
  width: min(420px, 90vw);
  padding: 1.6rem;
  border-radius: 20px;
  background: rgba(22, 25, 36, 0.98);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 28px 56px rgba(15, 17, 28, 0.6);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  color: #e2e8f0;
}

.logout-confirm__header h2 {
  margin: 0;
  font-size: 1.2rem;
  letter-spacing: 0.08em;
}

.logout-confirm__subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  color: rgba(203, 213, 225, 0.78);
}

.logout-confirm__message {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  color: rgba(226, 232, 240, 0.92);
}

.logout-confirm__error {
  margin: 0;
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  background: rgba(248, 113, 113, 0.16);
  border: 1px solid rgba(248, 113, 113, 0.36);
  font-size: 0.82rem;
  letter-spacing: 0.05em;
  color: #fecaca;
}

.logout-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.logout-confirm__btn {
  min-width: 110px;
  padding: 0.55rem 1.35rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 17, 28, 0.85);
  color: rgba(226, 232, 240, 0.92);
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease,
    transform 150ms ease;

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    background: rgba(148, 163, 184, 0.22);
    border-color: rgba(148, 163, 184, 0.55);
    outline: none;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.logout-confirm__btn--danger {
  background: linear-gradient(135deg, #f43f5e, #fb7185);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 16px 28px rgba(244, 63, 94, 0.45);

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 18px 36px rgba(244, 63, 94, 0.55);
  }
}

.avatar {
  position: relative;

  &-ring {
    width: 6rem;
    height: 6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    position: relative;
    overflow: hidden;

    img {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      transition: opacity 200ms ease;
    }

    &__image--hidden {
      opacity: 0;
    }

    &__spinner {
      position: absolute;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border: 3px solid rgba(255, 255, 255, 0.25);
      border-top-color: #ffffff;
      animation: avatar-ring-spin 1s linear infinite;
    }
  }

  &__edit-button {
    position: absolute;
    bottom: 0;
    right: 0;
    transform: translate(0%, 0%);
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
    color: #fff;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
    transition: transform 150ms ease, box-shadow 150ms ease;

    &:hover {
      transform: translate(30%, 30%) scale(1.05);
      box-shadow: 0 14px 28px rgba(0, 0, 0, 0.35);
    }

    &:focus-visible {
      outline: 2px solid rgba(255, 255, 255, 0.8);
      outline-offset: 2px;
    }

    .icon {
      width: 20px;
      height: 20px;
    }
  }
}

.identity {
  text-align: center;

  h1 {
    margin: 0;
    font-size: clamp(1.5rem, 5vw, 1.75rem);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
  }

  p {
    margin: 0.35rem 0 0;
    font-size: 0.95rem;
    letter-spacing: 0.06em;
    color: rgba(248, 250, 252, 0.92);
  }
}

/* 資產查看按鈕 - 簡潔版 */
.stats-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  margin-top: 1rem;
  padding: 0.875rem 1.125rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.stats-button:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

.stats-button:active {
  transform: translateY(0);
}

.stats-button__icon {
  width: 20px;
  height: 20px;
  color: #fbbf24;
  flex-shrink: 0;
}

.stats-button__icon-image {
  width: 24px;
  height: 24px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(251, 191, 36, 0.3));
}

.stats-button__icon-fallback {
  width: 20px;
  height: 20px;
  color: #fbbf24;
}

.stats-button__content {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
}

.stats-button__value {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #fff;
}

.stats-button__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.stats-button__arrow {
  width: 18px;
  height: 18px;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
  transition: transform 0.2s ease, color 0.2s ease;
}

.stats-button:hover .stats-button__arrow {
  transform: translateX(3px);
  color: rgba(255, 255, 255, 0.8);
}

/* 響應式設計 */
@media (max-width: 640px) {
  .stats-button {
    padding: 0.75rem 1rem;
  }

  .stats-button__icon {
    width: 18px;
    height: 18px;
  }

  .stats-button__icon-image {
    width: 22px;
    height: 22px;
  }

  .stats-button__icon-fallback {
    width: 18px;
    height: 18px;
  }

  .stats-button__value {
    font-size: 1.125rem;
  }
}

/* VIP 按鈕啟用狀態 */
.vip-button--active {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-color: rgba(251, 191, 36, 0.8);
  box-shadow: 0 8px 24px rgba(251, 191, 36, 0.35);
}

.vip-button--active:hover {
  background: linear-gradient(135deg, #fcd34d, #fbbf24);
  box-shadow: 0 10px 28px rgba(251, 191, 36, 0.45);
}
.quick-actions {
  margin-top: -3.5rem;
  position: relative;
  ul {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    margin: 0;
    padding: 0.75rem 0.75rem;
    list-style: none;
    background: linear-gradient(160deg, #181828, #141420);
    border-radius: 30px;
    border: 1px solid rgba(148, 163, 184, 0.12);
    box-shadow: 0 18px 38px rgba(8, 10, 24, 0.35);
    gap: 0.75rem;
  }
}

.quick-action {
  display: flex;
  justify-content: center;

  &__button {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 0.5rem;
    border-radius: 18px;
    border: none;
    background: transparent;
    color: #f1f5f9;
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    transition: background 150ms ease, transform 150ms ease;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-2px);
    }
  }

  &__icon {
    position: relative;
    width: 48px;
    height: 48px;
    border-radius: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.16), transparent);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);

    .icon {
      width: 22px;
      height: 22px;
    }
  }

  &__badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
    box-shadow: 0 0 0 2px rgba(14, 18, 34, 0.9);
  }

  &__label {
    color: rgba(241, 245, 249, 0.92);
  }
}

.profile-editor-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(10, 12, 24, 0.65);
  backdrop-filter: blur(10px);
}

.profile-editor-dialog {
  width: min(520px, 100%);
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: linear-gradient(
    170deg,
    rgba(16, 18, 30, 0.96),
    rgba(20, 18, 40, 0.98)
  );
  box-shadow: 0 26px 52px rgba(8, 9, 20, 0.6);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.profile-editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
}

.profile-editor-header__text h2 {
  margin: 0;
  font-size: 1.35rem;
  letter-spacing: 0.08em;
}

.profile-editor-header__text {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.profile-editor-subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  color: rgba(226, 232, 240, 0.65);
}

.profile-editor-close {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 17, 28, 0.85);
  color: rgba(226, 232, 240, 0.85);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;

  &:hover:not(:disabled) {
    background: rgba(148, 163, 184, 0.28);
    border-color: rgba(226, 232, 240, 0.45);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.profile-editor-form {
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
}

.profile-editor-field {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.profile-editor-label {
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  color: rgba(226, 232, 240, 0.8);
}

.profile-editor-input,
.profile-editor-select,
.profile-editor-textarea {
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(17, 20, 32, 0.85);
  color: #f8f9ff;
  font-size: 0.95rem;
  letter-spacing: 0.03em;
  padding: 0.65rem 0.8rem;
  transition: border-color 150ms ease, box-shadow 150ms ease;

  &:focus {
    outline: none;
    border-color: rgba(96, 165, 250, 0.65);
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

.profile-editor-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23f8f9ff' d='M6 8.5L2 4.5h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-color: rgba(17, 20, 32, 0.85);
  padding-right: 2.5rem;
  cursor: pointer;

  &:focus {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23f8f9ff' d='M6 8.5L2 4.5h8z'/%3E%3C/svg%3E");
  }
}

.profile-editor-select option {
  background: #1a1d2e;
  color: #f8f9ff;
}

.profile-editor-textarea {
  min-height: 120px;
  resize: vertical;
  line-height: 1.6;
}

.profile-editor-meta {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: rgba(148, 163, 184, 0.7);
}

.profile-editor-meta--counter {
  align-self: flex-end;
}

.profile-editor-error {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  color: #fca5a5;
}

.profile-editor-error--global {
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.3);
}

.profile-editor-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.profile-editor-btn {
  min-width: 108px;
  border-radius: 999px;
  padding: 0.6rem 1.4rem;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
}

.profile-editor-btn--ghost {
  background: rgba(15, 17, 28, 0.7);
  border-color: rgba(148, 163, 184, 0.3);
  color: rgba(226, 232, 240, 0.85);

  &:hover:not(:disabled) {
    background: rgba(148, 163, 184, 0.25);
    box-shadow: 0 12px 24px rgba(15, 17, 28, 0.35);
  }
}

.profile-editor-btn--primary {
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  color: #fff;
  box-shadow: 0 16px 30px rgba(255, 77, 143, 0.4);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 18px 36px rgba(255, 77, 143, 0.48);
  }
}

@keyframes avatar-ring-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 560px) {
  .quick-actions ul {
    gap: 0.5rem;
  }

  .profile-editor-dialog {
    padding: 1.3rem;
  }

  .profile-editor-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
