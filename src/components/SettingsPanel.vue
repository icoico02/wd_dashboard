<template>
  <Teleport to="body">
    <Transition name="sp-fade">
      <div v-if="open" class="sp-overlay" @click="emit('close')"></div>
    </Transition>

    <Transition name="sp">
      <div
        v-if="open"
        ref="panel"
        class="sp-panel glass"
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        tabindex="-1"
      >
        <div class="sp-handle" aria-hidden="true"></div>

        <header class="sp-head">
          <h2 class="sp-title">设置</h2>
          <button type="button" class="sp-close" aria-label="关闭设置" @click="emit('close')">
            <X :size="16" aria-hidden="true" />
          </button>
        </header>

        <section class="sp-section">
          <h3 class="sp-label">主题</h3>
          <div class="seg" role="group" aria-label="主题模式">
            <span class="seg-thumb" :style="segStyle(themeOptions, theme)" aria-hidden="true"></span>
            <button
              v-for="o in themeOptions"
              :key="o.value"
              type="button"
              :class="{ active: theme === o.value }"
              :aria-pressed="theme === o.value"
              @click="setTheme(o.value)"
            >
              <component :is="o.icon" :size="15" :stroke-width="1.8" aria-hidden="true" />
              {{ o.label }}
            </button>
          </div>
        </section>

        <section class="sp-section">
          <h3 class="sp-label">卡片尺寸</h3>
          <div class="seg" role="group" aria-label="卡片尺寸">
            <span
              class="seg-thumb"
              :style="segStyle(sizeOptions, settings.cardSize)"
              aria-hidden="true"
            ></span>
            <button
              v-for="o in sizeOptions"
              :key="o.value"
              type="button"
              :class="{ active: settings.cardSize === o.value }"
              :aria-pressed="settings.cardSize === o.value"
              @click="set('cardSize', o.value)"
            >
              {{ o.label }}
            </button>
          </div>
        </section>

        <section class="sp-section sp-row">
          <div>
            <h3 class="sp-label">动画</h3>
            <p class="sp-hint">入场与过渡动效</p>
          </div>
          <button
            type="button"
            class="ios-switch"
            role="switch"
            aria-label="动画"
            :aria-checked="settings.animations"
            @click="set('animations', !settings.animations)"
          ></button>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Moon, Sun, SunMoon, X } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'
import { useSettings } from '../composables/useSettings'

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const { theme, setTheme } = useTheme()
const { settings, set } = useSettings()
const panel = ref(null)

const themeOptions = [
  { value: 'system', label: '系统', icon: SunMoon },
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
]

const sizeOptions = [
  { value: 'comfortable', label: '舒适' },
  { value: 'compact', label: '紧凑' },
]

function segStyle(options, current) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === current),
  )
  return {
    width: `calc((100% - 6px) / ${options.length})`,
    transform: `translateX(${idx * 100}%)`,
  }
}

function onKey(e) {
  if (e.key === 'Escape' && props.open) emit('close')
}

watch(
  () => props.open,
  (v) => {
    document.body.classList.toggle('no-scroll', v)
    if (v) nextTick(() => panel.value?.focus())
  },
)

onMounted(() => document.addEventListener('keydown', onKey))

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.body.classList.remove('no-scroll')
})
</script>

<style scoped>
.sp-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(8, 10, 16, 0.32);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

.sp-panel {
  position: fixed;
  z-index: 1101;
  padding: 16px 18px 18px;
  outline: none;
  background: var(--glass-bg-strong);
}

.sp-handle {
  display: none;
  width: 36px;
  height: 5px;
  border-radius: 999px;
  background: rgba(120, 120, 128, 0.35);
  margin: 2px auto 10px;
}

.sp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.sp-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.sp-close {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  transition: background 160ms ease, transform 120ms var(--ease-glass);
}

.sp-close:hover {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.sp-close:active {
  transform: scale(0.92);
}

.sp-section {
  margin-top: 18px;
}

.sp-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.sp-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.sp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sp-row .sp-label {
  margin-bottom: 2px;
}

.seg {
  position: relative;
  display: flex;
  padding: 3px;
  border-radius: 13px;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
}

.seg button {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 180ms ease;
}

.seg button.active {
  color: var(--text-primary);
  font-weight: 600;
}

.seg-thumb {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  border-radius: 10px;
  background: var(--seg-thumb-bg);
  box-shadow: var(--seg-thumb-shadow);
  transition: transform 240ms var(--ease-glass);
}

/* 桌面：右上角 Popover */
@media (min-width: 768px) {
  .sp-panel {
    top: calc(86px + env(safe-area-inset-top));
    right: max(var(--page-pad), calc((100vw - var(--page-max)) / 2 + var(--page-pad)));
    width: 320px;
    border-radius: var(--radius-xl);
  }
}

/* 手机：Bottom Sheet */
@media (max-width: 767px) {
  .sp-overlay {
    background: rgba(8, 10, 16, 0.4);
  }

  .sp-panel {
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 26px 26px 0 0;
    padding-bottom: calc(18px + env(safe-area-inset-bottom));
    max-height: 85vh;
    overflow-y: auto;
  }

  .sp-handle {
    display: block;
  }
}

.sp-enter-active,
.sp-leave-active {
  transition:
    opacity 280ms var(--ease-glass),
    transform 280ms var(--ease-glass);
}

.sp-enter-from,
.sp-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.97);
}

@media (max-width: 767px) {
  .sp-enter-from,
  .sp-leave-to {
    transform: translateY(100%);
  }
}

.sp-fade-enter-active,
.sp-fade-leave-active {
  transition: opacity 240ms ease;
}

.sp-fade-enter-from,
.sp-fade-leave-to {
  opacity: 0;
}
</style>
