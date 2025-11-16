<template>
  <div class="onboarding-container">
    <div class="onboarding-content">
      <div class="onboarding-header">
        <h1 class="title">歡迎使用</h1>
        <p class="subtitle">請先告訴我們一些基本資訊</p>
      </div>

      <form @submit.prevent="handleSubmit" class="onboarding-form">
        <!-- 性別選擇 -->
        <div class="form-group">
          <label class="form-label">性別</label>
          <div class="gender-options">
            <button
              type="button"
              class="gender-option"
              :class="{ active: gender === 'male' }"
              @click="gender = 'male'"
            >
              <span class="gender-icon">👨</span>
              <span class="gender-text">男性</span>
            </button>
            <button
              type="button"
              class="gender-option"
              :class="{ active: gender === 'female' }"
              @click="gender = 'female'"
            >
              <span class="gender-icon">👩</span>
              <span class="gender-text">女性</span>
            </button>
            <button
              type="button"
              class="gender-option"
              :class="{ active: gender === 'other' }"
              @click="gender = 'other'"
            >
              <span class="gender-icon">🧑</span>
              <span class="gender-text">其他</span>
            </button>
          </div>
        </div>

        <!-- 出生日期選擇 -->
        <div class="form-group">
          <label class="form-label">出生日期</label>
          <div class="date-selects">
            <select v-model.number="birthYear" class="date-select" required>
              <option value="" disabled>年</option>
              <option v-for="year in yearOptions" :key="year" :value="year">
                {{ year }}
              </option>
            </select>
            <select v-model.number="birthMonth" class="date-select" required>
              <option value="" disabled>月</option>
              <option v-for="month in monthOptions" :key="month" :value="month">
                {{ month }}
              </option>
            </select>
            <select v-model.number="birthDay" class="date-select" required>
              <option value="" disabled>日</option>
              <option v-for="day in dayOptions" :key="day" :value="day">
                {{ day }}
              </option>
            </select>
          </div>
        </div>

        <!-- 錯誤訊息 -->
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <!-- 提交按鈕 -->
        <button
          type="submit"
          class="submit-button"
          :disabled="
            isSubmitting || !gender || !birthYear || !birthMonth || !birthDay
          "
        >
          <span v-if="isSubmitting">處理中...</span>
          <span v-else>開始使用</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useUserProfile } from "../composables/useUserProfile";
import { useGlobalLoading } from "../composables/useGlobalLoading";

type Gender = 'male' | 'female' | 'other';

const router = useRouter();
const { user, updateUserProfileDetails } = useUserProfile();
const { startLoading, stopLoading } = useGlobalLoading();

const gender = ref<Gender>("male");
const birthYear = ref<number | ''>("");
const birthMonth = ref<number | ''>("");
const birthDay = ref<number | ''>("");
const errorMessage = ref<string>("");
const isSubmitting = ref<boolean>(false);

// 生成年份選項 (從今年往前推110年，到13年前)
const yearOptions = computed<number[]>(() => {
  const currentYear = new Date().getFullYear();
  const options: number[] = [];
  // 13歲到110歲
  for (let i = currentYear - 13; i >= currentYear - 110; i--) {
    options.push(i);
  }
  return options;
});

// 生成月份選項 (1-12)
const monthOptions = computed<number[]>(() => {
  const options: number[] = [];
  for (let i = 1; i <= 12; i++) {
    options.push(i);
  }
  return options;
});

// 生成日期選項 (1-31，根據選擇的月份和年份動態調整)
const dayOptions = computed<number[]>(() => {
  if (!birthYear.value || !birthMonth.value) {
    // 如果沒有選擇年月，返回1-31
    const options: number[] = [];
    for (let i = 1; i <= 31; i++) {
      options.push(i);
    }
    return options;
  }

  // 根據選擇的年月，計算該月的天數
  const daysInMonth = new Date(birthYear.value as number, birthMonth.value as number, 0).getDate();
  const options: number[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    options.push(i);
  }
  return options;
});

// 計算年齡
const calculatedAge = computed<number | null>(() => {
  if (!birthYear.value || !birthMonth.value || !birthDay.value) {
    return null;
  }

  const today = new Date();
  const birthDate = new Date(
    birthYear.value as number,
    (birthMonth.value as number) - 1,
    birthDay.value as number
  );

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  // 如果還沒到生日，年齡減1
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
});

const handleSubmit = async (): Promise<void> => {
  if (
    !gender.value ||
    !birthYear.value ||
    !birthMonth.value ||
    !birthDay.value
  ) {
    errorMessage.value = "請完整填寫性別和出生日期";
    return;
  }

  const age = calculatedAge.value;

  if (age === null || age < 13 || age > 120) {
    errorMessage.value = "年齡必須在 13 到 120 歲之間";
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = "";
  startLoading();

  try {
    const submitData = {
      gender: gender.value,
      age: age,
      hasCompletedOnboarding: true,
    };

    // 更新用戶資料
    await updateUserProfileDetails(submitData);

    // 等待 Vue 響應式更新完成
    await nextTick();

    // 驗證狀態是否正確更新
    if (user.value?.hasCompletedOnboarding !== true) {
      throw new Error("用戶狀態更新失敗，請重試");
    }

    // 使用 replace 代替 push，避免循環導航
    await router.replace({ name: "match" });
  } catch (error) {
    errorMessage.value = (error as Error).message || "更新失敗，請稍後再試";
    isSubmitting.value = false;
  } finally {
    stopLoading();
  }
};
</script>

<style scoped>
.onboarding-container {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f1016;
  position: relative;
  padding: 1.5rem;
}

.onboarding-container::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(140deg, #ff4d8f 0%, #e458b6 45%, #c567ff 100%);
  opacity: 0.08;
  pointer-events: none;
}

.onboarding-content {
  width: 100%;
  max-width: 480px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 1.5rem;
  padding: 2.5rem 2rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  position: relative;
  z-index: 1;
}

.onboarding-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  color: #f8f9ff;
  margin: 0 0 0.5rem 0;
  background: linear-gradient(135deg, #ff4d8f, #c567ff);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 1rem;
  color: rgba(248, 249, 255, 0.7);
  margin: 0;
}

.onboarding-form {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: #f8f9ff;
  letter-spacing: 0.02em;
}

.gender-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.gender-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.25rem 0.5rem;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s;
  gap: 0.5rem;
}

.gender-option:hover {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
}

.gender-option.active {
  border-color: #ff4d8f;
  background: rgba(255, 77, 143, 0.15);
  box-shadow: 0 0 20px rgba(255, 77, 143, 0.3);
}

.gender-icon {
  font-size: 2rem;
  filter: grayscale(0.3);
}

.gender-option.active .gender-icon {
  filter: grayscale(0);
}

.gender-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(248, 249, 255, 0.7);
}

.gender-option.active .gender-text {
  color: #ff4d8f;
  font-weight: 600;
}

.date-selects {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 0.75rem;
}

.date-select {
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  color: #f8f9ff;
  cursor: pointer;
  transition: all 0.2s;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23f8f9ff' d='M6 8.5L2 4.5h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
}

.date-select:focus {
  outline: none;
  border-color: #ff4d8f;
  background-color: rgba(255, 255, 255, 0.08);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23f8f9ff' d='M6 8.5L2 4.5h8z'/%3E%3C/svg%3E");
}

.date-select:hover {
  border-color: rgba(255, 255, 255, 0.3);
}

.date-select option {
  background: #1a1d2e;
  color: #f8f9ff;
}

.error-message {
  padding: 0.75rem 1rem;
  background: rgba(255, 77, 143, 0.15);
  border: 1px solid rgba(255, 77, 143, 0.3);
  border-radius: 0.5rem;
  color: #ff7ab8;
  font-size: 0.9rem;
  text-align: center;
}

.submit-button {
  width: 100%;
  padding: 1rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  border: none;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 12px 28px rgba(255, 77, 143, 0.35);
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px rgba(255, 77, 143, 0.45);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .onboarding-content {
    padding: 2rem 1.5rem;
  }

  .title {
    font-size: 1.75rem;
  }

  .gender-options {
    gap: 0.5rem;
  }

  .gender-option {
    padding: 1rem 0.25rem;
  }

  .gender-icon {
    font-size: 1.75rem;
  }

  .gender-text {
    font-size: 0.85rem;
  }

  .date-selects {
    gap: 0.5rem;
  }
}
</style>
