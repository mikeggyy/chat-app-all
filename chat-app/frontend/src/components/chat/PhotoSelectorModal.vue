<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="photo-selector-backdrop"
      @click.self="handleClose"
    >
      <div class="photo-selector-container">
        <!-- 標題欄 -->
        <div class="photo-selector-header">
          <h2 class="header-title">選擇照片</h2>
          <button
            type="button"
            class="close-button"
            aria-label="關閉"
            @click="handleClose"
          >
            <XMarkIcon class="icon" />
          </button>
        </div>

        <!-- 加載狀態 -->
        <div v-if="isLoading" class="status-container">
          <div class="spinner"></div>
          <p class="status-text">載入照片中...</p>
        </div>

        <!-- 錯誤訊息 -->
        <div v-else-if="errorMessage" class="status-container">
          <p class="status-text status-text--error">{{ errorMessage }}</p>
        </div>

        <!-- 無照片提示 -->
        <div v-else-if="photos.length === 0" class="status-container">
          <p class="status-text">尚無照片，請先生成自拍照</p>
        </div>

        <!-- 照片網格 -->
        <div v-else class="photo-grid">
          <div
            v-for="photo in photos"
            :key="photo.id"
            class="photo-card"
            :class="{ 'photo-card--selected': selectedPhoto?.id === photo.id }"
            @click="handleSelectPhoto(photo)"
          >
            <!-- 預設照片標記 -->
            <div v-if="photo.isDefault" class="default-badge">預設</div>

            <img
              :src="photo.imageUrl"
              :alt="`照片 ${photo.id}`"
              class="photo-image"
              loading="lazy"
            />

            <!-- 選中框 -->
            <div v-if="selectedPhoto?.id === photo.id" class="selected-border">
              <div class="selected-checkmark">
                <CheckIcon class="icon" />
              </div>
            </div>

            <!-- Hover 選擇指示器 -->
            <div v-else class="select-overlay">
              <div class="select-icon">
                <CheckIcon class="icon" />
              </div>
              <span class="select-text">選擇這張</span>
            </div>
          </div>
        </div>

        <!-- 底部按鈕（有選中照片時顯示） -->
        <div v-if="selectedPhoto && !isLoading" class="action-buttons">
          <button type="button" class="btn-unified btn-cancel" @click="handleCancel">
            取消
          </button>
          <button type="button" class="btn-unified btn-confirm" @click="handleConfirm">
            確定
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, type Ref } from "vue";
import { XMarkIcon, CheckIcon } from "@heroicons/vue/24/outline";
import { apiJson } from "../../utils/api";
import { useFirebaseAuth } from "../../composables/useFirebaseAuth";
import { logger } from "@/utils/logger";

// Types
interface Photo {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  mediaType: string;
  isDefault?: boolean;
}

interface Props {
  isOpen: boolean;
  characterId: string;
  characterPhotoUrl?: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'select', imageUrl: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  characterPhotoUrl: "",
});

const emit = defineEmits<Emits>();

const firebaseAuth = useFirebaseAuth();
const isLoading: Ref<boolean> = ref(false);
const errorMessage: Ref<string> = ref("");
const photos: Ref<Photo[]> = ref([]);
const selectedPhoto: Ref<Photo | null> = ref(null);

// 載入照片
const loadPhotos = async (): Promise<void> => {
  if (!props.characterId) return;

  isLoading.value = true;
  errorMessage.value = "";

  try {
    // 獲取當前用戶 ID（從 auth 實例）
    const auth = firebaseAuth.getAuth();
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error("用戶未登入");
    }

    const response = await apiJson(
      `/api/photos/${userId}/character/${props.characterId}`,
      {
        method: "GET",
      }
    );

    // 只保留圖片類型的照片（不包含影片）
    const userPhotos = (response.photos || []).filter(
      (photo: any) => photo.mediaType === "image" && photo.imageUrl
    );

    // 🎯 將角色預設照片加到列表開頭
    const allPhotos: Photo[] = [];
    if (props.characterPhotoUrl) {
      allPhotos.push({
        id: "default",
        imageUrl: props.characterPhotoUrl,
        thumbnailUrl: props.characterPhotoUrl,
        mediaType: "image",
        isDefault: true,
      });
    }

    photos.value = [...allPhotos, ...userPhotos];
  } catch (error) {
    logger.error("載入照片失敗:", error);
    errorMessage.value = "載入照片失敗，請稍後再試";
  } finally {
    isLoading.value = false;
  }
};

// 當彈窗打開時載入照片
watch(
  () => props.isOpen,
  (newValue: boolean): void => {
    if (newValue) {
      loadPhotos();
    } else {
      // 關閉時清空狀態
      photos.value = [];
      errorMessage.value = "";
      selectedPhoto.value = null;
    }
  },
  { immediate: true }
);

// 選擇照片（只標記為選中，不立即發送）
const handleSelectPhoto = (photo: Photo): void => {
  selectedPhoto.value = photo;
};

// 確認選擇
const handleConfirm = (): void => {
  if (selectedPhoto.value) {
    emit("select", selectedPhoto.value.imageUrl);
    handleClose();
  }
};

// 取消選擇
const handleCancel = (): void => {
  selectedPhoto.value = null;
};

// 關閉彈窗
const handleClose = (): void => {
  selectedPhoto.value = null;
  emit("close");
};
</script>

<style scoped lang="scss">
.photo-selector-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.photo-selector-container {
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.photo-selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
}

.header-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.02em;
}

.close-button {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;

  .icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
  }

  &:active {
    transform: scale(0.95);
  }
}

.status-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  gap: 1rem;
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: #ff6b9d;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-text {
  margin: 0;
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.7);

  &--error {
    color: #ff6b9d;
  }
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
  overflow-y: auto;
  max-height: calc(80vh - 100px);

  /* 自定義滾動條樣式 */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
}

.photo-card {
  position: relative;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(255, 107, 157, 0.3);

    .select-overlay {
      opacity: 1;
    }
  }

  &:active {
    transform: translateY(-2px);
  }
}

.default-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  padding: 4px 10px;
  background: linear-gradient(135deg, #ff6b9d 0%, #ff8fb3 100%);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(255, 107, 157, 0.4);
  pointer-events: none;
}

.photo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 12px;
}

.select-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: linear-gradient(
    135deg,
    rgba(255, 107, 157, 0.9),
    rgba(194, 97, 254, 0.9)
  );
  opacity: 0;
  transition: opacity 0.2s ease;
}

.select-icon {
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);

  .icon {
    width: 2rem;
    height: 2rem;
    color: #fff;
    stroke-width: 3;
  }
}

.select-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.02em;
}

// 選中狀態樣式
.photo-card--selected {
  transform: translateY(-4px);
  box-shadow: 0 8px 32px rgba(255, 107, 157, 0.5);
}

.selected-border {
  position: absolute;
  inset: 0;
  border: 4px solid #ff6b9d;
  border-radius: 12px;
  pointer-events: none;
  background: linear-gradient(
    135deg,
    rgba(255, 107, 157, 0.15),
    rgba(194, 97, 254, 0.15)
  );
}

.selected-checkmark {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff6b9d 0%, #c261fe 100%);
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(255, 107, 157, 0.5);

  .icon {
    width: 1.5rem;
    height: 1.5rem;
    color: white;
    stroke-width: 3;
  }
}

// 底部按鈕
.action-buttons {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
}

@media (min-width: 640px) {
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1.25rem;
  }
}

/* ========================================
   桌面版樣式 (≥ 1024px)
   ======================================== */
@media (min-width: 1024px) {
  .photo-selector-container {
    max-width: 800px;
    max-height: 85vh;
    border-radius: 24px;
  }

  .photo-selector-header {
    padding: 1.75rem;
  }

  .header-title {
    font-size: 1.4rem;
  }

  .close-button {
    width: 2.75rem;
    height: 2.75rem;
    transition: all 0.2s ease;

    .icon {
      width: 1.75rem;
      height: 1.75rem;
    }

    &:hover {
      transform: scale(1.1);
    }
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1.5rem;
    padding: 2rem;
    max-height: calc(85vh - 140px);
  }

  .photo-card {
    border-radius: 16px;
    transition: all 0.25s ease;

    &:hover {
      transform: translateY(-6px);
      box-shadow: 0 12px 32px rgba(255, 107, 157, 0.4);
    }
  }

  .photo-image {
    border-radius: 16px;
  }

  .default-badge {
    padding: 5px 12px;
    font-size: 0.8rem;
    border-radius: 14px;
  }

  .select-icon {
    width: 3.5rem;
    height: 3.5rem;

    .icon {
      width: 2.25rem;
      height: 2.25rem;
    }
  }

  .select-text {
    font-size: 1rem;
  }

  .selected-checkmark {
    width: 3rem;
    height: 3rem;
    top: 10px;
    left: 10px;

    .icon {
      width: 1.75rem;
      height: 1.75rem;
    }
  }

  .action-buttons {
    padding: 1.25rem 1.75rem;
    gap: 1.25rem;
  }
}

/* 超寬桌面版 (≥ 1440px) */
@media (min-width: 1440px) {
  .photo-selector-container {
    max-width: 1000px;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  }
}
</style>
