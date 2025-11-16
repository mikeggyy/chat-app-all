<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AvatarCropperOverlay from "./AvatarCropperOverlay.vue";

interface AvatarOption {
  src: string;
  label: string;
}

interface Props {
  defaultAvatars?: AvatarOption[];
  currentPhoto?: string;
  saving?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  defaultAvatars: () => [],
  currentPhoto: "",
  saving: false,
});

interface Emits {
  (e: "close"): void;
  (e: "update", result: string): void;
}

const emit = defineEmits<Emits>();

const presetAvatars = computed<AvatarOption[]>(() =>
  Array.isArray(props.defaultAvatars) ? props.defaultAvatars : []
);

const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedSource = ref<string>("");
const uploadedResult = ref<string>("");
const uploadSourceRaw = ref<string>("");
const isCropperOpen = ref<boolean>(false);

const activeSource = computed(
  () => selectedSource.value || props.currentPhoto || ""
);
const usingUpload = computed(() => uploadedResult.value.length > 0);
const canConfirm = computed(() => Boolean(activeSource.value));

let lastCurrentPhoto: string = props.currentPhoto ?? "";

const initializeState = (): void => {
  selectedSource.value = props.currentPhoto ?? "";
  uploadedResult.value = "";
  uploadSourceRaw.value = "";
  isCropperOpen.value = false;
  lastCurrentPhoto = props.currentPhoto ?? "";
};

onMounted(() => {
  initializeState();
  document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
});

watch(
  () => props.currentPhoto,
  (next) => {
    const nextValue = next ?? "";
    if (
      !usingUpload.value &&
      (!selectedSource.value || selectedSource.value === lastCurrentPhoto)
    ) {
      selectedSource.value = nextValue;
    }
    lastCurrentPhoto = nextValue;
  }
);

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key !== "Escape") return;
  if (isCropperOpen.value) return;
  emit("close");
};

const triggerFilePicker = (): void => {
  fileInputRef.value?.click();
};

const handleFileChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const files = target?.files;
  if (!files || !files.length) return;
  const [file] = files;
  const reader = new FileReader();
  reader.onload = () => {
    uploadSourceRaw.value = String(reader.result ?? "");
    if (uploadSourceRaw.value) {
      isCropperOpen.value = true;
    }
  };
  reader.readAsDataURL(file);
  if (target) {
    target.value = "";
  }
};

const handleCropConfirm = (result: string | null): void => {
  if (!result) {
    handleCropCancel();
    return;
  }
  uploadedResult.value = result;
  selectedSource.value = result;
  isCropperOpen.value = false;
};

const handleCropCancel = (): void => {
  isCropperOpen.value = false;
};

const reopenCropper = (): void => {
  if (!uploadSourceRaw.value) return;
  isCropperOpen.value = true;
};

const selectPreset = (src: string): void => {
  if (!src) return;
  uploadedResult.value = "";
  uploadSourceRaw.value = "";
  selectedSource.value = src;
  isCropperOpen.value = false;
};

const confirmSelection = (): void => {
  const result = activeSource.value;
  if (!result) return;
  emit("update", result);
};

const emitClose = (): void => {
  emit("close");
};
</script>

<template>
  <div class="avatar-editor" @click.self="emitClose">
    <div
      class="avatar-editor__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-editor-title"
    >
      <header class="avatar-editor__header">
        <h2 id="avatar-editor-title">編輯頭像</h2>
        <button
          type="button"
          class="avatar-editor__close"
          aria-label="關閉頭像編輯視窗"
          @click="emitClose"
        >
          ×
        </button>
      </header>

      <div class="avatar-editor__content">
        <section class="avatar-editor__section">
          <h3>預設頭像</h3>
          <ul class="avatar-editor__preset-list">
            <li v-for="avatar in presetAvatars" :key="avatar.src">
              <button
                type="button"
                class="avatar-editor__preset"
                :class="{ 'is-active': selectedSource === avatar.src }"
                :aria-label="avatar.label"
                @click="selectPreset(avatar.src)"
              >
                <img :src="avatar.src" :alt="avatar.label" />
              </button>
            </li>
          </ul>
        </section>

        <section class="avatar-editor__section avatar-editor__workspace">
          <header class="avatar-editor__workspace-header">
            <h3>自訂上傳</h3>
            <p>* 支援常見圖片格式，照片裁切將套用圓形遮罩。</p>
          </header>

          <div class="avatar-editor__uploader">
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="sr-only"
              @change="handleFileChange"
            />
            <button
              type="button"
              class="avatar-editor__upload-button"
              @click="triggerFilePicker"
            >
              從相簿上傳
            </button>
            <button
              v-if="usingUpload && uploadSourceRaw"
              type="button"
              class="avatar-editor__recrop-button"
              @click="reopenCropper"
            >
              重新裁切
            </button>
          </div>

          <div v-if="activeSource" class="avatar-editor__preview-area">
            <div class="avatar-editor__preview-avatar">
              <img :src="activeSource" alt="頭像預覽" />
            </div>
            <p v-if="usingUpload" class="avatar-editor__hint">
              已套用自訂裁切，若需調整可再次裁切。
            </p>
            <p v-else class="avatar-editor__hint">可直接套用選擇的頭像。</p>
          </div>

          <div v-else class="avatar-editor__empty">
            <p>請選擇預設頭像或上傳新照片。</p>
          </div>
        </section>
      </div>

      <footer class="avatar-editor__footer">
        <button
          type="button"
          class="btn-unified btn-cancel"
          @click="emitClose"
        >
          取消
        </button>
        <button
          type="button"
          class="btn-unified btn-confirm"
          :disabled="!canConfirm || props.saving"
          @click="confirmSelection"
        >
          套用
        </button>
      </footer>
    </div>

    <AvatarCropperOverlay
      v-if="isCropperOpen && uploadSourceRaw"
      :source="uploadSourceRaw"
      @cancel="handleCropCancel"
      @confirm="handleCropConfirm"
    />
  </div>
</template>

<style scoped lang="scss">
.avatar-editor {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(1.5rem, 4vw, 3rem);
  background: rgba(12, 14, 28, 0.75);
  backdrop-filter: blur(6px);
}

.avatar-editor__panel {
  width: 23rem;
  max-height: 87vh;
  background: #141520;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  box-shadow: 0 24px 60px rgba(8, 10, 24, 0.45);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.avatar-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  h2 {
    margin: 0;
    font-size: 1.2rem;
    letter-spacing: 0.08em;
  }
}

.avatar-editor__close {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 150ms ease, transform 150ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.18);
    transform: translateY(-1px);
  }
}

.avatar-editor__content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

.avatar-editor__section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
  h3 {
    margin: 0;
    font-size: 1rem;
    letter-spacing: 0.08em;
    color: rgba(226, 232, 240, 0.72);
  }
}

.avatar-editor__preset-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.avatar-editor__preset {
  border: none;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: transform 150ms ease, box-shadow 150ms ease;

  img {
    display: block;
    width: 100%;
    border-radius: 50%;
    border: 2px solid transparent;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }

  &:hover {
    transform: translateY(-2px);
  }

  &.is-active img {
    border-color: #ff7ab8;
    box-shadow: 0 12px 26px rgba(255, 77, 143, 0.35);
  }
}

.avatar-editor__workspace {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.avatar-editor__workspace-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  p {
    margin: 0;
    font-size: 0.7rem;
    color: rgba(226, 232, 240, 0.72);
  }
}

.avatar-editor__uploader {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.avatar-editor__upload-button,
.avatar-editor__recrop-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.6rem 1.1rem;
  border-radius: 999px;
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
}

.avatar-editor__upload-button {
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  color: #fff;
  box-shadow: 0 16px 32px rgba(255, 77, 143, 0.35);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 40px rgba(255, 77, 143, 0.45);
  }
}

.avatar-editor__recrop-button {
  background: rgba(255, 255, 255, 0.12);
  color: #f8fafc;
  box-shadow: 0 14px 28px rgba(8, 10, 24, 0.28);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 36px rgba(8, 10, 24, 0.38);
  }
}

.avatar-editor__preview-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  img {
    width: 100%;
  }
}

.avatar-editor__preview-avatar {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 18px 32px rgba(8, 10, 24, 0.38);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.avatar-editor__hint {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  color: rgba(226, 232, 240, 0.65);
}

.avatar-editor__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  border-radius: 20px;
  border: 1px dashed rgba(148, 163, 184, 0.3);
  color: rgba(226, 232, 240, 0.65);
  font-size: 0.9rem;
  letter-spacing: 0.05em;
}

.avatar-editor__footer {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .avatar-editor__preview-area {
    align-items: center;
  }
}
</style>
