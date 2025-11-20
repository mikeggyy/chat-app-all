/**
 * 會員方案配置
 *
 * 集中管理會員方案的顯示配置，包括：
 * - 會員等級資訊（VIP, VVIP）
 * - 功能特性描述
 * - 價格標籤
 * - 功能對比表格
 *
 * @module config/membership
 */

import {
  StarIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  UserGroupIcon,
  CpuChipIcon,
  GiftIcon,
} from "@heroicons/vue/24/outline";
import type { FunctionalComponent } from "vue";

/**
 * 會員功能特性
 */
interface Feature {
  icon: FunctionalComponent;
  title: string;
  detail: string;
  badge: string | null;
}

/**
 * 會員方案配置
 */
interface MembershipTier {
  id: string;
  label: string;
  headline: string;
  description: string;
  priceTag: string;
  pricePeriod: string;
  highlight: string;
  highlightColor: string;
  cardGradient: string;
  features: Feature[];
}

/**
 * 功能對比項目
 */
interface ComparisonItem {
  name: string;
  free: string;
  vip: string;
  vvip: string;
}

/**
 * 功能對比類別
 */
interface ComparisonCategory {
  category: string;
  items: ComparisonItem[];
}

/**
 * 會員方案配置（根據最新的會員機制說明）
 */
export const membershipTiers: MembershipTier[] = [
  {
    id: "vip",
    label: "VIP",
    headline: "VIP 尊榮體驗",
    description:
      "大幅提升對話額度，享受更好的 AI 體驗，開通立即獲得豐富獎勵。",
    priceTag: "NT$ 399",
    pricePeriod: "/ 月",
    highlight: "人氣首選",
    highlightColor: "from-blue-500 to-indigo-600",
    cardGradient: "from-blue-600/20 via-indigo-600/20 to-purple-600/20",
    features: [
      {
        icon: SpeakerWaveIcon,
        title: "無限語音播放",
        detail: "無限次使用 TTS 語音功能",
        badge: "無限制",
      },
      {
        icon: UserGroupIcon,
        title: "30 次配對/日",
        detail: "每日 30 次角色配對，看廣告可 +5 次",
        badge: "6倍提升",
      },
      {
        icon: CpuChipIcon,
        title: "提升 AI 回覆",
        detail: "更長的 AI 回覆，更高的記憶容量",
        badge: null,
      },
      {
        icon: GiftIcon,
        title: "開通豪禮",
        detail: "立即送 600 金幣 + 10 張解鎖票 + 20 張照片解鎖卡 + 10 張創建卡",
        badge: "立即獲得",
      },
      {
        icon: StarIcon,
        title: "金幣 9 折優惠",
        detail: "購買金幣享 9 折優惠",
        badge: null,
      },
    ],
  },
  {
    id: "vvip",
    label: "VVIP",
    headline: "VVIP 黑卡禮遇",
    description:
      "頂級 GPT-4o 模型，極致對話體驗，超值豪華禮包，無限配對次數。",
    priceTag: "NT$ 999",
    pricePeriod: "/ 月",
    highlight: "限量尊榮",
    highlightColor: "from-amber-500 via-orange-500 to-pink-600",
    cardGradient: "from-amber-600/20 via-orange-600/20 to-pink-600/20",
    features: [
      {
        icon: SparklesIcon,
        title: "使用頂級模型",
        detail: "專屬使用頂級生成式模型，對話品質最佳",
        badge: "獨家",
      },
      {
        icon: SpeakerWaveIcon,
        title: "無限語音播放",
        detail: "無限次使用 TTS 語音功能",
        badge: "無限制",
      },
      {
        icon: UserGroupIcon,
        title: "無限配對",
        detail: "每日無限次角色配對，不需要看廣告",
        badge: "無限制",
      },
      {
        icon: CpuChipIcon,
        title: "AI 可回覆數最多",
        detail: "最長的 AI 回覆，最高的記憶容量",
        badge: null,
      },
      {
        icon: GiftIcon,
        title: "超值豪華禮包",
        detail: "立即送 2000 金幣 + 30 張解鎖票 + 60 張照片解鎖卡 + 30 張創建卡",
        badge: "價值最高",
      },
      {
        icon: StarIcon,
        title: "金幣 8 折優惠",
        detail: "購買金幣享 8 折優惠",
        badge: null,
      },
    ],
  },
];

/**
 * 功能對比表格配置
 */
export const comparisonFeatures: ComparisonCategory[] = [
  {
    category: "語音功能",
    items: [
      {
        name: "語音播放",
        free: "10 次/角色",
        vip: "無限制",
        vvip: "無限制",
      },
    ],
  },
  {
    category: "配對功能",
    items: [
      {
        name: "每日配對次數",
        free: "5 次",
        vip: "30 次",
        vvip: "無限制",
      },
    ],
  },
  {
    category: "AI 品質",
    items: [
      {
        name: "AI 模型",
        free: "一般模型",
        vip: "高階模型",
        vvip: "最高階模型",
      },
      {
        name: "回覆長度",
        free: "短",
        vip: "中",
        vvip: "高",
      },
    ],
  },
  {
    category: "開通獎勵",
    items: [
      {
        name: "金幣",
        free: "-",
        vip: "送 600",
        vvip: "送 2000",
      },
      {
        name: "解鎖票",
        free: "-",
        vip: "送 10 張",
        vvip: "送 30 張",
      },
      {
        name: "照片解鎖卡",
        free: "-",
        vip: "送 20 張",
        vvip: "送 60 張",
      },
    ],
  },
];

/**
 * 根據會員等級 ID 獲取對應的配置
 * @param {string} tierId - 會員等級 ID（vip 或 vvip）
 * @returns {MembershipTier|null} 會員配置物件，未找到時返回 null
 */
export function getMembershipTierById(tierId: string): MembershipTier | null {
  return membershipTiers.find((tier) => tier.id === tierId) || null;
}

/**
 * 獲取所有可用的會員等級 ID
 * @returns {string[]} 會員等級 ID 列表
 */
export function getAllTierIds(): string[] {
  return membershipTiers.map((tier) => tier.id);
}
