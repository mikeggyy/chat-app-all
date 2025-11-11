<script setup>
import { computed } from "vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";

// Modal Components
import ConversationLimitModal from "../ConversationLimitModal.vue";
import VoiceLimitModal from "../VoiceLimitModal.vue";
import PhotoLimitModal from "../PhotoLimitModal.vue";
import VideoLimitModal from "../VideoLimitModal.vue";
import ImageViewerModal from "../ImageViewerModal.vue";
import GiftSelectorModal from "../GiftSelectorModal.vue";
import GiftAnimation from "../GiftAnimation.vue";
import PotionConfirmModal from "../PotionConfirmModal.vue";
import PotionLimitModal from "../PotionLimitModal.vue";
import CharacterUnlockConfirmModal from "../CharacterUnlockConfirmModal.vue";
import CharacterUnlockLimitModal from "../CharacterUnlockLimitModal.vue";
import PhotoSelectorModal from "./PhotoSelectorModal.vue";

const props = defineProps({
  // Modals state
  modals: {
    type: Object,
    required: true,
  },

  // Partner data
  partnerDisplayName: {
    type: String,
    default: "",
  },
  partnerBackground: {
    type: String,
    default: "",
  },
  partnerId: {
    type: String,
    default: "",
  },
  partner: {
    type: Object,
    default: null,
  },

  // Potion data
  userPotions: {
    type: Object,
    default: () => ({ memoryBoost: 0, brainBoost: 0 }),
  },
  activeMemoryBoost: {
    type: Object,
    default: null,
  },
  activeBrainBoost: {
    type: Object,
    default: null,
  },
  activeCharacterUnlock: {
    type: Object,
    default: null,
  },

  // Cards/Tickets
  characterTickets: {
    type: Number,
    default: 0,
  },
  voiceCards: {
    type: Number,
    default: 0,
  },
  photoCards: {
    type: Number,
    default: 0,
  },
  videoCards: {
    type: Number,
    default: 0,
  },

  // Gift
  showGiftSelector: {
    type: Boolean,
    default: false,
  },
  balance: {
    type: Number,
    default: 0,
  },
  membershipTier: {
    type: String,
    default: "free",
  },
});

const emit = defineEmits([
  // Reset
  "cancel-reset",
  "confirm-reset",

  // Character Info
  "close-character-info",

  // Potion
  "close-potion-confirm",
  "confirm-use-potion",
  "close-potion-limit",

  // Character Unlock
  "close-unlock-confirm",
  "confirm-unlock-character",
  "close-unlock-limit",

  // Buff Details
  "close-buff-details",

  // Limit Modals
  "close-conversation-limit",
  "watch-ad",
  "use-unlock-card",
  "close-voice-limit",
  "watch-voice-ad",
  "use-voice-unlock-card",
  "close-photo-limit",
  "use-photo-unlock-card",
  "close-video-limit",
  "use-video-unlock-card",
  "upgrade-membership",

  // Photo Selector
  "close-photo-selector",
  "photo-select",

  // Image Viewer
  "close-image-viewer",

  // Gift
  "close-gift-selector",
  "select-gift",
]);

// Computed: Current buff details
const currentBuffDetails = computed(() => {
  const buffType = props.modals.buffDetails.type;
  if (!buffType) return null;

  // Determine which effect to display
  let effect = null;
  let name = "";
  let icon = "";
  let description = "";

  if (buffType === "memory") {
    effect = props.activeMemoryBoost;
    name = "記憶增強藥水";
    icon = "🧠";
    description = `${props.partnerDisplayName}的對話記憶上限增加 10,000 tokens`;
  } else if (buffType === "brain") {
    effect = props.activeBrainBoost;
    name = "腦力激盪藥水";
    icon = "⚡";
    description = "AI 模型升級為最高階模型，提供更聰明的對話體驗";
  } else if (buffType === "unlock") {
    effect = props.activeCharacterUnlock;
    name = "角色解鎖卡";
    icon = "🎫";
    description = `與「${props.partnerDisplayName}」暢聊無限次，無需消耗對話次數`;
  }

  if (!effect) return null;

  // Calculate remaining time
  const now = new Date();
  const expiresAt = new Date(effect.expiresAt || effect.unlockUntil);
  const remainingMs = expiresAt - now;
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  return {
    name,
    icon,
    description,
    activatedAt: new Date(effect.activatedAt || effect.unlockUntil).toLocaleString("zh-TW"),
    expiresAt: expiresAt.toLocaleString("zh-TW"),
    remainingDays,
  };
});
</script>

<template>
  <!-- Teleport Modals -->
  <Teleport to="body">
    <!-- Reset Confirmation -->
    <div v-if="modals.resetConfirm.show" class="chat-confirm-backdrop">
      <div
        class="chat-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-reset-confirm-title"
      >
        <header class="chat-confirm-header">
          <h2 id="chat-reset-confirm-title">重置對話</h2>
          <button
            type="button"
            class="chat-confirm-close"
            aria-label="關閉"
            @click="emit('cancel-reset')"
          >
            <XMarkIcon class="icon" aria-hidden="true" />
          </button>
        </header>
        <p>這將清除與此角色的所有聊天紀錄，確認要繼續嗎？</p>
        <footer class="chat-confirm-footer">
          <button
            type="button"
            class="chat-confirm-btn"
            @click="emit('cancel-reset')"
          >
            取消
          </button>
          <button
            type="button"
            class="chat-confirm-btn is-danger"
            :disabled="modals.resetConfirm.loading"
            @click="emit('confirm-reset')"
          >
            {{ modals.resetConfirm.loading ? "重置中…" : "確定重置" }}
          </button>
        </footer>
      </div>
    </div>

    <!-- Character Info -->
    <div v-if="modals.characterInfo.show" class="chat-confirm-backdrop">
      <div
        class="chat-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-character-info-title"
      >
        <header class="chat-confirm-header">
          <h2 id="chat-character-info-title">角色資訊</h2>
          <button
            type="button"
            class="chat-confirm-close"
            aria-label="關閉"
            @click="emit('close-character-info')"
          >
            <XMarkIcon class="icon" aria-hidden="true" />
          </button>
        </header>
        <p>{{ partnerBackground }}</p>
      </div>
    </div>

    <!-- Potion Confirmation Modal -->
    <PotionConfirmModal
      :is-open="modals.potionConfirm.show"
      :potion-type="modals.potionConfirm.type"
      :character-name="partnerDisplayName"
      :remaining-count="
        modals.potionConfirm.type === 'memoryBoost'
          ? userPotions.memoryBoost
          : userPotions.brainBoost
      "
      @close="emit('close-potion-confirm')"
      @confirm="emit('confirm-use-potion')"
    />

    <!-- Potion Limit Modal (No Potion Available) -->
    <PotionLimitModal
      :is-open="modals.potionLimit.show"
      :potion-type="modals.potionLimit.type"
      :character-name="partnerDisplayName"
      @close="emit('close-potion-limit')"
    />

    <!-- Character Unlock Confirm Modal -->
    <CharacterUnlockConfirmModal
      :is-open="modals.unlockConfirm.show"
      :character-name="partnerDisplayName"
      :remaining-cards="characterTickets"
      :is-using="modals.unlockConfirm.loading"
      @close="emit('close-unlock-confirm')"
      @confirm="emit('confirm-unlock-character')"
    />

    <!-- Character Unlock Limit Modal (No Card Available) -->
    <CharacterUnlockLimitModal
      :is-open="modals.unlockLimit.show"
      :character-name="partnerDisplayName"
      @close="emit('close-unlock-limit')"
    />

    <!-- Buff Details Modal -->
    <div
      v-if="modals.buffDetails.show && currentBuffDetails"
      class="chat-confirm-backdrop"
    >
      <div
        class="chat-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="buff-details-title"
      >
        <header class="chat-confirm-header">
          <div class="buff-details-title">
            <span class="buff-details-icon">{{
              currentBuffDetails.icon
            }}</span>
            <h2 id="buff-details-title">{{ currentBuffDetails.name }}</h2>
          </div>
          <button
            type="button"
            class="chat-confirm-close"
            aria-label="關閉"
            @click="emit('close-buff-details')"
          >
            <XMarkIcon class="icon" aria-hidden="true" />
          </button>
        </header>
        <div class="buff-details-content">
          <p class="buff-details-description">
            {{ currentBuffDetails.description }}
          </p>
          <div class="buff-details-info">
            <div class="detail-item">
              <span class="detail-label">啟用時間：</span>
              <span class="detail-value">{{
                currentBuffDetails.activatedAt
              }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">到期時間：</span>
              <span class="detail-value">{{
                currentBuffDetails.expiresAt
              }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">剩餘時間：</span>
              <span class="detail-value is-highlight"
                >{{ currentBuffDetails.remainingDays }} 天</span
              >
            </div>
          </div>
        </div>
        <footer class="chat-confirm-footer">
          <button
            type="button"
            class="chat-confirm-btn is-primary"
            @click="emit('close-buff-details')"
          >
            確定
          </button>
        </footer>
      </div>
    </div>
  </Teleport>

  <!-- Limit Modals -->
  <ConversationLimitModal
    :is-open="modals.conversationLimit.show"
    :character-name="modals.conversationLimit.data.characterName"
    :remaining-messages="modals.conversationLimit.data.remainingMessages"
    :daily-ad-limit="modals.conversationLimit.data.dailyAdLimit"
    :ads-watched-today="modals.conversationLimit.data.adsWatchedToday"
    :is-unlocked="modals.conversationLimit.data.isUnlocked"
    :character-unlock-cards="characterTickets"
    @close="emit('close-conversation-limit')"
    @watch-ad="emit('watch-ad')"
    @use-unlock-card="emit('use-unlock-card')"
  />

  <VoiceLimitModal
    :is-open="modals.voiceLimit.show"
    :character-name="modals.voiceLimit.data.characterName"
    :used-voices="modals.voiceLimit.data.usedVoices"
    :total-voices="modals.voiceLimit.data.totalVoices"
    :daily-ad-limit="modals.voiceLimit.data.dailyAdLimit"
    :ads-watched-today="modals.voiceLimit.data.adsWatchedToday"
    :voice-unlock-cards="voiceCards"
    @close="emit('close-voice-limit')"
    @watch-ad="emit('watch-voice-ad')"
    @use-unlock-card="emit('use-voice-unlock-card')"
  />

  <PhotoLimitModal
    :is-open="modals.photoLimit.show"
    :used="modals.photoLimit.data.used"
    :remaining="modals.photoLimit.data.remaining"
    :total="modals.photoLimit.data.total"
    :standard-total="modals.photoLimit.data.standardTotal"
    :is-test-account="modals.photoLimit.data.isTestAccount"
    :cards="modals.photoLimit.data.cards"
    :tier="modals.photoLimit.data.tier"
    :reset-period="modals.photoLimit.data.resetPeriod"
    :photo-unlock-cards="photoCards"
    @close="emit('close-photo-limit')"
    @use-unlock-card="emit('use-photo-unlock-card')"
    @upgrade-membership="emit('upgrade-membership')"
  />

  <VideoLimitModal
    :is-open="modals.videoLimit.show"
    :used="modals.videoLimit.data.used"
    :remaining="modals.videoLimit.data.remaining"
    :total="modals.videoLimit.data.total"
    :standard-total="modals.videoLimit.data.standardTotal"
    :is-test-account="modals.videoLimit.data.isTestAccount"
    :cards="modals.videoLimit.data.cards"
    :tier="modals.videoLimit.data.tier"
    :reset-period="modals.videoLimit.data.resetPeriod"
    :video-unlock-cards="videoCards"
    @close="emit('close-video-limit')"
    @use-unlock-card="emit('use-video-unlock-card')"
    @upgrade-membership="emit('upgrade-membership')"
  />

  <PhotoSelectorModal
    :is-open="modals.photoSelector.show"
    :character-id="partnerId"
    :character-photo-url="partner?.photoUrl || partner?.avatarUrl || partner?.imageUrl || partner?.portraitUrl || ''"
    @close="emit('close-photo-selector')"
    @select="emit('photo-select', $event)"
  />

  <ImageViewerModal
    :is-open="modals.imageViewer.show"
    :image-url="modals.imageViewer.url"
    :image-alt="modals.imageViewer.alt"
    @close="emit('close-image-viewer')"
  />

  <GiftSelectorModal
    :is-open="showGiftSelector"
    :character-name="partnerDisplayName"
    :balance="balance"
    :membership-tier="membershipTier"
    @close="emit('close-gift-selector')"
    @select="emit('select-gift', $event)"
  />

  <!-- Gift Animation -->
  <GiftAnimation
    :show="modals.giftAnimation.show"
    :gift-emoji="modals.giftAnimation.emoji"
    :gift-name="modals.giftAnimation.name"
  />
</template>

<style scoped lang="scss">
/* ===================
   Modal Base Styles
   =================== */
.chat-confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1.5rem;
}

.chat-confirm-dialog {
  background: linear-gradient(
    180deg,
    rgba(30, 41, 59, 0.98) 0%,
    rgba(15, 23, 42, 0.98) 100%
  );
  border-radius: 20px;
  max-width: 420px;
  width: 100%;
  padding: 1.8rem;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.2);

  p {
    color: rgba(226, 232, 240, 0.85);
    font-size: 0.98rem;
    line-height: 1.65;
    margin: 0 0 1.5rem 0;
  }
}

/* Modal Header */
.chat-confirm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;

  h2 {
    margin: 0;
    color: #f1f5f9;
    font-size: 1.35rem;
    font-weight: 600;
  }
}

/* Modal Close Button */
.chat-confirm-close {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: none;
  background: rgba(148, 163, 184, 0.15);
  color: #cbd5e1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;

  .icon {
    width: 20px;
    height: 20px;
  }

  &:hover {
    background: rgba(148, 163, 184, 0.25);
    color: #f1f5f9;
  }
}

/* Modal Footer */
.chat-confirm-footer {
  display: flex;
  gap: 0.8rem;
  justify-content: flex-end;
}

/* ===================
   Modal Buttons
   =================== */
.chat-confirm-btn {
  padding: 0.7rem 1.5rem;
  border-radius: 12px;
  border: none;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 140ms ease;
  background: rgba(148, 163, 184, 0.2);
  color: #e2e8f0;

  &:hover {
    background: rgba(148, 163, 184, 0.3);
    transform: translateY(-1px);
  }

  &.is-danger {
    background: linear-gradient(135deg, #dc2626, #ef4444);
    color: #fff;

    &:hover {
      background: linear-gradient(135deg, #b91c1c, #dc2626);
      box-shadow: 0 6px 16px rgba(220, 38, 38, 0.35);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  }

  &.is-primary {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: #fff;

    &:hover {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.35);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  }
}

/* ===================
   Detail Items
   =================== */
.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.92rem;

  .detail-label {
    color: rgba(226, 232, 240, 0.7);
  }

  .detail-value {
    color: #f1f5f9;
    font-weight: 500;

    &.insufficient {
      color: #ef4444;
    }

    &.is-highlight {
      color: #fbbf24;
      font-weight: 600;
    }
  }
}

/* ===================
   Buff Details Modal
   =================== */
.buff-details-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.buff-details-icon {
  font-size: 1.75rem;
  line-height: 1;
}

.buff-details-content {
  margin-bottom: 1.5rem;
}

.buff-details-description {
  margin-bottom: 1.5rem;
  font-size: 1rem;
  line-height: 1.6;
}

.buff-details-info {
  background: rgba(51, 65, 85, 0.4);
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

/* ===================
   Responsive Styles
   =================== */
@media (max-width: 540px) {
  .chat-confirm-dialog {
    padding: 1.5rem;
    border-radius: 16px;
  }

  .chat-confirm-header h2 {
    font-size: 1.2rem;
  }
}
</style>
