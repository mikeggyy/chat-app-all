import { withGlobalLoading } from "../composables/useGlobalLoading.js";
import { useFirebaseAuth } from "../composables/useFirebaseAuth.js";

/**
 * 請求去重緩存
 * 防止同一時間發送重複的請求
 */
const requestCache = new Map();

/**
 * Token 緩存
 * Firebase token 有效期約 1 小時，可以緩存使用
 */
let cachedToken = null;
let tokenExpiry = null;

/**
 * 獲取緩存的 token
 * @returns {Promise<string|null>} token 或 null
 */
const getCachedToken = async () => {
  const now = Date.now();

  // 如果有緩存且未過期，返回緩存的 token
  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken;
  }

  // 否則獲取新 token
  try {
    const { getCurrentUserIdToken } = useFirebaseAuth();
    const token = await getCurrentUserIdToken();

    if (token) {
      cachedToken = token;
      // 測試 token 緩存更長時間（24 小時），Firebase token 緩存 55 分鐘
      const isTestToken = token === 'test-token';
      tokenExpiry = isTestToken
        ? now + 24 * 60 * 60 * 1000
        : now + 55 * 60 * 1000;
      return token;
    }
  } catch (error) {
    // 獲取 token 失敗，清除緩存
    cachedToken = null;
    tokenExpiry = null;
  }

  return null;
};

/**
 * 清除 token 緩存
 * 用於登出或 token 失效時
 */
export const clearTokenCache = () => {
  cachedToken = null;
  tokenExpiry = null;
};

/**
 * 創建請求緩存鍵
 * @param {string} url - 請求 URL
 * @param {Object} options - 請求選項
 * @returns {string} 緩存鍵
 */
const createRequestKey = (url, options = {}) => {
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : '';
  return `${method}:${url}:${body}`;
};

/**
 * 使用去重緩存包裝請求（用於 Response 對象）
 * @param {string} key - 緩存鍵
 * @param {Function} fetcher - 發送請求的函數
 * @returns {Promise} 請求 Promise
 */
const deduplicatedRequest = (key, fetcher) => {
  // 如果已有相同請求在進行中，返回該 Promise
  if (requestCache.has(key)) {
    return requestCache.get(key);
  }

  // 創建新請求
  const promise = fetcher().finally(() => {
    // 請求完成後，延遲 100ms 清理緩存
    // 允許短時間內的後續請求復用結果
    setTimeout(() => {
      requestCache.delete(key);
    }, 100);
  });

  requestCache.set(key, promise);
  return promise;
};

/**
 * JSON 結果緩存（用於解決 Response body stream 只能讀取一次的問題）
 */
const jsonResultCache = new Map();

/**
 * 使用去重緩存包裝 JSON 請求
 * 直接緩存 JSON 結果，避免多次讀取 Response body
 * @param {string} key - 緩存鍵
 * @param {Function} fetcher - 返回 JSON 數據的函數
 * @returns {Promise} JSON 結果 Promise
 */
const deduplicatedJsonRequest = (key, fetcher) => {
  // 如果已有相同請求在進行中，返回該 Promise
  if (jsonResultCache.has(key)) {
    return jsonResultCache.get(key);
  }

  // 創建新請求
  const promise = fetcher().finally(() => {
    // 請求完成後，延遲 100ms 清理緩存
    setTimeout(() => {
      jsonResultCache.delete(key);
    }, 100);
  });

  jsonResultCache.set(key, promise);
  return promise;
};

const normalizeBaseUrl = (value) => {
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const buildUrl = (base, path) => {
  if (!path) return base || "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!base) {
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
};

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value);

const resolveRuntimeOrigin = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  if (typeof self !== "undefined" && self.location?.origin) {
    return self.location.origin;
  }
  return "";
};

const isCrossOrigin = (url) => {
  if (!isAbsoluteUrl(url) || typeof window === "undefined") {
    return false;
  }
  try {
    const targetUrl = new URL(url);
    return targetUrl.origin !== window.location.origin;
  } catch {
    return false;
  }
};

export const getApiBaseUrl = () => {
  const envBase = normalizeBaseUrl(import.meta.env.VITE_API_URL ?? "");

  // 優先使用環境變數設定的 API URL
  if (envBase) {
    return envBase;
  }

  const runtimeOrigin = normalizeBaseUrl(resolveRuntimeOrigin());

  // 如果在開發環境且有 runtime origin，使用 runtime origin（依賴 Vite proxy）
  const shouldPreferRuntimeInDev =
    import.meta.env.DEV &&
    runtimeOrigin &&
    !envBase;

  if (shouldPreferRuntimeInDev) {
    return runtimeOrigin;
  }

  if (runtimeOrigin) return runtimeOrigin;
  return "http://localhost:4000";
};

export const withApiBase = (path = "") => {
  return buildUrl(getApiBaseUrl(), path);
};

const isJsonBody = (value) =>
  value &&
  typeof value === "object" &&
  !(value instanceof FormData) &&
  !(value instanceof Blob) &&
  !(value instanceof ArrayBuffer);

const buildRequestInit = async (options = {}) => {
  const init = { method: "GET", ...options };
  init.headers = {
    Accept: "application/json",
    ...init.headers,
  };

  // 自動添加 Authorization header（使用緩存的 token）
  const token = await getCachedToken();
  if (token) {
    init.headers.Authorization = `Bearer ${token}`;
  }

  if (isJsonBody(init.body)) {
    init.body = JSON.stringify(init.body);
    init.headers = {
      "Content-Type": "application/json",
      ...init.headers,
    };
  }

  return init;
};

export const apiFetch = async (path, options = {}) => {
  const {
    skipGlobalLoading = false,
    absolute = false,
    baseUrl = getApiBaseUrl(),
    skipDeduplication = false, // 允許跳過去重（某些特殊情況）
    ...fetchOptions
  } = options;

  const normalizedBase = normalizeBaseUrl(baseUrl);
  const url = absolute ? path : buildUrl(normalizedBase, path);

  if (!fetchOptions.mode && isCrossOrigin(url)) {
    fetchOptions.mode = "cors";
  }

  const request = async () => {
    try {
      const requestInit = await buildRequestInit(fetchOptions);
      const response = await fetch(url, requestInit);

      if (!response.ok) {
        // 嘗試從響應體中獲取錯誤訊息
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          // 如果無法解析 JSON，使用預設訊息
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        error.url = url;
        throw error;
      }

      return response;
    } catch (error) {
      const networkError =
        error instanceof Error ? error : new Error("Network request failed");
      if (typeof networkError.status !== "number") {
        networkError.status = 0;
      }
      if (networkError.status === 0) {
        networkError.isNetworkError = true;
      }
      networkError.url = url;
      throw networkError;
    }
  };

  const wrappedRequest = () => withGlobalLoading(request, { skipGlobalLoading });

  // 如果啟用去重且是 GET 請求，使用去重機制
  const method = fetchOptions.method || 'GET';
  const shouldDeduplicate = !skipDeduplication && method === 'GET';

  if (shouldDeduplicate) {
    const requestKey = createRequestKey(url, fetchOptions);
    return deduplicatedRequest(requestKey, wrappedRequest);
  }

  return wrappedRequest();
};

export const apiJson = async (path, options = {}) => {
  const {
    skipDeduplication = false,
    ...otherOptions
  } = options;

  // 對於 GET 請求，使用 JSON 結果去重緩存
  const method = otherOptions.method || 'GET';
  if (!skipDeduplication && method === 'GET') {
    const baseUrl = otherOptions.baseUrl || getApiBaseUrl();
    const normalizedBase = normalizeBaseUrl(baseUrl);
    const url = otherOptions.absolute ? path : buildUrl(normalizedBase, path);
    const requestKey = createRequestKey(url, otherOptions);

    return deduplicatedJsonRequest(requestKey, async () => {
      // 在去重內部執行完整的請求+解析流程
      const response = await apiFetch(path, { ...otherOptions, skipDeduplication: true });

      if (otherOptions.rawResponse) {
        return response;
      }

      if (response.status === 204) {
        return null;
      }

      return response.json();
    });
  }

  // 非 GET 請求或跳過去重的請求，直接執行
  const response = await apiFetch(path, otherOptions);

  if (otherOptions.rawResponse) {
    return response;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};
