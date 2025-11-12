<script setup>
const props = defineProps({
  selectedGender: {
    type: String,
    default: "all",
  },
  genderOptions: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(["update:selectedGender"]);

const updateGender = (event) => {
  emit("update:selectedGender", event.target.value);
};
</script>

<template>
  <section class="voice__filters" aria-label="聲線篩選">
    <label class="voice__filter">
      <span>聲線性別</span>
      <select :value="selectedGender" @change="updateGender">
        <option
          v-for="option in genderOptions"
          :key="option.id"
          :value="option.id"
        >
          {{ option.label }}
        </option>
      </select>
    </label>
  </section>
</template>

<style scoped>
.voice__filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.voice__filter {
  flex: 0 1 240px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.82);
}

.voice__filter span {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.voice__filter select {
  appearance: none;
  background-color: rgba(12, 12, 16, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  padding: 10px 38px 10px 14px;
  color: #ffffff;
  font-weight: 600;
  line-height: 1.2;
  transition: border-color 0.2s ease, box-shadow 0.2s ease,
    background-color 0.2s ease;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='white' d='M1 0l4 4 4-4 1 1-5 5-5-5z'/%3E%3C/svg%3E"),
    linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0));
  background-repeat: no-repeat;
  background-position: right 14px center, 0 0;
  background-size: 12px 8px, 100% 100%;
}

.voice__filter select:hover {
  border-color: rgba(255, 255, 255, 0.32);
  background-color: rgba(16, 16, 24, 0.72);
}

.voice__filter select:focus {
  outline: none;
  border-color: #ff7ac2;
  box-shadow: 0 0 0 3px rgba(255, 122, 194, 0.28);
  background-color: rgba(18, 18, 28, 0.82);
}
</style>
