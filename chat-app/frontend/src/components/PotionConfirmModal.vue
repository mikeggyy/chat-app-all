<script setup lang="ts">
import { computed } from "vue";

type PotionType = 'memoryBoost' | 'brainBoost' | '';

interface Props {
  isOpen: boolean;
  potionType?: PotionType;
  characterName?: string;
  remainingCount?: number;
}

interface PotionInfo {
  name: string;
  description: string;
  duration: string;
  icon: string;
}

const props = withDefaults(defineProps<Props>(), {
  potionType: 'memoryBoost',
  characterName: "",
  remainingCount: 0,
});

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const potionInfo = computed((): PotionInfo | null => {
  if (props.potionType === "memoryBoost") {
    return {
      name: "記憶增強藥水",
      description: `使用後，${
        props.characterName || "此角色"
      }的對話記憶上限將增加`,
      duration: "30 天",
      icon: "🧠",
    };
  } else if (props.potionType === "brainBoost") {
    return {
      name: "腦力激盪藥水",
      description:
        "使用後，您的 AI 模型將升級為最高階模型，提供更聰明的對話體驗",
      duration: "30 天",
      icon: "⚡",
    };
  }
  return null;
});

const handleClose = (): void => {
  emit("close");
};

const handleConfirm = (): void => {
  emit("confirm");
};

const handleOverlayClick = (event: MouseEvent): void => {
  if (event.target === event.currentTarget) {
    handleClose();
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="potion-confirm-modal"
        role="dialog"
        aria-modal="true"
        @click="handleOverlayClick"
      >
        <div class="potion-confirm-content">
          <div class="potion-confirm-header">
            <div class="potion-icon">{{ potionInfo?.icon }}</div>
            <h2 class="potion-title">{{ potionInfo?.name }}</h2>
            <button
              type="button"
              class="close-btn"
              aria-label="關閉"
              @click="handleClose"
            >
              ×
            </button>
          </div>

          <div class="potion-body">
            <p class="potion-description">{{ potionInfo?.description }}</p>
            <div class="potion-duration">
              <span class="duration-label">效果持續時間：</span>
              <span class="duration-value">{{ potionInfo?.duration }}</span>
            </div>
            <div class="potion-remaining">
              <span class="remaining-label">目前擁有：</span>
              <span class="remaining-value">{{ remainingCount }} 個</span>
            </div>
            <p class="potion-note">
              確定要使用此藥水嗎？使用後將剩餘
              <strong>{{ remainingCount - 1 }}</strong> 個
            </p>
          </div>

          <div class="potion-actions">
            <button
              type="button"
              class="btn-unified btn-cancel"
              @click="handleClose"
            >
              取消
            </button>
            <button
              type="button"
              class="btn-unified btn-confirm"
              @click="handleConfirm"
            >
              確定使用
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.potion-confirm-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  padding: 1rem;
}

.potion-confirm-content {
  background: linear-gradient(135deg, #1a1d2e 0%, #16192b 100%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: 420px;
  width: 100%;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.potion-confirm-header {
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.potion-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.potion-title {
  flex: 1;
  font-size: 1.25rem;
  font-weight: 600;
  color: #f8f9ff;
  margin: 0;
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  color: #8b92b0;
  font-size: 1.75rem;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f8f9ff;
  }
}

.potion-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.potion-description {
  color: #c8ccd8;
  font-size: 0.938rem;
  line-height: 1.6;
  margin: 0;
}

.potion-duration {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(139, 92, 246, 0.2);
}

.duration-label {
  color: #a8afc4;
  font-size: 0.875rem;
}

.duration-value {
  color: #a78bfa;
  font-weight: 600;
  font-size: 0.938rem;
}

.potion-remaining {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(34, 197, 94, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.remaining-label {
  color: #a8afc4;
  font-size: 0.875rem;
}

.remaining-value {
  color: #4ade80;
  font-weight: 600;
  font-size: 0.938rem;
}

.potion-note {
  color: #f8f9ff;
  font-size: 0.938rem;
  font-weight: 500;
  margin: 0.5rem 0 0;

  strong {
    color: #fbbf24;
    font-weight: 700;
  }
}

.potion-actions {
  padding: 1.5rem;
  display: flex;
  gap: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .potion-confirm-content,
.modal-leave-active .potion-confirm-content {
  transition: transform 0.2s;
}

.modal-enter-from .potion-confirm-content,
.modal-leave-to .potion-confirm-content {
  transform: scale(0.95);
}
</style>
