<template>
  <div class="gc" :class="{ 'gc-collapsed': collapsed && isMobile }">
    <!-- 紧凑头：图标 + 开关 -->
    <div class="gc-head glass">
      <button
        type="button"
        class="gc-expand"
        :aria-label="collapsed ? '展开手势控制' : '收起手势控制'"
        @click="collapsed = !collapsed"
      >
        <Hand :size="16" :stroke-width="1.8" aria-hidden="true" />
      </button>

      <div class="gc-head-main">
        <span class="gc-title">手势控制</span>
        <span v-if="!collapsed" class="gc-status" :class="statusTone">
          {{ statusText }}
        </span>
        <span v-else class="gc-status" :class="statusTone">{{ enabled ? 'ON' : 'OFF' }}</span>
      </div>

      <button
        type="button"
        class="ios-switch mini"
        role="switch"
        aria-label="手势控制总开关"
        :aria-checked="enabled"
        :disabled="busy"
        @click="toggle"
      ></button>
    </div>

    <!-- 详细面板 -->
    <Transition name="gc-pop">
      <div v-if="!collapsed" class="gc-panel glass">
        <div class="gc-row">
          <span class="gc-label">当前状态</span>
          <span class="gc-value">{{ stateLabel }} · {{ gestureLabel }}</span>
        </div>

        <div v-if="statusText" class="gc-msg">{{ statusText }}</div>

        <!-- 灵敏度 -->
        <div class="gc-block">
          <div class="gc-label">灵敏度</div>
          <div class="seg gc-seg" role="group" aria-label="手势灵敏度">
            <span class="seg-thumb" :style="segStyle(sensOptions, prefs.sensitivity)" aria-hidden="true"></span>
            <button
              v-for="o in sensOptions"
              :key="o.value"
              type="button"
              :class="{ active: prefs.sensitivity === o.value }"
              :aria-pressed="prefs.sensitivity === o.value"
              @click="setSensitivity(o.value)"
            >
              {{ o.label }}
            </button>
          </div>
        </div>

        <!-- 预览 / Debug 开关 -->
        <div class="gc-row">
          <div>
            <div class="gc-label">摄像头预览</div>
            <div class="gc-hint">显示骨架与 Palm Center</div>
          </div>
          <button
            type="button"
            class="ios-switch mini"
            role="switch"
            aria-label="显示摄像头预览"
            :aria-checked="prefs.showPreview"
            @click="prefs.showPreview = !prefs.showPreview"
          ></button>
        </div>

        <div class="gc-row">
          <div>
            <div class="gc-label">Debug</div>
            <div class="gc-hint">FPS / 阈值 / 速度</div>
          </div>
          <button
            type="button"
            class="ios-switch mini"
            role="switch"
            aria-label="Debug 模式"
            :aria-checked="prefs.debug"
            @click="prefs.debug = !prefs.debug"
          ></button>
        </div>

        <!-- 预览 -->
        <GestureCameraPreview
          v-if="enabled && prefs.showPreview && tracking.stream.value"
          :stream="tracking.stream.value"
          :landmarks="tracking.landmarks.value"
          :palm="tracking.palm.value"
          :has-hand="tracking.hasHand.value"
          :mirrored="true"
        />

        <!-- Debug -->
        <GestureDebugPanel v-if="prefs.debug" :debug="debugInfo" />

        <div class="gc-foot">
          <span class="gc-hint">👆=指针 · 🤏轻点=点击 · 🤏拖=滚动 · ✋=换页 · ✊=暂停</span>
        </div>
      </div>
    </Transition>

    <GestureVirtualCursor
      :x="pointer.x"
      :y="pointer.y"
      :visible="pointer.visible && enabled"
      :pressing="pointer.pressing"
    />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Hand } from 'lucide-vue-next'
import { useGestureControl } from '../../composables/useGestureControl'
import GestureCameraPreview from './GestureCameraPreview.vue'
import GestureDebugPanel from './GestureDebugPanel.vue'
import GestureVirtualCursor from './GestureVirtualCursor.vue'

const {
  enabled,
  enable,
  disable,
  destroy,
  stateLabel,
  gestureLabel,
  statusText,
  statusTone,
  prefs,
  setSensitivity,
  tracking,
  pointer,
  debugInfo,
} = useGestureControl()

const collapsed = ref(true)
const busy = ref(false)
const isMobile = ref(false)

const sensOptions = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
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

async function toggle() {
  if (busy.value) return
  if (enabled.value) {
    busy.value = true
    disable()
    busy.value = false
    return
  }
  busy.value = true
  try {
    await enable()
  } finally {
    busy.value = false
  }
}

function onResize() {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  onResize()
  // 手机默认收起成胶囊，桌面默认展开
  collapsed.value = isMobile.value
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  // 组件卸载必须真正关摄像头、停推理、清轨迹
  destroy()
})
</script>

<style scoped>
.gc {
  position: fixed;
  top: calc(14px + env(safe-area-inset-top));
  right: max(12px, calc((100vw - var(--page-max)) / 2 + 8px));
  z-index: 1200;
  width: min(280px, calc(100vw - 24px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.gc-head,
.gc-panel {
  pointer-events: auto;
}

.gc-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 999px;
  background: var(--glass-bg-strong);
}

.gc-expand {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex: 0 0 auto;
  transition: background 160ms ease, transform 120ms var(--ease-glass);
}

.gc-expand:hover {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.gc-expand:active {
  transform: scale(0.92);
}

.gc-head-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.gc-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  white-space: nowrap;
}

.gc-status {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gc-status.loading {
  color: #ff9500;
}

.gc-status.running {
  color: #34c759;
}

.gc-status.hand {
  color: var(--accent);
}

.gc-status.error {
  color: #ff453a;
}

.gc-panel {
  border-radius: var(--radius-lg);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--glass-bg-strong);
  max-height: min(70vh, 560px);
  overflow-y: auto;
}

.gc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.gc-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.gc-value {
  font-size: 12px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.gc-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.gc-msg {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
}

.gc-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gc-seg {
  width: 100%;
}

.gc-foot {
  padding-top: 2px;
}

/* Segmented —— 复用设计系统样式（与 SettingsPanel 一致） */
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
  font-family: inherit;
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

/* iOS mini switch（与 AuthPanel 一致） */
.ios-switch.mini {
  width: 42px;
  height: 25px;
}

.ios-switch.mini::after {
  width: 21px;
  height: 21px;
  top: 2px;
  left: 2px;
}

.ios-switch.mini[aria-checked="true"]::after {
  transform: translateX(17px);
}

.ios-switch:disabled {
  opacity: 0.55;
  cursor: default;
}

/* 入场 */
.gc-pop-enter-active,
.gc-pop-leave-active {
  transition:
    opacity 220ms var(--ease-glass),
    transform 220ms var(--ease-glass);
}

.gc-pop-enter-from,
.gc-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

/* 手机端：默认折叠成胶囊 */
@media (max-width: 767px) {
  .gc {
    width: auto;
    right: 12px;
  }

  .gc-collapsed .gc-head {
    padding: 8px;
  }

  .gc-collapsed .gc-head-main {
    display: none;
  }

  .gc-panel {
    width: min(280px, calc(100vw - 24px));
    max-height: 58vh;
  }
}
</style>
