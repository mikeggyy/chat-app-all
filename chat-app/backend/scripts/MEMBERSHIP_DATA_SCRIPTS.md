# 會員數據監控與清理腳本使用指南

本文檔說明如何使用會員數據監控和清理腳本來檢查和修復付費會員數據的不一致問題。

## 📋 目錄

- [背景說明](#背景說明)
- [腳本功能](#腳本功能)
- [使用流程](#使用流程)
- [安全措施](#安全措施)
- [常見問題](#常見問題)

## 背景說明

### 為什麼需要這些腳本？

在會員系統的業務邏輯優化過程中（參考：P3-2 修復），我們發現部分付費會員可能缺少 `membershipExpiresAt` 欄位，導致：

1. **安全漏洞**：付費會員沒有到期時間 = 永久會員
2. **業務邏輯錯誤**：無法正確判斷會員是否過期
3. **數據不一致**：會員等級與實際權益不符

### 檢查項目

| 問題類型 | 嚴重性 | 影響 |
|---------|-------|------|
| 付費會員缺少 `membershipExpiresAt` | HIGH | 可能永久享有付費權益 |
| `membershipExpiresAt` 格式無效 | HIGH | 無法正確判斷到期時間 |
| 已過期但 `membershipStatus` 未更新 | MEDIUM | 可能仍享有付費權益 |
| 狀態為 `cancelled` 但仍在有效期內 | LOW | 正常情況（取消續訂但保留權益） |

## 腳本功能

### 1. monitor-membership-data.js（監控腳本）

**功能**：
- 掃描所有付費會員（VIP 和 VVIP）
- 檢查數據一致性問題
- 生成詳細報告（JSON 格式）

**不會**：
- 修改任何數據
- 需要管理員權限（僅讀取操作）

### 2. cleanup-membership-data.js（清理腳本）

**功能**：
- 根據監控報告修復數據不一致問題
- 備份原始數據到 `membership_data_backup` 集合
- 記錄所有操作到 `audit_logs` 集合

**修復邏輯**：

| 問題 | 修復方案 | 標記 |
|------|---------|------|
| 缺少到期時間 | 設置為 30 天後 | `_needsManualReview: true` |
| 無效日期格式 | 設置為 30 天後，保存原始值 | `_needsManualReview: true` |
| 已過期但狀態未更新 | 降級為 `free`，狀態改為 `expired` | - |
| 狀態為 cancelled 但仍有效 | 不修復（正常情況） | - |

## 使用流程

### 步驟 1: 運行監控腳本

```bash
cd chat-app/backend
node scripts/monitor-membership-data.js
```

**輸出示例**：

```
========================================
🔍 會員數據一致性檢查
========================================

📊 正在查詢付費會員數據...

✅ 找到 25 個付費會員（VIP: 20, VVIP: 5）

========================================
📋 檢查結果總結
========================================

❌ [HIGH] 缺少到期時間: 3 個會員
   - userId: user123, tier: vip, status: active
   - userId: user456, tier: vvip, status: active
   - userId: user789, tier: vip, status: active

✅ [HIGH] 無效的日期格式: 0 個會員

⚠️ [MEDIUM] 已過期但狀態未更新: 2 個會員
   - userId: user111, tier: vip, status: active, expiresAt: 2024-12-01T00:00:00.000Z
   - userId: user222, tier: vip, status: active, expiresAt: 2024-11-15T00:00:00.000Z

✅ [LOW] 等級與狀態不一致: 0 個會員

========================================
⚠️ 總計發現 5 個問題

建議：
1. 執行數據清理腳本修復這些問題
   node scripts/cleanup-membership-data.js --fix
2. 或先模擬修復查看影響
   node scripts/cleanup-membership-data.js --fix-dry-run
========================================

📄 詳細報告已保存至: ./membership-data-report.json
```

### 步驟 2: 查看詳細報告

```bash
cat membership-data-report.json
```

**報告格式**：

```json
{
  "timestamp": "2025-01-13T10:30:00.000Z",
  "totalPaidUsers": 25,
  "totalIssues": 5,
  "issues": {
    "missingExpiresAt": [
      {
        "userId": "user123",
        "tier": "vip",
        "status": "active",
        "issue": "付費會員缺少到期時間",
        "severity": "HIGH"
      }
    ],
    "invalidDateFormat": [],
    "expiredNotUpdated": [
      {
        "userId": "user111",
        "tier": "vip",
        "status": "active",
        "expiresAt": "2024-12-01T00:00:00.000Z",
        "issue": "會員已過期但狀態仍為 \"active\"",
        "severity": "MEDIUM"
      }
    ],
    "inconsistentTier": []
  }
}
```

### 步驟 3: 模擬修復（推薦）

```bash
node scripts/cleanup-membership-data.js --fix-dry-run
```

**輸出示例**：

```
========================================
🔧 會員數據清理
========================================

⚠️ 模擬模式：只顯示操作，不實際修復

📊 讀取監控報告: 2025-01-13T10:30:00.000Z
   總計 5 個問題需要處理

🔧 處理缺少到期時間的會員 (3 個):

處理用戶: user123 (vip)
   [DRY RUN] 將設置 membershipExpiresAt 為: 2025-02-12T10:35:00.000Z

處理用戶: user456 (vvip)
   [DRY RUN] 將設置 membershipExpiresAt 為: 2025-02-12T10:35:00.000Z

處理用戶: user789 (vip)
   [DRY RUN] 將設置 membershipExpiresAt 為: 2025-02-12T10:35:00.000Z

🔧 處理已過期但狀態未更新的會員 (2 個):

處理用戶: user111 (vip, status: active)
   [DRY RUN] 將降級為 free 會員，狀態更新為 expired
   [DRY RUN] 原 tier: vip, 原 status: active

處理用戶: user222 (vip, status: active)
   [DRY RUN] 將降級為 free 會員，狀態更新為 expired
   [DRY RUN] 原 tier: vip, 原 status: active

========================================
📋 清理結果總結
========================================

✅ 模擬完成，將修復 5 個問題

下一步：
   確認無誤後，執行實際修復：
   node scripts/cleanup-membership-data.js --fix
========================================
```

### 步驟 4: 執行實際修復

**⚠️ 重要提醒**：
- 修復前請確認模擬結果
- 所有原始數據會備份到 `membership_data_backup` 集合
- 所有操作會記錄到 `audit_logs` 集合

```bash
node scripts/cleanup-membership-data.js --fix
```

**輸出示例**：

```
========================================
🔧 會員數據清理
========================================

✅ 修復模式：將實際修復數據

⏳ 等待 3 秒後開始...

📊 讀取監控報告: 2025-01-13T10:30:00.000Z
   總計 5 個問題需要處理

🔧 處理缺少到期時間的會員 (3 個):

處理用戶: user123 (vip)
   ✅ 已設置 membershipExpiresAt 為: 2025-02-12T10:35:00.000Z
   ⚠️ 已標記為需要人工審核 (_needsManualReview: true)

（... 其他用戶 ...）

========================================
📋 清理結果總結
========================================

✅ 已修復 5 個問題

⚠️ 需要人工審核的用戶：
   查詢 users 集合中 _needsManualReview: true 的用戶

📁 備份數據位置：
   Firestore collection: membership_data_backup

📄 操作記錄位置：
   Firestore collection: audit_logs
========================================
```

### 步驟 5: 人工審核

修復完成後，需要人工審核以下用戶：

**查詢需要審核的用戶**：

```javascript
// Firestore Console 或使用 Firebase Admin SDK
db.collection('users')
  .where('_needsManualReview', '==', true)
  .get()
```

**審核項目**：

1. **確認會員等級正確**：用戶是否應該是 VIP/VVIP？
2. **確認到期時間合理**：30 天後是否合理？
3. **查看原始數據**：檢查 `membership_data_backup` 集合
4. **查看購買記錄**：檢查 `orders` / `transactions` 集合

**審核完成後**：

```javascript
// 移除審核標記
db.collection('users').doc(userId).update({
  _needsManualReview: false,
  _reviewedBy: 'admin_user_id',
  _reviewedAt: new Date().toISOString(),
});
```

## 安全措施

### 數據備份

所有修復操作前會自動備份原始數據到 `membership_data_backup` 集合：

```javascript
{
  userId: "user123",
  membershipTier: "vip",
  membershipStatus: "active",
  membershipExpiresAt: null,  // 原始值
  backedUpAt: "2025-01-13T10:35:00.000Z",
  backupReason: "cleanup-membership-data-script"
}
```

### 操作記錄

所有修復操作會記錄到 `audit_logs` 集合：

```javascript
{
  timestamp: "2025-01-13T10:35:00.000Z",
  action: "membership-data-cleanup",
  userId: "user123",
  details: {
    action: "fix-missing-expires-at",
    before: {
      membershipExpiresAt: null
    },
    after: {
      membershipExpiresAt: "2025-02-12T10:35:00.000Z",
      membershipStatus: "active",
      _needsManualReview: true,
      _autoFixedAt: "2025-01-13T10:35:00.000Z",
      _autoFixReason: "missing-expires-at"
    }
  },
  performedBy: "system-cleanup-script"
}
```

### 回滾操作

如需回滾修復操作：

```javascript
// 1. 從備份恢復數據
const backupDoc = await db.collection('membership_data_backup').doc(userId).get();
const backupData = backupDoc.data();

// 2. 移除自動添加的欄位
delete backupData.backedUpAt;
delete backupData.backupReason;

// 3. 恢復到原始狀態
await db.collection('users').doc(userId).set(backupData, { merge: true });

// 4. 記錄回滾操作
await db.collection('audit_logs').add({
  timestamp: new Date().toISOString(),
  action: "membership-data-rollback",
  userId,
  performedBy: "admin_user_id"
});
```

## 常見問題

### Q1: 監控腳本顯示 0 個問題，是否正常？

**A**: 是的，這表示所有付費會員數據都是一致的，不需要修復。

### Q2: 清理腳本設置的 30 天到期時間是否合理？

**A**: 30 天是保守的默認值，旨在：
- 給予足夠時間進行人工審核
- 避免立即取消用戶權益
- 標記 `_needsManualReview: true` 要求人工確認

審核後可根據實際情況調整到期時間。

### Q3: 如何防止未來出現類似問題？

**A**: 已在 P3-2 修復中實現以下防護措施：

1. **升級邏輯檢查**：`membership.service.js` 的 `upgradeMembership()` 強制要求付費會員必須有 `membershipExpiresAt`
2. **會員驗證增強**：`checkMembershipActive()` 拒絕缺少到期時間的付費會員
3. **Transaction 保護**：使用 Firestore Transaction 確保原子性操作

### Q4: 監控腳本多久運行一次？

**A**: 建議：
- **開發環境**：每次部署後運行一次
- **生產環境**：每週運行一次（可設置 cron job）
- **重大更新後**：立即運行檢查

### Q5: 如何自動化監控？

**A**: 可以設置 Cloud Scheduler + Cloud Functions：

```javascript
// Cloud Function 示例
exports.scheduledMembershipMonitor = functions.pubsub
  .schedule('0 2 * * 1') // 每週一凌晨 2 點
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    // 運行監控邏輯
    // 如發現問題，發送通知給管理員
  });
```

### Q6: 清理腳本失敗了怎麼辦？

**A**:
1. 檢查錯誤日誌：`backend/src/utils/logger.js` 的輸出
2. 查看 `membership_data_backup` 確認備份是否存在
3. 如部分用戶已修復，重新運行監控腳本生成新報告
4. 重新運行清理腳本（會跳過已修復的用戶）

### Q7: 標記為 `_needsManualReview` 的用戶可以繼續使用服務嗎？

**A**: 可以。`_needsManualReview` 只是內部標記，不影響：
- 會員權益判斷（基於 `membershipTier` 和 `membershipExpiresAt`）
- 用戶使用功能
- 前端顯示

這個標記僅用於提醒管理員進行審核。

## 相關文件

- **業務邏輯修復報告**：`chat-app/backend/scripts/BUSINESS_LOGIC_FIXES.md`
- **會員服務核心邏輯**：`chat-app/backend/src/membership/membership.service.js`
- **P3-2 修復說明**：查看 `membership.service.js` 中的 `checkMembershipActive()` 函數註釋

## 維護建議

### 定期檢查

```bash
# 每週運行（建議設置提醒）
cd chat-app/backend
node scripts/monitor-membership-data.js

# 如發現問題
node scripts/cleanup-membership-data.js --fix-dry-run  # 先模擬
node scripts/cleanup-membership-data.js --fix          # 再執行
```

### 記錄歷史

建議保存每次監控報告：

```bash
# 帶時間戳保存報告
node scripts/monitor-membership-data.js
mv membership-data-report.json "membership-data-report-$(date +%Y%m%d).json"
```

### 通知機制

建議在監控腳本中添加通知功能（發現問題時通知管理員）：

```javascript
// 可整合 Email / Slack / Discord 等
if (totalIssues > 0) {
  await sendAdminNotification({
    subject: '會員數據監控：發現問題',
    body: `發現 ${totalIssues} 個數據不一致問題，請查看報告`,
    reportUrl: 'https://...'
  });
}
```

---

**更新日期**：2025-01-13
**版本**：1.0.0
**維護者**：後端開發團隊
