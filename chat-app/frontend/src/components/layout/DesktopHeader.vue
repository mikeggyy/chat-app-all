<script setup lang="ts">
import { computed, type Component } from "vue";
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router";
import {
  HomeIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  UserIcon,
  BellIcon,
} from "@heroicons/vue/24/outline";
import { useUserProfile } from "@/composables/useUserProfile";

/**
 * 桌面版頂部導航組件
 */

interface NavItem {
  key: string;
  label: string;
  to: RouteLocationRaw;
  icon: Component;
}

const router = useRouter();
const route = useRoute();
const { user } = useUserProfile();

// 導航項目（與 BottomNavBar 保持一致）
const navItems: NavItem[] = [
  {
    key: "match",
    label: "配對",
    to: { name: "match" },
    icon: HomeIcon,
  },
  {
    key: "search",
    label: "探索",
    to: { name: "search" },
    icon: MagnifyingGlassIcon,
  },
  {
    key: "workspace",
    label: "創作",
    to: { name: "character-create-gender" },
    icon: SparklesIcon,
  },
  {
    key: "messages",
    label: "訊息",
    to: { name: "chat-list" },
    icon: ChatBubbleOvalLeftEllipsisIcon,
  },
  {
    key: "profile",
    label: "個人中心",
    to: { name: "profile" },
    icon: UserIcon,
  },
];

// 檢查導航項是否活躍
const isActive = (item: NavItem): boolean => {
  if (!item || !item.to) return false;
  const routeTo = item.to as { name?: string; path?: string };

  // 特殊處理：聊天頁面
  if (routeTo.name === "chat-list") {
    return route.name === "chat-list" || route.name === "chat";
  }

  if (routeTo.name && routeTo.name === route.name) return true;
  if (routeTo.path && routeTo.path === route.path) return true;
  return false;
};

// 導航處理
const handleNavClick = (item: NavItem): void => {
  if (isActive(item)) return;
  router.push(item.to);
};

// 通知按鈕
const handleNotificationClick = (): void => {
  router.push({ name: "notifications" });
};

// 用戶頭像
const userAvatar = computed(() => {
  return user.value?.photoURL || "/default-avatar.png";
});

// 用戶名稱
const userName = computed(() => {
  return user.value?.displayName || "用戶";
});
</script>

<template>
  <header class="desktop-header">
    <!-- Logo -->
    <div class="desktop-header__logo">AI Chat</div>

    <!-- 主導航 -->
    <nav class="desktop-header__nav" role="navigation" aria-label="主選單">
      <button
        v-for="item in navItems"
        :key="item.key"
        type="button"
        class="desktop-header__nav-item"
        :class="{ active: isActive(item) }"
        :aria-current="isActive(item) ? 'page' : undefined"
        @click="handleNavClick(item)"
      >
        <component
          :is="item.icon"
          class="desktop-header__nav-icon"
          aria-hidden="true"
        />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <!-- 右側操作區 -->
    <div class="desktop-header__actions">
      <!-- 通知按鈕 -->
      <button
        type="button"
        class="desktop-header__action-btn"
        aria-label="通知"
        @click="handleNotificationClick"
      >
        <BellIcon class="icon" />
      </button>

      <!-- 用戶頭像 -->
      <button
        type="button"
        class="desktop-header__user-btn"
        :aria-label="`${userName} 的個人資料`"
        @click="router.push({ name: 'profile' })"
      >
        <img
          :src="userAvatar"
          :alt="userName"
          class="desktop-header__user-avatar"
        />
      </button>
    </div>
  </header>
</template>

<style scoped lang="scss">
.desktop-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--desktop-header-height, 64px);
  background: rgba(15, 17, 24, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  z-index: 1000;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 1rem;
}

.desktop-header__logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f8fafc;
  margin-right: 1.5rem;
  flex-shrink: 0;

  // Logo 漸變效果
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.desktop-header__nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
}

.desktop-header__nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    color: #e2e8f0;
    background: rgba(148, 163, 184, 0.1);
  }

  &.active {
    color: #fff;
    background: linear-gradient(
      135deg,
      rgba(102, 126, 234, 0.2),
      rgba(118, 75, 162, 0.2)
    );

    .desktop-header__nav-icon {
      color: #a78bfa;
    }
  }
}

.desktop-header__nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.desktop-header__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  flex-shrink: 0;
}

.desktop-header__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: #94a3b8;
  transition: all 0.2s ease;

  &:hover {
    color: #e2e8f0;
    background: rgba(148, 163, 184, 0.1);
  }

  .icon {
    width: 22px;
    height: 22px;
  }
}

.desktop-header__user-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  transition: all 0.2s ease;
  border: 2px solid transparent;

  &:hover {
    border-color: rgba(148, 163, 184, 0.3);
  }
}

.desktop-header__user-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
