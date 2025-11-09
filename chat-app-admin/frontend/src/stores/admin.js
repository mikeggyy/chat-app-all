import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { auth } from "../utils/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export const useAdminStore = defineStore("admin", () => {
  const user = ref(null);
  const token = ref(null);
  const isAdmin = ref(false);
  const userRole = ref(null); // 儲存具體的權限等級：'super_admin', 'admin', 'moderator'
  const loading = ref(true);

  const isAuthenticated = computed(() => !!user.value && isAdmin.value);
  const isSuperAdmin = computed(() => userRole.value === "super_admin");

  // 初始化認證狀態
  function initializeAuth() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        user.value = firebaseUser;
        token.value = await firebaseUser.getIdToken();

        // 檢查用戶是否有管理員權限
        const tokenResult = await firebaseUser.getIdTokenResult();
        const claims = tokenResult.claims;

        // 判斷具體的權限等級（優先級：super_admin > admin > moderator）
        if (claims.super_admin) {
          userRole.value = "super_admin";
          isAdmin.value = true;
        } else if (claims.admin) {
          userRole.value = "admin";
          isAdmin.value = true;
        } else if (claims.moderator) {
          userRole.value = "moderator";
          isAdmin.value = true;
        } else {
          userRole.value = null;
          isAdmin.value = false;
        }
      } else {
        user.value = null;
        token.value = null;
        isAdmin.value = false;
        userRole.value = null;
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
      userRole.value = null;
    } catch (error) {
      throw error;
    }
  }

  // 刷新 token
  async function refreshToken() {
    if (user.value) {
      token.value = await user.value.getIdToken(true);

      // 重新獲取權限
      const tokenResult = await user.value.getIdTokenResult(true);
      const claims = tokenResult.claims;

      if (claims.super_admin) {
        userRole.value = "super_admin";
        isAdmin.value = true;
      } else if (claims.admin) {
        userRole.value = "admin";
        isAdmin.value = true;
      } else if (claims.moderator) {
        userRole.value = "moderator";
        isAdmin.value = true;
      } else {
        userRole.value = null;
        isAdmin.value = false;
      }
    }
  }

  return {
    user,
    token,
    isAdmin,
    userRole,
    isSuperAdmin,
    loading,
    isAuthenticated,
    initializeAuth,
    logout,
    refreshToken,
  };
});
