import { computed, ref } from 'vue'

const activeRequests = ref(0)
const isForcedHidden = ref(false)

const isGlobalLoading = computed(
  () => !isForcedHidden.value && activeRequests.value > 0
)

const startLoading = () => {
  activeRequests.value += 1
}

const stopLoading = () => {
  if (activeRequests.value > 0) {
    activeRequests.value -= 1
  }
}

const withGlobalLoading = async (fn, { skipGlobalLoading } = {}) => {
  if (skipGlobalLoading) {
    return fn()
  }

  startLoading()
  try {
    return await fn()
  } finally {
    stopLoading()
  }
}

const temporarilyDisable = async (fn) => {
  isForcedHidden.value = true
  try {
    return await fn?.()
  } finally {
    isForcedHidden.value = false
  }
}

export const useGlobalLoading = () => ({
  isGlobalLoading,
  startLoading,
  stopLoading,
  withGlobalLoading,
  temporarilyDisable,
})

export { isGlobalLoading, withGlobalLoading, temporarilyDisable }
