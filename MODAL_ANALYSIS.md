# ChatView.vue 模態框分析

## 📊 模態框清單（共 15 個）

### A. 限制類模態框（6個）
用戶達到使用上限時顯示，提供解決方案（觀看廣告/使用卡片/升級會員）

| 模態框 | 狀態變數 | 數據變數 | 額外狀態 | 用途 |
|--------|----------|----------|----------|------|
| ConversationLimitModal | `showLimitModal` | `limitModalData` | - | 對話次數達上限 |
| VoiceLimitModal | `showVoiceLimitModal` | `voiceLimitModalData` | `pendingVoiceMessage` | 語音播放次數達上限 |
| PhotoLimitModal | `showPhotoLimitModal` | `photoLimitModalData` | - | 照片生成次數達上限 |
| VideoLimitModal | `showVideoLimitModal` | `videoLimitModalData` | - | 影片生成次數達上限 |
| PotionLimitModal | `showPotionLimit` | `potionTypeLimited` | - | 藥水不足 |
| CharacterUnlockLimitModal | `showUnlockLimit` | - | - | 角色解鎖卡不足 |

**數據結構**：
```javascript
// ConversationLimit & VoiceLimit
{
  characterName: string,
  remainingMessages/usedVoices: number,
  dailyAdLimit: number,
  adsWatchedToday: number,
  isUnlocked: boolean, // (僅 ConversationLimit)
  [type]UnlockCards: number
}

// Photo & VideoLimit
{
  used: number,
  remaining: number,
  total: number,
  standardTotal: number | null,
  isTestAccount: boolean,
  cards: number,
  tier: string,
  resetPeriod: string
}
```

### B. 確認類模態框（3個）
需要用戶確認操作，通常伴隨 loading 狀態

| 模態框 | 狀態變數 | 數據變數 | Loading 狀態 | 用途 |
|--------|----------|----------|--------------|------|
| ResetConfirmModal | `showResetConfirm` | - | `isResettingConversation` | 確認重置對話 |
| PotionConfirmModal | `showPotionConfirm` | `potionTypeToUse` | `isUsingPotion` | 確認使用藥水 |
| CharacterUnlockConfirmModal | `showUnlockConfirm` | - | `isUsingUnlockCard` | 確認使用解鎖卡 |

### C. 選擇器類模態框（2個）
讓用戶選擇內容

| 模態框 | 狀態變數 | 數據變數 | 用途 |
|--------|----------|----------|------|
| PhotoSelectorModal | `showPhotoSelector` | `selectedImageUrl`, `shouldUseVideoCard` | 選擇照片生成影片 |
| GiftSelectorModal | - | - | 選擇禮物（由 useChatActions 管理） |

### D. 查看器類模態框（3個）
查看詳細資訊

| 模態框 | 狀態變數 | 數據變數 | Computed | 用途 |
|--------|----------|----------|----------|------|
| ImageViewerModal | `showImageViewer` | `viewerImageUrl`, `viewerImageAlt` | - | 查看大圖 |
| CharacterInfoModal | `showCharacterInfo` | - | - | 查看角色資訊 |
| BuffDetailsModal | `showBuffDetails` | `buffTypeToView` | `currentBuffDetails` | 查看 Buff 詳情 |

### E. 動畫類（1個）

| 模態框 | 狀態變數 | 數據變數 | 用途 |
|--------|----------|----------|------|
| GiftAnimation | `showGiftAnimation` | `giftAnimationData` | 禮物動畫效果 |

---

## 🔄 處理方法統計

### 關閉方法（14個）
- handleCloseLimitModal
- handleCloseVoiceLimitModal
- handleClosePhotoLimitModal
- handleCloseVideoLimitModal
- handleClosePotionConfirm
- handleClosePotionLimit (inline)
- handleCloseBuffDetails
- handleCloseImageViewer
- handleClosePhotoSelector
- handleCloseUnlockConfirm
- handleCloseUnlockLimit
- cancelResetConversation
- closeCharacterInfo
- closeGiftSelector (useChatActions)

### 操作方法（11個）
- handleWatchAd (conversation)
- handleUseUnlockCard (conversation)
- handleWatchVoiceAd
- handleUseVoiceUnlockCard
- handleUsePhotoUnlockCard
- handleUseVideoUnlockCard
- handleUpgradeFromVideoModal
- confirmResetConversation
- handleConfirmUsePotion
- handleConfirmUnlockCharacter
- handleViewBuffDetails

---

## 🎯 設計考量

### 1. 統一性 vs 靈活性
- ✅ 大部分模態框遵循相同模式：show + data + handlers
- ⚠️ 某些模態框有特殊需求（如 VoiceLimit 的 pendingMessage）
- ⚠️ 某些模態框有 computed 屬性（如 BuffDetails）

### 2. 狀態管理挑戰
- Loading 狀態需要獨立管理（isResetting, isUsing...）
- 某些數據需要臨時存儲（pendingVoiceMessage, selectedImageUrl）
- 某些模態框關閉後需要清空數據，某些不需要

### 3. 依賴關係
- 模態框與限制檢查系統交互
- 模態框與資產載入系統交互
- 模態框之間可能有連鎖關係（VideoLimit → PhotoSelector）

---

## 💡 優化方案

### 方案 A：完全統一管理（推薦）
創建 `useModalManager` 統一管理所有模態框：

**優點**：
- ✅ 最大程度減少代碼重複
- ✅ 統一的 API 介面
- ✅ 易於維護

**缺點**：
- ⚠️ 需要設計靈活的數據結構
- ⚠️ 某些特殊邏輯需要特別處理

### 方案 B：分類管理
按類型創建多個 composables：
- `useLimitModals` - 管理所有限制類模態框
- `useConfirmModals` - 管理所有確認類模態框
- `useViewerModals` - 管理所有查看器類模態框

**優點**：
- ✅ 更細粒度的控制
- ✅ 易於理解

**缺點**：
- ⚠️ 仍有較多重複代碼
- ⚠️ 多個 composables 增加複雜度

### 方案 C：混合方案
核心統一管理 + 特殊情況特殊處理：
- 使用 `useModalManager` 管理通用邏輯
- 特殊模態框（如 BuffDetails）保留部分邏輯在 ChatView

**推薦採用方案 A**，因為：
1. 最大程度減少代碼量（目標是減少 200+ 行）
2. 提供統一的模態框操作介面
3. 可以保留必要的靈活性

---

## 🏗️ 實施計劃

### 階段 1：創建核心 composable
```javascript
// composables/chat/useModalManager.js
export function useModalManager() {
  const modals = reactive({
    conversationLimit: { show: false, data: {}, pending: null },
    voiceLimit: { show: false, data: {}, pending: null },
    photoLimit: { show: false, data: {} },
    videoLimit: { show: false, data: {} },
    potionLimit: { show: false, type: '' },
    unlockLimit: { show: false },

    resetConfirm: { show: false, loading: false },
    potionConfirm: { show: false, type: '', loading: false },
    unlockConfirm: { show: false, loading: false },

    photoSelector: { show: false, selectedUrl: null, useCard: false },
    imageViewer: { show: false, url: '', alt: '' },
    characterInfo: { show: false },
    buffDetails: { show: false, type: '' },

    giftAnimation: { show: false, emoji: '🎁', name: '禮物' }
  });

  // 通用方法
  const open = (modalName, data = {}) => { ... };
  const close = (modalName) => { ... };
  const update = (modalName, updates) => { ... };
  const setLoading = (modalName, loading) => { ... };

  return { modals, open, close, update, setLoading };
}
```

### 階段 2：修改 ChatView.vue
- 移除所有獨立的 modal 狀態變數
- 使用 `useModalManager` 替代
- 更新所有 handler 方法使用新 API

### 階段 3：更新 Template
- 更新所有模態框的 props 綁定
- 使用 `modals.xxx.show` 替代 `showXxxModal`

---

## 📈 預期效果

- **減少代碼量**：~200 行
- **提高可維護性**：統一的模態框管理
- **更好的可讀性**：清晰的結構
