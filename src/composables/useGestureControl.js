/**
 * useGestureControl —— 手势状态机 + 食指虚拟指针 + 连续滚动 + 点击
 *
 * 交互模型（v2 · 食指鼠标）：
 *   👆 食指伸出     → 虚拟指针跟随食指尖，可指向页面元素
 *   🤏 捏合         → 在指针位置点击（触发 onPinch）
 *   ✋ 张开手掌移动  → 连续滚动（上下）/ 左右挥切换
 *   ✊ 握拳         → 暂停
 *
 * 状态机：
 *   OFF → 完全停止
 *   ON  → IDLE →（✋ 或 👆）ACTIVE ⇄ SCROLLING
 *                   ↓ 捏合/左右挥     ↓ 握拳
 *                COOLDOWN → ACTIVE   PAUSED →（✋/👆）ACTIVE
 *   丢手一段时间 → IDLE
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
  pinchDistance,
  adaptivePinchThreshold,
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

/** 虚拟指针（视口像素） */
const pointer = reactive({
  x: 0,
  y: 0,
  visible: false,
  pressing: false,
})

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
  pointerX: 0,
  pointerY: 0,
})

const tracking = useHandTracking()
const smoother = createVelocitySmoother({ smoothFactor: 0.15, maxVelocity: 56 })

let controlRaf = 0
let lastPoint = null
let lastFrameTs = 0
let cooldownUntil = 0
let lastSwipeAt = 0
let lastPinchAt = 0
let lastClickAt = 0
let lastGestureStable = 'none'
let gestureHoldMs = 0
let prevGestureAt = 0
let destroyed = false
let lastDebugPush = 0
let cooldownTimer = 0
let pinchArmed = true // 捏合需松开后再捏，防连点
let autoActivateMs = 0

// 捏合拖拽滚动（grab-and-drag）
let pinchHolding = false
let pinchStartAt = 0
let pinchLastX = 0
let pinchLastY = 0
let pinchTravel = 0
let pinchLastVelY = 0

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

watch(prefs, () => persistPrefs(), { deep: true })

function setSensitivity(level) {
  if (level === 'low' || level === 'medium' || level === 'high') {
    prefs.sensitivity = level
  }
}

function setPanelMessage(msg) {
  panelMessage.value = msg
}

function clearControlState() {
  lastPoint = null
  lastFrameTs = 0
  cooldownUntil = 0
  lastSwipeAt = 0
  lastPinchAt = 0
  lastClickAt = 0
  lastGestureStable = 'none'
  gestureHoldMs = 0
  prevGestureAt = 0
  pinchArmed = true
  autoActivateMs = 0
  endPinchHold(false)
  smoother.reset()
  if (cooldownTimer) {
    clearTimeout(cooldownTimer)
    cooldownTimer = 0
  }
  currentGesture.value = 'none'
  state.value = 'IDLE'
  lastAction.value = ''
  pointer.visible = false
  pointer.pressing = false
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
    pointerX: 0,
    pointerY: 0,
  })
}

function cancelControlLoop() {
  if (controlRaf) {
    cancelAnimationFrame(controlRaf)
    controlRaf = 0
  }
}

/** 归一化坐标 → 视口像素（含边缘留白） */
function toViewport(x, y) {
  const padX = 24
  const padY = 24
  const w = window.innerWidth
  const h = window.innerHeight
  return {
    x: padX + x * (w - padX * 2),
    y: padY + y * (h - padY * 2),
  }
}

function updatePointer(x, y) {
  const p = toViewport(x, y)
  // 轻微平滑，避免指针抖
  if (pointer.x === 0 && pointer.y === 0) {
    pointer.x = p.x
    pointer.y = p.y
  } else {
    pointer.x += (p.x - pointer.x) * 0.35
    pointer.y += (p.y - pointer.y) * 0.35
  }
  pointer.visible = true
}

/**
 * 在虚拟指针位置合成点击
 * 不点击手势面板自身，避免误关开关
 */
function clickAtPointer() {
  const x = pointer.x
  const y = pointer.y
  if (!x || !y) return false

  const stack = document.elementsFromPoint(x, y)
  let target = null
  for (const el of stack) {
    if (!(el instanceof Element)) continue
    if (el.closest('.gc')) continue // 手势控制器
    if (el.closest('.sp-panel') || el.closest('.sp-overlay')) continue // 设置面板
    target = el
    break
  }
  if (!target) return false

  const common = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    view: window,
  }

  try {
    target.dispatchEvent(new PointerEvent('pointerdown', { ...common, pointerId: 1, isPrimary: true, pointerType: 'mouse' }))
    target.dispatchEvent(new MouseEvent('mousedown', common))
    target.dispatchEvent(new PointerEvent('pointerup', { ...common, pointerId: 1, isPrimary: true, pointerType: 'mouse' }))
    target.dispatchEvent(new MouseEvent('mouseup', common))
    target.dispatchEvent(new MouseEvent('click', common))
  } catch {
    // 极旧浏览器回退
    if (typeof target.click === 'function') target.click()
  }
  return true
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

  if (cooldownTimer) clearTimeout(cooldownTimer)
  cooldownTimer = window.setTimeout(() => {
    cooldownTimer = 0
    if (destroyed || !enabled.value) return
    if (state.value === 'COOLDOWN') state.value = 'ACTIVE'
  }, swipeCooldownMs)
}

function firePinch() {
  const now = performance.now()
  if (now - lastPinchAt < 380) return
  lastPinchAt = now

  // 在指针位置点击页面
  const clicked = clickAtPointer()
  if (clicked) lastClickAt = now

  let handled = false
  for (const fn of pinchHandlers) {
    try {
      fn({ x: pointer.x, y: pointer.y, clicked })
      handled = true
    } catch (err) {
      console.error('[gesture] pinch handler error', err)
    }
  }

  lastAction.value = 'pinch'
  setPanelMessage(clicked ? '🤏 已点击' : handled ? '🤏 捏合' : '🤏 捏合')
  pointer.pressing = true
  window.setTimeout(() => {
    if (!pinchHolding) pointer.pressing = false
  }, 120)
}

/** 开始捏合抓住页面 */
function beginPinchHold(x, y, ts) {
  pinchHolding = true
  pinchStartAt = ts
  pinchLastX = x
  pinchLastY = y
  pinchTravel = 0
  pinchLastVelY = 0
  pointer.pressing = true
  lastAction.value = 'pinch_grab'
  setPanelMessage('🤏 拖动中')
}

/**
 * 结束捏合：位移小 → 点击；位移大 → 视为拖拽滚动
 * @param {boolean} allowClick
 */
function endPinchHold(allowClick = true) {
  if (!pinchHolding) return
  const travel = pinchTravel
  const heldMs = performance.now() - pinchStartAt
  pinchHolding = false
  pointer.pressing = false

  // 松手后少量惯性
  if (Math.abs(pinchLastVelY) > 0.08) {
    smoother.setTarget(clampAbs(-pinchLastVelY * 900, 40))
    // 惯性在下一帧 tick 中自然衰减
    window.setTimeout(() => smoother.setTarget(0), 80)
  } else {
    smoother.setTarget(0)
  }

  // 轻点（几乎没位移、按得短）→ 点击
  const isTap = travel < 0.022 && heldMs < 520
  if (allowClick && isTap) {
    firePinch()
    return
  }

  if (travel >= 0.022) {
    lastAction.value = 'pinch_scroll'
    setPanelMessage('🤏 已拖动')
  }
}

/** 捏合拖拽：把手指位移映射为页面滚动（拖内容） */
function applyPinchDrag(x, y, dt) {
  const dx = x - pinchLastX
  const dy = y - pinchLastY
  pinchLastX = x
  pinchLastY = y
  pinchTravel += Math.hypot(dx, dy)

  // 手指上移（dy < 0）→ 内容跟着上移 → 页面向下滚（scrollBy 正方向）
  const gain = 1.35
  const scrollPx = -dy * window.innerHeight * gain
  if (Math.abs(scrollPx) >= 0.35) {
    window.scrollBy(0, scrollPx)
    state.value = 'SCROLLING'
    lastAction.value = 'pinch_scroll'
    if (dy < 0) setPanelMessage('🤏 向下滚动')
    else setPanelMessage('🤏 向上滚动')
  }

  // 供松手惯性用（归一化单位/秒）
  if (dt > 0) {
    pinchLastVelY = dy / dt
  }
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
  debugInfo.pointerX = Math.round(pointer.x)
  debugInfo.pointerY = Math.round(pointer.y)
}

/**
 * 控制循环：与 MediaPipe 推理解耦
 */
function controlLoop() {
  if (destroyed || !enabled.value) return
  controlRaf = requestAnimationFrame(controlLoop)

  const ts = performance.now()
  const presets = resolveSensitivity(prefs.sensitivity)

  // 无手 → 逐渐回到 IDLE，滚动自然减速，指针隐藏
  if (!tracking.hasHand.value || tracking.confidence.value < presets.minConfidence) {
    if (pinchHolding) endPinchHold(false)
    if (lastHandSeenAt.value && ts - lastHandSeenAt.value > presets.handLostMs) {
      if (state.value !== 'IDLE') {
        state.value = 'IDLE'
        currentGesture.value = 'none'
        lastPoint = null
        autoActivateMs = 0
      }
      pointer.visible = false
    }
    smoother.setTarget(0)
    applyScroll(smoother.tick(1), 1 / 60)
    if (prefs.debug) pushDebug(ts)
    return
  }

  lastHandSeenAt.value = ts

  const palm = tracking.palm.value
  const indexTip = tracking.indexTip.value
  const indexVel = tracking.indexVelocity.value
  const palmVel = tracking.palmVelocity.value
  const lm = tracking.landmarks.value

  if (!lm) {
    if (prefs.debug) pushDebug(ts)
    return
  }

  const dt = lastFrameTs ? Math.min((ts - lastFrameTs) / 1000, 0.1) : 1 / 60
  lastFrameTs = ts

  // 控制点优先食指指尖，退化到掌心
  const controlPt = indexTip || palm
  const controlVel = indexTip ? indexVel : palmVel

  if (!controlPt) {
    if (prefs.debug) pushDebug(ts)
    return
  }

  let deltaX = 0
  let deltaY = 0
  if (lastPoint) {
    deltaX = controlPt.x - lastPoint.x
    deltaY = controlPt.y - lastPoint.y
  }
  lastPoint = { x: controlPt.x, y: controlPt.y }

  // —— 静态手势 + 捏合迟滞（抓住后不轻易松开）——
  let shape = detectHandShape(lm, { pinchThreshold: presets.pinchThreshold })
  const pDist = pinchDistance(lm)
  const enterThr = adaptivePinchThreshold(lm, presets.pinchThreshold)
  const exitThr = enterThr * 1.55

  if (pinchHolding) {
    // 抓住中：距离略大也不松开
    if (pDist < exitThr) shape = 'pinch'
    else if (shape === 'unknown') shape = 'point'
  } else if (pDist < enterThr) {
    shape = 'pinch'
  }

  if (shape === lastGestureStable) {
    gestureHoldMs += dt * 1000
  } else {
    lastGestureStable = shape
    gestureHoldMs = 0
    prevGestureAt = ts
    if (shape !== 'point') autoActivateMs = 0
  }

  const stable = gestureHoldMs > 50 || (pinchHolding && shape === 'pinch')

  // ✊ 握拳 → 暂停
  if (stable && shape === 'fist') {
    if (pinchHolding) endPinchHold(false)
    if (state.value !== 'PAUSED') {
      state.value = 'PAUSED'
      currentGesture.value = 'fist'
      smoother.reset()
      smoother.setTarget(0)
      setPanelMessage('✊ 已暂停')
      lastAction.value = 'pause'
      pointer.visible = false
    }
    applyScroll(smoother.tick(dt * 60), dt)
    if (prefs.debug) {
      debugInfo.palmX = round3(palm?.x || 0)
      debugInfo.palmY = round3(palm?.y || 0)
      debugInfo.deltaX = round3(deltaX)
      debugInfo.deltaY = round3(deltaY)
      debugInfo.velocityX = round3(controlVel.x)
      debugInfo.velocityY = round3(controlVel.y)
      pushDebug(ts)
    }
    return
  }

  // PAUSED：张开手或食指指向恢复
  if (state.value === 'PAUSED') {
    if (stable && (shape === 'open_palm' || shape === 'point')) {
      state.value = 'ACTIVE'
      currentGesture.value = shape
      setPanelMessage('🟢 已恢复')
      lastAction.value = 'resume'
    } else {
      currentGesture.value = shape
      smoother.setTarget(0)
      applyScroll(smoother.tick(dt * 60), dt)
      if (prefs.debug) pushDebug(ts)
      return
    }
  }

  // IDLE → ACTIVE：张开手掌 或 稳定指向 均可激活
  if (state.value === 'IDLE') {
    const canActivate =
      (stable && (shape === 'open_palm' || shape === 'point')) ||
      // 连续检测到手 + 指向 350ms 也激活，降低门槛
      (shape === 'point' && (autoActivateMs += dt * 1000) > 350)

    if (canActivate) {
      state.value = 'ACTIVE'
      currentGesture.value = shape
      setPanelMessage(shape === 'point' ? '👆 指针已激活' : '✋ 已激活')
      lastAction.value = 'activate'
      autoActivateMs = 0
    } else {
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

  currentGesture.value = shape

  // —— 👆 / ✋ 时更新虚拟指针（食指为鼠标）——
  if (shape === 'point' || shape === 'open_palm' || shape === 'unknown') {
    if (indexTip) updatePointer(indexTip.x, indexTip.y)
  }

  // —— 🤏 捏合：抓住拖拽滚动；轻点才点击 ——
  if (shape === 'pinch') {
    if (!pinchHolding && stable) {
      beginPinchHold(controlPt.x, controlPt.y, ts)
      // 捏合时指针跟到捏合点
      if (indexTip) updatePointer(indexTip.x, indexTip.y)
    } else if (pinchHolding) {
      if (indexTip) updatePointer(indexTip.x, indexTip.y)
      applyPinchDrag(controlPt.x, controlPt.y, dt)
    }

    // 拖拽中不走 smoother，直接位移映射
    smoother.setTarget(0)
    applyScroll(smoother.tick(dt * 60), dt)

    if (prefs.debug) {
      debugInfo.palmX = round3(palm?.x || 0)
      debugInfo.palmY = round3(palm?.y || 0)
      debugInfo.deltaX = round3(deltaX)
      debugInfo.deltaY = round3(deltaY)
      debugInfo.velocityX = round3(controlVel.x)
      debugInfo.velocityY = round3(controlVel.y)
      pushDebug(ts)
    }
    return
  }

  // 刚松开捏合
  if (pinchHolding) {
    endPinchHold(true)
    if (prefs.debug) pushDebug(ts)
    // 落到后续逻辑处理惯性/滚动
  }

  // —— 模式区分 ——
  // point：食指当鼠标
  // open_palm：左右挥换页（纵向改由捏合拖拽）
  const isPointerMode = shape === 'point'
  const isScrollMode = shape === 'open_palm'

  // 左右快挥（张开手掌时，离散 + cooldown）
  if (isScrollMode && state.value !== 'COOLDOWN') {
    const swipe = detectSwipe(controlVel, { swipeThreshold: presets.swipeThreshold })
    if (swipe && performance.now() > cooldownUntil) {
      fireSwipe(swipe)
      smoother.setTarget(0)
      applyScroll(smoother.tick(dt * 60), dt)
      if (prefs.debug) pushDebug(ts)
      return
    }
  }

  // 非拖拽：保留松手惯性，滚完自动回 ACTIVE
  if (state.value === 'SCROLLING' && !pinchHolding) {
    const v = smoother.tick(dt * 60)
    applyScroll(v, dt)
    if (Math.abs(v) < 0.6 && Math.abs(smoother.target) < 0.6) {
      smoother.reset()
      state.value = 'ACTIVE'
      setPanelMessage('🟢 等待手势')
    }
    if (prefs.debug) {
      debugInfo.palmX = round3(palm?.x || 0)
      debugInfo.palmY = round3(palm?.y || 0)
      debugInfo.deltaX = round3(deltaX)
      debugInfo.deltaY = round3(deltaY)
      debugInfo.velocityX = round3(controlVel.x)
      debugInfo.velocityY = round3(controlVel.y)
      pushDebug(ts)
    }
    return
  }

  smoother.setTarget(0)
  if (state.value === 'SCROLLING') {
    state.value = 'ACTIVE'
  }
  if (isPointerMode && state.value === 'ACTIVE') {
    if (panelMessage.value !== '👆 指针模式') setPanelMessage('👆 指针模式')
  }

  applyScroll(smoother.tick(dt * 60), dt)

  if (prefs.debug) {
    debugInfo.palmX = round3(palm?.x || 0)
    debugInfo.palmY = round3(palm?.y || 0)
    debugInfo.deltaX = round3(deltaX)
    debugInfo.deltaY = round3(deltaY)
    debugInfo.velocityX = round3(controlVel.x)
    debugInfo.velocityY = round3(controlVel.y)
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
    pointer,
    // debug
    debugInfo,
  }
}

// 便捷再导出，供页面接入
export { onGestureSwipeLeft as onSwipeLeft }
export { onGestureSwipeRight as onSwipeRight }
export { onGesturePinch as onPinch }
