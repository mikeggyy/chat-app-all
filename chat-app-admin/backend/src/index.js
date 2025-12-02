import "dotenv/config";
import { validateEnvOrExit } from "./utils/validateEnv.js";

// 🔍 驗證環境變數（應用啟動前）
validateEnvOrExit();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { db, auth } from "./firebase/index.js";
import { setCsrfToken, getCsrfTokenHandler, csrfProtection } from "../../../shared/backend-utils/csrfProtection.js";

// ✅ 導入角色快取服務（複用主應用的實現）
import { initializeCharactersCache } from "../../../chat-app/backend/src/services/character/characterCache.service.js";

// 創建 Express 應用
const app = express();
const PORT = process.env.PORT || 4001;

// 中間件 - CORS 配置
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5174'];

// 生產環境必須設置 CORS_ORIGIN
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  console.error('❌ 生產環境必須設置 CORS_ORIGIN 環境變數');
  process.exit(1);
}

app.use(cors({
  origin: (origin, callback) => {
    // ✅ 2025-12-01 修復：生產環境中拒絕沒有 origin 的請求
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        // 生產環境：拒絕沒有 origin 的請求（更安全）
        return callback(new Error('CORS 錯誤：生產環境不允許無 origin 的請求'));
      }
      // 開發環境：允許 Postman、curl 等工具
      return callback(null, true);
    }

    // 檢查是否在允許列表中
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS 錯誤：來源 ${origin} 不在允許列表中`));
    }
  },
  credentials: true, // 允許攜帶憑證（Cookies）
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'] // 添加 CSRF header
}));

// 🔒 P0 優化（2025-01）：請求大小限制
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 🔒 P0 優化（2025-01）：CSRF 保護
app.use(cookieParser());
app.use(setCsrfToken());

// CSRF Token 獲取端點
app.get('/api/csrf-token', getCsrfTokenHandler);

// 對所有 POST/PUT/DELETE 請求應用 CSRF 保護
app.use((req, res, next) => {
  const isWriteMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);

  if (isWriteMethod) {
    return csrfProtection()(req, res, next);
  }

  next();
});

// 日誌中間件
app.use((req, res, next) => {
  next();
});

// 健康檢查
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "admin-dashboard-backend",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API 路由
import authMiddleware from "./middleware/auth.middleware.js";
import adminMiddleware from "./middleware/admin.middleware.js";

// 路由導入
import dashboardRoutes from "./routes/dashboard.routes.js";
import usersRoutes from "./routes/users.routes.js";
import charactersRoutes from "./routes/characters.routes.js";
import conversationsRoutes from "./routes/conversations.routes.js";
import transactionsRoutes from "./routes/transactions.routes.js";
import membershipRoutes from "./routes/membership.routes.js";
import productsRoutes from "./routes/products.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import aiSettingsRoutes from "./routes/ai-settings.routes.js";
import voicesRoutes from "./routes/voices.routes.js";
import rewardsRoutes from "./routes/rewards.routes.js";
import flashSalesRoutes from "./routes/flashSales.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import bundlesRoutes from "./routes/bundles.routes.js";

// 註冊路由（所有路由都需要管理員權限）
app.use("/api/dashboard", authMiddleware, adminMiddleware, dashboardRoutes);
app.use("/api/users", authMiddleware, adminMiddleware, usersRoutes);
app.use("/api/characters", authMiddleware, adminMiddleware, charactersRoutes);
app.use(
  "/api/conversations",
  authMiddleware,
  adminMiddleware,
  conversationsRoutes
);
app.use(
  "/api/transactions",
  authMiddleware,
  adminMiddleware,
  transactionsRoutes
);
app.use("/api/membership-tiers", authMiddleware, adminMiddleware, membershipRoutes);
app.use("/api/products", authMiddleware, adminMiddleware, productsRoutes);
app.use("/api/categories", authMiddleware, adminMiddleware, categoriesRoutes);
app.use("/api/ai-settings", authMiddleware, adminMiddleware, aiSettingsRoutes);
app.use("/api/voices", authMiddleware, adminMiddleware, voicesRoutes);
app.use("/api/rewards", authMiddleware, adminMiddleware, rewardsRoutes);
app.use("/api/flash-sales", authMiddleware, adminMiddleware, flashSalesRoutes);
app.use("/api/notifications", authMiddleware, adminMiddleware, notificationsRoutes);
app.use("/api/bundles", authMiddleware, adminMiddleware, bundlesRoutes);

// 404 處理
app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.path });
});

// 錯誤處理
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 啟動服務器（異步初始化）
(async () => {
  try {
    // ✅ 初始化角色快取（節省 95% 角色查詢成本）
    console.log("正在初始化角色快取...");
    await initializeCharactersCache();
    console.log("✅ 角色快取初始化完成");

    // 啟動服務器
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════╗
║   Admin Dashboard Backend Server Started      ║
╠═══════════════════════════════════════════════╣
║   Environment: ${(process.env.NODE_ENV || "development").padEnd(31)} ║
║   Port: ${PORT.toString().padEnd(38)} ║
║   CORS: ${(process.env.CORS_ORIGIN || "*").padEnd(38)} ║
║   角色快取: ✅ 已啟用                          ║
║   CSRF 保護: ✅ 已啟用                        ║
╚═══════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("服務器啟動失敗:", error);
    process.exit(1);
  }
})();

// 導出 db 和 auth 供其他模組使用
export { db, auth };
