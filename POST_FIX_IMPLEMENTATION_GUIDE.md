# 商業邏輯修復後續實施指南 (2025-01-13)

本指南說明如何部署和使用修復後的商業邏輯改進。

---

## 📋 已完成的修復

### 1. ✅ 廣告驗證安全防護
### 2. ✅ 會員升級競態條件修復
### 3. ✅ 禮物系統 Transaction 原子性
### 4. ✅ 購買角色解鎖重複檢查
### 5. ✅ Firestore 安全規則更新
### 6. ✅ 廣告觀看異常監控系統
### 7. ✅ 前端升級進度提示

---

## 🚀 部署步驟

### 步驟 1: 部署 Firestore 安全規則

```bash
cd chat-app

# 部署更新的安全規則
firebase deploy --only firestore:rules

# 驗證規則已生效
firebase firestore:rules:get
```

**新增的安全規則**:
- `ad_watch_stats` - 廣告觀看統計（用戶只讀，後端寫入）
- `gift_transactions` - 禮物交易記錄（用戶只讀）
- `membership_history` - 會員變更歷史（用戶只讀）
- `character_gift_stats` - 角色禮物統計（用戶只讀）
- `ad_watch_events` - 廣告觀看事件（後端專用）
- `ad_anomaly_alerts` - 廣告異常告警（後端專用）

---

### 步驟 2: 部署後端代碼

```bash
cd chat-app/backend

# 安裝依賴（如有新增）
npm install

# 構建（如需要）
npm run build

# 部署到 Cloud Run（或你的部署環境）
./deploy-cloudrun.sh  # Linux/Mac
# 或
deploy-cloudrun.bat   # Windows
```

**關鍵變更**:
- ✅ 廣告驗證邏輯（`conversationLimit.service.js`）
- ✅ 會員升級鎖定機制（`membership.service.js`）
- ✅ 禮物系統單一 Transaction（`gift.service.js`）
- ✅ 購買角色解鎖檢查（`coins.service.js`）
- ✅ 拍照升級鎖定檢查（`photoLimit.service.js`）
- ✅ 廣告異常監控服務（`adWatchMonitor.service.js`）

---

### 步驟 3: 部署前端代碼

```bash
cd chat-app/frontend

# 安裝依賴（如有新增）
npm install

# 構建生產版本
npm run build

# 部署到 Firebase Hosting 或 Cloudflare Pages
firebase deploy --only hosting
# 或
npm run deploy:pages
```

**關鍵變更**:
- ✅ 會員升級進度狀態（`useMembership.js`）
- ✅ 升級進度 UI 組件（`MembershipUpgradeProgress.vue`）

---

### 步驟 4: 整合前端升級進度 UI

在會員升級相關的頁面中添加進度組件：

**範例: 在 App.vue 或主佈局組件中全域添加**

```vue
<template>
  <div id="app">
    <!-- 其他內容 -->
    <router-view />

    <!-- ✅ 全域升級進度提示 -->
    <MembershipUpgradeProgress />
  </div>
</template>

<script setup>
import MembershipUpgradeProgress from './components/MembershipUpgradeProgress.vue';
</script>
```

**範例: 在會員升級按鈕中禁用操作**

```vue
<template>
  <div>
    <button
      @click="handleUpgrade"
      :disabled="isUpgrading"
      class="upgrade-button"
    >
      {{ isUpgrading ? '升級中...' : '升級至 VIP' }}
    </button>

    <!-- 顯示進度訊息 -->
    <p v-if="isUpgrading" class="progress-text">
      {{ upgradeProgress.message }}
    </p>
  </div>
</template>

<script setup>
import { useMembership } from '@/composables/useMembership';

const { upgradeMembership, isUpgrading, upgradeProgress } = useMembership();

const handleUpgrade = async () => {
  try {
    await upgradeMembership(userId.value, 'vip');
    // 升級成功處理
  } catch (error) {
    // 錯誤處理
  }
};
</script>
```

**範例: 在拍照功能中檢查升級狀態**

```vue
<script setup>
import { useMembership } from '@/composables/useMembership';

const { isUpgrading } = useMembership();

const handlePhotoGeneration = async () => {
  if (isUpgrading.value) {
    alert('會員升級處理中，請稍後再試');
    return;
  }

  // 繼續拍照邏輯...
};
</script>
```

---

## 🧪 測試清單

### 1. 廣告驗證測試

```bash
# 使用 curl 或 Postman 測試

# 測試每日次數限制
for i in {1..11}; do
  curl -X POST http://localhost:4000/api/conversations/unlock-by-ad \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d "{\"userId\":\"test\",\"characterId\":\"char1\",\"adId\":\"ad-$(date +%s%3N)-$(openssl rand -hex 4)\"}"
done
# 預期：第 11 次請求應返回錯誤 "今日廣告觀看次數已達上限"

# 測試冷卻時間
curl -X POST .../unlock-by-ad ...
sleep 30
curl -X POST .../unlock-by-ad ...
# 預期：第二次請求應返回錯誤 "請等待 XX 秒後再觀看下一個廣告"

# 測試重放攻擊
adId="ad-1705123456789-a1b2c3d4"
curl -X POST .../unlock-by-ad -d "{\"adId\":\"$adId\"}"
curl -X POST .../unlock-by-ad -d "{\"adId\":\"$adId\"}"
# 預期：第二次請求應返回錯誤 "該廣告獎勵已領取"
```

### 2. 會員升級併發測試

在瀏覽器開發者工具中執行：

```javascript
// 同時發起升級和拍照請求
const [upgradeResult, photoResult] = await Promise.allSettled([
  fetch('/api/membership/USER_ID/upgrade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'vip' })
  }),
  fetch('/api/ai/photo/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId: 'char1' })
  })
]);

console.log('升級結果:', upgradeResult);
console.log('拍照結果:', photoResult);

// 預期：其中一個請求應該失敗，返回 "會員升級處理中" 或 "升級處理中，請稍後再試"
```

### 3. 禮物系統 Transaction 測試

```javascript
// 模擬網路中斷測試（開發環境）
// 在 gift.service.js 的 sendGift 函數中添加：
// if (Math.random() < 0.5) throw new Error('模擬失敗');

// 發送禮物請求
const result = await fetch('/api/gifts/send', {
  method: 'POST',
  body: JSON.stringify({
    userId: 'user1',
    characterId: 'char1',
    giftId: 'rose'
  })
});

// 預期：失敗時金幣餘額不變，禮物記錄未創建，統計未更新
```

### 4. 重複購買檢查測試

```javascript
// 先解鎖角色
await fetch('/api/coins/purchase-unlimited-chat', {
  method: 'POST',
  body: JSON.stringify({ characterId: 'char1' })
});

// 再次嘗試購買同一角色
const result = await fetch('/api/coins/purchase-unlimited-chat', {
  method: 'POST',
  body: JSON.stringify({ characterId: 'char1' })
});

// 預期：第二次請求應返回錯誤 "該角色已永久解鎖，無需重複購買"
```

### 5. 前端升級進度測試

1. 點擊「升級會員」按鈕
2. 觀察進度彈窗是否正常顯示
3. 進度訊息是否按順序更新：
   - "正在驗證會員資格..."
   - "正在處理升級請求，請稍候..."
   - "正在更新會員資料..."
   - "升級成功！"
4. 在升級期間嘗試拍照，應顯示 "會員升級處理中" 錯誤

---

## 📊 監控和告警

### 1. 查看廣告異常告警

```javascript
// 使用管理員 API 查看異常告警
const alerts = await fetch('/api/admin/ad-anomaly-alerts?status=pending');

// 告警包含：
// - 短時間內多次觀看（10 分鐘內超過 5 次）
// - 每日觀看接近上限（8-10 次）
// - 連續多天達到上限（可能為腳本）
// - 平均觀看間隔過短（< 90 秒）
```

### 2. 檢查用戶異常統計

```javascript
// 查看特定用戶的異常統計
const stats = await fetch('/api/admin/users/USER_ID/ad-anomaly-stats');

console.log(stats);
// {
//   userId: "...",
//   totalAlerts: 5,
//   highSeverityAlerts: 2,
//   anomalyTypes: {
//     short_term_burst: 3,
//     low_avg_interval: 2
//   },
//   riskScore: 26,
//   riskLevel: "high"
// }
```

### 3. 設置定時清理任務

在後端設置 Cloud Scheduler 或 cron job：

```javascript
// 每天凌晨 2 點清理過期的廣告觀看事件（保留 7 天）
import { cleanupOldAdEvents } from './services/adWatchMonitor.service.js';

export const scheduledCleanup = async () => {
  const result = await cleanupOldAdEvents(7);
  console.log(`已清理 ${result.deleted} 條過期廣告事件`);
};
```

**Cloud Scheduler 配置**:
```yaml
- name: cleanup-ad-events
  schedule: "0 2 * * *"  # 每天凌晨 2 點
  timezone: Asia/Taipei
  target: /admin/scheduled-tasks/cleanup-ad-events
```

---

## 🔍 疑難排解

### 問題 1: Firestore 規則部署失敗

**錯誤**: `Permission denied` 或 `Invalid rules`

**解決方案**:
```bash
# 驗證規則語法
firebase firestore:rules:validate

# 檢查 Firebase CLI 版本
firebase --version

# 更新 Firebase CLI
npm install -g firebase-tools

# 重新登入
firebase login --reauth
```

### 問題 2: 前端升級進度不顯示

**檢查清單**:
1. ✅ 確認 `MembershipUpgradeProgress.vue` 已導入
2. ✅ 確認組件已添加到主佈局或 App.vue
3. ✅ 檢查 `useMembership` composable 是否正確導入
4. ✅ 打開瀏覽器開發者工具，檢查 `isUpgrading` 和 `upgradeProgress` 狀態

**除錯代碼**:
```vue
<script setup>
import { watch } from 'vue';
import { useMembership } from '@/composables/useMembership';

const { isUpgrading, upgradeProgress } = useMembership();

// 除錯：監聽狀態變化
watch([isUpgrading, upgradeProgress], ([upgrading, progress]) => {
  console.log('[DEBUG] isUpgrading:', upgrading);
  console.log('[DEBUG] upgradeProgress:', progress);
}, { deep: true });
</script>
```

### 問題 3: 廣告觀看記錄未生成

**檢查清單**:
1. ✅ 確認後端已部署最新代碼
2. ✅ 檢查 `adWatchMonitor.service.js` 是否存在
3. ✅ 查看後端日誌是否有錯誤
4. ✅ 驗證 Firestore 集合權限

**驗證命令**:
```bash
# 查看後端日誌
gcloud logging read "resource.type=cloud_run_revision AND textPayload:\"廣告監控\"" \
  --limit 50 --format json

# 手動檢查 Firestore 集合
# 訪問 Firebase Console -> Firestore Database
# 查找 ad_watch_events 和 ad_anomaly_alerts 集合
```

### 問題 4: 升級鎖定未生效

**症狀**: 用戶在升級期間仍可以拍照

**檢查**:
1. 確認 `photoLimit.service.js` 已更新
2. 檢查 `canGeneratePhoto` 函數是否包含鎖定檢查
3. 驗證 `usage_limits.photos.upgrading` 欄位是否正確設置

**手動測試**:
```javascript
// 在瀏覽器控制台執行
const response = await fetch('/api/ai/photo/check-limit?userId=USER_ID');
const data = await response.json();

console.log('拍照限制檢查結果:', data);
// 如果正在升級，應返回錯誤 "會員升級處理中"
```

---

## 📈 性能影響評估

### 預期影響

| 功能 | 影響 | 說明 |
|------|------|------|
| 廣告驗證 | +20ms | 額外的 Firestore 讀取和寫入 |
| 升級鎖定檢查 | +10ms | 額外的 `usage_limits` 讀取 |
| 禮物 Transaction | -5ms | 減少網路往返次數（合併操作） |
| 監控記錄 | +15ms | 異步執行，不阻塞主流程 |

**總體影響**: 預計平均響應時間增加 < 50ms，可接受範圍內。

---

## 🎉 完成檢查清單

部署完成後，請確認以下項目：

### 後端

- [ ] Firestore 安全規則已部署並生效
- [ ] 後端代碼已部署到生產環境
- [ ] 廣告驗證功能正常工作（通過測試）
- [ ] 升級鎖定機制正常工作（通過併發測試）
- [ ] 禮物系統 Transaction 正常（通過失敗測試）
- [ ] 購買重複檢查正常（通過重複購買測試）
- [ ] 監控服務正常記錄事件

### 前端

- [ ] 前端代碼已部署到生產環境
- [ ] 升級進度 UI 組件正常顯示
- [ ] 升級期間拍照功能正確阻止
- [ ] 進度訊息按順序更新
- [ ] 升級完成後狀態正確清除

### 監控

- [ ] 廣告異常告警正常生成
- [ ] 管理員可以查看告警列表
- [ ] 定時清理任務已配置
- [ ] 日誌記錄完整且有意義

---

## 📞 技術支援

如果遇到問題，請：

1. 查看後端日誌：`gcloud logging read ...`
2. 檢查 Firestore 數據結構是否正確
3. 驗證前端狀態是否正常更新
4. 參考本指南的疑難排解部分

**相關文檔**:
- [BUSINESS_LOGIC_FIXES_2025-01-13.md](BUSINESS_LOGIC_FIXES_2025-01-13.md) - 修復詳細報告
- [firestore.rules](chat-app/firestore.rules) - Firestore 安全規則
- [chat-app/backend/src/services/adWatchMonitor.service.js](chat-app/backend/src/services/adWatchMonitor.service.js) - 監控服務

---

**最後更新**: 2025-01-13
**負責人**: 開發團隊
**狀態**: ✅ 已完成，待部署
