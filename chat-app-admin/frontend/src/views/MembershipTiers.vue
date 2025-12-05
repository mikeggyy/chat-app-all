<template>
  <div class="membership-tiers-page">
    <h2>會員等級配置</h2>

    <el-card>
      <el-table :data="membershipTiers" v-loading="loading" style="width: 100%">
        <el-table-column prop="id" label="等級 ID" width="100" />
        <el-table-column prop="name" label="等級名稱" width="150" />
        <el-table-column prop="price" label="價格（TWD）" width="200">
          <template #default="{ row }">
            <div style="font-size: 12px">
              <div>月: {{ row.prices?.monthly?.price || row.price || 0 }} TWD</div>
              <div v-if="row.prices?.quarterly">季: {{ row.prices.quarterly.price }} TWD</div>
              <div v-if="row.prices?.yearly">年: {{ row.prices.yearly.price }} TWD</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="狀態" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '啟用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="年訂閱獎勵" width="180">
          <template #default="{ row }">
            <div v-if="row.yearlyBonus" style="font-size: 12px">
              <div>註冊送: {{ row.yearlyBonus.signupCoins || 0 }} 金幣</div>
              <div>每月送: {{ row.yearlyBonus.monthlyCoins || 0 }} 金幣</div>
              <div>續約折扣: {{ row.yearlyBonus.renewalDiscount || 0 }}%</div>
            </div>
            <el-tag v-else size="small" type="info">未配置</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="功能限制" min-width="350">
          <template #default="{ row }">
            <div style="font-size: 12px">
              <div>對話: {{ row.features?.messagesPerCharacter === -1 ? '無限' : row.features?.messagesPerCharacter }}/角色</div>
              <div>語音: {{ row.features?.voicesPerCharacter === -1 ? '無限' : row.features?.voicesPerCharacter }}/角色</div>
              <div>AI 照片: {{ row.features?.monthlyPhotos || 0 }}/月</div>
              <div>解鎖券: {{ row.features?.characterUnlockCards || 0 }}/月</div>
              <div>移除廣告: {{ row.features?.requireAds === false ? '✓' : '✗' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="editTier(row)">編輯</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 編輯會員等級對話框 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="`編輯會員等級：${editForm.name}`"
      width="900px"
      @close="resetEditForm"
    >
      <el-form :model="editForm" ref="editFormRef" label-width="180px">
        <el-divider content-position="left">基本資訊</el-divider>

        <el-form-item label="等級 ID">
          <el-input v-model="editForm.id" disabled />
        </el-form-item>

        <el-form-item label="等級名稱">
          <el-input v-model="editForm.name" placeholder="例如：免費會員、VIP、VVIP" />
        </el-form-item>

        <el-divider content-position="left">訂閱週期價格</el-divider>

        <el-form-item label="月訂閱價格（TWD）">
          <el-input-number v-model="editForm.prices.monthly.price" :min="0" />
        </el-form-item>

        <el-form-item label="季訂閱價格（TWD）">
          <el-input-number v-model="editForm.prices.quarterly.price" :min="0" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px">
            月均 {{ Math.round(editForm.prices.quarterly.price / 3) }} TWD
          </span>
        </el-form-item>

        <el-form-item label="年訂閱價格（TWD）">
          <el-input-number v-model="editForm.prices.yearly.price" :min="0" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px">
            月均 {{ Math.round(editForm.prices.yearly.price / 12) }} TWD
          </span>
        </el-form-item>

        <el-divider content-position="left">年訂閱專屬獎勵</el-divider>

        <el-form-item label="年訂閱註冊金幣">
          <el-input-number v-model="editForm.yearlyBonus.signupCoins" :min="0" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px">年訂閱用戶註冊時立即獲得</span>
        </el-form-item>

        <el-form-item label="年訂閱每月金幣">
          <el-input-number v-model="editForm.yearlyBonus.monthlyCoins" :min="0" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px">年訂閱用戶每月額外獲得</span>
        </el-form-item>

        <el-form-item label="年訂閱續約折扣（%）">
          <el-input-number v-model="editForm.yearlyBonus.renewalDiscount" :min="0" :max="50" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px">年訂閱用戶續約時享受的折扣</span>
        </el-form-item>

        <el-form-item label="計費週期">
          <el-input v-model="editForm.billingCycle" placeholder="例如：monthly" />
        </el-form-item>

        <el-form-item label="狀態">
          <el-radio-group v-model="editForm.status">
            <el-radio value="active">啟用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-divider content-position="left">對話功能</el-divider>

        <el-form-item label="每角色對話次數">
          <el-input-number v-model="editForm.features.messagesPerCharacter" :min="-1" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px">-1 表示無限</span>
        </el-form-item>

        <el-form-item label="無限對話">
          <el-switch v-model="editForm.features.unlimitedChats" />
        </el-form-item>

        <el-form-item label="可對話角色數">
          <el-input-number v-model="editForm.features.totalCharacters" :min="-1" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px">-1 表示無限</span>
        </el-form-item>

        <el-divider content-position="left">語音功能</el-divider>

        <el-form-item label="每角色語音次數">
          <el-input-number v-model="editForm.features.voicesPerCharacter" :min="-1" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px">-1 表示無限</span>
        </el-form-item>

        <el-form-item label="無限語音">
          <el-switch v-model="editForm.features.unlimitedVoice" />
        </el-form-item>

        <el-divider content-position="left">AI 設定</el-divider>

        <el-form-item label="AI 模型">
          <el-input v-model="editForm.features.aiModel" placeholder="例如：gpt-4o-mini" />
        </el-form-item>

        <el-form-item label="回復長度（tokens）">
          <el-input-number v-model="editForm.features.maxResponseTokens" :min="100" />
        </el-form-item>

        <el-form-item label="記憶容量（tokens）">
          <el-input-number v-model="editForm.features.maxMemoryTokens" :min="1000" />
        </el-form-item>

        <el-divider content-position="left">角色功能</el-divider>

        <el-form-item label="可創建角色">
          <el-switch v-model="editForm.features.canCreateCharacters" />
        </el-form-item>

        <el-form-item label="最多創建角色數/月">
          <el-input-number v-model="editForm.features.maxCreatedCharacters" :min="0" />
        </el-form-item>

        <el-divider content-position="left">配對與搜尋</el-divider>

        <el-form-item label="每日配對次數">
          <el-input-number v-model="editForm.features.dailyMatchLimit" :min="-1" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px">-1 表示無限</span>
        </el-form-item>

        <el-form-item label="進階搜尋">
          <el-switch v-model="editForm.features.advancedSearch" />
        </el-form-item>

        <el-divider content-position="left">廣告相關</el-divider>

        <el-form-item label="需要看廣告">
          <el-switch v-model="editForm.features.requireAds" />
        </el-form-item>

        <el-form-item label="廣告解鎖對話所需次數">
          <el-input-number v-model="editForm.features.adsToUnlock" :min="0" />
        </el-form-item>

        <el-form-item label="每次廣告解鎖對話數">
          <el-input-number v-model="editForm.features.unlockedMessagesPerAd" :min="1" />
        </el-form-item>

        <el-form-item label="每角色每天廣告上限">
          <el-input-number v-model="editForm.features.dailyAdLimitPerCharacter" :min="0" />
        </el-form-item>

        <el-divider content-position="left">每月福利（訂閱期間每月發放）</el-divider>

        <el-form-item label="每月 AI 照片額度">
          <el-input-number v-model="editForm.features.monthlyPhotos" :min="0" />
        </el-form-item>

        <el-form-item label="每月角色解鎖券">
          <el-input-number v-model="editForm.features.characterUnlockCards" :min="0" />
        </el-form-item>

        <el-form-item label="創建角色卡">
          <el-input-number v-model="editForm.features.characterCreationCards" :min="0" />
        </el-form-item>

        <el-form-item label="拍照解鎖卡">
          <el-input-number v-model="editForm.features.photoUnlockCards" :min="0" />
        </el-form-item>

        <el-form-item label="影片解鎖卡">
          <el-input-number v-model="editForm.features.videoUnlockCards" :min="0" />
        </el-form-item>

        <el-divider content-position="left">其他福利</el-divider>

        <el-form-item label="每月贈送金幣">
          <el-input-number v-model="editForm.features.monthlyCoinsBonus" :min="0" />
        </el-form-item>

        <el-form-item label="金幣購買折扣">
          <el-input-number v-model="editForm.features.coinsDiscount" :min="0" :max="1" :step="0.1" />
          <span style="margin-left: 10px; color: #909399; font-size: 12px">0-1 之間，例如 0.2 表示 8 折</span>
        </el-form-item>

        <el-form-item label="AI 拍照功能">
          <el-switch v-model="editForm.features.aiPhotoGeneration" />
        </el-form-item>

        <el-form-item label="AI 拍照折扣">
          <el-input-number v-model="editForm.features.aiPhotoDiscount" :min="0" :max="1" :step="0.1" />
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
import { ElMessage } from "element-plus";

const membershipTiers = ref([]);
const loading = ref(false);
const editDialogVisible = ref(false);
const saveLoading = ref(false);
const editFormRef = ref(null);

/**
 * ✅ 2025-11-30 更新：新增 monthlyPhotos, prioritySupport 等欄位
 * ✅ 2025-12-03 更新：新增訂閱週期價格和年訂閱獎勵配置
 */
const editForm = reactive({
  id: "",
  name: "",
  price: 0,
  currency: "TWD",
  billingCycle: "monthly",
  status: "active",
  // 訂閱週期價格
  prices: {
    monthly: { price: 0, currency: "TWD" },
    quarterly: { price: 0, currency: "TWD" },
    yearly: { price: 0, currency: "TWD" },
  },
  // 年訂閱專屬獎勵
  yearlyBonus: {
    signupCoins: 0,
    monthlyCoins: 0,
    renewalDiscount: 0,
  },
  features: {
    messagesPerCharacter: 0,
    unlimitedChats: false,
    totalCharacters: 0,
    voicesPerCharacter: 0,
    unlimitedVoice: false,
    aiModel: "gpt-4o-mini",
    maxResponseTokens: 300,
    maxMemoryTokens: 3000,
    canCreateCharacters: false,
    maxCreatedCharacters: 0,
    dailyMatchLimit: 0,
    advancedSearch: false,
    requireAds: true,
    adsToUnlock: 0,
    unlockedMessagesPerAd: 5,
    dailyAdLimitPerCharacter: 3,
    // 每月福利
    monthlyPhotos: 0,
    characterUnlockCards: 0,
    characterCreationCards: 0,
    photoUnlockCards: 0,
    videoUnlockCards: 0,
    monthlyCoinsBonus: 0,
    coinsDiscount: 0,
    // AI 功能
    aiPhotoGeneration: false,
    aiPhotoDiscount: 0,
    aiVideoDiscount: 0,
    // 專屬特權
    prioritySupport: false,
    vipBadge: false,
    vvipBadge: false,
    earlyAccess: false,
    exclusiveCharacters: false,
  },
});

async function loadMembershipTiers() {
  loading.value = true;
  try {
    const data = await api.get("/api/membership-tiers");
    membershipTiers.value = data.tiers || [];
  } catch (error) {
    ElMessage.error("載入會員等級配置失敗");
  } finally {
    loading.value = false;
  }
}

function editTier(tier) {
  editForm.id = tier.id;
  editForm.name = tier.name || "";
  editForm.price = tier.price || 0;
  editForm.currency = tier.currency || "TWD";
  editForm.billingCycle = tier.billingCycle || "monthly";
  editForm.status = tier.status || "active";

  // ✅ 2025-12-03 新增：複製訂閱週期價格
  if (tier.prices) {
    editForm.prices.monthly.price = tier.prices.monthly?.price || tier.price || 0;
    editForm.prices.quarterly.price = tier.prices.quarterly?.price || 0;
    editForm.prices.yearly.price = tier.prices.yearly?.price || 0;
  } else {
    // 如果沒有 prices，使用舊的 price 作為月訂閱價格
    editForm.prices.monthly.price = tier.price || 0;
    editForm.prices.quarterly.price = 0;
    editForm.prices.yearly.price = 0;
  }

  // ✅ 2025-12-03 新增：複製年訂閱獎勵配置
  if (tier.yearlyBonus) {
    editForm.yearlyBonus.signupCoins = tier.yearlyBonus.signupCoins || 0;
    editForm.yearlyBonus.monthlyCoins = tier.yearlyBonus.monthlyCoins || 0;
    editForm.yearlyBonus.renewalDiscount = tier.yearlyBonus.renewalDiscount || 0;
  } else {
    editForm.yearlyBonus.signupCoins = 0;
    editForm.yearlyBonus.monthlyCoins = 0;
    editForm.yearlyBonus.renewalDiscount = 0;
  }

  // 複製 features 對象
  if (tier.features) {
    Object.keys(editForm.features).forEach((key) => {
      if (tier.features[key] !== undefined) {
        editForm.features[key] = tier.features[key];
      }
    });
  }

  editDialogVisible.value = true;
}

async function handleSave() {
  saveLoading.value = true;
  try {
    // ✅ 2025-12-03 更新：包含訂閱週期價格和年訂閱獎勵
    await api.patch(`/api/membership-tiers/${editForm.id}`, {
      name: editForm.name,
      price: editForm.prices.monthly.price, // 保持向後兼容
      currency: editForm.currency,
      billingCycle: editForm.billingCycle,
      status: editForm.status,
      prices: {
        monthly: { price: editForm.prices.monthly.price, currency: "TWD" },
        quarterly: { price: editForm.prices.quarterly.price, currency: "TWD" },
        yearly: { price: editForm.prices.yearly.price, currency: "TWD" },
      },
      yearlyBonus: {
        signupCoins: editForm.yearlyBonus.signupCoins,
        monthlyCoins: editForm.yearlyBonus.monthlyCoins,
        renewalDiscount: editForm.yearlyBonus.renewalDiscount,
      },
      features: editForm.features,
    });

    ElMessage.success("會員等級配置更新成功");
    editDialogVisible.value = false;
    loadMembershipTiers(); // 重新載入列表
  } catch (error) {
    ElMessage.error(error.response?.data?.error || "更新會員等級配置失敗");
  } finally {
    saveLoading.value = false;
  }
}

function resetEditForm() {
  editForm.id = "";
  editForm.name = "";
  editForm.price = 0;
  editForm.currency = "TWD";
  editForm.billingCycle = "monthly";
  editForm.status = "active";

  // ✅ 2025-12-03 新增：重置訂閱週期價格
  editForm.prices.monthly.price = 0;
  editForm.prices.quarterly.price = 0;
  editForm.prices.yearly.price = 0;

  // ✅ 2025-12-03 新增：重置年訂閱獎勵
  editForm.yearlyBonus.signupCoins = 0;
  editForm.yearlyBonus.monthlyCoins = 0;
  editForm.yearlyBonus.renewalDiscount = 0;

  // 重置 features
  Object.keys(editForm.features).forEach((key) => {
    if (typeof editForm.features[key] === "boolean") {
      editForm.features[key] = false;
    } else if (typeof editForm.features[key] === "number") {
      editForm.features[key] = 0;
    } else {
      editForm.features[key] = "";
    }
  });

  if (editFormRef.value) {
    editFormRef.value.resetFields();
  }
}

onMounted(() => {
  loadMembershipTiers();
});
</script>

<style scoped>
.membership-tiers-page h2 {
  margin-bottom: 20px;
}
</style>
