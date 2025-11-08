<template>
  <div class="transactions-page">
    <h2>交易記錄</h2>

    <!-- 統計卡片 -->
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card>
          <div class="stat-card">
            <div class="stat-title">總交易數</div>
            <div class="stat-value">{{ stats.totalTransactions || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-card">
            <div class="stat-title">總購買</div>
            <div class="stat-value success">{{ stats.totalPurchased || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-card">
            <div class="stat-title">總消費</div>
            <div class="stat-value warning">{{ stats.totalSpent || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-card">
            <div class="stat-title">總獎勵</div>
            <div class="stat-value info">{{ stats.totalRewarded || 0 }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <!-- 篩選條件 -->
      <el-form :model="filters" inline style="margin-bottom: 15px">
        <el-form-item label="用戶ID">
          <el-input
            v-model="filters.userId"
            placeholder="輸入用戶ID"
            clearable
            style="width: 200px"
          />
        </el-form-item>

        <el-form-item label="交易類型">
          <el-select
            v-model="filters.type"
            placeholder="全部類型"
            clearable
            style="width: 150px"
          >
            <el-option label="購買" value="purchase" />
            <el-option label="消費" value="spend" />
            <el-option label="獎勵" value="reward" />
            <el-option label="退款" value="refund" />
            <el-option label="管理員" value="admin" />
          </el-select>
        </el-form-item>

        <el-form-item label="狀態">
          <el-select
            v-model="filters.status"
            placeholder="全部狀態"
            clearable
            style="width: 150px"
          >
            <el-option label="已完成" value="completed" />
            <el-option label="待處理" value="pending" />
            <el-option label="失敗" value="failed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>

        <el-form-item label="日期範圍">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="開始日期"
            end-placeholder="結束日期"
            style="width: 300px"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="loadTransactions">
            <el-icon><Search /></el-icon> 查詢
          </el-button>
          <el-button @click="resetFilters">
            <el-icon><RefreshLeft /></el-icon> 重置
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 交易列表 -->
      <el-table :data="transactions" v-loading="loading" border stripe>
        <el-table-column prop="id" label="交易ID" width="180" show-overflow-tooltip />

        <el-table-column label="用戶" width="200">
          <template #default="{ row }">
            <div>
              <div><strong>{{ row.userName }}</strong></div>
              <div style="font-size: 12px; color: #999;">{{ row.userEmail }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="類型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)" size="small">
              {{ getTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="金額" width="120" align="right">
          <template #default="{ row }">
            <span :style="{ color: row.amount >= 0 ? '#67C23A' : '#F56C6C' }">
              {{ row.amount >= 0 ? '+' : '' }}{{ row.amount }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />

        <el-table-column label="餘額變化" width="180" align="center">
          <template #default="{ row }">
            <div style="font-size: 12px;">
              <div>前: {{ row.balanceBefore || 0 }}</div>
              <div>後: {{ row.balanceAfter || 0 }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="狀態" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="時間" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" @click="showDetails(row)">詳情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分頁 -->
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end"
        @current-change="loadTransactions"
        @size-change="loadTransactions"
      />
    </el-card>

    <!-- 詳情對話框 -->
    <el-dialog
      v-model="detailsDialogVisible"
      title="交易詳情"
      width="600px"
    >
      <div v-if="selectedTransaction">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="交易ID">
            {{ selectedTransaction.id }}
          </el-descriptions-item>
          <el-descriptions-item label="用戶">
            {{ selectedTransaction.userName }}
          </el-descriptions-item>
          <el-descriptions-item label="用戶Email">
            {{ selectedTransaction.userEmail }}
          </el-descriptions-item>
          <el-descriptions-item label="類型">
            <el-tag :type="getTypeTagType(selectedTransaction.type)">
              {{ getTypeLabel(selectedTransaction.type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="金額">
            <span :style="{ color: selectedTransaction.amount >= 0 ? '#67C23A' : '#F56C6C' }">
              {{ selectedTransaction.amount >= 0 ? '+' : '' }}{{ selectedTransaction.amount }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="狀態">
            <el-tag :type="getStatusTagType(selectedTransaction.status)">
              {{ getStatusLabel(selectedTransaction.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="交易前餘額">
            {{ selectedTransaction.balanceBefore || 0 }}
          </el-descriptions-item>
          <el-descriptions-item label="交易後餘額">
            {{ selectedTransaction.balanceAfter || 0 }}
          </el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">
            {{ selectedTransaction.description }}
          </el-descriptions-item>
          <el-descriptions-item label="創建時間" :span="2">
            {{ formatDate(selectedTransaction.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新時間" :span="2">
            {{ formatDate(selectedTransaction.updatedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="額外資訊" :span="2">
            <pre style="margin: 0; font-size: 12px;">{{ JSON.stringify(selectedTransaction.metadata, null, 2) }}</pre>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Search, RefreshLeft } from '@element-plus/icons-vue';
import api from '../utils/api';

const loading = ref(false);
const transactions = ref([]);
const stats = ref({});
const dateRange = ref(null);

const filters = reactive({
  userId: '',
  type: '',
  status: '',
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

const detailsDialogVisible = ref(false);
const selectedTransaction = ref(null);

// 載入交易記錄
const loadTransactions = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    };

    if (filters.userId) params.userId = filters.userId;
    if (filters.type) params.type = filters.type;
    if (filters.status) params.status = filters.status;
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0].toISOString();
      params.endDate = dateRange.value[1].toISOString();
    }

    const response = await api.get('/api/transactions', { params });

    if (response.success) {
      transactions.value = response.transactions;
      pagination.total = response.pagination.total;
    }
  } catch (error) {
    ElMessage.error('載入交易記錄失敗：' + (error.message || '未知錯誤'));
  } finally {
    loading.value = false;
  }
};

// 載入統計資訊
const loadStats = async () => {
  try {
    const response = await api.get('/api/transactions/stats');
    if (response?.success) {
      stats.value = response.stats;
    }
  } catch (error) {
    console.error('載入統計資訊失敗:', error);
    // 不顯示錯誤訊息，因為可能只是用戶未登入
  }
};

// 重置篩選條件
const resetFilters = () => {
  filters.userId = '';
  filters.type = '';
  filters.status = '';
  dateRange.value = null;
  pagination.page = 1;
  loadTransactions();
};

// 顯示詳情
const showDetails = (transaction) => {
  selectedTransaction.value = transaction;
  detailsDialogVisible.value = true;
};

// 獲取類型標籤樣式
const getTypeTagType = (type) => {
  const types = {
    purchase: 'success',
    spend: 'danger',
    reward: 'primary',
    refund: 'warning',
    admin: 'info',
  };
  return types[type] || 'info';
};

// 獲取類型標籤文字
const getTypeLabel = (type) => {
  const labels = {
    purchase: '購買',
    spend: '消費',
    reward: '獎勵',
    refund: '退款',
    admin: '管理員',
  };
  return labels[type] || type;
};

// 獲取狀態標籤樣式
const getStatusTagType = (status) => {
  const types = {
    completed: 'success',
    pending: 'warning',
    failed: 'danger',
    cancelled: 'info',
  };
  return types[status] || 'info';
};

// 獲取狀態標籤文字
const getStatusLabel = (status) => {
  const labels = {
    completed: '已完成',
    pending: '待處理',
    failed: '失敗',
    cancelled: '已取消',
  };
  return labels[status] || status;
};

// 格式化日期
const formatDate = (dateValue) => {
  if (!dateValue) return '-';

  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '-';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

onMounted(() => {
  loadTransactions();
  loadStats();
});
</script>

<style scoped>
.transactions-page {
  padding: 20px;
}

h2 {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
}

.stat-card {
  text-align: center;
}

.stat-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.stat-value.success {
  color: #67C23A;
}

.stat-value.warning {
  color: #E6A23C;
}

.stat-value.info {
  color: #409EFF;
}

.el-card {
  border-radius: 8px;
}

:deep(.el-pagination) {
  display: flex;
}
</style>
