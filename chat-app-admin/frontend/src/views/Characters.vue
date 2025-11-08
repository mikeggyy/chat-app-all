<template>
  <div class="characters-page">
    <h2>角色管理</h2>

    <el-card>
      <div class="toolbar">
        <el-button type="primary" @click="createCharacter">
          <el-icon><Plus /></el-icon>
          創建新角色
        </el-button>
      </div>

      <!-- 角色列表 -->
      <el-table :data="characters" v-loading="loading" style="width: 100%; margin-top: 20px;">
        <el-table-column prop="id" label="ID" width="120" />
        <el-table-column label="頭像" width="80">
          <template #default="{ row }">
            <el-avatar :src="row.portraitUrl" />
          </template>
        </el-table-column>
        <el-table-column prop="display_name" label="角色名稱" width="150" />
        <el-table-column label="性別" width="80">
          <template #default="{ row }">
            {{ formatGender(row.gender) }}
          </template>
        </el-table-column>
        <el-table-column label="語音" width="100">
          <template #default="{ row }">
            {{ formatVoice(row.voice) }}
          </template>
        </el-table-column>
        <el-table-column label="標籤" min-width="200">
          <template #default="{ row }">
            <el-tag v-for="tag in formatTags(row.tags)" :key="tag" size="small" style="margin-right: 4px;">
              {{ tag }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalChatUsers" label="聊天人數" width="100" />
        <el-table-column prop="totalFavorites" label="收藏數" width="100" />
        <el-table-column label="狀態" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === "active" ? "啟用" : "停用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="editCharacter(row)">編輯</el-button>
            <el-button size="small" type="danger" @click="deleteCharacter(row)">刪除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 編輯角色對話框 -->
    <el-dialog
      v-model="editDialogVisible"
      title="編輯角色設定"
      width="800px"
      @close="resetEditForm"
    >
      <el-form :model="editForm" :rules="editRules" ref="editFormRef" label-width="120px">
        <el-divider content-position="left">基本資料</el-divider>

        <el-form-item label="角色 ID">
          <el-input v-model="editForm.id" disabled />
        </el-form-item>

        <el-form-item label="角色名稱" prop="display_name">
          <el-input v-model="editForm.display_name" placeholder="請輸入角色名稱" />
        </el-form-item>

        <el-form-item label="性別" prop="gender">
          <el-radio-group v-model="editForm.gender">
            <el-radio value="女性">女性</el-radio>
            <el-radio value="男性">男性</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="語音" prop="voice">
          <el-select v-model="editForm.voice" placeholder="請選擇語音">
            <el-option label="Shimmer（女性）" value="shimmer" />
            <el-option label="Nova（女性）" value="nova" />
            <el-option label="Coral（女性）" value="coral" />
            <el-option label="Alloy（男性）" value="alloy" />
            <el-option label="Echo（男性）" value="echo" />
            <el-option label="Fable（男性）" value="fable" />
          </el-select>
        </el-form-item>

        <el-form-item label="語言" prop="locale">
          <el-select v-model="editForm.locale">
            <el-option label="繁體中文" value="zh-TW" />
            <el-option label="簡體中文" value="zh-CN" />
            <el-option label="English" value="en-US" />
          </el-select>
        </el-form-item>

        <el-form-item label="頭像 URL" prop="portraitUrl">
          <el-input v-model="editForm.portraitUrl" placeholder="請輸入頭像圖片 URL" />
        </el-form-item>

        <el-divider content-position="left">角色背景</el-divider>

        <el-form-item label="公開背景" prop="background">
          <el-input
            v-model="editForm.background"
            type="textarea"
            :rows="4"
            placeholder="用戶可見的角色背景故事"
          />
        </el-form-item>

        <el-form-item label="內部背景" prop="secret_background">
          <el-input
            v-model="editForm.secret_background"
            type="textarea"
            :rows="4"
            placeholder="AI 系統提示用的內部背景（用戶不可見）"
          />
        </el-form-item>

        <el-form-item label="首次訊息" prop="first_message">
          <el-input
            v-model="editForm.first_message"
            type="textarea"
            :rows="3"
            placeholder="角色的第一句對話"
          />
        </el-form-item>

        <el-divider content-position="left">標籤與劇情</el-divider>

        <el-form-item label="標籤">
          <el-select
            v-model="editForm.tags"
            multiple
            filterable
            allow-create
            placeholder="選擇或輸入新標籤"
            style="width: 100%"
          >
            <el-option label="可愛" value="可愛" />
            <el-option label="溫柔" value="溫柔" />
            <el-option label="活潑" value="活潑" />
            <el-option label="成熟" value="成熟" />
            <el-option label="知性" value="知性" />
          </el-select>
        </el-form-item>

        <el-form-item label="劇情鉤子">
          <el-select
            v-model="editForm.plot_hooks"
            multiple
            filterable
            allow-create
            placeholder="選擇或輸入劇情鉤子"
            style="width: 100%"
          >
          </el-select>
          <el-alert
            title="劇情鉤子是引導對話方向的關鍵詞或情節"
            type="info"
            :closable="false"
            style="margin-top: 8px;"
          />
        </el-form-item>

        <el-divider content-position="left">狀態設定</el-divider>

        <el-form-item label="角色狀態">
          <el-radio-group v-model="editForm.status">
            <el-radio value="active">啟用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="是否公開">
          <el-switch v-model="editForm.isPublic" />
        </el-form-item>

        <el-divider content-position="left">統計數據</el-divider>

        <el-form-item label="聊天人數">
          <el-input-number v-model="editForm.totalChatUsers" :min="0" :step="1" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px;">
            與此角色聊過天的用戶總數
          </span>
        </el-form-item>

        <el-form-item label="收藏數">
          <el-input-number v-model="editForm.totalFavorites" :min="0" :step="1" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px;">
            將此角色加入收藏的用戶總數
          </span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saveLoading" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import api from "../utils/api";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus } from "@element-plus/icons-vue";

const characters = ref([]);
const loading = ref(false);
const editDialogVisible = ref(false);
const saveLoading = ref(false);
const editFormRef = ref(null);

const editForm = reactive({
  id: "",
  display_name: "",
  gender: "女性",
  voice: "shimmer",
  locale: "zh-TW",
  background: "",
  secret_background: "",
  first_message: "",
  tags: [],
  plot_hooks: [],
  portraitUrl: "",
  status: "active",
  isPublic: true,
  totalChatUsers: 0,
  totalFavorites: 0,
});

const editRules = {
  display_name: [
    { required: true, message: "請輸入角色名稱", trigger: "blur" },
  ],
  gender: [
    { required: true, message: "請選擇性別", trigger: "change" },
  ],
  voice: [
    { required: true, message: "請選擇語音", trigger: "change" },
  ],
};

// 格式化性別顯示
function formatGender(gender) {
  if (!gender) return "-";
  if (typeof gender === "string") {
    const genderMap = {
      "female": "女性",
      "male": "男性",
      "女性": "女性",
      "男性": "男性",
    };
    return genderMap[gender] || gender;
  }
  return "-";
}

// 格式化語音顯示
function formatVoice(voice) {
  if (!voice) return "-";
  if (typeof voice === "string") {
    return voice;
  }
  // 如果是物件，嘗試提取 name 或 value
  if (typeof voice === "object" && voice !== null) {
    return voice.name || voice.value || voice.voice || "-";
  }
  return "-";
}

// 格式化標籤顯示
function formatTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags;
  }
  // 如果是物件，嘗試轉換為陣列
  if (typeof tags === "object" && tags !== null) {
    return Object.values(tags).filter(tag => typeof tag === "string");
  }
  return [];
}

async function loadCharacters() {
  loading.value = true;
  try {
    const data = await api.get("/api/characters");
    characters.value = data.characters || [];
  } catch (error) {
    ElMessage.error("載入角色列表失敗");
  } finally {
    loading.value = false;
  }
}

function createCharacter() {
  // TODO: 實現角色創建對話框
  ElMessage.info("創建角色功能開發中...");
}

function editCharacter(character) {
  editForm.id = character.id;
  editForm.display_name = character.display_name || "";
  editForm.gender = character.gender || "女性";
  editForm.voice = character.voice || "shimmer";
  editForm.locale = character.locale || "zh-TW";
  editForm.background = character.background || "";
  editForm.secret_background = character.secret_background || "";
  editForm.first_message = character.first_message || "";
  editForm.tags = Array.isArray(character.tags) ? [...character.tags] : [];
  editForm.plot_hooks = Array.isArray(character.plot_hooks) ? [...character.plot_hooks] : [];
  editForm.portraitUrl = character.portraitUrl || "";
  editForm.status = character.status || "active";
  editForm.isPublic = character.isPublic !== undefined ? character.isPublic : true;
  editForm.totalChatUsers = character.totalChatUsers || 0;
  editForm.totalFavorites = character.totalFavorites || 0;

  editDialogVisible.value = true;
}

async function handleSave() {
  if (!editFormRef.value) return;

  await editFormRef.value.validate(async (valid) => {
    if (!valid) return;

    saveLoading.value = true;
    try {
      await api.patch(`/api/characters/${editForm.id}`, {
        display_name: editForm.display_name,
        gender: editForm.gender,
        voice: editForm.voice,
        locale: editForm.locale,
        background: editForm.background,
        secret_background: editForm.secret_background,
        first_message: editForm.first_message,
        tags: editForm.tags,
        plot_hooks: editForm.plot_hooks,
        portraitUrl: editForm.portraitUrl,
        status: editForm.status,
        isPublic: editForm.isPublic,
        totalChatUsers: editForm.totalChatUsers,
        totalFavorites: editForm.totalFavorites,
      });

      ElMessage.success("角色更新成功");
      editDialogVisible.value = false;
      loadCharacters(); // 重新載入列表
    } catch (error) {
      ElMessage.error(error.response?.data?.error || "更新角色失敗");
    } finally {
      saveLoading.value = false;
    }
  });
}

function resetEditForm() {
  editForm.id = "";
  editForm.display_name = "";
  editForm.gender = "女性";
  editForm.voice = "shimmer";
  editForm.locale = "zh-TW";
  editForm.background = "";
  editForm.secret_background = "";
  editForm.first_message = "";
  editForm.tags = [];
  editForm.plot_hooks = [];
  editForm.portraitUrl = "";
  editForm.status = "active";
  editForm.isPublic = true;
  editForm.totalChatUsers = 0;
  editForm.totalFavorites = 0;

  if (editFormRef.value) {
    editFormRef.value.resetFields();
  }
}

async function deleteCharacter(character) {
  try {
    await ElMessageBox.confirm(`確定要刪除角色「${character.display_name}」嗎？`, "警告", {
      confirmButtonText: "確定",
      cancelButtonText: "取消",
      type: "warning",
    });

    // TODO: 實現刪除 API 調用
    ElMessage.success("刪除成功");
    loadCharacters();
  } catch (err) {
    if (err !== "cancel") {
      ElMessage.error("刪除失敗");
    }
  }
}

onMounted(() => {
  loadCharacters();
});
</script>

<style scoped>
.characters-page h2 {
  margin-bottom: 20px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
