import "dotenv/config";
import express from "express";
import cors from "cors";
import { db, auth } from "./firebase/index.js";

// ✅ 導入角色快取服務（複用主應用的實現）
import { initializeCharactersCache } from "../../../chat-app/backend/src/services/character/characterCache.service.js";

// 創建 Express 應用
const app = express();
const PORT = process.env.PORT || 4001;

// 中間件
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
import settingsRoutes from "./routes/settings.routes.js";
import membershipRoutes from "./routes/membership.routes.js";
import productsRoutes from "./routes/products.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import aiSettingsRoutes from "./routes/ai-settings.routes.js";
import voicesRoutes from "./routes/voices.routes.js";

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
app.use("/api/settings", authMiddleware, adminMiddleware, settingsRoutes);
app.use("/api/membership-tiers", authMiddleware, adminMiddleware, membershipRoutes);
app.use("/api/products", authMiddleware, adminMiddleware, productsRoutes);
app.use("/api/categories", authMiddleware, adminMiddleware, categoriesRoutes);
app.use("/api/ai-settings", authMiddleware, adminMiddleware, aiSettingsRoutes);
app.use("/api/voices", authMiddleware, adminMiddleware, voicesRoutes);

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

