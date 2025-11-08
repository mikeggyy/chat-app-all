<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <h2>管理後臺登入</h2>
          <p>Admin Dashboard</p>
        </div>
      </template>

      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="rules"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="email">
          <el-input
            v-model="loginForm.email"
            placeholder="請輸入郵箱"
            size="large"
            clearable
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="請輸入密碼"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            @click="handleLogin"
            style="width: 100%"
          >
            登入
          </el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        style="margin-top: 20px"
        closable
        @close="error = ''"
      />

      <el-divider />

      <div class="tips">
        <el-icon><Warning /></el-icon>
        <span>僅限管理員帳號登入</span>
      </div>

      <div class="test-accounts">
        <p style="font-size: 12px; color: #909399; margin: 10px 0 5px;">測試帳號：</p>
        <p style="font-size: 12px; color: #606266; margin: 2px 0;">
          mike666@admin.com / 12345678
        </p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebase";
import { useAdminStore } from "../stores/admin";
import { ElMessage } from "element-plus";
import { User, Lock, Warning } from "@element-plus/icons-vue";

const router = useRouter();
const adminStore = useAdminStore();
const loading = ref(false);
const error = ref("");
const loginFormRef = ref(null);

const loginForm = reactive({
  email: "",
  password: "",
});

const rules = {
  email: [
    { required: true, message: "請輸入郵箱", trigger: "blur" },
    { type: "email", message: "請輸入正確的郵箱格式", trigger: "blur" },
  ],
  password: [
    { required: true, message: "請輸入密碼", trigger: "blur" },
    { min: 6, message: "密碼長度至少 6 個字符", trigger: "blur" },
  ],
};

async function handleLogin() {
  if (!loginFormRef.value) return;

  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return;

    loading.value = true;
    error.value = "";

    try {
      const result = await signInWithEmailAndPassword(
        auth,
        loginForm.email,
        loginForm.password
      );

      // 檢查是否有管理員權限
      const tokenResult = await result.user.getIdTokenResult();
      const isAdmin = !!(
        tokenResult.claims.admin ||
        tokenResult.claims.super_admin ||
        tokenResult.claims.moderator
      );

      if (!isAdmin) {
        error.value = "您沒有管理員權限，無法登入後臺";
        await adminStore.logout();
        return;
      }

      ElMessage.success("登入成功");

      // 等待 adminStore 狀態更新後再跳轉
      await new Promise((resolve) => {
        const checkAuth = setInterval(() => {
          if (adminStore.isAuthenticated) {
            clearInterval(checkAuth);
            resolve();
          }
        }, 100);

        // 超時保護，最多等待 3 秒
        setTimeout(() => {
          clearInterval(checkAuth);
          resolve();
        }, 3000);
      });

      router.push("/");
    } catch (err) {
      // 更友好的錯誤提示
      if (err.code === "auth/user-not-found") {
        error.value = "用戶不存在";
      } else if (err.code === "auth/wrong-password") {
        error.value = "密碼錯誤";
      } else if (err.code === "auth/invalid-email") {
        error.value = "郵箱格式錯誤";
      } else if (err.code === "auth/invalid-credential") {
        error.value = "帳號或密碼錯誤";
      } else {
        error.value = err.message || "登入失敗，請稍後再試";
      }
    } finally {
      loading.value = false;
    }
  });
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 400px;
  max-width: 90%;
}

.card-header {
  text-align: center;
}

.card-header h2 {
  margin: 0 0 8px;
  color: var(--text-color-primary);
}

.card-header p {
  margin: 0;
  color: var(--text-color-secondary);
  font-size: 14px;
}

.tips {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-warning);
  font-size: 14px;
}

.test-accounts {
  text-align: center;
  margin-top: 10px;
}
</style>
