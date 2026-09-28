<template>
  <div ref="wrap" class="tp-wrap">
    <button
      type="button"
      class="icon-btn"
      :class="{ 'icon-btn-compact': compact }"
      :aria-label="triggerLabel"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <component :is="triggerIcon" :size="compact ? 15 : 19" :stroke-width="1.8" aria-hidden="true" />
    </button>

    <Transition name="tp">
      <div v-if="open" class="tp-menu glass" role="menu" aria-label="主题">
        <button
          v-for="o in options"
          :key="o.value"
          type="button"
          class="tp-item"
          role="menuitemradio"
          :aria-checked="theme === o.value"
          @click="select(o.value)"
        >
          <component :is="o.icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ o.label }}</span>
          <Check v-if="theme === o.value" class="tp-check" :size="16" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, Moon, Sun, SunMoon } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'

defineProps({
  // Sticky Header 里的迷你尺寸
  compact: { type: Boolean, default: false },
})

const { theme, resolvedTheme, setTheme } = useTheme()
const open = ref(false)
const wrap = ref(null)

const options = [
  { value: 'system', label: '跟随系统', icon: SunMoon },
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
]

const LABELS = { system: '跟随系统', light: '浅色', dark: '深色' }

const triggerIcon = computed(() => {
  if (theme.value === 'system') return SunMoon
  return resolvedTheme.value === 'dark' ? Moon : Sun
})

const triggerLabel = computed(() => `主题：${LABELS[theme.value] || '跟随系统'}`)

function select(value) {
  setTheme(value)
  open.value = false
}

function onDocPointer(e) {
  if (open.value && wrap.value && !wrap.value.contains(e.target)) open.value = false
}

function onKey(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true)
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
  document.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.tp-wrap {
  position: relative;
}

.icon-btn-compact {
  width: 30px;
  height: 30px;
}

.tp-menu {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 172px;
  padding: 6px;
  border-radius: 18px;
  background: var(--glass-bg-strong);
  z-index: 40;
}

.tp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: 11px;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: background 160ms ease;
}

.tp-item:hover {
  background: var(--glass-bg-hover);
}

.tp-check {
  margin-left: auto;
  color: var(--accent);
}

.tp-enter-active,
.tp-leave-active {
  transition:
    opacity 200ms var(--ease-glass),
    transform 200ms var(--ease-glass);
}

.tp-enter-from,
.tp-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
