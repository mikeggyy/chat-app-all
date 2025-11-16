<script setup lang="ts">
import { computed } from "vue";
import { PencilSquareIcon } from "@heroicons/vue/24/outline";

interface UserProfile {
  displayName?: string;
  [key: string]: any;
}

interface Props {
  profile: UserProfile;
  avatarPreview?: string;
  isAvatarImageLoading?: boolean;
  displayedId?: string;
  tier?: string;
  tierName?: string;
  isVIP?: boolean;
  isVVIP?: boolean;
  isPaidMember?: boolean;
  formattedExpiryDate?: string;
  daysUntilExpiry?: number;
  isExpiringSoon?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  avatarPreview: "",
  isAvatarImageLoading: false,
  displayedId: "",
  tier: "free",
  tierName: "免費會員",
  isVIP: false,
  isVVIP: false,
  isPaidMember: false,
  formattedExpiryDate: "",
  daysUntilExpiry: 0,
  isExpiringSoon: false,
});

const emit = defineEmits<{
  "open-avatar-editor": [];
  "open-profile-editor": [];
  "avatar-load": [];
  "avatar-error": [];
}>();

const vipBadgeClass = computed(() => {
  if (props.isVVIP) return "vvip";
  if (props.isVIP) return "vip";
  return "";
});

const vipBadgeText = computed(() => {
  if (props.isVVIP) return "VVIP";
  if (props.isVIP) return "VIP";
  return "";
});

const displayName = computed(() => {
  return props.profile?.displayName || "未設定名稱";
});
</script>

<template>
  <div class="profile-header">
    <!-- Avatar Section -->
    <div class="profile-avatar-wrapper">
      <button
        type="button"
        class="profile-avatar-edit-btn"
        aria-label="編輯頭像"
        @click="emit('open-avatar-editor')"
      >
        <div v-if="isAvatarImageLoading" class="profile-avatar-skeleton">
          <div class="skeleton-spinner"></div>
        </div>
        <img
          v-else
          :src="avatarPreview"
          alt="個人頭像"
          class="profile-avatar-image"
          @load="emit('avatar-load')"
          @error="emit('avatar-error')"
        />
        <div class="profile-avatar-overlay">
          <PencilSquareIcon class="edit-icon" aria-hidden="true" />
        </div>
      </button>

      <!-- VIP Badge -->
      <div
        v-if="isPaidMember"
        class="profile-vip-badge"
        :class="vipBadgeClass"
      >
        {{ vipBadgeText }}
      </div>
    </div>

    <!-- Profile Info -->
    <div class="profile-info">
      <div class="profile-name-row">
        <h1 class="profile-name">{{ displayName }}</h1>
        <button
          type="button"
          class="profile-edit-btn"
          aria-label="編輯個人資料"
          @click="emit('open-profile-editor')"
        >
          <PencilSquareIcon class="icon" aria-hidden="true" />
        </button>
      </div>

      <p class="profile-id">ID: {{ displayedId }}</p>

      <!-- VIP Status -->
      <div v-if="isPaidMember" class="profile-vip-status">
        <span class="vip-tier-name">{{ tierName }}</span>
        <span v-if="formattedExpiryDate" class="vip-expiry">
          <span v-if="isExpiringSoon" class="expiry-warning">即將到期</span>
          到期日：{{ formattedExpiryDate }}
          <span v-if="daysUntilExpiry > 0" class="days-remaining">
            （剩餘 {{ daysUntilExpiry }} 天）
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1.5rem;
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.95) 0%,
    rgba(15, 23, 42, 0.95) 100%
  );
  border-radius: 20px;
  margin-bottom: 1.5rem;
}

/* Avatar Section */
.profile-avatar-wrapper {
  position: relative;
  margin-bottom: 1.5rem;
}

.profile-avatar-edit-btn {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid rgba(148, 163, 184, 0.3);
  cursor: pointer;
  transition: all 0.3s ease;
  background: transparent;
  padding: 0;

  &:hover {
    border-color: #3b82f6;
    transform: scale(1.05);

    .profile-avatar-overlay {
      opacity: 1;
    }
  }
}

.profile-avatar-skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    rgba(51, 65, 85, 0.5) 25%,
    rgba(71, 85, 105, 0.5) 50%,
    rgba(51, 65, 85, 0.5) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skeleton-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(148, 163, 184, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.profile-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;

  .edit-icon {
    width: 32px;
    height: 32px;
    color: white;
  }
}

/* VIP Badge */
.profile-vip-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  padding: 0.25rem 0.6rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  color: white;
  border: 2px solid rgba(15, 23, 42, 0.95);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  &.vip {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
  }

  &.vvip {
    background: linear-gradient(135deg, #ec4899, #db2777);
  }
}

/* Profile Info */
.profile-info {
  text-align: center;
  width: 100%;
}

.profile-name-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.profile-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.profile-edit-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  .icon {
    width: 18px;
    height: 18px;
  }

  &:hover {
    background: rgba(59, 130, 246, 0.2);
    transform: translateY(-1px);
  }
}

.profile-id {
  font-size: 0.875rem;
  color: rgba(226, 232, 240, 0.6);
  margin: 0 0 1rem 0;
}

/* VIP Status */
.profile-vip-status {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.vip-tier-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #60a5fa;
}

.vip-expiry {
  font-size: 0.75rem;
  color: rgba(226, 232, 240, 0.7);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.expiry-warning {
  color: #fbbf24;
  font-weight: 600;
}

.days-remaining {
  color: rgba(226, 232, 240, 0.5);
}

@media (max-width: 640px) {
  .profile-header {
    padding: 1.5rem 1rem;
  }

  .profile-avatar-edit-btn {
    width: 100px;
    height: 100px;
  }

  .profile-name {
    font-size: 1.25rem;
  }
}
</style>
