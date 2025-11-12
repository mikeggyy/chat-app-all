<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from "vue";
import { useRouter } from "vue-router";
import { logger } from "@/utils/logger";
import AvatarEditorModal from "../components/AvatarEditorModal.vue";
import StatsModal from "../components/StatsModal.vue";
import ProfileVIPCard from "../components/profile/ProfileVIPCard.vue";
import ProfileAssets from "../components/profile/ProfileAssets.vue";
import ProfileQuickActions from "../components/profile/ProfileQuickActions.vue";
import AuxiliaryActions from "../components/profile/AuxiliaryActions.vue";
import ProfileEditor from "../components/profile/ProfileEditor.vue";
import LogoutConfirmDialog from "../components/profile/LogoutConfirmDialog.vue";
import { useProfileData } from "../composables/useProfileData";
import { useFirebaseAuth } from "../composables/useFirebaseAuth";
import { useProfileEditor } from "../composables/useProfileEditor";
import { useAvatarUpload } from "../composables/useAvatarUpload";
import { useSettings } from "../composables/useSettings";
import { clearTestSession } from "../services/testAuthSession";
import {
  FALLBACK_USER,
  BUILTIN_AVATAR_OPTIONS,
  QUICK_ACTION_ROUTES,
  ASSET_TYPE_MAP,
  CARD_CATEGORY_MAP,
} from "../config/profile";

// ==================== 初始化 ====================

const router = useRouter();
const firebaseAuth = useFirebaseAuth();

// 使用整合的 useProfileData composable
const {
  profile,
  targetUserId,
  displayedId,
  loadUserProfile,
  updateUserAvatar,
  updateUserProfileDetails,
  clearUserProfile,
  tier,
  tierName,
  isVIP,
  isVVIP,
  isPaidMember,
  formattedExpiryDate,
  daysUntilExpiry,
  isExpiringSoon,
  balance,
  formattedBalance,
  hasUnreadNotifications,
  requireLogin,
  isGuest,
  userAssets,
  loadUserAssets,
  initializeProfileData,
  refreshProfileData,
} = useProfileData();

// ==================== 頭像管理 ====================

const avatarPreview = ref(FALLBACK_USER.photoURL);

watch(
  () => profile.value.photoURL,
  (next) => {
    const nextSrc = next ?? FALLBACK_USER.photoURL;
    if (nextSrc !== avatarPreview.value) {
      avatarUpload.isImageLoading.value = true;
    }
    avatarPreview.value = nextSrc;
  },
  { immediate: true }
);

const avatarUpload = useAvatarUpload({
  onUpdate: updateUserAvatar,
  avatarPreview,
});

const openAvatarEditor = () => {
  if (requireLogin({ feature: "編輯頭像" })) {
    return;
  }
  avatarUpload.openEditor();
};

// ==================== 個人資料編輯 ====================

const profileEditor = useProfileEditor(profile, updateUserProfileDetails);

const openProfileEditor = () => {
  if (requireLogin({ feature: "編輯個人資料" })) {
    return;
  }
  profileEditor.open();
};

// ==================== 設定與登出 ====================

const handleLogout = async () => {
  await firebaseAuth.signOut();
  clearUserProfile();
  clearTestSession();
  await router.replace({ name: "login" });
};

const settings = useSettings({
  onLogout: handleLogout,
});

// ==================== 統計彈窗 ====================

const isStatsModalOpen = ref(false);

const openStatsModal = () => {
  isStatsModalOpen.value = true;
};

const closeStatsModal = () => {
  isStatsModalOpen.value = false;
};

// ==================== 快捷操作 ====================

const handleQuickActionSelect = async (action) => {
  if (!action || typeof action !== "object") {
    return;
  }

  const routeName = QUICK_ACTION_ROUTES[action.key];

  if (!routeName) {
    return;
  }

  try {
    await router.push({ name: routeName });
  } catch (error) {
    // 路由導航失敗（忽略）
  }
};

const handleBuyUnlockCard = (cardType) => {
  const category = CARD_CATEGORY_MAP[cardType] || "coins";
  router.push({ path: "/shop", query: { category } });
};

const handleUsePotion = async (potionType) => {
  try {
    const { useToast } = await import("../composables/useToast");
    const { warning } = useToast();

    if (potionType === "memoryBoost") {
      warning("請在與角色聊天時使用記憶增強藥水");
      return;
    }

    if (potionType === "brainBoost") {
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

    const assetType = ASSET_TYPE_MAP[cardType];
    if (!assetType) return;

    await apiJson(
      `/api/users/${encodeURIComponent(targetUserId.value)}/assets/consume`,
      {
        method: "POST",
        body: JSON.stringify({ assetType, amount: 1 }),
      }
    );

    await loadUserAssets(targetUserId.value);
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.error("使用解鎖卡失敗:", error);
    }
  }
};

// ==================== 滾動鎖定 ====================

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

const hasBlockingOverlay = computed(
  () =>
    avatarUpload.isModalOpen.value ||
    profileEditor.isOpen.value ||
    settings.isLogoutConfirmVisible.value
);

const shouldListenForGlobalKeydown = computed(
  () =>
    profileEditor.isOpen.value ||
    settings.isMenuOpen.value ||
    settings.isLogoutConfirmVisible.value
);

watch(
  hasBlockingOverlay,
  (shouldLock) => {
    toggleBodyScrollLock(shouldLock);
  },
  { immediate: true }
);

// ==================== 鍵盤事件 ====================

const handleGlobalKeydown = (event) => {
  if (event.key !== "Escape") return;
  if (profileEditor.isOpen.value) {
    event.preventDefault();
    profileEditor.close();
    return;
  }
  if (settings.isLogoutConfirmVisible.value) {
    event.preventDefault();
    settings.cancelLogoutConfirm();
    return;
  }
  if (settings.isMenuOpen.value) {
    event.preventDefault();
    settings.closeMenu();
  }
};

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

// ==================== 生命週期 ====================

onBeforeUnmount(() => {
  toggleBodyScrollLock(false);
});

const ensureProfileLoaded = async (id) => {
  if (!id) return;
  try {
    await loadUserProfile(id, { fallback: FALLBACK_USER });
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.error("[ProfileView] 載入個人資料失敗:", error);
    }
  }
};

onMounted(async () => {
  const userId = targetUserId.value;
  void ensureProfileLoaded(userId);

  // 使用整合的 initializeProfileData 載入所有資料
  if (userId) {
    try {
      await initializeProfileData(userId);
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.error("[ProfileView] 初始化資料失敗:", error);
      }
    }
  }
});

watch(
  targetUserId,
  (next, prev) => {
    // 不要載入 fallback 用戶資料（demo-user）
    if (next && next !== prev && next !== FALLBACK_USER.id) {
      void ensureProfileLoaded(next);
    }
  },
  { flush: "post" }
);

watch(
  () => profile.value,
  () => {
    if (!profileEditor.isOpen.value) {
      profileEditor.applyProfileToForm();
      profileEditor.resetEditorState();
    }
  },
  { deep: true, immediate: true }
);

watch(profileEditor.isOpen, (isOpen) => {
  if (!isOpen) {
    profileEditor.applyProfileToForm();
    profileEditor.resetEditorState();
  }
});

// 監聽表單欄位變化
watch(
  () => [
    profileEditor.form.displayName,
    profileEditor.form.gender,
    profileEditor.form.age,
    profileEditor.form.defaultPrompt,
  ],
  ([displayName, gender, age, defaultPrompt]) => {
    profileEditor.watchFormField("displayName", displayName);
    profileEditor.watchFormField("gender", gender);
    profileEditor.watchFormField("age", age);
    profileEditor.watchFormField("defaultPrompt", defaultPrompt);
  }
);
</script>

<template>
  <main class="profile-view" aria-labelledby="profile-heading">
    <section class="profile-hero">
      <div class="profile-hero__overlay"></div>

      <header class="profile-hero__top">
        <ProfileVIPCard
          :tier="tier"
          :tier-name="tierName"
          :is-v-i-p="isVIP"
          :is-v-v-i-p="isVVIP"
          :is-paid-member="isPaidMember"
          :formatted-expiry-date="formattedExpiryDate"
          :days-until-expiry="daysUntilExpiry"
          :is-expiring-soon="isExpiringSoon"
          :is-guest="isGuest"
          @upgrade-click="handleQuickActionSelect({ key: 'membership' })"
        />

        <AuxiliaryActions
          :is-settings-menu-open="settings.isMenuOpen.value"
          :settings-error="settings.error.value"
          :settings-menu-button-ref="settings.bindMenuButton"
          :settings-menu-ref="settings.bindMenu"
          @edit-click="openProfileEditor"
          @settings-toggle="settings.toggleMenu"
          @settings-option-select="settings.handleOptionSelect"
        />
      </header>

      <div class="profile-hero__content">
        <div class="avatar">
          <div class="avatar-ring">
            <img
              v-if="avatarPreview"
              :src="avatarPreview"
              :class="{ 'avatar-ring__image--hidden': avatarUpload.isImageLoading.value }"
              alt="使用者頭像"
              @load="avatarUpload.handleLoad"
              @error="avatarUpload.handleError"
            />
            <div
              v-if="avatarUpload.isImageLoading.value"
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
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
        </div>

        <div v-if="!isGuest" class="identity">
          <h1 id="profile-heading">{{ profile.displayName }}</h1>
          <p>ID：{{ displayedId }}</p>
        </div>

        <!-- 資產查看按鈕 -->
        <ProfileAssets
          :balance="balance"
          :is-guest="isGuest"
          @open-stats="openStatsModal"
        />
      </div>
    </section>

    <ProfileQuickActions
      :has-unread-notifications="hasUnreadNotifications"
      @action-select="handleQuickActionSelect"
    />
  </main>

  <!-- 頭像編輯器 -->
  <AvatarEditorModal
    v-if="avatarUpload.isModalOpen.value"
    :default-avatars="BUILTIN_AVATAR_OPTIONS"
    :current-photo="avatarPreview"
    :saving="avatarUpload.isSaving.value"
    @close="avatarUpload.closeEditor"
    @update="avatarUpload.handleUpdate"
  />

  <!-- 個人資料編輯器 -->
  <ProfileEditor
    :is-open="profileEditor.isOpen.value"
    :is-saving="profileEditor.isSaving.value"
    :error="profileEditor.error.value"
    :form="profileEditor.form"
    :form-errors="profileEditor.formErrors"
    :display-name-length="profileEditor.displayNameLength.value"
    :prompt-length="profileEditor.promptLength.value"
    :is-form-dirty="profileEditor.isFormDirty.value"
    :input-ref="profileEditor.inputRef"
    @close="profileEditor.close"
    @submit="profileEditor.submit"
    @overlay-click="profileEditor.close"
  />

  <!-- 登出確認對話框 -->
  <LogoutConfirmDialog
    :is-visible="settings.isLogoutConfirmVisible.value"
    :is-logging-out="settings.isLoggingOut.value"
    :error="settings.error.value"
    :cancel-button-ref="settings.bindLogoutCancelButton"
    @cancel="settings.cancelLogoutConfirm"
    @confirm="settings.confirmLogout"
  />

  <!-- 統計彈窗 -->
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
  // CSS 變數定義 - 限定在組件作用域內
  --color-bg-primary: #0f1118;
  --color-bg-secondary: rgba(30, 33, 48, 0.9);
  --color-text-primary: #f8fafc;
  --color-text-secondary: rgba(226, 232, 240, 0.92);
  --color-border: rgba(148, 163, 184, 0.25);
  --color-border-light: rgba(148, 163, 184, 0.2);
  --color-overlay: rgba(30, 33, 48, 0.7);
  --color-danger: #fca5a5;
  --gradient-primary: linear-gradient(135deg, #667eea, #764ba2);
  --gradient-danger: linear-gradient(135deg, #ef4444, #dc2626);
  --gradient-success: linear-gradient(135deg, #22c55e, #16a34a);
  --transition-base: 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  --border-radius-lg: 16px;
  --border-radius-xl: 24px;
  --border-radius-full: 999px;

  // 基本樣式
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  background: linear-gradient(to bottom, #0f1118 0%, #16192b 100%);
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding-bottom: calc(var(--bottom-nav-offset, 90px) + 1.5rem);
}

.profile-hero {
  position: relative;
  overflow: hidden;
  padding: 1.5rem 1.75rem 3.5rem;
  background: linear-gradient(165deg, #1e2130 0%, #16192b 50%, #0f1118 100%);

  &__overlay {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at 30% 20%,
      rgba(102, 126, 234, 0.15) 0%,
      transparent 60%
    );
    pointer-events: none;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(102, 126, 234, 0.3) 50%,
      transparent 100%
    );
  }

  &__top {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
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
    width: 32px;
    height: 32px;
    border: 2px solid rgba(22, 25, 36, 0.8);
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

    &:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
      background: linear-gradient(135deg, #5568d3 0%, #6a3f92 100%);
    }

    &:active {
      transform: scale(0.95);
      box-shadow: 0 4px 10px rgba(102, 126, 234, 0.35);
    }

    &:focus-visible {
      outline: 2px solid rgba(102, 126, 234, 0.6);
      outline-offset: 2px;
    }

    .icon {
      width: 18px;
      height: 18px;
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

@keyframes avatar-ring-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
