/**
 * 樂觀更新 Composable
 * 提供樂觀 UI 更新功能，在等待 API 響應前先更新 UI
 * 如果 API 失敗，自動回滾到原始狀態
 */

import { ref } from 'vue';
import { useToast } from './useToast';

/**
 * 創建樂觀更新實例
 * @param {Object} options - 選項
 * @param {Function} options.onError - 錯誤處理回調
 * @param {boolean} options.showErrorToast - 是否顯示錯誤 Toast（默認 true）
 * @returns {Object} 樂觀更新工具
 */
export function useOptimisticUpdate(options = {}) {
  const { onError = null, showErrorToast = true } = options;
  const { error: showError } = useToast();

  // 追蹤正在進行的樂觀更新
  const pendingUpdates = ref(new Map());

  /**
   * 執行樂觀更新
   * @param {string} key - 更新的唯一標識
   * @param {Object} config - 配置
   * @param {Function} config.optimisticUpdate - 樂觀更新函數（立即執行）
   * @param {Function} config.apiCall - API 調用函數
   * @param {Function} config.rollback - 回滾函數（失敗時執行）
   * @param {Function} config.onSuccess - 成功回調（可選）
   * @param {string} config.errorMessage - 自定義錯誤消息（可選）
   * @returns {Promise} API 調用結果
   */
  const execute = async (key, config) => {
    const {
      optimisticUpdate,
      apiCall,
      rollback,
      onSuccess = null,
      errorMessage = '操作失敗，請重試',
    } = config;

    // 檢查是否已有相同的更新在進行中
    if (pendingUpdates.value.has(key)) {
      console.warn(`[Optimistic Update] 更新 "${key}" 已在進行中，跳過重複請求`);
      return pendingUpdates.value.get(key);
    }

    try {
      // 1. 立即執行樂觀更新（更新 UI）
      if (optimisticUpdate && typeof optimisticUpdate === 'function') {
        optimisticUpdate();
      }

      // 2. 執行 API 調用
      const promise = apiCall();
      pendingUpdates.value.set(key, promise);

      const result = await promise;

      // 3. API 成功，調用成功回調
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      // 4. API 失敗，執行回滾
      if (rollback && typeof rollback === 'function') {
        rollback();
      }

      // 5. 錯誤處理
      console.error(`[Optimistic Update] 更新 "${key}" 失敗:`, error);

      if (showErrorToast) {
        showError(error.message || errorMessage);
      }

      if (onError && typeof onError === 'function') {
        onError(error);
      }

      throw error; // 重新拋出錯誤以允許調用者處理
    } finally {
      // 清理追蹤
      pendingUpdates.value.delete(key);
    }
  };

  /**
   * 檢查特定更新是否正在進行中
   * @param {string} key - 更新的唯一標識
   * @returns {boolean}
   */
  const isPending = (key) => {
    return pendingUpdates.value.has(key);
  };

  /**
   * 清除所有待處理的更新追蹤
   */
  const clearPending = () => {
    pendingUpdates.value.clear();
  };

  return {
    execute,
    isPending,
    clearPending,
    pendingUpdates,
  };
}

/**
 * 創建簡化的樂觀更新工具（針對列表操作）
 * @returns {Object} 列表樂觀更新工具
 */
export function useOptimisticList() {
  const optimistic = useOptimisticUpdate();

  /**
   * 樂觀添加項目到列表
   * @param {Object} config - 配置
   * @param {Ref} config.list - 列表 ref
   * @param {Object} config.item - 要添加的項目
   * @param {Function} config.apiCall - API 調用
   * @param {string} config.position - 插入位置（'start' | 'end'，默認 'end'）
   * @returns {Promise}
   */
  const addItem = async (config) => {
    const { list, item, apiCall, position = 'end' } = config;
    const key = `add-${Date.now()}`;

    return optimistic.execute(key, {
      optimisticUpdate: () => {
        if (position === 'start') {
          list.value.unshift(item);
        } else {
          list.value.push(item);
        }
      },
      apiCall,
      rollback: () => {
        const index = list.value.findIndex((i) => i === item || i.id === item.id);
        if (index !== -1) {
          list.value.splice(index, 1);
        }
      },
    });
  };

  /**
   * 樂觀刪除列表項目
   * @param {Object} config - 配置
   * @param {Ref} config.list - 列表 ref
   * @param {string|number} config.itemId - 項目 ID
   * @param {Function} config.apiCall - API 調用
   * @param {Function} config.findItem - 查找項目函數（可選）
   * @returns {Promise}
   */
  const removeItem = async (config) => {
    const { list, itemId, apiCall, findItem = null } = config;
    const key = `remove-${itemId}`;

    // 查找要刪除的項目
    const finder = findItem || ((item) => item.id === itemId);
    const index = list.value.findIndex(finder);

    if (index === -1) {
      console.warn(`[Optimistic List] 找不到項目 ID: ${itemId}`);
      return;
    }

    const removedItem = list.value[index];

    return optimistic.execute(key, {
      optimisticUpdate: () => {
        list.value.splice(index, 1);
      },
      apiCall,
      rollback: () => {
        list.value.splice(index, 0, removedItem);
      },
    });
  };

  /**
   * 樂觀更新列表項目
   * @param {Object} config - 配置
   * @param {Ref} config.list - 列表 ref
   * @param {string|number} config.itemId - 項目 ID
   * @param {Object|Function} config.updates - 更新內容（對象或函數）
   * @param {Function} config.apiCall - API 調用
   * @param {Function} config.findItem - 查找項目函數（可選）
   * @returns {Promise}
   */
  const updateItem = async (config) => {
    const { list, itemId, updates, apiCall, findItem = null } = config;
    const key = `update-${itemId}`;

    // 查找要更新的項目
    const finder = findItem || ((item) => item.id === itemId);
    const index = list.value.findIndex(finder);

    if (index === -1) {
      console.warn(`[Optimistic List] 找不到項目 ID: ${itemId}`);
      return;
    }

    const originalItem = { ...list.value[index] };
    const updatedData = typeof updates === 'function' ? updates(originalItem) : updates;

    return optimistic.execute(key, {
      optimisticUpdate: () => {
        list.value[index] = { ...originalItem, ...updatedData };
      },
      apiCall,
      rollback: () => {
        list.value[index] = originalItem;
      },
    });
  };

  /**
   * 樂觀切換布爾值屬性
   * @param {Object} config - 配置
   * @param {Ref} config.list - 列表 ref
   * @param {string|number} config.itemId - 項目 ID
   * @param {string} config.property - 屬性名
   * @param {Function} config.apiCall - API 調用
   * @returns {Promise}
   */
  const toggleProperty = async (config) => {
    const { list, itemId, property, apiCall } = config;
    const index = list.value.findIndex((item) => item.id === itemId);

    if (index === -1) {
      console.warn(`[Optimistic List] 找不到項目 ID: ${itemId}`);
      return;
    }

    const originalValue = list.value[index][property];

    return optimistic.execute(`toggle-${itemId}-${property}`, {
      optimisticUpdate: () => {
        list.value[index][property] = !originalValue;
      },
      apiCall,
      rollback: () => {
        list.value[index][property] = originalValue;
      },
    });
  };

  return {
    addItem,
    removeItem,
    updateItem,
    toggleProperty,
    isPending: optimistic.isPending,
    clearPending: optimistic.clearPending,
  };
}

/**
 * 創建簡化的樂觀更新工具（針對單個值）
 * @returns {Object} 值樂觀更新工具
 */
export function useOptimisticValue() {
  const optimistic = useOptimisticUpdate();

  /**
   * 樂觀更新單個值
   * @param {Object} config - 配置
   * @param {Ref} config.value - 值 ref
   * @param {*} config.newValue - 新值
   * @param {Function} config.apiCall - API 調用
   * @param {string} config.key - 更新的唯一標識（可選）
   * @returns {Promise}
   */
  const updateValue = async (config) => {
    const { value, newValue, apiCall, key = 'value-update' } = config;
    const originalValue = value.value;

    return optimistic.execute(key, {
      optimisticUpdate: () => {
        value.value = newValue;
      },
      apiCall,
      rollback: () => {
        value.value = originalValue;
      },
    });
  };

  /**
   * 樂觀切換布爾值
   * @param {Object} config - 配置
   * @param {Ref} config.value - 布爾值 ref
   * @param {Function} config.apiCall - API 調用
   * @param {string} config.key - 更新的唯一標識（可選）
   * @returns {Promise}
   */
  const toggleBoolean = async (config) => {
    const { value, apiCall, key = 'boolean-toggle' } = config;
    const originalValue = value.value;

    return optimistic.execute(key, {
      optimisticUpdate: () => {
        value.value = !originalValue;
      },
      apiCall,
      rollback: () => {
        value.value = originalValue;
      },
    });
  };

  /**
   * 樂觀增減數值
   * @param {Object} config - 配置
   * @param {Ref} config.value - 數值 ref
   * @param {number} config.delta - 增減量
   * @param {Function} config.apiCall - API 調用
   * @param {string} config.key - 更新的唯一標識（可選）
   * @returns {Promise}
   */
  const adjustNumber = async (config) => {
    const { value, delta, apiCall, key = 'number-adjust' } = config;
    const originalValue = value.value;

    return optimistic.execute(key, {
      optimisticUpdate: () => {
        value.value = originalValue + delta;
      },
      apiCall,
      rollback: () => {
        value.value = originalValue;
      },
    });
  };

  return {
    updateValue,
    toggleBoolean,
    adjustNumber,
    isPending: optimistic.isPending,
    clearPending: optimistic.clearPending,
  };
}

export default {
  useOptimisticUpdate,
  useOptimisticList,
  useOptimisticValue,
};
