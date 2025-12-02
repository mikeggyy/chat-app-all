<template>
  <div class="notifications-page">
    <div class="page-header">
      <h2>通知管理</h2>
      <el-button type="primary" @click="showCreateDialog">
        <el-icon><Plus /></el-icon>
        新增通知
      </el-button>
    </div>

    <!-- 統計摘要 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="8">
        <el-card shadow="hover">
          <el-statistic title="全部通知" :value="stats.total" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <el-statistic title="啟用中" :value="stats.active">
            <template #suffix>
              <el-tag type="success" size="small">活躍</el-tag>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <el-statistic title="已停用" :value="stats.inactive">
            <template #suffix>
              <el-tag type="info" size="small">停用</el-tag>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 通知列表 -->
    <el-card class="table-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>通知列表</span>
          <el-button size="small" @click="loadNotifications" :loading="loading">
            刷新
          </el-button>
        </div>
      </template>

      <el-table :data="notifications" border stripe style="width: 100%">
        <el-table-column prop="title" label="標題" min-width="180">
          <template #default="{ row }">
            <div class="notification-title">
              <span>{{ row.title }}</span>
              <el-tag v-if="row.priority === 3" type="danger" size="small">緊急</el-tag>
              <el-tag v-else-if="row.priority === 2" type="warning" size="small">重要</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分類" width="120" />
        <el-table-column prop="isActive" label="狀態" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'">
              {{ row.isActive ? '啟用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="有效期間" width="200">
          <template #default="{ row }">
            <div class="date-range">
              <span>{{ formatDate(row.startDate) }}</span>
              <span v-if="row.endDate"> ~ {{ formatDate(row.endDate) }}</span>
              <span v-else> ~ 永久</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="創建時間" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="viewNotification(row)">
              查看
            </el-button>
            <el-button size="small" type="primary" @click="editNotification(row)">
              編輯
            </el-button>
            <el-button
              size="small"
              :type="row.isActive ? 'warning' : 'success'"
              @click="toggleStatus(row)"
            >
              {{ row.isActive ? '停用' : '啟用' }}
            </el-button>
            <el-button size="small" type="danger" @click="deleteNotification(row)">
              刪除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 創建/編輯對話框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '編輯通知' : '新增通知'"
      width="600px"
      @close="resetForm"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="標題" prop="title">
          <el-input v-model="form.title" placeholder="請輸入通知標題" />
        </el-form-item>

        <el-form-item label="分類" prop="category">
          <el-select v-model="form.category" placeholder="選擇分類">
            <el-option label="系統公告" value="系統公告" />
            <el-option label="活動通知" value="活動通知" />
            <el-option label="功能更新" value="功能更新" />
            <el-option label="維護通知" value="維護通知" />
            <el-option label="促銷活動" value="促銷活動" />
          </el-select>
        </el-form-item>

        <el-form-item label="優先級" prop="priority">
          <el-select v-model="form.priority" placeholder="選擇優先級">
            <el-option label="一般" :value="1" />
            <el-option label="重要" :value="2" />
            <el-option label="緊急" :value="3" />
          </el-select>
        </el-form-item>

        <el-form-item label="摘要內容" prop="message">
          <el-input
            v-model="form.message"
            type="textarea"
            :rows="2"
            placeholder="通知列表中顯示的摘要"
          />
        </el-form-item>

        <el-form-item label="完整內容" prop="fullContent">
          <el-input
            v-model="form.fullContent"
            type="textarea"
            :rows="6"
            placeholder="通知詳情頁顯示的完整內容，支援換行"
          />
        </el-form-item>

        <el-form-item label="操作按鈕">
          <div class="actions-editor">
            <div
              v-for="(action, index) in form.actions"
              :key="index"
              class="action-item"
            >
              <el-input
                v-model="action.label"
                placeholder="按鈕文字"
                style="width: 150px"
              />
              <el-select v-model="action.type" style="width: 100px">
                <el-option label="主要" value="primary" />
                <el-option label="次要" value="secondary" />
              </el-select>
              <el-button type="danger" size="small" @click="removeAction(index)">
                刪除
              </el-button>
            </div>
            <el-button size="small" @click="addAction">新增按鈕</el-button>
          </div>
        </el-form-item>

        <el-form-item label="有效期間">
          <el-date-picker
            v-model="form.dateRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="開始時間"
            end-placeholder="結束時間（留空為永久）"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>

        <el-form-item label="立即啟用">
          <el-switch v-model="form.isActive" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveNotification" :loading="saving">
          {{ isEditing ? '保存' : '創建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 查看對話框 -->
    <el-dialog v-model="viewDialogVisible" title="通知詳情" width="500px">
      <div class="notification-detail" v-if="currentNotification">
        <h3>{{ currentNotification.title }}</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="分類">
            {{ currentNotification.category }}
          </el-descriptions-item>
          <el-descriptions-item label="優先級">
            <el-tag
              :type="currentNotification.priority === 3 ? 'danger' : currentNotification.priority === 2 ? 'warning' : 'info'"
            >
              {{ priorityLabel(currentNotification.priority) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="狀態">
            <el-tag :type="currentNotification.isActive ? 'success' : 'info'">
              {{ currentNotification.isActive ? '啟用' : '停用' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="創建時間">
            {{ formatDateTime(currentNotification.createdAt) }}
          </el-descriptions-item>
        </el-descriptions>
        <div class="content-section">
          <h4>摘要</h4>
          <p>{{ currentNotification.message }}</p>
        </div>
        <div class="content-section">
          <h4>完整內容</h4>
          <pre>{{ currentNotification.fullContent }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '../utils/api';

// 狀態
const loading = ref(false);
const saving = ref(false);
const notifications = ref([]);
const stats = ref({ total: 0, active: 0, inactive: 0 });
const dialogVisible = ref(false);
const viewDialogVisible = ref(false);
const isEditing = ref(false);
const currentNotification = ref(null);
const formRef = ref(null);

// 表單
const form = reactive({
  id: null,
  title: '',
  message: '',
  fullContent: '',
  category: '系統公告',
  priority: 1,
  actions: [],
  dateRange: null,
  isActive: true,
});

const rules = {
  title: [{ required: true, message: '請輸入標題', trigger: 'blur' }],
  message: [{ required: true, message: '請輸入摘要內容', trigger: 'blur' }],
  category: [{ required: true, message: '請選擇分類', trigger: 'change' }],
};

// 加載通知列表
const loadNotifications = async () => {
  loading.value = true;
  try {
    const data = await api.get('/api/notifications');
    notifications.value = data.notifications || [];

    // 計算統計
    stats.value = {
      total: notifications.value.length,
      active: notifications.value.filter(n => n.isActive).length,
      inactive: notifications.value.filter(n => !n.isActive).length,
    };
  } catch (error) {
    ElMessage.error('加載通知列表失敗');
  } finally {
    loading.value = false;
  }
};

// 顯示創建對話框
const showCreateDialog = () => {
  isEditing.value = false;
  resetForm();
  dialogVisible.value = true;
};

// 編輯通知
const editNotification = (row) => {
  isEditing.value = true;
  form.id = row.id;
  form.title = row.title;
  form.message = row.message;
  form.fullContent = row.fullContent || row.message;
  form.category = row.category || '系統公告';
  form.priority = row.priority || 1;
  form.actions = row.actions ? [...row.actions] : [];
  form.isActive = row.isActive;

  if (row.startDate || row.endDate) {
    form.dateRange = [row.startDate, row.endDate].filter(Boolean);
  } else {
    form.dateRange = null;
  }

  dialogVisible.value = true;
};

// 查看通知
const viewNotification = (row) => {
  currentNotification.value = row;
  viewDialogVisible.value = true;
};

// 保存通知
const saveNotification = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    const payload = {
      title: form.title,
      message: form.message,
      fullContent: form.fullContent || form.message,
      category: form.category,
      priority: form.priority,
      actions: form.actions,
      isActive: form.isActive,
      startDate: form.dateRange?.[0] || null,
      endDate: form.dateRange?.[1] || null,
    };

    if (isEditing.value) {
      await api.put(`/api/notifications/${form.id}`, payload);
      ElMessage.success('通知更新成功');
    } else {
      await api.post('/api/notifications', payload);
      ElMessage.success('通知創建成功');
    }

    dialogVisible.value = false;
    loadNotifications();
  } catch (error) {
    ElMessage.error(isEditing.value ? '更新失敗' : '創建失敗');
  } finally {
    saving.value = false;
  }
};

// 切換狀態
const toggleStatus = async (row) => {
  try {
    await api.post(`/api/notifications/${row.id}/toggle`);
    ElMessage.success(`通知已${row.isActive ? '停用' : '啟用'}`);
    loadNotifications();
  } catch (error) {
    ElMessage.error('操作失敗');
  }
};

// 刪除通知
const deleteNotification = async (row) => {
  try {
    await ElMessageBox.confirm(
      `確定要刪除通知「${row.title}」嗎？此操作無法撤銷。`,
      '確認刪除',
      { type: 'warning' }
    );

    await api.delete(`/api/notifications/${row.id}`);
    ElMessage.success('通知刪除成功');
    loadNotifications();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('刪除失敗');
    }
  }
};

// 重置表單
const resetForm = () => {
  form.id = null;
  form.title = '';
  form.message = '';
  form.fullContent = '';
  form.category = '系統公告';
  form.priority = 1;
  form.actions = [];
  form.dateRange = null;
  form.isActive = true;
};

// 操作按鈕管理
const addAction = () => {
  form.actions.push({ label: '', type: 'primary' });
};

const removeAction = (index) => {
  form.actions.splice(index, 1);
};

// 格式化工具
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-TW');
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-TW');
};

const priorityLabel = (priority) => {
  const labels = { 1: '一般', 2: '重要', 3: '緊急' };
  return labels[priority] || '一般';
};

// 初始化
onMounted(() => {
  loadNotifications();
});
</script>

<style scoped lang="scss">
.notifications-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h2 {
    margin: 0;
  }
}

.stats-row {
  margin-bottom: 20px;
}

.table-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.notification-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-range {
  font-size: 12px;
  color: #666;
}

.actions-editor {
  .action-item {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    align-items: center;
  }
}

.notification-detail {
  h3 {
    margin-top: 0;
    margin-bottom: 16px;
  }

  .content-section {
    margin-top: 16px;

    h4 {
      margin-bottom: 8px;
      color: #666;
    }

    p {
      margin: 0;
      color: #333;
    }

    pre {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: inherit;
      font-size: 14px;
    }
  }
}
</style>
