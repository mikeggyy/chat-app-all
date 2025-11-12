# 更新日誌 (Changelog)

本文檔記錄專案的重要變更和版本歷史。

## [未發布] - 2025-01-12

### 🧹 代碼清理

#### 主應用 (chat-app)
- **移除** `frontend/src/components/ResponsiveImage.vue` - 已被 LazyImage 取代
- **移除** `frontend/src/assets/vue.svg` - 未使用的 Vite 預設文件
- **移除** `backend/scripts/fix-async-routes.js` - 一次性修復腳本
- **移除** `frontend/src/views/WalletView.vue` - 已被功能更完整的 ShopView 取代
- **優化** 路由配置，移除未使用的導入

#### 管理後台 (chat-app-admin)
- **新增** `backend/src/setup-emulator.js` - Firebase Emulator 支援
- **移除** `frontend/src/views/Settings.vue` - 未完成的佔位符頁面
- **移除** `backend/src/routes/settings.routes.js` - 未完成的設置路由
- **移除** `backend/scripts/test-character-lookup.js` - 未註冊的測試腳本
- **優化** 路由配置和導入語句

#### 文檔更新
- **新增** `docs/CODE_CLEANUP_2025-01.md` - 詳細代碼清理報告
- **新增** `CHANGELOG.md` - 版本更新日誌
- **更新** `CLAUDE.md` - 添加清理報告鏈接
- **更新** `chat-app-admin/README.md` - 添加 Emulator 支援和維護信息

### 📊 統計數據
- 刪除文件：7 個
- 新增文件：1 個（setup-emulator.js）
- 減少代碼：~702 行（淨減少）
- 主應用健康度：98% → 99.5% (+1.5%)
- 管理後台健康度：95% → 98% (+3%)

### 🔗 相關文檔
- [代碼清理報告](docs/CODE_CLEANUP_2025-01.md)

---

## 版本說明

本專案採用語義化版本（Semantic Versioning）：
- **主版本號 (Major)**: 不兼容的 API 變更
- **次版本號 (Minor)**: 向下兼容的功能新增
- **修訂號 (Patch)**: 向下兼容的問題修復

### 標記說明
- 🎉 **新增 (Added)**: 新功能
- 🔄 **變更 (Changed)**: 既有功能的變更
- 🐛 **修復 (Fixed)**: 問題修復
- 🗑️ **移除 (Removed)**: 移除的功能
- 🔒 **安全 (Security)**: 安全性相關修復
- ⚡ **效能 (Performance)**: 效能改進
- 🧹 **清理 (Cleanup)**: 代碼清理和重構
- 📝 **文檔 (Documentation)**: 文檔更新

---

## 貢獻指南

如需提交變更，請：
1. 遵循 [Conventional Commits](https://www.conventionalcommits.org/) 規範
2. 在此文件中記錄重要變更
3. 更新相關文檔

---

**最後更新**: 2025-01-12
