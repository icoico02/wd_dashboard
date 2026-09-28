import { ref } from 'vue'

const NETWORK_KEY = 'dada-dashboard:network'

function readStoredMode() {
  try {
    return localStorage.getItem(NETWORK_KEY) === 'external' ? 'external' : 'internal'
  } catch {
    return 'internal'
  }
}

const mode = ref(readStoredMode())

export function useNetworkMode() {
  function setMode(next) {
    mode.value = next
    try {
      localStorage.setItem(NETWORK_KEY, next)
    } catch {
      /* ignore */
    }
  }

  return { mode, setMode }
}

/**
 * 解析项目实际跳转地址：
 * 内网模式优先 internalUrl，外网模式优先 externalUrl，均未配置时回退 url
 */
export function resolveUrl(item, mode) {
  if (!item) return '#'
  const list =
    mode === 'external'
      ? [item.externalUrl, item.url, item.internalUrl]
      : [item.internalUrl, item.url, item.externalUrl]
  return list.find((u) => typeof u === 'string' && u && u !== '') || '#'
}
