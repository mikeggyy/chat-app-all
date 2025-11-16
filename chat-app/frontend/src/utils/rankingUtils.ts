/**
 * 排行榜工具函數
 */

/**
 * 排行榜時段選項類型
 */
export interface PeriodOption {
  id: string;
  label: string;
}

/**
 * 空元數據類型
 */
export interface EmptyMetadata {
  totalChatUsers: number;
  totalFavorites: number;
  displayName: string;
  portraitUrl: string;
}

/**
 * 格式化標識符（去除空白）
 */
export const normalizeIdentifier = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
};

/**
 * 轉換為正整數
 */
export const toPositiveInteger = (value: unknown): number => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.round(number);
};

/**
 * 格式化分數（加入千位分隔符）
 */
export const formatScore = (value: unknown): string => {
  const number = toPositiveInteger(value);
  if (number === 0) {
    return "—";
  }
  return number.toLocaleString("zh-TW");
};

/**
 * 格式化日期行
 */
export const formatDateLine = (value: unknown): string => {
  if (!value || typeof value !== "string") {
    return "";
  }

  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return "";
  }

  return `${match[1]}/${match[2]}/${match[3]}`;
};

/**
 * 排行榜時段選項
 */
export const PERIOD_OPTIONS: readonly PeriodOption[] = [
  { id: "daily", label: "每日" },
  { id: "weekly", label: "每週" },
  { id: "monthly", label: "每月" },
];

/**
 * 獲取主題名稱
 */
export const getThemeName = (periodId: string): string => {
  const option = PERIOD_OPTIONS.find((opt) => opt.id === periodId);
  return option ? option.label : "";
};

/**
 * 空元數據常量
 */
export const EMPTY_METADATA: Readonly<EmptyMetadata> = Object.freeze({
  totalChatUsers: 0,
  totalFavorites: 0,
  displayName: "",
  portraitUrl: "",
});
