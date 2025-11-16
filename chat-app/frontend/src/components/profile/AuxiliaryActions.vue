<script setup lang="ts">
import { PencilSquareIcon, Cog6ToothIcon } from "@heroicons/vue/24/outline";
import type { Component, Ref } from "vue";
import SettingsMenu from "./SettingsMenu.vue";

interface AuxiliaryAction {
  key: string;
  label: string;
  icon: Component;
}

interface Props {
  isSettingsMenuOpen?: boolean;
  settingsError?: string;
  settingsMenuButtonRef?: unknown;
  settingsMenuRef?: unknown;
}

withDefaults(defineProps<Props>(), {
  isSettingsMenuOpen: false,
  settingsError: "",
  settingsMenuButtonRef: null,
  settingsMenuRef: null,
});

const emit = defineEmits<{
  "edit-click": [];
  "settings-toggle": [event: Event];
  "settings-option-select": [option: string];
}>();

const auxiliaryActions: AuxiliaryAction[] = [
  {
    key: "edit",
    label: "編輯個人資料",
    icon: PencilSquareIcon,
  },
  {
    key: "settings",
    label: "設定",
    icon: Cog6ToothIcon,
  },
];

const handleActionClick = (key: string, event: Event) => {
  if (key === "edit") {
    emit("edit-click");
  } else if (key === "settings") {
    emit("settings-toggle", event);
  }
};
</script>

<template>
  <nav class="profile-hero__aux">
    <ul>
      <li
        v-for="action in auxiliaryActions"
        :key="action.key"
        class="profile-hero__aux-item"
        :class="{
          'profile-hero__aux-item--menu': action.key === 'settings',
          'is-open': action.key === 'settings' && isSettingsMenuOpen,
        }"
      >
        <button
          type="button"
          class="aux-button"
          :aria-label="action.label"
          :aria-haspopup="action.key === 'settings' ? 'menu' : undefined"
          :aria-expanded="
            action.key === 'settings' ? isSettingsMenuOpen : undefined
          "
          :aria-controls="
            action.key === 'settings' ? 'profile-settings-menu' : undefined
          "
          :ref="action.key === 'settings' ? settingsMenuButtonRef : null"
          @click="handleActionClick(action.key, $event)"
        >
          <component :is="action.icon" class="icon" aria-hidden="true" />
        </button>

        <SettingsMenu
          v-if="action.key === 'settings'"
          :is-open="isSettingsMenuOpen"
          :error="settingsError"
          :menu-ref="settingsMenuRef"
          @option-select="emit('settings-option-select', $event)"
        />
      </li>
    </ul>
  </nav>
</template>

<style scoped lang="scss">
.profile-hero__aux ul {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.profile-hero__aux-item {
  position: relative;
}

.profile-hero__aux-item.is-open .aux-button {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.45);
}

.aux-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(30, 33, 48, 0.8);
  backdrop-filter: blur(8px);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.25);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    background: rgba(51, 65, 85, 0.9);
    border-color: rgba(148, 163, 184, 0.4);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: translateY(0);
  }

  .icon {
    width: 20px;
    height: 20px;
  }
}
</style>
