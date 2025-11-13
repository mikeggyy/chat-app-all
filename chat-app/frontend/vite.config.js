import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import net from "node:net";
import { fileURLToPath, URL } from 'node:url';

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
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      host: '0.0.0.0', // 允許外部訪問
      port: 5173,
      proxy: proxyEnabled ? createProxyConfig(proxyTarget) : undefined,
    },
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
    build: {
      // 啟用壓縮
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      // 優化 chunk 拆分策略
      rollupOptions: {
        output: {
          manualChunks: {
            // 將 Vue 核心拆分為單獨的 chunk
            'vue-vendor': ['vue', 'vue-router'],
            // 將 Firebase SDK 拆分為單獨的 chunk
            'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            // 將圖標庫拆分為單獨的 chunk
            'icons-vendor': ['@heroicons/vue'],
          },
        },
      },
      // 調整 chunk 大小警告閾值
      chunkSizeWarningLimit: 1000, // 1MB
    },
    // Vitest 測試配置
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/tests/setup.js'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/tests/',
        ],
      },
      include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    },
  };
});
