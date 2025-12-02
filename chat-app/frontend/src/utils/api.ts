import { withGlobalLoading } from "../composables/useGlobalLoading.js";
import { useFirebaseAuth } from "../composables/useFirebaseAuth.js";
import { apiCache } from "../services/apiCache.service.js";
import { logger } from './logger.js';

/**
 * API 請求選項
 * 擴展 RequestInit 但允許 body 為普通對象（會自動 JSON 序列化）
 */
interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, any> | null;
  skipGlobalLoading?: boolean;
  absolute?: boolean;
  baseUrl?: string;
  skipDeduplication?: boolean;
  rawResponse?: boolean;
  timeoutMs?: number;
}

/**
 * API 快取選項
 */
interface ApiCacheOptions extends Omit<ApiOptions, 'skipGlobalLoading' | 'absolute' | 'baseUrl' | 'skipDeduplication'> {
  cacheKey?: string;
  cacheTTL?: number;
  skipCache?: boolean;
  skipGlobalLoading?: boolean;
  absolute?: boolean;
  baseUrl?: string;
  skipDeduplication?: boolean;
  rawResponse?: boolean;
}

/**
 * API 錯誤回應
 */
interface ApiErrorResponse {
  message?: string;
  error?: string;
}

/**
 * 擴展的 Error 類型，包含 API 錯誤信息
 */
interface ApiError extends Error {
  status: number;
  url: string;
  isNetworkError?: boolean;
}

/**
 * 請求去重緩存
 * 防止同一時間發送重複的請求
 */
const requestCache = new Map<string, Promise<Response>>();

/**
 * Token 緩存
 * Firebase token 有效期約 1 小時，可以緩存使用
 */
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * 獲取緩存的 token
 * @returns token 或 null
 *
 * ✅ 修復：訪客用戶的測試 token 不會被添加到 API 請求中
 * 這樣可以避免公開 API 因無效 token 而返回 401 錯誤
 */
const getCachedToken = async (): Promise<string | null> => {
  const now = Date.now();

  // 如果有緩存且未過期，返回緩存的 token
  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    // ✅ 修復：不返回測試 token，因為它在後端是無效的
    if (cachedToken === 'test-token') {
      return null;
    }
    return cachedToken;
  }

  // 否則獲取新 token
  try {
    const { getCurrentUserIdToken } = useFirebaseAuth();
    const token = await getCurrentUserIdToken();

    if (token) {
      // ✅ 修復：測試 token 不添加到 API 請求中
      // 訪客用戶使用的是假 token，後端無法驗證
      // 對於公開 API，不帶 token 可以正常訪問
      // 對於需要認證的 API，訪客用戶應該被前端邏輯阻擋
      if (token === 'test-token') {
        return null;
      }

      cachedToken = token;
      // Firebase token 緩存 50 分鐘（留 10 分鐘緩衝）
      tokenExpiry = now + 50 * 60 * 1000;
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
export const clearTokenCache = (): void => {
  cachedToken = null;
  tokenExpiry = null;
};

/**
 * 創建請求緩存鍵
 * @param url - 請求 URL
 * @param options - 請求選項
 * @returns 緩存鍵
 */
const createRequestKey = (url: string, options: Partial<ApiOptions> = {}): string => {
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : '';
  return `${method}:${url}:${body}`;
};

/**
 * 使用去重緩存包裝請求（用於 Response 對象）
 * @param key - 緩存鍵
 * @param fetcher - 發送請求的函數
 * @returns 請求 Promise
 */
const deduplicatedRequest = (key: string, fetcher: () => Promise<Response>): Promise<Response> => {
  // 如果已有相同請求在進行中，返回該 Promise
  if (requestCache.has(key)) {
    return requestCache.get(key)!;
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
const jsonResultCache = new Map<string, Promise<any>>();

/**
 * 使用去重緩存包裝 JSON 請求
 * 直接緩存 JSON 結果，避免多次讀取 Response body
 * @param key - 緩存鍵
 * @param fetcher - 返回 JSON 數據的函數
 * @returns JSON 結果 Promise
 */
const deduplicatedJsonRequest = <T = any>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  // 如果已有相同請求在進行中，返回該 Promise
  if (jsonResultCache.has(key)) {
    return jsonResultCache.get(key)!;
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

const normalizeBaseUrl = (value: string | undefined): string => {
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const buildUrl = (base: string, path: string): string => {
  if (!path) return base || "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!base) {
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
};

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const resolveRuntimeOrigin = (): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  if (typeof self !== "undefined" && self.location?.origin) {
    return self.location.origin;
  }
  return "";
};

const isCrossOrigin = (url: string): boolean => {
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

export const getApiBaseUrl = (): string => {
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
  // 開發環境返回空字串，依賴 Vite 代理
  return "";
};

export const withApiBase = (path: string = ""): string => {
  return buildUrl(getApiBaseUrl(), path);
};

const isJsonBody = (value: any): boolean =>
  value &&
  typeof value === "object" &&
  !(value instanceof FormData) &&
  !(value instanceof Blob) &&
  !(value instanceof ArrayBuffer);

/**
 * ✅ 修復：安全解析 JSON 響應
 * 處理非 JSON 響應和解析錯誤
 * @param response - Fetch Response 對象
 * @returns 解析後的 JSON 數據
 */
const safeJsonParse = async <T = any>(response: Response): Promise<T> => {
  const contentType = response.headers.get('content-type');

  // 檢查是否為 JSON 響應
  if (!contentType || !contentType.includes('application/json')) {
    // 非 JSON 響應，嘗試讀取文字內容
    const text = await response.text();

    // 如果是空內容，返回 null
    if (!text || text.trim() === '') {
      return null as T;
    }

    // 嘗試作為 JSON 解析（某些服務器可能未設置正確的 Content-Type）
    try {
      return JSON.parse(text) as T;
    } catch {
      logger.warn('[API] 響應不是有效的 JSON:', text.substring(0, 100));
      throw new Error(`Expected JSON response but received: ${contentType || 'unknown'}`);
    }
  }

  // JSON 響應，嘗試解析
  try {
    return await response.json() as T;
  } catch (parseError) {
    logger.error('[API] JSON 解析失敗:', parseError);
    throw new Error('Failed to parse JSON response');
  }
};

/**
 * 從 Cookie 中獲取 CSRF Token
 * @returns CSRF Token 或 null
 */
const getCsrfTokenFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(/(?:^|;\s*)_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const buildRequestInit = async (options: Partial<ApiOptions> = {}): Promise<RequestInit> => {
  const init: RequestInit = {
    method: "GET",
    credentials: 'include', // ✅ 修復：允許跨域發送和接收 Cookie
    ...options as RequestInit
  };
  init.headers = {
    Accept: "application/json",
    ...init.headers,
  };

  // 自動添加 Authorization header（使用緩存的 token）
  const token = await getCachedToken();
  if (token) {
    (init.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  // ✅ 自動添加 CSRF Token（對於寫操作）
  const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(init.method?.toUpperCase() || 'GET');
  if (isWriteMethod) {
    const csrfToken = getCsrfTokenFromCookie();
    if (csrfToken) {
      (init.headers as Record<string, string>)['x-csrf-token'] = csrfToken;
    }
  }

  if (isJsonBody(init.body)) {
    // 調試日誌：記錄序列化前的 body
    const bodyObj = init.body as Record<string, any>;
    if (bodyObj?.appearance || bodyObj?.persona || bodyObj?.voice) {
      logger.log('[apiJson] Before JSON.stringify - body object:', {
        bodyKeys: Object.keys(bodyObj),
        hasAppearance: !!bodyObj.appearance,
        appearanceKeys: bodyObj.appearance ? Object.keys(bodyObj.appearance) : [],
        hasDescription: !!bodyObj.appearance?.description,
        descriptionLength: bodyObj.appearance?.description?.length || 0,
      });
    }

    init.body = JSON.stringify(init.body);

    // 調試日誌：記錄序列化後的 body
    if ((init.body as string).includes('appearance')) {
      logger.log('[apiJson] After JSON.stringify - body string (first 500 chars):', (init.body as string).substring(0, 500));
    }

    init.headers = {
      "Content-Type": "application/json",
      ...init.headers,
    };
  }

  return init;
};

export const apiFetch = async (path: string, options: ApiOptions = {}): Promise<Response> => {
  const {
    skipGlobalLoading = false,
    absolute = false,
    baseUrl = getApiBaseUrl(),
    skipDeduplication = false, // 允許跳過去重（某些特殊情況）
    timeoutMs,
    ...fetchOptions
  } = options;

  const normalizedBase = normalizeBaseUrl(baseUrl);
  const url = absolute ? path : buildUrl(normalizedBase, path);

  if (!fetchOptions.mode && isCrossOrigin(url)) {
    fetchOptions.mode = "cors";
  }

  const request = async (): Promise<Response> => {
    const controller = typeof timeoutMs === "number" && timeoutMs > 0 ? new AbortController() : null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const requestOptions: ApiOptions = { ...fetchOptions };

    if (controller) {
      if (requestOptions.signal) {
        const existingSignal = requestOptions.signal as AbortSignal;
        if (existingSignal.aborted) {
          controller.abort();
        } else {
          existingSignal.addEventListener("abort", () => controller.abort(), { once: true });
        }
      }
      requestOptions.signal = controller.signal;
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
      const requestInit = await buildRequestInit(requestOptions);
      const response = await fetch(url, requestInit);

      if (!response.ok) {
        // ✅ 處理 401 錯誤：token 過期，自動重試
        if (response.status === 401) {
          logger.warn('[API] Token 過期，嘗試重新獲取 token 並重試...');

          // 清除 token 緩存
          clearTokenCache();

          // 嘗試重新獲取 token
          try {
            const { getCurrentUserIdToken } = useFirebaseAuth();
            const freshToken = await getCurrentUserIdToken(true); // forceRefresh = true

            if (freshToken) {
              // 使用新 token 重新發送請求
              const retryInit = await buildRequestInit(requestOptions);
              const retryResponse = await fetch(url, retryInit);

              if (retryResponse.ok) {
                logger.log('[API] 使用新 token 重試成功');
                return retryResponse;
              }
            }
          } catch (refreshError) {
            logger.error('[API] Token 重新獲取失敗:', refreshError);
            // 如果重新獲取失敗，繼續拋出原始錯誤
          }
        }

        // 嘗試從響應體中獲取錯誤訊息
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          // ✅ 修復：先檢查 Content-Type 再嘗試解析 JSON
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData: ApiErrorResponse = await response.json();
            if (errorData.message) {
              errorMessage = errorData.message;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          } else {
            // 非 JSON 響應，嘗試讀取文字內容
            const text = await response.text();
            if (text && text.length < 200) {
              errorMessage = `${errorMessage}: ${text}`;
            }
          }
        } catch (parseError) {
          // ✅ 修復：記錄解析錯誤以便調試
          logger.warn('[API] 無法解析錯誤響應:', parseError instanceof Error ? parseError.message : parseError);
        }

        const error = new Error(errorMessage) as ApiError;
        error.status = response.status;
        error.url = url;
        throw error;
      }

      return response;
    } catch (error) {
      const networkError: ApiError =
        error instanceof Error ? error as ApiError : new Error("Network request failed") as ApiError;
      if (typeof networkError.status !== "number") {
        networkError.status = 0;
      }
      if (networkError.status === 0) {
        networkError.isNetworkError = true;
      }
      networkError.url = url;
      throw networkError;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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

export const apiJson = async <T = any>(path: string, options: ApiOptions = {}): Promise<T> => {
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
        return response as unknown as T;
      }

      if (response.status === 204) {
        return null as unknown as T;
      }

      // ✅ 修復：使用 safeJsonParse 處理 JSON 解析錯誤
      return safeJsonParse(response);
    });
  }

  // 非 GET 請求或跳過去重的請求，直接執行
  const response = await apiFetch(path, otherOptions);

  // DEBUG: 追蹤非 GET 請求的回應
  if (method === 'DELETE') {
    logger.log('[apiJson] DELETE 請求完成:', {
      path,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });
  }

  if (otherOptions.rawResponse) {
    return response as unknown as T;
  }

  if (response.status === 204) {
    return null as unknown as T;
  }

  // ✅ 修復：使用 safeJsonParse 處理 JSON 解析錯誤
  const jsonData = await safeJsonParse(response);

  // DEBUG: 追蹤 DELETE 請求的 JSON 回應
  if (method === 'DELETE') {
    logger.log('[apiJson] DELETE 請求 JSON 回應:', jsonData);
  }

  return jsonData;
};

/**
 * 帶長期緩存的 API JSON 請求
 * 使用 apiCache.service.js 提供的長期緩存機制
 *
 * @param path - API 路徑
 * @param options - 請求選項
 * @returns JSON 數據
 *
 * @example
 * ```ts
 * // 自動緩存 10 分鐘
 * const characters = await apiJsonCached('/api/characters', {
 *   cacheTTL: cacheTTL.CHARACTER,
 * });
 *
 * // 使用預定義的緩存鍵
 * const character = await apiJsonCached(`/api/match/${characterId}`, {
 *   cacheKey: cacheKeys.character(characterId),
 *   cacheTTL: cacheTTL.CHARACTER,
 * });
 *
 * // 跳過緩存
 * const freshData = await apiJsonCached('/api/user/profile', {
 *   skipCache: true,
 * });
 * ```
 */
export const apiJsonCached = async <T = any>(path: string, options: ApiCacheOptions = {}): Promise<T> => {
  const {
    cacheKey,
    cacheTTL: customTTL,
    skipCache = false,
    ...apiOptions
  } = options;

  // 如果跳過緩存，直接調用 apiJson
  if (skipCache) {
    return apiJson(path, apiOptions);
  }

  // 僅對 GET 請求使用緩存
  const method = apiOptions.method || 'GET';
  if (method !== 'GET') {
    return apiJson(path, apiOptions);
  }

  // 生成緩存鍵
  const baseUrl = apiOptions.baseUrl || getApiBaseUrl();
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const url = apiOptions.absolute ? path : buildUrl(normalizedBase, path);
  const key = cacheKey || `api:${url}`;

  // 確定 TTL（優先使用自定義 TTL）
  const ttl = customTTL || 5 * 60 * 1000;

  // 使用 apiCache 的 fetch 方法
  return apiCache.fetch(key, () => apiJson<T>(path, apiOptions), ttl);
};

/**
 * 清除 API 緩存
 * 可以清除特定鍵、匹配模式或所有緩存
 *
 * @param pattern - 匹配模式
 *
 * @example
 * ```ts
 * // 清除特定緩存
 * clearApiCache('api:/api/characters');
 *
 * // 清除所有角色相關緩存
 * clearApiCache(/^character:/);
 *
 * // 清除所有緩存
 * clearApiCache();
 * ```
 */
export const clearApiCache = (pattern?: string | RegExp | null): void => {
  // Clear long-term API cache
  apiCache.clear(pattern);

  // ✅ Also clear JSON result deduplication cache
  if (!pattern) {
    // Clear all
    jsonResultCache.clear();
    return;
  }

  // Clear matching keys
  const isRegex = pattern instanceof RegExp;
  const keys = Array.from(jsonResultCache.keys());

  for (const key of keys) {
    const shouldDelete = isRegex
      ? pattern.test(key)
      : key.includes(pattern);

    if (shouldDelete) {
      jsonResultCache.delete(key);
    }
  }
};

/**
 * 獲取 API 緩存統計信息
 * @returns 緩存統計
 */
export const getApiCacheStats = (): ReturnType<typeof apiCache.getStats> => {
  return apiCache.getStats();
};
