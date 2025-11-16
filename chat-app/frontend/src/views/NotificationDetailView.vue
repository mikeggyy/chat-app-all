<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  ChevronLeftIcon,
  BellIcon,
  ClockIcon,
} from "@heroicons/vue/24/outline";
import { useNotifications } from "../composables/useNotifications";

interface NotificationAction {
  label: string;
  type: 'primary' | 'secondary';
}

interface NotificationDetail {
  id: string;
  category: string;
  title: string;
  timestamp: string;
  fullContent: string;
  isRead: boolean;
  actions?: NotificationAction[];
}

const router = useRouter();
const route = useRoute();
const { getNotificationById, markAsRead } = useNotifications();

const notification = ref<NotificationDetail | null>(null);
const isLoading = ref<boolean>(true);

const notificationId = computed(() => route.params.id as string);

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (hours < 1) {
    return "剛剛";
  } else if (hours < 24) {
    return `${hours}小時前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
};

const handleBack = (): void => {
  router.back();
};

const handleAction = (action: NotificationAction): void => {
  // 根據不同的操作類型執行相應的邏輯
  if (action.label === "查看角色" || action.label === "查看訊息") {
    // 可以導航到相應頁面
  } else if (action.label === "立即體驗") {
    router.push({ name: "character-create-gender" });
  }
};

const loadNotification = (): void => {
  isLoading.value = true;

  // 模擬 API 請求
  setTimeout(() => {
    const id = notificationId.value;
    notification.value = getNotificationById(id) as NotificationDetail | null;
    isLoading.value = false;

    // 標記為已讀
    if (notification.value && !notification.value.isRead) {
      markAsRead(id);
    }
  }, 300);
};

onMounted(() => {
  loadNotification();
});
</script>

<template>
  <main class="notification-detail-view">
    <header class="notification-detail-header">
      <button
        type="button"
        class="back-button"
        aria-label="返回通知列表"
        @click="handleBack"
      >
        <ChevronLeftIcon class="icon" aria-hidden="true" />
      </button>
      <h1>通知詳情</h1>
      <div class="header-spacer"></div>
    </header>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner" role="status" aria-label="載入中"></div>
      <p>載入中...</p>
    </div>

    <div v-else-if="!notification" class="error-state">
      <p>找不到此通知</p>
      <button type="button" class="btn-primary" @click="handleBack">
        返回通知列表
      </button>
    </div>

    <article v-else class="notification-detail-content">
      <div class="notification-detail-header-info">
        <div class="notification-icon">
          <BellIcon class="icon" aria-hidden="true" />
        </div>
        <div class="notification-meta">
          <span class="notification-category">{{ notification.category }}</span>
          <div class="notification-time">
            <ClockIcon class="icon" aria-hidden="true" />
            <span>{{ formatDate(notification.timestamp) }}</span>
          </div>
        </div>
      </div>

      <h2 class="notification-detail-title">{{ notification.title }}</h2>

      <div class="notification-detail-body">
        <p
          v-for="(paragraph, index) in notification.fullContent.split('\n')"
          :key="index"
          class="paragraph"
        >
          {{ paragraph }}
        </p>
      </div>

      <footer
        v-if="notification.actions && notification.actions.length > 0"
        class="notification-detail-actions"
      >
        <button
          v-for="action in notification.actions"
          :key="action.label"
          type="button"
          :class="['action-button', `action-button--${action.type}`]"
          @click="handleAction(action)"
        >
          {{ action.label }}
        </button>
      </footer>
    </article>
  </main>
</template>

<style scoped lang="scss">
.notification-detail-view {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  background: #0f1016;
  color: #f8f9ff;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(var(--bottom-nav-offset, 90px) + 1.5rem);
}

.notification-detail-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  background: rgba(15, 16, 22, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);

  h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    flex: 1;
    text-align: center;
  }

  .header-spacer {
    width: 40px;
  }
}

.back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(148, 163, 184, 0.12);
  color: #f8f9ff;
  border: 1px solid rgba(148, 163, 184, 0.2);
  transition: background 150ms ease, transform 150ms ease;

  &:hover {
    background: rgba(148, 163, 184, 0.22);
    transform: translateX(-2px);
  }

  .icon {
    width: 22px;
    height: 22px;
  }
}

.loading-state,
.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 3rem 1.5rem;

  p {
    margin: 0;
    font-size: 0.95rem;
    color: rgba(148, 163, 184, 0.8);
    letter-spacing: 0.05em;
  }
}

.spinner {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 3px solid rgba(148, 163, 184, 0.2);
  border-top-color: #ff4d8f;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  box-shadow: 0 12px 25px rgba(255, 77, 143, 0.35);
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 32px rgba(255, 77, 143, 0.45);
  }
}

.notification-detail-content {
  flex: 1;
  padding: 2rem 1.5rem;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  overflow-y: auto;
  max-height: calc(98dvh - 73px);
}

.notification-detail-header-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.notification-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(
    135deg,
    rgba(255, 77, 143, 0.2),
    rgba(255, 122, 184, 0.15)
  );
  border: 1px solid rgba(255, 77, 143, 0.3);
  flex-shrink: 0;

  .icon {
    width: 28px;
    height: 28px;
    color: #ff7ab8;
  }
}

.notification-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.notification-category {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
  border: 1px solid rgba(148, 163, 184, 0.25);
  color: rgba(203, 213, 225, 0.9);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  align-self: flex-start;
}

.notification-time {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(148, 163, 184, 0.8);
  font-size: 0.85rem;
  letter-spacing: 0.03em;

  .icon {
    width: 16px;
    height: 16px;
  }
}

.notification-detail-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  line-height: 1.4;
  color: rgba(248, 249, 255, 0.98);
}

.notification-detail-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .paragraph {
    margin: 0;
    font-size: 1rem;
    line-height: 1.75;
    color: rgba(203, 213, 225, 0.9);
    letter-spacing: 0.03em;

    &:empty {
      height: 0.5rem;
    }
  }
}

.notification-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}

.action-button {
  padding: 0.85rem 1.75rem;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;

  &--primary {
    border: none;
    background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
    color: #fff;
    box-shadow: 0 12px 25px rgba(255, 77, 143, 0.35);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 32px rgba(255, 77, 143, 0.45);
    }
  }

  &--secondary {
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: rgba(15, 17, 28, 0.85);
    color: rgba(226, 232, 240, 0.92);
    box-shadow: 0 8px 20px rgba(15, 17, 28, 0.3);

    &:hover {
      background: rgba(148, 163, 184, 0.22);
      border-color: rgba(148, 163, 184, 0.55);
      box-shadow: 0 12px 24px rgba(15, 17, 28, 0.4);
    }
  }
}

@media (max-width: 560px) {
  .notification-detail-header {
    padding: 1rem 1.25rem;

    h1 {
      font-size: 1.1rem;
    }
  }

  .notification-detail-content {
    padding: 1.5rem 1.25rem;
    gap: 1.5rem;
  }

  .notification-detail-title {
    font-size: 1.4rem;
  }

  .notification-detail-body .paragraph {
    font-size: 0.95rem;
  }

  .notification-detail-actions {
    flex-direction: column;
  }

  .action-button {
    width: 100%;
    text-align: center;
  }
}
</style>
