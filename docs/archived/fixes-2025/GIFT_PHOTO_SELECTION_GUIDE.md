# 送禮物照片選擇功能 - 整合指南

## 已完成的修改 ✅

### 1. 後端修改
- ✅ **[gift.service.js](chat-app/backend/src/gift/giftResponse.service.js)**：`processGiftResponse` 已支援 `options.selectedPhotoUrl`
- ✅ **[gift.routes.js](chat-app/backend/src/gift/gift.routes.js)**：`/api/gifts/response` 已接受 `selectedPhotoUrl` 參數

### 2. 前端修改
- ✅ **[useChatActions.ts](chat-app/frontend/src/composables/chat/useChatActions.ts)**：`sendGift` 函數已支援 `selectedPhotoUrl` 參數

## 待完成的整合步驟 📝

### 修改送禮物流程

你需要修改 **送禮物的流程**，讓用戶在選擇禮物後，**先選擇照片**，然後再發送禮物。

#### 現有流程：
1. 用戶點擊「送禮物」按鈕 → `handleOpenGiftSelector()`
2. 用戶選擇禮物 → `handleSelectGift(giftData)`
3. 直接調用 `sendGift(giftData)` → 發送禮物並**自動生成新照片**

#### 新流程（需要實現）：
1. 用戶點擊「送禮物」按鈕 → `handleOpenGiftSelector()`
2. 用戶選擇禮物 → `handleSelectGift(giftData)`
3. **✨ 新增：打開照片選擇器** → `modals.photoSelector.show = true`
4. 用戶選擇照片 → `handlePhotoSelect(imageUrl)`
5. 調用 `sendGift(giftData, onSuccess, imageUrl)` → 發送禮物並**使用選擇的照片**

### 具體實現方法

找到 `useChatSetup` 或相關的 composable 中的 `handleSelectGift` 函數，修改如下：

#### 原來的代碼（推測）：
```typescript
const handleSelectGift = async (giftData: GiftData) => {
  // 顯示禮物動畫
  showGiftAnimation(gift.emoji, gift.name);

  // 直接發送禮物
  await sendGift(giftData, () => {
    // 成功回調
  });

  // 重新載入餘額
  await loadBalance(userId);
};
```

#### 修改後的代碼：
```typescript
// 新增狀態：儲存待發送的禮物
const pendingGift = ref<GiftData | null>(null);

const handleSelectGift = async (giftData: GiftData) => {
  // 儲存待發送的禮物
  pendingGift.value = giftData;

  // 關閉禮物選擇器
  closeGiftSelector();

  // 打開照片選擇器
  modals.photoSelector.show = true;
};

const handlePhotoSelect = async (imageUrl: string) => {
  if (!pendingGift.value) return;

  const gift = getGiftById(pendingGift.value.giftId);
  if (!gift) return;

  // 關閉照片選擇器
  closePhotoSelector();

  // 顯示禮物動畫
  showGiftAnimation(gift.emoji, gift.name);

  // 發送禮物（帶選擇的照片 URL）
  await sendGift(pendingGift.value, () => {
    // 成功回調
  }, imageUrl); // ✅ 傳遞選擇的照片 URL

  // 重新載入餘額
  await loadBalance(userId.value);

  // 清空待發送的禮物
  pendingGift.value = null;
};
```

### 修改 ChatModals 的 PhotoSelectorModal 標題

在 **[PhotoSelectorModal.vue](chat-app/frontend/src/components/chat/PhotoSelectorModal.vue)** 中，將標題改為更通用的：

```vue
<!-- 原標題 -->
<h2 class="header-title">選擇照片生成影片</h2>

<!-- 修改為 -->
<h2 class="header-title">{{ title || '選擇照片' }}</h2>
```

並在 props 中添加 `title` 參數：
```typescript
interface Props {
  isOpen: boolean;
  characterId: string;
  characterPhotoUrl?: string;
  title?: string; // 新增
}

const props = withDefaults(defineProps<Props>(), {
  characterPhotoUrl: "",
  title: "選擇照片", // 默認標題
});
```

然後在 ChatModals 中傳入標題：
```vue
<PhotoSelectorModal
  :is-open="modals.photoSelector.show"
  :character-id="partnerId"
  :character-photo-url="..."
  :title="photoSelectorTitle" // 動態標題
  @close="emit('close-photo-selector')"
  @select="emit('photo-select', $event)"
/>
```

## 測試步驟 🧪

1. **重啟後端服務**（應用後端修改）
2. **重啟前端服務**（應用前端修改）
3. 進入聊天頁面
4. 點擊送禮物按鈕
5. 選擇一個禮物
6. **✨ 應該出現照片選擇器**
7. 選擇一張照片
8. 確認禮物發送成功，並顯示選擇的照片

## 功能特點 🎯

- ✅ 用戶可以選擇該角色相簿中的任何照片作為禮物回應
- ✅ 包含角色的預設照片（排在最前面）
- ✅ 如果選擇了照片，後端不會生成新照片（節省 AI 成本）
- ✅ 如果沒有選擇照片，仍然可以生成新照片（保持原有功能）
- ✅ 選擇的照片會自動保存到相簿並標記為禮物照片

## 可選：添加「生成新照片」選項

如果你想讓用戶可以**選擇現有照片**或**生成新照片**，可以在照片選擇器底部添加一個按鈕：

```vue
<!-- 在 PhotoSelectorModal.vue 的底部按鈕區域 -->
<div v-if="!isLoading" class="action-buttons">
  <button type="button" class="btn-unified btn-secondary" @click="handleGenerateNew">
    生成新照片
  </button>
  <button v-if="selectedPhoto" type="button" class="btn-unified btn-cancel" @click="handleCancel">
    取消
  </button>
  <button v-if="selectedPhoto" type="button" class="btn-unified btn-confirm" @click="handleConfirm">
    使用這張
  </button>
</div>
```

然後添加 `handleGenerateNew` 方法：
```typescript
const handleGenerateNew = (): void => {
  emit("generate-new"); // 發送事件，讓父組件處理生成新照片的邏輯
  handleClose();
};
```

## 注意事項 ⚠️

1. 如果用戶相簿中沒有照片，會顯示「尚無照片，請先生成自拍照」
2. 角色的預設照片會顯示「預設」徽章
3. 照片選擇器只顯示圖片類型的媒體，不包含影片
4. 選中的照片會有明顯的視覺反饋（邊框和勾選標記）

## 相關文件 📄

- 後端：[gift.service.js](chat-app/backend/src/gift/giftResponse.service.js)
- 後端：[gift.routes.js](chat-app/backend/src/gift/gift.routes.js)
- 前端：[useChatActions.ts](chat-app/frontend/src/composables/chat/useChatActions.ts)
- 前端：[PhotoSelectorModal.vue](chat-app/frontend/src/components/chat/PhotoSelectorModal.vue)
- 前端：[ChatModals.vue](chat-app/frontend/src/components/chat/ChatModals.vue)
- 前端：[ChatView.vue](chat-app/frontend/src/views/ChatView.vue)
- 前端：需要找到 `useChatSetup` 或相關的 composable 來修改 `handleSelectGift`
