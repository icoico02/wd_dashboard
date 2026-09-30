/**
 * useGestureControl —— 手势状态机 + 连续滚动 + Gesture → Action
 *
 * 状态机：
 *   OFF（总开关关）→ 完全停止
 *   ON → IDLE →（✋ 张开手）ACTIVE ⇄ SCROLLING
 *                    ↓ 左右挥        ↓ 握拳
 *                 COOLDOWN → ACTIVE  PAUSED →（✋）ACTIVE
 *   丢失手势一段时间 → IDLE
 */

import { computed, reactive, ref, watch } from 'vue'
import { useHandTracking } from './useHandTracking'
import {
  createVelocitySmoother,
  resolveSensitivity,
} from '../utils/gestureSmoothing'
import {
  detectHandShape,
  detectSwipe,
  GESTURE_LABELS,
  STATE_LABELS,
} from '../utils/gestureDetector'
import { useToast } from './useToast'
import router from '../router'

const STORAGE_KEY = 'dada-dashboard:gesture'

/** 默认路由顺序：左右挥手在无自定义 handler 时切换页面 */
const ROUTE_ORDER = ['/', '/checkin', '/timer', '/inventory']

function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return {
      sensitivity: raw.sensitivity === 'low' || raw.sensitivity === 'high' ? raw.sensitivity : 'medium',
      showPreview: !!raw.showPreview,
      debug: !!raw.debug,
    }
  } catch {
    return { sensitivity: 'medium', showPreview: false, debug: false }
  }
}

// —— 页面可订阅的钩子（提供 onSwipeLeft / onSwipeRight / onPinch）——
const swipeLeftHandlers = new Set()
const swipeRightHandlers = new Set()
const pinchHandlers = new Set()

export function onGestureSwipeLeft(handler) {
  swipeLeftHandlers.add(handler)
  return () => swipeLeftHandlers.delete(handler)
}

export function onGestureSwipeRight(handler) {
  swipeRightHandlers.add(handler)
  return () => swipeRightHandlers.delete(handler)
}

export function onGesturePinch(handler) {
  pinchHandlers.add(handler)
  return () => pinchHandlers.delete(handler)
}

// —— 模块级单例状态（多组件共享）——
const prefs = reactive(loadPrefs())
const enabled = ref(false) // 总开关，每次进站默认 OFF
const state = ref('IDLE') // IDLE | ACTIVE | SCROLLING | COOLDOWN | PAUSED
const currentGesture = ref('none')
const lastAction = ref('')
const panelMessage = ref('')
const lastHandSeenAt = ref(0)

// Debug 快照（低频写入，避免每帧打响应式）
const debugInfo = reactive({
  fps: 0,
  confidence: 0,
  palmX: 0,
  palmY: 0,
  deltaX: 0,
  deltaY: 0,
  velocityX: 0,
  velocityY: 0,
  gesture: 'none',
  state: 'IDLE',
  scrollVelocity: 0,
  inferenceMs: 0,
})

const tracking = useHandTracking()
const smoother = createVelocitySmoother({ smoothFactor: 0.15, maxVelocity: 48 })

let controlRaf = 0
let lastPalm = null
let lastFrameTs = 0
let cooldownUntil = 0
let lastSwipeAt = 0
let lastPinchAt = 0
let lastGestureStable = 'none'
let gestureHoldMs = 0
let prevGestureAt = 0
let destroyed = false
let lastDebugPush = 0
let cooldownTimer = 0

function persistPrefs() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        sensitivity: prefs.sensitivity,
        showPreview: prefs.showPreview,
        debug: prefs.debug,
      }),
    )
  } catch {
    /* ignore */
  }
}

watch(
  prefs,
  () => {
    persistPrefs()
  },
  { deep: true },
)

function setSensitivity(level) {
  if (level === 'low' || level === 'medium' || level === 'high') {
    prefs.sensitivity = level
  }
}

function setPanelMessage(msg) {
  panelMessage.value = msg
}

function clearControlState() {
  lastPalm = null
  lastFrameTs = 0
  cooldownUntil = 0
  lastSwipeAt = 0
  lastPinchAt = 0
  lastGestureStable = 'none'
  gestureHoldMs = 0
  prevGestureAt = 0
  smoother.reset()
  if (cooldownTimer) {
    clearTimeout(cooldownTimer)
    cooldownTimer = 0
  }
  currentGesture.value = 'none'
  state.value = 'IDLE'
  lastAction.value = ''
  Object.assign(debugInfo, {
    fps: 0,
    confidence: 0,
    palmX: 0,
    palmY: 0,
    deltaX: 0,
    deltaY: 0,
    velocityX: 0,
    velocityY: 0,
    gesture: 'none',
    state: 'IDLE',
    scrollVelocity: 0,
    inferenceMs: 0,
  })
}

function cancelControlLoop() {
  if (controlRaf) {
    cancelAnimationFrame(controlRaf)
    controlRaf = 0
  }
}

/**
 * 手势 → 动作
 */
function fireSwipe(direction) {
  const now = performance.now()
  const { swipeCooldownMs } = resolveSensitivity(prefs.sensitivity)
  if (now - lastSwipeAt < swipeCooldownMs) return
  if (now < cooldownUntil) return

  lastSwipeAt = now
  cooldownUntil = now + swipeCooldownMs
  state.value = 'COOLDOWN'

  const handlers = direction === 'left' ? swipeLeftHandlers : swipeRightHandlers
  let handled = false
  for (const fn of handlers) {
    try {
      fn()
      handled = true
    } catch (err) {
      console.error('[gesture] swipe handler error', err)
    }
  }

  if (!handled) {
    // 默认：切换路由页面（左=上一页，右=下一页）
    const current = router.currentRoute.value.path
    const idx = ROUTE_ORDER.indexOf(current)
    if (idx !== -1) {
      const nextIdx =
        direction === 'left' ? Math.max(0, idx - 1) : Math.min(ROUTE_ORDER.length - 1, idx + 1)
      if (nextIdx !== idx) {
        router.push(ROUTE_ORDER[nextIdx]).catch(() => {})
      }
    }
    lastAction.value = direction === 'left' ? 'swipe_left' : 'swipe_right'
    setPanelMessage(direction === 'left' ? '← 上一页' : '→ 下一页')
  } else {
    lastAction.value = direction === 'left' ? 'swipe_left' : 'swipe_right'
    setPanelMessage(direction === 'left' ? '← 左挥' : '→ 右挥')
  }

  // COOLDOWN 稍后回到 ACTIVE
  if (cooldownTimer) clearTimeout(cooldownTimer)
  cooldownTimer = window.setTimeout(() => {
    cooldownTimer = 0
    if (destroyed || !enabled.value) return
    if (state.value === 'COOLDOWN') state.value = 'ACTIVE'
  }, swipeCooldownMs)
}

function firePinch() {
  const now = performance.now()
  if (now - lastPinchAt < 500) return
  lastPinchAt = now
  let handled = false
  for (const fn of pinchHandlers) {
    try {
      fn()
      handled = true
    } catch (err) {
      console.error('[gesture] pinch handler error', err)
    }
  }
  lastAction.value = 'pinch'
  setPanelMessage(handled ? '🤏 已捏合' : '🤏 捏合')
}

function pushDebug(ts) {
  if (ts - lastDebugPush < 120) return
  lastDebugPush = ts
  debugInfo.fps = tracking.fps.value
  debugInfo.confidence = tracking.confidence.value
  debugInfo.inferenceMs = tracking.inferenceMs.value
  debugInfo.gesture = currentGesture.value
  debugInfo.state = state.value
  debugInfo.scrollVelocity = Math.round(smoother.current * 100) / 100
}

/**
 * 控制循环：与 MediaPipe 推理解耦
 * 用 rAF 持续更新滚动速度
 */
function controlLoop() {
  if (destroyed || !enabled.value) return
  controlRaf = requestAnimationFrame(controlLoop)

  const ts = performance.now()
  const presets = resolveSensitivity(prefs.sensitivity)

  // 无手 → 逐渐回到 IDLE，滚动自然减速
  if (!tracking.hasHand.value || tracking.confidence.value < presets.minConfidence) {
    if (lastHandSeenAt.value && ts - lastHandSeenAt.value > presets.handLostMs) {
      if (state.value !== 'IDLE') {
        state.value = 'IDLE'
        currentGesture.value = 'none'
        lastPalm = null
      }
    }
    smoother.setTarget(0)
    applyScroll(smoother.tick(1), 1 / 60)
    if (prefs.debug) pushDebug(ts)
    return
  }

  lastHandSeenAt.value = ts

  const palm = tracking.palm.value
  const velocity = tracking.palmVelocity.value
  const lm = tracking.landmarks.value

  if (!palm) {
    if (prefs.debug) pushDebug(ts)
    return
  }

  const dt = lastFrameTs ? Math.min((ts - lastFrameTs) / 1000, 0.1) : 1 / 60
  lastFrameTs = ts

  // 帧间位移（平滑后）—— 主要用于 debug 显示
  let deltaX = 0
  let deltaY = 0
  if (lastPalm) {
    deltaX = palm.x - lastPalm.x
    deltaY = palm.y - lastPalm.y
  }
  lastPalm = { x: palm.x, y: palm.y }

  // —— 静态手势 ——
  const shape = detectHandShape(lm, { pinchThreshold: presets.pinchThreshold })

  // 手势稳定化：连续若干帧同形态才切换
  if (shape === lastGestureStable) {
    gestureHoldMs += dt * 1000
  } else {
    lastGestureStable = shape
    gestureHoldMs = 0
    prevGestureAt = ts
  }

  const stable = gestureHoldMs > 80

  if (stable && shape === 'fist') {
    if (state.value !== 'PAUSED') {
      state.value = 'PAUSED'
      currentGesture.value = 'fist'
      smoother.reset()
      smoother.setTarget(0)
      setPanelMessage('✊ 已暂停')
      lastAction.value = 'pause'
    }
    applyScroll(smoother.tick(dt * 60), dt)
    if (prefs.debug) {
      debugInfo.palmX = round3(palm.x)
      debugInfo.palmY = round3(palm.y)
      debugInfo.deltaX = round3(deltaX)
      debugInfo.deltaY = round3(deltaY)
      debugInfo.velocityX = round3(velocity.x)
      debugInfo.velocityY = round3(velocity.y)
      pushDebug(ts)
    }
    return
  }

  // PAUSED：仅张开手掌恢复
  if (state.value === 'PAUSED') {
    if (stable && shape === 'open_palm') {
      state.value = 'ACTIVE'
      currentGesture.value = 'open_palm'
      setPanelMessage('🟢 已恢复')
      lastAction.value = 'resume'
    } else {
      currentGesture.value = shape === 'none' ? 'none' : shape
      smoother.setTarget(0)
      applyScroll(smoother.tick(dt * 60), dt)
      if (prefs.debug) pushDebug(ts)
      return
    }
  }

  // IDLE → ACTIVE：需要张开手掌激活，避免误触
  if (state.value === 'IDLE') {
    if (stable && shape === 'open_palm') {
      state.value = 'ACTIVE'
      currentGesture.value = 'open_palm'
      setPanelMessage('✋ 已激活')
      lastAction.value = 'activate'
    } else {
      // IDLE 不响应移动/挥手
      smoother.setTarget(0)
      applyScroll(smoother.tick(dt * 60), dt)
      if (prefs.debug) {
        debugInfo.gesture = shape
        debugInfo.state = state.value
        pushDebug(ts)
      }
      return
    }
  }

  // ACTIVE / SCROLLING / COOLDOWN 下的逻辑
  currentGesture.value = shape

  // 捏合
  if (stable && shape === 'pinch') {
    firePinch()
    smoother.setTarget(0)
    applyScroll(smoother.tick(dt * 60), dt)
    if (prefs.debug) {
      debugInfo.palmX = round3(palm.x)
      debugInfo.palmY = round3(palm.y)
      debugInfo.deltaX = round3(deltaX)
      debugInfo.deltaY = round3(deltaY)
      debugInfo.velocityX = round3(velocity.x)
      debugInfo.velocityY = round3(velocity.y)
      pushDebug(ts)
    }
    return
  }

  // 左右快挥（离散 + cooldown）
  if (state.value !== 'COOLDOWN') {
    const swipe = detectSwipe(velocity, { swipeThreshold: presets.swipeThreshold })
    if (swipe && performance.now() > cooldownUntil) {
      fireSwipe(swipe)
      smoother.setTarget(0)
      applyScroll(smoother.tick(dt * 60), dt)
      if (prefs.debug) pushDebug(ts)
      return
    }
  }

  // —— 连续滚动（核心）——
  // 用 Palm 速度（归一化单位/秒）实时映射滚动速度，隔空触摸屏手感
  // 手向上（velocity.y < 0）→ 页面向下滚（window.scrollBy 正方向）
  // 死区：微小手抖不滚；手停目标速度归零，平滑减速
  const speedY = velocity.y
  const inDeadZone = Math.abs(speedY) < presets.velocityDeadZone

  if (!inDeadZone && (state.value === 'ACTIVE' || state.value === 'SCROLLING')) {
    // units/s → px/s
    const gain = 1600
    const targetV = clampAbs(-speedY * gain * presets.velocityMultiplier, 56)
    smoother.setTarget(targetV)
    if (state.value !== 'SCROLLING') {
      state.value = 'SCROLLING'
      setPanelMessage(speedY < 0 ? '↑ 正在向下滚动' : '↓ 正在向上滚动')
    }
    lastAction.value = speedY < 0 ? 'scroll_down' : 'scroll_up'
  } else {
    smoother.setTarget(0)
    if (state.value === 'SCROLLING') {
      state.value = 'ACTIVE'
      setPanelMessage('🟢 等待手势')
    }
  }

  applyScroll(smoother.tick(dt * 60), dt)

  if (prefs.debug) {
    debugInfo.palmX = round3(palm.x)
    debugInfo.palmY = round3(palm.y)
    debugInfo.deltaX = round3(deltaX)
    debugInfo.deltaY = round3(deltaY)
    debugInfo.velocityX = round3(velocity.x)
    debugInfo.velocityY = round3(velocity.y)
    pushDebug(ts)
  }
}

/** v 为 px/s，dt 为秒 */
function applyScroll(v, dt) {
  if (!Number.isFinite(v) || Math.abs(v) < 0.4) return
  window.scrollBy(0, v * dt)
}

function clampAbs(v, max) {
  return Math.max(-max, Math.min(max, v))
}

function round3(n) {
  return Math.round(n * 1000) / 1000
}

async function enable() {
  if (enabled.value) return
  destroyed = false
  clearControlState()
  enabled.value = true
  setPanelMessage('🟡 正在启动...')

  await tracking.start()

  if (!enabled.value) {
    // 用户在启动过程中关掉了
    tracking.stop()
    return
  }

  if (tracking.status.value === 'running') {
    setPanelMessage('🟢 等待手势')
    lastHandSeenAt.value = 0
    lastFrameTs = 0
    cancelControlLoop()
    controlLoop()
  } else {
    // 权限拒绝 / 错误 → 自动回 OFF
    const msg = tracking.errorMessage.value || '手势控制启动失败'
    setPanelMessage(msg)
    enabled.value = false
    clearControlState()
    tracking.stop()
    try {
      const { showToast } = useToast()
      showToast?.(msg)
    } catch {
      /* toast 可用性非关键 */
    }
  }
}

function disable() {
  enabled.value = false
  cancelControlLoop()
  tracking.stop()
  clearControlState()
  setPanelMessage('')
  lastHandSeenAt.value = 0
}

/** 页面卸载 / 组件销毁：彻底释放摄像头与推理 */
function destroy() {
  destroyed = true
  disable()
  tracking.destroy()
}

// 页面卸载时确保摄像头真正关闭
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', destroy)
  window.addEventListener('beforeunload', destroy)
}

// 状态文案（供 UI）
const stateLabel = computed(() => STATE_LABELS[state.value] || state.value)
const gestureLabel = computed(() => GESTURE_LABELS[currentGesture.value] || currentGesture.value)
const statusTone = computed(() => {
  if (!enabled.value) return 'off'
  if (tracking.status.value === 'loading') return 'loading'
  if (tracking.status.value === 'error' || tracking.status.value === 'denied') return 'error'
  if (tracking.hasHand.value) return 'hand'
  return 'running'
})

const statusText = computed(() => {
  if (!enabled.value) return '⚪ OFF'
  if (tracking.status.value === 'loading') return '🟡 正在启动...'
  if (tracking.status.value === 'error' || tracking.status.value === 'denied') {
    return '🔴 ' + (tracking.errorMessage.value || '出错了')
  }
  if (state.value === 'PAUSED') return '🟣 ' + (panelMessage.value || '已暂停')
  if (tracking.hasHand.value) {
    return panelMessage.value || '🔵 已检测到手'
  }
  return '🟢 等待手势'
})

export function useGestureControl() {
  return {
    // 开关
    enabled,
    enable,
    disable,
    destroy,
    // 状态
    state,
    stateLabel,
    currentGesture,
    gestureLabel,
    statusText,
    statusTone,
    panelMessage,
    lastAction,
    // 设置
    prefs,
    setSensitivity,
    // 追踪数据
    tracking,
    // debug
    debugInfo,
  }
}

// 便捷再导出，供页面接入
export { onGestureSwipeLeft as onSwipeLeft }
export { onGestureSwipeRight as onSwipeRight }
export { onGesturePinch as onPinch }
