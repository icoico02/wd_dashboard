import { ref, watch, watchEffect } from 'vue'

const SETTINGS_KEY = 'dada-dashboard:settings'

const defaults = {
  cardSize: 'comfortable', // comfortable | compact
  animations: true, // 动效开关
}

function loadSettings() {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) }
  } catch {
    return { ...defaults }
  }
}

const settings = ref(loadSettings())

watchEffect(() => {
  const s = settings.value
  document.documentElement.dataset.cardSize = s.cardSize === 'compact' ? 'compact' : 'comfortable'
  document.documentElement.dataset.animations = s.animations ? 'on' : 'off'
})

watch(
  settings,
  (v) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  },
  { deep: true },
)

export function useSettings() {
  function set(key, value) {
    settings.value = { ...settings.value, [key]: value }
  }

  return { settings, set }
}
