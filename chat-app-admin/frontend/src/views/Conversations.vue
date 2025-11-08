<template>
  <div class="conversations-page">
    <h2>對話監控</h2>

    <!-- 統計卡片 -->
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card>
          <div class="stat-card">
            <div class="stat-title">總對話數</div>
            <div class="stat-value">{{ stats.totalConversations || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-card">
            <div class="stat-title">活躍用戶數</div>
            <div class="stat-value success">{{ stats.activeUsers || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-card">
            <div class="stat-title">今日對話數</div>
            <div class="stat-value warning">{{ stats.todayConversations || 0 }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-card">
            <div class="stat-title">總消息數</div>
            <div class="stat-value info">{{ stats.totalMessages || 0 }}</div>
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

        <el-form-item label="角色ID">
          <el-input
            v-model="filters.characterId"
            placeholder="輸入角色ID"
            clearable
            style="width: 200px"
          />
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
          <el-button type="primary" @click="loadConversations">
            <el-icon><Search /></el-icon> 查詢
          </el-button>
          <el-button @click="resetFilters">
            <el-icon><RefreshLeft /></el-icon> 重置
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 對話列表 -->
      <el-table :data="conversations" v-loading="loading" border stripe>
        <el-table-column prop="id" label="對話ID" width="180" show-overflow-tooltip />

        <el-table-column label="用戶" width="200">
          <template #default="{ row }">
            <div>
              <div><strong>{{ row.userName }}</strong></div>
              <div style="font-size: 12px; color: #999;">{{ row.userEmail }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="角色" width="150">
          <template #default="{ row }">
            {{ row.characterName }}
          </template>
        </el-table-column>

        <el-table-column label="消息數" width="100" align="center">
          <template #default="{ row }">
            <el-tag type="info" size="small">{{ row.messageCount }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="最後更新" width="180">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>

        <el-table-column label="創建時間" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" @click="showDetails(row.id)">查看</el-button>
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
        @current-change="loadConversations"
        @size-change="loadConversations"
      />
    </el-card>

    <!-- 對話詳情對話框 -->
    <el-dialog
      v-model="detailsDialogVisible"
      title="對話詳情"
      width="70%"
      :close-on-click-modal="false"
    >
      <div v-if="selectedConversation" v-loading="detailsLoading">
        <!-- 基本資訊 -->
        <el-descriptions :column="2" border style="margin-bottom: 20px">
          <el-descriptions-item label="對話ID">
            {{ selectedConversation.id }}
          </el-descriptions-item>
          <el-descriptions-item label="用戶">
            {{ selectedConversation.userName }} ({{ selectedConversation.userEmail }})
          </el-descriptions-item>
          <el-descriptions-item label="角色">
            {{ selectedConversation.characterName }}
          </el-descriptions-item>
          <el-descriptions-item label="消息數">
            {{ selectedConversation.messages?.length || 0 }}
          </el-descriptions-item>
          <el-descriptions-item label="創建時間">
            {{ formatDate(selectedConversation.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="最後更新">
            {{ formatDate(selectedConversation.updatedAt) }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 對話記錄 -->
        <div class="messages-container">
          <h3 style="margin-bottom: 15px">對話記錄</h3>
          <div
            v-for="message in selectedConversation.messages"
            :key="message.id"
            class="message-item"
            :class="message.role"
          >
            <div class="message-header">
              <span class="message-role">
                {{ message.role === 'user' ? '用戶' : 'AI' }}
              </span>
              <span class="message-time">{{ formatDate(message.timestamp) }}</span>
            </div>
            <div class="message-content">{{ message.content }}</div>
          </div>
          <el-empty
            v-if="!selectedConversation.messages || selectedConversation.messages.length === 0"
            description="暫無對話記錄"
          />
        </div>
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
const conversations = ref([]);
const stats = ref({});
const dateRange = ref(null);

const filters = reactive({
  userId: '',
  characterId: '',
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

const detailsDialogVisible = ref(false);
const detailsLoading = ref(false);
const selectedConversation = ref(null);

// 載入對話列表
const loadConversations = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    };

    if (filters.userId) params.userId = filters.userId;
    if (filters.characterId) params.characterId = filters.characterId;
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0].toISOString();
      params.endDate = dateRange.value[1].toISOString();
    }

    const response = await api.get('/api/conversations', { params });

    if (response.success) {
      conversations.value = response.conversations;
      pagination.total = response.pagination.total;
    }
  } catch (error) {
    ElMessage.error('載入對話列表失敗：' + (error.message || '未知錯誤'));
  } finally {
    loading.value = false;
  }
};

// 載入統計資訊
const loadStats = async () => {
  try {
    const response = await api.get('/api/conversations/stats');
    if (response?.success) {
      stats.value = response.stats;
    }
  } catch (error) {
    console.error('載入統計資訊失敗:', error);
  }
};

// 重置篩選條件
const resetFilters = () => {
  filters.userId = '';
  filters.characterId = '';
  dateRange.value = null;
  pagination.page = 1;
  loadConversations();
};

// 顯示對話詳情
const showDetails = async (conversationId) => {
  detailsDialogVisible.value = true;
  detailsLoading.value = true;
  try {
    const response = await api.get(`/api/conversations/${conversationId}`);
    if (response.success) {
      selectedConversation.value = response.conversation;
    }
  } catch (error) {
    ElMessage.error('載入對話詳情失敗：' + (error.message || '未知錯誤'));
  } finally {
    detailsLoading.value = false;
  }
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
  loadConversations();
  loadStats();
});
</script>

<style scoped>
.conversations-page {
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

/* 對話記錄樣式 */
.messages-container {
  max-height: 500px;
  overflow-y: auto;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.message-item {
  margin-bottom: 15px;
  padding: 12px;
  border-radius: 8px;
  background-color: #fff;
  border-left: 3px solid #409EFF;
}

.message-item.user {
  border-left-color: #67C23A;
}

.message-item.assistant {
  border-left-color: #409EFF;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
}

.message-role {
  font-weight: bold;
  color: #303133;
}

.message-time {
  color: #909399;
}

.message-content {
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
