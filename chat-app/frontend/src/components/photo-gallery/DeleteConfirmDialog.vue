<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="confirm-backdrop"
      @click.self="$emit('cancel')"
    >
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <h2>確認刪除</h2>
        <p>確定要刪除這 {{ selectedCount }} 張照片嗎？此操作無法復原。</p>
        <div class="confirm-actions">
          <button
            type="button"
            class="confirm-btn confirm-btn--cancel"
            @click="$emit('cancel')"
          >
            取消
          </button>
          <button
            type="button"
            class="confirm-btn confirm-btn--delete"
            @click="$emit('confirm')"
            :disabled="isDeleting"
          >
            {{ isDeleting ? "刪除中..." : "確認刪除" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// Types

defineProps({
  isVisible: {
    type: Boolean,
    default: false,
  },
  selectedCount: {
    type: Number,
    default: 0,
  },
  isDeleting: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['cancel', 'confirm']);
</script>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  padding: 1rem;
}

.confirm-dialog {
  width: 100%;
  max-width: 400px;
  padding: 1.5rem;
  border-radius: 20px;
  background: linear-gradient(135deg, #2a1a3a 0%, #1a0a2a 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.confirm-dialog h2 {
  margin: 0 0 1rem;
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
}

.confirm-dialog p {
  margin: 0 0 1.5rem;
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(250, 241, 255, 0.85);
  text-align: center;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
}

.confirm-btn {
  flex: 1;
  padding: 0.875rem;
  border-radius: 12px;
  border: none;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.confirm-btn--cancel {
  background: rgba(255, 255, 255, 0.12);
  color: #fbf5ff;
}

.confirm-btn--cancel:hover {
  background: rgba(255, 255, 255, 0.18);
}

.confirm-btn--delete {
  background: linear-gradient(135deg, #ff4d8f 0%, #ff1744 100%);
  color: #ffffff;
}

.confirm-btn--delete:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(255, 77, 143, 0.4);
}

.confirm-btn--delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>
