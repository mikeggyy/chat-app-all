<template>
  <div class="photo-gallery-screen">
    <!-- 頂部導航欄 -->
    <header class="photo-gallery-header">
      <button
        type="button"
        class="header-btn"
        aria-label="關閉"
        @click="handleClose"
      >
        <XMarkIcon class="icon" />
      </button>
      <div class="header-title">
        <h1>{{ characterName }}</h1>
        <p class="subtitle">{{ photoCount }} 張照片</p>
      </div>
      <button
        v-if="!isEditMode && photoCount > 1"
        type="button"
        class="header-btn"
        aria-label="編輯"
        @click="enterEditMode"
      >
        <PencilIcon class="icon" />
      </button>
      <button
        v-else-if="isEditMode"
        type="button"
        class="header-btn header-btn--cancel"
        aria-label="取消"
        @click="cancelEditMode"
      >
        取消
      </button>
      <span v-else class="header-spacer" aria-hidden="true"></span>
    </header>

    <!-- 主內容區 -->
    <main class="photo-gallery-content">
      <!-- 載入中 -->
      <div v-if="isLoading" class="status-message">
        <SparklesIcon class="status-icon" />
        <p>載入照片中...</p>
      </div>

      <!-- 錯誤訊息 -->
      <div
        v-else-if="errorMessage"
        class="status-message status-message--error"
      >
        <p>{{ errorMessage }}</p>
      </div>

      <!-- 照片/影片網格（總是顯示，因為至少有預設照片） -->
      <div v-else class="photo-grid">
        <div
          v-for="photo in photos"
          :key="photo.id"
          class="photo-card"
          :class="{
            'photo-card--selected': selectedIds.has(photo.id),
            'photo-card--video': photo.mediaType === 'video',
          }"
          @click="handlePhotoClick(photo)"
        >
          <!-- 圖片 -->
          <img
            v-if="photo.imageUrl"
            :src="photo.imageUrl"
            :alt="`${characterName}的照片`"
            class="photo-image"
            loading="lazy"
          />
          <!-- 影片縮略圖（使用 video 標籤的第一幀） -->
          <video
            v-else-if="photo.videoUrl || photo.video?.url"
            :src="photo.videoUrl || photo.video?.url"
            class="photo-video"
            preload="metadata"
            muted
          />
          <!-- 影片播放圖標 -->
          <div v-if="photo.mediaType === 'video'" class="video-play-overlay">
            <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span v-if="photo.video?.duration" class="video-duration">{{
              photo.video.duration
            }}</span>
          </div>
          <!-- 編輯模式：選擇框（預設照片不顯示） -->
          <div v-if="isEditMode && !photo.isDefault" class="photo-checkbox">
            <div
              class="checkbox-container"
              :class="{
                'checkbox-container--checked': selectedIds.has(photo.id),
              }"
              @click.stop="toggleSelection(photo.id)"
            >
              <div class="checkbox-inner">
                <svg
                  v-if="selectedIds.has(photo.id)"
                  class="checkbox-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 編輯模式：底部操作欄 -->
    <div v-if="isEditMode && selectedIds.size > 0" class="edit-actions">
      <button
        type="button"
        class="delete-btn"
        @click="showDeleteConfirm = true"
      >
        <TrashIcon class="icon" />
        刪除 {{ selectedIds.size }} 張照片
      </button>
    </div>

    <!-- 刪除確認對話框 -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="confirm-backdrop"
        @click.self="showDeleteConfirm = false"
      >
        <div class="confirm-dialog" role="dialog" aria-modal="true">
          <h2>確認刪除</h2>
          <p>確定要刪除這 {{ selectedIds.size }} 張照片嗎？此操作無法復原。</p>
          <div class="confirm-actions">
            <button
              type="button"
              class="confirm-btn confirm-btn--cancel"
              @click="showDeleteConfirm = false"
            >
              取消
            </button>
            <button
              type="button"
              class="confirm-btn confirm-btn--delete"
              @click="handleDeletePhotos"
              :disabled="isDeleting"
            >
              {{ isDeleting ? "刪除中..." : "確認刪除" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 圖片查看器 -->
    <Teleport to="body">
      <ImageViewerModal
        v-if="viewingPhoto && viewingPhoto.mediaType !== 'video'"
        :is-open="!!viewingPhoto"
        :image-url="viewingPhoto.imageUrl"
        :image-alt="`${characterName}的照片`"
        @close="viewingPhoto = null"
      />
    </Teleport>

    <!-- 影片查看器 -->
    <Teleport to="body">
      <div
        v-if="viewingPhoto && viewingPhoto.mediaType === 'video'"
        class="video-viewer-backdrop"
        @click.self="viewingPhoto = null"
      >
        <div class="video-viewer-container">
          <button
            type="button"
            class="video-viewer-close"
            aria-label="關閉"
            @click="viewingPhoto = null"
          >
            <XMarkIcon class="icon" />
          </button>
          <video
            :src="viewingPhoto.videoUrl || viewingPhoto.video?.url"
            class="video-viewer-player"
            controls
            autoplay
            playsinline
          >
            您的瀏覽器不支持影片播放。
          </video>
          <div v-if="viewingPhoto.video" class="video-viewer-info">
            <span v-if="viewingPhoto.video.duration" class="info-badge">{{
              viewingPhoto.video.duration
            }}</span>
            <span v-if="viewingPhoto.video.resolution" class="info-badge">{{
              viewingPhoto.video.resolution
            }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  CameraIcon,
  SparklesIcon,
} from "@heroicons/vue/24/outline";
import { apiJson } from "../utils/api";
import { useUserProfile } from "../composables/useUserProfile";
import { useToast } from "../composables/useToast";
import { fallbackMatches } from "../utils/matchFallback";
import ImageViewerModal from "../components/ImageViewerModal.vue";

const route = useRoute();
const router = useRouter();
const { user } = useUserProfile();
const { success, error: showError } = useToast();

// 路由參數
const characterId = computed(() => route.params.characterId);

// 角色資訊（從 API 獲取）
const character = ref(null);

const characterName = computed(() => {
  if (character.value) {
    return (
      character.value.display_name ||
      character.value.displayName ||
      character.value.name ||
      "未知角色"
    );
  }
  // 嘗試從 fallbackMatches 查找（備用方案）
  const fallbackChar = fallbackMatches.find((m) => m.id === characterId.value);
  if (fallbackChar) {
    return fallbackChar.display_name || fallbackChar.displayName || "未知角色";
  }
  return "未知角色";
});

const characterPortrait = computed(() => {
  if (character.value) {
    return (
      character.value.portraitUrl ||
      character.value.portrait ||
      character.value.image ||
      "/ai-role/match-role-01.webp"
    );
  }
  // 嘗試從 fallbackMatches 查找（備用方案）
  const fallbackChar = fallbackMatches.find((m) => m.id === characterId.value);
  if (fallbackChar) {
    return (
      fallbackChar.portraitUrl ||
      fallbackChar.portrait ||
      "/ai-role/match-role-01.webp"
    );
  }
  return "/ai-role/match-role-01.webp";
});

// 照片資料
const photos = ref([]);
const isLoading = ref(false);
const errorMessage = ref("");

// 編輯模式
const isEditMode = ref(false);
const selectedIds = ref(new Set());

// 查看照片
const viewingPhoto = ref(null);

// 刪除確認
const showDeleteConfirm = ref(false);
const isDeleting = ref(false);

// 照片數量（包含預設照片）
const photoCount = computed(() => {
  return photos.value.length;
});

// 載入照片
const loadPhotos = async () => {
  if (!user.value?.id || !characterId.value) {
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    // 從獨立的相簿 API 讀取照片（不依賴對話歷史）
    const response = await apiJson(
      `/api/photos/${encodeURIComponent(
        user.value.id
      )}/character/${encodeURIComponent(characterId.value)}`,
      { skipGlobalLoading: true }
    );

    // 提取照片和角色資訊
    const loadedPhotos = Array.isArray(response?.photos) ? response.photos : [];

    // 設置角色資訊（如果 API 返回了）
    if (response?.character) {
      character.value = response.character;
    }

    // 在開頭插入預設照片（角色立繪）
    const defaultPhoto = {
      id: "default-portrait",
      imageUrl: characterPortrait.value,
      text: "角色立繪",
      createdAt: new Date(0).toISOString(), // 最早的時間
      role: "partner",
      isDefault: true, // 標記為預設照片
    };

    photos.value = [defaultPhoto, ...loadedPhotos];
  } catch (err) {
    errorMessage.value = "載入照片失敗，請稍後再試";
    if (import.meta.env.DEV) {
      console.error("[PhotoGallery] 載入照片失敗:", err);
    }
  } finally {
    isLoading.value = false;
  }
};

// 進入編輯模式
const enterEditMode = () => {
  isEditMode.value = true;
  selectedIds.value = new Set();
};

// 取消編輯模式
const cancelEditMode = () => {
  isEditMode.value = false;
  selectedIds.value = new Set();
};

// 切換選擇
const toggleSelection = (photoId) => {
  const newSet = new Set(selectedIds.value);
  if (newSet.has(photoId)) {
    newSet.delete(photoId);
  } else {
    newSet.add(photoId);
  }
  selectedIds.value = newSet;
};

// 處理照片點擊
const handlePhotoClick = (photo) => {
  if (isEditMode.value) {
    toggleSelection(photo.id);
  } else {
    viewingPhoto.value = photo;
  }
};

// 刪除照片
const handleDeletePhotos = async () => {
  if (selectedIds.value.size === 0 || !user.value?.id || !characterId.value) {
    return;
  }

  // 過濾掉預設照片 ID（不應該被刪除）
  const photoIdsToDelete = Array.from(selectedIds.value).filter(
    (id) => id !== "default-portrait"
  );

  if (photoIdsToDelete.length === 0) {
    showError("預設照片無法刪除");
    showDeleteConfirm.value = false;
    return;
  }

  isDeleting.value = true;

  try {
    // 使用相簿 API 刪除照片（不影響對話歷史）
    await apiJson(`/api/photos/${encodeURIComponent(user.value.id)}`, {
      method: "DELETE",
      body: {
        photoIds: photoIdsToDelete,
      },
      skipGlobalLoading: true,
    });

    success(`已刪除 ${photoIdsToDelete.length} 張照片`);

    // 重新載入照片
    await loadPhotos();

    // 退出編輯模式
    cancelEditMode();
    showDeleteConfirm.value = false;
  } catch (err) {
    showError("刪除照片失敗，請稍後再試");
    if (import.meta.env.DEV) {
    }
  } finally {
    isDeleting.value = false;
  }
};

// 關閉相簿
const handleClose = () => {
  router.back();
};

// 組件掛載時載入照片
onMounted(() => {
  loadPhotos();
});
</script>

<style scoped>
.photo-gallery-screen {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #110319 0%, #0a0211 45%, #160325 100%);
  color: #fbf5ff;
}

.photo-gallery-header {
  display: flex;
  align-items: center;
  padding: 1rem 1.25rem;
  gap: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  height: 2.75rem;
  padding: 0 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(6, 2, 15, 0.45);
  color: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.header-btn .icon {
  width: 1.35rem;
  height: 1.35rem;
}

.header-btn:active {
  transform: scale(0.94);
}

.header-btn--cancel {
  background: rgba(255, 255, 255, 0.12);
}

.header-spacer {
  min-width: 2.75rem;
}

.header-title {
  flex: 1;
  text-align: center;
}

.header-title h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: rgba(250, 241, 255, 0.7);
}

.photo-gallery-content {
  padding: 1.5rem 1.25rem 2rem;
  overflow-y: auto;
  flex: 1;
  max-height: calc(100dvh - 114px);
}

.status-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
  color: rgba(250, 241, 255, 0.8);
}

.status-icon {
  width: 3rem;
  height: 3rem;
  opacity: 0.6;
}

.status-hint {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(250, 241, 255, 0.6);
}

.status-message--error {
  color: #ff9db8;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

.photo-card {
  position: relative;
  aspect-ratio: 2/3;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.photo-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
}

.photo-card--selected {
  outline: 3px solid #ff4d8f;
  outline-offset: -3px;
}

.photo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none; /* 防止點擊視頻元素時觸發播放 */
}

.video-play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  pointer-events: none;
}

.play-icon {
  width: 3rem;
  height: 3rem;
  color: #fff;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
}

.video-duration {
  position: absolute;
  bottom: 0.75rem;
  right: 0.75rem;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.photo-checkbox {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
}

.checkbox-container {
  width: 2rem;
  height: 2rem;
  cursor: pointer;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  border: 2px solid rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.checkbox-container:hover {
  transform: scale(1.1);
  border-color: rgba(255, 255, 255, 0.7);
  background: rgba(0, 0, 0, 0.65);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.checkbox-container--checked {
  background: linear-gradient(135deg, #ff4d8f 0%, #ff1744 100%);
  border-color: #ff4d8f;
  box-shadow: 0 4px 12px rgba(255, 77, 143, 0.5);
}

.checkbox-container--checked:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(255, 77, 143, 0.6);
  background: linear-gradient(135deg, #ff6ba8 0%, #ff3d5c 100%);
}

.checkbox-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-icon {
  width: 1.1rem;
  height: 1.1rem;
  color: #ffffff;
  animation: checkmark-appear 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes checkmark-appear {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    transform: scale(1.15);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.edit-actions {
  position: sticky;
  bottom: 0;
  padding: 1rem 1.25rem;
  background: linear-gradient(
    to top,
    rgba(17, 3, 25, 0.98) 0%,
    rgba(17, 3, 25, 0.95) 70%,
    rgba(17, 3, 25, 0) 100%
  );
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.delete-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 16px;
  border: none;
  background: linear-gradient(135deg, #ff4d8f 0%, #ff1744 100%);
  color: #ffffff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-btn .icon {
  width: 1.25rem;
  height: 1.25rem;
}

.delete-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(255, 77, 143, 0.4);
}

.delete-btn:active {
  transform: translateY(0);
}

.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  padding: 1rem;
}

.confirm-dialog {
  width: 100%;
  max-width: 400px;
  padding: 1.5rem;
  border-radius: 20px;
  background: linear-gradient(135deg, #2a1a3a 0%, #1a0a2a 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.confirm-dialog h2 {
  margin: 0 0 1rem;
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
}

.confirm-dialog p {
  margin: 0 0 1.5rem;
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(250, 241, 255, 0.85);
  text-align: center;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
}

.confirm-btn {
  flex: 1;
  padding: 0.875rem;
  border-radius: 12px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.confirm-btn--cancel {
  background: rgba(255, 255, 255, 0.12);
  color: #fbf5ff;
}

.confirm-btn--cancel:hover {
  background: rgba(255, 255, 255, 0.18);
}

.confirm-btn--delete {
  background: linear-gradient(135deg, #ff4d8f 0%, #ff1744 100%);
  color: #ffffff;
}

.confirm-btn--delete:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(255, 77, 143, 0.4);
}

.confirm-btn--delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 影片查看器樣式 */
.video-viewer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.95);
  padding: 1rem;
}

.video-viewer-container {
  position: relative;
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.video-viewer-close {
  position: absolute;
  top: -3rem;
  right: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
}

.video-viewer-close .icon {
  width: 1.5rem;
  height: 1.5rem;
}

.video-viewer-close:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.video-viewer-player {
  width: 100%;
  max-height: 80vh;
  border-radius: 16px;
  background: #000;
  object-fit: contain;
}

.video-viewer-info {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  align-items: center;
}

.info-badge {
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
  letter-spacing: 0.02em;
}

@media (min-width: 640px) {
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1.25rem;
  }
}

@media (min-width: 1024px) {
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1.5rem;
  }
}
</style>
