import { ref, onBeforeUnmount } from 'vue';

/**
 * 語音音頻播放管理
 * 負責播放、暫停和清理語音預覽
 */
export function useVoiceAudioPlayer() {
  const isPlayingId = ref('');
  const audioPlayers = new Map();

  /**
   * 切換語音預覽播放
   * @param {string} voiceId - 語音 ID
   * @param {string} previewUrl - 預覽音頻 URL
   */
  const toggleVoicePreview = (voiceId, previewUrl) => {
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
    audioPlayers.forEach((player) => {
      try {
        player.pause();
      } catch {}
    });
    audioPlayers.clear();

    // 創建並播放新的音頻
    const audio = new Audio(previewUrl);
    audio.preload = 'auto';

    // ✅ 修復：存儲事件處理器以便後續移除
    const handleEnded = () => {
      if (isPlayingId.value === voiceId) {
        isPlayingId.value = '';
      }
      // 清理時移除事件監聽器
      audio.removeEventListener('ended', handleEnded);
      audioPlayers.delete(voiceId);
    };

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
   * ✅ 修復：現在也會移除所有事件監聽器
   */
  const cleanupAudio = () => {
    audioPlayers.forEach((player) => {
      try {
        player.pause();
        // ✅ 清除所有事件監聽器（設為 null）
        player.onended = null;
        player.onerror = null;
      } catch {}
    });
    audioPlayers.clear();
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
