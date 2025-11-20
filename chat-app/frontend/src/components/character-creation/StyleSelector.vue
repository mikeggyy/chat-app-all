<script setup lang="ts">
import { ArrowRightIcon } from "@heroicons/vue/24/outline";
import { SparklesIcon } from "@heroicons/vue/24/solid";

// Types
interface StyleOption {
  id: string;
  label: string;
  thumbnail: string;
  [key: string]: any;
}

interface Props {
  styleOptions: StyleOption[];
  selectedStyles: string[];
  isLoading?: boolean;
}

interface Emits {
  (e: "toggle-style", styleId: string): void;
  (e: "show-all"): void;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
});

const emit = defineEmits<Emits>();

const isStyleSelected = (styleId: string): boolean => props.selectedStyles.includes(styleId);

const handleToggleStyle = (styleId: string): void => {
  emit("toggle-style", styleId);
};

const handleShowAll = (): void => {
  emit("show-all");
};
</script>

<template>
  <section
    class="appearance__card appearance__styles-section"
    aria-labelledby="appearance-style-label"
  >
    <header
      class="appearance__section-header appearance__section-header--compact"
    >
      <div class="appearance__section-title">
        <div
          class="appearance__section-icon appearance__section-icon--rose"
          aria-hidden="true"
        >
          <SparklesIcon />
        </div>
        <div>
          <p class="appearance__section-kicker">角色風格</p>
          <h2 id="appearance-style-label">添加風格</h2>
          <p class="appearance__section-note">可多選</p>
        </div>
      </div>
      <button type="button" class="appearance__section-action" @click="handleShowAll">
        <span>全部風格</span>
        <ArrowRightIcon
          class="appearance__section-action-icon"
          aria-hidden="true"
        />
      </button>
    </header>
    <div
      class="appearance__styles-scroll"
      role="listbox"
      aria-label="角色風格"
    >
      <button
        v-for="style in styleOptions"
        :key="style.id"
        type="button"
        class="appearance__style-card"
        :class="{
          'appearance__style-card--selected': isStyleSelected(style.id),
        }"
        role="option"
        :aria-selected="isStyleSelected(style.id)"
        @click="handleToggleStyle(style.id)"
      >
        <img :src="style.thumbnail" :alt="style.label" />
        <div class="appearance__style-body">
          <h3 class="appearance__style-name">{{ style.label }}</h3>
          <p class="appearance__style-meta">
            {{ isStyleSelected(style.id) ? "已選擇" : "點擊加入" }}
          </p>
        </div>
      </button>
    </div>
  </section>
</template>

<style scoped>
.appearance__card {
  background: var(--bg-card);
  border-radius: var(--radius-2xl);
  padding: 18px;
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.appearance__styles-section {
  padding: var(--spacing-2xl);
}

.appearance__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.appearance__section-header--compact {
  align-items: center;
}

.appearance__section-title {
  display: flex;
  align-items: center;
  gap: 14px;
}

.appearance__section-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-bg-section);
  color: #ff68b5;
  box-shadow: var(--color-primary-shadow-icon);
}

.appearance__section-icon svg {
  width: 24px;
  height: 24px;
}

.appearance__section-icon--rose {
  background: var(--gradient-section-rose);
}

.appearance__section-kicker {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
}

.appearance__section-title h2 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0.04em;
}

.appearance__section-note {
  margin: 4px 0 0;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.appearance__section-action {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 10px var(--spacing-lg);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-medium);
  background: var(--bg-overlay-light);
  color: var(--color-white);
  font-size: 14px;
  letter-spacing: 0.04em;
  transition: background var(--transition-fast),
    border-color var(--transition-fast), transform var(--transition-fast);
  cursor: pointer;
}

.appearance__section-action:hover {
  background: var(--bg-overlay);
  border-color: var(--border-dashed);
  transform: translateX(2px);
}

.appearance__section-action:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

.appearance__section-action-icon {
  width: 16px;
  height: 16px;
}

.appearance__styles-scroll {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 8px 8px 6px;
  margin: 0 -8px;
  scroll-snap-type: x mandatory;
}

.appearance__styles-scroll::-webkit-scrollbar {
  height: 6px;
}

.appearance__styles-scroll::-webkit-scrollbar-thumb {
  background: var(--bg-overlay-medium);
  border-radius: var(--radius-full);
}

.appearance__style-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  background: var(--bg-overlay-light);
  color: var(--color-white);
  text-align: left;
  scroll-snap-align: center;
  transition: border-color var(--transition-fast),
    transform var(--transition-fast), box-shadow var(--transition-fast);
  min-width: 8rem;
  gap: 0.5rem;
  padding: 0 0 0.5rem 0;
  cursor: pointer;
}

.appearance__style-card:hover {
  transform: translateY(-2px);
}

.appearance__style-card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

.appearance__style-card img {
  width: 100%;
  object-fit: cover;
  border-radius: var(--radius-lg);
  background: var(--bg-overlay);
}

.appearance__style-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.appearance__style-name {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0.06em;
}

.appearance__style-meta {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  text-align: center;
}

.appearance__style-card--selected {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-primary);
  background: var(--color-primary-bg);
}

.appearance__card-titles h2 {
  color: var(--color-white) !important;
}

.appearance__card-subtitle {
  color: var(--text-secondary) !important;
}

/* 強化按鈕邊框和樣式 */
.appearance__section-action {
  border: 1.5px solid rgba(255, 255, 255, 0.25) !important;
  background: rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.appearance__section-action:hover {
  border-color: rgba(255, 255, 255, 0.4) !important;
  background: rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* 強化風格卡片邊框 */
.appearance__style-card {
  border: 1.5px solid rgba(255, 255, 255, 0.15) !important;
  background: rgba(255, 255, 255, 0.06) !important;
}

.appearance__style-card:hover:not(.appearance__style-card--selected) {
  border-color: rgba(255, 255, 255, 0.25) !important;
  background: rgba(255, 255, 255, 0.09) !important;
}

.appearance__style-card--selected {
  border-color: var(--color-primary) !important;
  background: rgba(255, 47, 146, 0.1) !important;
  box-shadow: 0 0 0 3px rgba(255, 47, 146, 0.15), 0 4px 12px rgba(255, 47, 146, 0.2) !important;
}

.appearance__style-card--selected:hover {
  border-color: var(--color-primary) !important;
  background: rgba(255, 47, 146, 0.15) !important;
  transform: translateY(-2px);
}

/* 確保所有文字為白色或淺色 */
.appearance__section-title h2,
.appearance__section-kicker,
.appearance__section-note,
.appearance__section-action,
.appearance__style-name,
.appearance__style-meta {
  color: var(--color-white) !important;
}

.appearance__section-kicker {
  color: rgba(255, 255, 255, 0.6) !important;
}

.appearance__section-note {
  color: rgba(255, 255, 255, 0.72) !important;
}
</style>
