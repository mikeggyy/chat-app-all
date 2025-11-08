import { rankingDatasets } from "./ranking.data.js";

const PERIOD_FALLBACK = "daily";
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const normalizePeriod = (raw) => {
  if (!raw) return PERIOD_FALLBACK;
  const value = String(raw).toLowerCase();
  if (value === "weekly") return "weekly";
  return "daily";
};

const normalizeOffset = (raw) => {
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 0) {
    return 0;
  }
  return value;
};

const normalizeLimit = (raw) => {
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(value, MAX_LIMIT);
};

const enrichEntry = (entry, rank) => ({
  rank,
  id: entry.id ?? `entry-${rank}`,
  name: entry.name ?? "",
  handle: entry.handle ?? "",
  title: entry.title ?? "",
  score: Number.isFinite(entry.score) ? entry.score : 0,
  avatar: entry.avatar ?? "",
});

export const getRankingSlice = (options = {}) => {
  const period = normalizePeriod(options.period);
  const dataset = rankingDatasets[period];

  if (!dataset || !Array.isArray(dataset.entries)) {
    return {
      period,
      updatedAt: null,
      podium: [],
      entries: [],
      totalEntries: 0,
      hasMore: false,
      nextOffset: null,
    };
  }

  const offset = normalizeOffset(options.offset);
  const limit = normalizeLimit(options.limit);

  const orderedEntries = dataset.entries
    .map((entry, index) => enrichEntry(entry, index + 1));

  const podium = orderedEntries.slice(0, 3);
  const pagedSource = orderedEntries.slice(3);
  const pageEntries = pagedSource.slice(offset, offset + limit);
  const entries = pageEntries.map((entry) => ({
    ...entry,
    rank: entry.rank,
  }));

  const nextOffsetCandidate = offset + entries.length;
  const hasMore = nextOffsetCandidate < pagedSource.length;

  return {
    period,
    updatedAt: dataset.updatedAt ?? null,
    podium,
    entries,
    totalEntries: pagedSource.length,
    hasMore,
    nextOffset: hasMore ? nextOffsetCandidate : null,
  };
};
