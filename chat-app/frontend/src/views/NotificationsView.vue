<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import { useNotifications } from '../composables/useNotifications';

interface Notification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

const router = useRouter();
const { notifications } = useNotifications();

const handleBack = (): void => {
  router.back();
};

const formatTimestamp = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (hours < 1) {
    return '剛剛';
  } else if (hours < 24) {
    return `${hours}小時前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString('zh-TW', {
      month: '2-digit',
      day: '2-digit'
    });
  }
};

const handleNotificationClick = (notification: Notification): void => {
  if (!notification || !notification.id) {
    return;
  }

  // 導航到通知詳細頁面
  router.push({
    name: 'notification-detail',
    params: { id: notification.id }
  });
};
</script>

<template>
  <main class="notifications-view">
    <header class="notifications-header">
      <button
        type="button"
        class="back-button"
        aria-label="返回"
        @click="handleBack"
      >
        <ChevronLeftIcon class="icon" aria-hidden="true" />
      </button>
      <h1>通知</h1>
      <div class="header-spacer"></div>
    </header>

    <section class="notifications-content">
      <ul class="notifications-list">
        <li
          v-for="notification in notifications"
          :key="notification.id"
          class="notification-item"
          :class="{ 'notification-item--unread': !notification.isRead }"
          @click="handleNotificationClick(notification)"
        >
          <div class="notification-body">
            <div class="notification-header">
              <h2 class="notification-title">{{ notification.title }}</h2>
              <span v-if="!notification.isRead" class="notification-badge"></span>
            </div>
            <p class="notification-message">{{ notification.message }}</p>
            <span class="notification-timestamp">{{ formatTimestamp(notification.timestamp) }}</span>
          </div>
          <ChevronRightIcon class="notification-arrow" aria-hidden="true" />
        </li>
      </ul>

      <div v-if="notifications.length === 0" class="empty-state">
        <p>目前沒有通知</p>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.notifications-view {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  background: #0f1016;
  color: #f8f9ff;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(var(--bottom-nav-offset, 90px) + 1.5rem);
}

.notifications-header {
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

.notifications-content {
  flex: 1;
  padding: 1.5rem 1.25rem;
}

.notifications-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notification-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-radius: 20px;
  background: linear-gradient(150deg, rgba(30, 31, 38, 0.95), rgba(20, 21, 28, 0.98));
  border: 1px solid rgba(148, 163, 184, 0.15);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
    background: linear-gradient(150deg, rgba(35, 36, 43, 0.95), rgba(25, 26, 33, 0.98));
  }

  &--unread {
    border-color: rgba(255, 77, 143, 0.3);
    box-shadow: 0 8px 24px rgba(255, 77, 143, 0.15);
  }
}

.notification-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.notification-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.notification-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(248, 249, 255, 0.95);
}

.notification-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  box-shadow: 0 0 8px rgba(255, 77, 143, 0.6);
}

.notification-message {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.6;
  color: rgba(203, 213, 225, 0.85);
  letter-spacing: 0.03em;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-timestamp {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.7);
  letter-spacing: 0.05em;
}

.notification-arrow {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  color: rgba(148, 163, 184, 0.6);
  transition: transform 150ms ease, color 150ms ease;
}

.notification-item:hover .notification-arrow {
  transform: translateX(3px);
  color: rgba(148, 163, 184, 0.9);
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;

  p {
    margin: 0;
    font-size: 0.95rem;
    color: rgba(148, 163, 184, 0.7);
    letter-spacing: 0.05em;
  }
}

@media (max-width: 560px) {
  .notifications-header {
    padding: 1rem 1.25rem;

    h1 {
      font-size: 1.1rem;
    }
  }

  .notifications-content {
    padding: 1rem;
  }

  .notification-item {
    padding: 1rem 1.25rem;
  }

  .notification-message {
    font-size: 0.85rem;
  }
}
</style>
