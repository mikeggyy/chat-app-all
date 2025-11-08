import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { ensureAuthState } from "./services/authBootstrap.js";
import { enableHorizontalDragScroll } from "./utils/enableHorizontalDragScroll.js";
import "./style.scss";

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

const app = createApp(App);

await ensureAuthState();

app.use(router);
app.mount("#app");
