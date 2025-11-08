import { apiJson } from "../utils/api.js";

const normalizeUserId = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
};

export const fetchUserCharacters = async (userId, options = {}) => {
  const normalizedId = normalizeUserId(userId);
  if (!normalizedId) {
    throw new Error("載入使用者角色時需要提供有效的 userId");
  }

  const path = `/api/users/${encodeURIComponent(normalizedId)}/characters`;
  const data = await apiJson(path, options);

  const characters = Array.isArray(data?.characters) ? data.characters : [];
  return {
    characters,
    total: Number.isFinite(data?.total) ? data.total : characters.length,
  };
};
