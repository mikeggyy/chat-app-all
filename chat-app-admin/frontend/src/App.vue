<template>
  <router-view />
</template>

<script setup>
import { onMounted } from "vue";
import { useAdminStore } from "./stores/admin";

const adminStore = useAdminStore();

onMounted(() => {
  // 初始化應用
  adminStore.initializeAuth();
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
