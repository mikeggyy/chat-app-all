import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue';

/**
 * 追蹤組件掛載狀態的 Composable
 *
 * 用於防止快速路由切換時的競態條件：
 * - 組件已卸載但異步操作仍在執行
 * - 避免更新已卸載組件的狀態
 *
 * @example
 * ```ts
 * const isMounted = useIsMounted();
 *
 * watch(userId, async (newId) => {
 *   const data = await fetchData(newId);
 *
 *   // ✅ 檢查組件是否仍然掛載
 *   if (!isMounted.value) return;
 *
 *   // 安全地更新狀態
 *   state.value = data;
 * });
 * ```
 */
export function useIsMounted(): Ref<boolean> {
  const isMounted = ref<boolean>(false);

  onMounted(() => {
    isMounted.value = true;
  });

  onBeforeUnmount(() => {
    isMounted.value = false;
  });

  return isMounted;
}
