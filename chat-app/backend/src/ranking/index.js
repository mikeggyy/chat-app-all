import { Router } from "express";
import { getRankingSlice } from "./ranking.service.js";
import {
  sendSuccess,
  sendError,
} from "../../../../shared/utils/errorFormatter.js";

export const rankingRouter = Router();

rankingRouter.get("/", (req, res) => {
  try {
    const result = getRankingSlice({
      period: req.query.period,
      offset: req.query.offset,
      limit: req.query.limit,
    });

    sendSuccess(res, result);
  } catch (error) {
    const status = error?.status ?? 500;
    const message =
      error?.message ?? "無法取得排行榜資料，請稍後再試。";
    sendError(res, status === 400 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR", message);
  }
});
