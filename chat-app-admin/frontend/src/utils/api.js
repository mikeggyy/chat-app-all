import axios from "axios";
import { useAdminStore } from "../stores/admin";
import { ElMessage } from "element-plus";

// 創建 axios 實例
const api = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_API_URL || "/admin-api",
  timeout: 30000,
});

// 請求攔截器
api.interceptors.request.use(
  async (config) => {
    const adminStore = useAdminStore();

    // 添加認證 token
    if (adminStore.token) {
      config.headers.Authorization = `Bearer ${adminStore.token}`;
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
  (error) => {
    const message = error.response?.data?.message || error.message || "請求失敗";

    // 401 未授權 - 登出
    if (error.response?.status === 401) {
      const adminStore = useAdminStore();
      adminStore.logout();
      ElMessage.error("登入已過期，請重新登入");
      return Promise.reject(error);
    }

    // 403 禁止訪問
    if (error.response?.status === 403) {
      ElMessage.error("權限不足，無法執行此操作");
      return Promise.reject(error);
    }

    ElMessage.error(message);
    return Promise.reject(error);
  }
);

export default api;
