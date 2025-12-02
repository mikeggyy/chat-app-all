/**
 * 會員方案配置
 *
 * ✅ 2025-11-30 更新：完整訂閱策略
 * - 新增 Lite 入門會員（99 TWD/月）
 * - VIP 調整為 299 TWD/月（原 399）
 * - VVIP 調整為 599 TWD/月（原 999）
 * - 支援月/季/年訂閱週期
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
  BoltIcon,
  PhotoIcon,
} from "@heroicons/vue/24/outline";
import type { FunctionalComponent } from "vue";

/**
 * 會員功能特性
 */
export interface Feature {
  icon: FunctionalComponent;
  title: string;
  detail: string;
  badge?: string | null;
}

/**
 * 訂閱週期價格
 */
export interface CyclePrice {
  price: number;
  currency: string;
  monthlyEquivalent: number;
  discountPercent: number;
}

/**
 * 會員方案配置
 */
export interface MembershipTier {
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
  // 訂閱週期價格
  prices: {
    monthly: CyclePrice;
    quarterly: CyclePrice;
    yearly: CyclePrice;
  };
}

/** Alias for MembershipTier */
export type Tier = MembershipTier;

/**
 * 功能對比項目
 */
interface ComparisonItem {
  name: string;
  free: string;
  lite: string;
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
 * 訂閱週期配置
 */
export const billingCycles = {
  monthly: { id: "monthly", name: "月訂閱", months: 1 },
  quarterly: { id: "quarterly", name: "季訂閱", months: 3 },
  yearly: { id: "yearly", name: "年訂閱", months: 12 },
};

/**
 * 會員方案配置（2025-11-30 更新）
 */
export const membershipTiers: MembershipTier[] = [
  {
    id: "lite",
    label: "Lite",
    headline: "Lite 入門體驗",
    description: "低門檻體驗付費服務，移除廣告，享受更好的對話體驗。",
    priceTag: "NT$ 99",
    pricePeriod: "/ 月",
    highlight: "入門首選",
    highlightColor: "from-green-500 to-teal-600",
    cardGradient: "from-green-600/20 via-teal-600/20 to-cyan-600/20",
    prices: {
      monthly: { price: 99, currency: "TWD", monthlyEquivalent: 99, discountPercent: 0 },
      quarterly: { price: 249, currency: "TWD", monthlyEquivalent: 83, discountPercent: 16 },
      yearly: { price: 799, currency: "TWD", monthlyEquivalent: 67, discountPercent: 32 },
    },
    features: [
      {
        icon: BoltIcon,
        title: "移除廣告",
        detail: "不再被廣告打擾，享受純淨體驗",
        badge: "✓",
      },
      {
        icon: SpeakerWaveIcon,
        title: "30 次對話/角色",
        detail: "每個角色每日 30 次對話（免費: 10）",
        badge: "3倍提升",
      },
      {
        icon: UserGroupIcon,
        title: "10 次配對/日",
        detail: "每日 10 次角色配對（免費: 5）",
        badge: "2倍提升",
      },
      {
        icon: PhotoIcon,
        title: "10 張 AI 照片/月",
        detail: "每月可生成 10 張 AI 照片",
        badge: null,
      },
    ],
  },
  {
    id: "vip",
    label: "VIP",
    headline: "VIP 尊榮體驗",
    description: "大幅提升對話額度，享受更好的 AI 體驗，每月贈送解鎖券。",
    priceTag: "NT$ 299",
    pricePeriod: "/ 月",
    highlight: "人氣首選",
    highlightColor: "from-blue-500 to-indigo-600",
    cardGradient: "from-blue-600/20 via-indigo-600/20 to-purple-600/20",
    prices: {
      monthly: { price: 299, currency: "TWD", monthlyEquivalent: 299, discountPercent: 0 },
      quarterly: { price: 749, currency: "TWD", monthlyEquivalent: 250, discountPercent: 16 },
      yearly: { price: 2399, currency: "TWD", monthlyEquivalent: 200, discountPercent: 33 },
    },
    features: [
      {
        icon: BoltIcon,
        title: "移除廣告",
        detail: "不再被廣告打擾，享受純淨體驗",
        badge: "✓",
      },
      {
        icon: SpeakerWaveIcon,
        title: "100 次對話/角色",
        detail: "每個角色每日 100 次對話",
        badge: "10倍提升",
      },
      {
        icon: UserGroupIcon,
        title: "50 次配對/日",
        detail: "每日 50 次角色配對，進階搜尋功能",
        badge: "10倍提升",
      },
      {
        icon: PhotoIcon,
        title: "30 張 AI 照片/月",
        detail: "每月可生成 30 張 AI 照片",
        badge: null,
      },
      {
        icon: GiftIcon,
        title: "每月贈送解鎖券",
        detail: "每月贈送 1 張角色解鎖券（7天無限對話）",
        badge: "每月送",
      },
      {
        icon: StarIcon,
        title: "9 折優惠",
        detail: "金幣購買、AI 拍照/影片享 9 折",
        badge: null,
      },
    ],
  },
  {
    id: "vvip",
    label: "VVIP",
    headline: "VVIP 黑卡禮遇",
    description: "無限對話、無限語音，極致體驗，每月豐厚贈禮。",
    priceTag: "NT$ 599",
    pricePeriod: "/ 月",
    highlight: "極致尊榮",
    highlightColor: "from-amber-500 via-orange-500 to-pink-600",
    cardGradient: "from-amber-600/20 via-orange-600/20 to-pink-600/20",
    prices: {
      monthly: { price: 599, currency: "TWD", monthlyEquivalent: 599, discountPercent: 0 },
      quarterly: { price: 1499, currency: "TWD", monthlyEquivalent: 500, discountPercent: 17 },
      yearly: { price: 4799, currency: "TWD", monthlyEquivalent: 400, discountPercent: 33 },
    },
    features: [
      {
        icon: SparklesIcon,
        title: "無限對話",
        detail: "所有角色無限對話，盡情暢聊",
        badge: "無限制",
      },
      {
        icon: SpeakerWaveIcon,
        title: "無限語音",
        detail: "無限次 TTS 語音播放",
        badge: "無限制",
      },
      {
        icon: UserGroupIcon,
        title: "無限配對",
        detail: "每日無限次角色配對",
        badge: "無限制",
      },
      {
        icon: PhotoIcon,
        title: "100 張 AI 照片/月",
        detail: "每月可生成 100 張 AI 照片",
        badge: null,
      },
      {
        icon: GiftIcon,
        title: "每月豪華贈禮",
        detail: "每月贈送 3 張解鎖券 + 100 金幣",
        badge: "價值最高",
      },
      {
        icon: StarIcon,
        title: "8 折優惠",
        detail: "金幣購買、AI 拍照/影片享 8 折",
        badge: null,
      },
      {
        icon: CpuChipIcon,
        title: "VVIP 專屬特權",
        detail: "新功能搶先體驗、獨家角色優先解鎖",
        badge: "獨家",
      },
    ],
  },
];

/**
 * 功能對比表格配置（2025-11-30 更新）
 */
export const comparisonFeatures: ComparisonCategory[] = [
  {
    category: "對話功能",
    items: [
      {
        name: "每角色對話次數",
        free: "10 次",
        lite: "30 次",
        vip: "100 次",
        vvip: "無限制",
      },
      {
        name: "語音播放",
        free: "10 次/角色",
        lite: "15 次/角色",
        vip: "50 次/角色",
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
        lite: "10 次",
        vip: "50 次",
        vvip: "無限制",
      },
      {
        name: "進階搜尋",
        free: "✗",
        lite: "✗",
        vip: "✓",
        vvip: "✓",
      },
    ],
  },
  {
    category: "AI 功能",
    items: [
      {
        name: "每月 AI 照片",
        free: "3 張",
        lite: "10 張",
        vip: "30 張",
        vvip: "100 張",
      },
      {
        name: "AI 回覆長度",
        free: "短",
        lite: "中短",
        vip: "中",
        vvip: "長",
      },
    ],
  },
  {
    category: "每月福利",
    items: [
      {
        name: "角色解鎖券",
        free: "-",
        lite: "-",
        vip: "1 張/月",
        vvip: "3 張/月",
      },
      {
        name: "贈送金幣",
        free: "-",
        lite: "-",
        vip: "-",
        vvip: "100/月",
      },
      {
        name: "購買折扣",
        free: "-",
        lite: "-",
        vip: "9 折",
        vvip: "8 折",
      },
    ],
  },
  {
    category: "其他",
    items: [
      {
        name: "移除廣告",
        free: "✗",
        lite: "✓",
        vip: "✓",
        vvip: "✓",
      },
      {
        name: "優先客服",
        free: "✗",
        lite: "✗",
        vip: "✓",
        vvip: "✓",
      },
    ],
  },
];

/**
 * 根據會員等級 ID 獲取對應的配置
 * @param {string} tierId - 會員等級 ID（lite, vip 或 vvip）
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

/**
 * 獲取特定週期的價格
 * @param {string} tierId - 會員等級 ID
 * @param {string} cycle - 訂閱週期（monthly, quarterly, yearly）
 * @returns {CyclePrice|null} 價格信息
 */
export function getTierPrice(tierId: string, cycle: keyof MembershipTier["prices"] = "monthly"): CyclePrice | null {
  const tier = getMembershipTierById(tierId);
  return tier?.prices[cycle] || null;
}
