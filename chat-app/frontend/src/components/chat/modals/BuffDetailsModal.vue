<script setup lang="ts">
import { computed, type ComputedRef } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

// Types
interface BoostEffect {
  activatedAt: string | number | Date;
  expiresAt: string | number | Date;
  unlockUntil?: string | number | Date;
}

interface BuffDetails {
  name: string;
  icon: string;
  description: string;
  activatedAt: string;
  expiresAt: string;
  remainingDays: number;
}

interface Props {
  isOpen: boolean;
  buffType?: string;
  characterName?: string;
  activeMemoryBoost?: BoostEffect | null;
  activeBrainBoost?: BoostEffect | null;
  activeCharacterUnlock?: BoostEffect | null;
}

interface Emits {
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  buffType: '',
  characterName: '',
  activeMemoryBoost: null,
  activeBrainBoost: null,
  activeCharacterUnlock: null,
});

const emit = defineEmits<Emits>();

const buffDetails: ComputedRef<BuffDetails | null> = computed(() => {
  if (!props.buffType) return null;

  let effect: BoostEffect | null | undefined = null;
  let name = '';
  let icon = '';
  let description = '';

  if (props.buffType === 'memory') {
    effect = props.activeMemoryBoost;
    name = '記憶增強藥水';
    icon = '🧠';
    description = `${props.characterName}的對話記憶上限增加 10,000 tokens`;
  } else if (props.buffType === 'brain') {
    effect = props.activeBrainBoost;
    name = '腦力激盪藥水';
    icon = '⚡';
    description = 'AI 模型升級為最高階模型，提供更聰明的對話體驗';
  } else if (props.buffType === 'unlock') {
    effect = props.activeCharacterUnlock;
    name = '角色解鎖卡';
    icon = '🎫';
    description = `與「${props.characterName}」暢聊無限次，無需消耗對話次數`;
  }

  if (!effect) return null;

  const now = new Date();
  const expiresAt = new Date(effect.expiresAt || effect.unlockUntil!);
  const remainingMs = expiresAt.getTime() - now.getTime();
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  return {
    name,
    icon,
    description,
    activatedAt: new Date(effect.activatedAt || effect.unlockUntil!).toLocaleString('zh-TW'),
    expiresAt: expiresAt.toLocaleString('zh-TW'),
    remainingDays,
  };
});
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen && buffDetails" class="chat-confirm-backdrop">
      <div class="chat-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="buff-details-title">
        <header class="chat-confirm-header">
          <h2 id="buff-details-title">
            <span>{{ buffDetails.icon }}</span>
            {{ buffDetails.name }}
          </h2>
          <button type="button" class="chat-confirm-close" aria-label="關閉" @click="emit('close')">
            <XMarkIcon class="icon" aria-hidden="true" />
          </button>
        </header>
        <div class="buff-details-content">
          <p class="buff-description">{{ buffDetails.description }}</p>
          <div class="buff-timeline">
            <div class="buff-timeline-item">
              <span class="buff-timeline-label">生效時間</span>
              <span class="buff-timeline-value">{{ buffDetails.activatedAt }}</span>
            </div>
            <div class="buff-timeline-item">
              <span class="buff-timeline-label">到期時間</span>
              <span class="buff-timeline-value">{{ buffDetails.expiresAt }}</span>
            </div>
            <div class="buff-timeline-item">
              <span class="buff-timeline-label">剩餘天數</span>
              <span class="buff-timeline-value">{{ buffDetails.remainingDays }} 天</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.buff-details-content {
  padding: 1rem 0;
}

.buff-description {
  margin-bottom: 1.5rem;
  line-height: 1.6;
  color: rgba(226, 232, 240, 0.9);
}

.buff-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.buff-timeline-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(30, 41, 59, 0.4);
  border-radius: 8px;
}

.buff-timeline-label {
  font-size: 0.875rem;
  color: rgba(148, 163, 184, 0.9);
}

.buff-timeline-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: #60a5fa;
}
</style>

<style scoped src="../../../styles/modals.css"></style>
