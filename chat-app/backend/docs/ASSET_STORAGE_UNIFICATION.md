# 資產存儲結構統一方案

## 📋 背景

專案中的用戶資產（解鎖券、創建卡等）分散在三個不同的存儲位置，導致維護困難和潛在的數據不一致問題。

### 舊的存儲結構

```javascript
// ❌ 分散在三個位置
users/{userId} = {
  // 位置 1: 舊的頂層字段
  characterUnlockCards: 5,
  photoUnlockCards: 10,

  // 位置 2: unlockTickets 對象（過渡位置）
  unlockTickets: {
    characterUnlockCards: 5,
    photoUnlockCards: 10,
    usageHistory: [...]
  },

  // 位置 3: assets 對象（新位置，但未完全統一）
  assets: {
    characterUnlockCards: 5,
    photoUnlockCards: 10
  }
}
```

### 新的統一結構

```javascript
// ✅ 統一到 assets 對象
users/{userId} = {
  assets: {
    characterUnlockCards: 5,
    photoUnlockCards: 10,
    videoUnlockCards: 3,
    voiceUnlockCards: 20,
    createCards: 2
  },

  // ⚠️ unlockTickets 僅用於歷史記錄（審計用）
  unlockTickets: {
    usageHistory: [
      { type: 'use', ticketType: 'character', characterId: '...', timestamp: '...' },
      { type: 'grant', amounts: {...}, timestamp: '...' }
    ]
  }
}
```

---

## 🎯 目標

1. **統一存儲位置**：所有資產統一到 `users/{userId}.assets` 對象
2. **向後兼容讀取**：支持從舊位置讀取（以防遺漏數據）
3. **統一寫入**：所有新寫入操作都寫入 `assets`
4. **保留審計記錄**：`unlockTickets.usageHistory` 保留用於審計
5. **提供遷移工具**：自動遷移所有用戶的資產到新位置

---

## ✅ 已完成的修改

### 1. 更新 `grantTickets` 函數

**文件**: `backend/src/membership/unlockTickets.service.js`

```javascript
// ✅ 統一寫入新位置：assets
transaction.update(userRef, {
  'assets.characterUnlockCards': tickets.characterUnlockCards || 0,
  'assets.photoUnlockCards': tickets.photoUnlockCards || 0,
  'assets.videoUnlockCards': tickets.videoUnlockCards || 0,
  'assets.voiceUnlockCards': tickets.voiceUnlockCards || 0,
  // 保留歷史記錄
  'unlockTickets.usageHistory': tickets.usageHistory,
  updatedAt: FieldValue.serverTimestamp(),
});
```

### 2. 更新 `useCharacterUnlockTicket` 函數

**文件**: `backend/src/membership/unlockTickets.service.js`

**讀取優先級**（向後兼容）：
```javascript
// ✅ 優先級 1：新位置 assets（推薦）
if (user?.assets?.characterUnlockCards > 0) {
  currentCards = user.assets.characterUnlockCards;
}
// ✅ 優先級 2：過渡位置 unlockTickets
else if (user?.unlockTickets?.characterUnlockCards > 0) {
  currentCards = user.unlockTickets.characterUnlockCards;
}
// ✅ 優先級 3：舊位置 root（頂層字段）
else if (user?.characterUnlockCards > 0) {
  currentCards = user.characterUnlockCards;
}
```

**寫入邏輯**（統一新位置）：
```javascript
// ✅ 統一寫入新位置 assets（不論從哪裡讀取）
const updateData = {
  'assets.characterUnlockCards': currentCards - 1,
  'unlockTickets.usageHistory': usageHistory, // 僅記錄歷史
  updatedAt: FieldValue.serverTimestamp(),
};
```

---

## 📦 遷移工具

### 遷移腳本

**文件**: `backend/scripts/migrate-assets-to-unified-structure.js`

**功能**：
- ✅ 分析所有用戶的資產存儲狀態
- ✅ 檢測數據衝突（不同位置的值不一致）
- ✅ 安全遷移資產到統一位置
- ✅ 生成詳細的遷移報告
- ✅ 支持批次處理（避免超時）
- ✅ Dry-run 模式（先分析不執行）

### 使用方法

#### 1. 分析模式（推薦先執行）

```bash
# 分析所有用戶，生成報告，不執行實際遷移
node scripts/migrate-assets-to-unified-structure.js

# 或明確指定
node scripts/migrate-assets-to-unified-structure.js --dry-run
```

**輸出示例**：
```
========================================
資產存儲結構統一遷移工具
========================================

模式: 分析模式（不執行遷移）
批次大小: 100
清理舊數據: 否

⚠️  當前為分析模式，不會執行實際遷移
   使用 --execute 參數執行實際遷移

處理批次: 50 個用戶
  需要遷移: 用戶 user123
    - 有舊位置數據
    - 有過渡位置數據
    - 缺少新位置數據
⚠️  用戶 user456 有 1 個衝突: characterUnlockCards: {"old":5,"new":3}

========================================
遷移報告
========================================

總用戶數: 50
已分析: 50
需要遷移: 12
發現衝突: 2
錯誤數: 0

✅ 分析完成！

發現 12 個用戶需要遷移

執行遷移請運行:
  node scripts/migrate-assets-to-unified-structure.js --execute
```

#### 2. 執行遷移

```bash
# 執行實際遷移（不清理舊數據）
node scripts/migrate-assets-to-unified-structure.js --execute

# 執行遷移並清理舊數據（推薦，完全統一）
node scripts/migrate-assets-to-unified-structure.js --execute --cleanup

# 自定義批次大小
node scripts/migrate-assets-to-unified-structure.js --execute --batch-size=50
```

#### 3. 驗證遷移結果

```bash
# 再次運行分析模式，確認沒有遺漏
node scripts/migrate-assets-to-unified-structure.js --dry-run
```

---

## 🔧 開發注意事項

### 寫入資產時

**✅ 正確做法**：
```javascript
// 統一寫入 assets 對象
await db.collection('users').doc(userId).update({
  'assets.characterUnlockCards': newValue,
  updatedAt: FieldValue.serverTimestamp()
});
```

**❌ 錯誤做法**：
```javascript
// 不要寫入 unlockTickets 或頂層字段
await db.collection('users').doc(userId).update({
  'unlockTickets.characterUnlockCards': newValue  // ❌
});

await db.collection('users').doc(userId).update({
  characterUnlockCards: newValue  // ❌
});
```

### 讀取資產時

**✅ 使用統一的服務函數**：
```javascript
// 使用 unlockTickets.service.js 中的函數
import { getTicketBalance } from './membership/unlockTickets.service.js';

const balance = await getTicketBalance(userId);
// 自動處理向後兼容，按優先級查詢
```

**⚠️ 直接讀取時（不推薦）**：
```javascript
const user = await getUserById(userId);

// 必須按優先級檢查所有位置
const cards =
  user?.assets?.characterUnlockCards ||
  user?.unlockTickets?.characterUnlockCards ||
  user?.characterUnlockCards ||
  0;
```

---

## 🚨 衝突處理策略

當發現不同位置的值不一致時，遷移腳本會：

1. **使用最大值**（保守策略，避免用戶損失）
2. **記錄警告日誌**
3. **在報告中標記**

**示例**：
```
用戶 user123 的 characterUnlockCards 存在衝突：
- assets: 5
- unlockTickets: 3
- root: 7
→ 遷移後使用最大值: 7
```

---

## 📊 遷移檢查清單

### 執行前

- [ ] 備份 Firestore 數據（Firebase Console → Database → 導出）
- [ ] 在測試環境執行遷移並驗證
- [ ] 運行分析模式，查看需要遷移的用戶數
- [ ] 檢查是否有衝突，手動處理特殊情況

### 執行中

- [ ] 使用 `--execute` 執行遷移
- [ ] 監控日誌，確認沒有錯誤
- [ ] 如果遷移用戶數較多（>1000），分批執行

### 執行後

- [ ] 再次運行分析模式，確認 `需要遷移: 0`
- [ ] 抽查幾個用戶，驗證 `assets` 對象是否正確
- [ ] 測試前端功能（購買、使用解鎖券等）
- [ ] 確認無誤後，運行 `--execute --cleanup` 清理舊數據

---

## 🔍 故障排除

### 問題 1：遷移腳本報告衝突

**原因**：同一用戶在不同位置的資產值不一致

**解決方案**：
1. 查看日誌中的衝突詳情
2. 確認哪個值是正確的（通常是最大值）
3. 如果需要手動調整，可以使用 Firebase Console

### 問題 2：遷移後前端仍顯示舊數據

**原因**：前端緩存未清除

**解決方案**：
1. 清除瀏覽器緩存
2. 或在代碼中調用 `deleteCachedUserProfile(userId)`
3. 重新登入

### 問題 3：遷移中斷

**原因**：網絡問題或批次過大

**解決方案**：
1. 減小批次大小：`--batch-size=50`
2. 腳本會從中斷的地方繼續（分批處理）
3. 再次運行遷移命令

---

## 📈 預期影響

### 優點

- ✅ **統一管理**：所有資產在一個位置，易於維護
- ✅ **性能提升**：減少查詢分支判斷
- ✅ **代碼簡化**：移除複雜的向後兼容邏輯
- ✅ **數據一致性**：單一數據源，避免衝突

### 注意事項

- ⚠️ 遷移過程需要數分鐘（取決於用戶數）
- ⚠️ 舊代碼（如管理後台）可能需要更新
- ⚠️ 保留向後兼容讀取邏輯（短期內不移除）

---

## 📝 後續計劃

### 短期（遷移完成後）

1. ✅ 所有用戶資產已遷移到 `assets`
2. ✅ 所有寫入操作已統一到 `assets`
3. ✅ 保留向後兼容讀取邏輯

### 中期（1-2 個月後）

1. 運行清理腳本：`--execute --cleanup`
2. 移除舊位置的向後兼容讀取邏輯
3. 更新管理後台查詢邏輯

### 長期（3-6 個月後）

1. 完全移除 `unlockTickets` 餘額字段（僅保留 `usageHistory`）
2. 移除頂層資產字段
3. 簡化代碼邏輯

---

## 🔗 相關文件

- 遷移腳本：`backend/scripts/migrate-assets-to-unified-structure.js`
- 資產服務：`backend/src/membership/unlockTickets.service.js`
- 配置文件：`shared/config/assets.js`
- 探索報告：本次分析生成的詳細資產結構報告

---

## ❓ 常見問題

### Q: 遷移會影響正在使用的用戶嗎？

A: 不會。遷移過程使用 Firestore Transaction 確保原子性，且讀取邏輯支持向後兼容，用戶不會感知到任何變化。

### Q: 如果遷移失敗會怎樣？

A: Transaction 保證原子性，單個用戶的遷移要麼全部成功，要麼全部失敗（不會出現部分遷移）。失敗的用戶會記錄在錯誤報告中，可以重新運行遷移腳本。

### Q: 可以部分用戶遷移嗎？

A: 可以。遷移腳本支持分批處理，每次遷移一批用戶。未遷移的用戶仍然可以正常使用（向後兼容讀取）。

### Q: 遷移需要停機嗎？

A: 不需要。遷移可以在系統運行時進行，不影響用戶使用。

---

**最後更新**: 2025-01-13
**負責人**: Development Team
**狀態**: ✅ 準備就緒，可以執行遷移
