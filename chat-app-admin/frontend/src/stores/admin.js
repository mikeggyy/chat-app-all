import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { auth } from "../utils/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export const useAdminStore = defineStore("admin", () => {
  const user = ref(null);
  const token = ref(null);
  const isAdmin = ref(false);
  const loading = ref(true);

  const isAuthenticated = computed(() => !!user.value && isAdmin.value);

  // 初始化認證狀態
  function initializeAuth() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        user.value = firebaseUser;
        token.value = await firebaseUser.getIdToken();

        // 檢查用戶是否有管理員權限
        const tokenResult = await firebaseUser.getIdTokenResult();
        isAdmin.value = !!(
          tokenResult.claims.admin ||
          tokenResult.claims.super_admin ||
          tokenResult.claims.moderator
        );
      } else {
        user.value = null;
        token.value = null;
        isAdmin.value = false;
      }
      loading.value = false;
    });
  }

  // 登出
  async function logout() {
    try {
      await signOut(auth);
      user.value = null;
      token.value = null;
      isAdmin.value = false;
    } catch (error) {
      throw error;
    }
  }

  // 刷新 token
  async function refreshToken() {
    if (user.value) {
      token.value = await user.value.getIdToken(true);
    }
  }

  return {
    user,
    token,
    isAdmin,
    loading,
    isAuthenticated,
    initializeAuth,
    logout,
    refreshToken,
  };
});
