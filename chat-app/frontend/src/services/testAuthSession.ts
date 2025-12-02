import { logger } from '../utils/logger.js';
import type { UserProfile } from '../types';

export const TEST_SESSION_STORAGE_KEY = "love-story.test-session";

interface TestSession {
  token: string;
  userId: string;
  expiresAt: number;
  profile: UserProfile | null;
  storedAt: number;
}

interface RawStoredSession {
  token?: unknown;
  userId?: unknown;
  expiresAt?: unknown;
  profile?: unknown;
  storedAt?: unknown;
}

interface SessionInput {
  token?: unknown;
  userId?: unknown;
  expiresAt?: unknown;
  profile?: unknown;
}

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const normalizeProfile = (value: unknown): UserProfile | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  return {
    ...value,
  };
};

export const saveTestSession = (session: SessionInput = {}): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const token = typeof session.token === "string" ? session.token.trim() : "";
  const userId =
    typeof session.userId === "string" ? session.userId.trim() : "";
  if (!token || !userId) {
    return;
  }

  const expiresAt = toNumber(session.expiresAt);
  const profile = normalizeProfile(session.profile);

  const payload: TestSession = {
    token,
    userId,
    // 0 代表沒有過期時間
    expiresAt: typeof expiresAt === "number" ? expiresAt : 0,
    profile,
    storedAt: Date.now(),
  };

  try {
    storage.setItem(TEST_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // ✅ 修復：記錄錯誤而非靜默忽略（可能是隱私模式或儲存空間已滿）
    logger.warn('[TestAuthSession] saveTestSession 失敗（可能是隱私模式）:', error);
  }
};

export const loadTestSession = (): TestSession | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(TEST_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: RawStoredSession = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const token =
      typeof parsed.token === "string" ? parsed.token.trim() : "";
    const userId =
      typeof parsed.userId === "string" ? parsed.userId.trim() : "";
    if (!token || !userId) {
      return null;
    }

    const expiresAt = toNumber(parsed.expiresAt) ?? 0;
    const profile = normalizeProfile(parsed.profile);
    const storedAt = toNumber(parsed.storedAt) ?? Date.now();

    return {
      token,
      userId,
      expiresAt,
      profile,
      storedAt,
    };
  } catch (error) {
    // ✅ 修復：記錄錯誤而非靜默忽略（可能是 JSON 解析失敗或隱私模式）
    logger.warn('[TestAuthSession] loadTestSession 失敗:', error);
    return null;
  }
};

export const clearTestSession = (): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(TEST_SESSION_STORAGE_KEY);
  } catch (error) {
    // ✅ 修復：記錄錯誤而非靜默忽略（可能是隱私模式）
    logger.warn('[TestAuthSession] clearTestSession 失敗（可能是隱私模式）:', error);
  }
};

export const isTestSessionValid = (session: unknown): boolean => {
  if (!session || typeof session !== "object") {
    return false;
  }
  const typedSession = session as Partial<TestSession>;
  const token =
    typeof typedSession.token === "string" ? typedSession.token.trim() : "";
  const userId =
    typeof typedSession.userId === "string" ? typedSession.userId.trim() : "";
  if (!token || !userId) {
    return false;
  }
  const expiresAt = toNumber(typedSession.expiresAt);
  if (!expiresAt) {
    return true;
  }
  return Date.now() < expiresAt;
};

export const hasValidTestSession = (): boolean => {
  const session = loadTestSession();
  if (!session) {
    return false;
  }

  if (!isTestSessionValid(session)) {
    clearTestSession();
    return false;
  }

  return true;
};
