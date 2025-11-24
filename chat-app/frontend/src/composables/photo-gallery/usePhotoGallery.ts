// @ts-nocheck
import { ref, type Ref } from 'vue';
import { apiJsonCached } from '../../utils/api.js';
import { logger } from '../../utils/logger.js';
import { apiCache, cacheKeys, cacheTTL } from '../../services/apiCache.service.js';
import type { Partner } from '../../types';

/**
 * 照片接口
 */
export interface Photo {
  id: string;
  imageUrl: string;
  text: string;
  createdAt: string;
  role: 'user' | 'partner' | 'ai';
  isDefault?: boolean;
}

/**
 * 照片 API 響應接口
 */
interface PhotoApiResponse {
  photos: Photo[];
  character?: Partner;
}

/**
 * 刪除照片結果接口
 */
interface DeletePhotosResult {
  success: boolean;
  error?: string;
  deletedCount?: number;
}

/**
 * usePhotoGallery 返回類型
 */
interface UsePhotoGalleryReturn {
  // 狀態
  photos: Ref<Photo[]>;
  isLoading: Ref<boolean>;
  errorMessage: Ref<string>;
  viewingPhoto: Ref<Photo | null>;

  // 方法
  loadPhotos: (
    userId: string,
    characterId: string,
    characterPortrait: string,
    onCharacterLoaded?: (character: Partner) => void
  ) => Promise<void>;
  deletePhotos: (selectedIds: Set<string>, userId: string, characterId?: string) => Promise<DeletePhotosResult>;
  openPhotoViewer: (photo: Photo) => void;
  closePhotoViewer: () => void;
}

/**
 * 照片相簿管理
 * 負責加載、顯示和刪除照片
 */
export function usePhotoGallery(): UsePhotoGalleryReturn {
  const photos = ref<Photo[]>([]);
  const isLoading = ref<boolean>(false);
  const errorMessage = ref<string>('');
  const viewingPhoto = ref<Photo | null>(null);

  /**
   * 載入照片列表
   * @param userId - 用戶 ID
   * @param characterId - 角色 ID
   * @param fallbackPortrait - 備用角色立繪 URL（當 API 沒有返回角色資訊時使用）
   * @param onCharacterLoaded - 角色資訊載入後的回調函數
   */
  const loadPhotos = async (
    userId: string,
    characterId: string,
    fallbackPortrait: string,
    onCharacterLoaded?: (character: Partner) => void
  ): Promise<void> => {
    if (!userId || !characterId) {
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';

    try {
      // 使用緩存的 API，3 分鐘緩存
      const response = await apiJsonCached<PhotoApiResponse>(
        `/api/photos/${encodeURIComponent(userId)}/character/${encodeURIComponent(characterId)}`,
        {
          cacheKey: cacheKeys.photoAlbum(characterId),
          cacheTTL: cacheTTL.PHOTO_ALBUM,
          skipGlobalLoading: true,
        }
      );

      // 提取照片和角色資訊
      const loadedPhotos = Array.isArray(response?.photos) ? response.photos : [];

      // 設置角色資訊（如果 API 返回了）
      if (response?.character && onCharacterLoaded) {
        onCharacterLoaded(response.character);
      }

      // ✅ 修復：優先使用 API 返回的角色立繪，確保顯示正確的角色圖片
      const portraitUrl = response?.character?.portraitUrl ||
                          response?.character?.portrait ||
                          response?.character?.image ||
                          fallbackPortrait;

      // 在開頭插入預設照片（角色立繪）
      const defaultPhoto: Photo = {
        id: 'default-portrait',
        imageUrl: portraitUrl,
        text: '角色立繪',
        createdAt: new Date(0).toISOString(), // 最早的時間
        role: 'partner',
        isDefault: true, // 標記為預設照片
      };

      photos.value = [defaultPhoto, ...loadedPhotos];
    } catch (err) {
      errorMessage.value = '載入照片失敗，請稍後再試';
      logger.error('[PhotoGallery] 載入照片失敗:', err);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 刪除照片
   * @param selectedIds - 選中的照片 ID
   * @param userId - 用戶 ID
   * @param characterId - 角色 ID（用於清除緩存）
   * @returns 刪除結果
   */
  const deletePhotos = async (
    selectedIds: Set<string>,
    userId: string,
    characterId?: string
  ): Promise<DeletePhotosResult> => {
    if (selectedIds.size === 0 || !userId) {
      return { success: false, error: '沒有選中的照片' };
    }

    // 過濾掉預設照片 ID（不應該被刪除）
    const photoIdsToDelete = Array.from(selectedIds).filter(
      (id) => id !== 'default-portrait'
    );

    if (photoIdsToDelete.length === 0) {
      return { success: false, error: '預設照片無法刪除' };
    }

    try {
      // 使用相簿 API 刪除照片（不影響對話歷史）
      logger.info(`[PhotoGallery] 開始刪除照片: userId=${userId}, photoIds=`, photoIdsToDelete);

      const response = await apiJsonCached(`/api/photos/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        body: {
          photoIds: photoIdsToDelete,
        },
        skipGlobalLoading: true,
        skipCache: true, // 刪除操作不使用緩存
      });

      logger.info(`[PhotoGallery] 刪除照片 API 回應:`, response);

      // ✅ 修復：刪除成功後清除照片緩存，確保重新載入時獲取最新數據
      if (characterId) {
        const cacheKey = cacheKeys.photoAlbum(characterId);
        apiCache.clear(cacheKey);
        logger.info(`[PhotoGallery] 已清除照片緩存: ${cacheKey}`);
      }

      return { success: true, deletedCount: photoIdsToDelete.length };
    } catch (err: any) {
      logger.error('[PhotoGallery] 刪除照片失敗:', err);
      logger.error('[PhotoGallery] 錯誤詳情:', {
        message: err?.message,
        status: err?.status,
        url: err?.url,
        isNetworkError: err?.isNetworkError,
      });
      return { success: false, error: '刪除照片失敗，請稍後再試' };
    }
  };

  /**
   * 打開照片查看器
   * @param photo - 要查看的照片
   */
  const openPhotoViewer = (photo: Photo): void => {
    viewingPhoto.value = photo;
  };

  /**
   * 關閉照片查看器
   */
  const closePhotoViewer = (): void => {
    viewingPhoto.value = null;
  };

  return {
    // 狀態
    photos,
    isLoading,
    errorMessage,
    viewingPhoto,

    // 方法
    loadPhotos,
    deletePhotos,
    openPhotoViewer,
    closePhotoViewer,
  };
}
