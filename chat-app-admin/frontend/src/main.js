import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";

import App from "./App.vue";
import router from "./router";
import { useAdminStore } from "./stores/admin";
import "./assets/main.css";

const app = createApp(App);

// 註冊 Element Plus Icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

// 先初始化 Pinia
const pinia = createPinia();
app.use(pinia);

// 初始化認證狀態監聽（必須在 pinia 之後）
const adminStore = useAdminStore();
adminStore.initializeAuth();

app.use(router);
app.use(ElementPlus, {
  locale: zhCn,
});

app.mount("#app");
