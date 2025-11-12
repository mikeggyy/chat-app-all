<script setup>
const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  type: {
    type: String,
    default: "confirm", // 'confirm' or 'purchase'
  },
  confirmMessage: {
    type: String,
    default: "",
  },
});

const emit = defineEmits([
  "close",
  "confirm",
  "go-to-shop",
  "go-to-vip",
]);

const handleClose = () => {
  emit("close");
};

const handleConfirm = () => {
  emit("confirm");
};

const handleGoToShop = () => {
  emit("go-to-shop");
};

const handleGoToVIP = () => {
  emit("go-to-vip");
};
</script>

<template>
  <Teleport to="body">
    <!-- 確認生成對話框 -->
    <div
      v-if="show && type === 'confirm'"
      class="appearance__confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-confirm-title"
    >
      <div
        class="appearance__confirm-backdrop"
        aria-hidden="true"
        @click="handleClose"
      ></div>
      <div class="appearance__confirm-panel">
        <header class="appearance__confirm-header">
          <h2 id="generate-confirm-title">確認生成角色</h2>
          <p>{{ confirmMessage }}</p>
          <button
            type="button"
            class="appearance__confirm-close"
            aria-label="關閉確認視窗"
            @click="handleClose"
          >
            ×
          </button>
        </header>
        <footer class="appearance__confirm-actions">
          <button
            type="button"
            class="appearance__confirm-action appearance__confirm-action--ghost"
            @click="handleClose"
          >
            取消
          </button>
          <button
            type="button"
            class="appearance__confirm-action appearance__confirm-action--primary"
            @click="handleConfirm"
          >
            確認生成
          </button>
        </footer>
      </div>
    </div>

    <!-- 購買提示彈窗 -->
    <div
      v-if="show && type === 'purchase'"
      class="appearance__confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-modal-title"
    >
      <div
        class="appearance__confirm-backdrop"
        aria-hidden="true"
        @click="handleClose"
      ></div>
      <div class="appearance__confirm-panel">
        <header class="appearance__confirm-header">
          <h2 id="purchase-modal-title">次數不足</h2>
          <p>您的免費創建次數已用完，且沒有剩餘的創建角色卡。</p>
          <button
            type="button"
            class="appearance__confirm-close"
            aria-label="關閉視窗"
            @click="handleClose"
          >
            ×
          </button>
        </header>
        <div class="appearance__purchase-options">
          <p class="appearance__purchase-subtitle">
            請選擇以下方式繼續創建角色：
          </p>
          <button
            type="button"
            class="appearance__purchase-option"
            @click="handleGoToShop"
          >
            <div class="appearance__purchase-option-icon">🎫</div>
            <div class="appearance__purchase-option-content">
              <h3>購買創建角色卡</h3>
              <p>使用創建角色卡立即生成新角色</p>
            </div>
          </button>
          <button
            type="button"
            class="appearance__purchase-option"
            @click="handleGoToVIP"
          >
            <div class="appearance__purchase-option-icon">👑</div>
            <div class="appearance__purchase-option-content">
              <h3>升級 VIP 會員</h3>
              <p>享受更多免費創建次數及專屬權益</p>
            </div>
          </button>
        </div>
        <footer class="appearance__confirm-actions">
          <button
            type="button"
            class="appearance__confirm-action appearance__confirm-action--ghost"
            @click="handleClose"
          >
            稍後再說
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.appearance__confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.appearance__confirm-backdrop {
  position: absolute;
  inset: 0;
  background: var(--bg-backdrop);
  backdrop-filter: blur(6px);
}

.appearance__confirm-panel {
  position: relative;
  width: min(420px, 100%);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border-modal);
  background: var(--bg-modal);
  padding: var(--spacing-2xl) 22px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xl);
  box-shadow: var(--shadow-modal);
}

.appearance__confirm-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
}

.appearance__confirm-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-white);
}

.appearance__confirm-header p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-light);
  letter-spacing: 0.04em;
}

.appearance__confirm-close {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color var(--transition-fast),
    color var(--transition-fast);
}

.appearance__confirm-close:hover {
  background: var(--bg-overlay-hover-strong);
  color: var(--text-bright);
}

.appearance__confirm-actions {
  display: flex;
  gap: var(--spacing-md);
}

.appearance__confirm-action {
  flex: 1;
  border-radius: var(--radius-full);
  padding: var(--spacing-md) var(--spacing-xl);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.06em;
  border: none;
  cursor: pointer;
  transition: opacity var(--transition-fast), transform var(--transition-fast),
    background-color var(--transition-fast);
}

.appearance__confirm-action:hover {
  transform: translateY(-1px);
}

.appearance__confirm-action--ghost {
  background: var(--bg-overlay-hover-strong);
  color: var(--text-bright);
  border: 1px solid var(--border-ghost);
}

.appearance__confirm-action--ghost:hover {
  background: var(--bg-overlay-hover-light);
}

.appearance__confirm-action--primary {
  background: var(--gradient-primary);
  color: var(--color-white);
  box-shadow: var(--color-primary-shadow-button);
}

.appearance__confirm-action--primary:hover {
  box-shadow: var(--shadow-primary-hover);
}

/* 購買提示彈窗樣式 */
.appearance__purchase-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.appearance__purchase-subtitle {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: 14px;
  color: var(--text-dialog);
  letter-spacing: 0.04em;
}

.appearance__purchase-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-purchase);
  background: var(--bg-overlay-weak);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.appearance__purchase-option:hover {
  background: var(--bg-overlay-hover-strong);
  border-color: var(--border-ghost-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.appearance__purchase-option-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.appearance__purchase-option-content {
  flex: 1;
}

.appearance__purchase-option-content h3 {
  margin: 0 0 var(--spacing-xs) 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-white);
  letter-spacing: 0.04em;
}

.appearance__purchase-option-content p {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.4;
}
</style>
