<script setup lang="ts">
// Types

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

const handlePreviewClick = (event: MouseEvent) => {
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

/* ========================================
   桌面版樣式 (≥ 1024px)
   ======================================== */
@media (min-width: 1024px) {
  .voice__card {
    padding: 20px;
    border-radius: 20px;
    cursor: pointer;
  }

  .voice__card:hover:not(.voice__card--selected) {
    border-color: rgba(255, 255, 255, 0.28);
    background: rgba(0, 0, 0, 0.35);
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  .voice__card--selected {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(255, 99, 168, 0.3);
  }

  .voice__card-header h2 {
    font-size: 17px;
  }

  .voice__badge {
    padding: 3px 10px;
    font-size: 12px;
  }

  .voice__tags span {
    padding: 3px 10px;
    font-size: 12px;
  }

  .voice__card-desc {
    font-size: 14px;
    line-height: 1.5;
  }

  .voice__preview {
    padding: 10px 18px;
    border-radius: 18px;
    transition: all 0.2s ease;
  }

  .voice__preview:hover:not(:disabled) {
    background: rgba(255, 99, 168, 0.2);
    border-color: rgba(255, 99, 168, 0.5);
    transform: scale(1.05);
  }

  .voice__preview svg {
    width: 2.25rem;
    height: 2.25rem;
  }
}
</style>
