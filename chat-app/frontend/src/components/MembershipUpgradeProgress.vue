<template>
  <div v-if="isUpgrading || upgradeProgress.step" class="upgrade-progress-overlay">
    <div class="upgrade-progress-card">
      <!-- 進度圖標 -->
      <div class="progress-icon">
        <svg
          v-if="upgradeProgress.step !== 'completed'"
          class="spinner"
          viewBox="0 0 50 50"
        >
          <circle
            class="path"
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke-width="4"
          ></circle>
        </svg>
        <svg
          v-else
          class="checkmark"
          viewBox="0 0 52 52"
        >
          <circle
            class="checkmark-circle"
            cx="26"
            cy="26"
            r="25"
            fill="none"
          />
          <path
            class="checkmark-check"
            fill="none"
            d="M14.1 27.2l7.1 7.2 16.7-16.8"
          />
        </svg>
      </div>

      <!-- 進度文字 -->
      <h3 class="progress-title">
        {{ progressTitle }}
      </h3>
      <p class="progress-message">
        {{ upgradeProgress.message }}
      </p>

      <!-- 進度條 -->
      <div class="progress-bar-container">
        <div
          class="progress-bar"
          :style="{ width: progressPercentage + '%' }"
        ></div>
      </div>

      <!-- 提示文字 -->
      <p class="progress-hint">
        升級期間請勿關閉頁面或進行其他操作
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useMembership } from '../composables/useMembership';

type ProgressStep = 'validating' | 'processing' | 'finalizing' | 'completed';

const { isUpgrading, upgradeProgress } = useMembership();

// 進度標題
const progressTitle = computed(() => {
  const stepTitles: Record<ProgressStep, string> = {
    validating: '驗證中',
    processing: '處理中',
    finalizing: '完成中',
    completed: '升級成功！',
  };
  return stepTitles[upgradeProgress.value.step as ProgressStep] || '升級中';
});

// 進度百分比
const progressPercentage = computed(() => {
  const stepPercentages: Record<ProgressStep, number> = {
    validating: 25,
    processing: 60,
    finalizing: 90,
    completed: 100,
  };
  return stepPercentages[upgradeProgress.value.step as ProgressStep] || 0;
});
</script>

<style scoped>
.upgrade-progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.upgrade-progress-card {
  background: white;
  border-radius: 16px;
  padding: 32px;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.progress-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
}

/* 旋轉動畫 */
.spinner {
  animation: rotate 2s linear infinite;
  width: 80px;
  height: 80px;
}

.spinner .path {
  stroke: #4f46e5;
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

/* 完成圖標動畫 */
.checkmark {
  width: 80px;
  height: 80px;
}

.checkmark-circle {
  stroke: #10b981;
  stroke-width: 2;
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  stroke-linecap: round;
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark-check {
  stroke: #10b981;
  stroke-width: 3;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  stroke-linecap: round;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
}

@keyframes stroke {
  100% {
    stroke-dashoffset: 0;
  }
}

/* 文字樣式 */
.progress-title {
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 12px;
}

.progress-message {
  font-size: 16px;
  color: #6b7280;
  margin: 0 0 24px;
}

.progress-hint {
  font-size: 14px;
  color: #9ca3af;
  margin: 16px 0 0;
}

/* 進度條 */
.progress-bar-container {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%);
  border-radius: 4px;
  transition: width 0.5s ease;
}
</style>
