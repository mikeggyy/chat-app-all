<script setup lang="ts">
import type { Ref } from "vue";

interface SettingsOption {
  key: string;
  label: string;
  variant?: "danger";
}

interface Props {
  isOpen?: boolean;
  error?: string;
  menuRef?: unknown;
}

withDefaults(defineProps<Props>(), {
  isOpen: false,
  error: "",
  menuRef: null,
});

const emit = defineEmits<{
  "option-select": [option: string];
}>();

const settingsOptions: SettingsOption[] = [{ key: "logout", label: "登出", variant: "danger" }];
</script>

<template>
  <transition name="fade-scale">
    <div
      v-if="isOpen"
      id="profile-settings-menu"
      class="settings-menu"
      role="menu"
      :ref="menuRef"
      @click.stop
    >
      <button
        v-for="option in settingsOptions"
        :key="option.key"
        type="button"
        class="settings-menu__item"
        :class="{
          'settings-menu__item--danger': option.variant === 'danger',
        }"
        role="menuitem"
        @click="emit('option-select', option.key)"
      >
        {{ option.label }}
      </button>
      <p v-if="error" class="settings-menu__error" role="alert">
        {{ error }}
      </p>
    </div>
  </transition>
</template>

<style scoped lang="scss">
.settings-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 190px;
  padding: 0.6rem;
  border-radius: 16px;
  background: rgba(15, 17, 28, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 18px 36px rgba(15, 17, 28, 0.55);
  backdrop-filter: blur(14px);
  z-index: 2300;
}

.settings-menu__item {
  display: block;
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: #e2e8f0;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  text-align: left;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}

.settings-menu__item:hover,
.settings-menu__item:focus {
  background: rgba(148, 163, 184, 0.2);
  color: #f8fafc;
  outline: none;
}

.settings-menu__item--danger {
  color: #fca5a5;
}

.settings-menu__item--danger:hover,
.settings-menu__item--danger:focus {
  background: rgba(248, 113, 113, 0.18);
  color: #fecaca;
}

.settings-menu__error {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: #fca5a5;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
  transform-origin: top right;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}
</style>
