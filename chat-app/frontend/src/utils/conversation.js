import { apiJson } from "./api.js";
import { generateIdempotencyKey } from "./idempotency.js";

const encodeSegment = (value) => encodeURIComponent(value ?? "");

export const fetchConversationHistory = async (userId, characterId, options = {}) => {
  if (!userId || !characterId) {
    return [];
  }

  const response = await apiJson(
    `/api/conversations/${encodeSegment(userId)}/${encodeSegment(characterId)}`,
    {
      skipGlobalLoading: options.skipGlobalLoading ?? true,
    }
  );

  // ✅ 修復：正確解析 API 響應格式 { success, data: { messages } }
  return Array.isArray(response?.data?.messages) ? response.data.messages : [];
};

export const appendConversationMessages = async (
  userId,
  characterId,
  messages,
  options = {}
) => {
  if (!userId || !characterId) {
    throw new Error("新增聊天紀錄時需要提供使用者與角色編號");
  }

  const payloadMessages = Array.isArray(messages)
    ? messages.filter(Boolean)
    : [messages].filter(Boolean);

  if (!payloadMessages.length) {
    throw new Error("至少需要一則有效訊息才能儲存聊天紀錄");
  }

  const token = options.token ?? "";

  if (!token) {
    throw new Error("新增聊天紀錄時需要有效的登入權杖");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers ?? {}),
  };

  const response = await apiJson(
    `/api/conversations/${encodeSegment(userId)}/${encodeSegment(characterId)}`,
    {
      method: "POST",
      body: { messages: payloadMessages },
      headers,
      skipGlobalLoading: true,
    }
  );

  // ✅ 修復：正確解析 API 響應格式 { success, data: { appended, messages } }
  return {
    appended: Array.isArray(response?.data?.appended) ? response.data.appended : [],
    messages: Array.isArray(response?.data?.messages) ? response.data.messages : [],
  };
};

export const requestAiReply = async (
  userId,
  characterId,
  options = {}
) => {
  if (!userId || !characterId) {
    throw new Error("生成 AI 回覆時需要提供使用者與角色編號");
  }

  const token = options.token ?? "";
  if (!token) {
    throw new Error("生成 AI 回覆時需要有效的登入權杖");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers ?? {}),
  };

  const body = {};

  if (typeof options.userMessage === "string") {
    const trimmed = options.userMessage.trim();
    if (trimmed.length) {
      body.userMessage = trimmed;
    }
  }

  // 支援跳過限制檢查（用於禮物等特殊場景）
  if (options.skipLimitCheck === true) {
    body.skipLimitCheck = true;
  }

  // 🎯 添加冪等性保護：生成唯一的請求 ID
  // 防止網絡重試導致重複扣除對話次數
  body.requestId = generateIdempotencyKey();

  const response = await apiJson(
    `/api/ai/conversations/${encodeSegment(userId)}/${encodeSegment(
      characterId
    )}/reply`,
    {
      method: "POST",
      headers,
      body,
      skipGlobalLoading: true,
    }
  );

  // ✅ 修復：正確解析 API 響應格式 { success, data: { message, messages } }
  return {
    message: response?.data?.message ?? null,
    messages: Array.isArray(response?.data?.messages) ? response.data.messages : [],
  };
};

export const requestAiSuggestions = async (
  userId,
  characterId,
  options = {}
) => {
  if (!userId || !characterId) {
    throw new Error("生成建議回覆時需要提供使用者與角色編號");
  }

  const token = options.token ?? "";
  if (!token) {
    throw new Error("生成建議回覆時需要有效的登入權杖");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers ?? {}),
  };

  const body = {};

  if (typeof options.count === "number" && options.count > 0) {
    body.count = Math.min(Math.round(options.count), 5);
  }

  const response = await apiJson(
    `/api/ai/conversations/${encodeSegment(userId)}/${encodeSegment(
      characterId
    )}/suggestions`,
    {
      method: "POST",
      headers,
      body,
      skipGlobalLoading: true,
    }
  );

  // ✅ 修復：正確解析 API 響應格式 { success, data: { suggestions, fallback, message } }
  return {
    suggestions: Array.isArray(response?.data?.suggestions)
      ? response.data.suggestions
      : [],
    fallback: Boolean(response?.data?.fallback),
    message:
      typeof response?.data?.message === "string" ? response.data.message : undefined,
  };
};
