/**
 * useLimitModalConfig
 * 限制彈窗配置邏輯
 */

import { computed, ComputedRef } from 'vue';
import {
  ExclamationTriangleIcon,
  SpeakerWaveIcon,
  FilmIcon,
} from '@heroicons/vue/24/outline';

/**
 * 彈窗類型配置
 */
interface TypeConfig {
  title: string;
  icon: any;
  iconColor: string;
  highlightColor: string;
  shopCategory: string;
  unlockCardsKey: string;
  adDescription?: string;
  unlockUseDescription: string;
  unlockBuyDescription: string;
  vipTitle?: string;
  vipDescription?: string;
  vipBenefits?: string[];
  hasAd?: boolean;
}

/**
 * VIP 升級配置（照片專用）
 */
interface PhotoVipConfig {
  title: string;
  description: string;
  benefits: string[];
  buttonText: string;
}

/**
 * 組件 Props 類型定義
 */
interface LimitModalProps {
  type: 'conversation' | 'voice' | 'photo' | 'video';
  dailyAdLimit: number;
  adsWatchedToday: number;
  characterUnlockCards?: number;
  voiceUnlockCards?: number;
  photoUnlockCards?: number;
  videoUnlockCards?: number;
  [key: string]: any;
  total: number;
  standardTotal?: number | null;
  tier: string; // 允許 string 類型以兼容組件傳入的值
  resetPeriod?: string;
  cards: number;
  used?: number;
  characterName?: string;
}

/**
 * 類型配置
 */
const TYPE_CONFIG: Record<string, TypeConfig> = {
  conversation: {
    title: '對話次數已達上限',
    icon: ExclamationTriangleIcon,
    iconColor: '#fbbf24',
    highlightColor: '#60a5fa',
    shopCategory: 'character-unlock',
    unlockCardsKey: 'characterUnlockCards',
    adDescription: '觀看一則廣告即可繼續對話',
    unlockUseDescription: '使用角色解鎖卡，暢聊 7 天無限制',
    unlockBuyDescription: '購買角色解鎖卡，獲得 7 天無限對話',
    vipTitle: '升級 VIP 會員',
    vipDescription: '享受無限對話，解鎖所有功能',
    vipBenefits: [
      '✓ 與所有角色無限次對話',
      '✓ AI 回覆更長、記憶更多',
      '✓ 獲得解鎖券和金幣獎勵',
    ],
  },
  voice: {
    title: '語音播放次數已達上限',
    icon: SpeakerWaveIcon,
    iconColor: '#a78bfa',
    highlightColor: '#a78bfa',
    shopCategory: 'voice-unlock',
    unlockCardsKey: 'voiceUnlockCards',
    adDescription: '觀看一則廣告即可額外獲得 5 次語音播放',
    unlockUseDescription: '使用語音解鎖卡立即繼續播放',
    unlockBuyDescription: '購買語音解鎖卡解除播放限制',
    vipTitle: '升級 VIP / VVIP',
    vipDescription: '享受無限語音播放，解鎖所有功能',
    vipBenefits: [
      '✓ 無限次語音播放',
      '✓ 與所有角色無限次對話',
      '✓ AI 回覆更長、記憶更多',
      '✓ 獲得解鎖券和金幣獎勵',
    ],
  },
  photo: {
    title: '拍照次數已達上限',
    icon: ExclamationTriangleIcon,
    iconColor: '#fbbf24',
    highlightColor: '#ec4899',
    shopCategory: 'photo-unlock',
    unlockCardsKey: 'photoUnlockCards',
    unlockUseDescription: '使用照片解鎖卡立即生成照片',
    unlockBuyDescription: '購買照片解鎖卡，隨時補充拍照次數',
    hasAd: false,
  },
  video: {
    title: '影片生成需要影片卡',
    icon: FilmIcon,
    iconColor: '#f59e0b',
    highlightColor: '#8b5cf6',
    shopCategory: 'video-unlock',
    unlockCardsKey: 'videoUnlockCards',
    unlockUseDescription: '使用影片解鎖卡立即生成影片',
    unlockBuyDescription: '購買影片解鎖卡，隨時補充生成次數',
    hasAd: false,
    vipTitle: '升級會員獲取影片卡',
    vipDescription: '升級會員即可獲得影片卡，開通時一次性贈送',
    vipBenefits: [
      '✓ VIP 會員開通時贈送 1 張影片卡',
      '✓ VVIP 會員開通時贈送 5 張影片卡',
      '✓ 影片卡永久有效，用完為止',
      '✓ 同時享受無限對話和語音播放',
    ],
  },
};

/**
 * 返回值類型定義
 */
interface UseLimitModalConfigReturn {
  config: ComputedRef<TypeConfig>;
  remainingAds: ComputedRef<number>;
  canWatchAd: ComputedRef<boolean>;
  unlockCards: ComputedRef<number>;
  hasUnlockCards: ComputedRef<boolean>;
  displayTotal: ComputedRef<number>;
  photoVipConfig: ComputedRef<PhotoVipConfig | null>;
  message: ComputedRef<string>;
}

/**
 * 使用限制彈窗配置
 * @param props - 組件 props
 * @returns 配置相關的計算屬性和方法
 */
// 默認配置（用於未知類型的情況，實際上不應該發生）
const DEFAULT_CONFIG: TypeConfig = {
  title: '已達上限',
  icon: ExclamationTriangleIcon,
  iconColor: '#fbbf24',
  highlightColor: '#60a5fa',
  shopCategory: 'general',
  unlockCardsKey: 'characterUnlockCards',
  unlockUseDescription: '使用解鎖卡繼續使用',
  unlockBuyDescription: '購買解鎖卡解除限制',
};

export function useLimitModalConfig(
  props: LimitModalProps
): UseLimitModalConfigReturn {
  // 當前配置（確保不會返回 undefined）
  const config = computed<TypeConfig>(() => TYPE_CONFIG[props.type] || DEFAULT_CONFIG);

  // 計算剩餘的廣告次數
  const remainingAds = computed<number>(() => {
    return Math.max(0, props.dailyAdLimit - props.adsWatchedToday);
  });

  // 是否還有廣告可以觀看
  const canWatchAd = computed<boolean>(() => {
    return remainingAds.value > 0 && config.value?.hasAd !== false;
  });

  // 解鎖卡數量
  const unlockCards = computed<number>(() => {
    if (!config.value) return 0;
    return props[config.value.unlockCardsKey] || 0;
  });

  // 是否有解鎖卡
  const hasUnlockCards = computed<boolean>(() => {
    return unlockCards.value > 0;
  });

  // 用於顯示的限制數量（照片專用，測試帳號使用標準限制）
  const displayTotal = computed<number>(() => {
    if (props.type === 'photo') {
      return (props.standardTotal !== null && props.standardTotal !== undefined) ? props.standardTotal : props.total;
    }
    return props.total;
  });

  // 會員升級選項配置（照片專用）
  const photoVipConfig = computed<PhotoVipConfig | null>(() => {
    if (props.type !== 'photo') return null;

    if (props.tier === 'vvip') {
      return null; // VVIP 用戶不顯示升級選項
    }

    return {
      title: props.tier === 'free' ? '升級會員' : '升級到 VVIP',
      description:
        props.tier === 'free'
          ? 'VIP 每月 10 次 / VVIP 每月 50 次' +
            (props.resetPeriod === 'monthly' ? '，下個月自動重置' : '')
          : '升級到 VVIP 享受每月 50 次拍照額度' +
            (props.resetPeriod === 'monthly' ? '，下個月自動重置' : ''),
      benefits: [
        props.tier === 'free'
          ? '✓ VIP 每月 10 次 / VVIP 每月 50 次拍照'
          : '✓ VVIP 每月 50 次拍照',
        '✓ 無限對話和語音播放',
        '✓ 獲得解鎖券和金幣獎勵',
      ],
      buttonText: props.tier === 'free' ? '查看方案' : '升級 VVIP',
    };
  });

  // 提示訊息
  const message = computed<string>(() => {
    if (props.type === 'conversation') {
      return `您與「${props.characterName}」的對話次數已達到免費用戶上限。`;
    } else if (props.type === 'voice') {
      return `您與「${props.characterName}」的語音播放次數已達到免費用戶上限。`;
    } else if (props.type === 'photo') {
      let msg = `您已達到 AI 自拍額度上限`;
      if (props.tier === 'free') {
        msg += '（免費用戶終生限制）';
      } else if (props.tier === 'vip') {
        msg += '（VIP 月度限制）';
      } else if (props.tier === 'vvip') {
        msg += '（VVIP 月度限制）';
      }
      if (props.cards > 0) {
        msg += `，另有 ${props.cards} 張照片解鎖卡可用。`;
      }
      return msg;
    } else if (props.type === 'video') {
      if (props.tier === 'free') {
        return props.cards > 0
          ? `您目前有 ${props.cards} 張影片卡可用。`
          : '免費用戶需要升級會員才能獲得影片卡。升級 VIP 可獲得 1 張影片卡，升級 VVIP 可獲得 5 張影片卡。';
      } else {
        const tierName = props.tier === 'vip' ? 'VIP' : 'VVIP';
        if (props.cards > 0) {
          return `您已使用 ${props.used} 次影片生成，目前還有 ${props.cards} 張影片卡可用。`;
        } else {
          return `您已使用完所有影片卡（共使用 ${props.used} 次）。${tierName} 會員開通時贈送的影片卡已用完。`;
        }
      }
    }
    return '';
  });

  return {
    config,
    remainingAds,
    canWatchAd,
    unlockCards,
    hasUnlockCards,
    displayTotal,
    photoVipConfig,
    message,
  };
}
