<template>
  <header class="chat-header">
    <!-- 返回按鈕 -->
    <button
      type="button"
      class="chat-header__action"
      aria-label="返回"
      @click="$emit('back')"
    >
      <ArrowUturnLeftIcon class="icon" aria-hidden="true" />
    </button>

    <!-- 角色資訊 -->
    <div class="chat-header__meta">
      <h1>{{ partnerName }}</h1>
      <!-- Buff 圖標 -->
      <div
        v-if="activeMemoryBoost || activeBrainBoost || activeCharacterUnlock"
        class="chat-header__buffs"
      >
        <span
          v-if="activeCharacterUnlock"
          class="buff-icon buff-icon--unlock"
          :title="`角色已解鎖 - 剩餘 ${activeCharacterUnlock.remainingDays} 天`"
          @click="handleBuffClick('unlock')"
        >
          🎫
        </span>
        <span
          v-if="activeMemoryBoost"
          class="buff-icon"
          title="記憶增強藥水生效中 - 點擊查看詳情"
          @click="handleBuffClick('memory')"
        >
          🧠
        </span>
        <span
          v-if="activeBrainBoost"
          class="buff-icon"
          title="腦力激盪藥水生效中 - 點擊查看詳情"
          @click="handleBuffClick('brain')"
        >
          ⚡
        </span>
      </div>
    </div>

    <!-- 收藏按鈕 -->
    <button
      type="button"
      class="chat-header__action"
      :disabled="isFavoriteMutating"
      :aria-label="isFavorited ? '取消收藏' : '加入收藏'"
      @click="$emit('toggle-favorite')"
    >
      <HeartSolid v-if="isFavorited" class="icon" aria-hidden="true" />
      <HeartOutline v-else class="icon" aria-hidden="true" />
    </button>

    <!-- 操作選單按鈕 -->
    <button
      type="button"
      ref="actionMenuButtonRef"
      class="chat-header__action"
      aria-label="更多選項"
      @click.stop="toggleMenu"
    >
      <EllipsisHorizontalIcon class="icon" aria-hidden="true" />
    </button>

    <!-- 操作選單 -->
    <div v-if="isMenuOpen" ref="actionMenuRef" class="chat-header__menu">
      <button
        type="button"
        class="chat-header__menu-item"
        @click="handleMenuAction('info')"
      >
        角色資訊
      </button>
      <button
        v-if="!isCharacterUnlocked"
        type="button"
        class="chat-header__menu-item chat-header__menu-item--unlock"
        @click="handleMenuAction('unlock-character')"
      >
        🎫 解鎖角色
      </button>
      <button
        v-if="!activeMemoryBoost"
        type="button"
        class="chat-header__menu-item"
        @click="handleMenuAction('memory')"
      >
        使用增強記憶藥水
      </button>
      <button
        v-if="!activeBrainBoost"
        type="button"
        class="chat-header__menu-item"
        @click="handleMenuAction('brain')"
      >
        使用腦力激盪藥水
      </button>
      <button
        type="button"
        class="chat-header__menu-item"
        @click="handleMenuAction('share')"
      >
        分享
      </button>
      <button
        type="button"
        class="chat-header__menu-item is-danger"
        :disabled="isResettingConversation"
        @click="handleMenuAction('reset')"
      >
        重置對話
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";
import {
  ArrowUturnLeftIcon,
  EllipsisHorizontalIcon,
  HeartIcon as HeartOutline,
} from "@heroicons/vue/24/outline";
import { HeartIcon as HeartSolid } from "@heroicons/vue/24/solid";

// Types
interface Props {
  partnerName: string;
  isResettingConversation?: boolean;
  isFavorited?: boolean;
  isFavoriteMutating?: boolean;
  memoryBoostCount?: number;
  brainBoostCount?: number;
  activeMemoryBoost?: any;
  activeBrainBoost?: any;
  activeCharacterUnlock?: any;
  characterUnlockCards?: number;
  isCharacterUnlocked?: boolean;
}

interface Emits {
  (e: 'back'): void;
  (e: 'menu-action', action: string): void;
  (e: 'toggle-favorite'): void;
  (e: 'view-buff-details', buffType: string): void;
}

// Props
withDefaults(defineProps<Props>(), {
  isResettingConversation: false,
  isFavorited: false,
  isFavoriteMutating: false,
  memoryBoostCount: 0,
  brainBoostCount: 0,
  activeMemoryBoost: undefined,
  activeBrainBoost: undefined,
  activeCharacterUnlock: undefined,
  characterUnlockCards: 0,
  isCharacterUnlocked: false,
});

// Emits
const emit = defineEmits<Emits>();

// Methods
const handleBuffClick = (buffType: string): void => {
  emit("view-buff-details", buffType);
};

// 狀態
const isMenuOpen: Ref<boolean> = ref(false);
const actionMenuButtonRef: Ref<HTMLElement | null> = ref(null);
const actionMenuRef: Ref<HTMLElement | null> = ref(null);

// 切換選單
const toggleMenu = (): void => {
  isMenuOpen.value = !isMenuOpen.value;
};

// 關閉選單
const closeMenu = (): void => {
  isMenuOpen.value = false;
};

// 處理選單操作
const handleMenuAction = (action: string): void => {
  emit("menu-action", action);
  closeMenu();
};

// 點擊外部關閉選單
const handleClickOutside = (event: MouseEvent): void => {
  if (
    isMenuOpen.value &&
    actionMenuRef.value &&
    actionMenuButtonRef.value &&
    !actionMenuRef.value.contains(event.target as Node) &&
    !actionMenuButtonRef.value.contains(event.target as Node)
  ) {
    closeMenu();
  }
};

// 生命週期
onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<style scoped lang="scss">
.chat-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.5rem 1rem;
  position: relative;
  background: linear-gradient(
    180deg,
    rgba(15, 23, 42, 0.55) 0%,
    rgba(15, 23, 42, 0.2) 100%
  );

  h1 {
    margin: 0;
    font-size: 1.2rem;
    letter-spacing: 0.1em;
    color: #f8fafc;
  }
}

.chat-header__meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding-left: 42px;
}

.chat-header__action {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.4);
  color: #f8fafc;
  cursor: pointer;
  transition: transform 120ms ease, background 120ms ease;

  .icon {
    width: 20px;
    height: 20px;
  }

  &:hover {
    transform: translateY(-1px);
    background: rgba(15, 23, 42, 0.45);
  }

  &:active {
    transform: translateY(0);
  }
}

.chat-header__menu {
  position: absolute;
  top: calc(100% - 0.5rem);
  right: 1.5rem;
  display: flex;
  flex-direction: column;
  min-width: 168px;
  border-radius: 18px;
  padding: 0.5rem;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(18px);
  z-index: 10;
}

.chat-header__menu-item {
  border: none;
  background: transparent;
  color: #f8fafc;
  text-align: left;
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  font-size: 0.92rem;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.is-danger {
    color: #fda4af;

    &:hover:not(:disabled) {
      color: #fecdd3;
      background: rgba(248, 113, 113, 0.18);
    }
  }

  &.chat-header__menu-item--unlock {
    color: #4ade80;

    &:hover:not(:disabled) {
      color: #86efac;
      background: rgba(34, 197, 94, 0.15);
    }
  }
}

// Buff 圖標
.chat-header__buffs {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.buff-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: transform 120ms ease, background 120ms ease;

  &:hover {
    transform: scale(1.1);
    background: rgba(255, 255, 255, 0.15);
  }

  &:active {
    transform: scale(0.95);
  }

  &--unlock {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);

    &:hover {
      background: rgba(34, 197, 94, 0.25);
    }
  }
}

@media (max-width: 540px) {
  .chat-header {
    padding: 1.2rem 1.25rem 0.9rem;
  }
}
</style>
