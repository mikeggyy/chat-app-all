import { ref } from 'vue';
import { apiJsonCached } from '../../utils/api';
import { logger } from '../../utils/logger';
import { cacheKeys, cacheTTL } from '../../services/apiCache.service';

/**
 * 照片相簿管理
 * 負責加載、顯示和刪除照片
 */
export function usePhotoGallery() {
  const photos = ref([]);
  const isLoading = ref(false);
  const errorMessage = ref('');
  const viewingPhoto = ref(null);

  /**
   * 載入照片列表
   * @param {string} userId - 用戶 ID
   * @param {string} characterId - 角色 ID
   * @param {string} characterPortrait - 角色立繪 URL
   */
  const loadPhotos = async (userId, characterId, characterPortrait, onCharacterLoaded) => {
    if (!userId || !characterId) {
      return;
    }

    isLoading.value = true;
    errorMessage.value = '';

    try {
      // 使用緩存的 API，3 分鐘緩存
      const response = await apiJsonCached(
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

      // 在開頭插入預設照片（角色立繪）
      const defaultPhoto = {
        id: 'default-portrait',
        imageUrl: characterPortrait,
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
   * @param {Set} selectedIds - 選中的照片 ID
   * @param {string} userId - 用戶 ID
   */
  const deletePhotos = async (selectedIds, userId) => {
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
      await apiJsonCached(`/api/photos/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        body: {
          photoIds: photoIdsToDelete,
        },
        skipGlobalLoading: true,
        skipCache: true, // 刪除操作不使用緩存
      });

      return { success: true, deletedCount: photoIdsToDelete.length };
    } catch (err) {
      logger.error('[PhotoGallery] 刪除照片失敗:', err);
      return { success: false, error: '刪除照片失敗，請稍後再試' };
    }
  };

  /**
   * 打開照片查看器
   */
  const openPhotoViewer = (photo) => {
    viewingPhoto.value = photo;
  };

  /**
   * 關閉照片查看器
   */
  const closePhotoViewer = () => {
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
