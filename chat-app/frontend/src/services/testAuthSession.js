export const TEST_SESSION_STORAGE_KEY = "love-story.test-session";

const getStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
};

const toNumber = (value) => {
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

const normalizeProfile = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  return {
    ...value,
  };
};

export const saveTestSession = (session = {}) => {
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

  const payload = {
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
  }
};

export const loadTestSession = () => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(TEST_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
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
    return null;
  }
};

export const clearTestSession = () => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(TEST_SESSION_STORAGE_KEY);
  } catch (error) {
  }
};

export const isTestSessionValid = (session) => {
  if (!session || typeof session !== "object") {
    return false;
  }
  const token =
    typeof session.token === "string" ? session.token.trim() : "";
  const userId =
    typeof session.userId === "string" ? session.userId.trim() : "";
  if (!token || !userId) {
    return false;
  }
  const expiresAt = toNumber(session.expiresAt);
  if (!expiresAt) {
    return true;
  }
  return Date.now() < expiresAt;
};

export const hasValidTestSession = () => {
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
