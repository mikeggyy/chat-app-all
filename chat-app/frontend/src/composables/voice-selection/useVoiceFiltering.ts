import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { LOCALE_NAMES } from '../../services/voices.service.js';

/**
 * 性別選項介面
 */
interface GenderOption {
  id: 'all' | 'FEMALE' | 'MALE';
  label: string;
}

/**
 * 語言選項介面
 */
interface LocaleOption {
  id: string;
  label: string;
}

/**
 * 語音預設介面
 */
interface VoicePreset {
  locale?: string;
  gender?: 'FEMALE' | 'MALE' | 'NEUTRAL';
  [key: string]: any;
}

/**
 * 角色性別類型
 */
type CharacterGender = 'female' | 'male' | string;

/**
 * 語音過濾和篩選邏輯返回值介面
 */
interface VoiceFilteringReturn {
  selectedGender: Ref<'all' | 'FEMALE' | 'MALE'>;
  hasUserAdjustedGenderFilter: Ref<boolean>;
  genderOptions: GenderOption[];
  localeOptions: ComputedRef<LocaleOption[]>;
  filteredVoicePresets: ComputedRef<VoicePreset[]>;
  formatGender: (gender?: string) => string;
  autoSetGenderFilter: (characterGender?: CharacterGender) => void;
  setupGenderWatcher: (hasLoadedSummary: Ref<boolean>) => void;
}

/**
 * 語音過濾和篩選邏輯
 * 處理性別、語言等篩選條件
 */
export function useVoiceFiltering(voicePresets: Ref<VoicePreset[]>): VoiceFilteringReturn {
  const selectedGender = ref<'all' | 'FEMALE' | 'MALE'>('all');
  const hasUserAdjustedGenderFilter = ref<boolean>(false);
  let suppressGenderWatcher = false;

  const genderOptions: GenderOption[] = [
    { id: 'all', label: '不限性別' },
    { id: 'FEMALE', label: '女性' },
    { id: 'MALE', label: '男性' },
  ];

  /**
   * 動態生成語言選項（基於載入的語音）
   */
  const localeOptions = computed<LocaleOption[]>(() => {
    const locales = new Set<string>();
    voicePresets.value.forEach((preset) => {
      if (preset.locale) {
        locales.add(preset.locale);
      }
    });

    const options: LocaleOption[] = [{ id: 'all', label: '所有語言' }];

    // 優先顯示台灣語音
    if (locales.has('cmn-TW')) {
      options.push({
        id: 'cmn-TW',
        label: LOCALE_NAMES['cmn-TW'] || '繁體中文（台灣）',
      });
    }
    if (locales.has('cmn-CN')) {
      options.push({
        id: 'cmn-CN',
        label: LOCALE_NAMES['cmn-CN'] || '簡體中文（中國）',
      });
    }
    if (locales.has('yue-HK')) {
      options.push({
        id: 'yue-HK',
        label: LOCALE_NAMES['yue-HK'] || '粵語（香港）',
      });
    }
    if (locales.has('ja-JP')) {
      options.push({ id: 'ja-JP', label: LOCALE_NAMES['ja-JP'] || '日語' });
    }
    if (locales.has('ko-KR')) {
      options.push({ id: 'ko-KR', label: LOCALE_NAMES['ko-KR'] || '韓語' });
    }
    if (locales.has('en-US')) {
      options.push({ id: 'en-US', label: LOCALE_NAMES['en-US'] || '英語' });
    }
    if (locales.has('multi')) {
      options.push({ id: 'multi', label: '多語言' });
    }

    return options;
  });

  /**
   * 過濾後的語音列表
   */
  const filteredVoicePresets = computed<VoicePreset[]>(() => {
    const gender = selectedGender.value === 'all' ? '' : selectedGender.value;

    return voicePresets.value.filter((preset) => {
      const genderMatch = gender ? preset.gender === gender : true;
      return genderMatch;
    });
  });

  /**
   * 格式化性別顯示
   */
  const formatGender = (gender?: string): string => {
    if (gender === 'FEMALE' || gender === 'female') {
      return '女性';
    }
    if (gender === 'MALE' || gender === 'male') {
      return '男性';
    }
    if (gender === 'NEUTRAL') {
      return '中性';
    }
    return '不限';
  };

  /**
   * 根據角色性別自動設置聲線性別篩選器
   */
  const autoSetGenderFilter = (characterGender?: CharacterGender): void => {
    if (!characterGender || hasUserAdjustedGenderFilter.value) {
      return;
    }

    suppressGenderWatcher = true;

    if (characterGender === 'female') {
      selectedGender.value = 'FEMALE';
    } else if (characterGender === 'male') {
      selectedGender.value = 'MALE';
    } else {
      selectedGender.value = 'all';
    }
  };

  /**
   * 監聽用戶手動更改性別篩選器
   */
  const setupGenderWatcher = (hasLoadedSummary: Ref<boolean>): void => {
    watch(
      () => selectedGender.value,
      () => {
        if (suppressGenderWatcher) {
          suppressGenderWatcher = false;
          return;
        }
        if (hasLoadedSummary.value) {
          hasUserAdjustedGenderFilter.value = true;
        }
      }
    );
  };

  return {
    selectedGender,
    hasUserAdjustedGenderFilter,
    genderOptions,
    localeOptions,
    filteredVoicePresets,
    formatGender,
    autoSetGenderFilter,
    setupGenderWatcher,
  };
}
