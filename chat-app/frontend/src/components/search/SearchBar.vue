<script setup>
import { ref } from "vue";
import { MagnifyingGlassIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue", "submit"]);

const searchInputRef = ref(null);

const handleInput = (event) => {
  emit("update:modelValue", event.target.value);
};

const handleSubmit = () => {
  emit("submit");
};

defineExpose({
  focus: () => searchInputRef.value?.focus(),
});
</script>

<template>
  <form class="search-bar" role="search" @submit.prevent="handleSubmit">
    <label class="sr-only" for="discover-search">搜尋探索角色</label>
    <input
      id="discover-search"
      :value="modelValue"
      type="search"
      name="search"
      autocomplete="off"
      placeholder="可搜尋名稱/特質/ID"
      class="search-input"
      ref="searchInputRef"
      @input="handleInput"
    />
    <button type="submit" class="search-submit" aria-label="開始搜尋">
      <MagnifyingGlassIcon aria-hidden="true" />
    </button>
  </form>
</template>

<style scoped lang="scss">
.search-bar {
  position: relative;
  margin-top: clamp(1rem, 3vw, 1.4rem);
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.8);
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 0.1rem 0.1rem 0.1rem 1rem;
  box-shadow: 0 14px 28px rgba(2, 6, 23, 0.45);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.search-bar:focus-within {
  border-color: rgba(236, 72, 153, 0.55);
  box-shadow: 0 18px 32px rgba(236, 72, 153, 0.22);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: #f8fafc;
  font-size: 0.95rem;
  padding: 0.75rem 0.5rem 0.75rem 0;
  font-family: inherit;
}

.search-input::placeholder {
  color: rgba(148, 163, 184, 0.65);
}

.search-input:focus {
  outline: none;
}

.search-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: none;
  background: rgba(30, 64, 175, 0.65);
  color: rgba(248, 250, 252, 0.9);
  transition: background 160ms ease, transform 160ms ease;
}

.search-submit:hover {
  background: rgba(59, 130, 246, 0.7);
  transform: translateY(-1px);
}

.search-submit svg {
  width: 20px;
  height: 20px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  border: 0;
  white-space: nowrap;
}
</style>
