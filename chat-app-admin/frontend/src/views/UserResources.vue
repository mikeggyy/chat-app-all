<template>
  <div class="user-resources-page">
    <h2>用戶資源管理</h2>

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
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              @click="openResourceDialog(row)"
            >
              管理資源
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分頁 -->
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end"
        @size-change="fetchUsers"
        @current-change="fetchUsers"
      />
    </el-card>

    <!-- 管理各角色資源對話框 -->
    <el-dialog
      v-model="resourceDialogVisible"
      title="管理用戶各角色資源"
      width="900px"
      @close="resetResourceDialog"
    >
      <div v-loading="resourceLoading">
        <!-- 用戶基本信息 -->
        <el-descriptions :column="3" border style="margin-bottom: 20px">
          <el-descriptions-item label="用戶">{{
            currentResourceUser.displayName
          }}</el-descriptions-item>
          <el-descriptions-item label="郵箱">{{
            currentResourceUser.email
          }}</el-descriptions-item>
          <el-descriptions-item label="會員等級">
            <el-tag
              :type="getMembershipTagType(resourceData.membershipTier)"
              size="small"
            >
              {{ getMembershipLabel(resourceData.membershipTier) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <!-- Tabs -->
        <el-tabs v-model="activeResourceTab" type="border-card">
          <!-- 角色資源管理 Tab -->
          <el-tab-pane label="角色資源管理" name="resources">
            <el-alert
              title="管理用戶的錢包、資產卡片和全局資源（拍照、影片、創建角色次數等）"
              type="info"
              :closable="false"
              style="margin-bottom: 20px"
            />

            <!-- 錢包與資產 -->
            <el-divider content-position="left">💰 錢包與資產</el-divider>

            <el-form label-width="130px" style="margin-bottom: 30px">
              <el-form-item label="金幣餘額">
                <el-input-number
                  v-model="resourceData.wallet.coins"
                  :min="0"
                  style="width: 200px"
                />
              </el-form-item>

              <el-form-item label="角色解鎖卡">
                <el-input-number
                  v-model="resourceData.assets.characterUnlockCards"
                  :min="0"
                  style="width: 200px"
                />
              </el-form-item>

              <el-form-item label="拍照解鎖卡">
                <el-input-number
                  v-model="resourceData.assets.photoUnlockCards"
                  :min="0"
                  style="width: 200px"
                />
              </el-form-item>

              <el-form-item label="創建角色卡">
                <el-input-number
                  v-model="resourceData.assets.createCards"
                  :min="0"
                  style="width: 200px"
                />
              </el-form-item>

              <el-form-item label="影片解鎖卡">
                <el-input-number
                  v-model="resourceData.assets.videoUnlockCards"
                  :min="0"
                  style="width: 200px"
                />
              </el-form-item>

              <el-form-item label="語音解鎖卡">
                <el-input-number
                  v-model="resourceData.assets.voiceUnlockCards"
                  :min="0"
                  style="width: 200px"
                />
              </el-form-item>

              <el-form-item label="記憶藥水">
                <el-input-number
                  v-model="resourceData.potions.inventory.memoryBoost"
                  :min="0"
                  style="width: 200px"
                />
              </el-form-item>

              <el-form-item label="腦力藥水">
                <el-input-number
                  v-model="resourceData.potions.inventory.brainBoost"
                  :min="0"
                  style="width: 200px"
                />
              </el-form-item>
            </el-form>

            <!-- 全局資源管理 -->
            <el-divider content-position="left">🌐 全局資源管理</el-divider>

        <el-card shadow="never" style="margin-bottom: 20px">
          <template #header>
            <div style="display: flex; align-items: center; justify-content: space-between">
              <span style="font-weight: bold; color: #409eff">
                次數管理
              </span>
            </div>
          </template>

          <el-form label-width="130px">
            <!-- 拍照次數 -->
            <el-form-item>
              <template #label>
                <span>📸 拍照次數</span>
              </template>
              <div style="display: flex; align-items: center; gap: 10px">
                <span style="font-size: 14px; color: #909399; min-width: 90px">
                  已使用: {{ resourceData.globalUsage?.photosCount || 0 }}
                </span>
                <div style="flex: 1">
                  <el-select
                    :model-value="getGlobalResourceRemaining('photos')"
                    placeholder="選擇剩餘次數"
                    @change="(val) => updateGlobalResourceRemaining('photos', val)"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="num in getGlobalResourceOptions('photos')"
                      :key="num"
                      :label="`${num} 次`"
                      :value="num"
                    />
                  </el-select>
                  <span style="margin-left: 10px; color: #909399; font-size: 12px">
                    當前剩餘: {{ getGlobalResourceRemaining('photos') }} 次
                  </span>
                </div>
              </div>
            </el-form-item>

            <!-- 影片次數 -->
            <el-form-item>
              <template #label>
                <span>🎬 影片次數</span>
              </template>
              <div style="display: flex; align-items: center; gap: 10px">
                <span style="font-size: 14px; color: #909399; min-width: 90px">
                  已使用: {{ resourceData.globalUsage?.videosCount || 0 }}
                </span>
                <div style="flex: 1">
                  <el-select
                    :model-value="getGlobalResourceRemaining('videos')"
                    placeholder="選擇剩餘次數"
                    @change="(val) => updateGlobalResourceRemaining('videos', val)"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="num in getGlobalResourceOptions('videos')"
                      :key="num"
                      :label="`${num} 次`"
                      :value="num"
                    />
                  </el-select>
                  <span style="margin-left: 10px; color: #909399; font-size: 12px">
                    當前剩餘: {{ getGlobalResourceRemaining('videos') }} 次
                  </span>
                </div>
              </div>
            </el-form-item>

            <!-- 創建角色次數 -->
            <el-form-item>
              <template #label>
                <span>✨ 創建角色次數</span>
              </template>
              <div style="display: flex; align-items: center; gap: 10px">
                <span style="font-size: 14px; color: #909399; min-width: 90px">
                  已使用: {{ resourceData.globalUsage?.characterCreationCount || 0 }}
                </span>
                <div style="flex: 1">
                  <el-select
                    :model-value="getGlobalResourceRemaining('characterCreation')"
                    placeholder="選擇剩餘次數"
                    @change="(val) => updateGlobalResourceRemaining('characterCreation', val)"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="num in getGlobalResourceOptions('characterCreation')"
                      :key="num"
                      :label="`${num} 次`"
                      :value="num"
                    />
                  </el-select>
                  <span style="margin-left: 10px; color: #909399; font-size: 12px">
                    當前剩餘: {{ getGlobalResourceRemaining('characterCreation') }} 次
                  </span>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-card>

          </el-tab-pane>

          <!-- 角色資源使用情況 Tab -->
          <el-tab-pane label="角色資源使用情況" name="character-usage">
            <el-alert
              title="管理用戶在各角色的資源使用情況（對話、語音、藥水效果）"
              type="info"
              :closable="false"
              style="margin-bottom: 20px"
            />

        <div
          v-if="allCharacterIds.length === 0"
          style="text-align: center; color: #909399; padding: 20px"
        >
          該用戶尚未與任何角色互動
        </div>

        <el-collapse v-else v-model="activeCharacters" accordion>
          <el-collapse-item
            v-for="charId in allCharacterIds"
            :key="charId"
            :name="charId"
          >
            <template #title>
              <div style="display: flex; align-items: center; width: 100%">
                <span style="font-weight: bold; margin-right: 10px">{{
                  getCharacterName(charId)
                }}</span>
                <el-tag size="small" style="margin-right: 5px">
                  對話
                </el-tag>
                <el-tag size="small" type="success" style="margin-right: 5px">
                  語音
                </el-tag>
                <el-tag
                  v-if="getCharacterPotionEffects(charId).length > 0"
                  size="small"
                  type="warning"
                >
                  藥水
                </el-tag>
              </div>
            </template>

            <div style="padding: 15px">
              <!-- 對話資源 -->
              <el-card shadow="never" style="margin-bottom: 15px">
                <template #header>
                  <div
                    style="
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                    "
                  >
                    <span>💬 對話資源</span>
                  </div>
                </template>
                <el-form label-width="150px">
                  <el-form-item label="可用廣告次數">
                    <el-select
                      :model-value="getConversationAdRemaining(charId)"
                      placeholder="選擇可用廣告次數"
                      @change="(val) => handleConversationAdChange(charId, val)"
                      style="width: 200px"
                    >
                      <el-option
                        v-for="num in [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]"
                        :key="num"
                        :label="`${num} 次`"
                        :value="num"
                      />
                    </el-select>
                    <span style="margin-left: 10px; color: #909399; font-size: 12px;">
                      當前剩餘: {{ getConversationAdRemaining(charId) }} 次
                    </span>
                  </el-form-item>
                  <el-form-item label="設定剩餘免費次數">
                    <el-select
                      :model-value="getConversationRemaining(charId)"
                      placeholder="選擇剩餘次數"
                      @change="(val) => handleSetConversationRemaining(charId, val)"
                      style="width: 200px"
                    >
                      <el-option
                        v-for="num in getConversationRemainingOptions(charId)"
                        :key="num"
                        :label="`${num} 次`"
                        :value="num"
                      />
                    </el-select>
                    <span style="margin-left: 10px; color: #909399; font-size: 12px;">
                      當前剩餘: {{ getConversationRemaining(charId) }} 次
                    </span>
                  </el-form-item>
                  <el-form-item label="永久解鎖">
                    <el-switch
                      v-model="
                        resourceData.conversation.characters[charId]
                          .permanentUnlock
                      "
                      @change="handleConversationChange(charId)"
                    />
                    <span style="margin-left: 10px; color: #909399; font-size: 12px;">
                      開啟後無限制使用
                    </span>
                  </el-form-item>
                  <el-form-item>
                    <el-button
                      type="warning"
                      size="small"
                      @click="handleResetConversation(charId)"
                    >
                      重置對話次數
                    </el-button>
                  </el-form-item>
                </el-form>
              </el-card>

              <!-- 語音資源 -->
              <el-card shadow="never" style="margin-bottom: 15px">
                <template #header>
                  <div
                    style="
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                    "
                  >
                    <span>🔊 語音資源</span>
                  </div>
                </template>
                <el-form label-width="150px">
                  <el-form-item label="可用廣告次數">
                    <el-select
                      :model-value="getVoiceAdRemaining(charId)"
                      placeholder="選擇可用廣告次數"
                      @change="(val) => handleVoiceAdChange(charId, val)"
                      style="width: 200px"
                    >
                      <el-option
                        v-for="num in [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]"
                        :key="num"
                        :label="`${num} 次`"
                        :value="num"
                      />
                    </el-select>
                    <span style="margin-left: 10px; color: #909399; font-size: 12px;">
                      當前剩餘: {{ getVoiceAdRemaining(charId) }} 次
                    </span>
                  </el-form-item>
                  <el-form-item label="設定剩餘免費次數">
                    <el-select
                      :model-value="getVoiceRemaining(charId)"
                      placeholder="選擇剩餘次數"
                      @change="(val) => handleSetVoiceRemaining(charId, val)"
                      style="width: 200px"
                    >
                      <el-option
                        v-for="num in getVoiceRemainingOptions(charId)"
                        :key="num"
                        :label="`${num} 次`"
                        :value="num"
                      />
                    </el-select>
                    <span
                      style="
                        margin-left: 10px;
                        color: #909399;
                        font-size: 12px;
                      "
                    >
                      當前剩餘: {{ getVoiceRemaining(charId) }} 次
                    </span>
                  </el-form-item>
                  <el-form-item label="永久解鎖">
                    <el-switch
                      v-model="
                        resourceData.voice.characters[charId].permanentUnlock
                      "
                      @change="handleVoiceChange(charId)"
                    />
                    <span style="margin-left: 10px; color: #909399; font-size: 12px;">
                      開啟後無限制使用
                    </span>
                  </el-form-item>
                  <el-form-item>
                    <el-button
                      type="warning"
                      size="small"
                      @click="handleResetVoice(charId)"
                    >
                      重置語音次數
                    </el-button>
                  </el-form-item>
                </el-form>
              </el-card>

              <!-- 藥水效果 -->
              <el-card shadow="never">
                <template #header>
                  <div
                    style="
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                    "
                  >
                    <span>💊 藥水效果</span>
                  </div>
                </template>

                <div
                  v-if="getCharacterPotionEffects(charId).length === 0"
                  style="text-align: center; color: #909399; padding: 20px"
                >
                  該角色無激活的藥水效果
                </div>

                <div v-else>
                  <div
                    v-for="effect in getCharacterPotionEffects(charId)"
                    :key="effect.id"
                    style="
                      border: 1px solid #e4e7ed;
                      border-radius: 4px;
                      padding: 15px;
                      margin-bottom: 10px;
                    "
                  >
                    <el-descriptions :column="2" size="small" border>
                      <el-descriptions-item label="藥水類型">
                        <el-tag
                          :type="
                            effect.potionType === 'memory_boost'
                              ? 'primary'
                              : 'success'
                          "
                        >
                          {{ effect.potionName }}
                        </el-tag>
                      </el-descriptions-item>
                      <el-descriptions-item label="剩餘天數">
                        <el-tag
                          :type="
                            effect.daysRemaining > 7
                              ? 'success'
                              : effect.daysRemaining > 3
                              ? 'warning'
                              : 'danger'
                          "
                        >
                          {{ effect.daysRemaining }} 天
                        </el-tag>
                      </el-descriptions-item>
                      <el-descriptions-item label="激活時間">
                        {{ formatDate(effect.activatedAt) }}
                      </el-descriptions-item>
                      <el-descriptions-item label="過期時間">
                        {{ formatDate(effect.expiresAt) }}
                      </el-descriptions-item>
                    </el-descriptions>
                    <div style="margin-top: 10px; text-align: right">
                      <el-button
                        size="small"
                        type="danger"
                        @click="handleDeletePotionEffect(effect)"
                      >
                        刪除此效果
                      </el-button>
                    </div>
                  </div>
                </div>
              </el-card>
            </div>
          </el-collapse-item>
        </el-collapse>

          </el-tab-pane>
        </el-tabs>
      </div>

      <template #footer>
        <el-button @click="resourceDialogVisible = false">關閉</el-button>
        <el-button type="primary" :loading="saveLoading" @click="handleSaveAndRefresh"
          >保存並刷新</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from "vue";
import api from "../utils/api";
import { ElMessage, ElMessageBox } from "element-plus";
import { Search } from "@element-plus/icons-vue";

const users = ref([]);
const loading = ref(false);
const searchQuery = ref("");
const currentPage = ref(1);
const pageSize = ref(20);
const total = ref(0);

// 資源管理對話框
const resourceDialogVisible = ref(false);
const resourceLoading = ref(false);
const saveLoading = ref(false);
const activeResourceTab = ref("resources");
const currentResourceUser = reactive({
  uid: "",
  displayName: "",
  email: "",
});
const resourceData = reactive({
  userId: "",
  membershipTier: "free",
  conversation: {
    characters: {},
  },
  voice: {
    characters: {},
  },
  potions: {
    inventory: {
      memoryBoost: 0,
      brainBoost: 0,
    },
    activeEffects: [],
  },
  wallet: {
    coins: 0,
  },
  assets: {
    characterUnlockCards: 0,
    photoUnlockCards: 0,
    createCards: 0,
    videoUnlockCards: 0,
    voiceUnlockCards: 0,
  },
  globalUsage: {
    photosCount: 0,
    videosCount: 0,
    characterCreationCount: 0,
  },
});
const activeCharacters = ref("");
const allCharacterIds = ref([]);
// 獲取會員標籤類型
function getMembershipTagType(tier) {
  const types = {
    free: "info",
    vip: "success",
    vvip: "danger",
  };
  return types[tier] || "info";
}

// 獲取會員標籤文字
function getMembershipLabel(tier) {
  const labels = {
    free: "免費",
    vip: "VIP",
    vvip: "VVIP",
  };
  return labels[tier] || tier;
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("zh-TW");
}

// 獲取角色名稱（從統一的資料結構中獲取）
function getCharacterName(characterId) {
  // 優先從對話資料中獲取（後端已統一包含 character 信息）
  const conversationData = resourceData.conversation?.characters?.[characterId];
  if (conversationData?.character?.display_name) {
    return conversationData.character.display_name;
  }

  // 其次從語音資料中獲取
  const voiceData = resourceData.voice?.characters?.[characterId];
  if (voiceData?.character?.display_name) {
    return voiceData.character.display_name;
  }

  // 最後從藥水效果中獲取
  const potionEffect = resourceData.potions?.activeEffects?.find(
    (effect) => effect.characterId === characterId
  );
  if (potionEffect?.character?.display_name) {
    return potionEffect.character.display_name;
  }

  // 回退：顯示 ID
  return characterId;
}

// 獲取所有涉及的角色 ID
function getAllCharacterIds() {
  try {
    const conversationCharIds = Object.keys(
      resourceData.conversation?.characters || {}
    );
    const voiceCharIds = Object.keys(resourceData.voice?.characters || {});
    const potionCharIds = (resourceData.potions?.activeEffects || [])
      .map((effect) => effect?.characterId)
      .filter(Boolean);

    const allIds = [
      ...new Set([...conversationCharIds, ...voiceCharIds, ...potionCharIds]),
    ];
    return allIds.filter((id) => id && id !== "null" && id !== "undefined");
  } catch (error) {
    console.error("獲取角色 ID 列表時發生錯誤:", error);
    return [];
  }
}

// 獲取對話使用情況
function getConversationUsage(characterId) {
  const data = resourceData.conversation?.characters?.[characterId];
  if (!data) {
    return { used: 0, unlocked: 0, cards: 0, permanentUnlock: false };
  }
  return data;
}

// 獲取語音使用情況
function getVoiceUsage(characterId) {
  const data = resourceData.voice?.characters?.[characterId];
  if (!data) {
    return { used: 0, unlocked: 0, cards: 0, permanentUnlock: false };
  }
  return data;
}

// 安全獲取對話廣告剩餘次數
function getConversationAdRemaining(characterId) {
  const unlocked = resourceData.conversation?.characters?.[characterId]?.unlocked || 0;
  return 10 - unlocked;
}

// 安全獲取語音廣告剩餘次數
function getVoiceAdRemaining(characterId) {
  const unlocked = resourceData.voice?.characters?.[characterId]?.unlocked || 0;
  return 10 - unlocked;
}

// 獲取特定角色的藥水效果
function getCharacterPotionEffects(characterId) {
  if (!resourceData.potions?.activeEffects) {
    return [];
  }
  return resourceData.potions.activeEffects.filter(
    (effect) => effect.characterId === characterId
  );
}

// 獲取對話剩餘次數
function getConversationRemaining(characterId) {
  const data = resourceData.conversation.characters[characterId];
  if (!data) return 0;

  if (data.permanentUnlock) return 999;

  const baseLimit = data.customLimit || getMembershipDefaultLimit('conversation');
  const totalLimit = baseLimit + (data.unlocked || 0) + (data.cards || 0);
  const remaining = Math.max(0, totalLimit - (data.used || 0));
  return remaining;
}

// 獲取對話剩餘次數選項
function getConversationRemainingOptions(characterId) {
  const data = resourceData.conversation.characters[characterId];
  if (!data) return [0];

  if (data.permanentUnlock) return [999];

  const baseLimit = data.customLimit || getMembershipDefaultLimit('conversation');
  const totalLimit = baseLimit + (data.unlocked || 0) + (data.cards || 0);

  const options = [];
  for (let i = 0; i <= totalLimit; i++) {
    options.push(i);
  }
  return options;
}

// 設定對話剩餘次數
async function handleSetConversationRemaining(characterId, remainingCount) {
  const data = resourceData.conversation.characters[characterId];
  if (!data) return;

  const baseLimit = data.customLimit || getMembershipDefaultLimit('conversation');
  const totalLimit = baseLimit + (data.unlocked || 0) + (data.cards || 0);
  const newUsed = Math.max(0, totalLimit - remainingCount);

  try {
    await api.put(`/api/users/${resourceData.userId}/resource-limits/conversation/${characterId}`, {
      used: newUsed,
    });

    ElMessage.success("對話次數已更新");
    await loadResourceData(resourceData.userId);
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "更新失敗");
  }
}

// 獲取語音剩餘次數
function getVoiceRemaining(characterId) {
  const data = resourceData.voice.characters[characterId];
  if (!data) return 0;

  if (data.permanentUnlock) return 999;

  const baseLimit = data.customLimit || getMembershipDefaultLimit('voice');
  const totalLimit = baseLimit + (data.unlocked || 0) + (data.cards || 0);
  const remaining = Math.max(0, totalLimit - (data.used || 0));
  return remaining;
}

// 獲取語音剩餘次數選項
function getVoiceRemainingOptions(characterId) {
  const data = resourceData.voice.characters[characterId];
  if (!data) return [0];

  if (data.permanentUnlock) return [999];

  const baseLimit = data.customLimit || getMembershipDefaultLimit('voice');
  const totalLimit = baseLimit + (data.unlocked || 0) + (data.cards || 0);

  const options = [];
  for (let i = 0; i <= totalLimit; i++) {
    options.push(i);
  }
  return options;
}

// 設定語音剩餘次數
async function handleSetVoiceRemaining(characterId, remainingCount) {
  const data = resourceData.voice.characters[characterId];
  if (!data) return;

  const baseLimit = data.customLimit || getMembershipDefaultLimit('voice');
  const totalLimit = baseLimit + (data.unlocked || 0) + (data.cards || 0);
  const newUsed = Math.max(0, totalLimit - remainingCount);

  try {
    await api.put(`/api/users/${resourceData.userId}/resource-limits/voice/${characterId}`, {
      used: newUsed,
    });

    ElMessage.success("語音次數已更新");
    await loadResourceData(resourceData.userId);
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "更新失敗");
  }
}

// 獲取全局資源剩餘次數
function getGlobalResourceRemaining(type) {
  const limit = getMembershipDefaultLimit(type);
  const used = resourceData.globalUsage?.[`${type}Count`] || 0;
  return Math.max(0, limit - used);
}

// 獲取全局資源選項列表
function getGlobalResourceOptions(type) {
  const limit = getMembershipDefaultLimit(type);
  const options = [];
  for (let i = 0; i <= limit; i++) {
    options.push(i);
  }
  return options;
}

// 設定全局資源剩餘次數（本地更新，不發送 API）
function updateGlobalResourceRemaining(type, remainingCount) {
  const limit = getMembershipDefaultLimit(type);
  const newUsed = limit - remainingCount;

  const countKey = `${type}Count`;
  resourceData.globalUsage[countKey] = Math.max(0, newUsed);
}

// 設定全局資源剩餘次數（即時保存到服務器）
async function handleSetGlobalResourceRemaining(type, remainingCount) {
  const limit = getMembershipDefaultLimit(type);
  const newUsed = limit - remainingCount;

  const typeMapping = {
    photos: 'photos',
    videos: 'videos',
    characterCreation: 'character_creation',
  };

  const backendType = typeMapping[type] || type;

  try {
    await api.put(`/api/users/${resourceData.userId}/resource-limits/global/${backendType}`, {
      used: Math.max(0, newUsed),
    });

    const typeNames = {
      photos: '拍照次數',
      videos: '影片次數',
      characterCreation: '創建角色次數',
    };

    ElMessage.success(`${typeNames[type] || type}已更新`);
    await loadResourceData(resourceData.userId);
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "更新失敗");
  }
}

// 獲取藥水庫存
function getPotionInventory(type) {
  return resourceData.potions?.inventory?.[type] || 0;
}

// 獲取藥水選項列表
function getPotionOptions(type) {
  const options = [];
  for (let i = 0; i <= 100; i++) {
    options.push(i);
  }
  return options;
}

// 設定藥水庫存（本地更新，不發送 API）
function updatePotionInventory(type, count) {
  resourceData.potions.inventory[type] = Math.max(0, count);
}

// 設定藥水庫存（即時保存到服務器）
async function handleSetPotionInventory(type, count) {
  try {
    const payload = {
      memoryBoost: type === 'memoryBoost' ? Math.max(0, count) : (resourceData.potions?.inventory?.memoryBoost || 0),
      brainBoost: type === 'brainBoost' ? Math.max(0, count) : (resourceData.potions?.inventory?.brainBoost || 0),
    };

    await api.put(`/api/users/${resourceData.userId}/potions/inventory`, payload);

    const typeNames = {
      memoryBoost: '記憶增強藥水',
      brainBoost: '腦力激盪藥水',
    };

    ElMessage.success(`${typeNames[type] || type}庫存已更新`);
    await loadResourceData(resourceData.userId);
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "更新失敗");
  }
}

// 獲取會員預設額度
function getMembershipDefaultLimit(type) {
  const tier = resourceData.membershipTier || 'free';

  const limits = {
    conversation: {
      free: 10,
      vip: 20,
      vvip: 50,
    },
    voice: {
      free: 10,
      vip: 999,
      vvip: 999,
    },
    photos: {
      free: 3,
      vip: 0,
      vvip: 0,
    },
    videos: {
      free: 0,
      vip: 0,
      vvip: 0,
    },
    characterCreation: {
      free: 3,
      vip: 3,
      vvip: 3,
    },
    memoryBoost: {
      free: 0,
      vip: 0,
      vvip: 0,
    },
    brainBoost: {
      free: 0,
      vip: 0,
      vvip: 0,
    },
  };

  return limits[type]?.[tier] || 0;
}

// 獲取用戶列表
async function fetchUsers() {
  loading.value = true;
  try {
    const params = {
      page: currentPage.value,
      limit: pageSize.value,
    };

    if (searchQuery.value) {
      params.search = searchQuery.value;
    }

    const data = await api.get("/api/users", { params });
    users.value = data.users || [];
    total.value = data.total || 0;
  } catch (error) {
    ElMessage.error("獲取用戶列表失敗");
  } finally {
    loading.value = false;
  }
}

// 搜索用戶
function handleSearch() {
  currentPage.value = 1;
  fetchUsers();
}

// 打開資源管理對話框
async function openResourceDialog(user) {
  currentResourceUser.uid = user.uid;
  currentResourceUser.displayName = user.displayName || user.email;
  currentResourceUser.email = user.email;

  resourceDialogVisible.value = true;
  await loadResourceData(user.uid);
}

// 載入資源數據
async function loadResourceData(userId) {
  resourceLoading.value = true;
  try {
    const response = await api.get(`/api/users/${userId}/resource-limits`);

    let data;
    if (response.data?.data) {
      data = response.data.data;
    } else if (response.data) {
      data = response.data;
    } else {
      throw new Error("無效的響應格式");
    }

    resourceData.userId = data.userId || userId;
    resourceData.membershipTier = data.membershipTier || "free";

    // 確保 conversation 存在
    if (!data.conversation) {
      data.conversation = { characters: {} };
    }
    if (!data.conversation.characters) {
      data.conversation.characters = {};
    }

    // 確保 voice 存在
    if (!data.voice) {
      data.voice = { characters: {} };
    }
    if (!data.voice.characters) {
      data.voice.characters = {};
    }

    // 確保 potions 存在
    if (!data.potions) {
      data.potions = {
        inventory: { memoryBoost: 0, brainBoost: 0 },
        activeEffects: [],
      };
    }

    // 確保 globalUsage 存在
    if (!data.globalUsage) {
      data.globalUsage = {
        photosCount: 0,
        videosCount: 0,
        characterCreationCount: 0,
      };
    }

    // 先獲取所有涉及的角色 ID
    const conversationCharIds = Object.keys(data.conversation.characters || {});
    const voiceCharIds = Object.keys(data.voice.characters || {});
    const potionCharIds = (data.potions?.activeEffects || [])
      .map((effect) => effect?.characterId)
      .filter(Boolean);

    const characterIds = [
      ...new Set([...conversationCharIds, ...voiceCharIds, ...potionCharIds]),
    ].filter((id) => id && id !== "null" && id !== "undefined");

    // 確保所有角色在 conversation 和 voice 中都有默認數據
    characterIds.forEach((charId) => {
      if (!data.conversation.characters[charId]) {
        data.conversation.characters[charId] = {
          used: 0,
          unlocked: 0,
          cards: 0,
          permanentUnlock: false,
          lifetimeUsed: 0,
          lastUsedAt: null,
        };
      }
      if (!data.voice.characters[charId]) {
        data.voice.characters[charId] = {
          used: 0,
          unlocked: 0,
          cards: 0,
          permanentUnlock: false,
          lifetimeUsed: 0,
          lastUsedAt: null,
        };
      }
    });

    // 現在才更新 resourceData（所有角色數據都已初始化）
    resourceData.conversation = data.conversation;
    resourceData.voice = data.voice;
    resourceData.potions = data.potions;
    resourceData.globalUsage = data.globalUsage;

    // 載入錢包和資產數據
    try {
      const userResponse = await api.get(`/api/users/${userId}`);
      // axios 攔截器已經返回 response.data，所以這裡直接使用
      const userData = userResponse.data || userResponse;

      if (userData && (userData.uid || userData.email)) {
        resourceData.wallet.coins = userData.coins || 0;
        resourceData.assets.characterUnlockCards = userData.assets?.characterUnlockCards || 0;
        resourceData.assets.photoUnlockCards = userData.assets?.photoUnlockCards || 0;
        resourceData.assets.createCards = userData.assets?.createCards || 0;
        resourceData.assets.videoUnlockCards = userData.assets?.videoUnlockCards || 0;
        resourceData.assets.voiceUnlockCards = userData.assets?.voiceUnlockCards || 0;
      } else {
        console.warn("無法獲取用戶數據，使用默認值");
        resourceData.wallet.coins = 0;
        resourceData.assets.characterUnlockCards = 0;
        resourceData.assets.photoUnlockCards = 0;
        resourceData.assets.createCards = 0;
        resourceData.assets.videoUnlockCards = 0;
        resourceData.assets.voiceUnlockCards = 0;
      }
    } catch (error) {
      console.error("載入錢包和資產數據失敗:", error);
      // 設置默認值
      resourceData.wallet.coins = 0;
      resourceData.assets.characterUnlockCards = 0;
      resourceData.assets.photoUnlockCards = 0;
      resourceData.assets.createCards = 0;
      resourceData.assets.videoUnlockCards = 0;
      resourceData.assets.voiceUnlockCards = 0;
    }

    // 更新角色列表（使用 nextTick 避免響應式更新衝突）
    await nextTick();
    allCharacterIds.value = characterIds;

    // 注意：角色信息已由後端統一返回在 conversation/voice/potions 資料中
    // 不再需要額外的 API 調用獲取角色信息

  } catch (error) {
    ElMessage.error(
      error.response?.data?.error || error.message || "載入資源數據失敗"
    );
  } finally {
    resourceLoading.value = false;
  }
}

// 重置資源對話框
function resetResourceDialog() {
  activeCharacters.value = "";
  allCharacterIds.value = [];
}

// 刷新資源數據
async function handleRefreshResources() {
  await loadResourceData(currentResourceUser.uid);
  ElMessage.success("資源數據已刷新");
}

// 保存並刷新資源數據
async function handleSaveAndRefresh() {
  saveLoading.value = true;
  try {
    // 1. 保存錢包與資產數據
    await api.put(`/api/users/${resourceData.userId}`, {
      coins: resourceData.wallet.coins,
      assets: {
        characterUnlockCards: resourceData.assets.characterUnlockCards,
        photoUnlockCards: resourceData.assets.photoUnlockCards,
        createCards: resourceData.assets.createCards,
        videoUnlockCards: resourceData.assets.videoUnlockCards,
        voiceUnlockCards: resourceData.assets.voiceUnlockCards,
      },
    });

    // 2. 保存全局資源使用次數
    const globalResourceTypes = ['photos', 'videos', 'characterCreation'];
    for (const type of globalResourceTypes) {
      const typeMapping = {
        photos: 'photos',
        videos: 'videos',
        characterCreation: 'character_creation',
      };
      const backendType = typeMapping[type] || type;
      const countKey = `${type}Count`;
      const used = resourceData.globalUsage?.[countKey] || 0;

      await api.put(`/api/users/${resourceData.userId}/resource-limits/global/${backendType}`, {
        used: Math.max(0, used),
      });
    }

    // 3. 保存藥水庫存
    await api.put(`/api/users/${resourceData.userId}/potions/inventory`, {
      memoryBoost: resourceData.potions?.inventory?.memoryBoost || 0,
      brainBoost: resourceData.potions?.inventory?.brainBoost || 0,
    });

    // 4. 刷新數據
    await loadResourceData(currentResourceUser.uid);
    ElMessage.success("資源數據已保存並刷新");
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "保存失敗");
  } finally {
    saveLoading.value = false;
  }
}

// 更新錢包和資產
async function handleUpdateWalletAssets() {
  try {
    await api.put(`/api/users/${resourceData.userId}`, {
      coins: resourceData.wallet.coins,
      assets: {
        characterUnlockCards: resourceData.assets.characterUnlockCards,
        photoUnlockCards: resourceData.assets.photoUnlockCards,
        createCards: resourceData.assets.createCards,
        videoUnlockCards: resourceData.assets.videoUnlockCards,
        voiceUnlockCards: resourceData.assets.voiceUnlockCards,
      },
    });
    ElMessage.success("錢包與資產已更新");
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "更新失敗");
    await loadResourceData(resourceData.userId);
  }
}

// 處理對話廣告次數變更
async function handleConversationAdChange(characterId, remainingAds) {
  const unlocked = 10 - remainingAds;
  resourceData.conversation.characters[characterId].unlocked = unlocked;
  await handleConversationChange(characterId);
}

// 對話限制變更
async function handleConversationChange(characterId) {
  try {
    const data = resourceData.conversation.characters[characterId];
    await api.put(
      `/api/users/${resourceData.userId}/resource-limits/conversation/${characterId}`,
      {
        unlocked: data.unlocked,
        cards: data.cards,
        permanentUnlock: data.permanentUnlock,
      }
    );
    ElMessage.success("對話限制已更新");
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "更新對話限制失敗");
  }
}

// 處理語音廣告次數變更
async function handleVoiceAdChange(characterId, remainingAds) {
  const unlocked = 10 - remainingAds;
  resourceData.voice.characters[characterId].unlocked = unlocked;
  await handleVoiceChange(characterId);
}

// 語音限制變更
async function handleVoiceChange(characterId) {
  try {
    const data = resourceData.voice.characters[characterId];
    await api.put(
      `/api/users/${resourceData.userId}/resource-limits/voice/${characterId}`,
      {
        unlocked: data.unlocked,
        cards: data.cards,
        permanentUnlock: data.permanentUnlock,
      }
    );
    ElMessage.success("語音限制已更新");
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "更新語音限制失敗");
  }
}

// 重置對話次數
async function handleResetConversation(characterId) {
  try {
    await ElMessageBox.confirm(`確定要重置該角色的對話次數嗎？`, "重置確認", {
      confirmButtonText: "確定",
      cancelButtonText: "取消",
      type: "warning",
    });

    await api.put(
      `/api/users/${resourceData.userId}/resource-limits/conversation/${characterId}`,
      {
        reset: true,
      }
    );

    ElMessage.success("對話次數已重置");
    await loadResourceData(resourceData.userId);
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error(error.response?.data?.error || "重置對話次數失敗");
    }
  }
}

// 重置語音次數
async function handleResetVoice(characterId) {
  try {
    await ElMessageBox.confirm(`確定要重置該角色的語音次數嗎？`, "重置確認", {
      confirmButtonText: "確定",
      cancelButtonText: "取消",
      type: "warning",
    });

    await api.put(
      `/api/users/${resourceData.userId}/resource-limits/voice/${characterId}`,
      {
        reset: true,
      }
    );

    ElMessage.success("語音次數已重置");
    await loadResourceData(resourceData.userId);
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error(error.response?.data?.error || "重置語音次數失敗");
    }
  }
}

// 刪除藥水效果
async function handleDeletePotionEffect(effect) {
  try {
    await ElMessageBox.confirm(`確定要刪除該藥水效果嗎？`, "刪除確認", {
      confirmButtonText: "確定",
      cancelButtonText: "取消",
      type: "warning",
    });

    await api.delete(
      `/api/users/${resourceData.userId}/potion-effects/${effect.id}`
    );

    ElMessage.success("藥水效果已刪除");
    await loadResourceData(resourceData.userId);
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error(error.response?.data?.error || "刪除藥水效果失敗");
    }
  }
}

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.user-resources-page h2 {
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
