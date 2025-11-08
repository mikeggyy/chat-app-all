import { apiJson } from "../utils/api.js";

const DEFAULT_LIMIT = 20;

const buildQuery = (params = {}) => {
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

export const fetchRanking = async (options = {}) => {
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
