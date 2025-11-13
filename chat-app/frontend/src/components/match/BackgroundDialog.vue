<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="bio-dialog-backdrop"
      @click="$emit('close')"
    >
      <div
        class="bio-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.stop
      >
        <header class="bio-dialog-header">
          <h3>{{ title }}</h3>
          <button
            type="button"
            class="bio-dialog-close"
            aria-label="關閉視窗"
            @click="$emit('close')"
          >
            <XMarkIcon class="icon" aria-hidden="true" />
          </button>
        </header>
        <p class="bio-dialog-body">
          {{ text }}
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { XMarkIcon } from '@heroicons/vue/24/outline';

/**
 * BackgroundDialog - 角色背景詳情對話框組件
 * 職責：顯示完整的角色背景文字
 */

// Props
defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
});

// Emits
defineEmits(['close']);
</script>

<style scoped lang="scss">
.bio-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.78);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 2000;

  .bio-dialog {
    width: min(520px, 100%);
    border-radius: 24px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(15, 23, 42, 0.97);
    box-shadow: 0 24px 48px rgba(15, 23, 42, 0.5);
    padding: 2rem;
    color: #e2e8f0;

    .bio-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin: 0 0 1.25rem;

      h3 {
        margin: 0;
        font-size: 1.15rem;
        letter-spacing: 0.08em;
      }

      .bio-dialog-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.5);
        background: rgba(15, 23, 42, 0.4);
        color: #e2e8f0;
        padding: 0;
        cursor: pointer;
        transition: background 150ms ease, border-color 150ms ease;

        &:hover {
          background: rgba(148, 163, 184, 0.28);
          border-color: rgba(226, 232, 240, 0.65);
        }

        .icon {
          width: 20px;
          height: 20px;
        }
      }
    }

    .bio-dialog-body {
      margin: 0;
      line-height: 1.8;
      white-space: pre-wrap;
    }

    @media (max-width: 540px) {
      padding: 1.75rem 1.5rem;
    }
  }
}
</style>
