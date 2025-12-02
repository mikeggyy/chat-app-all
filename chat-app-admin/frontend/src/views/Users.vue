<template>
  <div class="users-page">
    <h2>用戶管理</h2>

    <el-card>
      <!-- 搜索欄 -->
      <div class="search-bar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索用戶（郵箱、UID、顯示名稱）"
          clearable
          style="width: 300px"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
      </div>

      <!-- 用戶表格 -->
      <el-table
        :data="users"
        v-loading="loading"
        style="width: 100%; margin-top: 20px"
      >
        <el-table-column label="頭像" width="80">
          <template #default="{ row }">
            <el-avatar v-if="row.photoURL" :src="row.photoURL" :size="40" />
            <el-avatar v-else :size="40">
              {{ row.displayName?.charAt(0) || "?" }}
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="displayName" label="顯示名稱" width="120" />
        <el-table-column
          prop="email"
          label="郵箱"
          width="200"
          show-overflow-tooltip
        />
        <el-table-column label="會員等級" width="100">
          <template #default="{ row }">
            <el-tag
              :type="getMembershipTagType(row.membershipTier)"
              size="small"
            >
              {{ getMembershipLabel(row.membershipTier) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="coins" label="金幣" width="80" />
        <el-table-column label="資產卡片" width="320">
          <template #default="{ row }">
            <div style="font-size: 12px; line-height: 1.5">
              <div>
                拍照: {{ row.assets?.photoUnlockCards || 0 }} | 影片:
                {{ row.assets?.videoUnlockCards || 0 }}
              </div>
              <div>
                語音: {{ row.assets?.voiceUnlockCards || 0 }} | 角色:
                {{ row.assets?.characterUnlockCards || 0 }}
              </div>
              <div>創建: {{ row.assets?.createCards || 0 }}</div>
              <div style="color: #909399; margin-top: 4px">
                記憶藥水: {{ row.potions?.inventory?.memoryBoost || 0 }} (激活:
                {{ row.potions?.totalActive?.memoryBoost || 0 }}) | 腦力藥水:
                {{ row.potions?.inventory?.brainBoost || 0 }} (激活:
                {{ row.potions?.totalActive?.brainBoost || 0 }})
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="使用統計" width="240">
          <template #default="{ row }">
            <div style="font-size: 12px; line-height: 1.5">
              <div>
                對話: {{ row.usageStats?.totalConversations || 0 }} ({{
                  row.usageStats?.conversationCharacters || 0
                }}角色)
              </div>
              <div>
                語音: {{ row.usageStats?.totalVoiceUsed || 0 }} ({{
                  row.usageStats?.voiceCharacters || 0
                }}角色)
              </div>
              <div>
                拍照: {{ row.usageStats?.photosUsed || 0 }} | 創建:
                {{ row.usageStats?.characterCreations || 0 }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="gender" label="性別" width="70">
          <template #default="{ row }">
            {{
              row.gender === "male"
                ? "男"
                : row.gender === "female"
                ? "女"
                : row.gender === "other"
                ? "其他"
                : "-"
            }}
          </template>
        </el-table-column>
        <el-table-column label="狀態" width="70">
          <template #default="{ row }">
            <el-tag :type="row.disabled ? 'danger' : 'success'" size="small">
              {{ row.disabled ? "停用" : "正常" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="註冊時間" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="handleEdit(row)">編輯</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)"
              >刪除</el-button
            >
          </template>
        </el-table-column>
      </el-table>

      <!-- 分頁 -->
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: center"
        @size-change="loadUsers"
        @current-change="loadUsers"
      />
    </el-card>

    <!-- 編輯用戶對話框 -->
    <el-dialog
      v-model="editDialogVisible"
      title="編輯用戶資料"
      width="600px"
      @close="resetEditForm"
    >
      <el-form
        :model="editForm"
        :rules="editRules"
        ref="editFormRef"
        label-width="120px"
      >
        <el-form-item label="UID">
          <el-input v-model="editForm.uid" disabled />
        </el-form-item>

        <el-divider content-position="left">基本資料</el-divider>

        <el-form-item label="郵箱" prop="email">
          <el-input v-model="editForm.email" />
        </el-form-item>

        <el-form-item label="顯示名稱" prop="displayName">
          <el-input v-model="editForm.displayName" />
        </el-form-item>

        <el-form-item label="性別">
          <el-select
            v-model="editForm.gender"
            placeholder="請選擇性別"
            clearable
          >
            <el-option label="男性" value="male" />
            <el-option label="女性" value="female" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>

        <el-form-item label="語言">
          <el-select v-model="editForm.locale">
            <el-option label="繁體中文" value="zh-TW" />
            <el-option label="簡體中文" value="zh-CN" />
            <el-option label="English" value="en-US" />
          </el-select>
        </el-form-item>

        <el-divider content-position="left">會員資訊</el-divider>

        <el-form-item label="會員等級" prop="membershipTier">
          <el-select v-model="editForm.membershipTier" style="width: 100%">
            <el-option label="免費" value="free" />
            <el-option label="VIP" value="vip" />
            <el-option label="VVIP" value="vvip" />
          </el-select>
        </el-form-item>

        <el-form-item label="會員狀態">
          <el-select
            v-model="editForm.membershipStatus"
            placeholder="會員狀態"
            clearable
          >
            <el-option label="啟用" value="active" />
            <el-option label="過期" value="expired" />
            <el-option label="取消" value="cancelled" />
          </el-select>
        </el-form-item>

        <el-form-item label="自動續訂">
          <el-switch v-model="editForm.membershipAutoRenew" />
        </el-form-item>

        <el-divider content-position="left">帳號設定</el-divider>

        <el-form-item label="帳號狀態" prop="disabled">
          <el-switch
            v-model="editForm.disabled"
            active-text="停用"
            inactive-text="正常"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saveLoading" @click="handleSave"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import api from "../utils/api";
import { ElMessage, ElMessageBox } from "element-plus";
import { Search, DataLine } from "@element-plus/icons-vue";

const users = ref([]);
const loading = ref(false);
const searchQuery = ref("");
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);

// 編輯對話框
const editDialogVisible = ref(false);
const saveLoading = ref(false);
const editFormRef = ref(null);
const editForm = reactive({
  uid: "",
  email: "",
  displayName: "",
  gender: null,
  locale: "zh-TW",
  membershipTier: "free",
  membershipStatus: null,
  membershipAutoRenew: false,
  coins: 0,
  disabled: false,
  assets: {
    photoUnlockCards: 0,
    createCards: 0,
    videoUnlockCards: 0,
    voiceUnlockCards: 0,
    characterUnlockCards: 0,
  },
  potions: {
    inventory: {
      memoryBoost: 0,
      brainBoost: 0,
    },
    totalActive: {
      memoryBoost: 0,
      brainBoost: 0,
    },
    activeEffects: [],
  },
  usageLimits: {
    photosCount: 0,
    characterCreationCount: 0,
    conversationCounts: {}, // { characterId: count }
    voiceCounts: {}, // { characterId: count }
  },
});

// ✅ 2025-12-01 修復：增加更完整的表單驗證規則
const editRules = {
  email: [
    { required: true, message: "請輸入郵箱", trigger: "blur" },
    { type: "email", message: "請輸入正確的郵箱格式", trigger: "blur" },
  ],
  displayName: [
    { required: true, message: "請輸入顯示名稱", trigger: "blur" },
    { min: 2, max: 50, message: "顯示名稱長度應在 2-50 個字符之間", trigger: "blur" },
  ],
  membershipTier: [
    { required: true, message: "請選擇會員等級", trigger: "change" },
  ],
  coins: [
    {
      validator: (rule, value, callback) => {
        if (value === undefined || value === null || value === "") {
          callback();
          return;
        }
        const num = Number(value);
        if (isNaN(num)) {
          callback(new Error("金幣必須是數字"));
        } else if (num < 0) {
          callback(new Error("金幣不能為負數"));
        } else if (!Number.isInteger(num)) {
          callback(new Error("金幣必須是整數"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
};

function getMembershipTagType(tier) {
  const types = {
    free: "info",
    vip: "success",
    vvip: "danger",
  };
  return types[tier] || "info";
}

function getMembershipLabel(tier) {
  const labels = {
    free: "免費",
    vip: "VIP",
    vvip: "VVIP",
  };
  return labels[tier] || tier;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("zh-TW");
}

function getCharacterName(characterId) {
  // 角色 ID 映射（可以從後端獲取或者直接顯示 ID）
  const characterNames = {
    "match-001": "艾米麗",
    "match-002": "雅晴",
    "match-003": "芷珊",
  };
  return characterNames[characterId] || characterId;
}

async function loadUsers() {
  loading.value = true;
  try {
    const data = await api.get("/api/users", {
      params: {
        page: currentPage.value,
        limit: pageSize.value,
        search: searchQuery.value,
      },
    });
    users.value = data.users || [];
    total.value = data.total || 0;
  } catch (error) {
    ElMessage.error("載入用戶列表失敗");
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  currentPage.value = 1;
  loadUsers();
}

// 保存原始藥水數量用於比對
const originalPotions = ref({ memoryBoost: 0, brainBoost: 0 });

function handleEdit(user) {
  editForm.uid = user.uid;
  editForm.email = user.email;
  editForm.displayName = user.displayName;
  editForm.gender = user.gender || null;
  editForm.locale = user.locale || "zh-TW";
  editForm.membershipTier = user.membershipTier || "free";
  editForm.membershipStatus = user.membershipStatus || null;
  editForm.membershipAutoRenew = user.membershipAutoRenew || false;
  editForm.coins = user.coins || 0;
  editForm.disabled = user.disabled || false;
  editForm.assets.photoUnlockCards = user.assets?.photoUnlockCards || 0;
  editForm.assets.createCards = user.assets?.createCards || 0;
  editForm.assets.videoUnlockCards = user.assets?.videoUnlockCards || 0;
  editForm.assets.voiceUnlockCards = user.assets?.voiceUnlockCards || 0;
  editForm.assets.characterUnlockCards = user.assets?.characterUnlockCards || 0;

  // 載入藥水數據並記錄原始值（新的兩階段系統）
  const memoryBoost = user.potions?.inventory?.memoryBoost || 0;
  const brainBoost = user.potions?.inventory?.brainBoost || 0;
  editForm.potions.inventory.memoryBoost = memoryBoost;
  editForm.potions.inventory.brainBoost = brainBoost;
  editForm.potions.totalActive = user.potions?.totalActive || {
    memoryBoost: 0,
    brainBoost: 0,
  };
  editForm.potions.activeEffects = user.potions?.activeEffects || [];
  originalPotions.value = { memoryBoost, brainBoost };

  // 載入使用限制數據
  editForm.usageLimits.photosCount = user.usageLimits?.photos?.count || 0;
  editForm.usageLimits.characterCreationCount =
    user.usageLimits?.characterCreation?.count || 0;

  // 載入對話次數（按角色）
  editForm.usageLimits.conversationCounts = {};
  if (user.usageLimits?.conversation) {
    Object.entries(user.usageLimits.conversation).forEach(([charId, data]) => {
      // 過濾掉 null、undefined 或空字串的 charId
      if (charId && charId !== "null" && charId !== "undefined") {
        editForm.usageLimits.conversationCounts[charId] = data.count || 0;
      }
    });
  }

  // 載入語音次數（按角色）
  editForm.usageLimits.voiceCounts = {};
  if (user.usageLimits?.voice) {
    Object.entries(user.usageLimits.voice).forEach(([charId, data]) => {
      // 過濾掉 null、undefined 或空字串的 charId
      if (charId && charId !== "null" && charId !== "undefined") {
        editForm.usageLimits.voiceCounts[charId] = data.count || 0;
      }
    });
  }

  editDialogVisible.value = true;
}

async function handleSave() {
  if (!editFormRef.value) return;

  await editFormRef.value.validate(async (valid) => {
    if (!valid) return;

    saveLoading.value = true;
    try {
      // 更新基本資料
      await api.patch(`/api/users/${editForm.uid}`, {
        email: editForm.email,
        displayName: editForm.displayName,
        gender: editForm.gender,
        locale: editForm.locale,
        membershipTier: editForm.membershipTier,
        membershipStatus: editForm.membershipStatus,
        membershipAutoRenew: editForm.membershipAutoRenew,
        coins: editForm.coins,
        disabled: editForm.disabled,
        assets: {
          photoUnlockCards: editForm.assets.photoUnlockCards,
          createCards: editForm.assets.createCards,
          videoUnlockCards: editForm.assets.videoUnlockCards,
          voiceUnlockCards: editForm.assets.voiceUnlockCards,
          characterUnlockCards: editForm.assets.characterUnlockCards,
        },
      });

      // 更新使用限制
      await api.patch(`/api/users/${editForm.uid}/usage-limits`, {
        photosCount: editForm.usageLimits.photosCount,
        characterCreationCount: editForm.usageLimits.characterCreationCount,
        conversationCounts: editForm.usageLimits.conversationCounts,
        voiceCounts: editForm.usageLimits.voiceCounts,
      });

      // 更新藥水庫存數量
      await updatePotions(
        editForm.uid,
        editForm.potions.inventory.memoryBoost,
        editForm.potions.inventory.brainBoost
      );

      ElMessage.success("用戶資料更新成功");
      editDialogVisible.value = false;
      loadUsers(); // 重新載入列表
    } catch (error) {
      ElMessage.error(error.response?.data?.error || "更新用戶資料失敗");
    } finally {
      saveLoading.value = false;
    }
  });
}

/**
 * 更新用戶藥水庫存數量（新的兩階段系統）
 */
async function updatePotions(userId, newMemoryBoost, newBrainBoost) {
  const originalMemory = originalPotions.value.memoryBoost;
  const originalBrain = originalPotions.value.brainBoost;

  // 如果沒有變化，直接返回
  if (newMemoryBoost === originalMemory && newBrainBoost === originalBrain) {
    return;
  }

  try {
    // 直接設置庫存數量
    await api.put(`/api/users/${userId}/potions/inventory`, {
      memoryBoost: newMemoryBoost,
      brainBoost: newBrainBoost,
    });
  } catch (error) {
    throw error;
  }
}

function resetEditForm() {
  editForm.uid = "";
  editForm.email = "";
  editForm.displayName = "";
  editForm.gender = null;
  editForm.locale = "zh-TW";
  editForm.membershipTier = "free";
  editForm.membershipStatus = null;
  editForm.membershipAutoRenew = false;
  editForm.coins = 0;
  editForm.disabled = false;
  editForm.assets.photoUnlockCards = 0;
  editForm.assets.createCards = 0;
  editForm.assets.videoUnlockCards = 0;
  editForm.assets.voiceUnlockCards = 0;
  editForm.assets.characterUnlockCards = 0;

  // 重置藥水數據
  editForm.potions.inventory.memoryBoost = 0;
  editForm.potions.inventory.brainBoost = 0;
  editForm.potions.totalActive = { memoryBoost: 0, brainBoost: 0 };
  editForm.potions.activeEffects = [];
  originalPotions.value = { memoryBoost: 0, brainBoost: 0 };

  // 重置使用限制數據
  editForm.usageLimits.photosCount = 0;
  editForm.usageLimits.characterCreationCount = 0;
  editForm.usageLimits.conversationCounts = {};
  editForm.usageLimits.voiceCounts = {};

  if (editFormRef.value) {
    editFormRef.value.resetFields();
  }
}

async function handleResetUsage(type) {
  const typeNames = {
    photos: "拍照次數",
    conversations: "對話次數",
    voice: "語音次數",
    characterCreation: "角色創建次數",
  };

  try {
    await ElMessageBox.confirm(
      `確定要重置用戶的${typeNames[type]}嗎？當月使用次數將歸零。`,
      "重置確認",
      {
        confirmButtonText: "確定重置",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    const loadingMsg = ElMessage({
      message: `正在重置${typeNames[type]}...`,
      type: "info",
      duration: 0,
    });

    try {
      const resetData = {
        resetPhotos: type === "photos",
        resetConversations: type === "conversations",
        resetVoice: type === "voice",
        resetCharacterCreation: type === "characterCreation",
      };

      await api.patch(`/api/users/${editForm.uid}/usage-limits`, resetData);
      loadingMsg.close();
      ElMessage.success(`${typeNames[type]}已重置`);

      // 同步更新表單數據
      if (type === "photos") {
        editForm.usageLimits.photosCount = 0;
      } else if (type === "characterCreation") {
        editForm.usageLimits.characterCreationCount = 0;
      } else if (type === "conversations") {
        // 重置所有角色的對話次數
        Object.keys(editForm.usageLimits.conversationCounts).forEach(
          (charId) => {
            editForm.usageLimits.conversationCounts[charId] = 0;
          }
        );
      } else if (type === "voice") {
        // 重置所有角色的語音次數
        Object.keys(editForm.usageLimits.voiceCounts).forEach((charId) => {
          editForm.usageLimits.voiceCounts[charId] = 0;
        });
      }

      loadUsers(); // 重新載入列表以更新統計
    } catch (error) {
      loadingMsg.close();
      ElMessage.error(
        error.response?.data?.error || `重置${typeNames[type]}失敗`
      );
    }
  } catch (error) {
    // 用戶取消
    if (error !== "cancel") {
    }
  }
}

async function handleCleanNullKeys() {
  try {
    await ElMessageBox.confirm(
      "確定要清理該用戶的無效數據鍵嗎？這將刪除對話和語音記錄中的 null 鍵。",
      "清理確認",
      {
        confirmButtonText: "確定清理",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    const loadingMsg = ElMessage({
      message: "正在清理無效數據鍵...",
      type: "info",
      duration: 0,
    });

    try {
      const response = await api.post(
        `/api/users/${editForm.uid}/clean-null-keys`
      );
      loadingMsg.close();

      const cleaned = response.cleaned || {};
      if (cleaned.conversationKeys > 0 || cleaned.voiceKeys > 0) {
        ElMessage.success(
          `清理成功！對話鍵: ${cleaned.conversationKeys}，語音鍵: ${cleaned.voiceKeys}`
        );
        // 重新載入用戶數據
        loadUsers();
        // 關閉對話框並重新打開以刷新數據
        editDialogVisible.value = false;
      } else {
        ElMessage.info("沒有發現需要清理的無效鍵");
      }
    } catch (error) {
      loadingMsg.close();
      ElMessage.error(error.response?.data?.error || "清理無效鍵失敗");
    }
  } catch (error) {
    // 用戶取消
    if (error !== "cancel") {
    }
  }
}

async function handleDelete(user) {
  try {
    await ElMessageBox.confirm(
      `確定要刪除用戶「${user.displayName || user.email}」嗎？此操作不可恢復！`,
      "刪除確認",
      {
        confirmButtonText: "確定刪除",
        cancelButtonText: "取消",
        type: "warning",
        confirmButtonClass: "el-button--danger",
      }
    );

    // 確認後執行刪除
    const loadingMsg = ElMessage({
      message: "正在刪除用戶...",
      type: "info",
      duration: 0,
    });

    try {
      await api.delete(`/api/users/${user.uid}`);
      loadingMsg.close();
      ElMessage.success("用戶刪除成功");
      loadUsers(); // 重新載入列表
    } catch (error) {
      loadingMsg.close();
      ElMessage.error(error.response?.data?.error || "刪除用戶失敗");
    }
  } catch (error) {
    // 用戶取消刪除
    if (error !== "cancel") {
    }
  }
}

onMounted(() => {
  loadUsers();
});
</script>

<style scoped>
.users-page h2 {
  margin-bottom: 20px;
}

.search-bar {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* 表格文字置中 */
:deep(.el-table .el-table__cell) {
  text-align: center;
}

:deep(.el-table th.el-table__cell) {
  text-align: center;
}
</style>
