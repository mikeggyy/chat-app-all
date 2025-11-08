<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import GlobalLoadingOverlay from "./components/GlobalLoadingOverlay.vue";
import BottomNavBar from "./components/BottomNavBar.vue";
import ToastContainer from "./components/ToastContainer.vue";

const route = useRoute();
const showBottomNav = computed(() => Boolean(route.meta?.showBottomNav));
</script>

<template>
  <div class="app-shell">
    <GlobalLoadingOverlay />
    <ToastContainer />
    <router-view />
    <BottomNavBar v-if="showBottomNav" />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100%;
  height: 100%;
  position: relative;
}
</style>
