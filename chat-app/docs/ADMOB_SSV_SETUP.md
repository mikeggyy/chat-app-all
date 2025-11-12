# AdMob Server-Side Verification (SSV) 設置指南

## 概述

AdMob Server-Side Verification（伺服器端驗證）是一種防止廣告獎勵欺詐的機制。透過驗證 Google AdMob 提供的 JWT token，確保獎勵請求來自真實的廣告觀看事件。

## 為什麼需要嚴格驗證？

**寬鬆模式（開發環境）**：
- ❌ 前端直接調用領取獎勵 API
- ❌ 容易被中間人攻擊或重放攻擊
- ❌ 無法驗證廣告是否真的被觀看

**嚴格模式（生產環境）**：
- ✅ Google AdMob 簽發 JWT token
- ✅ 後端驗證 token 簽名和有效性
- ✅ 防止欺詐和獎勵濫用
- ✅ 符合 AdMob 最佳實踐

## 架構流程

### 1. 寬鬆模式（開發環境）

```
用戶點擊「觀看廣告」
    ↓
前端：POST /api/ads/watch (characterId, adType)
    ↓
後端：創建 ad 記錄，狀態 = pending
    ↓
前端：顯示廣告（或跳過）
    ↓
前端：POST /api/ads/verify (adId) ← ⚠️ 無 token 驗證
    ↓
後端：直接標記為 verified
    ↓
前端：POST /api/ads/claim (adId)
    ↓
後端：發放獎勵（解鎖次數+5）
```

### 2. 嚴格模式（生產環境）

```
用戶點擊「觀看廣告」
    ↓
前端：POST /api/ads/watch (characterId, adType)
    ↓
後端：創建 ad 記錄，狀態 = pending
    ↓
前端：AdMob SDK 顯示廣告
    ↓
用戶觀看完成
    ↓
AdMob SDK 回調：提供 verificationToken (JWT)
    ↓
前端：POST /api/ads/verify (adId, verificationToken) ← ✅ 攜帶 JWT
    ↓
後端：verifyWithAdMobSSV()
    ├─ 獲取 Google 公鑰
    ├─ 驗證 JWT 簽名
    ├─ 檢查過期時間
    ├─ 驗證 payload 欄位
    └─ ✅ 驗證通過 or ❌ 驗證失敗
    ↓
後端：標記為 verified（成功）or rejected（失敗）
    ↓
前端：POST /api/ads/claim (adId)
    ↓
後端：發放獎勵（僅限 verified 狀態）
```

## 配置步驟

### 步驟 1: 安裝依賴

```bash
cd chat-app/backend
npm install jsonwebtoken
```

### 步驟 2: 配置環境變數

編輯 `backend/.env`：

```env
# 開發環境（寬鬆模式）
ENABLE_STRICT_AD_VERIFICATION=false

# 生產環境（嚴格模式）
ENABLE_STRICT_AD_VERIFICATION=true
```

### 步驟 3: 配置 Google AdMob Console

1. 登入 [Google AdMob Console](https://apps.admob.com/)
2. 選擇您的應用
3. 進入「廣告單元」設置
4. 找到「Server-Side Verification」設置
5. 配置回調 URL（可選，如需 webhook 通知）：
   ```
   https://your-backend-domain.com/api/ads/admob-callback
   ```
6. 記錄 `公鑰 URL`（AdMob 會自動管理）：
   ```
   https://www.gstatic.com/admob/reward/verifier-keys.json
   ```

### 步驟 4: 整合前端 AdMob SDK

#### 4.1 安裝 AdMob SDK（假設使用 Capacitor）

```bash
npm install @capacitor-community/admob
npx cap sync
```

#### 4.2 修改前端代碼

編輯 `frontend/src/composables/useConversationLimit.js`（或其他使用廣告解鎖的地方）：

```javascript
import { AdMob, RewardAdOptions, AdMobRewardItem } from '@capacitor-community/admob';

const unlockByAd = async (userId, characterId, adId, options = {}) => {
  try {
    // 步驟 1: 請求觀看廣告
    const watchResult = await apiJson('/api/ads/watch', {
      method: 'POST',
      body: { characterId, adType: 'rewarded_ad' },
    });

    const currentAdId = watchResult.adId;

    // 步驟 2: 顯示 AdMob 廣告
    const adOptions: RewardAdOptions = {
      adId: 'ca-app-pub-3940256099942544/5224354917', // 替換為您的 AdMob 廣告單元 ID
      // 生產環境使用真實 ID，測試環境使用測試 ID
    };

    await AdMob.prepareRewardVideoAd(adOptions);
    const rewardItem: AdMobRewardItem = await AdMob.showRewardVideoAd();

    // ⚠️ 關鍵：獲取 verificationToken
    // 注意：實際的 API 可能因 SDK 版本而異，請參考 AdMob SDK 文檔
    const verificationToken = rewardItem.serverSideVerificationOptions?.customData || null;

    // 步驟 3: 驗證廣告（攜帶 verificationToken）
    await apiJson('/api/ads/verify', {
      method: 'POST',
      body: {
        adId: currentAdId,
        verificationToken, // ← ✅ JWT token
      },
    });

    // 步驟 4: 領取獎勵
    const claimResult = await apiJson('/api/ads/claim', {
      method: 'POST',
      body: { adId: currentAdId },
    });

    // 步驟 5: 刷新限制狀態
    await checkLimit(userId, characterId);

    return {
      success: true,
      adId: currentAdId,
      reward: claimResult.reward,
    };

  } catch (error) {
    console.error('廣告解鎖失敗:', error);
    throw error;
  }
};
```

## JWT Payload 結構

AdMob SSV 提供的 JWT token payload 範例：

```json
{
  "ad_network": "Google AdMob",
  "ad_unit": "ca-app-pub-3940256099942544/5224354917",
  "reward_amount": 5,
  "reward_item": "解鎖次數",
  "timestamp": 1704067200000,
  "transaction_id": "12345678-1234-1234-1234-123456789abc",
  "user_id": "user123",
  "signature": "...",
  "key_id": 123456,
  "exp": 1704070800,
  "iat": 1704067200
}
```

## 後端驗證邏輯

位於 `backend/src/ad/ad.service.js` 的 `verifyWithAdMobSSV` 函數：

```javascript
const verifyWithAdMobSSV = async (verificationToken, queryParams = {}) => {
  const ENABLE_STRICT_AD_VERIFICATION = process.env.ENABLE_STRICT_AD_VERIFICATION === "true";

  // 寬鬆模式：直接通過
  if (!ENABLE_STRICT_AD_VERIFICATION) {
    logger.debug("[廣告服務] 寬鬆驗證模式，接受驗證");
    return true;
  }

  // 嚴格模式：JWT 驗證
  if (!verificationToken) {
    logger.warn("[廣告服務] 嚴格驗證模式：缺少 verificationToken");
    return false;
  }

  try {
    const jwt = await import("jsonwebtoken");
    const GOOGLE_PUBLIC_KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";

    // 1. 獲取 Google 公鑰
    const keysResponse = await fetch(GOOGLE_PUBLIC_KEYS_URL);
    const keys = await keysResponse.json();

    // 2. 解析 JWT header 獲取 key_id
    const decoded = jwt.decode(verificationToken, { complete: true });
    const keyId = decoded.header.kid;
    const publicKey = keys.keys.find(k => k.keyId === keyId);

    if (!publicKey) {
      logger.warn(`[廣告服務] 找不到對應的公鑰 (key_id: ${keyId})`);
      return false;
    }

    // 3. 驗證 JWT 簽名
    const verified = jwt.verify(verificationToken, publicKey.pem, {
      algorithms: ['ES256'],
    });

    // 4. 驗證 payload
    const now = Math.floor(Date.now() / 1000);

    // 檢查過期時間
    if (verified.exp && verified.exp < now) {
      logger.warn("[廣告服務] SSV token 已過期");
      return false;
    }

    // 檢查發行時間（防止未來時間戳）
    if (verified.iat && verified.iat > now + 300) {
      logger.warn("[廣告服務] SSV token 發行時間異常");
      return false;
    }

    // 檢查必要欄位
    if (!verified.ad_network || !verified.ad_unit) {
      logger.warn("[廣告服務] SSV token 缺少必要欄位");
      return false;
    }

    // 驗證獎勵金額（如果提供）
    if (queryParams.reward_amount && verified.reward_amount) {
      if (parseInt(queryParams.reward_amount) !== verified.reward_amount) {
        logger.warn("[廣告服務] 獎勵金額不匹配");
        return false;
      }
    }

    // 驗證用戶 ID（如果提供）
    if (queryParams.user_id && verified.user_id) {
      if (queryParams.user_id !== verified.user_id) {
        logger.warn("[廣告服務] 用戶 ID 不匹配");
        return false;
      }
    }

    logger.info("[廣告服務] AdMob SSV 驗證成功", {
      adUnit: verified.ad_unit,
      rewardAmount: verified.reward_amount,
      userId: verified.user_id,
    });

    return true;

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.error(`[廣告服務] JWT 驗證失敗: ${error.message}`);
    } else if (error.name === 'TokenExpiredError') {
      logger.error("[廣告服務] JWT token 已過期");
    } else {
      logger.error(`[廣告服務] AdMob 驗證異常: ${error.message}`);
    }
    return false;
  }
};
```

## 測試流程

### 開發環境測試（寬鬆模式）

1. 設置 `ENABLE_STRICT_AD_VERIFICATION=false`
2. 重啟後端服務
3. 前端調用廣告解鎖流程（無需真實 AdMob SDK）
4. 驗證步驟會自動通過

### 生產環境測試（嚴格模式）

1. 設置 `ENABLE_STRICT_AD_VERIFICATION=true`
2. 整合 AdMob SDK 並配置測試廣告單元
3. 使用測試設備進行廣告展示
4. 獲取 verificationToken 並傳遞給後端
5. 檢查後端日誌確認驗證成功

### 常見錯誤排查

**錯誤 1: 找不到對應的公鑰**
```
[廣告服務] 找不到對應的公鑰 (key_id: 123456)
```
- **原因**: JWT header 中的 `kid` 與 Google 公鑰不匹配
- **解決**: 確認 verificationToken 來自 Google AdMob，而非自行生成

**錯誤 2: JWT token 已過期**
```
[廣告服務] SSV token 已過期
```
- **原因**: token 的 `exp` 時間戳早於當前時間
- **解決**: 確保前端及時發送驗證請求（廣告觀看後 5 分鐘內）

**錯誤 3: JWT 驗證失敗**
```
[廣告服務] JWT 驗證失敗: invalid signature
```
- **原因**: token 簽名無效或被篡改
- **解決**: 檢查 token 傳輸過程是否完整，避免 URL 編碼問題

**錯誤 4: 獎勵金額不匹配**
```
[廣告服務] 獎勵金額不匹配
```
- **原因**: 前端傳遞的 `reward_amount` 與 JWT 中的值不一致
- **解決**: 確保前端傳遞正確的獎勵金額，或移除此參數

## 安全建議

1. **生產環境必須啟用嚴格模式**
   ```env
   ENABLE_STRICT_AD_VERIFICATION=true
   ```

2. **保護 verificationToken**
   - 使用 HTTPS 傳輸
   - 避免在 URL 參數中傳遞（使用 POST body）
   - 前端不要記錄或存儲 token

3. **實施速率限制**
   - 限制每個用戶每日觀看廣告次數（已實現：10 次/日）
   - 防止短時間內大量請求

4. **監控異常行為**
   - 記錄驗證失敗事件
   - 追蹤異常用戶行為（如頻繁驗證失敗）
   - 設置告警機制

5. **定期更新依賴**
   ```bash
   npm update jsonwebtoken
   ```

## 相關文件

- **後端實現**: [backend/src/ad/ad.service.js](../backend/src/ad/ad.service.js)
- **前端 composable**: [frontend/src/composables/useConversationLimit.js](../frontend/src/composables/useConversationLimit.js)
- **限制服務**: [backend/src/services/limitService/limitTracking.js](../backend/src/services/limitService/limitTracking.js)
- **環境配置**: [backend/.env](../backend/.env)

## 參考資源

- [Google AdMob SSV 官方文檔](https://developers.google.com/admob/ios/rewarded-video-ssv)
- [JWT 規範](https://jwt.io/)
- [jsonwebtoken npm 套件](https://www.npmjs.com/package/jsonwebtoken)
- [AdMob 公鑰 URL](https://www.gstatic.com/admob/reward/verifier-keys.json)

## 更新日誌

- **2025-01-13**: 初始版本，實現完整的 AdMob SSV 驗證邏輯
- **功能**: JWT 簽名驗證、過期檢查、payload 驗證、錯誤處理
- **狀態**: ✅ 已完成，待前端整合 AdMob SDK
