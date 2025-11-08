<template>
  <el-container class="layout-container">
    <!-- 側邊欄 -->
    <el-aside :width="isCollapse ? '64px' : '200px'" class="sidebar">
      <div class="logo" :class="{ collapsed: isCollapse }">
        <el-icon><TrendCharts /></el-icon>
        <span v-if="!isCollapse">管理後臺</span>
      </div>

      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        :collapse-transition="false"
        router
      >
        <el-menu-item
          v-for="route in menuRoutes"
          :key="route.path"
          :index="route.path"
        >
          <el-icon>
            <component :is="route.meta.icon" />
          </el-icon>
          <template #title>{{ route.meta.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 主體區域 -->
    <el-container>
      <!-- 頂部欄 -->
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-icon" @click="toggleCollapse">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
        </div>

        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" :src="adminStore.user?.photoURL">
                {{ adminStore.user?.displayName?.[0] || "A" }}
              </el-avatar>
              <span class="username">{{ adminStore.user?.displayName }}</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  登出
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 內容區域 -->
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAdminStore } from "../stores/admin";
import { ElMessage, ElMessageBox } from "element-plus";

const router = useRouter();
const route = useRoute();
const adminStore = useAdminStore();

const isCollapse = ref(false);

const menuRoutes = computed(() => {
  return router.options.routes
    .find((r) => r.path === "/")
    ?.children?.filter((r) => r.meta?.title) || [];
});

const activeMenu = computed(() => {
  return route.path;
});

function toggleCollapse() {
  isCollapse.value = !isCollapse.value;
}

async function handleCommand(command) {
  if (command === "logout") {
    try {
      await ElMessageBox.confirm("確定要登出嗎？", "提示", {
        confirmButtonText: "確定",
        cancelButtonText: "取消",
        type: "warning",
      });

      await adminStore.logout();
      ElMessage.success("已登出");
      router.push("/login");
    } catch (err) {
      // 用戶取消或其他錯誤
    }
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  transition: width 0.3s;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo.collapsed {
  font-size: 24px;
}

.logo span {
  white-space: nowrap;
}

.el-menu {
  border-right: none;
  background-color: #304156;
}

/* 菜單項文字顏色 */
:deep(.el-menu-item) {
  color: #fff !important;
}

:deep(.el-menu-item:hover) {
  background-color: rgba(0, 0, 0, 0.2) !important;
  color: #fff !important;
}

:deep(.el-menu-item.is-active) {
  background-color: var(--el-color-primary) !important;
  color: #fff !important;
}

/* 菜單項圖標顏色 */
:deep(.el-menu-item .el-icon) {
  color: #fff;
}

.header {
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
}

.collapse-icon {
  font-size: 20px;
  cursor: pointer;
  color: var(--text-color-regular);
  transition: color 0.3s;
}

.collapse-icon:hover {
  color: var(--color-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.username {
  color: var(--text-color-primary);
  font-size: 14px;
}

.main-content {
  background-color: var(--bg-color);
  padding: 20px;
}
</style>
