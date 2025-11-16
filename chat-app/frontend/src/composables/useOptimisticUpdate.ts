// @ts-nocheck
/**
 * 樂觀更新 Composable
 * 提供樂觀 UI 更新功能，在等待 API 響應前先更新 UI
 * 如果 API 失敗，自動回滾到原始狀態
 */

import { ref, Ref } from 'vue';
import { useToast } from './useToast.js';

/**
 * 樂觀更新配置接口
 */
interface OptimisticUpdateConfig<T = any> {
  optimisticUpdate?: () => void;
  apiCall: () => Promise<T>;
  rollback?: () => void;
  onSuccess?: (result: T) => void;
  errorMessage?: string;
}

/**
 * 樂觀更新初始化選項
 */
interface UseOptimisticUpdateOptions {
  onError?: ((error: Error) => void) | null;
  showErrorToast?: boolean;
}

/**
 * 樂觀更新返回類型
 */
interface OptimisticUpdateReturn {
  execute: <T = any>(key: string, config: OptimisticUpdateConfig<T>) => Promise<T>;
  isPending: (key: string) => boolean;
  clearPending: () => void;
  pendingUpdates: Ref<Map<string, Promise<any>>>;
}

/**
 * 列表項目配置接口
 */
interface ListItem {
  id: string | number;
  [key: string]: any;
}

/**
 * 添加項目配置接口
 */
interface AddItemConfig<T extends ListItem = ListItem> {
  list: Ref<T[]>;
  item: T;
  apiCall: () => Promise<any>;
  position?: 'start' | 'end';
}

/**
 * 移除項目配置接口
 */
interface RemoveItemConfig<T extends ListItem = ListItem> {
  list: Ref<T[]>;
  itemId: string | number;
  apiCall: () => Promise<any>;
  findItem?: ((item: T) => boolean) | null;
}

/**
 * 更新項目配置接口
 */
interface UpdateItemConfig<T extends ListItem = ListItem> {
  list: Ref<T[]>;
  itemId: string | number;
  updates: Partial<T> | ((item: T) => Partial<T>);
  apiCall: () => Promise<any>;
  findItem?: ((item: T) => boolean) | null;
}

/**
 * 切換屬性配置接口
 */
interface TogglePropertyConfig<T extends ListItem = ListItem> {
  list: Ref<T[]>;
  itemId: string | number;
  property: keyof T;
  apiCall: () => Promise<any>;
}

/**
 * 樂觀更新列表返回類型
 */
interface OptimisticListReturn {
  addItem: <T extends ListItem = ListItem>(config: AddItemConfig<T>) => Promise<any>;
  removeItem: <T extends ListItem = ListItem>(config: RemoveItemConfig<T>) => Promise<any>;
  updateItem: <T extends ListItem = ListItem>(config: UpdateItemConfig<T>) => Promise<any>;
  toggleProperty: <T extends ListItem = ListItem>(config: TogglePropertyConfig<T>) => Promise<any>;
  isPending: (key: string) => boolean;
  clearPending: () => void;
}

/**
 * 更新值配置接口
 */
interface UpdateValueConfig<T = any> {
  value: Ref<T>;
  newValue: T;
  apiCall: () => Promise<any>;
  key?: string;
}

/**
 * 切換布爾值配置接口
 */
interface ToggleBooleanConfig {
  value: Ref<boolean>;
  apiCall: () => Promise<any>;
  key?: string;
}

/**
 * 調整數值配置接口
 */
interface AdjustNumberConfig {
  value: Ref<number>;
  delta: number;
  apiCall: () => Promise<any>;
  key?: string;
}

/**
 * 樂觀更新值返回類型
 */
interface OptimisticValueReturn {
  updateValue: <T = any>(config: UpdateValueConfig<T>) => Promise<any>;
  toggleBoolean: (config: ToggleBooleanConfig) => Promise<any>;
  adjustNumber: (config: AdjustNumberConfig) => Promise<any>;
  isPending: (key: string) => boolean;
  clearPending: () => void;
}

/**
 * 創建樂觀更新實例
 * @param options - 選項
 * @param options.onError - 錯誤處理回調
 * @param options.showErrorToast - 是否顯示錯誤 Toast（默認 true）
 * @returns 樂觀更新工具
 */
export function useOptimisticUpdate(options: UseOptimisticUpdateOptions = {}): OptimisticUpdateReturn {
  const { onError = null, showErrorToast = true } = options;
  const { error: showError } = useToast();

  // 追蹤正在進行的樂觀更新
  const pendingUpdates: Ref<Map<string, Promise<any>>> = ref(new Map());

  /**
   * 執行樂觀更新
   * @param key - 更新的唯一標識
   * @param config - 配置
   * @returns API 調用結果
   */
  const execute = async <T = any>(key: string, config: OptimisticUpdateConfig<T>): Promise<T> => {
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
      return pendingUpdates.value.get(key) as Promise<T>;
    }

    try {
      // 1. 立即執行樂觀更新（更新 UI）
      if (optimisticUpdate && typeof optimisticUpdate === 'function') {
        optimisticUpdate();
      }

      // 2. 執行 API 調用
      const promise = apiCall() as Promise<T>;
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
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      console.error(`[Optimistic Update] 更新 "${key}" 失敗:`, errorInstance);

      if (showErrorToast) {
        showError(errorInstance.message || errorMessage);
      }

      if (onError && typeof onError === 'function') {
        onError(errorInstance);
      }

      throw errorInstance; // 重新拋出錯誤以允許調用者處理
    } finally {
      // 清理追蹤
      pendingUpdates.value.delete(key);
    }
  };

  /**
   * 檢查特定更新是否正在進行中
   * @param key - 更新的唯一標識
   * @returns 是否正在進行中
   */
  const isPending = (key: string): boolean => {
    return pendingUpdates.value.has(key);
  };

  /**
   * 清除所有待處理的更新追蹤
   */
  const clearPending = (): void => {
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
 * @returns 列表樂觀更新工具
 */
export function useOptimisticList(): OptimisticListReturn {
  const optimistic = useOptimisticUpdate();

  /**
   * 樂觀添加項目到列表
   * @param config - 配置
   * @returns 操作 Promise
   */
  const addItem = async <T extends ListItem = ListItem>(config: AddItemConfig<T>): Promise<any> => {
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
        const index = list.value.findIndex((i: T) => i === item || i.id === item.id);
        if (index !== -1) {
          list.value.splice(index, 1);
        }
      },
    });
  };

  /**
   * 樂觀刪除列表項目
   * @param config - 配置
   * @returns 操作 Promise
   */
  const removeItem = async <T extends ListItem = ListItem>(config: RemoveItemConfig<T>): Promise<any> => {
    const { list, itemId, apiCall, findItem = null } = config;
    const key = `remove-${itemId}`;

    // 查找要刪除的項目
    const finder = findItem || ((item: T) => item.id === itemId);
    const index = list.value.findIndex(finder as (item: T) => boolean);

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
   * @param config - 配置
   * @returns 操作 Promise
   */
  const updateItem = async <T extends ListItem = ListItem>(config: UpdateItemConfig<T>): Promise<any> => {
    const { list, itemId, updates, apiCall, findItem = null } = config;
    const key = `update-${itemId}`;

    // 查找要更新的項目
    const finder = findItem || ((item: T) => item.id === itemId);
    const index = list.value.findIndex(finder as (item: T) => boolean);

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
   * @param config - 配置
   * @returns 操作 Promise
   */
  const toggleProperty = async <T extends ListItem = ListItem>(config: TogglePropertyConfig<T>): Promise<any> => {
    const { list, itemId, property, apiCall } = config;
    const index = list.value.findIndex((item: T) => item.id === itemId);

    if (index === -1) {
      console.warn(`[Optimistic List] 找不到項目 ID: ${itemId}`);
      return;
    }

    const originalValue = list.value[index][property];

    return optimistic.execute(`toggle-${itemId}-${String(property)}`, {
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
 * @returns 值樂觀更新工具
 */
export function useOptimisticValue(): OptimisticValueReturn {
  const optimistic = useOptimisticUpdate();

  /**
   * 樂觀更新單個值
   * @param config - 配置
   * @returns 操作 Promise
   */
  const updateValue = async <T = any>(config: UpdateValueConfig<T>): Promise<any> => {
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
   * @param config - 配置
   * @returns 操作 Promise
   */
  const toggleBoolean = async (config: ToggleBooleanConfig): Promise<any> => {
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
   * @param config - 配置
   * @returns 操作 Promise
   */
  const adjustNumber = async (config: AdjustNumberConfig): Promise<any> => {
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
