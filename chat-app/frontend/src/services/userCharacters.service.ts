import { apiJson } from "../utils/api.js";

interface FetchUserCharactersOptions {
  skipGlobalLoading?: boolean;
  [key: string]: unknown;
}

interface Character {
  [key: string]: unknown;
}

interface UserCharactersResponse {
  characters: Character[];
  total: number;
}

const normalizeUserId = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
};

export const fetchUserCharacters = async (
  userId: string,
  options: FetchUserCharactersOptions = {}
): Promise<UserCharactersResponse> => {
  const normalizedId = normalizeUserId(userId);
  if (!normalizedId) {
    throw new Error("載入使用者角色時需要提供有效的 userId");
  }

  const path = `/api/users/${encodeURIComponent(normalizedId)}/characters`;
  const data = (await apiJson(path, options)) as Record<string, unknown>;

  const characters = Array.isArray(data?.characters)
    ? (data.characters as Character[])
    : [];
  return {
    characters,
    total: Number.isFinite(data?.total) ? (data.total as number) : characters.length,
  };
};
