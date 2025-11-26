<script setup lang="ts">
import { XMarkIcon } from "@heroicons/vue/24/outline";

interface Props {
  isVisible?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const handleConfirm = (): void => {
  emit("confirm");
};

const handleCancel = (): void => {
  emit("cancel");
};
</script>

<template>
  <transition name="modal">
    <div v-if="isVisible" class="modal-overlay" @click.self="handleCancel">
      <div class="modal-content">
        <button
          type="button"
          class="modal-close"
          aria-label="關閉"
          @click="handleCancel"
        >
          <XMarkIcon aria-hidden="true" />
        </button>

        <div class="modal-header">
          <div class="modal-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <h2 class="modal-title">檢測到未完成的角色創建流程</h2>
          <p class="modal-subtitle">是否繼續之前的創建進度？</p>
        </div>

        <div class="modal-body">
          <p class="modal-description">
            我們發現您有一個尚未完成的角色創建流程。
          </p>
          <ul class="modal-list">
            <li>選擇「繼續創建」將返回到上次離開的步驟</li>
            <li>選擇「重新開始」將清除所有進度並開始新的創建</li>
          </ul>
        </div>

        <div class="modal-actions">
          <button
            type="button"
            class="action-button action-button--secondary"
            @click="handleCancel"
          >
            重新開始
          </button>
          <button
            type="button"
            class="action-button action-button--primary"
            @click="handleConfirm"
          >
            繼續創建
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  z-index: 1620;
  padding: 20px;
  padding-bottom: calc(20px + 80px);
  overflow-y: auto;
}

.modal-content {
  position: relative;
  width: 100%;
  max-width: 440px;
  max-height: calc(100vh - 160px);
  background: linear-gradient(
    180deg,
    rgba(30, 30, 50, 0.98) 0%,
    rgba(20, 20, 35, 0.98) 100%
  );
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  padding: 32px 24px;
  margin: auto;
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
}

.modal-close svg {
  width: 20px;
  height: 20px;
}

.modal-header {
  text-align: center;
  margin-bottom: 24px;
}

.modal-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  color: #fbbf24;
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
  line-height: 1.4;
}

.modal-subtitle {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}

.modal-body {
  margin-bottom: 24px;
}

.modal-description {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
  margin-bottom: 16px;
}

.modal-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.modal-list li {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  padding-left: 24px;
  position: relative;
  margin-bottom: 8px;
}

.modal-list li::before {
  content: "•";
  position: absolute;
  left: 8px;
  color: #ff78ba;
  font-weight: bold;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.action-button {
  flex: 1;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button--secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.action-button--secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.action-button--primary {
  background: linear-gradient(135deg, #ff4d8f 0%, #ff78ba 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(255, 77, 143, 0.3);
}

.action-button--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 77, 143, 0.4);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.9);
}
</style>
