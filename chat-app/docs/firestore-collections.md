# Firestore 集合結構說明

本文檔說明所有 Firestore 集合的數據結構，供後台管理系統參考。

## 📁 集合清單

### 1. characters（AI 角色）

**用途**: 存儲所有 AI 聊天角色的配置

**文檔 ID**: `match-001`, `match-002`, ...

**數據結構**:
```javascript
{
  id: string,                    // 角色 ID
  display_name: string,          // 顯示名稱
  gender: string,                // 性別（女性/男性）
  voice: string,                 // 語音 ID（shimmer, nova, coral, etc.）
  locale: string,                // 語言代碼（zh-TW）
  background: string,            // 公開背景故事
  secret_background: string,     // AI 系統提示用的內部背景
  first_message: string,         // 首次對話訊息
  tags: string[],                // 標籤
  plot_hooks: string[],          // 劇情鉤子
  portraitUrl: string,           // 頭像圖片 URL
  totalChatUsers: number,        // 總聊天用戶數
  totalFavorites: number,        // 總收藏數
  status: string,                // 狀態（active/inactive）
  isPublic: boolean,             // 是否公開
  createdAt: Timestamp,          // 創建時間
  updatedAt: Timestamp,          // 更新時間
}
```

**後台操作**: 新增、修改、刪除、啟用/停用

---

### 2. gifts（禮物配置）

**用途**: 存儲所有可送禮物的配置

**文檔 ID**: `rose`, `chocolate`, `diamond`, ...

**數據結構**:
```javascript
{
  id: string,                    // 禮物 ID
  name: string,                  // 禮物名稱
  emoji: string,                 // 表情符號
  description: string,           // 描述
  price: number,                 // 價格（虛擬貨幣）
  rarity: string,                // 稀有度（common, uncommon, rare, epic, legendary）
  thankYouMessage: string,       // 角色收到禮物的回覆訊息
  order: number,                 // 排序順序
  status: string,                // 狀態（active/inactive）
  createdAt: Timestamp,          // 創建時間
  updatedAt: Timestamp,          // 更新時間
}
```

**稀有度級別**:
- `common` - 普通 (10-25元)
- `uncommon` - 罕見 (30-60元)
- `rare` - 稀有 (70-120元)
- `epic` - 史詩 (150-300元)
- `legendary` - 傳說 (400-2000元)

**後台操作**: 新增、修改、刪除、啟用/停用、調整價格、修改回覆訊息

---

### 3. gift_rarities（稀有度配置）

**用途**: 定義禮物稀有度的顯示配置

**文檔 ID**: `common`, `uncommon`, `rare`, `epic`, `legendary`

**數據結構**:
```javascript
{
  id: string,                    // 稀有度 ID
  name: string,                  // 顯示名稱
  color: string,                 // 顏色（十六進制）
  order: number,                 // 排序順序
  createdAt: Timestamp,          // 創建時間
  updatedAt: Timestamp,          // 更新時間
}
```

**後台操作**: 修改名稱、修改顏色

---

### 4. selfie_messages（拍照請求訊息）

**用途**: 存儲用戶點擊拍照按鈕時，AI 角色隨機發送的請求訊息

**文檔 ID**: `msg-1`, `msg-2`, `msg-3`, ...

**數據結構**:
```javascript
{
  id: string,                    // 訊息 ID
  message: string,               // 訊息內容
  order: number,                 // 排序順序
  status: string,                // 狀態（active/inactive）
  createdAt: Timestamp,          // 創建時間
  updatedAt: Timestamp,          // 更新時間
}
```

**訊息範例**:
- "給我看看你現在的樣子"
- "拍張照片給我看看"
- "想看你現在在做什麼"

**後台操作**: 新增、修改、刪除、啟用/停用

---

### 5. membership_tiers（會員等級配置）

**用途**: 存儲所有會員等級的權限和功能配置

**文檔 ID**: `free`, `vip`, `vvip`

**數據結構**:
```javascript
{
  id: string,                    // 等級 ID
  name: string,                  // 等級名稱（免費會員、VIP、VVIP）
  price: number,                 // 價格（TWD，免費為 0）
  currency: string,              // 貨幣（TWD）
  billingCycle: string,          // 計費週期（monthly）
  features: {
    // 對話限制
    messagesPerCharacter: number,        // 每個角色對話次數（-1 為無限）
    unlimitedChats: boolean,             // 是否無限對話
    totalCharacters: number,             // 可對話角色數（-1 為無限）

    // 語音限制
    voicesPerCharacter: number,          // 每個角色語音播放次數（-1 為無限）
    unlimitedVoice: boolean,             // 是否無限語音

    // AI 設定
    aiModel: string,                     // AI 模型（gpt-4o-mini, gpt-4.1-mini）
    maxResponseTokens: number,           // AI 回復長度（tokens）
    maxMemoryTokens: number,             // 對話記憶容量（tokens）

    // 角色相關
    canCreateCharacters: boolean,        // 可否創建角色
    maxCreatedCharacters: number,        // 最多創建角色數（每月）

    // 配對與搜尋
    dailyMatchLimit: number,             // 每日配對次數（-1 為無限）
    advancedSearch: boolean,             // 進階搜尋功能
    matchAdsToUnlock: number,            // 看廣告解鎖配對所需次數
    unlockedMatchesPerAd: number,        // 每次廣告解鎖配對數
    dailyMatchAdLimit: number,           // 每天最多看廣告次數

    // 廣告相關
    requireAds: boolean,                 // 是否需要看廣告
    adsToUnlock: number,                 // 看廣告解鎖對話所需次數
    unlockedMessagesPerAd: number,       // 每次廣告解鎖對話數
    dailyAdLimitPerCharacter: number,    // 每個角色每天最多看廣告次數

    // 解鎖票與卡片（開通時一次性發放）
    characterUnlockCards: number,        // 角色解鎖卡數量（用於解鎖與角色 7 天無限對話）
    characterCreationCards: number,      // 創建角色卡數量
    photoUnlockCards: number,            // 拍照解鎖卡數量（VIP 開通送 20 張, VVIP 開通送 60 張）
    videoUnlockCards: number,            // 影片解鎖卡數量（VIP 開通送 3 張, VVIP 開通送 10 張）

    // AI 特殊功能
    aiPhotoGeneration: boolean,          // AI 拍照功能
    aiVideoGeneration: boolean,          // AI 影片功能
    aiPhotoDiscount: number,             // AI 拍照折扣（0-1）
    aiVideoDiscount: number,             // AI 影片折扣（0-1）

    // 其他
    monthlyCoinsBonus: number,           // 每月贈送金幣
    coinsDiscount: number,               // 金幣購買折扣（0-1）
  },
  status: string,                // 狀態（active/inactive）
  createdAt: Timestamp,          // 創建時間
  updatedAt: Timestamp,          // 更新時間
}
```

**後台操作**: 修改價格、調整功能限制、啟用/停用

---

### 6. ai_feature_prices（AI 功能價格）

**用途**: 存儲 AI 特殊功能的價格配置

**文檔 ID**: `ai_photo`, `ai_video`, `character_unlock_ticket`

**數據結構**:
```javascript
{
  id: string,                    // 功能 ID
  name: string,                  // 功能名稱
  description: string,           // 描述
  basePrice: number,             // 基礎價格（金幣）
  currency: string,              // 貨幣（coins）
  estimatedDuration: number,     // 預計時長（秒，影片專用）
  permanent: boolean,            // 是否永久（解鎖票專用）
  status: string,                // 狀態（active/inactive）
  createdAt: Timestamp,          // 創建時間
  updatedAt: Timestamp,          // 更新時間
}
```

**後台操作**: 調整價格、修改描述、啟用/停用

---

### 7. coin_packages（金幣充值方案）

**用途**: 存儲金幣充值方案配置

**文檔 ID**: `coins_100`, `coins_500`, `coins_1000`, `coins_3000`

**數據結構**:
```javascript
{
  id: string,                    // 方案 ID
  name: string,                  // 方案名稱
  coins: number,                 // 基礎金幣數量
  bonus: number,                 // 贈送金幣數量
  totalCoins: number,            // 總金幣（coins + bonus）
  price: number,                 // 價格（TWD）
  currency: string,              // 貨幣（TWD）
  popular: boolean,              // 是否推薦方案
  bestValue: boolean,            // 是否最超值
  status: string,                // 狀態（active/inactive）
  createdAt: Timestamp,          // 創建時間
  updatedAt: Timestamp,          // 更新時間
}
```

**後台操作**: 調整價格、修改贈送比例、啟用/停用

---

### 8. system_configs（系統配置）

**用途**: 存儲系統級別的配置（如廣告配置）

**文檔 ID**: `ad_config`

**數據結構（ad_config）**:
```javascript
{
  providers: {                   // 廣告提供商
    google: {
      id: string,
      name: string,
      enabled: boolean,
    }
  },
  types: {                       // 廣告類型
    rewardedAd: {
      id: string,
      name: string,
      reward: {
        type: string,            // 獎勵類型（messages）
        amount: number,          // 獎勵數量
      },
      cooldown: number,          // 冷卻時間（秒）
    },
    interstitialAd: { ... }
  },
  dailyAdLimit: number,          // 每日廣告觀看上限
  updatedAt: Timestamp,          // 更新時間
}
```

**後台操作**: 修改廣告配置、調整獎勵、啟用/停用廣告類型

---

### 9. transactions（交易記錄）

**用途**: 記錄所有金幣交易（購買、消費、獎勵、退款等）

**文檔 ID**: 自動生成的唯一 ID

**數據結構**:
```javascript
{
  id: string,                    // 交易 ID
  userId: string,                // 用戶 ID
  type: string,                  // 交易類型（purchase/spend/reward/refund/admin）
  amount: number,                // 金額（正數增加，負數減少）
  description: string,           // 描述
  metadata: Object,              // 額外資訊（功能 ID、角色 ID 等）
  balanceBefore: number,         // 交易前餘額
  balanceAfter: number,          // 交易後餘額
  status: string,                // 狀態（pending/completed/failed/cancelled）
  createdAt: Timestamp,          // 創建時間
  updatedAt: Timestamp,          // 更新時間
}
```

**交易類型**:
- `purchase` - 購買金幣
- `spend` - 消費金幣（購買功能、禮物等）
- `reward` - 獲得獎勵（會員獎勵、活動獎勵等）
- `refund` - 退款
- `admin` - 管理員操作

**後台操作**: 查看交易記錄、交易統計、退款處理

---

### 10. orders（訂單記錄）

**用途**: 記錄所有訂單（會員訂閱、金幣購買、禮物購買等）

**文檔 ID**: 自動生成的唯一 ID

**數據結構**:
```javascript
{
  id: string,                    // 訂單 ID
  orderNumber: string,           // 訂單編號（ORD-YYYYMMDD-XXXXXX）
  userId: string,                // 用戶 ID
  type: string,                  // 訂單類型（membership/coins/gift/feature）
  productId: string,             // 商品 ID
  productName: string,           // 商品名稱
  quantity: number,              // 數量
  amount: number,                // 金額（TWD）
  currency: string,              // 貨幣（TWD/USD）
  status: string,                // 狀態（pending/processing/completed/failed/refunded/cancelled）
  paymentMethod: string,         // 支付方式（credit_card/line_pay/apple_pay/google_pay/coins）
  paymentProvider: string,       // 支付提供商（stripe/line_pay 等）
  paymentIntentId: string,       // 第三方支付 ID
  metadata: Object,              // 額外資訊
  createdAt: Timestamp,          // 創建時間
  updatedAt: Timestamp,          // 更新時間
  completedAt: Timestamp,        // 完成時間
  refundedAt: Timestamp,         // 退款時間
}
```

**訂單類型**:
- `membership` - 會員訂閱（VIP、VVIP）
- `coins` - 金幣購買
- `gift` - 禮物購買
- `feature` - 功能購買（拍照、影片等）

**訂單狀態**:
- `pending` - 待支付
- `processing` - 處理中
- `completed` - 已完成
- `failed` - 失敗
- `refunded` - 已退款
- `cancelled` - 已取消

**後台操作**: 訂單管理、訂單統計、退款處理、訂單搜索

---

### 11. usage_limits（使用限制追蹤）

**用途**: 追蹤用戶的功能使用次數（對話、語音、拍照、影片生成等）

**文檔 ID**: 用戶 ID (userId)

**數據結構**:
```javascript
{
  userId: string,                // 用戶 ID

  // 拍照次數追蹤（全局，不按角色）
  photos: {
    count: number,               // 當前週期已使用次數
    lifetimeCount: number,       // 終生使用次數
    unlocked: number,            // 廣告解鎖的額外次數
    cards: number,               // 購買的拍照卡數量
    permanentUnlock: boolean,    // 是否永久解鎖
    adsWatchedToday: number,     // 今日已觀看廣告次數
    lastResetDate: string,       // 上次重置日期（ISO 8601）
  },

  // 影片生成次數追蹤（全局，不按角色）- 新增功能
  videos: {
    count: number,               // 當前週期已使用次數
    lifetimeCount: number,       // 終生使用次數
    unlocked: number,            // 廣告解鎖的額外次數（暫不支援）
    cards: number,               // 購買的影片生成卡數量
    permanentUnlock: boolean,    // 是否永久解鎖
    adsWatchedToday: number,     // 今日已觀看廣告次數（暫不支援）
    lastResetDate: string,       // 上次重置日期（ISO 8601）
  },

  // 語音次數追蹤（按角色）
  voice: {
    [characterId]: {
      count: number,
      lifetimeCount: number,
      unlocked: number,
      cards: number,
      permanentUnlock: boolean,
      adsWatchedToday: number,
      lastResetDate: string,
    }
  },

  // 對話次數追蹤（按角色）
  conversation: {
    [characterId]: {
      count: number,
      lifetimeCount: number,
      unlocked: number,
      cards: number,
      permanentUnlock: boolean,
      adsWatchedToday: number,
      lastResetDate: string,
    }
  },

  createdAt: Timestamp,          // 創建時間
  updatedAt: Timestamp,          // 更新時間
}
```

**會員等級限制**:

| 功能 | 免費會員 | VIP | VVIP |
|------|---------|-----|------|
| 拍照生成 | 3 次（終生） | 開通送 10 張 | 開通送 50 張 |
| 影片生成 | 0 次 | 開通送 1 張 | 開通送 5 張 |
| 對話（每角色） | 10 次 | 20 次 | 50 次 |
| 語音（每角色） | 10 次 | 無限 | 無限 |

**說明**:
- **拍照/影片卡片**: 開通 VIP/VVIP 時一次性發放，永久有效，用完為止
- **對話/語音**: 根據會員配置，可能有每日或每月重置
- 卡片可透過購買或活動獲得額外數量

**後台操作**: 查看用戶使用統計、手動重置次數、調整限制

---

### 12. character_creation_flows（角色創建流程）

**用途**: 追蹤用戶創建角色的完整流程，支援斷點續傳

**文檔 ID**: 自動生成的唯一 ID（如 `flow-uuid`）

**數據結構**:
```javascript
{
  id: string,                    // 流程 ID
  userId: string,                // 用戶 ID
  status: string,                // 流程狀態（draft/persona/appearance/voice/generating/completed/failed/cancelled）

  // 角色設定
  persona: {
    name: string,                // 角色名稱
    tagline: string,             // 角色標語
    hiddenProfile: string,       // 隱藏設定
    prompt: string,              // AI 提示詞
  },

  // 外觀設定
  appearance: {
    id: string,                  // 外觀 ID
    label: string,               // 外觀標籤
    image: string,               // 圖片 URL
    alt: string,                 // 圖片描述
    description: string,         // 外觀描述文字
    styles: string[],            // 風格標籤
    referenceInfo: Object,       // 參考資訊
  } | null,

  // 語音設定
  voice: {
    id: string,                  // 語音 ID
    label: string,               // 語音標籤
    description: string,         // 語音描述
    gender: string,              // 聲線性別
    ageGroup: string,            // 年齡組
  } | null,

  // 元數據
  metadata: {
    gender: string,              // 角色性別
    aiMagicianUsageCount: number, // AI 魔法師使用次數
    [key: string]: any,          // 其他元數據
  },

  // 費用記錄
  charges: [{
    id: string,                  // 費用記錄 ID
    type: string,                // 費用類型（llm-generation/image-generation）
    amount: number,              // 金額
    currency: string,            // 貨幣（credits/coins）
    status: string,              // 狀態（reserved/captured/void）
    metadata: Object,            // 額外資訊
    idempotencyKey: string,      // 冪等性鍵值
    createdAt: Timestamp,        // 創建時間
    updatedAt: Timestamp,        // 更新時間
  }],

  // 生成狀態
  generation: {
    status: string,              // 生成狀態（idle/generating/completed/failed）
    idempotencyKey: string,      // 冪等性鍵值
    requestId: string,           // 請求 ID
    startedAt: Timestamp,        // 開始時間
    completedAt: Timestamp,      // 完成時間
    result: Object | null,       // 生成結果（圖片 URLs、語音等）
    error: {                     // 錯誤資訊（如果失敗）
      message: string,
    } | null,
  },

  summaryUpdatedAt: Timestamp,   // 摘要更新時間
  createdAt: Timestamp,          // 創建時間
  updatedAt: Timestamp,          // 更新時間
}
```

**流程狀態**:
- `draft` - 草稿（初始狀態）
- `persona` - 角色設定階段
- `appearance` - 外觀設定階段
- `voice` - 語音設定階段
- `generating` - 生成中
- `completed` - 已完成
- `failed` - 失敗
- `cancelled` - 已取消

**特性**:
- ✅ **持久化存儲**: 後端重啟後數據不丟失
- ✅ **斷點續傳**: 用戶可以在任何階段中斷並繼續
- ✅ **冪等性**: 支援重複請求不會重複扣費
- ✅ **狀態追蹤**: 完整記錄創建流程的每個階段
- ✅ **自動清理**: 超過 7 天未更新的草稿自動清理

**後台操作**: 查看用戶創建流程、監控創建成功率、清理過期草稿

---

## 🔄 數據導入

如需重新導入基礎配置數據，執行以下腳本：

```bash
# 導入 AI 角色
cd backend && node import-characters-to-firestore.js

# 導入系統配置（禮物、稀有度、拍照訊息）
cd backend && node import-configs-to-firestore.js

# 導入會員配置（會員等級、AI 功能價格、金幣方案、廣告配置）
cd backend && node import-membership-configs.js

# 導入測試數據（用戶、對話、使用限制）
cd backend && node seed-test-data.js
```

---

## 🛠️ 後台管理功能需求

### 角色管理
- [x] 查看所有角色列表
- [ ] 新增角色
- [ ] 編輯角色資訊
- [ ] 刪除角色
- [ ] 啟用/停用角色
- [ ] 上傳角色頭像

### 禮物管理
- [x] 查看所有禮物列表
- [ ] 新增禮物
- [ ] 編輯禮物資訊
- [ ] 刪除禮物
- [ ] 啟用/停用禮物
- [ ] 調整禮物價格
- [ ] 修改感謝訊息

### 拍照訊息管理
- [x] 查看所有拍照訊息
- [ ] 新增訊息
- [ ] 編輯訊息
- [ ] 刪除訊息
- [ ] 啟用/停用訊息

### 稀有度管理
- [x] 查看稀有度配置
- [ ] 修改稀有度名稱
- [ ] 修改稀有度顏色

### 會員等級管理
- [x] 查看所有會員等級
- [ ] 修改會員價格
- [ ] 調整功能限制
- [ ] 修改贈送項目
- [ ] 啟用/停用等級

### AI 功能價格管理
- [x] 查看所有 AI 功能價格
- [ ] 調整功能價格
- [ ] 修改功能描述
- [ ] 啟用/停用功能

### 金幣方案管理
- [x] 查看所有金幣方案
- [ ] 調整方案價格
- [ ] 修改贈送比例
- [ ] 設置推薦標籤
- [ ] 啟用/停用方案

### 廣告配置管理
- [x] 查看廣告配置
- [ ] 修改廣告獎勵
- [ ] 調整冷卻時間
- [ ] 修改每日上限
- [ ] 啟用/停用廣告類型

---

## 📊 當前數據統計

**配置類集合**:
- **characters**: 3 個角色（艾米麗、雅晴、芷珊）
- **gifts**: 20 個禮物
- **gift_rarities**: 5 個稀有度
- **selfie_messages**: 30 則訊息
- **membership_tiers**: 3 個會員等級（Free, VIP, VVIP）
- **ai_feature_prices**: 3 個 AI 功能
- **coin_packages**: 4 個金幣方案
- **system_configs**: 1 個廣告配置

**業務數據集合**:
- **users**: 根據用戶註冊動態生成
- **conversations**: 根據對話動態生成
- **usage_limits**: 根據用戶使用動態生成
- **transactions**: 根據交易動態生成（所有金幣交易記錄）
- **orders**: 根據訂單動態生成（所有購買訂單記錄）
- **character_creation_flows**: 角色創建流程記錄

---

## 🔗 相關鏈接

- Firestore Emulator UI: http://localhost:4101/firestore
- 原始配置文件:
  - `shared/config/gifts.js` - 禮物配置
  - `frontend/src/config/selfieMessages.js` - 拍照訊息
  - `backend/src/membership/membership.config.js` - 會員配置

---

## 💡 注意事項

1. **會員配置已遷移至 Firestore**：所有會員等級、功能限制、價格配置都已存儲在 Firestore 中，後台可直接修改，無需修改代碼。

2. **配置優先順序**：系統會優先從 Firestore 讀取配置，如果 Firestore 中沒有對應配置，才會使用代碼中的默認值。

3. **測試帳號限制**：測試帳號的限制仍在 `backend/src/config/limits.js` 中配置，未來可考慮也遷移到 Firestore。
