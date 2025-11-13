<template>
  <section class="membership-hero">
    <header class="membership-header" aria-label="會員導覽">
      <button
        type="button"
        class="membership-header__button"
        aria-label="返回上一頁"
        @click="$emit('back')"
      >
        <ArrowLeftIcon class="icon" aria-hidden="true" />
      </button>
      <h1 class="membership-header__title">會員中心</h1>
      <span class="membership-header__placeholder" aria-hidden="true" />
    </header>

    <div class="membership-hero__content">
      <h2 class="membership-hero__headline">解鎖專屬體驗</h2>
      <p class="membership-hero__subtitle">
        選擇最適合的升級方案，享受更豐富的 AI 互動體驗
      </p>
    </div>
  </section>
</template>

<script setup>
import { ArrowLeftIcon } from '@heroicons/vue/24/outline';

/**
 * MembershipHero - 會員頁面頭部組件
 * 職責：顯示頁面標題、返回按鈕和宣傳文案
 */

// Emits
defineEmits(['back']);
</script>

<style scoped>
.membership-hero {
  padding: 1rem 1.25rem 2rem;
  background: linear-gradient(
    180deg,
    rgba(30, 41, 82, 0.95) 0%,
    rgba(13, 17, 35, 0.85) 100%
  );
  border-bottom-left-radius: 32px;
  border-bottom-right-radius: 32px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.membership-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.membership-header__title {
  margin: 0;
  font-size: clamp(1.25rem, 4vw, 1.5rem);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.membership-header__button {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 20, 40, 0.6);
  color: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
}

.membership-header__button:hover {
  transform: translateY(-2px);
  background: rgba(59, 130, 246, 0.2);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
}

.membership-header__button .icon {
  width: 20px;
  height: 20px;
}

.membership-header__placeholder {
  width: 40px;
  height: 40px;
}

.membership-hero__content {
  text-align: center;
}

.membership-hero__headline {
  margin: 0 0 0.5rem;
  font-size: clamp(1.75rem, 5vw, 2.25rem);
  font-weight: 700;
  background: linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.02em;
}

.membership-hero__subtitle {
  margin: 0;
  color: rgba(217, 226, 255, 0.8);
  font-size: 0.95rem;
  line-height: 1.6;
  letter-spacing: 0.03em;
}

/* 響應式設計 */
@media (max-width: 640px) {
  .membership-hero {
    padding: 1rem 1rem 1.5rem;
  }
}
</style>
