# 樂觀更新和加載狀態使用指南

本指南介紹如何使用新的樂觀更新和加載狀態管理工具。

## 目錄

- [樂觀更新 (useOptimisticUpdate)](#樂觀更新-useoptimisticupdate)
- [列表樂觀更新 (useOptimisticList)](#列表樂觀更新-useoptimisticlist)
- [值樂觀更新 (useOptimisticValue)](#值樂觀更新-useoptimisticvalue)
- [加載狀態管理 (useLoadingState)](#加載狀態管理-useloadingstate)
- [按鈕加載狀態 (useButtonLoading)](#按鈕加載狀態-usebuttonloading)
- [數據加載管理 (useDataLoading)](#數據加載管理-usedataloading)
- [實際應用示例](#實際應用示例)

---

## 樂觀更新 (useOptimisticUpdate)

### 什麼是樂觀更新？

樂觀更新是一種 UI 模式，在等待服務器響應前先更新 UI，給用戶即時反饋。如果 API 調用失敗，自動回滾到原始狀態。

### 基本用法

```javascript
import { useOptimisticUpdate } from '@/composables/useOptimisticUpdate';

export default {
  setup() {
    const optimistic = useOptimisticUpdate();

    const toggleFavorite = async (characterId) => {
      await optimistic.execute(`favorite-${characterId}`, {
        // 1. 立即更新 UI
        optimisticUpdate: () => {
          isFavorited.value = !isFavorited.value;
        },

        // 2. 調用 API
        apiCall: () => apiJson('/api/favorites/toggle', {
          method: 'POST',
          body: JSON.stringify({ characterId }),
        }),

        // 3. 失敗時回滾
        rollback: () => {
          isFavorited.value = !isFavorited.value;
        },

        // 4. 成功回調（可選）
        onSuccess: (result) => {
          console.log('收藏成功', result);
        },
      });
    };

    return { toggleFavorite };
  },
};
```

### 選項

- `optimisticUpdate`: 立即執行的 UI 更新函數
- `apiCall`: API 調用函數（必須返回 Promise）
- `rollback`: 失敗時的回滾函數
- `onSuccess`: 成功回調（可選）
- `errorMessage`: 自定義錯誤消息（可選）

---

## 列表樂觀更新 (useOptimisticList)

專為列表操作設計的簡化工具。

### 添加項目

```javascript
import { useOptimisticList } from '@/composables/useOptimisticUpdate';

export default {
  setup() {
    const messages = ref([]);
    const optimisticList = useOptimisticList();

    const sendMessage = async (text) => {
      const newMessage = {
        id: `temp-${Date.now()}`,
        text,
        createdAt: new Date().toISOString(),
      };

      await optimisticList.addItem({
        list: messages,
        item: newMessage,
        position: 'end', // 'start' 或 'end'
        apiCall: () => apiJson('/api/messages', {
          method: 'POST',
          body: JSON.stringify({ text }),
        }),
      });
    };

    return { messages, sendMessage };
  },
};
```

### 刪除項目

```javascript
const deleteMessage = async (messageId) => {
  await optimisticList.removeItem({
    list: messages,
    itemId: messageId,
    apiCall: () => apiJson(`/api/messages/${messageId}`, {
      method: 'DELETE',
    }),
  });
};
```

### 更新項目

```javascript
const editMessage = async (messageId, newText) => {
  await optimisticList.updateItem({
    list: messages,
    itemId: messageId,
    updates: { text: newText }, // 或使用函數: (item) => ({ ...item, text: newText })
    apiCall: () => apiJson(`/api/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ text: newText }),
    }),
  });
};
```

### 切換屬性

```javascript
const toggleRead = async (messageId) => {
  await optimisticList.toggleProperty({
    list: messages,
    itemId: messageId,
    property: 'isRead',
    apiCall: () => apiJson(`/api/messages/${messageId}/read`, {
      method: 'POST',
    }),
  });
};
```

---

## 值樂觀更新 (useOptimisticValue)

專為單個值操作設計。

### 更新值

```javascript
import { useOptimisticValue } from '@/composables/useOptimisticUpdate';

export default {
  setup() {
    const nickname = ref('User123');
    const optimisticValue = useOptimisticValue();

    const updateNickname = async (newNickname) => {
      await optimisticValue.updateValue({
        value: nickname,
        newValue: newNickname,
        apiCall: () => apiJson('/api/profile/nickname', {
          method: 'PUT',
          body: JSON.stringify({ nickname: newNickname }),
        }),
      });
    };

    return { nickname, updateNickname };
  },
};
```

### 切換布爾值

```javascript
const notificationsEnabled = ref(true);

const toggleNotifications = async () => {
  await optimisticValue.toggleBoolean({
    value: notificationsEnabled,
    apiCall: () => apiJson('/api/settings/notifications/toggle', {
      method: 'POST',
    }),
  });
};
```

### 增減數值

```javascript
const balance = ref(100);

const addCoins = async (amount) => {
  await optimisticValue.adjustNumber({
    value: balance,
    delta: amount,
    apiCall: () => apiJson('/api/coins/add', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  });
};
```

---

## 加載狀態管理 (useLoadingState)

細粒度的加載狀態追蹤。

### 基本用法

```javascript
import { useLoadingState } from '@/composables/useLoadingState';

export default {
  setup() {
    const loading = useLoadingState();

    const loadUserProfile = async () => {
      loading.startLoading('profile');

      try {
        const data = await apiJson('/api/profile');
        // 處理數據
      } finally {
        loading.stopLoading('profile');
      }
    };

    return {
      isLoadingProfile: () => loading.isLoading('profile'),
      loadUserProfile,
    };
  },
};
```

### 自動管理加載狀態

```javascript
const loading = useLoadingState();

const loadData = loading.withLoading('data-load', async () => {
  return await apiJson('/api/data');
}, {
  onSuccess: (result) => console.log('成功', result),
  onError: (error) => console.error('失敗', error),
});

// 使用
await loadData();
console.log(loading.isLoading('data-load')); // false
```

### 檢查多個狀態

```javascript
// 檢查任意一個是否在加載
const isAnyLoading = loading.isAnyLoading('profile', 'messages', 'settings');

// 檢查所有是否都在加載
const isAllLoading = loading.isAllLoading('profile', 'messages');

// Computed: 是否有任何加載
const hasLoading = loading.hasAnyLoading;
```

---

## 按鈕加載狀態 (useButtonLoading)

簡化的按鈕加載狀態管理。

### 使用方法

```javascript
import { useButtonLoading } from '@/composables/useLoadingState';

export default {
  setup() {
    const buttonLoading = useButtonLoading();

    const handleSave = buttonLoading.wrapHandler('save-btn', async () => {
      await apiJson('/api/save', { method: 'POST' });
    });

    return {
      handleSave,
      saveButtonProps: buttonLoading.getButtonProps('save-btn'),
    };
  },
};
```

### 在模板中使用

```vue
<template>
  <button
    v-bind="saveButtonProps"
    @click="handleSave"
  >
    {{ saveButtonProps.loading ? '保存中...' : '保存' }}
  </button>
</template>
```

---

## 數據加載管理 (useDataLoading)

帶緩存的數據加載管理。

### 使用方法

```javascript
import { useDataLoading } from '@/composables/useLoadingState';

export default {
  setup() {
    const dataLoading = useDataLoading();

    const loadProfile = async () => {
      const profile = await dataLoading.loadData('profile', () =>
        apiJson('/api/profile')
      );
      return profile;
    };

    const refreshProfile = async () => {
      // 強制重新加載
      const profile = await dataLoading.refreshData('profile', () =>
        apiJson('/api/profile')
      );
      return profile;
    };

    return {
      profile: () => dataLoading.getData('profile'),
      isLoadingProfile: () => dataLoading.isLoading('profile'),
      hasError: () => dataLoading.hasError('profile'),
      error: () => dataLoading.getError('profile'),
      loadProfile,
      refreshProfile,
    };
  },
};
```

---

## 實際應用示例

### 示例 1：聊天消息發送（樂觀更新 + 加載狀態）

```javascript
import { ref } from 'vue';
import { useOptimisticList } from '@/composables/useOptimisticUpdate';
import { useLoadingState } from '@/composables/useLoadingState';
import { apiJson } from '@/utils/api';

export default {
  setup() {
    const messages = ref([]);
    const draft = ref('');

    const optimisticList = useOptimisticList();
    const loading = useLoadingState();

    const sendMessage = async () => {
      if (!draft.value.trim()) return;

      const tempMessage = {
        id: `temp-${Date.now()}`,
        text: draft.value,
        role: 'user',
        createdAt: new Date().toISOString(),
      };

      const text = draft.value;
      draft.value = ''; // 立即清空輸入框

      await optimisticList.addItem({
        list: messages,
        item: tempMessage,
        position: 'end',
        apiCall: loading.withLoading('send-message', () =>
          apiJson('/api/messages', {
            method: 'POST',
            body: JSON.stringify({ text }),
          })
        ),
      });
    };

    return {
      messages,
      draft,
      sendMessage,
      isSending: () => loading.isLoading('send-message'),
    };
  },
};
```

### 示例 2：收藏功能（樂觀切換）

```javascript
import { ref } from 'vue';
import { useOptimisticValue } from '@/composables/useOptimisticUpdate';
import { apiJson } from '@/utils/api';

export default {
  setup() {
    const isFavorited = ref(false);
    const optimisticValue = useOptimisticValue();

    const toggleFavorite = async (characterId) => {
      await optimisticValue.toggleBoolean({
        value: isFavorited,
        key: `favorite-${characterId}`,
        apiCall: () => apiJson(`/api/favorites/${characterId}/toggle`, {
          method: 'POST',
        }),
      });
    };

    return {
      isFavorited,
      toggleFavorite,
      isTogglingFavorite: (id) => optimisticValue.isPending(`favorite-${id}`),
    };
  },
};
```

### 示例 3：列表刪除（樂觀移除 + 確認對話框）

```javascript
import { ref } from 'vue';
import { useOptimisticList } from '@/composables/useOptimisticUpdate';
import { useConfirmDialog } from '@/composables/useConfirmDialog';
import { apiJson } from '@/utils/api';

export default {
  setup() {
    const conversations = ref([]);
    const optimisticList = useOptimisticList();
    const { confirm } = useConfirmDialog();

    const deleteConversation = async (conversationId) => {
      const confirmed = await confirm({
        title: '刪除對話',
        message: '確定要刪除此對話嗎？此操作無法撤銷。',
      });

      if (!confirmed) return;

      await optimisticList.removeItem({
        list: conversations,
        itemId: conversationId,
        apiCall: () => apiJson(`/api/conversations/${conversationId}`, {
          method: 'DELETE',
        }),
      });
    };

    return {
      conversations,
      deleteConversation,
      isDeletingConversation: (id) => optimisticList.isPending(`remove-${id}`),
    };
  },
};
```

---

## 最佳實踐

### 1. 使用唯一的鍵值

```javascript
// ✅ 好的做法：使用唯一鍵
optimistic.execute(`favorite-${characterId}`, { ... });

// ❌ 不好的做法：使用通用鍵（可能衝突）
optimistic.execute('favorite', { ... });
```

### 2. 處理錯誤

```javascript
// ✅ 提供友好的錯誤消息
await optimistic.execute('action', {
  // ...
  errorMessage: '操作失敗，請檢查網絡連接後重試',
});
```

### 3. 避免嵌套樂觀更新

```javascript
// ❌ 避免：在樂觀更新中再次觸發樂觀更新
optimisticUpdate: () => {
  updateUI();
  anotherOptimisticUpdate(); // 不推薦
}

// ✅ 推薦：先完成第一個更新，再執行第二個
await optimistic.execute('first', { ... });
await optimistic.execute('second', { ... });
```

### 4. 清理狀態

```javascript
import { onBeforeUnmount } from 'vue';

onBeforeUnmount(() => {
  optimistic.clearPending();
  loading.clearAll();
});
```

---

## 總結

- **樂觀更新**：提升用戶體驗，給予即時反饋
- **加載狀態**：清晰的視覺反饋，防止重複操作
- **組合使用**：結合樂觀更新和加載狀態，創造流暢的用戶體驗

這些工具可以顯著改善應用的響應性和用戶體驗！
