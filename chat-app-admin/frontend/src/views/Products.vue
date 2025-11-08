<template>
  <div class="products-page">
    <h2>商品管理</h2>

    <el-card>
      <!-- 分類管理按鈕 -->
      <el-button type="warning" @click="showCategoryDialog = true" style="margin-bottom: 15px">
        <el-icon><Setting /></el-icon> 管理分類
      </el-button>

      <el-tabs v-model="activeTab" type="border-card" v-loading="loadingCategories">
        <el-tab-pane
          v-for="category in categories"
          :key="category.id"
          :label="`${category.icon} ${category.label}`"
          :name="category.id"
        >
          <el-button
            type="primary"
            @click="handleAdd(category.id)"
            style="margin-bottom: 15px"
          >
            <el-icon><Plus /></el-icon> 新增{{ category.label }}
          </el-button>

          <!-- 通用商品表格 -->
          <el-table :data="products" v-loading="loadingProducts" border>
            <!-- ID -->
            <el-table-column prop="id" label="ID" width="200" show-overflow-tooltip />

            <!-- 排序 -->
            <el-table-column v-if="hasField('order')" label="排序" width="80" align="center" sortable>
              <template #default="{ row }">
                {{ row.order }}
              </template>
            </el-table-column>

            <!-- 圖示 -->
            <el-table-column v-if="hasField('emoji')" label="圖示" width="80" align="center">
              <template #default="{ row }">
                <span style="font-size: 24px">{{ row.emoji }}</span>
              </template>
            </el-table-column>

            <!-- 名稱 -->
            <el-table-column prop="name" label="名稱" width="150" />

            <!-- 數量（解鎖卡等） -->
            <el-table-column v-if="hasField('quantity')" label="數量" width="100" align="center">
              <template #default="{ row }">
                {{ row.quantity }}
              </template>
            </el-table-column>

            <!-- 基礎金幣（金幣套餐） -->
            <el-table-column v-if="hasField('coins')" label="基礎金幣" width="100" align="center">
              <template #default="{ row }">
                {{ row.coins }}
              </template>
            </el-table-column>

            <!-- 贈送金幣（金幣套餐） -->
            <el-table-column v-if="hasField('bonus')" label="贈送" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.bonus > 0" type="success" size="small">
                  +{{ row.bonus }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>

            <!-- 總金幣（金幣套餐） -->
            <el-table-column v-if="hasField('totalCoins')" label="總金幣" width="100" align="center">
              <template #default="{ row }">
                <strong>{{ row.totalCoins }}</strong>
              </template>
            </el-table-column>

            <!-- 價格（金幣套餐需要顯示在總金幣後） -->
            <el-table-column v-if="hasField('coins') && hasField('currency')" label="價格" width="120" align="center">
              <template #default="{ row }">
                {{ row.unitPrice }} {{ row.currency }}
              </template>
            </el-table-column>

            <!-- 標籤（金幣套餐） -->
            <el-table-column v-if="hasField('coins') && hasField('badge')" label="標籤" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.badge" type="warning" size="small">
                  {{ row.badge }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>

            <!-- 推薦（金幣套餐） -->
            <el-table-column v-if="hasField('coins') && hasField('popular')" label="推薦" width="80" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.popular" type="success" size="small">
                  ✓
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>

            <!-- 原價（解鎖卡） -->
            <el-table-column v-if="hasField('basePrice')" label="原價" width="110" align="center">
              <template #default="{ row }">
                <template v-if="row.originalPrice">
                  {{ row.originalPrice }} 金幣
                </template>
                <template v-else-if="row.quantity && row.basePrice">
                  {{ row.quantity * row.basePrice }} 金幣
                </template>
                <template v-else>
                  -
                </template>
              </template>
            </el-table-column>

            <!-- 折扣率（解鎖卡） -->
            <el-table-column v-if="hasField('discount')" label="折扣" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.discount && row.discount < 1" type="warning" size="small">
                  {{ (row.discount * 10).toFixed(1) }}折
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>

            <!-- 價格（解鎖卡、禮物、道具 - 不含金幣卡） -->
            <el-table-column v-if="!hasField('coins')" label="價格" width="120">
              <template #default="{ row }">
                <span v-if="row.unitPrice">
                  <strong>{{ row.unitPrice }} 金幣</strong>
                </span>
                <span v-else>{{ row.price }} 金幣</span>
              </template>
            </el-table-column>

            <!-- 標籤（解鎖卡 - 不含金幣卡） -->
            <el-table-column v-if="!hasField('coins') && hasField('badge')" label="標籤" width="100" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.badge" type="danger" size="small">
                  {{ row.badge }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>

            <!-- 推薦（解鎖卡 - 不含金幣卡） -->
            <el-table-column v-if="!hasField('coins') && hasField('popular')" label="推薦" width="80" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.popular" type="success" size="small">
                  ✓
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>

            <!-- 稀有度（禮物） -->
            <el-table-column v-if="hasField('rarity')" label="稀有度" width="100">
              <template #default="{ row }">
                <el-tag :type="getRarityTagType(row.rarity)" size="small">
                  {{ getRarityLabel(row.rarity) }}
                </el-tag>
              </template>
            </el-table-column>

            <!-- 持續時間（道具） -->
            <el-table-column v-if="hasField('duration')" label="持續時間" width="100" align="center">
              <template #default="{ row }">
                {{ row.duration }} 天
              </template>
            </el-table-column>

            <!-- 創建時間 -->
            <el-table-column label="創建時間" width="170">
              <template #default="{ row }">
                {{ row.createdAt ? formatDate(row.createdAt) : '-' }}
              </template>
            </el-table-column>

            <!-- 更新時間 -->
            <el-table-column label="更新時間" width="170">
              <template #default="{ row }">
                {{ row.updatedAt ? formatDate(row.updatedAt) : '-' }}
              </template>
            </el-table-column>

            <!-- 操作 -->
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="handleEdit(row, category.id)">編輯</el-button>
                <el-button size="small" type="danger" @click="handleDelete(row, category.id)">刪除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 編輯/新增對話框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'add' ? '新增商品' : '編輯商品'"
      width="600px"
      @close="resetForm"
    >
      <!-- 金幣套餐表單 -->
      <el-form
        v-if="currentType === 'coins'"
        :model="currentItem"
        label-width="140px"
      >
        <el-form-item label="ID">
          <el-input v-model="currentItem.id" :disabled="dialogMode === 'edit'" />
        </el-form-item>
        <el-form-item label="名稱">
          <el-input v-model="currentItem.name" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="currentItem.order" :min="1" />
        </el-form-item>
        <el-form-item label="圖示 (Emoji)">
          <emoji-picker
            v-model="currentItem.icon"
            button-text="選擇 Emoji"
          />
        </el-form-item>

        <!-- 金幣內容 -->
        <el-divider content-position="left">金幣內容</el-divider>
        <el-form-item label="基礎金幣">
          <el-input-number v-model="currentItem.coins" :min="1" />
        </el-form-item>
        <el-form-item label="贈送金幣">
          <el-input-number v-model="currentItem.bonus" :min="0" />
        </el-form-item>
        <el-form-item label="總金幣">
          <el-input-number v-model="currentItem.totalCoins" :min="1" disabled />
          <span style="margin-left: 10px; color: #999;">自動計算: {{ (currentItem.coins || 0) + (currentItem.bonus || 0) }}</span>
        </el-form-item>

        <!-- 統一價格結構 -->
        <el-divider content-position="left">價格設定</el-divider>
        <el-form-item label="價格類型">
          <el-select v-model="currentItem.priceType">
            <el-option label="現金" value="currency" />
            <el-option label="金幣" value="coins" />
          </el-select>
        </el-form-item>
        <el-form-item label="單價">
          <el-input-number v-model="currentItem.unitPrice" :min="1" />
        </el-form-item>
        <el-form-item label="貨幣" v-if="currentItem.priceType === 'currency'">
          <el-select v-model="currentItem.currency">
            <el-option label="TWD" value="TWD" />
            <el-option label="USD" value="USD" />
          </el-select>
        </el-form-item>

        <!-- 統一數量設定 -->
        <el-divider content-position="left">數量設定</el-divider>
        <el-form-item label="預設數量">
          <el-input-number v-model="currentItem.defaultQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="最小數量">
          <el-input-number v-model="currentItem.minQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="最大數量">
          <el-input-number v-model="currentItem.maxQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="數量單位">
          <el-input v-model="currentItem.quantityUnit" placeholder="如：份、個、張" />
        </el-form-item>

        <!-- 顯示設定 -->
        <el-divider content-position="left">顯示設定</el-divider>
        <el-form-item label="推薦">
          <el-switch v-model="currentItem.popular" />
        </el-form-item>
        <el-form-item label="標籤">
          <el-input v-model="currentItem.badge" placeholder="如：最超值、限時優惠" />
        </el-form-item>
        <el-form-item label="最超值">
          <el-switch v-model="currentItem.bestValue" />
        </el-form-item>
        <el-form-item label="狀態">
          <el-select v-model="currentItem.status">
            <el-option label="上架" value="active" />
            <el-option label="下架" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>

      <!-- 禮物表單 -->
      <el-form
        v-if="currentType === 'gifts'"
        :model="currentItem"
        label-width="140px"
      >
        <el-form-item label="ID">
          <el-input v-model="currentItem.id" :disabled="dialogMode === 'edit'" />
        </el-form-item>
        <el-form-item label="名稱">
          <el-input v-model="currentItem.name" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="currentItem.order" :min="1" />
        </el-form-item>
        <el-form-item label="圖示 (Emoji)">
          <emoji-picker
            v-model="currentItem.icon"
            button-text="選擇 Emoji"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="currentItem.description" type="textarea" />
        </el-form-item>

        <!-- 統一價格結構 -->
        <el-divider content-position="left">價格設定</el-divider>
        <el-form-item label="價格類型">
          <el-input value="金幣" disabled />
        </el-form-item>
        <el-form-item label="單價 (金幣)">
          <el-input-number v-model="currentItem.unitPrice" :min="1" />
        </el-form-item>

        <!-- 統一數量設定 -->
        <el-divider content-position="left">數量設定</el-divider>
        <el-form-item label="預設數量">
          <el-input-number v-model="currentItem.defaultQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="最小數量">
          <el-input-number v-model="currentItem.minQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="最大數量">
          <el-input-number v-model="currentItem.maxQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="數量單位">
          <el-input v-model="currentItem.quantityUnit" placeholder="如：個" />
        </el-form-item>

        <!-- 禮物專屬欄位 -->
        <el-divider content-position="left">禮物設定</el-divider>
        <el-form-item label="稀有度">
          <el-select v-model="currentItem.rarity">
            <el-option label="普通" value="common" />
            <el-option label="罕見" value="uncommon" />
            <el-option label="稀有" value="rare" />
            <el-option label="史詩" value="epic" />
            <el-option label="傳說" value="legendary" />
          </el-select>
        </el-form-item>
        <el-form-item label="回覆訊息">
          <el-input v-model="currentItem.thankYouMessage" type="textarea" />
        </el-form-item>

        <!-- 顯示設定 -->
        <el-divider content-position="left">顯示設定</el-divider>
        <el-form-item label="標籤">
          <el-input v-model="currentItem.badge" placeholder="如：推薦、熱門" />
        </el-form-item>
        <el-form-item label="推薦">
          <el-switch v-model="currentItem.popular" />
        </el-form-item>
        <el-form-item label="狀態">
          <el-select v-model="currentItem.status">
            <el-option label="上架" value="active" />
            <el-option label="下架" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>

      <!-- 道具表單 -->
      <el-form
        v-if="currentType === 'potions'"
        :model="currentItem"
        label-width="140px"
      >
        <el-form-item label="ID">
          <el-input v-model="currentItem.id" :disabled="dialogMode === 'edit'" />
        </el-form-item>
        <el-form-item label="名稱">
          <el-input v-model="currentItem.name" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="currentItem.order" :min="1" />
        </el-form-item>
        <el-form-item label="圖示 (Emoji)">
          <emoji-picker
            v-model="currentItem.icon"
            button-text="選擇 Emoji"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="currentItem.description" type="textarea" />
        </el-form-item>

        <!-- 統一價格結構 -->
        <el-divider content-position="left">價格設定</el-divider>
        <el-form-item label="價格類型">
          <el-input value="金幣" disabled />
        </el-form-item>
        <el-form-item label="單價 (金幣)">
          <el-input-number v-model="currentItem.unitPrice" :min="1" />
        </el-form-item>

        <!-- 統一數量設定 -->
        <el-divider content-position="left">數量設定</el-divider>
        <el-form-item label="預設數量">
          <el-input-number v-model="currentItem.defaultQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="最小數量">
          <el-input-number v-model="currentItem.minQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="最大數量">
          <el-input-number v-model="currentItem.maxQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="數量單位">
          <el-input v-model="currentItem.quantityUnit" placeholder="如：個" />
        </el-form-item>

        <!-- 道具專屬欄位 -->
        <el-divider content-position="left">道具效果設定</el-divider>
        <el-form-item label="持續時間 (天)">
          <el-input-number v-model="currentItem.duration" :min="1" />
        </el-form-item>
        <template v-if="currentItem.effect">
          <el-form-item label="效果類型">
            <el-select v-model="currentItem.effect.type">
              <el-option label="記憶增強" value="memory" />
              <el-option label="模型升級" value="model" />
            </el-select>
          </el-form-item>
          <el-form-item label="效果值">
            <el-input v-model="currentItem.effect.value" />
          </el-form-item>
          <el-form-item label="效果顯示文字">
            <el-input v-model="currentItem.effect.displayText" />
          </el-form-item>
        </template>

        <!-- 顯示設定 -->
        <el-divider content-position="left">顯示設定</el-divider>
        <template v-if="currentItem.shopConfig">
          <el-form-item label="推薦">
            <el-switch v-model="currentItem.shopConfig.popular" />
          </el-form-item>
        </template>
        <el-form-item label="標籤">
          <el-input v-model="currentItem.badge" placeholder="如：推薦、熱門" />
        </el-form-item>
        <el-form-item label="狀態">
          <el-select v-model="currentItem.status">
            <el-option label="上架" value="active" />
            <el-option label="下架" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>

      <!-- 解鎖卡表單 (character-unlock, photo-unlock, video-unlock, voice-unlock, create) -->
      <el-form
        v-if="currentCategory?.collection === 'unlock_cards'"
        :model="currentItem"
        label-width="140px"
      >
        <el-form-item label="ID">
          <el-input v-model="currentItem.id" :disabled="dialogMode === 'edit'" />
        </el-form-item>
        <el-form-item label="名稱">
          <el-input v-model="currentItem.name" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="currentItem.order" :min="1" />
        </el-form-item>
        <el-form-item label="圖示 (Emoji)">
          <emoji-picker
            v-model="currentItem.icon"
            button-text="選擇 Emoji"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="currentItem.description" type="textarea" />
        </el-form-item>

        <!-- 統一價格結構 -->
        <el-divider content-position="left">價格設定</el-divider>
        <el-form-item label="價格類型">
          <el-input value="金幣" disabled />
        </el-form-item>
        <el-form-item label="單價 (金幣)">
          <el-input-number v-model="currentItem.unitPrice" :min="1" />
        </el-form-item>

        <!-- 統一數量設定 -->
        <el-divider content-position="left">數量設定</el-divider>
        <el-form-item label="預設數量">
          <el-input-number v-model="currentItem.defaultQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="最小數量">
          <el-input-number v-model="currentItem.minQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="最大數量">
          <el-input-number v-model="currentItem.maxQuantity" :min="1" />
        </el-form-item>
        <el-form-item label="數量單位">
          <el-input v-model="currentItem.quantityUnit" placeholder="如：張" />
        </el-form-item>

        <!-- 解鎖卡專屬欄位 -->
        <el-divider content-position="left">分類設定</el-divider>
        <el-form-item label="分類">
          <el-select v-model="currentItem.category">
            <el-option label="角色解鎖" value="character-unlock" />
            <el-option label="拍照解鎖" value="photo-unlock" />
            <el-option label="影片解鎖" value="video-unlock" />
            <el-option label="語音解鎖" value="voice-unlock" />
            <el-option label="創建角色" value="create" />
          </el-select>
        </el-form-item>

        <!-- 顯示設定 -->
        <el-divider content-position="left">顯示設定</el-divider>
        <el-form-item label="推薦">
          <el-switch v-model="currentItem.popular" />
        </el-form-item>
        <el-form-item label="標籤">
          <el-input v-model="currentItem.badge" placeholder="如：推薦、熱門" />
        </el-form-item>
        <el-form-item label="狀態">
          <el-select v-model="currentItem.status">
            <el-option label="上架" value="active" />
            <el-option label="下架" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">確定</el-button>
      </template>
    </el-dialog>

    <!-- 分類管理對話框 -->
    <el-dialog
      v-model="showCategoryDialog"
      title="分類管理"
      width="900px"
    >
      <!-- 分類列表 -->
      <el-button type="primary" @click="handleAddCategory" style="margin-bottom: 15px">
        <el-icon><Plus /></el-icon> 新增分類
      </el-button>

      <el-table :data="categories" border>
        <el-table-column prop="order" label="排序" width="80" />
        <el-table-column label="圖示" width="80">
          <template #default="{ row }">
            <span style="font-size: 24px">{{ row.icon }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="id" label="ID" width="150" />
        <el-table-column prop="label" label="名稱" width="120" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="collection" label="集合名稱" width="150" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="handleEditCategory(row)">編輯</el-button>
            <el-button size="small" type="danger" @click="handleDeleteCategory(row)">刪除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 分類編輯對話框 -->
    <el-dialog
      v-model="categoryEditDialogVisible"
      :title="categoryDialogMode === 'add' ? '新增分類' : '編輯分類'"
      width="500px"
    >
      <el-form :model="editingCategory" label-width="100px">
        <el-form-item label="ID">
          <el-input v-model="editingCategory.id" :disabled="categoryDialogMode === 'edit'" />
        </el-form-item>
        <el-form-item label="名稱">
          <el-input v-model="editingCategory.label" />
        </el-form-item>
        <el-form-item label="圖示">
          <emoji-picker
            v-model="editingCategory.icon"
            button-text="選擇 Emoji"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editingCategory.description" type="textarea" rows="3" />
        </el-form-item>
        <el-form-item label="集合名稱">
          <el-input v-model="editingCategory.collection" placeholder="Firestore 集合名稱" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editingCategory.order" :min="1" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="categoryEditDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveCategory">確定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Search, Setting } from '@element-plus/icons-vue';
import api from '../utils/api';
import EmojiPicker from '../components/EmojiPicker.vue';

// 分類管理
const categories = ref([]);
const loadingCategories = ref(false);
const activeTab = ref('coins');

// 通用商品數據
const products = ref([]);
const loadingProducts = ref(false);

// 當前分類信息
const currentCategory = computed(() => {
  return categories.value.find(cat => cat.id === activeTab.value);
});

// 判斷當前分類是否使用 unlock_cards 集合
const isUnlockCardCategory = computed(() => {
  return currentCategory.value?.collection === 'unlock_cards';
});

// 向後兼容：保留舊的數據引用
const loading = reactive({
  coins: false,
  gifts: false,
  potions: false,
});

const coinPackages = ref([]);
const gifts = ref([]);
const potions = ref([]);

const dialogVisible = ref(false);
const dialogMode = ref('add'); // 'add' | 'edit'
const currentType = ref('coins'); // 'coins' | 'gifts' | 'potions'
const currentItem = ref({});

// 分類管理
const showCategoryDialog = ref(false);
const categoryEditDialogVisible = ref(false);
const categoryDialogMode = ref('add');
const editingCategory = ref({});

// 判斷當前商品列表是否包含某個字段
const hasField = (fieldName) => {
  if (!products.value || products.value.length === 0) return false;
  return products.value.some(product => product[fieldName] !== undefined);
};

// 載入所有商品
const loadAll = async () => {
  await Promise.all([
    loadCoinPackages(),
    loadGifts(),
    loadPotions(),
  ]);
};

// 載入金幣套餐
const loadCoinPackages = async () => {
  loading.coins = true;
  try {
    const response = await api.get('/api/products/coins');
    coinPackages.value = response.data || [];
  } catch (error) {
    ElMessage.error('載入金幣套餐失敗：' + error.message);
  } finally {
    loading.coins = false;
  }
};

// 載入禮物
const loadGifts = async () => {
  loading.gifts = true;
  try {
    const response = await api.get('/api/products/gifts');
    gifts.value = response.data || [];
  } catch (error) {
    ElMessage.error('載入禮物失敗：' + error.message);
  } finally {
    loading.gifts = false;
  }
};

// 載入道具
const loadPotions = async () => {
  loading.potions = true;
  try {
    const response = await api.get('/api/products/potions');
    potions.value = response.data || [];
  } catch (error) {
    ElMessage.error('載入道具失敗：' + error.message);
  } finally {
    loading.potions = false;
  }
};

// 新增商品
const handleAdd = (type) => {
  dialogMode.value = 'add';
  currentType.value = type;

  // 統一的基礎欄位
  const baseFields = {
    id: '',
    name: '',
    description: '',
    order: 1,

    // 統一價格結構
    priceType: 'coins',
    unitPrice: 100,
    currency: null,

    // 統一數量設定
    defaultQuantity: 1,
    minQuantity: 1,
    maxQuantity: 99,
    quantityUnit: '個',

    // 統一顯示設定
    badge: null,
    popular: false,
    status: 'active',
  };

  if (type === 'coins') {
    currentItem.value = {
      ...baseFields,
      icon: '💰',

      // 金幣套餐特殊欄位
      priceType: 'currency',
      unitPrice: 50,
      currency: 'TWD',
      quantityUnit: '份',
      maxQuantity: 1,

      coins: 100,
      bonus: 0,
      totalCoins: 100,
      bestValue: false,
    };
  } else if (type === 'gifts') {
    currentItem.value = {
      ...baseFields,
      icon: '🎁',
      unitPrice: 10,

      // 禮物特殊欄位
      rarity: 'common',
      thankYouMessage: '',
    };
  } else if (type === 'potions') {
    currentItem.value = {
      ...baseFields,
      icon: '🧪',
      unitPrice: 200,

      // 道具特殊欄位
      duration: 30,
      effect: {
        type: 'memory',
        value: 10000,
        displayText: '',
      },
      displayConfig: {
        unit: '個',
        shortDescription: '效用30天',
      },
      shopConfig: {
        category: 'potions',
        popular: false,
        requiresCharacter: false,
        showInShop: true,
      },
    };
  } else if (currentCategory.value?.collection === 'unlock_cards') {
    currentItem.value = {
      ...baseFields,
      icon: '🎭',
      unitPrice: 100,
      quantityUnit: '張',
      maxQuantity: 50,

      // 解鎖卡特殊欄位
      category: 'character-unlock',
    };
  }

  dialogVisible.value = true;
};

// 編輯商品
const handleEdit = (item, type) => {
  dialogMode.value = 'edit';
  currentType.value = type;
  currentItem.value = JSON.parse(JSON.stringify(item)); // 深拷貝
  dialogVisible.value = true;
};

// 保存商品
const handleSave = async () => {
  try {
    // 計算總金幣（針對金幣套餐）
    if (currentType.value === 'coins') {
      currentItem.value.totalCoins = currentItem.value.coins + (currentItem.value.bonus || 0);
    }

    // 確保金幣類型商品的 currency 設為 null
    if (currentItem.value.priceType === 'coins') {
      currentItem.value.currency = null;
    }

    // 獲取當前分類的集合名稱
    const category = categories.value.find(cat => cat.id === currentType.value);
    const collectionName = category?.collection || currentType.value;

    // 使用通用 API
    const endpoint = `/api/products/collection/${collectionName}`;

    if (dialogMode.value === 'add') {
      await api.post(endpoint, currentItem.value);
      ElMessage.success('新增成功');
    } else {
      await api.put(`${endpoint}/${currentItem.value.id}`, currentItem.value);
      ElMessage.success('更新成功');
    }

    dialogVisible.value = false;

    // 重新載入當前分類的數據
    await loadProductsByCategory(currentType.value);
  } catch (error) {
    ElMessage.error('保存失敗：' + error.message);
  }
};

// 刪除商品
const handleDelete = async (item, type) => {
  try {
    await ElMessageBox.confirm(
      `確定要刪除「${item.name}」嗎？`,
      '刪除確認',
      {
        confirmButtonText: '確定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    // 獲取當前分類的集合名稱
    const category = categories.value.find(cat => cat.id === type);
    const collectionName = category?.collection || type;

    // 使用通用 API
    await api.delete(`/api/products/collection/${collectionName}/${item.id}`);
    ElMessage.success('刪除成功');

    // 重新載入當前分類的數據
    await loadProductsByCategory(type);
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('刪除失敗：' + error.message);
    }
  }
};

// 重置表單
const resetForm = () => {
  currentItem.value = {};
};

// 獲取稀有度標籤類型
const getRarityTagType = (rarity) => {
  const types = {
    common: 'info',
    uncommon: 'success',
    rare: 'primary',
    epic: 'warning',
    legendary: 'danger',
  };
  return types[rarity] || 'info';
};

// 獲取稀有度標籤文字
const getRarityLabel = (rarity) => {
  const labels = {
    common: '普通',
    uncommon: '罕見',
    rare: '稀有',
    epic: '史詩',
    legendary: '傳說',
  };
  return labels[rarity] || rarity;
};

// 常用 Emoji 列表
const emojiList = [
  // 花卉
  { emoji: '🌹', label: '玫瑰花' },
  { emoji: '💐', label: '花束' },
  { emoji: '🌺', label: '扶桑花' },
  { emoji: '🌸', label: '櫻花' },
  { emoji: '🌼', label: '雛菊' },
  { emoji: '🌻', label: '向日葵' },
  { emoji: '🌷', label: '鬱金香' },
  { emoji: '💮', label: '白花' },
  { emoji: '🏵️', label: '玫瑰花海' },

  // 禮物/慶祝
  { emoji: '🎁', label: '禮物' },
  { emoji: '🎀', label: '蝴蝶結' },
  { emoji: '🎈', label: '氣球' },
  { emoji: '🎊', label: '彩球' },
  { emoji: '🎉', label: '慶祝' },
  { emoji: '🎂', label: '蛋糕' },
  { emoji: '🍰', label: '蛋糕片' },

  // 珠寶/奢侈品
  { emoji: '💎', label: '鑽石' },
  { emoji: '👑', label: '皇冠' },
  { emoji: '💍', label: '戒指' },
  { emoji: '📿', label: '項鍊' },
  { emoji: '💄', label: '口紅' },
  { emoji: '👜', label: '手提包' },
  { emoji: '👛', label: '錢包' },
  { emoji: '👗', label: '洋裝' },

  // 食物/飲料
  { emoji: '🍫', label: '巧克力' },
  { emoji: '🍬', label: '糖果' },
  { emoji: '🍭', label: '棒棒糖' },
  { emoji: '🍦', label: '冰淇淋' },
  { emoji: '🍩', label: '甜甜圈' },
  { emoji: '🍪', label: '餅乾' },
  { emoji: '🍾', label: '香檳' },
  { emoji: '🍷', label: '紅酒' },
  { emoji: '☕', label: '咖啡' },
  { emoji: '🍵', label: '茶' },

  // 愛心/表情
  { emoji: '❤️', label: '紅心' },
  { emoji: '💖', label: '閃亮愛心' },
  { emoji: '💝', label: '禮物愛心' },
  { emoji: '💗', label: '跳動愛心' },
  { emoji: '💕', label: '雙愛心' },
  { emoji: '💞', label: '旋轉愛心' },
  { emoji: '💓', label: '心跳' },
  { emoji: '💘', label: '丘比特之箭' },
  { emoji: '😍', label: '愛慕' },
  { emoji: '🥰', label: '微笑愛心' },
  { emoji: '😘', label: '飛吻' },
  { emoji: '💋', label: '吻痕' },

  // 動物
  { emoji: '🐻', label: '熊' },
  { emoji: '🧸', label: '泰迪熊' },
  { emoji: '🐰', label: '兔子' },
  { emoji: '🐱', label: '貓咪' },
  { emoji: '🐶', label: '小狗' },
  { emoji: '🦄', label: '獨角獸' },

  // 運動/休閒
  { emoji: '🏆', label: '獎杯' },
  { emoji: '🎮', label: '遊戲機' },
  { emoji: '🎸', label: '吉他' },
  { emoji: '🎨', label: '調色盤' },
  { emoji: '📚', label: '書' },
  { emoji: '🎭', label: '面具' },
  { emoji: '🎪', label: '馬戲團' },

  // 天氣/自然
  { emoji: '⭐', label: '星星' },
  { emoji: '✨', label: '閃光' },
  { emoji: '🌟', label: '發光星星' },
  { emoji: '💫', label: '眩暈' },
  { emoji: '🌙', label: '月亮' },
  { emoji: '🌈', label: '彩虹' },
  { emoji: '🔥', label: '火焰' },
  { emoji: '🎆', label: '煙火' },

  // 汽車/交通
  { emoji: '🚗', label: '汽車' },
  { emoji: '🏎️', label: '跑車' },
  { emoji: '🚀', label: '火箭' },
  { emoji: '✈️', label: '飛機' },
  { emoji: '🛥️', label: '遊艇' },

  // 建築/地點
  { emoji: '🏠', label: '房子' },
  { emoji: '🏰', label: '城堡' },
  { emoji: '🗼', label: '東京鐵塔' },
  { emoji: '🗽', label: '自由女神' },
  { emoji: '🏝️', label: '小島' },
];

// 格式化日期時間
const formatDate = (dateValue) => {
  if (!dateValue) return '-';

  let date;

  // 處理 Firestore Timestamp 對象格式 { _seconds, _nanoseconds }
  if (typeof dateValue === 'object' && dateValue._seconds) {
    date = new Date(dateValue._seconds * 1000);
  }
  // 處理 ISO 字符串或其他可解析格式
  else {
    date = new Date(dateValue);
  }

  // 檢查日期是否有效
  if (isNaN(date.getTime())) return '-';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// 載入所有分類
const loadCategories = async () => {
  loadingCategories.value = true;
  try {
    const response = await api.get('/api/categories');
    categories.value = response.data || [];
    console.log('載入分類:', categories.value);
    console.log('分類數量:', categories.value.length);
    console.log('第一個分類:', categories.value[0]);
  } catch (error) {
    ElMessage.error('載入分類失敗：' + error.message);
    console.error('載入分類錯誤:', error);
  } finally {
    loadingCategories.value = false;
  }
};

// 根據分類載入商品
const loadProductsByCategory = async (categoryId) => {
  const category = categories.value.find(cat => cat.id === categoryId);
  if (!category || !category.collection) {
    console.warn('分類或集合不存在:', categoryId);
    return;
  }

  loadingProducts.value = true;
  try {
    const response = await api.get(`/api/products/collection/${category.collection}`);
    let allProducts = response.data || [];

    // 對於 unlock_cards 集合，需要按 category 字段過濾
    if (category.collection === 'unlock_cards') {
      allProducts = allProducts.filter(product => product.category === categoryId);
    }

    // 按照 order 欄位排序（從小到大）
    allProducts.sort((a, b) => (a.order || 0) - (b.order || 0));

    products.value = allProducts;
    console.log(`載入 ${category.label} 商品:`, products.value);
  } catch (error) {
    ElMessage.error(`載入${category.label}失敗：` + error.message);
    products.value = [];
  } finally {
    loadingProducts.value = false;
  }
};

// 監聽分類切換
watch(activeTab, (newTab) => {
  console.log('切換到分類:', newTab);
  loadProductsByCategory(newTab);
});

// ============ 分類管理函數 ============

// 新增分類
const handleAddCategory = () => {
  categoryDialogMode.value = 'add';
  editingCategory.value = {
    id: '',
    label: '',
    icon: '',
    description: '',
    collection: '',
    order: categories.value.length + 1,
  };
  categoryEditDialogVisible.value = true;
};

// 編輯分類
const handleEditCategory = (category) => {
  categoryDialogMode.value = 'edit';
  editingCategory.value = JSON.parse(JSON.stringify(category));
  categoryEditDialogVisible.value = true;
};

// 保存分類
const handleSaveCategory = async () => {
  try {
    if (categoryDialogMode.value === 'add') {
      await api.post('/api/categories', editingCategory.value);
      ElMessage.success('新增分類成功');
    } else {
      await api.put(`/api/categories/${editingCategory.value.id}`, editingCategory.value);
      ElMessage.success('更新分類成功');
    }
    categoryEditDialogVisible.value = false;
    await loadCategories();
  } catch (error) {
    ElMessage.error('保存分類失敗：' + error.message);
  }
};

// 刪除分類
const handleDeleteCategory = async (category) => {
  try {
    await ElMessageBox.confirm(
      `確定要刪除分類「${category.label}」嗎？`,
      '警告',
      {
        confirmButtonText: '確定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await api.delete(`/api/categories/${category.id}`);
    ElMessage.success('刪除分類成功');
    await loadCategories();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('刪除分類失敗：' + error.message);
    }
  }
};

onMounted(async () => {
  // 先載入分類
  await loadCategories();

  // 如果有分類，載入第一個分類的商品
  if (categories.value.length > 0) {
    await loadProductsByCategory(activeTab.value);
  }

  // 向後兼容：載入舊的三個固定分類
  loadAll();
});
</script>

<style scoped>
.products-page {
  padding: 20px;
}

h2 {
  margin: 0 0 20px 0;
  font-size: 24px;
  font-weight: 600;
}

.el-card {
  border-radius: 8px;
}

:deep(.el-tabs__content) {
  padding: 20px 0;
}
</style>
