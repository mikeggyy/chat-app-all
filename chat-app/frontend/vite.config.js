import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import net from "node:net";

const normalizeTarget = (value) => {
  if (!value) return "http://localhost:4000";
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const proxyTarget = normalizeTarget(process.env.VITE_API_URL);

const createProxyConfig = (target) => ({
  "/api": {
    target,
    changeOrigin: true,
  },
  "/match/": {
    target,
    changeOrigin: true,
  },
  "/auth": {
    target,
    changeOrigin: true,
  },
});

const canReachTarget = (target) => {
  if (!target) {
    return Promise.resolve(false);
  }
  try {
    const url = new URL(target);
    const port =
      Number.parseInt(url.port, 10) ||
      (url.protocol === "https:" ? 443 : 80);
    const host = url.hostname;

    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      const finalize = (result) => {
        socket.removeAllListeners();
        socket.end();
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(1000);
      socket.once("connect", () => finalize(true));
      socket.once("timeout", () => finalize(false));
      socket.once("error", () => finalize(false));
    });
  } catch {
    return Promise.resolve(false);
  }
};

export default defineConfig(async () => {
  const proxyEnabled = await canReachTarget(proxyTarget);

  if (!proxyEnabled && proxyTarget) {
    console.warn(
      `Warning: 無法連線到 API 服務 ${proxyTarget}，開發環境將停用 Vite 代理設定。`
    );
  }

  return {
    plugins: [vue()],
    server: {
      host: '0.0.0.0', // 允許外部訪問
      port: 5173,
      proxy: proxyEnabled ? createProxyConfig(proxyTarget) : undefined,
    },
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
  };
});
