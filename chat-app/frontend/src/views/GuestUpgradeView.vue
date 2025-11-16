<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useFirebaseAuth } from '../composables/useFirebaseAuth';
import { useUserProfile } from '../composables/useUserProfile';
import { useGuestGuard } from '../composables/useGuestGuard';
import { clearTestSession } from '../services/testAuthSession';

const router = useRouter();
const route = useRoute();
const { signInWithGoogle } = useFirebaseAuth();
const { setUserProfile } = useUserProfile();
const { resetGuestMessageCount } = useGuestGuard();

// 從 query 參數獲取功能名稱
const featureName = (route.query.feature as string) || '完整功能';

const handleGoogleLogin = async (): Promise<void> => {
  try {
    const { profile } = await signInWithGoogle();

    // 清除測試 session 和遊客計數
    clearTestSession();
    resetGuestMessageCount();

    // 設定用戶資料
    setUserProfile(profile);

    // 導向首頁
    router.push({ name: 'match' });
  } catch (error) {
    // 錯誤已在 composable 中處理
  }
};

const goBack = (): void => {
  // 導向安全的頁面（避免回到受限頁面造成循環）
  router.push({ name: 'match' });
};

onMounted(() => {
  // 頁面載入動畫
  const container = document.querySelector('.guest-upgrade');
  if (container) {
    container.classList.add('loaded');
  }
});
</script>

<template>
  <div class="guest-upgrade">
    <div class="guest-upgrade__content">
      <div class="guest-upgrade__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>

      <h1 class="guest-upgrade__title">升級為正式會員</h1>

      <p class="guest-upgrade__subtitle">
        使用 <strong>{{ featureName }}</strong> 需要正式登入
      </p>

      <div class="guest-upgrade__features">
        <h2>會員專屬功能</h2>
        <ul>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>無限次數與角色聊天</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>創建專屬 AI 角色</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>收藏喜愛的角色</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>編輯個人資料與頭像</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>購買金幣與升級會員</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>雲端同步聊天紀錄</span>
          </li>
        </ul>
      </div>

      <button
        type="button"
        class="guest-upgrade__login-btn"
        @click="handleGoogleLogin"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span>使用 Google 帳號登入</span>
      </button>

      <button
        type="button"
        class="guest-upgrade__back-btn"
        @click="goBack"
      >
        稍後再說
      </button>

      <p class="guest-upgrade__note">
        登入即代表同意我們的使用者協議與隱私權政策
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.guest-upgrade {
  min-height: 100vh;
  min-height: 100dvh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  background: linear-gradient(
    135deg,
    #667eea 0%,
    #764ba2 50%,
    #f093fb 100%
  );
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.08) 0%, transparent 50%);
    animation: gradient-shift 15s ease infinite;
  }

  opacity: 0;
  transition: opacity 0.6s ease;

  &.loaded {
    opacity: 1;
  }
}

@keyframes gradient-shift {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(20px, 20px) scale(1.05);
  }
}

.guest-upgrade__content {
  max-width: 480px;
  width: 100%;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 28px;
  padding: 2.5rem 2rem;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 1;
  animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.guest-upgrade__icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 24px rgba(102, 126, 234, 0.4);

  svg {
    width: 40px;
    height: 40px;
    color: #fff;
  }
}

.guest-upgrade__title {
  margin: 0 0 0.75rem;
  font-size: 1.75rem;
  font-weight: 700;
  text-align: center;
  color: #1e293b;
  letter-spacing: 0.02em;
}

.guest-upgrade__subtitle {
  margin: 0 0 2rem;
  font-size: 1rem;
  text-align: center;
  color: #64748b;
  line-height: 1.6;

  strong {
    color: #667eea;
    font-weight: 600;
  }
}

.guest-upgrade__features {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border-radius: 20px;
  border: 1px solid #e2e8f0;

  h2 {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: #475569;
    text-align: center;
    letter-spacing: 0.05em;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.92rem;
    color: #334155;
    line-height: 1.5;

    svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      color: #10b981;
      stroke-width: 3;
    }

    span {
      flex: 1;
    }
  }
}

.guest-upgrade__login-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(102, 126, 234, 0.5);
  }

  &:active {
    transform: translateY(0);
  }

  svg {
    width: 20px;
    height: 20px;
  }
}

.guest-upgrade__back-btn {
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.85rem 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #475569;
  }
}

.guest-upgrade__note {
  margin: 1.5rem 0 0;
  font-size: 0.8rem;
  text-align: center;
  color: #94a3b8;
  line-height: 1.5;
}

@media (max-width: 540px) {
  .guest-upgrade {
    padding: 1.5rem 1rem;
  }

  .guest-upgrade__content {
    padding: 2rem 1.5rem;
  }

  .guest-upgrade__title {
    font-size: 1.5rem;
  }

  .guest-upgrade__icon {
    width: 70px;
    height: 70px;

    svg {
      width: 35px;
      height: 35px;
    }
  }

  .guest-upgrade__features {
    padding: 1.25rem;

    li {
      font-size: 0.88rem;
    }
  }
}
</style>
