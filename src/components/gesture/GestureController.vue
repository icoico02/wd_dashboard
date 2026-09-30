<template>
  <div
    ref="rootRef"
    class="gc"
    :class="{ 'gc-collapsed': collapsed && isMobile, 'gc-flip': flipPanel, 'gc-dragging': dragging }"
    :style="rootStyle"
  >
    <!-- 紧凑头：可拖拽 · 图标 · 开关 -->
    <div
      class="gc-head glass"
      @pointerdown="onHeadPointerDown"
    >
      <button
        type="button"
        class="gc-expand"
        :aria-label="collapsed ? '展开手势控制' : '收起手势控制'"
        @click.stop="onExpandClick"
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
        @click.stop="toggle"
        @pointerdown.stop
      ></button>
    </div>

    <!-- 详细面板 -->
    <Transition name="gc-pop">
      <div v-if="!collapsed" class="gc-panel glass" @pointerdown.stop>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

const POS_KEY = 'dada-dashboard:gesture-pos'

const collapsed = ref(true)
const busy = ref(false)
const isMobile = ref(false)
const rootRef = ref(null)
const dragging = ref(false)
const flipPanel = ref(false)

/** 位置：left/top 像素；null = 默认右上 */
const pos = ref(loadPos())

function loadPos() {
  try {
    const raw = JSON.parse(localStorage.getItem(POS_KEY) || 'null')
    if (raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)) {
      return { x: raw.x, y: raw.y }
    }
  } catch {
    /* ignore */
  }
  return null
}

function savePos() {
  if (!pos.value) return
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos.value))
  } catch {
    /* ignore */
  }
}

const rootStyle = computed(() => {
  if (!pos.value) {
    // 默认：右上角（保留原设计位置）
    return {
      right: 'max(12px, calc((100vw - var(--page-max)) / 2 + 8px))',
      top: 'calc(14px + env(safe-area-inset-top))',
    }
  }
  return {
    left: `${pos.value.x}px`,
    top: `${pos.value.y}px`,
    right: 'auto',
  }
})

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

function onExpandClick() {
  if (dragState.moved) return
  collapsed.value = !collapsed.value
  if (!collapsed.value) updateFlip()
}

/** 点击控制器 / 弹窗之外 → 关闭弹窗 */
function onDocPointerDown(e) {
  if (collapsed.value) return
  const root = rootRef.value
  if (root && e.target instanceof Node && root.contains(e.target)) return
  collapsed.value = true
}

function onKey(e) {
  if (e.key === 'Escape' && !collapsed.value) {
    collapsed.value = true
  }
}

// —— 拖拽 ——
const dragState = {
  active: false,
  moved: false,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
  pointerId: -1,
}

function clampPos(x, y) {
  const el = rootRef.value
  const w = el?.offsetWidth || 200
  const h = el?.offsetHeight || 48
  const maxX = Math.max(8, window.innerWidth - w - 8)
  const maxY = Math.max(8, window.innerHeight - h - 8)
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  }
}

function onHeadPointerDown(e) {
  // 只允许主键 / 单指；按钮不参与拖拽
  if (e.button != null && e.button !== 0) return
  if (e.target.closest('button')) return

  const el = rootRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  dragState.active = true
  dragState.moved = false
  dragState.startX = e.clientX
  dragState.startY = e.clientY
  dragState.originX = rect.left
  dragState.originY = rect.top
  dragState.pointerId = e.pointerId

  // 当前是 right 定位时，先落到 left/top
  if (!pos.value) {
    pos.value = { x: rect.left, y: rect.top }
  }

  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  e.preventDefault()
}

function onPointerMove(e) {
  if (!dragState.active || e.pointerId !== dragState.pointerId) return
  const dx = e.clientX - dragState.startX
  const dy = e.clientY - dragState.startY
  if (!dragState.moved && Math.hypot(dx, dy) < 4) return

  dragState.moved = true
  dragging.value = true
  const next = clampPos(dragState.originX + dx, dragState.originY + dy)
  pos.value = next
  updateFlip()
}

function onPointerUp(e) {
  if (!dragState.active || e.pointerId !== dragState.pointerId) return
  dragState.active = false
  dragging.value = false
  if (dragState.moved) {
    savePos()
    // 避免拖完误触发 click
    window.setTimeout(() => {
      dragState.moved = false
    }, 0)
  }
}

function updateFlip() {
  const el = rootRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  // 下方空间不足且上方更宽敞 → 面板向上弹
  flipPanel.value = spaceBelow < 300 && rect.top > 280
}

function onResize() {
  isMobile.value = window.innerWidth < 768
  if (pos.value) {
    pos.value = clampPos(pos.value.x, pos.value.y)
    savePos()
  }
  if (!collapsed.value) updateFlip()
}

onMounted(() => {
  onResize()
  collapsed.value = isMobile.value
  window.addEventListener('resize', onResize)
  document.addEventListener('pointerdown', onDocPointerDown, true)
  document.addEventListener('keydown', onKey)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  destroy()
})

watch(collapsed, (v) => {
  if (!v) updateFlip()
})
</script>

<style scoped>
.gc {
  position: fixed;
  z-index: 1200;
  width: min(280px, calc(100vw - 24px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  touch-action: none;
}

.gc-flip {
  flex-direction: column-reverse;
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
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.gc-dragging .gc-head {
  cursor: grabbing;
  box-shadow: var(--glass-shadow-hover);
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
  touch-action: pan-y;
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

.gc-flip .gc-pop-enter-from,
.gc-flip .gc-pop-leave-to {
  transform: translateY(6px) scale(0.98);
}

/* 手机端：默认折叠成胶囊 */
@media (max-width: 767px) {
  .gc {
    width: auto;
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
