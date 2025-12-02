<template>
  <div class="rewards-page">
    <h2>獎勵配置</h2>

    <!-- 統計數據 -->
    <el-card class="stats-card" v-loading="statsLoading">
      <template #header>
        <span>獎勵統計</span>
        <el-button size="small" @click="loadStats" :loading="statsLoading">
          刷新
        </el-button>
      </template>
      <el-row :gutter="20">
        <el-col :span="8">
          <el-statistic title="今日領取人數" :value="stats.todayClaims" />
        </el-col>
        <el-col :span="8">
          <el-statistic title="累計參與用戶" :value="stats.totalUsers" />
        </el-col>
        <el-col :span="8">
          <el-statistic title="7天里程碑達成" :value="stats.milestoneStats?.['7days'] || 0" />
        </el-col>
      </el-row>
    </el-card>

    <!-- 每日獎勵配置 -->
    <el-card class="config-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>每日登入獎勵（7天循環）</span>
          <div>
            <el-tag v-if="isUsingDefaults.dailyRewards" type="warning" size="small">
              使用預設值
            </el-tag>
            <el-button size="small" @click="resetConfig('daily')">
              重置為預設
            </el-button>
          </div>
        </div>
      </template>
      <el-table :data="dailyRewards" border style="width: 100%">
        <el-table-column prop="day" label="第幾天" width="80" />
        <el-table-column prop="coins" label="金幣獎勵" width="150">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="dailyRewards[$index].coins"
              :min="0"
              size="small"
              @change="markDirty('daily')"
            />
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述">
          <template #default="{ row, $index }">
            <el-input
              v-model="dailyRewards[$index].description"
              size="small"
              @change="markDirty('daily')"
            />
          </template>
        </el-table-column>
        <el-table-column prop="highlight" label="高亮顯示" width="100">
          <template #default="{ row, $index }">
            <el-switch
              v-model="dailyRewards[$index].highlight"
              @change="markDirty('daily')"
            />
          </template>
        </el-table-column>
      </el-table>
      <div class="action-buttons">
        <el-button
          type="primary"
          :disabled="!isDirty.daily"
          :loading="saving.daily"
          @click="saveDailyRewards"
        >
          保存每日獎勵
        </el-button>
      </div>
    </el-card>

    <!-- 里程碑獎勵配置 -->
    <el-card class="config-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>連續登入里程碑獎勵</span>
          <div>
            <el-tag v-if="isUsingDefaults.streakMilestones" type="warning" size="small">
              使用預設值
            </el-tag>
            <el-button size="small" @click="addMilestone">
              新增里程碑
            </el-button>
            <el-button size="small" @click="resetConfig('milestones')">
              重置為預設
            </el-button>
          </div>
        </div>
      </template>
      <el-table :data="streakMilestones" border style="width: 100%">
        <el-table-column prop="days" label="天數" width="100">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="streakMilestones[$index].days"
              :min="1"
              size="small"
              @change="markDirty('milestones')"
            />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="標題" width="150">
          <template #default="{ row, $index }">
            <el-input
              v-model="streakMilestones[$index].title"
              size="small"
              @change="markDirty('milestones')"
            />
          </template>
        </el-table-column>
        <el-table-column prop="badge" label="徽章" width="80">
          <template #default="{ row, $index }">
            <el-input
              v-model="streakMilestones[$index].badge"
              size="small"
              style="width: 60px"
              @change="markDirty('milestones')"
            />
          </template>
        </el-table-column>
        <el-table-column label="獎勵內容" min-width="300">
          <template #default="{ row, $index }">
            <div class="reward-inputs">
              <span>金幣:</span>
              <el-input-number
                v-model="streakMilestones[$index].rewards.coins"
                :min="0"
                size="small"
                @change="markDirty('milestones')"
              />
              <span>照片卡:</span>
              <el-input-number
                v-model="streakMilestones[$index].rewards.photoUnlockCards"
                :min="0"
                size="small"
                @change="markDirty('milestones')"
              />
              <span>角色卡:</span>
              <el-input-number
                v-model="streakMilestones[$index].rewards.characterUnlockCards"
                :min="0"
                size="small"
                @change="markDirty('milestones')"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="isLegendary" label="傳奇" width="80">
          <template #default="{ row, $index }">
            <el-switch
              v-model="streakMilestones[$index].isLegendary"
              @change="markDirty('milestones')"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ $index }">
            <el-button
              type="danger"
              size="small"
              @click="removeMilestone($index)"
            >
              刪除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="action-buttons">
        <el-button
          type="primary"
          :disabled="!isDirty.milestones"
          :loading="saving.milestones"
          @click="saveMilestones"
        >
          保存里程碑配置
        </el-button>
      </div>
    </el-card>

    <!-- 首購優惠配置 -->
    <el-card class="config-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>首購優惠配置</span>
          <div>
            <el-tag v-if="isUsingDefaults.firstPurchaseOffer" type="warning" size="small">
              使用預設值
            </el-tag>
            <el-button size="small" @click="resetConfig('first-purchase')">
              重置為預設
            </el-button>
          </div>
        </div>
      </template>
      <el-form :model="firstPurchaseOffer" label-width="140px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="啟用狀態">
              <el-switch
                v-model="firstPurchaseOffer.enabled"
                @change="markDirty('firstPurchase')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="禮包名稱">
              <el-input
                v-model="firstPurchaseOffer.name"
                @change="markDirty('firstPurchase')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="售價 (TWD)">
              <el-input-number
                v-model="firstPurchaseOffer.price"
                :min="0"
                @change="markDirty('firstPurchase')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="原價 (TWD)">
              <el-input-number
                v-model="firstPurchaseOffer.originalPrice"
                :min="0"
                @change="markDirty('firstPurchase')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="折扣標籤">
              <el-input
                v-model="firstPurchaseOffer.discount"
                placeholder="例如: 67%"
                @change="markDirty('firstPurchase')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="有效天數">
              <el-input-number
                v-model="firstPurchaseOffer.validDays"
                :min="1"
                @change="markDirty('firstPurchase')"
              />
              <span style="margin-left: 10px; color: #909399; font-size: 12px">
                註冊後幾天內有效
              </span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="內含金幣">
              <el-input-number
                v-model="firstPurchaseOffer.contents.coins"
                :min="0"
                @change="markDirty('firstPurchase')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="照片解鎖卡">
              <el-input-number
                v-model="firstPurchaseOffer.contents.photoUnlockCards"
                :min="0"
                @change="markDirty('firstPurchase')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="角色解鎖卡">
              <el-input-number
                v-model="firstPurchaseOffer.contents.characterUnlockCards"
                :min="0"
                @change="markDirty('firstPurchase')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="徽章文字">
          <el-input
            v-model="firstPurchaseOffer.badge"
            placeholder="例如: 🎁 限時首儲"
            @change="markDirty('firstPurchase')"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="firstPurchaseOffer.description"
            type="textarea"
            :rows="2"
            @change="markDirty('firstPurchase')"
          />
        </el-form-item>
      </el-form>
      <div class="action-buttons">
        <el-button
          type="primary"
          :disabled="!isDirty.firstPurchase"
          :loading="saving.firstPurchase"
          @click="saveFirstPurchase"
        >
          保存首購優惠
        </el-button>
      </div>
    </el-card>

    <!-- 回歸用戶優惠配置 -->
    <el-card class="config-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>回歸用戶優惠配置</span>
          <div>
            <el-tag v-if="isUsingDefaults.returningUserOffer" type="warning" size="small">
              使用預設值
            </el-tag>
            <el-button size="small" @click="resetConfig('returning-user')">
              重置為預設
            </el-button>
          </div>
        </div>
      </template>
      <el-form :model="returningUserOffer" label-width="140px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="啟用狀態">
              <el-switch
                v-model="returningUserOffer.enabled"
                @change="markDirty('returningUser')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="禮包名稱">
              <el-input
                v-model="returningUserOffer.name"
                @change="markDirty('returningUser')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="售價 (TWD)">
              <el-input-number
                v-model="returningUserOffer.price"
                :min="0"
                @change="markDirty('returningUser')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="原價 (TWD)">
              <el-input-number
                v-model="returningUserOffer.originalPrice"
                :min="0"
                @change="markDirty('returningUser')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="折扣標籤">
              <el-input
                v-model="returningUserOffer.discount"
                placeholder="例如: 63%"
                @change="markDirty('returningUser')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="有效時間（小時）">
              <el-input-number
                v-model="returningUserOffer.validHours"
                :min="1"
                @change="markDirty('returningUser')"
              />
              <span style="margin-left: 10px; color: #909399; font-size: 12px">
                回歸後幾小時內有效
              </span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="不活躍天數">
              <el-input-number
                v-model="returningUserOffer.inactiveDays"
                :min="1"
                @change="markDirty('returningUser')"
              />
              <span style="margin-left: 10px; color: #909399; font-size: 12px">
                多少天未登入算回歸用戶
              </span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="6">
            <el-form-item label="內含金幣">
              <el-input-number
                v-model="returningUserOffer.contents.coins"
                :min="0"
                @change="markDirty('returningUser')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="照片解鎖卡">
              <el-input-number
                v-model="returningUserOffer.contents.photoUnlockCards"
                :min="0"
                @change="markDirty('returningUser')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="角色解鎖卡">
              <el-input-number
                v-model="returningUserOffer.contents.characterUnlockCards"
                :min="0"
                @change="markDirty('returningUser')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="影片解鎖卡">
              <el-input-number
                v-model="returningUserOffer.contents.videoUnlockCards"
                :min="0"
                @change="markDirty('returningUser')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="徽章文字">
          <el-input
            v-model="returningUserOffer.badge"
            placeholder="例如: 🎊 回歸限定"
            @change="markDirty('returningUser')"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="returningUserOffer.description"
            type="textarea"
            :rows="2"
            @change="markDirty('returningUser')"
          />
        </el-form-item>
      </el-form>
      <div class="action-buttons">
        <el-button
          type="primary"
          :disabled="!isDirty.returningUser"
          :loading="saving.returningUser"
          @click="saveReturningUser"
        >
          保存回歸用戶優惠
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import api from "../utils/api";
import { ElMessage, ElMessageBox } from "element-plus";

// 載入狀態
const loading = ref(false);
const statsLoading = ref(false);

// 數據
const dailyRewards = ref([]);
const streakMilestones = ref([]);
const firstPurchaseOffer = reactive({
  name: "",
  description: "",
  price: 0,
  originalPrice: 0,
  discount: "",
  contents: {
    coins: 0,
    photoUnlockCards: 0,
    characterUnlockCards: 0,
  },
  badge: "",
  validDays: 7,
  enabled: true,
});

const returningUserOffer = reactive({
  name: "",
  description: "",
  price: 0,
  originalPrice: 0,
  discount: "",
  contents: {
    coins: 0,
    photoUnlockCards: 0,
    characterUnlockCards: 0,
    videoUnlockCards: 0,
  },
  badge: "",
  inactiveDays: 7,
  validHours: 48,
  enabled: true,
});

// 統計數據
const stats = reactive({
  todayClaims: 0,
  totalUsers: 0,
  milestoneStats: {},
});

// 是否使用預設值
const isUsingDefaults = reactive({
  dailyRewards: false,
  streakMilestones: false,
  firstPurchaseOffer: false,
  returningUserOffer: false,
});

// 髒標記（是否有未保存的更改）
const isDirty = reactive({
  daily: false,
  milestones: false,
  firstPurchase: false,
  returningUser: false,
});

// 保存狀態
const saving = reactive({
  daily: false,
  milestones: false,
  firstPurchase: false,
  returningUser: false,
});

// 標記數據已修改
const markDirty = (type) => {
  isDirty[type] = true;
};

// 載入配置
async function loadConfig() {
  loading.value = true;
  try {
    const data = await api.get("/api/rewards/config");

    // 設置每日獎勵
    dailyRewards.value = data.dailyRewards.map((r) => ({
      ...r,
      highlight: r.highlight || false,
    }));

    // 設置里程碑
    streakMilestones.value = data.streakMilestones.map((m) => ({
      ...m,
      rewards: {
        coins: m.rewards?.coins || 0,
        photoUnlockCards: m.rewards?.photoUnlockCards || 0,
        characterUnlockCards: m.rewards?.characterUnlockCards || 0,
      },
      isLegendary: m.isLegendary || false,
    }));

    // 設置首購優惠
    Object.assign(firstPurchaseOffer, {
      name: data.firstPurchaseOffer.name || "",
      description: data.firstPurchaseOffer.description || "",
      price: data.firstPurchaseOffer.price || 0,
      originalPrice: data.firstPurchaseOffer.originalPrice || 0,
      discount: data.firstPurchaseOffer.discount || "",
      contents: {
        coins: data.firstPurchaseOffer.contents?.coins || 0,
        photoUnlockCards: data.firstPurchaseOffer.contents?.photoUnlockCards || 0,
        characterUnlockCards: data.firstPurchaseOffer.contents?.characterUnlockCards || 0,
      },
      badge: data.firstPurchaseOffer.badge || "",
      validDays: data.firstPurchaseOffer.validDays || 7,
      enabled: data.firstPurchaseOffer.enabled !== false,
    });

    // 設置回歸用戶優惠
    Object.assign(returningUserOffer, {
      name: data.returningUserOffer.name || "",
      description: data.returningUserOffer.description || "",
      price: data.returningUserOffer.price || 0,
      originalPrice: data.returningUserOffer.originalPrice || 0,
      discount: data.returningUserOffer.discount || "",
      contents: {
        coins: data.returningUserOffer.contents?.coins || 0,
        photoUnlockCards: data.returningUserOffer.contents?.photoUnlockCards || 0,
        characterUnlockCards: data.returningUserOffer.contents?.characterUnlockCards || 0,
        videoUnlockCards: data.returningUserOffer.contents?.videoUnlockCards || 0,
      },
      badge: data.returningUserOffer.badge || "",
      inactiveDays: data.returningUserOffer.inactiveDays || 7,
      validHours: data.returningUserOffer.validHours || 48,
      enabled: data.returningUserOffer.enabled !== false,
    });

    // 更新預設值狀態
    Object.assign(isUsingDefaults, data.isUsingDefaults);

    // 重置髒標記
    isDirty.daily = false;
    isDirty.milestones = false;
    isDirty.firstPurchase = false;
    isDirty.returningUser = false;
  } catch (error) {
    ElMessage.error("載入獎勵配置失敗");
    console.error(error);
  } finally {
    loading.value = false;
  }
}

// 載入統計
async function loadStats() {
  statsLoading.value = true;
  try {
    const data = await api.get("/api/rewards/stats");
    Object.assign(stats, data);
  } catch (error) {
    ElMessage.error("載入統計數據失敗");
  } finally {
    statsLoading.value = false;
  }
}

// 保存每日獎勵
async function saveDailyRewards() {
  saving.daily = true;
  try {
    await api.put("/api/rewards/config/daily", {
      rewards: dailyRewards.value,
    });
    ElMessage.success("每日獎勵配置已保存");
    isDirty.daily = false;
    isUsingDefaults.dailyRewards = false;
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "保存失敗");
  } finally {
    saving.daily = false;
  }
}

// 保存里程碑
async function saveMilestones() {
  saving.milestones = true;
  try {
    await api.put("/api/rewards/config/milestones", {
      milestones: streakMilestones.value,
    });
    ElMessage.success("里程碑配置已保存");
    isDirty.milestones = false;
    isUsingDefaults.streakMilestones = false;
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "保存失敗");
  } finally {
    saving.milestones = false;
  }
}

// 保存首購優惠
async function saveFirstPurchase() {
  saving.firstPurchase = true;
  try {
    await api.put("/api/rewards/config/first-purchase", firstPurchaseOffer);
    ElMessage.success("首購優惠配置已保存");
    isDirty.firstPurchase = false;
    isUsingDefaults.firstPurchaseOffer = false;
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "保存失敗");
  } finally {
    saving.firstPurchase = false;
  }
}

// 保存回歸用戶優惠
async function saveReturningUser() {
  saving.returningUser = true;
  try {
    await api.put("/api/rewards/config/returning-user", returningUserOffer);
    ElMessage.success("回歸用戶優惠配置已保存");
    isDirty.returningUser = false;
    isUsingDefaults.returningUserOffer = false;
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "保存失敗");
  } finally {
    saving.returningUser = false;
  }
}

// 新增里程碑
function addMilestone() {
  const lastMilestone = streakMilestones.value[streakMilestones.value.length - 1];
  const newDays = lastMilestone ? lastMilestone.days + 30 : 7;

  streakMilestones.value.push({
    days: newDays,
    title: `${newDays}天達成`,
    description: `連續登入 ${newDays} 天`,
    badge: "🎯",
    rewards: {
      coins: 0,
      photoUnlockCards: 0,
      characterUnlockCards: 0,
    },
    isLegendary: false,
  });
  markDirty("milestones");
}

// 刪除里程碑
function removeMilestone(index) {
  ElMessageBox.confirm("確定要刪除這個里程碑嗎？", "確認刪除", {
    type: "warning",
  }).then(() => {
    streakMilestones.value.splice(index, 1);
    markDirty("milestones");
  }).catch(() => {});
}

// 重置配置
async function resetConfig(type) {
  try {
    await ElMessageBox.confirm(
      "確定要重置為預設值嗎？此操作不可恢復。",
      "確認重置",
      { type: "warning" }
    );

    loading.value = true;
    await api.post("/api/rewards/config/reset", { type });
    ElMessage.success("已重置為預設值");
    await loadConfig();
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("重置失敗");
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadConfig();
  loadStats();
});
</script>

<style scoped>
.rewards-page h2 {
  margin-bottom: 20px;
}

.stats-card {
  margin-bottom: 20px;
}

.stats-card :deep(.el-card__header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header > div {
  display: flex;
  gap: 10px;
  align-items: center;
}

.action-buttons {
  margin-top: 20px;
  text-align: right;
}

.reward-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.reward-inputs span {
  color: #606266;
  font-size: 12px;
}

.reward-inputs .el-input-number {
  width: 100px;
}
</style>
