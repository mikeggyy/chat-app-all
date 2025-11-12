# Legacy 腳本說明文檔

> ⚠️ **警告**: 這些腳本用於舊版數據結構的導入和清理，**當前主應用已不再使用這些數據結構**。
>
> 這些腳本僅在以下情況下可能需要使用：
> - 數據遷移或回滾
> - 歷史數據恢復
> - 參考舊的數據結構

---

## 📋 腳本清單

### 資產系統相關

#### 1. `import-asset-cards.js`
**用途**: 導入資產卡配置到 Firestore `asset_cards` collection
**數據來源**: `shared/config/assets.js` → `ASSET_CARDS_BASE_CONFIG`
**目標集合**: `asset_cards`
**狀態**: 🔴 已廢棄 - 當前使用新的資產系統架構

**使用方式**:
```bash
node scripts/legacy/import-asset-cards.js
```

#### 2. `import-asset-packages.js`
**用途**: 導入資產套餐配置到 Firestore
**目標集合**: `asset_packages`
**狀態**: 🔴 已廢棄 - 當前使用新的資產系統架構

---

### 禮物系統相關

#### 3. `import-gifts.js`
**用途**: 導入禮物配置到 Firestore（統一格式）
**數據來源**: `shared/config/gifts.js` → `GIFTS`
**目標集合**: `gifts`
**狀態**: 🔴 已廢棄 - 當前禮物配置使用新的統一格式

**使用方式**:
```bash
node scripts/legacy/import-gifts.js
```

#### 4. `import-gift-packages.js`
**用途**: 導入禮物套餐配置到 Firestore
**目標集合**: `gift_packages`
**狀態**: 🔴 已廢棄 - 當前使用新的套餐架構

---

### 虛擬貨幣系統相關

#### 5. `import-coin-packages.js`
**用途**: 導入金幣套餐配置到 Firestore（統一格式）
**特點**: 透過贈送金幣實現折扣效果（5 種方案，對應 5 階梯折扣）
**目標集合**: `coin_packages`
**狀態**: 🔴 已廢棄 - 當前使用新的定價架構

**折扣策略**（參考）:
- 第 1 階：無贈送（100% 支付）
- 第 2 階：贈送 5%（相當於 9.5 折）
- 第 3 階：贈送 11%（相當於 9 折）- 熱門
- 第 4 階：贈送 18%（相當於 8.5 折）
- 第 5 階：贈送 25%（相當於 8 折）- 超值

#### 6. `import-potions.js`
**用途**: 導入道具（藥水）配置到 Firestore（多 SKU 架構）
**數據來源**: `shared/config/potions.js` → `POTIONS_BASE_CONFIG`
**目標集合**: `potions`
**狀態**: 🟡 部分使用 - 藥水系統仍在使用，但導入方式可能已更新

**使用方式**:
```bash
node scripts/legacy/import-potions.js
```

---

### 解鎖系統相關

#### 7. `import-unlock-cards.js`
**用途**: 導入解鎖卡配置到 Firestore
**目標集合**: `unlock_cards`
**狀態**: 🔴 已廢棄 - 當前使用新的解鎖券（unlock_tickets）系統

---

### 分類系統相關

#### 8. `import-categories.js`
**用途**: 導入分類配置到 Firestore
**目標集合**: `categories`
**狀態**: 🔴 已廢棄 - 當前分類系統使用不同的架構

---

### 清理工具

#### 9. `clean-all-products.js`
**用途**: 清理所有商品集合的數據（僅刪除，不導入）
**操作**: 批量刪除指定集合中的所有文檔
**狀態**: 🟡 工具腳本 - 需要清理舊數據時可能會用到

**⚠️ 危險操作**: 此腳本會刪除數據，使用前請確認：
- 已備份重要數據
- 確認要刪除的集合
- 使用 Firebase Emulator 測試（不要直接在生產環境執行）

**使用方式**:
```bash
# 強烈建議在 Emulator 模式下使用
USE_FIREBASE_EMULATOR=true node scripts/legacy/clean-all-products.js
```

#### 10. `cleanupCardSubcollections.js`
**用途**: 清理卡片子集合的數據
**狀態**: 🔴 已廢棄 - 舊的子集合架構已不再使用

---

## 🗓️ 維護計劃

### 當前狀態（2025-01-13）

- ✅ **已記錄**: 所有腳本用途已記錄
- 🔍 **監控期**: 保留 3-6 個月，觀察是否有使用需求
- 📋 **決策時間**: 2025-07-13 前後重新評估

### 何時可以安全刪除

滿足以下**所有條件**時可以考慮刪除：

1. ✅ **時間條件**: 距離最後一次使用已超過 6 個月
2. ✅ **數據遷移完成**: 所有舊數據已成功遷移到新架構
3. ✅ **無回滾需求**: 確認不需要回滾到舊的數據結構
4. ✅ **團隊共識**: 所有開發者同意可以刪除

### 刪除前檢查清單

- [ ] 確認生產環境中不存在舊數據結構的集合
- [ ] 確認沒有任何代碼引用這些腳本
- [ ] 已將腳本內容備份到文檔或 Git 歷史
- [ ] 團隊成員已知悉刪除計劃

---

## 📚 參考信息

### 新的數據導入方式

當前主應用使用以下腳本進行數據導入（位於 `scripts/` 目錄）：

- ✅ **`import-all-data.js`** - 導入所有核心數據（角色、配置、會員方案等）
- ✅ **`import-characters-to-firestore.js`** - 導入 AI 角色
- ✅ **`import-configs-to-firestore.js`** - 導入系統配置
- ✅ **`import-membership-configs.js`** - 導入會員配置
- ✅ **`seed-test-data.js`** - 導入測試數據

### 新的數據結構

當前主應用使用的集合（詳見 [docs/firestore-collections.md](../../docs/firestore-collections.md)）：

- `characters` - AI 角色
- `membership_tiers` - 會員等級
- `gift_rarities` - 禮物稀有度
- `unlock_tickets` - 解鎖券（替代舊的 unlock_cards）
- `potions` - 藥水（可能使用新的導入方式）

---

## 🔗 相關文檔

- **主應用架構**: [chat-app/CLAUDE.md](../../CLAUDE.md)
- **Firestore 集合**: [chat-app/docs/firestore-collections.md](../../docs/firestore-collections.md)
- **數據導入指南**: [chat-app/backend/scripts/README.md](../README.md)
- **資產系統架構**: [chat-app/docs/ASSET_SYSTEM_ARCHITECTURE.md](../../docs/ASSET_SYSTEM_ARCHITECTURE.md)

---

## 📝 版本歷史

- **2025-01-13**: 創建此文檔，記錄所有 legacy 腳本用途和維護計劃
- **未來**: 定期更新狀態和刪除決策

---

## ❓ 常見問題

### Q: 為什麼這些腳本還保留在代碼庫中？

A: 這些腳本可能在以下場景中需要：
- 數據遷移或回滾
- 參考舊的數據結構
- 歷史數據恢復

### Q: 我可以刪除這些腳本嗎？

A: 請參考「維護計劃」章節的「何時可以安全刪除」部分。建議至少保留到 2025-07 月後再評估。

### Q: 如果我需要使用這些腳本怎麼辦？

A:
1. 確認你真的需要使用舊的數據結構
2. **強烈建議在 Firebase Emulator 環境中測試**
3. 備份生產數據後再執行
4. 諮詢團隊其他成員

### Q: 新的數據導入應該使用哪些腳本？

A: 使用 `scripts/` 目錄下的腳本（參考「新的數據導入方式」章節）。

---

**最後更新**: 2025-01-13
**維護者**: Claude Code
**下次評估時間**: 2025-07-13
