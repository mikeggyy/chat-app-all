<template>
  <div class="dashboard">
    <h2>儀表板</h2>

    <!-- 統計卡片 -->
    <el-row :gutter="20" class="stats-cards">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon class="stat-icon" :size="40" color="#409eff">
              <User />
            </el-icon>
            <div class="stat-content">
              <div class="stat-value">{{ stats.totalUsers || 0 }}</div>
              <div class="stat-label">總用戶數</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon class="stat-icon" :size="40" color="#67c23a">
              <ChatDotRound />
            </el-icon>
            <div class="stat-content">
              <div class="stat-value">{{ stats.totalConversations || 0 }}</div>
              <div class="stat-label">總對話數</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon class="stat-icon" :size="40" color="#e6a23c">
              <Avatar />
            </el-icon>
            <div class="stat-content">
              <div class="stat-value">{{ stats.activeCharacters || 0 }}</div>
              <div class="stat-label">活躍角色數</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon class="stat-icon" :size="40" color="#f56c6c">
              <Coin />
            </el-icon>
            <div class="stat-content">
              <div class="stat-value">¥{{ stats.totalRevenue || 0 }}</div>
              <div class="stat-label">總營收</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 圖表區域 -->
    <el-row :gutter="20" class="mt-20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>用戶增長趨勢</span>
          </template>
          <div v-loading="chartsLoading" style="height: 350px;">
            <v-chart
              v-if="!chartsLoading && userTrendOption"
              :option="userTrendOption"
              autoresize
              style="height: 100%;"
            />
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <span>對話活躍度</span>
          </template>
          <div v-loading="chartsLoading" style="height: 350px;">
            <v-chart
              v-if="!chartsLoading && conversationTrendOption"
              :option="conversationTrendOption"
              autoresize
              style="height: 100%;"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart, BarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from "echarts/components";
import VChart from "vue-echarts";
import api from "../utils/api";
import { ElMessage } from "element-plus";
import { User, ChatDotRound, Avatar, Coin } from "@element-plus/icons-vue";

// 註冊 ECharts 組件
use([
  CanvasRenderer,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

const stats = ref({
  totalUsers: 0,
  totalConversations: 0,
  totalRevenue: 0,
  activeCharacters: 0,
});

const userTrendData = ref({ dates: [], values: [] });
const conversationTrendData = ref({ dates: [], values: [] });
const chartsLoading = ref(false);

// 用戶增長趨勢圖表配置
const userTrendOption = computed(() => {
  if (!userTrendData.value.dates.length) return null;

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: userTrendData.value.dates.map(date => {
        // 格式化日期為 MM/DD
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }),
      axisLabel: {
        rotate: 45,
        interval: 2, // 每隔2個顯示一個標籤
      },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
    },
    series: [
      {
        name: "新增用戶",
        type: "bar",
        data: userTrendData.value.values,
        itemStyle: {
          color: "#409eff",
        },
        barMaxWidth: 30,
      },
    ],
  };
});

// 對話活躍度圖表配置
const conversationTrendOption = computed(() => {
  if (!conversationTrendData.value.dates.length) return null;

  return {
    tooltip: {
      trigger: "axis",
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: conversationTrendData.value.dates.map(date => {
        // 格式化日期為 MM/DD
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }),
      axisLabel: {
        rotate: 45,
        interval: 2, // 每隔2個顯示一個標籤
      },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
    },
    series: [
      {
        name: "活躍對話",
        type: "line",
        data: conversationTrendData.value.values,
        smooth: true,
        itemStyle: {
          color: "#67c23a",
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: "rgba(103, 194, 58, 0.3)",
              },
              {
                offset: 1,
                color: "rgba(103, 194, 58, 0.05)",
              },
            ],
          },
        },
      },
    ],
  };
});

// 載入統計數據
async function loadStats() {
  try {
    const response = await api.get("/api/dashboard/stats");
    if (response?.success) {
      stats.value = response.stats;
    }
  } catch (error) {
    console.error("載入統計數據失敗:", error);
    ElMessage.error("載入統計數據失敗");
  }
}

// 載入用戶趨勢數據
async function loadUserTrends() {
  try {
    const response = await api.get("/api/dashboard/user-trends", {
      params: { days: 30 },
    });
    if (response?.success) {
      userTrendData.value = response.trend;
    }
  } catch (error) {
    console.error("載入用戶趨勢失敗:", error);
  }
}

// 載入對話趨勢數據
async function loadConversationTrends() {
  try {
    const response = await api.get("/api/dashboard/conversation-trends", {
      params: { days: 30 },
    });
    if (response?.success) {
      conversationTrendData.value = response.trend;
    }
  } catch (error) {
    console.error("載入對話趨勢失敗:", error);
  }
}

// 載入所有圖表數據
async function loadCharts() {
  chartsLoading.value = true;
  try {
    await Promise.all([loadUserTrends(), loadConversationTrends()]);
  } finally {
    chartsLoading.value = false;
  }
}

onMounted(() => {
  loadStats();
  loadCharts();
});
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

.dashboard h2 {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
}

.stats-cards {
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
}

.stat-icon {
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.mt-20 {
  margin-top: 20px;
}

.el-card {
  border-radius: 8px;
}

:deep(.el-card__header) {
  padding: 15px 20px;
  border-bottom: 1px solid #ebeef5;
  font-weight: 600;
  font-size: 15px;
}

:deep(.el-card__body) {
  padding: 20px;
}
</style>
