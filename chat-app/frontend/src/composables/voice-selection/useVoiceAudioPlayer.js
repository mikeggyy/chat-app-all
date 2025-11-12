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

    audio.addEventListener('ended', () => {
      if (isPlayingId.value === voiceId) {
        isPlayingId.value = '';
      }
      audioPlayers.delete(voiceId);
    });

    audio
      .play()
      .then(() => {
        audioPlayers.set(voiceId, audio);
        isPlayingId.value = voiceId;
      })
      .catch(() => {
        isPlayingId.value = '';
      });
  };

  /**
   * 停止所有音頻播放並清理
   */
  const cleanupAudio = () => {
    audioPlayers.forEach((player) => {
      try {
        player.pause();
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
