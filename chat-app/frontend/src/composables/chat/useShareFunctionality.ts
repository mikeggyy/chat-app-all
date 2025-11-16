/**
 * 分享功能 Composable
 *
 * 管理聊天分享功能，包括：
 * - 截取聊天畫面
 * - 分享截圖（支援 Web Share API）
 * - 下載截圖（降級方案）
 */

/**
 * 創建分享功能 composable
 * @param {Object} deps - 依賴項
 * @param {Function} deps.getChatPageRef - 獲取聊天頁面 ref
 * @param {Function} deps.getPartnerDisplayName - 獲取角色顯示名稱
 * @param {Function} deps.showError - 顯示錯誤提示
 * @param {Function} deps.showSuccess - 顯示成功提示
 * @returns {Object} 分享功能相關的方法
 */
export function useShareFunctionality(deps: any): any {
  const {
    getChatPageRef,
    getPartnerDisplayName,
    showError,
    showSuccess,
  } = deps;

  // ==========================================
  // 核心方法
  // ==========================================

  /**
   * 下載截圖（降級方案）
   * @param {File} file - 截圖文件
   * @returns {void}
   */
  const downloadScreenshot = (file: File): void => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('截圖已保存，您可以手動分享！');
  };

  /**
   * 處理分享功能
   * @returns {Promise<void>}
   */
  const handleShare = async (): Promise<void> => {
    const chatPageRef = getChatPageRef();

    if (!chatPageRef) {
      showError('無法截圖，請稍後再試。');
      return;
    }

    const characterName = getPartnerDisplayName() || '角色';
    const shareText = `我正在與 ${characterName} 聊天！`;

    try {
      // 動態載入 html2canvas（懶加載）
      const html2canvas = (await import('html2canvas')).default;

      // 截取聊天畫面
      const canvas = await html2canvas(chatPageRef, {
        backgroundColor: '#0f1016',
        scale: 2, // 提高截圖品質
        logging: false,
        useCORS: true, // 允許跨域圖片
        allowTaint: true,
      });

      // 轉換為 Blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png', 0.95);
      });

      if (!blob) {
        throw new Error('截圖失敗');
      }

      // 創建 File 物件
      const file = new File([blob], `chat-${characterName}-${Date.now()}.png`, {
        type: 'image/png',
      });

      // 檢查是否支援分享檔案
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            title: '分享聊天',
            text: shareText,
            files: [file],
          });
          showSuccess('分享成功！');
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            // 降級為下載圖片
            downloadScreenshot(file);
          }
        }
      } else {
        // 不支援分享檔案，提供下載選項
        downloadScreenshot(file);
      }
    } catch (err) {
      showError('截圖失敗，請稍後再試。');
    }
  };

  // ==========================================
  // 返回 API
  // ==========================================
  return {
    // 方法
    handleShare,
    downloadScreenshot,
  };
}
