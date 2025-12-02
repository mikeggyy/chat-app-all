import { ref, computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import { fallbackMatches } from '../../utils/matchFallback.js';
import type { Partner } from '../../types';

/**
 * 角色資料介面（擴展 Partner 以支援更多欄位）
 */
interface Character extends Partial<Partner> {
  id?: string;
  display_name?: string;
  displayName?: string;
  name?: string;
  portraitUrl?: string;
  portrait?: string;
  image?: string;
}

/**
 * useCharacterInfo 的返回類型
 */
interface UseCharacterInfoReturn {
  // 狀態
  character: Ref<Character | null>;
  characterName: ComputedRef<string>;
  characterPortrait: ComputedRef<string>;

  // 方法
  setCharacter: (characterData: Character | null) => void;
}

/**
 * 角色資訊管理
 * 從 API 或 fallback 數據獲取角色資訊
 */
export function useCharacterInfo(
  characterId: Ref<string>
): UseCharacterInfoReturn {
  const character = ref<Character | null>(null);

  /**
   * 角色名稱
   */
  const characterName = computed<string>(() => {
    if (character.value) {
      return (
        character.value.display_name ||
        character.value.display_name ||
        character.value.name ||
        '未知角色'
      );
    }
    // 嘗試從 fallbackMatches 查找（備用方案）
    const fallbackChar = fallbackMatches.find((m) => m.id === characterId.value);
    if (fallbackChar) {
      return fallbackChar.display_name || fallbackChar.display_name || '未知角色';
    }
    return '未知角色';
  });

  /**
   * 角色立繪 URL
   */
  const characterPortrait = computed<string>(() => {
    if (character.value) {
      return (
        character.value.portraitUrl ||
        character.value.portraitUrl ||
        character.value.image ||
        '/ai-role/match-role-01.webp'
      );
    }
    // 嘗試從 fallbackMatches 查找（備用方案）
    const fallbackChar = fallbackMatches.find((m) => m.id === characterId.value);
    if (fallbackChar) {
      return (
        fallbackChar.portraitUrl ||
        fallbackChar.portraitUrl ||
        '/ai-role/match-role-01.webp'
      );
    }
    return '/ai-role/match-role-01.webp';
  });

  /**
   * 設置角色資訊
   * @param characterData - 角色數據
   */
  const setCharacter = (characterData: Character | null): void => {
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
