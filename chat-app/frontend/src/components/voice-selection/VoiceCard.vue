<script setup>
import { PlayIcon, PauseIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
  preset: {
    type: Object,
    required: true,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
  isPlaying: {
    type: Boolean,
    default: false,
  },
  formatGender: {
    type: Function,
    required: true,
  },
  hasPreviewUrl: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["select", "toggle-preview"]);

const handleCardClick = () => {
  emit("select", props.preset.id);
};

const handlePreviewClick = (event) => {
  event.stopPropagation();
  emit("toggle-preview", props.preset.id);
};
</script>

<template>
  <article
    class="voice__card"
    :class="{
      'voice__card--selected': isSelected,
      'voice__card--recommended': preset.recommended,
    }"
    @click="handleCardClick"
  >
    <div class="voice__card-main">
      <div class="voice__card-header">
        <h2>
          {{ preset.label }}
          <span v-if="preset.recommended" class="voice__badge">推薦</span>
        </h2>
        <div class="voice__tags">
          <span>{{ formatGender(preset.gender) }}</span>
        </div>
      </div>
      <p class="voice__card-desc">{{ preset.description }}</p>
    </div>
    <button
      type="button"
      class="voice__preview"
      :disabled="!hasPreviewUrl"
      @click="handlePreviewClick"
    >
      <component :is="isPlaying ? PauseIcon : PlayIcon" aria-hidden="true" />
    </button>
  </article>
</template>

<style scoped>
.voice__card {
  display: flex;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 18px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.28);
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.voice__card--selected {
  border-color: rgba(255, 99, 168, 0.9);
  transform: translateY(-1px);
}

.voice__card-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice__card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.voice__card-header h2 {
  margin: 0;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.voice__badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  background: linear-gradient(90deg, #ff7ac2 0%, #ff4192 100%);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.voice__tags {
  display: flex;
  gap: 6px;
  font-size: 11px;
  flex-wrap: wrap;
}

.voice__tags span {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
}

.voice__card-desc {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.voice__preview {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 16px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.35);
  color: #ffffff;
  font-size: 13px;
}

.voice__preview svg {
  width: 2rem;
  height: 2rem;
}

.voice__preview:disabled {
  opacity: 0.45;
}
</style>
