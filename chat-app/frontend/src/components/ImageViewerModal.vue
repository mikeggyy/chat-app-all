<template>
  <Teleport to="body">
    <Transition name="viewer">
      <div v-if="isOpen" class="image-viewer-backdrop" @click.self="$emit('close')">
        <div class="image-viewer-modal" role="dialog" aria-modal="true" aria-label="圖片查看器">
      <!-- 右上角按鈕組 -->
      <div class="image-viewer-actions">
        <button
          type="button"
          class="image-viewer-action-btn"
          aria-label="下載圖片"
          @click="handleDownload"
        >
          <ArrowDownTrayIcon class="icon" />
        </button>
        <button
          type="button"
          class="image-viewer-action-btn"
          aria-label="關閉"
          @click="$emit('close')"
        >
          <XMarkIcon class="icon" />
        </button>
      </div>

      <!-- 圖片容器 -->
      <div class="image-viewer-content">
        <img
          :src="imageUrl"
          :alt="imageAlt || '自拍照片'"
          class="image-viewer-image"
          @click.stop
        />
      </div>
    </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { XMarkIcon, ArrowDownTrayIcon } from "@heroicons/vue/24/outline";
import { apiFetch } from "../utils/api.js";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  imageUrl: {
    type: String,
    default: "",
  },
  imageAlt: {
    type: String,
    default: "自拍照片",
  },
});

const emit = defineEmits(["close"]);

const handleDownload = async () => {
  try {
    // 使用後端代理 API 下載圖片（繞過 CORS 限制）
    const encodedUrl = encodeURIComponent(props.imageUrl);
    const response = await apiFetch(`/api/photos/download?url=${encodedUrl}`, {
      skipGlobalLoading: true,
    });

    // 取得圖片數據
    const blob = await response.blob();

    // 創建下載連結
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // 從 URL 中提取文件名，或使用時間戳
    const filename = props.imageUrl.split("/").pop() || `selfie-${Date.now()}.jpg`;
    link.download = filename;

    // 觸發下載
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    alert("下載圖片失敗，請稍後再試");
  }
};
</script>

<style scoped lang="scss">
.image-viewer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.95);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.image-viewer-modal {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.image-viewer-actions {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 10;
  display: flex;
  gap: 0.5rem;
}

.image-viewer-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  padding: 0;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);

  .icon {
    width: 24px;
    height: 24px;
  }

  &:hover {
    background: rgba(255, 77, 143, 0.8);
    border-color: rgba(255, 77, 143, 1);
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
}

.image-viewer-content {
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-viewer-image {
  max-width: 100%;
  max-height: 90vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: imageZoomIn 0.3s ease-out;
}

@keyframes imageZoomIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Transition 動畫 */
.viewer-enter-active,
.viewer-leave-active {
  transition: opacity 0.2s ease;
}

.viewer-enter-from,
.viewer-leave-to {
  opacity: 0;
}

.viewer-enter-active .image-viewer-image,
.viewer-leave-active .image-viewer-image {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.viewer-enter-from .image-viewer-image,
.viewer-leave-to .image-viewer-image {
  opacity: 0;
  transform: scale(0.9);
}

/* 移動設備適配 */
@media (max-width: 768px) {
  .image-viewer-modal {
    padding: 0.5rem;
  }

  .image-viewer-actions {
    top: 0.5rem;
    right: 0.5rem;
  }

  .image-viewer-action-btn {
    width: 44px;
    height: 44px;

    .icon {
      width: 22px;
      height: 22px;
    }
  }

  .image-viewer-content {
    max-width: 95vw;
    max-height: 95vh;
  }

  .image-viewer-image {
    max-height: 95vh;
  }
}
</style>
