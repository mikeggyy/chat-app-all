<script setup lang="ts">
import { computed, watch } from "vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { logger } from '../utils/logger.js';

interface Voice {
  description?: string;
  name?: string;
  label?: string;
  id?: string;
}

interface Character {
  gender?: string;
  voice?: Voice | string;
  portraitUrl?: string;
  display_name: string;
  background?: string;
  secret_background?: string;
  first_message?: string;
}

interface Props {
  character: Character;
  isVisible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: false,
});

// 🔍 調試：當 props 變化時記錄角色資料
watch(() => props.character, (newChar) => {
  if (newChar && props.isVisible) {
    logger.log('[CharacterCreatedModal] 🎉 收到角色資料：', {
      portraitUrl: newChar.portraitUrl,
      display_name: newChar.display_name,
      gender: newChar.gender,
      voice: newChar.voice,
      background: newChar.background,
      secret_background: newChar.secret_background,
      first_message: newChar.first_message
    });
  }
}, { immediate: true });

interface Emits {
  (e: "close"): void;
  (e: "viewCharacter"): void;
}

const emit = defineEmits<Emits>();

const genderText = computed<string>(() => {
  const gender = props.character?.gender;
  if (!gender) return "未設定";

  // 支援英文和繁體中文兩種格式
  const genderMap: Record<string, string> = {
    // 英文格式
    male: "男性",
    female: "女性",
    "non-binary": "非二元",
    // 繁體中文格式（已經是最終格式）
    "男性": "男性",
    "女性": "女性",
    "非二元": "非二元",
  };

  return genderMap[gender] || gender;
});

const voiceText = computed<string>(() => {
  const voice = props.character?.voice;
  if (!voice) return "未設定";

  // 如果 voice 是物件，優先取 description（描述最友好）
  if (typeof voice === "object") {
    // 優先順序：description > name > label > id
    return voice.description || voice.name || voice.label || voice.id || "未設定";
  }

  // 如果 voice 是字串，直接返回
  return voice;
});

const handleClose = (): void => {
  emit("close");
};

const handleViewCharacter = (): void => {
  emit("viewCharacter");
};
</script>

<template>
  <transition name="modal">
    <div v-if="isVisible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-content">
        <button
          type="button"
          class="modal-close"
          aria-label="關閉"
          @click="handleClose"
        >
          <XMarkIcon aria-hidden="true" />
        </button>

        <div class="modal-header">
          <div class="success-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <h2 class="modal-title">角色創建成功！</h2>
          <p class="modal-subtitle">你的專屬角色已經準備好了</p>
        </div>

        <div class="character-card">
          <div class="character-portrait">
            <img
              :src="character.portraitUrl || '/avatars/defult-01.webp'"
              :alt="character.display_name"
            />
          </div>

          <div class="character-info">
            <h3 class="character-name">{{ character.display_name }}</h3>
            <div class="character-meta">
              <span class="meta-item">
                <span class="meta-label">性別：</span>
                <span class="meta-value">{{ genderText }}</span>
              </span>
              <span v-if="character.voice" class="meta-item">
                <span class="meta-label">聲線：</span>
                <span class="meta-value">{{ voiceText }}</span>
              </span>
            </div>

            <div v-if="character.background" class="character-section">
              <h4 class="section-title">角色背景</h4>
              <p class="section-content">{{ character.background }}</p>
            </div>

            <div v-if="character.secret_background" class="character-section">
              <h4 class="section-title">隱藏設定</h4>
              <p class="section-content">{{ character.secret_background }}</p>
            </div>

            <div v-if="character.first_message" class="character-section">
              <h4 class="section-title">開場白</h4>
              <p class="section-content">{{ character.first_message }}</p>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button
            type="button"
            class="action-button action-button--primary"
            @click="handleViewCharacter"
          >
            查看我的角色
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
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  position: relative;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  background: linear-gradient(
    180deg,
    rgba(30, 30, 50, 0.98) 0%,
    rgba(20, 20, 35, 0.98) 100%
  );
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  padding: 32px 24px;
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

.success-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  color: #10b981;
}

.modal-title {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
}

.modal-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.character-card {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
}

.character-portrait {
  width: 200px;
  height: 200px;
  margin: 0 auto 20px;
  border-radius: 20px;
  overflow: hidden;
  border: 3px solid rgba(255, 120, 186, 0.6);
  box-shadow: 0 8px 24px rgba(255, 120, 186, 0.3);
}

.character-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-info {
  text-align: center;
}

.character-name {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 12px;
}

.character-meta {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.meta-label {
  color: rgba(255, 255, 255, 0.5);
}

.meta-value {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.character-section {
  margin-top: 16px;
  text-align: left;
  background: rgba(255, 255, 255, 0.05);
  padding: 12px;
  border-radius: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 120, 186, 0.9);
  margin-bottom: 6px;
}

.section-content {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.8);
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.action-button {
  padding: 12px 32px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button--primary {
  background: linear-gradient(135deg, #ff4d8f 0%, #ff78ba 100%);
  color: #fff;
}

.action-button--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(255, 77, 143, 0.4);
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
