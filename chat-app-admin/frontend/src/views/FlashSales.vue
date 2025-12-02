<template>
  <div class="flash-sales-page">
    <div class="page-header">
      <h1>限時閃購管理</h1>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus /></el-icon>
        新增閃購活動
      </el-button>
    </div>

    <!-- 統計卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-value">{{ stats.totalSales }}</div>
          <div class="stat-label">總活動數</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-card--active">
          <div class="stat-value">{{ stats.activeSales }}</div>
          <div class="stat-label">進行中</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-card--sold">
          <div class="stat-value">{{ stats.totalSoldCount }}</div>
          <div class="stat-label">總售出數</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-card--revenue">
          <div class="stat-value">NT$ {{ stats.totalRevenue.toLocaleString() }}</div>
          <div class="stat-label">總營收</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 篩選 -->
    <el-card class="filter-card">
      <el-form :inline="true">
        <el-form-item label="狀態篩選">
          <el-select v-model="filterStatus" placeholder="全部" clearable @change="loadSales">
            <el-option label="全部" value="" />
            <el-option label="預定中" value="scheduled" />
            <el-option label="進行中" value="active" />
            <el-option label="已結束" value="ended" />
            <el-option label="已售罄" value="sold_out" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="loadSales">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 閃購列表 -->
    <el-card v-loading="loading">
      <el-table :data="sales" style="width: 100%">
        <el-table-column prop="name" label="活動名稱" min-width="150">
          <template #default="{ row }">
            <div class="sale-name-cell">
              <span class="sale-name">{{ row.name }}</span>
              <el-tag v-if="!row.enabled" type="info" size="small">已停用</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="狀態" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="價格" width="150">
          <template #default="{ row }">
            <div class="price-cell">
              <span class="current-price">NT$ {{ row.price }}</span>
              <span v-if="row.originalPrice > row.price" class="original-price">
                NT$ {{ row.originalPrice }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="內容" min-width="200">
          <template #default="{ row }">
            <div class="contents-cell">
              <el-tag v-if="row.contents.coins" size="small">
                {{ row.contents.coins }} 金幣
              </el-tag>
              <el-tag v-if="row.contents.photoUnlockCards" size="small" type="success">
                {{ row.contents.photoUnlockCards }} 照片卡
              </el-tag>
              <el-tag v-if="row.contents.characterUnlockCards" size="small" type="warning">
                {{ row.contents.characterUnlockCards }} 角色卡
              </el-tag>
              <el-tag v-if="row.contents.videoUnlockCards" size="small" type="danger">
                {{ row.contents.videoUnlockCards }} 影片卡
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="時間" width="200">
          <template #default="{ row }">
            <div class="time-cell">
              <div>開始: {{ formatTime(row.startTime) }}</div>
              <div>結束: {{ formatTime(row.endTime) }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="銷售" width="120">
          <template #default="{ row }">
            <div class="sales-cell">
              <span>{{ row.soldCount }}</span>
              <span v-if="row.stockLimit"> / {{ row.stockLimit }}</span>
              <span v-else> 份</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button size="small" @click="openEditDialog(row)">
                編輯
              </el-button>
              <el-button
                size="small"
                :type="row.enabled ? 'warning' : 'success'"
                @click="toggleEnabled(row)"
              >
                {{ row.enabled ? '停用' : '啟用' }}
              </el-button>
              <el-dropdown trigger="click">
                <el-button size="small">
                  更多
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="duplicateSale(row)">
                      複製活動
                    </el-dropdown-item>
                    <el-dropdown-item
                      divided
                      :disabled="row.soldCount > 0"
                      @click="deleteSale(row)"
                    >
                      <span style="color: #f56c6c">刪除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/編輯對話框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '編輯閃購活動' : '新增閃購活動'"
      width="600px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="120px"
      >
        <el-form-item label="活動名稱" prop="name">
          <el-input v-model="formData.name" placeholder="例如：週末閃購" />
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="2"
            placeholder="活動描述"
          />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="售價 (TWD)" prop="price">
              <el-input-number v-model="formData.price" :min="0" :precision="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="原價 (TWD)">
              <el-input-number v-model="formData.originalPrice" :min="0" :precision="0" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="折扣標籤">
              <el-input v-model="formData.discount" placeholder="例如：50%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="徽章文字">
              <el-input v-model="formData.badge" placeholder="例如：⚡ 限時閃購" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider>內容配置</el-divider>

        <el-row :gutter="20">
          <el-col :span="6">
            <el-form-item label="金幣">
              <el-input-number v-model="formData.contents.coins" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="照片卡">
              <el-input-number v-model="formData.contents.photoUnlockCards" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="角色卡">
              <el-input-number v-model="formData.contents.characterUnlockCards" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="影片卡">
              <el-input-number v-model="formData.contents.videoUnlockCards" :min="0" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider>時間和限制</el-divider>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="開始時間" prop="startTime">
              <el-date-picker
                v-model="formData.startTime"
                type="datetime"
                placeholder="選擇開始時間"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="結束時間" prop="endTime">
              <el-date-picker
                v-model="formData.endTime"
                type="datetime"
                placeholder="選擇結束時間"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="庫存限制">
              <el-input-number
                v-model="formData.stockLimit"
                :min="0"
                placeholder="不填則無限制"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="每人限購">
              <el-input-number v-model="formData.perUserLimit" :min="1" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="啟用狀態">
          <el-switch v-model="formData.enabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSale">
          {{ isEditing ? '保存' : '創建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { Plus, Refresh, ArrowDown } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import api from "../utils/api";

// 狀態
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const isEditing = ref(false);
const filterStatus = ref("");
const sales = ref([]);
const editingSaleId = ref(null);

const stats = reactive({
  totalSales: 0,
  activeSales: 0,
  totalSoldCount: 0,
  totalRevenue: 0,
});

const formRef = ref(null);
const formData = reactive({
  name: "",
  description: "",
  price: 99,
  originalPrice: 199,
  discount: "",
  badge: "⚡ 限時閃購",
  contents: {
    coins: 100,
    photoUnlockCards: 0,
    characterUnlockCards: 0,
    videoUnlockCards: 0,
  },
  startTime: null,
  endTime: null,
  stockLimit: null,
  perUserLimit: 1,
  enabled: true,
});

const formRules = {
  name: [{ required: true, message: "請輸入活動名稱", trigger: "blur" }],
  price: [{ required: true, message: "請輸入售價", trigger: "blur" }],
  startTime: [{ required: true, message: "請選擇開始時間", trigger: "change" }],
  endTime: [{ required: true, message: "請選擇結束時間", trigger: "change" }],
};

// 方法
async function loadSales() {
  loading.value = true;
  try {
    const params = filterStatus.value ? `?status=${filterStatus.value}` : "";
    const response = await api.get(`/api/flash-sales${params}`);
    sales.value = response.sales || [];
  } catch (error) {
    ElMessage.error("載入閃購列表失敗");
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  try {
    const response = await api.get("/api/flash-sales/stats");
    if (response.stats) {
      Object.assign(stats, response.stats);
    }
  } catch (error) {
    console.error("載入統計失敗:", error);
  }
}

function openCreateDialog() {
  isEditing.value = false;
  editingSaleId.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(sale) {
  isEditing.value = true;
  editingSaleId.value = sale.id;

  Object.assign(formData, {
    name: sale.name,
    description: sale.description,
    price: sale.price,
    originalPrice: sale.originalPrice,
    discount: sale.discount,
    badge: sale.badge,
    contents: { ...sale.contents },
    startTime: new Date(sale.startTime),
    endTime: new Date(sale.endTime),
    stockLimit: sale.stockLimit,
    perUserLimit: sale.perUserLimit,
    enabled: sale.enabled,
  });

  dialogVisible.value = true;
}

function resetForm() {
  Object.assign(formData, {
    name: "",
    description: "",
    price: 99,
    originalPrice: 199,
    discount: "",
    badge: "⚡ 限時閃購",
    contents: {
      coins: 100,
      photoUnlockCards: 0,
      characterUnlockCards: 0,
      videoUnlockCards: 0,
    },
    startTime: new Date(),
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2小時後
    stockLimit: null,
    perUserLimit: 1,
    enabled: true,
  });
}

async function saveSale() {
  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  saving.value = true;
  try {
    const data = {
      ...formData,
      startTime: formData.startTime.toISOString(),
      endTime: formData.endTime.toISOString(),
    };

    if (isEditing.value) {
      await api.put(`/api/flash-sales/${editingSaleId.value}`, data);
      ElMessage.success("閃購活動已更新");
    } else {
      await api.post("/api/flash-sales", data);
      ElMessage.success("閃購活動已創建");
    }

    dialogVisible.value = false;
    loadSales();
    loadStats();
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "操作失敗");
  } finally {
    saving.value = false;
  }
}

async function toggleEnabled(sale) {
  try {
    await api.patch(`/api/flash-sales/${sale.id}/toggle`);
    ElMessage.success(`閃購活動已${sale.enabled ? "停用" : "啟用"}`);
    loadSales();
  } catch (error) {
    ElMessage.error("操作失敗");
  }
}

async function duplicateSale(sale) {
  try {
    await ElMessageBox.confirm(
      `確定要複製「${sale.name}」活動嗎？`,
      "複製確認",
      { confirmButtonText: "確定", cancelButtonText: "取消" }
    );

    await api.post(`/api/flash-sales/${sale.id}/duplicate`);
    ElMessage.success("活動已複製");
    loadSales();
    loadStats();
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("複製失敗");
    }
  }
}

async function deleteSale(sale) {
  if (sale.soldCount > 0) {
    ElMessage.warning("已有購買記錄，無法刪除");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `確定要刪除「${sale.name}」活動嗎？此操作無法復原。`,
      "刪除確認",
      {
        confirmButtonText: "確定刪除",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    await api.delete(`/api/flash-sales/${sale.id}`);
    ElMessage.success("活動已刪除");
    loadSales();
    loadStats();
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("刪除失敗");
    }
  }
}

function getStatusType(status) {
  const types = {
    scheduled: "info",
    active: "success",
    ended: "",
    sold_out: "warning",
  };
  return types[status] || "info";
}

function getStatusText(status) {
  const texts = {
    scheduled: "預定中",
    active: "進行中",
    ended: "已結束",
    sold_out: "已售罄",
  };
  return texts[status] || status;
}

function formatTime(timeString) {
  const date = new Date(timeString);
  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onMounted(() => {
  loadSales();
  loadStats();
});
</script>

<style scoped lang="scss">
.flash-sales-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h1 {
    margin: 0;
    font-size: 24px;
  }
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
  padding: 10px;

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #303133;
  }

  .stat-label {
    font-size: 14px;
    color: #909399;
    margin-top: 5px;
  }

  &--active .stat-value {
    color: #67c23a;
  }

  &--sold .stat-value {
    color: #409eff;
  }

  &--revenue .stat-value {
    color: #e6a23c;
  }
}

.filter-card {
  margin-bottom: 20px;

  :deep(.el-card__body) {
    padding: 15px 20px;
  }

  .el-form-item {
    margin-bottom: 0;
  }
}

.sale-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .sale-name {
    font-weight: 500;
  }
}

.price-cell {
  display: flex;
  flex-direction: column;

  .current-price {
    font-weight: 600;
    color: #e6a23c;
  }

  .original-price {
    font-size: 12px;
    color: #909399;
    text-decoration: line-through;
  }
}

.contents-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.time-cell {
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
}

.sales-cell {
  font-weight: 500;
}

.el-divider {
  margin: 15px 0;
}

:deep(.el-input-number) {
  width: 100%;
}
</style>
