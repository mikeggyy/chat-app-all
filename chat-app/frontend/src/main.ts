import { createApp, App } from "vue";
import { createPinia } from "pinia";
import AppComponent from "./App.vue";
import router from "./router";
import { ensureAuthState } from "./services/authBootstrap.js";
import { enableHorizontalDragScroll } from "./utils/enableHorizontalDragScroll.js";
import "./style.scss";

// 創建 Pinia 實例
const pinia = createPinia();

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      try {
        await registration.unregister();
      } catch (error) {
        // Service Worker 清理失敗不影響應用運行
      }
    }
  } catch (error) {
    // 獲取 Service Worker 註冊資訊失敗不影響應用運行
  }
}

if (typeof window !== "undefined") {
  enableHorizontalDragScroll();
}

// 🔒 在應用啟動時獲取 CSRF Token
// 這確保了所有寫操作都有可用的 CSRF Token
if (typeof window !== "undefined") {
  try {
    // 使用環境變數或空字串（依賴 Vite 代理）
    const apiUrl = import.meta.env.VITE_API_URL || '';
    await fetch(`${apiUrl}/api/csrf-token`, {
      credentials: 'include', // 允許設置 Cookie
    });
  } catch (error) {
    // CSRF Token 獲取失敗不影響應用啟動
    // Token 也可以在首次 GET 請求時自動設置
    console.warn('初始化 CSRF Token 失敗，將在首次請求時自動設置');
  }
}

const app: App = createApp(AppComponent);

await ensureAuthState();

// 註冊 Pinia 和 Router
app.use(pinia);
app.use(router);
app.mount("#app");
