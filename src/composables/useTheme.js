import { computed, ref, watchEffect } from 'vue'

const THEME_KEY = 'dada-dashboard:theme'

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY)
  } catch {
    return null
  }
}

const theme = ref(readStoredTheme() || 'system')

const media = window.matchMedia('(prefers-color-scheme: dark)')
const systemPrefersDark = ref(media.matches)

function onSystemChange(e) {
  systemPrefersDark.value = e.matches
}

if (media.addEventListener) {
  media.addEventListener('change', onSystemChange)
} else if (media.addListener) {
  media.addListener(onSystemChange)
}

const resolvedTheme = computed(() =>
  theme.value === 'system' ? (systemPrefersDark.value ? 'dark' : 'light') : theme.value,
)

watchEffect(() => {
  const t = resolvedTheme.value
  document.documentElement.dataset.theme = t
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', t === 'dark' ? '#0b0c10' : '#edf0f6')
})

export function useTheme() {
  function setTheme(next) {
    theme.value = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* 隐私模式等场景下静默失败 */
    }
  }

  return { theme, resolvedTheme, setTheme }
}
