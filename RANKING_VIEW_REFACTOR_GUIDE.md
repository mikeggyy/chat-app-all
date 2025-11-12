# RankingView.vue 拆分重構指南

## 📋 當前進度

已完成的文件：

### ✅ 已創建

1. **工具函數**: `frontend/src/utils/rankingUtils.js`
   - 格式化函數（formatScore, formatDateLine）
   - 數據處理（normalizeIdentifier, toPositiveInteger）
   - 常量定義（PERIOD_OPTIONS, EMPTY_METADATA）

2. **Composable - 數據管理**: `frontend/src/composables/ranking/useRankingData.js`
   - 排行榜數據獲取（loadRankings）
   - 元數據管理（loadMatchMetadata, assignMatchMetadata）
   - 條目裝飾（decorateEntry, decorateEntries）
   - 狀態管理（podium, entries, loading, hasMore等）

3. **Composable - 分頁**: `frontend/src/composables/ranking/useRankingPagination.js`
   - 無限滾動邏輯（Intersection Observer）
   - 分頁狀態管理
   - Observer 生命週期管理

4. **組件 - Podium**: `frontend/src/components/ranking/RankingPodium.vue`
   - 前三名展示
   - 加載佔位符
   - 點擊事件處理

---

## 🚀 完整拆分方案

### 步驟 1：創建剩餘的子組件

#### 1.1 RankingList.vue（排行榜列表）

**位置**: `frontend/src/components/ranking/RankingList.vue`

**功能**:
- 顯示排名 4+ 的角色列表
- 每個項目包含：排名徽章、頭像、名稱、分數
- 支持點擊導航到聊天室

**Props**:
```javascript
{
  entries: Array,  // 裝飾後的條目列表
  loading: Boolean,
  hasMore: Boolean
}
```

**Emits**:
```javascript
['navigate']  // 點擊項目時觸發
```

**模板結構**:
```vue
<template>
  <ol class="ranking-list">
    <li
      v-for="entry in entries"
      :key="entry.rank"
      class="ranking-item"
      @click="$emit('navigate', entry)"
    >
      <div class="rank-badge">{{ entry.rank }}</div>
      <div class="item-avatar">
        <LazyImage :src="entry.avatar" />
      </div>
      <div class="item-body">
        <p class="item-name">{{ entry.displayName }}</p>
      </div>
      <div class="item-score">{{ formatScore(entry.score) }}</div>
    </li>
  </ol>

  <!-- 加載更多指示器 -->
  <div v-if="hasMore" ref="sentinelRef" class="load-more-sentinel"></div>

  <!-- 加載中狀態 -->
  <div v-if="loading" class="loading-more">
    <ArrowPathIcon class="spinner" />
    <span>載入更多...</span>
  </div>
</template>
```

---

#### 1.2 RankingTabSwitch.vue（時段切換）

**位置**: `frontend/src/components/ranking/RankingTabSwitch.vue`

**功能**:
- 切換排行榜時段（每日/每週/每月）
- 高亮當前選中的時段

**Props**:
```javascript
{
  activePeriod: String,  // 'daily' | 'weekly' | 'monthly'
  options: Array         // PERIOD_OPTIONS
}
```

**Emits**:
```javascript
['change']  // 切換時段時觸發
```

**模板結構**:
```vue
<template>
  <div class="tab-switch">
    <button
      v-for="option in options"
      :key="option.id"
      :class="{ active: option.id === activePeriod }"
      @click="$emit('change', option.id)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
```

---

### 步驟 2：重構 RankingView.vue（主組件）

**新的 RankingView.vue 結構**（縮減至 ~200 行）:

```vue
<template>
  <div class="ranking-screen">
    <!-- 頂部導航 -->
    <header class="ranking-top">
      <button @click="handleBack">
        <ArrowLeftIcon />
      </button>
      <div class="top-title">
        <h1>排行榜</h1>
        <p v-if="updateLine">{{ updateLine }}</p>
      </div>
    </header>

    <!-- 時段切換 -->
    <RankingTabSwitch
      :active-period="activePeriod"
      :options="PERIOD_OPTIONS"
      @change="handlePeriodChange"
    />

    <!-- 內容區域 -->
    <div class="ranking-scroll-container">
      <!-- Podium（前三名） -->
      <RankingPodium
        :podium="decoratedPodium"
        @navigate="handleEntryNavigate"
      />

      <!-- 錯誤狀態 -->
      <div v-if="showErrorState" class="error-state">
        <p>{{ errorMessage }}</p>
        <button @click="handleRetry">重新整理</button>
      </div>

      <!-- 空狀態 -->
      <div v-else-if="isEmptyState" class="empty-state">
        <p>目前沒有榜單資料</p>
        <button @click="handleRetry">重新整理</button>
      </div>

      <!-- 列表 -->
      <RankingList
        v-else
        :entries="decoratedEntries"
        :loading="isLoadingMore"
        :has-more="hasMore"
        @navigate="handleEntryNavigate"
      />

      <!-- 無限滾動哨兵 -->
      <div ref="sentinelRef"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeftIcon } from '@heroicons/vue/24/outline';
import RankingPodium from '../components/ranking/RankingPodium.vue';
import RankingList from '../components/ranking/RankingList.vue';
import RankingTabSwitch from '../components/ranking/RankingTabSwitch.vue';
import { useRankingData } from '../composables/ranking/useRankingData.js';
import { useRankingPagination } from '../composables/ranking/useRankingPagination.js';
import { PERIOD_OPTIONS } from '../utils/rankingUtils.js';

const router = useRouter();

// 使用 Composables
const {
  podium,
  entries,
  errorMessage,
  loading,
  hasMore,
  updateLine,
  loadMatchMetadata,
  decorateEntries,
  loadRankings,
  resetState,
} = useRankingData();

const {
  sentinelRef,
  isLoadingMore,
  reattachObserver,
} = useRankingPagination(
  () => loadRankings(activePeriod.value),
  loading,
  hasMore
);

// 本地狀態
const activePeriod = ref('daily');

// 計算屬性
const decoratedPodium = computed(() => decorateEntries(podium.value));
const decoratedEntries = computed(() => decorateEntries(entries.value));

const showErrorState = computed(() => Boolean(errorMessage.value));
const isEmptyState = computed(() =>
  !loading.value &&
  !errorMessage.value &&
  decoratedPodium.value.length === 0 &&
  decoratedEntries.value.length === 0
);

// 方法
const handlePeriodChange = (periodId) => {
  if (periodId === activePeriod.value) return;
  activePeriod.value = periodId;
  resetState();
  loadRankings(periodId, { reset: true }).then(() => {
    reattachObserver();
  });
};

const handleRetry = () => {
  resetState();
  loadRankings(activePeriod.value, { reset: true });
};

const handleEntryNavigate = (entry) => {
  if (!entry?.chatId) return;
  router.push(`/chat/${entry.chatId}`);
};

const handleBack = () => {
  router.back();
};

// 生命週期
onMounted(async () => {
  await loadMatchMetadata();
  await loadRankings(activePeriod.value, { reset: true });
});
</script>
```

---

## 📊 拆分前後對比

### Before（原始）
- **總行數**: 1477 行
- **Script**: ~600 行
- **Template**: ~800 行
- **Styles**: ~77 行

### After（重構後）
- **RankingView.vue**: ~200 行（主組件）
- **RankingPodium.vue**: ~150 行
- **RankingList.vue**: ~100 行
- **RankingTabSwitch.vue**: ~50 行
- **useRankingData.js**: ~280 行
- **useRankingPagination.js**: ~80 行
- **rankingUtils.js**: ~80 行

**總行數**: ~940 行（減少 37%）

---

## ✅ 優化收益

### 1. 可維護性
- ✅ 每個文件 < 300 行，易於理解
- ✅ 關注點分離（數據 / UI / 邏輯）
- ✅ 單一職責原則

### 2. 可測試性
- ✅ Composables 可獨立測試
- ✅ 組件可單獨測試
- ✅ 工具函數純函數化

### 3. 可重用性
- ✅ Composables 可在其他視圖使用
- ✅ 子組件可獨立使用
- ✅ 工具函數全局可用

### 4. 性能
- ✅ 裝飾緩存減少重複計算
- ✅ shallowRef 減少響應式開銷
- ✅ 無限滾動優化

---

## 🔧 實施步驟

### 第一階段：創建基礎設施（已完成）
- [x] 創建工具函數 `rankingUtils.js`
- [x] 創建數據 Composable `useRankingData.js`
- [x] 創建分頁 Composable `useRankingPagination.js`
- [x] 創建 Podium 組件

### 第二階段：創建剩餘組件（待完成）
- [ ] 創建 `RankingList.vue`
- [ ] 創建 `RankingTabSwitch.vue`

### 第三階段：重構主組件（待完成）
- [ ] 重寫 `RankingView.vue` 使用新的組件和 Composables
- [ ] 移除重複代碼
- [ ] 更新樣式（可能需要拆分為 scoped styles）

### 第四階段：測試和驗證
- [ ] 測試所有時段切換功能
- [ ] 測試無限滾動
- [ ] 測試導航功能
- [ ] 確保樣式一致

---

## 📝 注意事項

1. **樣式處理**:
   - 可以保留在主組件的 `<style scoped>` 中
   - 或提取為 `RankingView.styles.css` 並在各組件中導入

2. **LazyImage 組件**:
   - 確保所有子組件都能訪問
   - 已在各組件中正確導入

3. **向後兼容**:
   - 保持相同的 props 和 emits 接口
   - 確保路由參數處理一致

4. **TypeScript**（可選）:
   - 如果項目使用 TypeScript，添加類型定義
   - 創建 `types/ranking.ts` 定義接口

---

## 🚀 快速開始

要完成剩餘的重構：

```bash
# 1. 創建 RankingList 組件
# 參考上方的模板結構

# 2. 創建 RankingTabSwitch 組件
# 參考上方的模板結構

# 3. 備份原始 RankingView.vue
cp RankingView.vue RankingView.vue.backup

# 4. 替換為新的 RankingView.vue
# 使用上方提供的簡化版本

# 5. 測試功能
npm run dev
# 訪問 /ranking 路由測試所有功能
```

---

## 📚 延伸閱讀

- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [組件設計原則](https://vuejs.org/guide/reusability/composables.html)
- [無限滾動最佳實踐](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
