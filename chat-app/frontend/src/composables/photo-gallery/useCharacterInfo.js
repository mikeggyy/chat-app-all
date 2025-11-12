import { ref, computed } from 'vue';
import { fallbackMatches } from '../../utils/matchFallback';

/**
 * 角色資訊管理
 * 從 API 或 fallback 數據獲取角色資訊
 */
export function useCharacterInfo(characterId) {
  const character = ref(null);

  /**
   * 角色名稱
   */
  const characterName = computed(() => {
    if (character.value) {
      return (
        character.value.display_name ||
        character.value.displayName ||
        character.value.name ||
        '未知角色'
      );
    }
    // 嘗試從 fallbackMatches 查找（備用方案）
    const fallbackChar = fallbackMatches.find((m) => m.id === characterId.value);
    if (fallbackChar) {
      return fallbackChar.display_name || fallbackChar.displayName || '未知角色';
    }
    return '未知角色';
  });

  /**
   * 角色立繪 URL
   */
  const characterPortrait = computed(() => {
    if (character.value) {
      return (
        character.value.portraitUrl ||
        character.value.portrait ||
        character.value.image ||
        '/ai-role/match-role-01.webp'
      );
    }
    // 嘗試從 fallbackMatches 查找（備用方案）
    const fallbackChar = fallbackMatches.find((m) => m.id === characterId.value);
    if (fallbackChar) {
      return (
        fallbackChar.portraitUrl ||
        fallbackChar.portrait ||
        '/ai-role/match-role-01.webp'
      );
    }
    return '/ai-role/match-role-01.webp';
  });

  /**
   * 設置角色資訊
   * @param {Object} characterData - 角色數據
   */
  const setCharacter = (characterData) => {
    character.value = characterData;
  };

  return {
    // 狀態
    character,
    characterName,
    characterPortrait,

    // 方法
    setCharacter,
  };
}
