<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from "vue";
import { useRouter } from "vue-router";
import { GiftIcon, ClockIcon } from "@heroicons/vue/24/solid";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/vue/24/outline";
import { useUserProfile } from "../../composables/useUserProfile";
import { isGuestUser } from "../../../../../shared/config/testAccounts.js";
import { apiJson } from "../../utils/api";

interface BundlePurchaseStatus {
  canPurchase: boolean;
  reason?: string | null;
  nextAvailableAt?: string | null;
  purchaseCount?: number;
}

interface Bundle {
  id: string;
  name: string;
  price: number;
  purchaseLimit: string;
  purchaseStatus?: BundlePurchaseStatus;
}

interface DisplayBundle extends Bundle {
  limitLabel: string;
  countdownText: string;
}

const router = useRouter();
const { user } = useUserProfile();

// localStorage key for dismissal
const DISMISS_STORAGE_KEY = "bundleFloatDismissedDate";

// 檢查今天是否已經關閉過
const checkDismissedToday = (): boolean => {
  try {
    const dismissedDate = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!dismissedDate) return false;

    const today = new Date().toDateString();
    return dismissedDate === today;
  } catch {
    return false;
  }
};

// 儲存今天已關閉
const saveDismissedToday = (): void => {
  try {
    const today = new Date().toDateString();
    localStorage.setItem(DISMISS_STORAGE_KEY, today);
  } catch {
    // localStorage 不可用時忽略
  }
};

// 狀態
const displayBundles: Ref<DisplayBundle[]> = ref([]);
const currentIndex: Ref<number> = ref(0);
const isVisible: Ref<boolean> = ref(false);
const isDismissed: Ref<boolean> = ref(checkDismissedToday());

let countdownInterval: ReturnType<typeof setInterval> | null = null;
let rotateInterval: ReturnType<typeof setInterval> | null = null;

// 當前顯示的禮包
const currentBundle: ComputedRef<DisplayBundle | null> = computed(() => {
  if (displayBundles.value.length === 0) return null;
  return displayBundles.value[currentIndex.value] || null;
});

// 計算是否顯示
const shouldShow: ComputedRef<boolean> = computed(() => {
  return isVisible.value && !isDismissed.value && displayBundles.value.length > 0;
});

// 是否有多個禮包
const hasMultiple: ComputedRef<boolean> = computed(() => {
  return displayBundles.value.length > 1;
});

// 獲取限購類型標籤
const getLimitLabel = (limit: string): string => {
  switch (limit) {
    case "weekly":
      return "每週限購";
    case "monthly":
      return "每月限購";
    case "daily":
      return "每日限購";
    default:
      return "限購";
  }
};

// 計算本週期結束時間（用於顯示「還剩多久可以購買」）
const getPeriodEndTime = (purchaseLimit: string): Date | null => {
  const now = new Date();

  switch (purchaseLimit) {
    case "weekly": {
      // 下週一 00:00
      const dayOfWeek = now.getDay(); // 0=週日, 1=週一, ..., 6=週六
      const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + daysUntilMonday);
      nextMonday.setHours(0, 0, 0, 0);
      return nextMonday;
    }
    case "monthly": {
      // 下個月 1 號 00:00
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      return nextMonth;
    }
    case "daily": {
      // 明天 00:00
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    }
    default:
      return null;
  }
};

// 格式化時間差
const formatTimeDiff = (diff: number): string => {
  if (diff <= 0) return "";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) {
    return `${days}天${hours}時${minutes}分`;
  } else if (hours > 0) {
    return `${hours}時${minutes}分${seconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
};

// 計算單個禮包的倒數時間
const calculateBundleCountdown = (bundle: DisplayBundle): string => {
  const status = bundle.purchaseStatus;

  // 如果可以購買，顯示本週期剩餘時間
  if (status?.canPurchase) {
    const periodEnd = getPeriodEndTime(bundle.purchaseLimit);
    if (periodEnd) {
      const now = new Date();
      const diff = periodEnd.getTime() - now.getTime();
      if (diff > 0) {
        const timeStr = formatTimeDiff(diff);
        return `⏳ 剩 ${timeStr}`;
      }
    }
    return "🎁 可購買";
  }

  // 如果不能購買但沒有下次可購買時間（如終身限購已購買）
  if (!status?.nextAvailableAt) {
    return status?.reason || "已購買";
  }

  const nextAvailable = new Date(status.nextAvailableAt!);
  const now = new Date();
  const diff = nextAvailable.getTime() - now.getTime();

  if (diff <= 0) {
    return "現在可購買！";
  }

  return formatTimeDiff(diff);
};

// 更新所有倒數時間
const updateAllCountdowns = (): void => {
  displayBundles.value = displayBundles.value.map(bundle => ({
    ...bundle,
    countdownText: calculateBundleCountdown(bundle)
  }));
};

// 加載可用的限購禮包
const loadAvailableBundles = async (): Promise<void> => {
  const userId = user.value?.id;
  if (!userId || isGuestUser(userId)) {
    isVisible.value = false;
    return;
  }

  try {
    const response = await apiJson("/api/bundles/me");
    if (response.success && response.data?.packages) {
      // 找到所有限購禮包
      const limitedBundles = response.data.packages.filter(
        (pkg: Bundle) => pkg.purchaseLimit && pkg.purchaseLimit !== "none"
      );

      // 所有限購禮包都顯示（無論是否可購買）
      const bundlesToShow: DisplayBundle[] = limitedBundles.map((pkg: Bundle) => ({
        ...pkg,
        limitLabel: getLimitLabel(pkg.purchaseLimit),
        countdownText: ""
      }));

      console.log("[禮包提示] 找到限購禮包:", bundlesToShow.map(b => ({
        name: b.name,
        limit: b.purchaseLimit,
        canPurchase: b.purchaseStatus?.canPurchase,
        nextAvailableAt: b.purchaseStatus?.nextAvailableAt
      })));

      if (bundlesToShow.length > 0) {
        displayBundles.value = bundlesToShow;
        currentIndex.value = 0;
        isVisible.value = true;
        startCountdown();

        // 如果有多個禮包，啟動輪播
        if (bundlesToShow.length > 1) {
          startRotation();
        }
      } else {
        isVisible.value = false;
      }
    }
  } catch (error) {
    console.error("加載禮包失敗:", error);
    isVisible.value = false;
  }
};

// 啟動倒數計時
const startCountdown = (): void => {
  stopCountdown();
  updateAllCountdowns();
  // 每秒更新倒數
  countdownInterval = setInterval(updateAllCountdowns, 1000);
};

const stopCountdown = (): void => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
};

// 啟動輪播
const startRotation = (): void => {
  stopRotation();
  // 每 5 秒切換到下一個
  rotateInterval = setInterval(() => {
    if (displayBundles.value.length > 1) {
      currentIndex.value = (currentIndex.value + 1) % displayBundles.value.length;
    }
  }, 5000);
};

const stopRotation = (): void => {
  if (rotateInterval) {
    clearInterval(rotateInterval);
    rotateInterval = null;
  }
};

// 手動切換
const goToPrev = (): void => {
  if (displayBundles.value.length > 1) {
    currentIndex.value = (currentIndex.value - 1 + displayBundles.value.length) % displayBundles.value.length;
    // 重置輪播計時
    startRotation();
  }
};

const goToNext = (): void => {
  if (displayBundles.value.length > 1) {
    currentIndex.value = (currentIndex.value + 1) % displayBundles.value.length;
    // 重置輪播計時
    startRotation();
  }
};

// 關閉提示
const dismiss = (): void => {
  isDismissed.value = true;
  saveDismissedToday(); // 儲存到 localStorage，當天不再顯示
  stopCountdown();
  stopRotation();
};

// 跳轉到商城
const goToShop = (): void => {
  router.push({ name: "shop", query: { category: "bundles" } });
};

onMounted(() => {
  // 延遲加載，避免影響頁面初始渲染
  setTimeout(loadAvailableBundles, 1500);
});

onUnmounted(() => {
  stopCountdown();
  stopRotation();
});
</script>

<template>
  <Transition name="float-slide">
    <div v-if="shouldShow" class="bundle-countdown-float" @click="goToShop">
      <button
        type="button"
        class="float-dismiss"
        aria-label="關閉"
        @click.stop="dismiss"
      >
        <XMarkIcon class="dismiss-icon" />
      </button>

      <!-- 左箭頭 -->
      <button
        v-if="hasMultiple"
        type="button"
        class="float-nav float-nav--prev"
        aria-label="上一個"
        @click.stop="goToPrev"
      >
        <ChevronLeftIcon class="nav-icon" />
      </button>

      <div class="float-content">
        <div class="float-icon">
          <GiftIcon class="icon-gift" />
        </div>
        <div class="float-info">
          <span class="float-limit-tag">{{ currentBundle?.limitLabel }}</span>
          <span class="float-label">{{ currentBundle?.name || "限購禮包" }}</span>
          <span class="float-countdown">
            <ClockIcon v-if="currentBundle?.countdownText && (currentBundle.countdownText.includes('天') || currentBundle.countdownText.includes('時') || currentBundle.countdownText.includes('分') || currentBundle.countdownText.includes('秒'))" class="icon-clock" />
            {{ currentBundle?.countdownText }}
          </span>
        </div>
      </div>

      <!-- 右箭頭 -->
      <button
        v-if="hasMultiple"
        type="button"
        class="float-nav float-nav--next"
        aria-label="下一個"
        @click.stop="goToNext"
      >
        <ChevronRightIcon class="nav-icon" />
      </button>

      <!-- 指示器 -->
      <div v-if="hasMultiple" class="float-indicators">
        <span
          v-for="(_, idx) in displayBundles"
          :key="idx"
          class="indicator"
          :class="{ 'indicator--active': idx === currentIndex }"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.bundle-countdown-float {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  right: 12px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.9), rgba(251, 191, 36, 0.85));
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(236, 72, 153, 0.35), 0 2px 8px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: all 0.25s ease;
  animation: float-bounce 2s ease-in-out infinite;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(236, 72, 153, 0.45), 0 3px 10px rgba(0, 0, 0, 0.3);
  }

  &:active {
    transform: scale(0.98);
  }
}

@keyframes float-bounce {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

.float-dismiss {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.8);
    transform: scale(1.1);
  }

  .dismiss-icon {
    width: 14px;
    height: 14px;
    color: rgba(255, 255, 255, 0.95);
  }
}

.float-nav {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.35);
  }

  .nav-icon {
    width: 10px;
    height: 10px;
    color: #fff;
  }
}

.float-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.float-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;

  .icon-gift {
    width: 14px;
    height: 14px;
    color: #fff;
  }
}

.float-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 70px;
}

.float-limit-tag {
  font-size: 0.55rem;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  padding: 1px 4px;
  border-radius: 3px;
  width: fit-content;
  letter-spacing: 0.02em;
}

.float-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}

.float-countdown {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);

  .icon-clock {
    width: 10px;
    height: 10px;
    animation: pulse-clock 1s ease-in-out infinite;
  }
}

@keyframes pulse-clock {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.float-indicators {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 3px;
}

.indicator {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  transition: all 0.2s ease;

  &--active {
    background: #fff;
    transform: scale(1.2);
  }
}

// 動畫過渡
.float-slide-enter-active,
.float-slide-leave-active {
  transition: all 0.3s ease;
}

.float-slide-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.float-slide-leave-to {
  opacity: 0;
  transform: translateX(100px) scale(0.8);
}

// 桌面版：調整位置（稍大一點）
@media (min-width: 1024px) {
  .bundle-countdown-float {
    top: 24px;
    right: 24px;
    padding: 8px 12px;
    gap: 6px;
    border-radius: 14px;

    &:hover {
      animation: none;
    }
  }

  .float-nav {
    width: 22px;
    height: 22px;

    .nav-icon {
      width: 12px;
      height: 12px;
    }
  }

  .float-icon {
    width: 30px;
    height: 30px;
    border-radius: 8px;

    .icon-gift {
      width: 16px;
      height: 16px;
    }
  }

  .float-info {
    min-width: 80px;
  }

  .float-limit-tag {
    font-size: 0.6rem;
    padding: 2px 5px;
    border-radius: 4px;
  }

  .float-label {
    font-size: 0.7rem;
    max-width: 100px;
  }

  .float-countdown {
    font-size: 0.75rem;

    .icon-clock {
      width: 12px;
      height: 12px;
    }
  }

  .float-indicators {
    bottom: -10px;
    gap: 4px;
  }

  .indicator {
    width: 5px;
    height: 5px;
  }
}
</style>
