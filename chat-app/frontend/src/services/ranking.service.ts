import { apiJson } from "../utils/api.js";

const DEFAULT_LIMIT = 20;

interface RankingParams {
  period?: string;
  offset?: number;
  limit?: number;
}

interface RankingOptions {
  skipGlobalLoading?: boolean;
}

interface RankingResponse {
  [key: string]: unknown;
}

const buildQuery = (params: RankingParams = {}): string => {
  const searchParams = new URLSearchParams();

  if (params.period) {
    searchParams.set("period", params.period);
  }

  if (Number.isFinite(params.offset)) {
    searchParams.set("offset", String(params.offset));
  }

  if (Number.isFinite(params.limit)) {
    searchParams.set("limit", String(params.limit));
  }

  return searchParams.toString();
};

export const fetchRanking = async (
  options: RankingOptions & RankingParams = {}
): Promise<RankingResponse> => {
  const {
    period = "daily",
    offset = 0,
    limit = DEFAULT_LIMIT,
    skipGlobalLoading = false,
  } = options;

  const query = buildQuery({ period, offset, limit });
  const path = query.length ? `/api/rankings?${query}` : "/api/rankings";

  return apiJson(path, { skipGlobalLoading });
};

export const RANKING_PAGE_SIZE = DEFAULT_LIMIT;
