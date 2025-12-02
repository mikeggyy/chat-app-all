import { ref, onBeforeUnmount, type Ref } from 'vue';
import { logger } from '../../utils/logger.js';

/**
 * 語音音頻播放管理的返回類型
 */
interface VoiceAudioPlayerReturn {
  /** 當前正在播放的語音 ID */
  isPlayingId: Ref<string>;
  /** 切換語音預覽播放 */
  toggleVoicePreview: (voiceId: string, previewUrl: string) => void;
  /** 停止所有音頻播放並清理 */
  cleanupAudio: () => void;
}

/**
 * 語音音頻播放管理
 * 負責播放、暫停和清理語音預覽
 */
export function useVoiceAudioPlayer(): VoiceAudioPlayerReturn {
  const isPlayingId = ref<string>('');
  const audioPlayers = new Map<string, HTMLAudioElement>();
  // ✅ 修復：存儲事件處理器引用，以便在清理時正確移除
  const eventHandlers = new Map<string, () => void>();

  /**
   * 切換語音預覽播放
   * @param voiceId - 語音 ID
   * @param previewUrl - 預覽音頻 URL
   */
  const toggleVoicePreview = (voiceId: string, previewUrl: string): void => {
    if (!previewUrl) {
      return;
    }

    // 如果正在播放該語音，則暫停
    if (isPlayingId.value === voiceId) {
      const existing = audioPlayers.get(voiceId);
      if (existing) {
        existing.pause();
      }
      isPlayingId.value = '';
      return;
    }

    // 檢查是否支持 Audio API
    if (typeof Audio === 'undefined') {
      return;
    }

    // 停止所有正在播放的音頻
    audioPlayers.forEach((player, id) => {
      try {
        player.pause();
        // ✅ 修復：移除事件監聽器
        const handler = eventHandlers.get(id);
        if (handler) {
          player.removeEventListener('ended', handler);
          eventHandlers.delete(id);
        }
      } catch (error) {
        // ✅ 修復：統一使用 logger 記錄音訊暫停錯誤
        logger.warn('[useVoiceAudioPlayer] 暫停音訊時發生錯誤:', error);
      }
    });
    audioPlayers.clear();

    // 創建並播放新的音頻
    const audio = new Audio(previewUrl);
    audio.preload = 'auto';

    // ✅ 修復：存儲事件處理器以便後續移除
    const handleEnded = (): void => {
      if (isPlayingId.value === voiceId) {
        isPlayingId.value = '';
      }
      // 清理時移除事件監聽器
      audio.removeEventListener('ended', handleEnded);
      audioPlayers.delete(voiceId);
      eventHandlers.delete(voiceId);
    };

    // ✅ 修復：存儲事件處理器引用
    eventHandlers.set(voiceId, handleEnded);
    audio.addEventListener('ended', handleEnded);

    audio
      .play()
      .then(() => {
        audioPlayers.set(voiceId, audio);
        isPlayingId.value = voiceId;
      })
      .catch(() => {
        isPlayingId.value = '';
        // ✅ 播放失敗時也清理監聽器
        audio.removeEventListener('ended', handleEnded);
      });
  };

  /**
   * 停止所有音頻播放並清理
   * ✅ 修復：現在也會正確移除所有 addEventListener 添加的事件監聽器
   */
  const cleanupAudio = (): void => {
    audioPlayers.forEach((player, id) => {
      try {
        player.pause();
        // ✅ 修復：移除 addEventListener 添加的監聽器
        const handler = eventHandlers.get(id);
        if (handler) {
          player.removeEventListener('ended', handler);
        }
        // 清除內聯屬性
        player.onended = null;
        player.onerror = null;
      } catch (error) {
        // ✅ 修復：統一使用 logger 記錄清理錯誤
        logger.warn('[useVoiceAudioPlayer] 清理音訊時發生錯誤:', error);
      }
    });
    audioPlayers.clear();
    eventHandlers.clear();
    isPlayingId.value = '';
  };

  // 組件卸載時自動清理
  onBeforeUnmount(() => {
    cleanupAudio();
  });

  return {
    isPlayingId,
    toggleVoicePreview,
    cleanupAudio,
  };
}
