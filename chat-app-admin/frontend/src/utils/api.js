import axios from "axios";
import { useAdminStore } from "../stores/admin";
import { ElMessage } from "element-plus";

// 創建 axios 實例
const api = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_API_URL || "/admin-api",
  timeout: 30000,
  withCredentials: true, // ✅ 允許攜帶 Cookie（CSRF Token）
});

// CSRF Token 獲取和緩存
let csrfToken = null;

/**
 * 獲取 CSRF Token
 * 從後端 /api/csrf-token 端點獲取 Token 並設置 Cookie
 */
const fetchCsrfToken = async () => {
  try {
    const response = await axios.get(
      `${import.meta.env.VITE_ADMIN_API_URL || "/admin-api"}/api/csrf-token`,
      { withCredentials: true }
    );
    csrfToken = response.data.csrfToken;
    console.log('[CSRF] CSRF Token 已獲取');
    return csrfToken;
  } catch (error) {
    console.error('[CSRF] 獲取 CSRF Token 失敗', error);
    return null;
  }
};

/**
 * 確保有 CSRF Token
 * 如果沒有，則獲取新的
 */
const ensureCsrfToken = async () => {
  if (!csrfToken) {
    await fetchCsrfToken();
  }
  return csrfToken;
};

// 應用啟動時獲取 CSRF Token
fetchCsrfToken();

// 請求攔截器
api.interceptors.request.use(
  async (config) => {
    const adminStore = useAdminStore();

    // 添加認證 token
    if (adminStore.token) {
      config.headers.Authorization = `Bearer ${adminStore.token}`;
    }

    // ✅ 對所有 POST/PUT/DELETE/PATCH 請求添加 CSRF Token
    const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase());
    if (isWriteMethod) {
      const token = await ensureCsrfToken();
      if (token) {
        config.headers['x-csrf-token'] = token;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 響應攔截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const message = error.response?.data?.message || error.message || "請求失敗";
    const errorCode = error.response?.data?.error;

    // ✅ CSRF Token 無效或過期 - 重新獲取 Token 並重試
    if (error.response?.status === 403 &&
        (errorCode === 'CSRF_TOKEN_INVALID' || errorCode === 'CSRF_TOKEN_MISSING')) {
      console.warn('[CSRF] Token 無效，正在重新獲取...');

      // 重新獲取 CSRF Token
      csrfToken = null;
      await fetchCsrfToken();

      // 重試原始請求
      if (csrfToken) {
        const originalRequest = error.config;
        originalRequest.headers['x-csrf-token'] = csrfToken;
        return api.request(originalRequest);
      }
    }

    // 401 未授權 - 登出
    if (error.response?.status === 401) {
      const adminStore = useAdminStore();
      adminStore.logout();
      ElMessage.error("登入已過期，請重新登入");
      return Promise.reject(error);
    }

    // 403 禁止訪問（非 CSRF 錯誤）
    if (error.response?.status === 403) {
      ElMessage.error(message || "權限不足，無法執行此操作");
      return Promise.reject(error);
    }

    ElMessage.error(message);
    return Promise.reject(error);
  }
);

// 導出 API 實例和 CSRF Token 刷新函數
export const refreshCsrfToken = fetchCsrfToken;
export default api;
