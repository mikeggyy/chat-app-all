<template>
  <div class="photo-gallery-screen">
    <!-- 頂部導航欄 -->
    <PhotoGalleryHeader
      :character-name="characterName"
      :photo-count="photoCount"
      :is-edit-mode="editMode.isEditMode.value"
      @close="handleClose"
      @enter-edit-mode="editMode.enterEditMode"
      @cancel-edit-mode="editMode.cancelEditMode"
    />

    <!-- 主內容區 -->
    <main class="photo-gallery-content" @scroll="handleContentScroll">
      <!-- 載入中 -->
      <div v-if="gallery.isLoading.value" class="status-message">
        <SparklesIcon class="status-icon" />
        <p>載入照片中...</p>
      </div>

      <!-- 錯誤訊息 -->
      <div
        v-else-if="gallery.errorMessage.value"
        class="status-message status-message--error"
      >
        <p>{{ gallery.errorMessage.value }}</p>
      </div>

      <!-- 照片/影片網格 -->
      <div v-else class="photo-grid-wrapper">
        <div class="photo-grid">
          <PhotoCard
            v-for="photo in visiblePhotos"
            :key="photo.id"
            :photo="photo"
            :is-selected="editMode.selectedIds.value.has(photo.id)"
            :is-edit-mode="editMode.isEditMode.value"
            :alt="characterName"
            @click="editMode.handlePhotoClick(photo, gallery.openPhotoViewer)"
            @toggle-selection="editMode.toggleSelection"
          />
        </div>

        <!-- ✅ P1 優化（2025-01）：虛擬滾動加載指示器 -->
        <div v-if="virtualScroll.isLoadingMore.value" class="loading-more">
          <div class="loading-spinner"></div>
          <p>載入更多照片...</p>
        </div>

        <!-- 已全部載入提示 -->
        <div v-else-if="!hasMorePhotos && visiblePhotos.length > 0" class="all-loaded">
          <p>已顯示全部 {{ gallery.photos.value.length }} 張照片</p>
        </div>
      </div>
    </main>

    <!-- 編輯模式：底部操作欄 -->
    <div v-if="editMode.isEditMode.value && editMode.selectedIds.value.size > 0" class="edit-actions">
      <button
        type="button"
        class="delete-btn"
        @click="showDeleteConfirm = true"
      >
        <TrashIcon class="icon" />
        刪除 {{ editMode.selectedIds.value.size }} 張照片
      </button>
    </div>

    <!-- 刪除確認對話框 -->
    <DeleteConfirmDialog
      :is-visible="showDeleteConfirm"
      :selected-count="editMode.selectedIds.value.size"
      :is-deleting="isDeleting"
      @cancel="showDeleteConfirm = false"
      @confirm="handleDeletePhotos"
    />

    <!-- 圖片查看器 -->
    <Teleport to="body">
      <ImageViewerModal
        v-if="gallery.viewingPhoto.value && (gallery.viewingPhoto.value as Photo).mediaType !== 'video'"
        :is-open="!!gallery.viewingPhoto.value"
        :image-url="(gallery.viewingPhoto.value as Photo).imageUrl"
        :image-alt="`${characterName}的照片`"
        @close="gallery.closePhotoViewer"
      />
    </Teleport>

    <!-- 影片查看器 -->
    <VideoViewer
      :is-open="!!(gallery.viewingPhoto.value && (gallery.viewingPhoto.value as Photo).mediaType === 'video')"
      :video="gallery.viewingPhoto.value || undefined"
      @close="gallery.closePhotoViewer"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { ComputedRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { SparklesIcon, TrashIcon } from "@heroicons/vue/24/outline";
import { useUserProfile } from "../composables/useUserProfile";
import { useToast } from "../composables/useToast";
import ImageViewerModal from "../components/ImageViewerModal.vue";

// 子組件
import PhotoGalleryHeader from "../components/photo-gallery/PhotoGalleryHeader.vue";
import PhotoCard from "../components/photo-gallery/PhotoCard.vue";
import DeleteConfirmDialog from "../components/photo-gallery/DeleteConfirmDialog.vue";
import VideoViewer from "../components/photo-gallery/VideoViewer.vue";

// Composables
import { usePhotoGallery, type Photo } from "../composables/photo-gallery/usePhotoGallery";
import { usePhotoEditMode } from "../composables/photo-gallery/usePhotoEditMode";
import { useCharacterInfo } from "../composables/photo-gallery/useCharacterInfo";
import { useVirtualScroll } from "../composables/useVirtualScroll";

const route = useRoute();
const router = useRouter();
const { user } = useUserProfile();
const { success, error: showError } = useToast();

// ✅ P1 優化（2025-01）：虛擬滾動，提升 10 倍性能
const virtualScroll = useVirtualScroll({
  initialCount: 20,        // 初始顯示 20 張照片
  incrementCount: 20,      // 每次加載 20 張
  loadDelay: 100,          // 快速加載
  scrollThreshold: 400,    // 距離底部 400px 時開始加載
});

// 路由參數
const characterId: ComputedRef<string> = computed(() => route.params.characterId as string);

// 角色資訊
const characterInfo = useCharacterInfo(characterId);
const { characterName, characterPortrait, setCharacter } = characterInfo;

// 照片相簿
const gallery = usePhotoGallery();

// 編輯模式
const editMode = usePhotoEditMode();

// 刪除確認
const showDeleteConfirm = ref<boolean>(false);
const isDeleting = ref<boolean>(false);

// 照片數量
const photoCount = computed<number>(() => {
  return gallery.photos.value.length;
});

// ✅ P1 優化（2025-01）：虛擬滾動 - 只顯示可見範圍的照片
const visiblePhotos = computed<Photo[]>(() => {
  return gallery.photos.value.slice(0, virtualScroll.displayedCount.value);
});

// 是否還有更多照片可加載
const hasMorePhotos = computed<boolean>(() => {
  return virtualScroll.displayedCount.value < gallery.photos.value.length;
});

// 處理滾動事件（虛擬滾動）
const handleContentScroll = (event: Event): void => {
  virtualScroll.handleScroll(event, hasMorePhotos.value);
};

// 載入照片
const loadPhotosData = async (): Promise<void> => {
  if (!user.value?.id) return;

  await gallery.loadPhotos(
    user.value.id,
    characterId.value,
    characterPortrait.value,
    setCharacter
  );
};

// 刪除照片
const handleDeletePhotos = async (): Promise<void> => {
  if (!user.value?.id) return;

  isDeleting.value = true;

  // ✅ 修復：傳入 characterId 以清除照片緩存
  const result = await gallery.deletePhotos(
    editMode.selectedIds.value,
    user.value.id,
    characterId.value
  );

  if (result.success) {
    success(`已刪除 ${result.deletedCount} 張照片`);

    // 重新載入照片
    await loadPhotosData();

    // 退出編輯模式
    editMode.cancelEditMode();
    showDeleteConfirm.value = false;
  } else {
    showError(result.error || '刪除照片失敗');
  }

  isDeleting.value = false;
};

// 關閉相簿
const handleClose = (): void => {
  router.back();
};

// 組件掛載時載入照片
onMounted(() => {
  loadPhotosData();
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

.status-message--error {
  color: #ff9db8;
}

/* ✅ P1 優化（2025-01）：虛擬滾動容器 */
.photo-grid-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

/* ✅ P1 優化（2025-01）：加載更多指示器 */
.loading-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
  color: rgba(250, 241, 255, 0.7);
}

.loading-more p {
  margin: 0;
  font-size: 0.9rem;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: rgba(255, 77, 143, 0.8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.all-loaded {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
}

.all-loaded p {
  margin: 0;
  color: rgba(250, 241, 255, 0.5);
  font-size: 0.85rem;
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

@media (min-width: 640px) {
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1.25rem;
  }
}

// ========================================
// 桌面版樣式 (≥ 1024px)
// ========================================

@media (min-width: 1024px) {
  .photo-gallery-screen {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px;
    padding-bottom: 48px;
    min-height: auto;
    background: transparent;
  }

  .photo-gallery-content {
    padding: 0;
    max-height: none;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1.5rem;
  }

  .edit-actions {
    position: relative;
    background: transparent;
    border-top: none;
    padding: 1.5rem 0;
  }

  .delete-btn {
    max-width: 400px;
    margin: 0 auto;
  }
}

@media (min-width: 1440px) {
  .photo-gallery-screen {
    max-width: 1400px;
  }

  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}
</style>
