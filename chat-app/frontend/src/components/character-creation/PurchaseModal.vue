<script setup lang="ts">
// Types
interface Props {
  show?: boolean;
  type?: "confirm" | "purchase";
  confirmMessage?: string;
}

interface Emits {
  (e: "close"): void;
  (e: "confirm"): void;
  (e: "go-to-shop"): void;
  (e: "go-to-vip"): void;
}

withDefaults(defineProps<Props>(), {
  show: false,
  type: "confirm",
  confirmMessage: "",
});

const emit = defineEmits<Emits>();

const handleClose = (): void => {
  emit("close");
};

const handleConfirm = (): void => {
  emit("confirm");
};

const handleGoToShop = (): void => {
  emit("go-to-shop");
};

const handleGoToVIP = (): void => {
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
  z-index: 1620;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  padding-bottom: calc(24px + 80px);
  overflow-y: auto;
}

.appearance__confirm-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
}

.appearance__confirm-panel {
  position: relative;
  width: min(420px, 100%);
  max-height: calc(100vh - 160px);
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: linear-gradient(
    180deg,
    rgba(30, 30, 30, 0.98),
    rgba(20, 20, 20, 0.98)
  );
  padding: 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5),
              0 0 0 1px rgba(255, 255, 255, 0.1) inset;
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
  color: #ffffff;
}

.appearance__confirm-header p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.85);
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
  color: rgba(255, 255, 255, 0.5);
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.appearance__confirm-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.appearance__confirm-actions {
  display: flex;
  gap: 12px;
}

.appearance__confirm-action {
  flex: 1;
  border-radius: 999px;
  padding: 12px 20px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.06em;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
}

.appearance__confirm-action:hover {
  transform: translateY(-1px);
}

.appearance__confirm-action--ghost {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.appearance__confirm-action--ghost:hover {
  background: rgba(255, 255, 255, 0.12);
}

.appearance__confirm-action--primary {
  background: linear-gradient(90deg, #ff2f92 0%, #ff5abc 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(255, 47, 146, 0.3);
}

.appearance__confirm-action--primary:hover {
  box-shadow: 0 6px 16px rgba(255, 47, 146, 0.4);
}

/* 購買提示彈窗樣式 */
.appearance__purchase-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.appearance__purchase-subtitle {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.04em;
}

.appearance__purchase-option {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.appearance__purchase-option:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.appearance__purchase-option-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.appearance__purchase-option-content {
  flex: 1;
}

.appearance__purchase-option-content h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.04em;
}

.appearance__purchase-option-content p {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}
</style>
